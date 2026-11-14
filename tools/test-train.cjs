// Atelier d'entraînement de Lora Studio dans un vrai renderer Electron (passerelle simulée, sans moteur ni profil utilisateur).
// Lancer : npx electron tools/test-train.cjs   (essais repris de test-studio.cjs de KaneApp ≤ 1.33)
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lorastudio-train-'));
app.setPath('userData', path.join(tmp, 'profile'));
const preload = path.join(tmp, 'preload.cjs');
fs.writeFileSync(preload, `
window.loraImages = []; window.loraPaths = [];
window.ksNative = {
  setTitleBar(o) { window.titleBar = o; },
  setCloseGuard(text) { window.closeGuard = text; },
  setProgress(value, mode) { (window.taskbar ||= []).push([value, mode]); },
  pathForFile: file => 'C:/selected/' + file.name,
  pickImagePaths: async () => window.loraPaths,
  loraThumb: async (file, width) => { (window.thumbCalls ||= []).push({ file, width }); return { ok: false }; },
  loraCall: async (cmd, args = {}) => {
    if (cmd === 'info') return { ok: true, presets: { style: { label: 'Style' } }, scopes: { full: { label: 'Full', hint: '', summary: 'All' } },
      resolutions: [512,1024], optimizers: { adamw8bit: 'AdamW' }, dits: [], fewshot_resolutions: [512,1024], sd_scripts: 'C:/training', tagger: true };
    if (cmd === 'list') return { ok: true, projects: window.loraImages.length ? [{ name: 'Import-test', count: window.loraImages.length }] : [] };
    if (cmd === 'import') { window.loraImages.push(...args.paths.map(p => ({file: p.split('/').pop(),path:p}))); return {ok:true,name:'Import-test',added:args.paths.length,count:window.loraImages.length}; }
    if (cmd === 'load') return { ok:true,manifest:{ trigger: 'n1x3u', lora_type: 'style', captions: window.loraCaps || {} },images:window.loraImages,runs:window.loraRun ? [window.loraRun] : [], suggest: window.loraSuggest || null, vram: window.loraVram || null };
    if (cmd === 'audit') return { ok: true, count: 3, target: 1024, issues: window.loraAudit || [] };
    if (cmd === 'remove') { (window.loraRemoved ||= []).push(...args.files); return { ok: true, removed: args.files.length }; }
    if (cmd === 'save') { (window.loraSaves ||= []).push(args); if (args.patch && args.patch.captions) window.loraCaps = { ...args.patch.captions }; return { ok: true }; }
    if (cmd === 'start') { (window.loraStarts ||= []).push(args); return { ok: true, pid: 7, run: 'C:/runs/' + args.name, total: 100, per_epoch: 10, resolutions: [1024], estimate_s: 600, output: 'C:/out/x.safetensors', count: 2, token: '@n1x3u' }; }
    if (cmd === 'install') { (window.loraInstalls ||= []).push(args); return { ok: true, installed: 'C:/Lora/Anima/' + args.name + '.safetensors', name: args.name }; }
    return {ok:true,status:null};
  },
  forgeAlive: async () => ({ ok: true, up: false }),
  gpuStats: async () => null,
  onGpuStats: fn => { window.gpuPush = fn; },
  forgeProgress: async () => ({ ok: false }),
  sendToKaneApp: async what => { (window.sent ||= []).push(what); return { ok: true }; },
};
`);

