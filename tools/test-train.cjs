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
  setTitleBar() {},
  pathForFile: file => 'C:/selected/' + file.name,
  pickImagePaths: async () => window.loraPaths,
  loraThumb: async () => ({ ok: false }),
  loraCall: async (cmd, args = {}) => {
    if (cmd === 'info') return { ok: true, presets: { style: { label: 'Style' } }, scopes: { full: { label: 'Full', hint: '', summary: 'All' } },
      resolutions: [512,1024], optimizers: { adamw8bit: 'AdamW' }, dits: [], fewshot_resolutions: [512,1024], sd_scripts: 'C:/training', tagger: true };
    if (cmd === 'list') return { ok: true, projects: window.loraImages.length ? [{ name: 'Import-test', count: window.loraImages.length }] : [] };
    if (cmd === 'import') { window.loraImages.push(...args.paths.map(p => ({file: p.split('/').pop(),path:p}))); return {ok:true,name:'Import-test',added:args.paths.length,count:window.loraImages.length}; }
    if (cmd === 'load') return { ok:true,manifest:{ trigger: 'n1x3u', lora_type: 'style', captions: window.loraCaps || {} },images:window.loraImages,runs:window.loraRun ? [window.loraRun] : [], suggest: window.loraSuggest || null };
    if (cmd === 'save') { (window.loraSaves ||= []).push(args); if (args.patch && args.patch.captions) window.loraCaps = { ...args.patch.captions }; return { ok: true }; }
    if (cmd === 'start') { (window.loraStarts ||= []).push(args); return { ok: true, pid: 7, run: 'C:/runs/' + args.name, total: 100, per_epoch: 10, resolutions: [1024], estimate_s: 600, output: 'C:/out/x.safetensors', count: 2, token: '@n1x3u' }; }
    if (cmd === 'install') { (window.loraInstalls ||= []).push(args); return { ok: true, installed: 'C:/Lora/Anima/' + args.name + '.safetensors', name: args.name }; }
    return {ok:true,status:null};
  },
  forgeAlive: async () => ({ ok: true, up: false }),
  forgeProgress: async () => ({ ok: false }),
  sendToKaneApp: async what => { (window.sent ||= []).push(what); return { ok: true }; },
};
`);

async function scenario() {
  const results = [];
  const assert = (ok, message) => { if (!ok) throw new Error(message); results.push(message); };
  const wait = async test => { for (let i = 0; i < 150; i++) { if (test()) return; await new Promise(r => setTimeout(r, 20)); } throw new Error('Timeout'); };
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
    app.exit(0);
  } catch (error) {
    console.error('ÉCHEC', error.message);
    app.exit(1);
  }
});
