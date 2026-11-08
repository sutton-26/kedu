'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

const flags = process.argv || [];

/* 首次启动：把旧版任务灌进去。页面用完会回一句 seed-applied，主进程就不再传了 */
let seed = null;
if (flags.indexOf('--kedu-seed') >= 0) {
  try {
    seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8'));
  } catch (e) {
    seed = null;
  }
}

let pinned = true;

ipcRenderer.on('pin-state', (ev, v) => {
  pinned = !!v;
});

contextBridge.exposeInMainWorld('keduAPI', {
  desktop: true,
  openMini: () => ipcRenderer.send('mini-open'),
  closeMini: () => ipcRenderer.send('mini-close'),
  togglePin: () => ipcRenderer.send('mini-toggle-pin'),
  getPinned: () => pinned,
  notifyChanged: () => ipcRenderer.send('data-changed'),
  seedApplied: () => ipcRenderer.send('seed-applied'),
  openUserDir: () => ipcRenderer.send('open-user-dir'),
  onDataChanged: (cb) => ipcRenderer.on('data-changed', () => cb()),
  onMiniState: (cb) => ipcRenderer.on('mini-state', (ev, s) => cb(s)),
  onPinState: (cb) => ipcRenderer.on('pin-state', (ev, v) => cb(!!v))
});

if (seed) {
  contextBridge.exposeInMainWorld('__KEDU_SEED__', seed);
}
