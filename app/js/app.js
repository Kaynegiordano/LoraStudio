// Lora Studio : la fenêtre et ses deux ateliers, Entraînement et Merge.
'use strict';
(() => {
  const h = KS.h, N = KS.native, U = KS.util;
  const TABS = [['train', 'Entraînement'], ['merge', 'Merge']];
  const main = document.getElementById('ls-main'), tabsEl = document.getElementById('ls-tabs'), gpu = document.getElementById('ls-gpu');

  // même palette claire que KaneApp, avec l'accent du Studio IA
  function applyTheme() {
    const dark = KS.prefs.theme === 'dark';
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(dark ? 'theme-dark' : 'theme-light');
    const acc = U.parseHex('#8975b3'), root = document.documentElement.style;
    const lighter = U.hex({ r: acc.r + (255 - acc.r) * 0.18, g: acc.g + (255 - acc.g) * 0.18, b: acc.b + (255 - acc.b) * 0.18 });
    root.setProperty('--accent', U.hex(acc)); root.setProperty('--accent-rgb', `${acc.r}, ${acc.g}, ${acc.b}`);
    root.setProperty('--accent-2', dark ? lighter : U.hex({ r: acc.r * .72, g: acc.g * .72, b: acc.b * .72 }));
    root.setProperty('--accent-soft', `rgba(${acc.r},${acc.g},${acc.b},${dark ? '.16' : '.09'})`);
    N?.setTitleBar?.(dark ? { color: '#16181d', symbolColor: '#c3cad6' } : { color: '#ffffff', symbolColor: '#3b4552' });
  }

  function show(id) {
    if (!TABS.some(t => t[0] === id)) id = 'train';
    KS.prefs.lsTab = id; KS.prefs.save();
    tabsEl.replaceChildren(...TABS.map(([t, label]) => {
      const b = h('button' + (t === id ? '.on' : ''), { text: label, type: 'button' });
      b.addEventListener('click', () => show(t));
      return b;
    }));
    const content = h(id === 'merge' ? 'div.fx-train.mg-page' : 'div.fx-train');
    main.replaceChildren(content);
    if (id === 'merge') KS.mergeTab.render(content); else KS.trainTab.render(content);
  }

  // état du moteur de KaneApp, relu quand la fenêtre revient au premier plan et toutes les 15 s quand elle est visible
  async function refreshGpu() {
    const r = await KS.engineCheck();
    gpu.innerHTML = r && r.up ? `Moteur de KaneApp : <b>${r.loaded ? 'modèle chargé' : 'démarré, sans modèle'}</b>` + (r.loaded ? ' — libéré avant chaque entraînement' : '')
      : 'Moteur de KaneApp : <b>arrêté</b> (carte graphique libre)';
  }
  window.addEventListener('focus', refreshGpu);
  setInterval(() => { if (!document.hidden) refreshGpu(); }, 15000);

  // mises à jour (GitHub) : vérifiées au démarrage ; un bouton dans la barre quand une version est prête
  const upd = h('button.fx-btn2.sm', { hidden: true, type: 'button', style: '-webkit-app-region:no-drag' });
  document.getElementById('ls-bar').insertBefore(upd, gpu);
  N?.onUpdateStatus?.(s => {
    upd.hidden = !['available', 'downloading', 'ready'].includes(s.status);
    upd.disabled = s.status === 'downloading';
    upd.textContent = s.status === 'available' ? 'Mettre à jour (' + s.version + ')' : s.status === 'downloading' ? 'Téléchargement… ' + (s.percent || 0) + ' %' : 'Redémarrer pour installer ' + (s.version || '');
    upd.onclick = () => s.status === 'available' ? N.updateDownload() : s.status === 'ready' ? N.updateInstall() : null;
  });

  applyTheme();
  refreshGpu().finally(() => show(KS.prefs.lsTab || 'train'));
})();
