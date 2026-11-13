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

  // Barre de progression en couleur, commune à l'entraînement et au Merge : dégradé pendant le travail (rayures animées),
  // verte une fois terminé, rouge en erreur, orange si arrêté ; le pourcentage à droite. `task` (facultatif) nomme le
  // travail pour la barre des tâches de Windows, qui montre la même avancée quand la fenêtre est réduite.
  const LABEL = { done: 'Terminé', error: 'Erreur', stopped: 'Arrêté' };
  KS.bar = {
    make(pct, state, task) {
      const el = KS.h('div.lt-prog', KS.h('div.lt-bar', KS.h('i')), KS.h('span.lt-pct'));
      KS.bar.set(el, pct, state, task);
      return el;
    },
    set(el, pct, state, task) {
      if (!el) return;
      pct = Math.max(0, Math.min(100, +pct || 0));
      state = state || 'idle';
      const waiting = state === 'running' && pct < 1;                // modèles en cours de chargement : pas encore de pas
      el.dataset.state = waiting ? 'waiting' : state;
      const fill = el.querySelector('.lt-bar > i'), w = waiting ? 100 : pct;
      fill.style.width = w + '%';
      fill.style.backgroundSize = w > 0 ? '28px 28px, ' + (10000 / w) + '% 100%' : '';   // le dégradé couvre toute la piste, pas seulement la partie remplie
      el.querySelector('.lt-pct').textContent = waiting ? 'Préparation…' : state === 'idle' ? '' : (LABEL[state] ? LABEL[state] + ' · ' : '') + Math.round(pct) + ' %';
      if (task) N.setProgress?.(state === 'running' ? (waiting ? 2 : pct / 100) : -1, state === 'error' ? 'error' : state === 'stopped' ? 'paused' : 'normal');
    },
  };
  // les images qu'on glisse dans la fenêtre hors d'une zone prévue ne doivent pas remplacer la page
  for (const ev of ['dragover', 'drop']) window.addEventListener(ev, e => e.preventDefault());
})();
