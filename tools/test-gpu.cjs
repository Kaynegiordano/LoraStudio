// Relevés de la carte graphique (gpu-monitor.cjs) : lecture des lignes de nvidia-smi et de typeperf, niveaux de la barre.
// Lancer : node tools/test-gpu.cjs   (ajouter --live pour lire aussi la vraie carte pendant 7 s)
const { parseSmi, parsePerfHeader, parsePerfLine, level, createMonitor } = require('../gpu-monitor.cjs');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'OK ' : 'ÉCHEC ') + msg); if (!ok) fails++; };

const s = parseSmi('1023, 16303, 11, 42.17, NVIDIA GeForce RTX 5080');
check(s && s.used === 1023 && s.total === 16303 && s.util === 11 && s.temp === 42 && s.name === 'NVIDIA GeForce RTX 5080', 'nvidia-smi : mémoire, charge, température arrondie, nom');
check(parseSmi('[N/A], [N/A], 0, 0, x') === null && parseSmi('') === null, 'nvidia-smi : une ligne illisible est ignorée');
check(parseSmi('100, 8192, [N/A], [N/A], GPU')?.util === null, 'nvidia-smi : charge ou température absente = non affichée');

const col = (luid, what) => `"\\\\PC\\GPU Adapter Memory(luid_0x0_${luid}_phys_0)\\${what} Usage"`;
const head = ['"(PDH-CSV 4.0)"', col('0x1', 'Shared'), col('0x2', 'Shared'), col('0x1', 'Dedicated'), col('0x2', 'Dedicated')].join(',');
const adapters = parsePerfHeader(head);
check(adapters.length === 2, 'typeperf : deux cartes reconnues dans l’en-tête');
const shared = parsePerfLine('"11/13/2026 10:23:16.095","8192.000000","3221225472.000000","0.000000","16000000000.000000"', adapters);
check(shared === 3072, 'typeperf : mémoire partagée de la carte qui travaille (3072 Mio), pas celle du pilote de base');
check(parsePerfHeader('"(PDH-CSV 4.0)"').length === 0, 'typeperf : aucun compteur = pas de mesure du débordement');

check(level({ used: 8000, total: 16000, shared: 80 }) === 'ok', 'Niveau : 50 % = normal');
check(level({ used: 14800, total: 16000, shared: 80 }) === 'high', 'Niveau : 92 % = presque pleine');
check(level({ used: 14800, total: 16000, shared: 2048 }) === 'full', 'Niveau : 92 % et 2 Go débordés dans la RAM = saturée');
check(level({ used: 15800, total: 16000, shared: null }) === 'full', 'Niveau : 99 % = saturée, même sans compteur Windows');
check(level({ used: 8000, total: 16000, shared: 2048 }) === 'ok', 'Niveau : mémoire partagée seule (carte à moitié vide) = normal');
check(level(null) === 'none', 'Niveau : sans relevé, barre vide');

if (process.argv.includes('--live')) {
  let n = 0, last = null;
  const m = createMonitor(x => { n++; last = x; });
  m.start();
  setTimeout(() => {
    m.stop();
    check(n >= 2 && last && last.total > 0, `Vraie carte : ${n} relevé(s) en 7 s` + (last ? ` — ${last.name}, ${last.used} / ${last.total} Mio, partagée ${last.shared == null ? 'non mesurée' : Math.round(last.shared) + ' Mio'}, niveau ${last.level}` : ''));
    check(last && last.shared != null, 'Vraie carte : mémoire partagée mesurée par les compteurs Windows');
    process.exit(fails ? 1 : 0);
  }, 7200);
} else process.exit(fails ? 1 : 0);
