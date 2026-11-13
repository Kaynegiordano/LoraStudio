// Ce que l'atelier Lora et le Merge trouvaient dans KaneApp, rendu par Lora Studio :
// - KS.engine / KS.gen : le moteur Forge de KaneApp (port 7862, sinon celui de Kane OS sur 7860), seulement interrogé ;
// - KS.studioApi : « Essayer » envoie le LoRA à l'invite du Studio de KaneApp ; aucun catalogue de modèles n'est chargé ici ;
// - KS.io.openEntry : une image s'ouvre dans KaneApp (Retouche).
'use strict';
(() => {
  const N = KS.native;
  let forgeUp = false;
  KS.engine = { ready: () => forgeUp };
  KS.gen = { url: () => '' };                 // la page ne choisit jamais l'adresse : le processus principal la trouve
  KS.engineCheck = async () => {
    try { const r = await N.forgeAlive(); forgeUp = !!(r && r.ok && r.up); return r; } catch { forgeUp = false; return null; }
  };
  KS.studioApi = {
    cat: () => null,
    async addToPrompt(text) {
      const r = await N.sendToKaneApp({ prompt: text });
      KS.toast(r.ok ? 'Ajouté à l’invite du Studio de KaneApp' : 'KaneApp : ' + r.error, r.ok ? 'ok' : 'err', 3500);
    },
    reloadCat: () => N.forgeRefreshLoras(),
  };
  KS.io = {
    openEntry: entry => entry && entry.path ? N.sendToKaneApp({ file: entry.path }) : KS.toast('Image introuvable', 'err'),
  };
  KS.resetDrop = () => {};
  // les images qu'on glisse dans la fenêtre hors d'une zone prévue ne doivent pas remplacer la page
  for (const ev of ['dragover', 'drop']) window.addEventListener(ev, e => e.preventDefault());
})();
