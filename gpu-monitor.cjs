// Mémoire de la carte graphique, relevée en continu pour la barre de VRAM.
// Deux processus légers qui écrivent une ligne toutes les 2 s, au lieu d'en relancer un à chaque relevé :
// - nvidia-smi : mémoire dédiée utilisée / totale, charge, température ;
// - typeperf (compteurs Windows) : mémoire « partagée » de la carte. Quand la VRAM est pleine, le pilote NVIDIA déborde
//   dans la RAM (mémoire partagée) au lieu d'échouer : l'entraînement continue, mais plusieurs fois plus lentement.
//   C'est ce débordement, invisible dans nvidia-smi, qui dit que la carte est réellement saturée.
const { spawn } = require('child_process');

const MIB = 1024 * 1024;
// Seuils : au-dessus de 90 % la marge est mince ; saturée à 97 % ou dès que plus de 1 Go a débordé dans la RAM.
const HIGH = 0.90, FULL = 0.97, SPILL_MIB = 1024;

function parseSmi(line) {
  const p = String(line).split(',').map(s => s.trim());
  const used = parseFloat(p[0]), total = parseFloat(p[1]);
  if (!(total > 0) || !(used >= 0)) return null;
  const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? Math.round(n) : null; };
  return { used, total, util: num(p[2]), temp: num(p[3]), name: p.slice(4).join(',').trim() };
}

// En-tête CSV de typeperf : une colonne par carte et par compteur. On retient les colonnes par carte (luid).
function parsePerfHeader(line) {
  const cols = String(line).split('","').map(s => s.replace(/"/g, ''));
  const map = {};
  cols.forEach((c, i) => {
    const m = /GPU Adapter Memory\((.+?)\)\\(Shared|Dedicated) Usage$/i.exec(c);
    if (m) (map[m[1]] ||= {})[m[2].toLowerCase()] = i;
  });
  return Object.values(map).filter(a => a.shared != null && a.dedicated != null);
}
// Mémoire partagée (Mio) de la carte qui porte le plus de mémoire dédiée : la carte graphique qui travaille.
function parsePerfLine(line, adapters) {
  const cols = String(line).split('","').map(s => parseFloat(s.replace(/"/g, '')));
  let best = null;
  for (const a of adapters) {
    const d = cols[a.dedicated], s = cols[a.shared];
    if (Number.isFinite(d) && Number.isFinite(s) && (!best || d > best.d)) best = { d, s };
  }
  return best ? best.s / MIB : null;
}

function level(s) {
  if (!s || !(s.total > 0)) return 'none';
  const pct = s.used / s.total;
  if (pct >= FULL || (pct >= HIGH && s.shared != null && s.shared >= SPILL_MIB)) return 'full';
  return pct >= HIGH ? 'high' : 'ok';
}

function createMonitor(onSample) {
  let smi = null, perf = null, last = null, shared = null, stopped = false, tries = 0;
  const lines = (child, fn) => {
    let buf = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', d => {
      buf += d; let i;
      while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (l) fn(l); }
    });
  };
  function startSmi() {
    if (stopped || smi) return;
    try {
      smi = spawn('nvidia-smi', ['--id=0', '--query-gpu=memory.used,memory.total,utilization.gpu,temperature.gpu,name', '--format=csv,noheader,nounits', '-l', '2'], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch { smi = null; return; }
    const child = smi;
    lines(child, l => {
      const s = parseSmi(l); if (!s) return;
      tries = 0;
      last = { ...s, shared, level: 'ok', at: Date.now() };
      last.level = level(last);
      onSample(last);
    });
    const again = () => {
      if (smi !== child) return;
      smi = null;
      // pilote en cours de mise à jour, carte débranchée… : quelques nouvelles tentatives espacées, puis on renonce
      if (!stopped && tries++ < 5) setTimeout(startSmi, 5000 * tries).unref?.();
      else if (!stopped) { last = null; onSample(null); }
    };
    child.on('error', again); child.on('close', again);
  }
  function startPerf() {
    if (stopped || perf || process.platform !== 'win32') return;
    try {
      perf = spawn('typeperf', ['\\GPU Adapter Memory(*)\\Shared Usage', '\\GPU Adapter Memory(*)\\Dedicated Usage', '-si', '2'], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch { perf = null; return; }
    const child = perf;
    let adapters = null;
    lines(child, l => {
      if (!adapters) { if (/PDH-CSV/.test(l)) adapters = parsePerfHeader(l); return; }
      if (!adapters.length) return;
      const before = shared;
      shared = parsePerfLine(l, adapters);
      // un débordement qui commence ou cesse change le niveau : on n'attend pas le relevé suivant de nvidia-smi
      if (last && (before == null || level({ ...last, shared }) !== last.level)) { last = { ...last, shared }; last.level = level(last); onSample(last); }
    });
    // compteurs absents (Windows dans une autre langue, ancien pilote) : la barre reste, sans la mesure du débordement
    const gone = () => { if (perf === child) { perf = null; shared = null; } };
    child.on('error', gone); child.on('close', gone);
  }
  return {
    start() { stopped = false; startSmi(); startPerf(); },
    stop() { stopped = true; for (const c of [smi, perf]) { try { c && c.kill(); } catch { /* déjà fini */ } } smi = perf = null; },
    last: () => last,
  };
}

module.exports = { createMonitor, parseSmi, parsePerfHeader, parsePerfLine, level };
