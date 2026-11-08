'use strict';

const { app, BrowserWindow, ipcMain, screen, globalShortcut, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const HTML = path.join(__dirname, 'index.html');
const ICON = path.join(__dirname, 'icon.ico');
const SEED = path.join(__dirname, 'seed.json');

const USER_DIR = app.getPath('userData');
const CFG_FILE = path.join(USER_DIR, 'window-state.json');
const SEEDED = path.join(USER_DIR, '.seeded');

let mainWin = null;
let miniWin = null;
let pinning = true;
let quitting = false;

/* ---------------- 窗口尺寸记忆 ---------------- */

function readCfg() {
  try { return JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')) || {}; } catch (e) { return {}; }
}
function writeCfg(patch) {
  const next = Object.assign(readCfg(), patch);
  try {
    fs.mkdirSync(USER_DIR, { recursive: true });
    fs.writeFileSync(CFG_FILE, JSON.stringify(next, null, 1));
  } catch (e) { /* 忽略：写不进配置不该影响使用 */ }
  return next;
}

/* 小窗 = 屏幕面积的 1/16，9:16 竖版 */
function miniSize() {
  const cfg = readCfg();
  const wa = screen.getPrimaryDisplay().workAreaSize;
  const remembered = cfg.mini;
  if (remembered && remembered.w > 200 && remembered.h > 300
      && Math.abs(remembered.aw - wa.width) < wa.width * 0.12
      && Math.abs(remembered.ah - wa.height) < wa.height * 0.12) {
    return { w: remembered.w, h: remembered.h };
  }
  const ratio = 9 / 16;
  const w = Math.round(Math.sqrt((wa.width * wa.height) / 16 * ratio));
  return {
    w: Math.max(260, Math.min(640, w)),
    h: Math.max(400, Math.min(1140, Math.round(w / ratio)))
  };
}

/* ---------------- 主窗口 ---------------- */

function createMain() {
  const cfg = readCfg();
  const b = cfg.main || {};
  mainWin = new BrowserWindow({
    width: b.w || 1180,
    height: b.h || 820,
    x: b.x,
    y: b.y,
    minWidth: 880,
    minHeight: 560,
    title: '刻度',
    icon: ICON,
    backgroundColor: '#fafaf7',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      spellcheck: false,
      additionalArguments: fs.existsSync(SEEDED) ? [] : ['--kedu-seed']
    }
  });

  mainWin.loadFile(HTML);

  mainWin.on('close', () => {
    try {
      const bounds = mainWin.getBounds();
      writeCfg({ main: { w: bounds.width, h: bounds.height, x: bounds.x, y: bounds.y } });
    } catch (e) {}
  });

  mainWin.on('closed', () => {
    mainWin = null;
    quitting = true;
    if (miniWin && !miniWin.isDestroyed()) miniWin.close();
  });

  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

/* ---------------- 小窗 ---------------- */

function createMini() {
  if (miniWin && !miniWin.isDestroyed()) {
    miniWin.show();
    miniWin.focus();
    return;
  }
  const sz = miniSize();
  const wa = screen.getPrimaryDisplay().workArea;
  const cfg = readCfg();
  const pos = cfg.miniPos || {};

  miniWin = new BrowserWindow({
    width: sz.w,
    height: sz.h,
    x: Number.isFinite(pos.x) ? pos.x : wa.x + wa.width - sz.w - 28,
    y: Number.isFinite(pos.y) ? pos.y : wa.y + wa.height - sz.h - 28,
    minWidth: 260,
    minHeight: 400,
    frame: false,
    thickFrame: true,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: pinning,
    skipTaskbar: false,
    title: '刻度 · 今日链路',
    icon: ICON,
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      spellcheck: false,
      additionalArguments: ['--kedu-mini']
    }
  });

  miniWin.loadFile(HTML, { search: 'mini=1' });

  if (pinning) miniWin.setAlwaysOnTop(true, 'screen-saver');

  miniWin.on('resize', () => {
    if (!miniWin || miniWin.isDestroyed()) return;
    const b = miniWin.getBounds();
    const wa2 = screen.getPrimaryDisplay().workAreaSize;
    writeCfg({ mini: { w: b.width, h: b.height, aw: wa2.width, ah: wa2.height } });
  });

  miniWin.on('move', () => {
    if (!miniWin || miniWin.isDestroyed()) return;
    const b = miniWin.getBounds();
    writeCfg({ miniPos: { x: b.x, y: b.y } });
  });

  miniWin.on('closed', () => {
    miniWin = null;
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('mini-state', { open: false });
    }
  });

  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('mini-state', { open: true, pinned: pinning });
  }
}

function closeMini() {
  if (miniWin && !miniWin.isDestroyed()) miniWin.close();
  if (mainWin && !mainWin.isDestroyed()) mainWin.focus();
}

/* ---------------- IPC ---------------- */

ipcMain.on('mini-open', () => createMini());
ipcMain.on('mini-close', () => closeMini());

ipcMain.on('mini-toggle-pin', () => {
  pinning = !pinning;
  if (miniWin && !miniWin.isDestroyed()) {
    miniWin.setAlwaysOnTop(pinning, pinning ? 'screen-saver' : 'normal');
    miniWin.webContents.send('pin-state', pinning);
  }
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('mini-state', { open: !!miniWin, pinned: pinning });
  }
});

ipcMain.handle('mini-pinned', () => pinning);

/* 数据变了：让另一个窗口重新读一遍 localStorage */
ipcMain.on('data-changed', (ev) => {
  [mainWin, miniWin].forEach((w) => {
    if (w && !w.isDestroyed() && w.webContents !== ev.sender) {
      w.webContents.send('data-changed');
    }
  });
});

/* 种子数据已经落进 localStorage，可以不再传 */
ipcMain.on('seed-applied', () => {
  try { fs.writeFileSync(SEEDED, new Date().toISOString()); } catch (e) {}
});

/* 打开数据文件所在目录，方便备份 */
ipcMain.on('open-user-dir', () => {
  shell.openPath(USER_DIR);
});

/* ---------------- 快捷键与生命周期 ---------------- */

/* 单实例：再次双击图标时聚焦已有窗口，而不是开第二个进程 */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWin && !mainWin.isDestroyed()) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.show();
      mainWin.focus();
    }
    if (miniWin && !miniWin.isDestroyed()) miniWin.focus();
  });

  function toggleMini() {
    if (miniWin && !miniWin.isDestroyed()) closeMini();
    else createMini();
  }

  app.whenReady().then(() => {
    createMain();
    globalShortcut.register('Alt+L', toggleMini);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMain();
    });
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });
}