async function scenario() {
  const results = [];
  const assert = (ok, message) => { if (!ok) throw new Error(message); results.push(message); };
  const wait = async (test, what = '') => { for (let i = 0; i < 150; i++) { if (test()) return; await new Promise(r => setTimeout(r, 20)); } throw new Error('Timeout après : ' + (results.at(-1) || 'début') + ' — ' + test.toString().slice(0, 140)); };
  const c = document.createElement('canvas'); c.width = 8; c.height = 8;
  const bytes = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/png'))).arrayBuffer());
  await wait(() => !!document.querySelector('.lt-drop'));
  const loraDrop = new DataTransfer();
  loraDrop.items.add(new File([bytes], 'training-a.png', {type:'image/png'}));
  loraDrop.items.add(new File([bytes], 'training-b.png', {type:'image/png'}));
  document.querySelector('.lt-drop').dispatchEvent(new DragEvent('drop', { dataTransfer:loraDrop, bubbles:true, cancelable:true }));
  await wait(() => window.loraImages.length === 2 && document.querySelectorAll('.lt-cell').length === 2);
  await new Promise(r => setTimeout(r,100));
  assert(window.loraImages.length === 2, 'Déposer deux images les importe dans le projet');
  window.loraPaths = ['C:/selected/picked.png']; document.querySelector('.lt-drop').click();
  await wait(() => window.loraImages.length === 3);
  assert(window.loraImages.length === 3, 'Choisir des images les importe aussi');
  window.dispatchEvent(new DragEvent('drop', { dataTransfer:loraDrop, bubbles:true, cancelable:true }));
  await new Promise(r => setTimeout(r,100));
  assert(window.loraImages.length === 3 && location.href.endsWith('index.html'), 'Un dépôt hors de la zone ne fait rien (la page reste en place)');
  // Atelier Lora : une carte par époque (images d'aperçu), « Garder cette version » installe avec le déclencheur @
  window.loraRun = { run: 'C:/runs/r1', project: 'Import-test', running: false, state: 'done', pct: 100, text: 'Terminé', output: 'C:/out/n1x3u.safetensors', token: '@n1x3u',
    checkpoints: ['C:/out/n1x3u-000002.safetensors', 'C:/out/n1x3u.safetensors'], samples: [], before: ['C:/out/sample/n1x3u_000000_00_1.png'],
    epochs: [{ epoch: 2, path: 'C:/out/n1x3u-000002.safetensors', name: 'n1x3u-000002', final: false, samples: ['C:/out/sample/n1x3u_e000002_00_1.png', 'C:/out/sample/n1x3u_e000002_01_1.png'] },
      { epoch: 4, path: 'C:/out/n1x3u.safetensors', name: 'n1x3u', final: true, samples: ['C:/out/sample/n1x3u_e000004_00_1.png'] }] };
  KS.trainTab.invalidate(); await wait(() => document.querySelectorAll('.lt-ep').length === 3);
  const eps = [...document.querySelectorAll('.lt-ep')];
  assert(eps.length === 3 && eps[0].classList.contains('before') && eps[1].classList.contains('final') && eps[2].querySelectorAll('.lt-ep-imgs img').length === 2, 'Lora : référence sans LoRA, puis une carte par époque (la finale en premier) avec ses images');
  [...eps[2].querySelectorAll('button')].find(b => b.textContent === 'Garder cette version').click();
  await wait(() => window.loraInstalls?.length === 1);
  assert(window.loraInstalls[0].path.endsWith('n1x3u-000002.safetensors') && window.loraInstalls[0].token === '@n1x3u' && window.loraInstalls[0].weight === 1 && window.loraInstalls[0].preview.includes('e000002_01'), 'Garder une époque l’installe avec @n1x3u, poids 1 et son image');
  window.loraRun = null;
  // Tags du projet : fréquences ; « Retirer » enlève le tag de toutes les légendes et enregistre
  window.loraCaps = { 'training-a.png': 'safe, 1girl, frieren, smile', 'training-b.png': 'safe, 1girl, patreon username' };
  KS.trainTab.invalidate(); await wait(() => !!document.querySelector('.lt-tagbox'));
  document.querySelector('.lt-tagbox').open = true;
  const chip = t => [...document.querySelectorAll('.lt-tag')].find(b => b.firstChild.textContent === t);
  assert(chip('safe')?.classList.contains('all') && chip('safe').lastChild.textContent === '2' && chip('patreon username')?.lastChild.textContent === '1', 'Tags du projet : nombre d’images par tag, « présent partout » en surbrillance');
  chip('patreon username').click(); await new Promise(r => setTimeout(r, 50));
  [...document.querySelectorAll('.menu .mi')].find(i => i.textContent.startsWith('Retirer « patreon username »')).click();
  await wait(() => window.loraCaps['training-b.png'] === 'safe, 1girl' && !chip('patreon username'));
  assert(window.loraCaps['training-b.png'] === 'safe, 1girl' && window.loraCaps['training-a.png'] === 'safe, 1girl, frieren, smile' && !chip('patreon username'), 'Retirer un tag partout : légendes enregistrées sans lui, les autres intactes ' + JSON.stringify(window.loraCaps));
  [...document.querySelectorAll('.lt-tagbox button')].find(b => b.textContent.startsWith('Annuler la dernière')).click();
  await wait(() => window.loraCaps['training-b.png'] === 'safe, 1girl, patreon username');
  assert(window.loraCaps['training-b.png'] === 'safe, 1girl, patreon username', 'Annuler la dernière modification des tags');
  // Préréglage conseillé : affiché avec sa raison, « Choisir » change le type
  window.loraSuggest = { kind: 'painterly', label: 'Peinture numérique', why: 'la même ambiance revient' };
  KS.trainTab.invalidate(); await wait(() => !!document.querySelector('.lt-suggest'));
  assert(document.querySelector('.lt-suggest').textContent.includes('Conseillé : Peinture numérique') && document.querySelector('.lt-suggest').textContent.includes('la même ambiance revient'), 'Lora : préréglage conseillé affiché avec sa raison');
  [...document.querySelectorAll('.lt-suggest button')].find(b => b.textContent === 'Choisir Peinture numérique').click();
  await wait(() => (window.loraSaves || []).some(x => x.patch && x.patch.lora_type === 'painterly'));
  assert(document.querySelector('.lt-suggest.ok') && !document.querySelector('.lt-suggest button'), '« Choisir » applique le type conseillé et l’enregistre');
  window.loraSuggest = null;
  // File d'attente : ajouter, puis démarrer la file
  KS.prefs.loraQueue = [];
  [...document.querySelectorAll('.lt-go button')].find(b => b.textContent === 'Ajouter à la file').click();
  await wait(() => !!document.querySelector('.lt-queue'));
  assert((KS.prefs.loraQueue || []).join() === 'Import-test' && document.querySelectorAll('.lt-qitem').length === 1, 'Ajouter à la file : le projet attend son tour, avec ses réglages enregistrés');
  [...document.querySelectorAll('.lt-queue button')].find(b => b.textContent === 'Démarrer la file').click();
  await wait(() => window.loraStarts?.length === 1);
  assert(window.loraStarts[0].name === 'Import-test' && !(KS.prefs.loraQueue || []).length, 'Démarrer la file lance le premier projet et le retire de la file');
  // « Essayer » envoie le LoRA à l'invite du Studio de KaneApp
  window.loraRun = { run: 'C:/runs/r1', project: 'Import-test', running: false, state: 'done', pct: 100, text: 'Terminé', output: 'C:/out/n1x3u.safetensors', token: '@n1x3u',
    checkpoints: [], samples: [], before: [], epochs: [{ epoch: 4, path: 'C:/out/n1x3u.safetensors', name: 'n1x3u', final: true, samples: [] }] };
  KS.trainTab.invalidate(); await wait(() => document.querySelectorAll('.lt-ep').length >= 1);
  [...document.querySelectorAll('.lt-ep button')].find(b => b.textContent === 'Essayer').click();
  await wait(() => window.sent?.length === 1);
  assert(window.sent[0].prompt === '<lora:n1x3u:1> @n1x3u', '« Essayer » envoie le LoRA et son déclencheur à KaneApp : ' + JSON.stringify(window.sent[0]));
  // Barre de VRAM : dans la barre de titre et dans la carte d'entraînement ; niveaux, pic, débordement dans la RAM
  const head = document.querySelector('#ls-vram .gpu-meter'), card = () => document.querySelector('.lt-card .gpu-meter.detail');
  assert(head && card() && head.dataset.level === 'none' && head.textContent.includes('—'), 'VRAM : une barre dans la barre de titre et une dans la carte, vides sans relevé');
  window.gpuPush({ used: 12288, total: 16384, util: 97, temp: 63, name: 'RTX test', shared: 80, level: 'ok' });
  assert(head.dataset.level === 'ok' && head.querySelector('i').style.width === '75%' && head.textContent.includes('12,0 / 16,0 Go'), 'VRAM : 12 Go sur 16 = barre à 75 %, en Go : ' + head.textContent);
  assert(card().textContent.includes('charge 97 %') && card().textContent.includes('63 °C') && card().querySelector('.gpu-note').hidden, 'VRAM, carte d’entraînement : charge et température, pas d’avertissement tant qu’il reste de la marge');
  window.gpuPush({ used: 15200, total: 16384, util: 99, temp: 70, name: 'RTX test', shared: 90, level: 'high' });
  assert(head.dataset.level === 'high' && head.textContent.includes('presque pleine') && !card().querySelector('.gpu-note').hidden, 'VRAM presque pleine : signalée, avec la marge restante');
  window.gpuPush({ used: 16300, total: 16384, util: 99, temp: 72, name: 'RTX test', shared: 3072, level: 'full' });
  const note = card().querySelector('.gpu-note').textContent;
  assert(head.dataset.level === 'full' && head.textContent.includes('saturée') && note.includes('3,0 Go ont débordé') && note.includes('768 px'), 'VRAM saturée : débordement dans la mémoire vive chiffré, avec quoi faire : ' + note);
  window.gpuPush({ used: 9000, total: 16384, util: 90, temp: 66, name: 'RTX test', shared: 80, level: 'ok' });
  assert(card().textContent.includes('pic 15,9 Go') && !card().querySelector('.gpu-track u').hidden, 'VRAM : le pic reste marqué quand la mémoire redescend');
  // Lancer un entraînement : le pic repart, et une carte déjà occupée est signalée
  window.loraRun = null; KS.trainTab.invalidate(); await wait(() => !!document.querySelector('.lt-start') && !document.querySelector('.lt-ep'));
  const starts = (window.loraStarts || []).length;
  document.querySelector('.lt-start').click();
  await wait(() => !!document.querySelector('.modal'));
  assert(document.querySelector('.modal').textContent.includes('VRAM insuffisante'), 'Lancer avec 8,8 Go déjà pris : la VRAM ne suffit pas, confirmation demandée');
  [...document.querySelectorAll('.modal button')].find(b => b.textContent === 'Lancer quand même').click();
  await wait(() => (window.loraStarts || []).length === starts + 1 && /déjà occupés/.test(document.querySelector('[data-msg="train"]').textContent));
  assert(KS.gpu.peak === 9000 && document.querySelector('[data-msg="train"]').textContent.includes('8,8 Go de VRAM sont déjà occupés'), 'Lancer : le pic repart de zéro et 8,8 Go déjà pris sont signalés');
  window.gpuPush(null);
  assert(head.dataset.level === 'none', 'VRAM : sans nvidia-smi, la barre reste vide au lieu de planter');
  // Vignettes : une seule demande par image, même affichée deux fois (galerie et légendes)
  const asked = window.thumbCalls.length, files = new Set(window.thumbCalls.map(c => c.file + '|' + c.width));
  assert(asked > 0 && files.size === asked, 'Vignettes : ' + asked + ' demande(s) pour ' + files.size + ' image(s), jamais deux fois la même');
  // Barre de progression en couleur : état, pourcentage, barre des tâches de Windows
  const runAt = (state, pct, running) => ({ run: 'C:/runs/r9', project: 'Import-test', running, state, pct, text: state, output: '', token: '', checkpoints: [], samples: [], before: [], epochs: [] });
  const prog = () => document.querySelector('.lt-train-prog');
  const show = async (state, pct, running) => { window.loraRun = runAt(state, pct, running); KS.trainTab.invalidate(); await wait(() => prog() && prog().dataset.state === (running && pct < 1 ? 'waiting' : state)); };
  await show('running', 42, true);
  assert(prog().querySelector('.lt-bar > i').style.width === '42%' && prog().querySelector('.lt-pct').textContent === '42 %' && getComputedStyle(prog().querySelector('.lt-bar > i')).animationName === 'lt-stripes',
    'Progression : 42 % en cours = barre remplie à 42 %, pourcentage affiché, rayures animées');
  assert(window.taskbar.at(-1)[0] === 0.42 && window.taskbar.at(-1)[1] === 'normal', 'Progression : la barre des tâches de Windows suit (0,42)');
  await show('running', 0, true);
  assert(prog().querySelector('.lt-pct').textContent === 'Préparation…' && window.taskbar.at(-1)[0] === 2, 'Progression : avant le premier pas, « Préparation… » et défilement dans la barre des tâches');
  await show('done', 100, false);
  assert(prog().querySelector('.lt-pct').textContent === 'Terminé · 100 %' && getComputedStyle(prog().querySelector('.lt-bar > i')).animationName === 'none' && window.taskbar.at(-1)[0] === -1,
    'Progression : terminé = verte, sans animation, barre des tâches libérée');
  await show('error', 37, false);
  assert(prog().querySelector('.lt-pct').textContent === 'Erreur · 37 %' && window.taskbar.at(-1)[1] === 'error', 'Progression : erreur = rouge, signalée dans la barre des tâches');
  await show('stopped', 60, false);
  assert(prog().querySelector('.lt-pct').textContent === 'Arrêté · 60 %', 'Progression : arrêté = orange, avec le pourcentage atteint');
  // Légendes : une correction à la main s'enregistre toute seule
  window.loraRun = null; KS.trainTab.invalidate(); await wait(() => !!document.querySelector('.lt-caprow textarea'));
  const before = (window.loraSaves || []).length, ta = document.querySelector('.lt-caprow textarea');
  ta.value = 'safe, 1girl, corrige a la main'; ta.dispatchEvent(new Event('input'));
  await wait(() => (window.loraSaves || []).slice(before).some(x => x.patch && x.patch.captions && Object.values(x.patch.captions).includes('safe, 1girl, corrige a la main')));
  assert(true, 'Légendes : une correction à la main est enregistrée automatiquement, sans cliquer « Enregistrer »');
  // Images d'aperçu : un clic les agrandit, Échap referme
  window.loraRun = { run: 'C:/runs/r1', project: 'Import-test', running: false, state: 'done', pct: 100, text: 'Terminé', output: 'C:/out/n1x3u.safetensors', token: '@n1x3u',
    checkpoints: [], samples: [], before: [], epochs: [{ epoch: 4, path: 'C:/out/n1x3u.safetensors', name: 'n1x3u', final: true, samples: ['C:/out/sample/n1x3u_e000004_00_1.png'] }] };
  KS.trainTab.invalidate(); await wait(() => !!document.querySelector('.lt-ep-imgs img.lt-zoomable'));
  document.querySelector('.lt-ep-imgs img.lt-zoomable').click();
  assert(!!document.querySelector('.lt-zoom') && window.thumbCalls.some(c => c.width === 2048 && c.file.includes('e000004_00')), 'Aperçu : un clic sur une image d’époque l’ouvre en grand');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await wait(() => !document.querySelector('.lt-zoom'));
  assert(!document.querySelector('.lt-zoom'), 'Aperçu : fermé (Échap, ou image illisible)');
  // Fermeture : on prévient quand la file d'attente ou l'extinction dépendent de la fenêtre
  KS.prefs.loraQueue = [];
  await show('running', 42, true);
  assert(!window.closeGuard, 'Fermeture : un entraînement seul ne demande rien (il continue sans la fenêtre)');
  const powerBox = [...document.querySelectorAll('.fx-check')].find(l => l.textContent.includes('Éteindre le PC')).querySelector('input');
  powerBox.click();
  assert(/ne s’éteindra pas/.test(window.closeGuard || ''), 'Fermeture : avec « Éteindre le PC », on prévient que l’extinction ne se fera pas : ' + window.closeGuard);
  assert(powerBox.closest('label').title.includes('Lora Studio doit rester ouvert') && !document.querySelector('.lt-card').textContent.includes('Forge reloads'), 'Textes : Lora Studio (et non KaneApp) doit rester ouvert');
  powerBox.click();
  assert(!window.closeGuard, 'Fermeture : plus rien à perdre, plus de question');
  // VRAM : estimation avant de lancer, ajustements proposés, confirmation si elle ne suffit pas
  KS.prefs.loraQueue = []; window.loraRun = null; window.loraVram = { native_factor: 2.2, measured: null };
  window.gpuPush({ used: 1000, total: 16303, util: 3, temp: 40, name: 'RTX', shared: 70, level: 'ok' });
  KS.trainTab.invalidate(); await wait(() => !!document.querySelector('.lt-vplan'));
  const plan = () => document.querySelector('.lt-vplan');
  assert(!plan().classList.contains('short') && plan().textContent.includes('≈ 13,0 Go') && plan().textContent.includes('14,9 Go'), 'VRAM : 1024 px ≈ 13 Go, assez de place : ' + plan().textContent.slice(0, 80));
  const nativeBox = [...document.querySelectorAll('.fx-check')].find(l => l.textContent.includes('Taille réelle')).querySelector('input');
  nativeBox.click(); await wait(() => plan() && plan().classList.contains('short'));   // sans nouveau rendu : l'estimation suit la case
  assert(plan().textContent.includes('≈ 17,8 Go') && plan().textContent.includes('ne suffira pas'), 'VRAM : taille réelle de grandes images ≈ 17,8 Go, signalée trop juste');
  const startsBefore = (window.loraStarts || []).length;
  document.querySelector('.lt-start').click();
  await wait(() => !!document.querySelector('.modal'));
  assert(document.querySelector('.modal').textContent.includes('VRAM insuffisante'), 'VRAM : lancer quand elle ne suffit pas demande confirmation');
  [...document.querySelectorAll('.modal button')].find(b => b.textContent === 'Ajuster les réglages').click();
  await new Promise(r => setTimeout(r, 150));
  assert((window.loraStarts || []).length === startsBefore, 'VRAM : « Ajuster les réglages » ne lance rien');
  [...plan().querySelectorAll('button')].find(b => b.textContent.includes('Décocher')).click();
  await wait(() => plan() && !plan().classList.contains('short'));
  await wait(() => (window.loraSaves || []).some(x => x.patch && x.patch.native_res === false));   // enregistrement différé de 0,6 s
  assert((window.loraSaves || []).some(x => x.patch && x.patch.native_res === false), 'VRAM : « Décocher Taille réelle » corrige et enregistre le réglage');
  window.loraVram = { native_factor: 2.2, measured: { peak_mb: 11264, factor: 1 } };
  KS.trainTab.invalidate(); await wait(() => plan() && plan().textContent.includes('dernier entraînement mesuré'));
  assert(plan().textContent.includes('≈ 11,0 Go'), 'VRAM : un pic déjà mesuré sur cette carte remplace l’estimation de départ');
  window.loraVram = null;
  // Vérifier les images : remarques listées, « Retirer » retire la bonne image
  window.loraAudit = [{ kind: 'dup', files: ['training-b.png', 'training-a.png'], text: 'presque identique à training-a.png' },
    { kind: 'mark', files: ['picked.png'], text: 'filigrane ou signature (signature)' }];
  [...document.querySelectorAll('button')].find(b => b.textContent === 'Vérifier les images').click();
  await wait(() => document.querySelectorAll('.lt-issue').length === 2);
  const issues = [...document.querySelectorAll('.lt-issue')];
  assert(issues[0].textContent.includes('Doublon') && issues[1].textContent.includes('Filigrane') && !issues[1].querySelector('button'), 'Images : doublon et filigrane listés ; un filigrane se rogne, pas de bouton Retirer');
  issues[0].querySelector('button').click();
  await wait(() => !!document.querySelector('.modal'));
  [...document.querySelectorAll('.modal button')].find(b => b.textContent === 'Retirer').click();
  await wait(() => (window.loraRemoved || []).length === 1);
  assert(window.loraRemoved[0] === 'training-b.png', 'Images : « Retirer » sur un doublon retire la copie, pas l’original');
  // Thèmes : Sombre, Système, Bleu, Clair ; le choix est retenu et la barre de titre suit
  const btn = document.querySelector('.ls-theme');
  btn.click(); await new Promise(r => setTimeout(r, 50));
  const items = [...document.querySelectorAll('.menu .mi .lb')].map(e => e.textContent);
  assert(items.join('|') === 'Sombre|Système (suit Windows)|Bleu|Clair', 'Thème : quatre choix dans le menu : ' + items.join(', '));
  [...document.querySelectorAll('.menu .mi')].find(i => i.textContent.includes('Bleu')).click();
  assert(document.body.classList.contains('theme-blue') && !document.body.classList.contains('theme-light') && window.titleBar.color === '#13223b' && btn.textContent === 'Thème : Bleu'
    && JSON.parse(localStorage.getItem('kanevas.prefs')).theme === 'blue', 'Thème Bleu : appliqué, barre de titre assortie, choix retenu');
  KS.setTheme('dark');
  assert(document.body.classList.contains('theme-dark') && !document.body.classList.contains('theme-blue') && getComputedStyle(document.body).backgroundColor === 'rgb(17, 19, 23)', 'Thème Sombre : fond sombre');
  KS.setTheme('system');
  const sysDark = matchMedia('(prefers-color-scheme: dark)').matches;
  assert(document.body.classList.contains(sysDark ? 'theme-dark' : 'theme-light') && btn.textContent === 'Thème : Système', 'Thème Système : suit Windows (' + (sysDark ? 'sombre' : 'clair') + ' ici)');
  KS.setTheme('light');
  assert(document.body.classList.contains('theme-light') && window.titleBar.color === '#ffffff', 'Thème Clair : rétabli');
  await show('running', 42, true);
  return results;
}

