"""Calculs du Merge (merge_bridge.py) sur de petits modèles fabriqués ici : résultats exacts, écriture couche par couche.
Lancer avec le Python du Studio :
    C:\\KaneOS\\KaneAppData\\runtimes\\studio\\venv\\Scripts\\python.exe tools\\test-merge-bridge.py [ancien_merge_bridge.py]
Avec un second argument, chaque fichier produit est aussi comparé, tenseur par tenseur, à celui de cette autre version.
Tout se passe dans un dossier temporaire.
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import torch
from safetensors.torch import load_file, save_file

ROOT = Path(__file__).resolve().parents[1]
BRIDGE = ROOT / "merge_bridge.py"
OLD = Path(sys.argv[1]) if len(sys.argv) > 1 else None
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
fails = 0


def check(ok, msg):
    global fails
    print(("OK " if ok else "ÉCHEC ") + msg)
    fails += 0 if ok else 1


def run(script, cmd, job):
    r = subprocess.run([sys.executable, str(script), cmd], input=json.dumps(job), capture_output=True, text=True, encoding="utf-8",
                       env={**__import__("os").environ, "PYTHONIOENCODING": "utf-8"})   # comme Lora Studio
    lines = [json.loads(l) for l in r.stdout.splitlines() if l.strip().startswith("{")]
    return lines[-1] if lines else {"ok": False, "error": r.stderr[-400:]}


tmp = Path(tempfile.mkdtemp(prefix="lorastudio-merge-"))
g = torch.Generator().manual_seed(7)
rnd = lambda *s: torch.randn(*s, generator=g)


def ckpt(name, dtype=torch.bfloat16, extra=True):
    t = {f"net.blocks.{i}.attn.weight": rnd(16, 8).to(dtype) for i in range(4)}
    t.update({f"net.blocks.{i}.adaln_modulation.1.weight": rnd(24, 8).to(dtype) for i in range(4)})
    t["net.final.bias"] = rnd(16).to(torch.float32)
    t["net.pos_ids"] = torch.arange(10, dtype=torch.int64)
    if extra:
        t["net.only_in_a.weight"] = rnd(4, 4).to(dtype)
    save_file(t, str(tmp / name))
    return str(tmp / name), t


A, tA = ckpt("a.safetensors")
B, tB = ckpt("b.safetensors", extra=False)
C, tC = ckpt("c.safetensors", extra=False)
save_file({"decoder.middle.0.residual.0.gamma": rnd(8), "encoder.conv.weight": rnd(4, 3)}, str(tmp / "vae.safetensors"))
save_file({"model.layers.0.post_attention_layernorm.weight": rnd(1024), "model.layers.0.self_attn.q_norm.weight": rnd(64),
           "model.embed_tokens.weight": rnd(32, 1024).to(torch.bfloat16)}, str(tmp / "te.safetensors"))
VAE, TE = str(tmp / "vae.safetensors"), str(tmp / "te.safetensors")
down, up = rnd(4, 8), rnd(16, 4)
save_file({"lora_unet_blocks_0_attn.lora_down.weight": down, "lora_unet_blocks_0_attn.lora_up.weight": up,
           "lora_unet_blocks_0_attn.alpha": torch.tensor(2.0)}, str(tmp / "l1.safetensors"))
L1 = str(tmp / "l1.safetensors")
f32 = lambda x: x.to(torch.float32)

jobs = {
    "sum": ("checkpoints", {"models": [A, B], "mode": "sum", "alpha": 0.3, "dtype": "source"}),
    "diff_gradient": ("checkpoints", {"models": [A, B, C], "mode": "diff", "alpha": 0.5, "alpha_end": 1.0, "dtype": "fp32"}),
    "sum_embed": ("checkpoints", {"models": [A, B], "mode": "sum", "alpha": 0.5, "dtype": "bf16", "embed": {"vae": VAE, "text_encoder": TE}}),
    "inject": ("lora_into_checkpoint", {"model": A, "loras": [{"path": L1, "weight": 0.8}], "dtype": "source"}),
    "embed": ("embed", {"model": A, "embed": {"vae": VAE, "text_encoder": None}, "dtype": "fp16"}),
}
outs = {}
for name, (cmd, job) in jobs.items():
    out = str(tmp / f"{name}.safetensors")
    r = run(BRIDGE, cmd, {**job, "out": out})
    check(r.get("ok") and Path(out).is_file() and not Path(out + ".tmp").exists(), f"{name} : fichier écrit" + ("" if r.get("ok") else " — " + str(r.get("error"))))
    outs[name] = load_file(out) if r.get("ok") else {}
    if OLD:
        old_out = str(tmp / f"{name}.old.safetensors")
        ro = run(OLD, cmd, {**job, "out": old_out})
        o = load_file(old_out) if ro.get("ok") else {}
        same = ro.get("ok") and set(o) == set(outs[name]) and all(o[k].dtype == outs[name][k].dtype and torch.equal(o[k], outs[name][k]) for k in o)
        check(same, f"{name} : identique, au bit près, à l'ancienne version")

s = outs["sum"]
k = "net.blocks.1.attn.weight"
check(torch.allclose(f32(s[k]), (f32(tA[k]) * 0.7 + f32(tB[k]) * 0.3).to(torch.bfloat16).float()) and s[k].dtype == torch.bfloat16, "Somme pondérée : A·0,7 + B·0,3, précision d'origine gardée")
check(torch.equal(s["net.only_in_a.weight"], tA["net.only_in_a.weight"]) and torch.equal(s["net.pos_ids"], tA["net.pos_ids"]), "Couche absente de B et entiers : repris de A tels quels")
d = outs["diff_gradient"]
al3 = 0.5 + 0.5 * 3 / 3
check(torch.allclose(d["net.blocks.3.attn.weight"], f32(tA["net.blocks.3.attn.weight"]) + al3 * (f32(tB["net.blocks.3.attn.weight"]) - f32(tC["net.blocks.3.attn.weight"])), atol=1e-6)
      and d["net.blocks.3.attn.weight"].dtype == torch.float32, "Différence ajoutée, α en dégradé (1,0 au dernier bloc), en fp32")
e = outs["sum_embed"]
check("vae.decoder.middle.0.residual.0.gamma" in e and "text_encoders.qwen3_06b.transformer.model.embed_tokens.weight" in e
      and e["vae.encoder.conv.weight"].dtype == torch.bfloat16, "VAE et encodeur intégrés aux préfixes que relit Forge, en bf16")
i = outs["inject"]
k0 = "net.blocks.0.attn.weight"
check(torch.allclose(f32(i[k0]), (f32(tA[k0]) + 0.8 * (2.0 / 4) * (up @ down)).to(torch.bfloat16).float()) and torch.equal(i["net.blocks.1.attn.weight"], tA["net.blocks.1.attn.weight"]),
      "LoRA → checkpoint : W + 0,8 × (α/rang) × up·down sur la couche visée, les autres intactes")
check(outs["embed"]["net.blocks.0.attn.weight"].dtype == torch.float16 and "vae.decoder.middle.0.residual.0.gamma" in outs["embed"] and len(outs["embed"]) == len(tA) + 2,
      "Tout-en-un : checkpoint en fp16 et VAE ajouté, rien d'autre")

# refus avant toute écriture
bad = str(tmp / "bad.safetensors")
save_file({"cond_stage_model.transformer.x.weight": rnd(3, 3), "model.diffusion_model.input_blocks.0.weight": rnd(5, 5)}, bad)
r = run(BRIDGE, "checkpoints", {"models": [A, bad], "mode": "sum", "alpha": 0.5, "out": str(tmp / "no.safetensors")})
check(not r.get("ok") and "incompatibles" in r.get("error", "") and not (tmp / "no.safetensors").exists() and not (tmp / "no.safetensors.tmp").exists(),
      "Architectures différentes : refus avant d'écrire, aucun fichier laissé")
r = run(BRIDGE, "embed", {"model": A, "embed": {"vae": TE}, "out": str(tmp / "no2.safetensors")})
check(not r.get("ok") and "VAE" in r.get("error", "") and not (tmp / "no2.safetensors.tmp").exists(), "Mauvais fichier en guise de VAE : refusé, rien d'écrit")

import shutil
shutil.rmtree(tmp, ignore_errors=True)
print("Tout est bon" if not fails else f"{fails} échec(s)")
sys.exit(1 if fails else 0)
