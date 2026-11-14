// Lora Studio — processus principal. L'atelier d'entraînement LoRA et le Merge, sortis de KaneApp (1.34) pour que
// l'entraînement et les fusions ne vivent pas dans la même application que le Studio et ses checkpoints.
// Les moteurs restent ceux de KaneApp (KaneAppData\runtimes\studio : Python, extension forge_lora_trainer, sd-scripts) ;
// Lora Studio lit leurs emplacements dans le profil de KaneApp, sans jamais les modifier.
const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');

app.setName('Lora Studio');
if (process.env.LORASTUDIO_PROFILE) app.setPath('userData', process.env.LORASTUDIO_PROFILE);
if (process.platform === 'win32') app.setAppUserModelId('com.kane.lorastudio');

let win = null;

/* ------------------------------------------------------------------ emplacements (ceux de KaneApp) */
// Profil de KaneApp : %APPDATA%\KaneApp (ou son ancien nom). KANEAPP_PROFILE le remplace pour les essais.
function kaneProfile() {
  if (process.env.KANEAPP_PROFILE) return process.env.KANEAPP_PROFILE;
  const base = app.getPath('appData');
  return ['KaneApp', 'KaneShop', 'Kanevas'].map(n => path.join(base, n)).find(p => fs.existsSync(p)) || path.join(base, 'KaneApp');
}
const managed = () => require('./managed-runtimes.cjs')(kaneProfile());
function dirs() {
  const m = managed().read();
  if (m.active) return { data: m.components.studio.directory, models: m.models, lora: path.join(m.models, 'Lora'), root: m.source || path.dirname(path.dirname(path.dirname(m.components.studio.directory))) };
  let d = null;
  try { d = JSON.parse(fs.readFileSync(path.join(kaneProfile(), 'forge-dirs.json'), 'utf8')); } catch { /* KaneApp n'a jamais démarré son moteur */ }
  if (!d || !d.data) throw new Error('Moteurs de KaneApp introuvables : ouvrez KaneApp une fois (Studio IA), puis revenez ici.');
  return { data: d.data, models: d.models, lora: d.lora || path.join(d.models, 'Lora'), root: path.dirname(d.data) };
}
const studioEnv = () => { try { return managed().environment('studio'); } catch { return process.env; } };
const outputPaths = require('./output-paths.cjs')(() => dirs().root);
const insideDir = (root, p) => {
  if (!root || !p) return false;
  const a = path.resolve(root) + path.sep, b = path.resolve(String(p));
  return process.platform === 'win32' ? b.toLowerCase().startsWith(a.toLowerCase()) : b.startsWith(a);   // Windows ne distingue pas la casse
};
const unpacked = f => path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), f);

/* ------------------------------------------------------------------ fenêtre */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    createWindow();
    updater.checkSoon();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => gpuMonitor.stop());
}

