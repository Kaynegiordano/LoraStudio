// Essai de Lora Studio (npx electron tools/test-app.cjs [dossier de captures]) : fenêtre hors écran, profil temporaire.
// Vérifie les deux ateliers sur les vrais projets et modèles (lecture seule : aucun entraînement, aucune fusion).
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), os = require('os'), path = require('path');
const out = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'lorastudio-shots-'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lorastudio-profile-'));
process.env.LORASTUDIO_PROFILE = profile;
require('../main.cjs');
const wait = ms => new Promise(r => setTimeout(r, ms));
const ok = [], ko = [];
const check = (name, cond, detail = '') => { (cond ? ok : ko).push(name + (detail ? ' — ' + detail : '')); console.log((cond ? 'OK ' : 'ÉCHEC ') + name + (detail ? ' — ' + detail : '')); };

app.whenReady().then(async () => {
  let win = null;
  for (let i = 0; i < 100 && !(win = BrowserWindow.getAllWindows()[0]); i++) await wait(100);
  win.setPosition(-3000, 0); win.setSize(1484, 835);
  const js = code => win.webContents.executeJavaScript(code);
  const until = async (code, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(code).catch(() => false)) return true; await wait(250); } return false; };
  await until('!!document.querySelector("#ls-tabs button")');
  check('Deux ateliers dans la barre', await js('[...document.querySelectorAll("#ls-tabs button")].map(b => b.textContent).join("|")') === 'Entraînement|Merge');
  // Entraînement : la passerelle répond (info) et liste les projets
  const trainOk = await until('!!document.querySelector(".lt-col") || /Atelier LoRA :/.test(document.body.innerText)', 60000);
  const err = await js('(document.body.innerText.match(/Atelier LoRA : .*/) || [""])[0]');
  check('Atelier d’entraînement affiché', trainOk && !err, err);
  const projects = await js('KS.native.loraCall("list").then(r => r.ok ? r.projects.length : -1)');
  check('Projets Lora lus', projects >= 0, projects + ' projet(s)');
  await wait(1500);
  await win.webContents.capturePage().then(i => fs.writeFileSync(path.join(out, 'entrainement.png'), i.toPNG()));
  // Merge : la liste des modèles
  await js('document.querySelectorAll("#ls-tabs button")[1].click()');
  const mergeOk = await until('!!document.querySelector(".mg-page .lt-card")', 30000);
  const list = await js('KS.native.mergeList()');
  check('Atelier Merge affiché', mergeOk);
  check('Modèles listés pour le Merge', list.ok && list.checkpoints.length > 0, list.ok ? `${list.checkpoints.length} checkpoints, ${list.loras.length} LoRA` : list.error);
  await wait(1500);
  await win.webContents.capturePage().then(i => fs.writeFileSync(path.join(out, 'merge.png'), i.toPNG()));
  // moteur de KaneApp : seulement interrogé
  const forge = await js('KS.native.forgeAlive()');
  check('Moteur de KaneApp interrogé', forge.ok, forge.up ? 'démarré sur ' + forge.port : 'arrêté');
  const errors = await js('window.__errs || []');
  check('Aucune erreur de page', !errors.length, errors.join(' | '));
  console.log(`\n${ok.length} OK, ${ko.length} échec(s). Captures : ${out}`);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* encore verrouillé par Chromium */ }
  app.exit(ko.length ? 1 : 0);
});
app.on('web-contents-created', (_e, wc) => wc.on('console-message', (e) => {
  const lvl = e.level ?? e; const msg = e.message ?? arguments[2];
  if (lvl === 'error' || lvl === 3) wc.executeJavaScript(`(window.__errs ||= []).push(${JSON.stringify(String(msg).slice(0, 200))})`).catch(() => {});
}));
