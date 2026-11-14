# Lora Studio

Entraînement de LoRA ANIMA et Merge (LoRA + LoRA, checkpoints, LoRA → checkpoint, VAE + encodeur), sortis de KaneApp 1.34
pour que ces travaux ne vivent pas dans la même application que le Studio et ses checkpoints.

- **Moteurs** : ceux de KaneApp, lus dans son profil (`%APPDATA%\KaneApp\managed-runtimes.json`) : Python et extension
  `forge_lora_trainer` de `KaneAppData\runtimes\studio`, sd-scripts. Les projets restent dans `…\studio\lora_training`.
- **Passerelles** : `lora_bridge.py` (atelier) et `merge_bridge.py` (Merge), lancées avec le Python du Studio.
- **Avec KaneApp** : le moteur du Studio (port 7862, sinon Forge de Kane OS sur 7860) est seulement interrogé — déchargé avant
  un entraînement, invité à relire ses listes après un Merge. « Essayer » lance `KaneApp.exe --kane-prompt=…`.
  KaneApp voit un entraînement en cours dans les `run.json` (pid vivant) et fait attendre ses générations.
- **Barre de VRAM** : `gpu-monitor.cjs` garde ouverts `nvidia-smi -l 2` (mémoire dédiée, charge, température) et `typeperf`
  (mémoire partagée de la carte : le débordement dans la RAM quand la VRAM est pleine) ; `app/js/gpubar.js` l'affiche.
- **Sorties** : `output\lora` et `output\merge` de Kane OS (vus par Forge via `models\Lora\KaneApp` et `models\Stable-diffusion\KaneApp`).

## Développer

```
npm install
npx electron .
npx electron tools/test-app.cjs     # vrais projets et modèles, lecture seule
npx electron tools/test-train.cjs   # atelier, passerelle simulée
npx electron tools/test-merge.cjs   # Merge, passerelle simulée
node tools/test-gpu.cjs --live      # barre de VRAM : lecture de nvidia-smi et des compteurs Windows
C:\KaneOS\KaneAppData
C:\KaneOS\KaneAppData\runtimes\studio\venv\Scripts\python.exe tools\test-merge-bridge.py   # calculs du Merge, petits modèles fabriqués
C:\KaneOS\KaneAppData\runtimes\studio\venv\Scripts\python.exe tools\test-lora-bridge.py
```

## Publier

Changer `version` dans `package.json`, ajouter la version en tête de `RELEASE_NOTES.md`, puis `npm run dist` et
`gh release create vX.Y.Z dist/LoraStudio-Setup-X.Y.Z.exe dist/LoraStudio-Setup-X.Y.Z.exe.blockmap dist/latest.yml`.