const chromeFile = () => path.join(app.getPath('userData'), 'window-chrome.json');
const boundsFile = () => path.join(app.getPath('userData'), 'window-bounds.json');
// Taille et place de la fenêtre au dernier usage ; la place n'est reprise que si elle tombe encore sur un écran branché.
function savedBounds() {
  const out = { width: 1440, height: 920 };
  try {
    const b = JSON.parse(fs.readFileSync(boundsFile(), 'utf8'));
    if (b.width >= 900 && b.height >= 600) { out.width = Math.round(b.width); out.height = Math.round(b.height); }
    const { screen } = require('electron');
    const visible = Number.isFinite(b.x) && Number.isFinite(b.y) && screen.getAllDisplays().some(d => b.x + 100 < d.workArea.x + d.workArea.width && b.x + out.width - 100 > d.workArea.x && b.y >= d.workArea.y - 10 && b.y + 40 < d.workArea.y + d.workArea.height);
    if (visible) { out.x = Math.round(b.x); out.y = Math.round(b.y); }
    out.maximized = !!b.maximized;
  } catch { /* premier lancement */ }
  return out;
}
// Ce que la fermeture ferait perdre (file d'attente, extinction du PC, fusion en cours) : la page le dit, on demande avant.
let closeGuard = '';
ipcMain.on('set-close-guard', (_e, text) => { closeGuard = String(text || '').slice(0, 800); });
function createWindow() {
  let chrome = { color: '#ffffff', symbolColor: '#3b4552' };
  try { chrome = { ...chrome, ...JSON.parse(fs.readFileSync(chromeFile(), 'utf8')) }; } catch { /* premier lancement */ }
  const bounds = savedBounds();
  const icon = app.isPackaged ? path.join(process.resourcesPath, 'lorastudio.ico') : path.join(__dirname, 'build', 'icon.ico');
  win = new BrowserWindow({
    width: bounds.width, height: bounds.height, ...(bounds.x != null ? { x: bounds.x, y: bounds.y } : {}), minWidth: 900, minHeight: 600, backgroundColor: chrome.color, title: 'Lora Studio', icon,
    titleBarStyle: 'hidden', titleBarOverlay: { color: chrome.color, symbolColor: chrome.symbolColor, height: 40 }, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, spellcheck: false, backgroundThrottling: false },
  });
  if (process.platform === 'win32') win.setAppDetails({ appId: 'com.kane.lorastudio', appIconPath: icon, appIconIndex: 0, relaunchDisplayName: 'Lora Studio' });
  win.setMenu(null);
  win.once('ready-to-show', () => { if (bounds.maximized) win.maximize(); win.show(); });
  win.webContents.on('will-navigate', e => e.preventDefault());      // la page ne quitte jamais index.html
  win.on('close', e => {
    if (closeGuard) {
      const choice = dialog.showMessageBoxSync(win, { type: 'warning', title: 'Lora Studio', message: 'Fermer Lora Studio ?', detail: closeGuard, buttons: ['Rester', 'Fermer quand même'], defaultId: 0, cancelId: 0, noLink: true });
      if (choice === 0) return e.preventDefault();
    }
    try { fs.writeFileSync(boundsFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() })); } catch { /* profil en lecture seule */ }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.on('closed', () => { win = null; });
  gpuMonitor.start();
}
ipcMain.on('set-titlebar', (_e, o) => {
  try { if (win) win.setTitleBarOverlay({ ...o, height: 40 }); } catch { /* ancien Windows */ }
  if (o && /^#[\da-f]{6}$/i.test(o.color) && /^#[\da-f]{6}$/i.test(o.symbolColor)) fs.promises.writeFile(chromeFile(), JSON.stringify({ color: o.color, symbolColor: o.symbolColor })).catch(() => {});
});
// Avancée de l'entraînement dans la barre des tâches de Windows : 0 à 1, 2 = en préparation (défilement), -1 = rien.
ipcMain.on('set-progress', (_e, value, mode) => {
  try { if (win && !win.isDestroyed()) win.setProgressBar(Number.isFinite(+value) ? +value : -1, { mode: ['normal', 'error', 'paused'].includes(mode) ? mode : 'normal' }); } catch { /* rien */ }
});
const updater = require('./updater.cjs')(() => win);

/* ------------------------------------------------------------------ carte graphique (barre de VRAM) */
// Relevé toutes les 2 s (gpu-monitor.cjs), poussé à la page ; `gpu-stats` rend le dernier relevé à l'ouverture.
const gpuMonitor = require('./gpu-monitor.cjs').createMonitor(s => { try { if (win && !win.isDestroyed()) win.webContents.send('gpu-stats', s); } catch { /* fenêtre fermée */ } });
ipcMain.handle('gpu-stats', () => gpuMonitor.last());

/* ------------------------------------------------------------------ atelier LoRA (lora_bridge.py) */
ipcMain.handle('lora-call', async (_e, cmd, args = {}) => {
  try {
    const d = dirs();
    const py = path.join(d.data, 'venv', 'Scripts', 'python.exe');
    if (!fs.existsSync(py)) throw new Error('Python du moteur introuvable : ' + py);
    if (!/^[a-z_]+$/.test(cmd)) throw new Error('Commande invalide');
    const output_dir = cmd === 'start' ? outputPaths.loraDirectory(d.models) : outputPaths.directory('lora');
    const input = JSON.stringify({ ...args, data_dir: d.data, model_ref: d.models, lora_dir: d.lora, output_dir });
    return await new Promise((resolve, reject) => {
      const child = spawn(py, [unpacked('lora_bridge.py'), cmd], { cwd: d.data, windowsHide: true, env: { ...studioEnv(), PYTHONIOENCODING: 'utf-8' } });
      let so = '', se = '';
      child.stdout.on('data', x => { so += x; });
      child.stderr.on('data', x => { se += x; if (se.length > 20000) se = se.slice(-20000); });
      child.on('error', reject);
      child.on('close', code => { try { resolve(JSON.parse(so)); } catch { reject(new Error('Passerelle : réponse illisible (' + code + ') ' + se.slice(-400))); } });
      child.stdin.end(input);
    });
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});
const inProjects = file => { const d = dirs(); return insideDir(path.join(d.data, 'lora_training'), file) || insideDir(d.lora, file) || insideDir(path.join(d.root, 'output', 'lora'), file); };
ipcMain.handle('lora-thumb', async (_e, file, width = 256) => {
  try {
    if (!inProjects(file)) throw new Error('Chemin refusé');
    const ni = nativeImage.createFromBuffer(await fs.promises.readFile(file));   // lecture hors du fil principal
    if (ni.isEmpty()) throw new Error('Image illisible');
    const sz = ni.getSize();
    return { ok: true, data: new Uint8Array((sz.width > width ? ni.resize({ width, quality: 'good' }) : ni).toJPEG(85)), w: sz.width, h: sz.height };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});
ipcMain.handle('pick-image-paths', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Images pour l\'entraînement', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }] });
  return r.canceled ? [] : r.filePaths;
});
ipcMain.handle('pick-folder', async (_e, title) => {
  const r = await dialog.showOpenDialog(win, { title: title || 'Dossier', properties: ['openDirectory'] });
  return r.canceled || !r.filePaths[0] ? '' : r.filePaths[0];
});
ipcMain.handle('open-folder', (_e, p) => { try { const d = dirs(); if (insideDir(d.data, p) || insideDir(d.lora, p) || insideDir(path.join(d.root, 'output'), p)) shell.openPath(p); } catch { /* rien */ } });
// « Éteindre le PC quand l'entraînement est terminé » : shutdown /s différé, annulable
ipcMain.handle('lora-shutdown', async (_e, on, message) => {
  const args = on ? ['/s', '/t', '120', '/c', String(message || 'Lora Studio : entraînement LoRA terminé. Le PC s\'éteint dans 2 minutes (shutdown /a pour annuler).').slice(0, 500)] : ['/a'];
  return new Promise(res => execFile('shutdown', args, { windowsHide: true }, err => res({ ok: !err || !on, error: err ? String(err.message) : '' })));
});

