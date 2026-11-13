// Barre de VRAM : la mémoire de la carte graphique, relevée toutes les 2 s par le processus principal (gpu-monitor.cjs).
// KS.gpu.meter() rend une barre qui se met à jour toute seule ; `detail` ajoute la charge, la température, le pic
// depuis le début de l'entraînement et, quand la carte sature, ce qu'il faut faire.
'use strict';
(() => {
  const h = KS.h, N = KS.native;
  const meters = new Set();
  const G = KS.gpu = { last: null, peak: 0 };
  const go = mib => (mib / 1024).toFixed(1).replace('.', ',');
  const LABEL = { ok: '', high: 'presque pleine', full: 'saturée' };

  // Ce que dit le relevé, en clair (titre au survol, ligne d'avertissement)
  G.describe = s => {
    if (!s) return 'Carte graphique : aucun relevé (nvidia-smi introuvable).';
    const free = Math.max(0, s.total - s.used);
    if (s.level === 'full') {
      return s.shared >= 1024
        ? `VRAM saturée : ${go(s.shared)} Go ont débordé dans la mémoire vive, bien plus lente. L’entraînement continue, mais au ralenti.`
        : `VRAM saturée : il ne reste que ${go(free)} Go. Au-delà, Windows déborde dans la mémoire vive et l’entraînement ralentit fortement.`;
    }
    if (s.level === 'high') return `VRAM presque pleine : ${go(free)} Go libres. Pas encore de ralentissement.`;
    return `VRAM : ${go(free)} Go libres sur ${go(s.total)} Go.`;
  };
  G.advice = 'Pour la soulager : arrêtez puis relancez en 768 px ou sans « Taille réelle des images », et fermez ce qui occupe la carte (jeu, navigateur, modèle chargé dans KaneApp).';
  G.resetPeak = () => { G.peak = G.last ? G.last.used : 0; paint(); };

  function paintOne(m) {
    const s = G.last;
    m.el.dataset.level = s ? s.level : 'none';
    if (!s) { m.fill.style.width = '0%'; m.peak.hidden = true; m.txt.textContent = 'VRAM : —'; if (m.note) m.note.hidden = true; m.el.title = G.describe(null); return; }
    const pct = Math.min(100, s.used / s.total * 100);
    m.fill.style.width = pct.toFixed(1) + '%';
    m.peak.hidden = !m.detail || !(G.peak > s.used);
    if (!m.peak.hidden) m.peak.style.left = Math.min(100, G.peak / s.total * 100).toFixed(1) + '%';
    const state = LABEL[s.level] ? ' · ' + LABEL[s.level] : '';
    if (m.detail) {
      m.txt.textContent = `${go(s.used)} / ${go(s.total)} Go (${Math.round(pct)} %)` + (s.util != null ? ` · charge ${s.util} %` : '') + (s.temp != null ? ` · ${s.temp} °C` : '')
        + (G.peak ? ` · pic ${go(G.peak)} Go` : '') + state;
      m.note.hidden = s.level === 'ok';
      m.note.textContent = s.level === 'ok' ? '' : G.describe(s) + (s.level === 'full' ? ' ' + G.advice : '');
    } else {
      m.txt.textContent = `${go(s.used)} / ${go(s.total)} Go` + state;
    }
    m.el.title = (s.name ? s.name + '\n' : '') + G.describe(s) + (s.util != null ? `\nCharge ${s.util} %` : '') + (s.temp != null ? ` · ${s.temp} °C` : '')
      + (s.shared != null ? `\nMémoire partagée (RAM) utilisée par la carte : ${go(s.shared)} Go` : '') + (G.peak ? `\nPic depuis le dernier lancement : ${go(G.peak)} Go` : '');
  }
  function paint() {
    for (const m of meters) {
      if (!m.el.isConnected && m.seen) { meters.delete(m); continue; }   // carte reconstruite : l'ancienne barre s'oublie
      if (m.el.isConnected) m.seen = true;
      paintOne(m);
    }
  }
  G.push = s => {
    G.last = s || null;
    if (s && s.used > G.peak) G.peak = s.used;
    paint();
  };
  G.meter = ({ detail = false } = {}) => {
    const fill = h('i'), peak = h('u', { hidden: true }), txt = h('span.gpu-txt'), note = detail ? h('div.gpu-note', { hidden: true }) : null;
    const el = h('div.gpu-meter' + (detail ? '.detail' : ''), h('span.gpu-lbl', { text: 'VRAM' }), h('div.gpu-track', fill, peak), txt, note);
    const m = { el, fill, peak, txt, note, detail, seen: false };
    meters.add(m); paintOne(m);
    return el;
  };

  N?.onGpuStats?.(G.push);
  N?.gpuStats?.().then(s => { if (s && !G.last) G.push(s); }).catch(() => {});
})();
