// Lora Studio : la fenêtre et ses deux ateliers, Entraînement et Merge.
'use strict';
(() => {
  const h = KS.h, N = KS.native, U = KS.util;
  const TABS = [['train', 'Entraînement'], ['merge', 'Merge']];
  const main = document.getElementById('ls-main'), tabsEl = document.getElementById('ls-tabs'), gpu = document.getElementById('ls-gpu');

  // Thèmes : Clair et Sombre (palette de KaneApp, accent du Studio IA), Bleu (bleu nuit, accent bleu), et Système, qui
  // suit le mode clair ou sombre de Windows et change avec lui. `bar` : couleur de la barre de titre (boutons Windows).
  const THEMES = {
    light: { label: 'Clair', cls: 'theme-light', dark: false, accent: '#8975b3', bar: '#ffffff', symbol: '#3b4552' },
    dark: { label: 'Sombre', cls: 'theme-dark', dark: true, accent: '#8975b3', bar: '#1b1e24', symbol: '#c3cad6' },
    blue: { label: 'Bleu', cls: 'theme-blue', dark: true, accent: '#3d8bfd', bar: '#13223b', symbol: '#b6c6de' },
  };
  const CHOICES = [['dark', 'Sombre'], ['system', 'Système'], ['blue', 'Bleu'], ['light', 'Clair']];
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const themeOf = choice => THEMES[choice === 'system' ? (systemDark.matches ? 'dark' : 'light') : choice] || THEMES.light;
  function applyTheme() {
    const t = themeOf(KS.prefs.theme), dark = t.dark;
    document.body.classList.remove(...Object.values(THEMES).map(x => x.cls));
    document.body.classList.add(t.cls);
    document.body.dataset.theme = KS.prefs.theme;
    const acc = U.parseHex(t.accent), root = document.documentElement.style;
    const lighter = U.hex({ r: acc.r + (255 - acc.r) * 0.18, g: acc.g + (255 - acc.g) * 0.18, b: acc.b + (255 - acc.b) * 0.18 });
    root.setProperty('--accent', U.hex(acc)); root.setProperty('--accent-rgb', `${acc.r}, ${acc.g}, ${acc.b}`);
    root.setProperty('--accent-2', dark ? lighter : U.hex({ r: acc.r * .72, g: acc.g * .72, b: acc.b * .72 }));
    root.setProperty('--accent-soft', `rgba(${acc.r},${acc.g},${acc.b},${dark ? '.16' : '.09'})`);
    N?.setTitleBar?.({ color: t.bar, symbolColor: t.symbol });
  }
  systemDark.addEventListener('change', () => { if (KS.prefs.theme === 'system') applyTheme(); });
  const themeBtn = h('button.ls-theme', { type: 'button', title: 'Choisir le thème de Lora Studio' });
  const themeName = () => { themeBtn.textContent = 'Thème : ' + (CHOICES.find(c => c[0] === KS.prefs.theme) || CHOICES[3])[1]; };
  KS.setTheme = id => { KS.prefs.theme = CHOICES.some(c => c[0] === id) ? id : 'light'; KS.prefs.save(); applyTheme(); themeName(); };
  themeBtn.addEventListener('click', () => {
    const r = themeBtn.getBoundingClientRect();
    KS.ui.menu(CHOICES.map(([id, label]) => ({ label: id === 'system' ? 'Système (suit Windows)' : label, checked: KS.prefs.theme === id, action: () => KS.setTheme(id) })), r.left, r.bottom + 4);
  });
  document.getElementById('ls-bar').insertBefore(themeBtn, document.getElementById('ls-vram'));
  themeName();

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
      : 'Moteur de KaneApp : <b>arrêté</b>';
  }
  document.getElementById('ls-vram').append(KS.gpu.meter());      // VRAM de la carte, en continu
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
  N?.appVersion?.().then(v => { if (v && v.version) document.querySelector('.ls-brand').title = 'Lora Studio ' + v.version; }).catch(() => {});
  refreshGpu().finally(() => show(KS.prefs.lsTab || 'train'));
})();
