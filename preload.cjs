// Ce que la page de Lora Studio peut demander au processus principal (mêmes noms que dans KaneApp).
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('ksNative', {
  platform: process.platform,
  setTitleBar: o => ipcRenderer.send('set-titlebar', o),
  pathForFile: f => { try { return webUtils.getPathForFile(f); } catch { return null; } },
  // atelier LoRA
  loraCall: (cmd, args) => ipcRenderer.invoke('lora-call', cmd, args),
  loraThumb: (file, width) => ipcRenderer.invoke('lora-thumb', file, width),
  loraFile: file => ipcRenderer.invoke('lora-file', file),
  loraWrite: (project, name, data) => ipcRenderer.invoke('lora-write', project, name, data),
  loraShutdown: (on, message) => ipcRenderer.invoke('lora-shutdown', on, message),
  pickImagePaths: () => ipcRenderer.invoke('pick-image-paths'),
  pickFolderImages: () => ipcRenderer.invoke('pick-folder-images'),
  pickFolder: title => ipcRenderer.invoke('pick-folder', title),
  openFolder: p => ipcRenderer.invoke('open-folder', p),
  // Merge
  mergeList: () => ipcRenderer.invoke('merge-list'),
  mergeInspect: ids => ipcRenderer.invoke('merge-inspect', ids),
  mergeRun: job => ipcRenderer.invoke('merge-run', job),
  mergeCancel: () => ipcRenderer.invoke('merge-cancel'),
  onMergeProgress: fn => { const h = (_e, m) => fn(m); ipcRenderer.on('merge-progress', h); return () => ipcRenderer.removeListener('merge-progress', h); },
  // moteur de KaneApp (adresse trouvée par le processus principal ; l'argument `base` est ignoré)
  forgeAlive: () => ipcRenderer.invoke('forge-alive'),
  forgeProgress: () => ipcRenderer.invoke('forge-progress'),
  forgeUnload: () => ipcRenderer.invoke('forge-unload'),
  forgeMemory: () => ipcRenderer.invoke('forge-memory'),
  forgeRefreshLoras: () => ipcRenderer.invoke('forge-refresh-loras'),
  forgeRefreshCheckpoints: () => ipcRenderer.invoke('forge-refresh-checkpoints'),
  sendToKaneApp: what => ipcRenderer.invoke('send-to-kaneapp', what),
  // carte graphique : dernier relevé, puis un relevé toutes les 2 s
  gpuStats: () => ipcRenderer.invoke('gpu-stats'),
  onGpuStats: fn => { const h = (_e, s) => fn(s); ipcRenderer.on('gpu-stats', h); return () => ipcRenderer.removeListener('gpu-stats', h); },
  // mises à jour
  appVersion: () => ipcRenderer.invoke('app-version'),
  updateCheck: () => ipcRenderer.invoke('update-check'),
  updateDownload: () => ipcRenderer.invoke('update-download'),
  updateInstall: () => ipcRenderer.send('update-install'),
  onUpdateStatus: fn => ipcRenderer.on('update-status', (_e, s) => fn(s)),
});