/* ------------------------------------------------------------------ Merge (merge_bridge.py) */
// Code du Merge repris tel quel de KaneApp (main.js) ; ces quatre noms y font le lien avec les emplacements lus ci-dessus.
let forgeDirs = null;
const loadDirs = () => { forgeDirs = dirs(); };
const mergeBridgePath = () => unpacked('merge_bridge.py');
const managedRuntime = { environment: () => studioEnv() };
let mergeChild = null, mergeOut = '';
const mergeRoots = () => {
  loadDirs();
  if (!forgeDirs || !forgeDirs.models) throw new Error('Démarrez Forge une fois depuis Kane OS : KaneApp y lit ses dossiers de modèles');
  return { ckpt: path.join(forgeDirs.models, 'Stable-diffusion'), lora: forgeDirs.lora || path.join(forgeDirs.models, 'Lora'), vae: path.join(forgeDirs.models, 'VAE'), te: path.join(forgeDirs.models, 'text_encoder') };
};
const mergeResolve = id => {
  const m = /^(ckpt|lora|vae|te):(.+)$/.exec(String(id || '')); if (!m) throw new Error('Modèle invalide');
  const root = mergeRoots()[m[1]], file = path.resolve(root, m[2]);
  if (!insideDir(root, file) || !/\.safetensors$/i.test(file) || !fs.existsSync(file)) throw new Error('Modèle introuvable : ' + m[2]);
  return file;
};
const mergeSpawn = (cmd, input, onLine) => new Promise((resolve, reject) => {
  const py = path.join(forgeDirs.data, 'venv', 'Scripts', 'python.exe');
  if (!fs.existsSync(py)) return reject(new Error('Python du Studio introuvable : ' + py));
  const child = require('child_process').spawn(py, [mergeBridgePath(), cmd], { cwd: forgeDirs.data, windowsHide: true, env: { ...managedRuntime.environment('studio'), PYTHONIOENCODING: 'utf-8' } });
  mergeChild = child; let buf = '', last = null, err = '';
  const feed = chunk => {
    buf += chunk; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
      try { last = JSON.parse(line); if (last.progress !== undefined && onLine) onLine(last); } catch { /* bruit de bibliothèque */ }
    }
  };
  child.stdout.setEncoding('utf8'); child.stdout.on('data', feed);
  child.stderr.on('data', d => { err = (err + d).slice(-4000); });
  child.on('error', reject);
  child.on('close', code => {
    mergeChild = null; feed('\n');
    if (child.killedByUs) return resolve({ ok: false, cancelled: true, error: 'Fusion annulée' });
    last && last.ok !== undefined ? resolve(last) : reject(new Error('Fusion interrompue (' + code + ') ' + err.slice(-300)));
  });
  child.stdin.end(JSON.stringify(input));
});
const walkModels = (dir, out = [], depth = 0) => {
  let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const f = path.join(dir, e.name);
    if (e.isDirectory() || (e.isSymbolicLink() && fs.statSync(f, { throwIfNoEntry: false })?.isDirectory())) { if (depth < 4) walkModels(f, out, depth + 1); }
    else if (/\.safetensors$/i.test(e.name)) out.push(f);
  }
  return out;
};
ipcMain.handle('merge-list', () => {
  try {
    const roots = mergeRoots();
    const list = kind => walkModels(roots[kind]).map(f => {
      const st = fs.statSync(f), rel = path.relative(roots[kind], f).replace(/\\/g, '/');
      return { id: kind + ':' + rel, name: rel.replace(/\.safetensors$/i, ''), size: st.size, mtime: st.mtimeMs };
    }).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
    return { ok: true, checkpoints: list('ckpt'), loras: list('lora'), vaes: list('vae'), encoders: list('te') };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});
ipcMain.handle('merge-inspect', async (_e, ids) => {
  try {
    if (mergeChild) throw new Error('Une fusion est en cours');
    mergeRoots(); if (!Array.isArray(ids) || !ids.length || ids.length > 8) throw new Error('Demande invalide');
    return await mergeSpawn('inspect', { files: ids.map(mergeResolve) });
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});
ipcMain.handle('merge-run', async (event, job) => {
  let out = '';
  try {
    if (mergeChild) throw new Error('Une fusion est déjà en cours');
    const roots = mergeRoots(), models = roots.ckpt.replace(/[\\/]Stable-diffusion$/i, '');
    const kind = job && job.kind;
    if (!['checkpoints', 'lora_into_checkpoint', 'loras', 'embed'].includes(kind)) throw new Error('Type de fusion inconnu');
    const dtype = ['source', 'bf16', 'fp16', 'fp32'].includes(job.dtype) ? job.dtype : 'source';
    const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
    const loraList = () => {
      const l = (job.loras || []).slice(0, 12).map(x => ({ path: mergeResolve(x.id), weight: num(x.weight, -4, 4, 1) }));
      if (!l.length) throw new Error('Choisissez au moins un LoRA');
      return l;
    };
    const input = { dtype };
    // VAE et encodeur de texte à intégrer au checkpoint produit (facultatif, sauf pour « embed »)
    if (kind !== 'loras' && job.embed) input.embed = { vae: job.embed.vae ? mergeResolve(job.embed.vae) : null, text_encoder: job.embed.text_encoder ? mergeResolve(job.embed.text_encoder) : null };
    if (kind === 'checkpoints') Object.assign(input, { models: (job.models || []).slice(0, 3).map(mergeResolve), mode: job.mode === 'diff' ? 'diff' : 'sum', alpha: num(job.alpha, -2, 3, 0.5), alpha_end: job.alpha_end == null ? null : num(job.alpha_end, -2, 3, 0.5) });
    else if (kind === 'lora_into_checkpoint') Object.assign(input, { model: mergeResolve(job.model), loras: loraList() });
    else if (kind === 'embed') Object.assign(input, { model: mergeResolve(job.model) });
    else Object.assign(input, { loras: loraList(), method: job.method === 'svd' ? 'svd' : 'concat', rank: Math.round(num(job.rank, 1, 256, 32)) });
    const dir = kind === 'loras' ? outputPaths.loraDirectory(models) : outputPaths.mergeDirectory(models);
    const stem = String(job.name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w .-]/g, '_').replace(/^\.+|\.+$/g, '').trim().slice(0, 80) || 'merge';
    out = path.join(dir, stem + '.safetensors');
    for (let i = 2; fs.existsSync(out); i++) out = path.join(dir, `${stem}_${i}.safetensors`);
    input.out = out; mergeOut = out;
    const send = m => { try { event.sender.send('merge-progress', m); } catch { /* fenêtre fermée */ } };
    const r = await mergeSpawn(kind, input, send);
    if (!r.ok) { try { fs.rmSync(out + '.tmp', { force: true }); } catch { /* rien */ } return r; }
    return { ...r, name: path.basename(out, '.safetensors'), id: (kind === 'loras' ? 'lora:KaneApp/' : 'ckpt:KaneApp/') + path.basename(out) };
  } catch (err) {
    if (out) try { fs.rmSync(out + '.tmp', { force: true }); } catch { /* rien */ }
    return { ok: false, error: String(err.message || err) };
  }
});
const stopMerge = () => {
  if (!mergeChild) return;
  mergeChild.killedByUs = true; try { mergeChild.kill(); } catch { /* déjà fini */ }
  if (mergeOut) try { fs.rmSync(mergeOut + '.tmp', { force: true }); } catch { /* rien */ }
};
app.on('will-quit', stopMerge);        // sinon le processus Python continuait seul et écrivait un fichier que personne n'attend
ipcMain.handle('merge-cancel', () => { stopMerge(); return { ok: true }; });

/* ------------------------------------------------------------------ le moteur de KaneApp (Forge), seulement interrogé */
// Le moteur du Studio de KaneApp (7862), sinon le Forge de Kane OS (7860). Lora Studio ne le démarre jamais : il le
// décharge avant un entraînement (la carte graphique est pour sd-scripts) et lui fait relire ses listes après un Merge.
let forgeBase = '';
async function forgeCall(route, body, timeout = 600000, base = forgeBase) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(base + route, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal } : { signal: ctl.signal });
    const txt = await res.text();
    if (!res.ok) throw new Error('Forge HTTP ' + res.status + (txt ? ' : ' + txt.slice(0, 300) : ''));
    return txt ? JSON.parse(txt) : null;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Le moteur de KaneApp ne répond pas');
    if (err.cause && err.cause.code === 'ECONNREFUSED') throw new Error('Le moteur de KaneApp n\'est pas démarré');
    throw err;
  } finally { clearTimeout(t); }
}
async function findForge() {
  for (const port of [7862, 7860]) {
    const base = 'http://127.0.0.1:' + port;
    try { await forgeCall('/sdapi/v1/progress?skip_current_image=true', null, 1500, base); forgeBase = base; return base; } catch { /* suivant */ }
  }
  forgeBase = ''; return '';
}
const forgeHandler = fn => async (_e, ...a) => {
  try {
    if (!forgeBase || !(await forgeCall('/sdapi/v1/progress?skip_current_image=true', null, 1500).then(() => true, () => false))) await findForge();
    if (!forgeBase) throw new Error('Le moteur de KaneApp n\'est pas démarré');
    return { ok: true, ...(await fn(...a)) };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
};
// used / total : toute la carte ; own : ce que le moteur de KaneApp a réservé (octets)
function forgeMemory(r) {
  const cuda = (r && r.cuda) || {}, sys = cuda.system || {};
  return { used: sys.used || 0, total: sys.total || 0, own: (cuda.reserved && cuda.reserved.current) || 0 };
}
ipcMain.handle('forge-alive', async () => {
  const base = await findForge();
  if (!base) return { ok: true, up: false };
  // « Modèle chargé » : ce que le moteur a réservé lui-même. Avant, on regardait la mémoire utilisée de toute la carte :
  // un entraînement en cours (ou un jeu) faisait croire que KaneApp gardait un modèle chargé.
  let used = 0, total = 0, own = 0;
  try { const m = forgeMemory(await forgeCall('/sdapi/v1/memory', null, 3000)); used = m.used; total = m.total; own = m.own; } catch { /* rien */ }
  return { ok: true, up: true, port: +base.split(':').pop(), used, total, own, loaded: own > 1.5 * 1024 ** 3 };
});
ipcMain.handle('forge-progress', forgeHandler(async () => {
  const r = await forgeCall('/sdapi/v1/progress?skip_current_image=true', null, 4000);
  const st = (r && r.state) || {};
  return { progress: r ? r.progress : 0, eta: r ? r.eta_relative : 0, step: st.sampling_step, steps: st.sampling_steps, jobs: st.job_count };
}));
ipcMain.handle('forge-unload', forgeHandler(async () => { await forgeCall('/sdapi/v1/unload-checkpoint', {}, 60000); return {}; }));
ipcMain.handle('forge-memory', forgeHandler(async () => forgeMemory(await forgeCall('/sdapi/v1/memory', null, 4000))));
ipcMain.handle('forge-refresh-loras', forgeHandler(async () => { await forgeCall('/sdapi/v1/refresh-loras', {}, 60000); return {}; }));
ipcMain.handle('forge-refresh-checkpoints', forgeHandler(async () => { await forgeCall('/sdapi/v1/refresh-checkpoints', {}, 60000); return {}; }));

/* ------------------------------------------------------------------ envoyer vers KaneApp */
// « Essayer » : le LoRA va dans l'invite du Studio de KaneApp (--kane-prompt=, KaneApp 1.34) ; une image s'ouvre dans KaneApp.
function kaneAppExe() {
  const programs = path.join(app.getPath('home'), 'AppData', 'Local', 'Programs');
  return [path.join(programs, 'KaneApp', 'KaneApp.exe'), path.join(programs, 'Kanevas', 'Kanevas.exe')].find(p => fs.existsSync(p)) || '';
}
ipcMain.handle('send-to-kaneapp', (_e, what = {}) => {
  try {
    const exe = process.env.KANEAPP_EXE || kaneAppExe();
    if (!exe) throw new Error('KaneApp n\'est pas installé');
    const args = [];
    if (what.prompt) args.push('--kane-prompt=' + String(what.prompt).replace(/[\r\n]+/g, ' ').slice(0, 2000));
    if (what.file) { if (!inProjects(what.file) || !fs.existsSync(what.file)) throw new Error('Fichier refusé'); args.push(what.file); }
    if (!args.length) throw new Error('Rien à envoyer');
    spawn(exe, args, { detached: true, stdio: 'ignore', windowsHide: false }).unref();
    return { ok: true };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});