app.whenReady().then(async () => {
  let win;
  try {
    win = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: { preload, contextIsolation: false, sandbox: false, backgroundThrottling: false, offscreen: true } });
    const errors = [];
    win.webContents.on('console-message', d => { if (d.level === 'error') { errors.push(d.message); console.error(d.message); } });
    await win.loadFile(path.join(__dirname, '../app/index.html'));
    const results = await win.webContents.executeJavaScript('(' + scenario.toString() + ')()');
    if (errors.length) throw new Error(errors.join('\n'));
    for (const r of results) console.log('OK ' + r);
    // npx electron tools/test-train.cjs <dossier> : une capture de la carte d'entraînement par thème
    const shots = process.argv[2];
    if (shots) {
      fs.mkdirSync(shots, { recursive: true });
      for (const id of ['light', 'dark', 'blue']) {
        await win.webContents.executeJavaScript(`KS.setTheme('${id}'); window.gpuPush({ used: 11800, total: 16303, util: 98, temp: 64, name: 'RTX', shared: 80, level: 'ok' }); document.querySelector('.lt-train-prog').scrollIntoView({ block: 'center' }); new Promise(r => setTimeout(r, 700))`);
        fs.writeFileSync(path.join(shots, 'theme-' + id + '.png'), (await win.webContents.capturePage()).toPNG());
      }
    }
    app.exit(0);
  } catch (error) {
    console.error('ÉCHEC', error.message);
    app.exit(1);
  }
});
