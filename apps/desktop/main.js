// Summon desktop — Phase 1
// Chromeless desktop shell for the local summon.company server (Paperclip fork).
// Attached mode: server already running on :3100 -> just open a window, never kill it.
// Owned mode:    server down -> spawn `paperclipai run`, show splash while it boots,
//                and shut it down gracefully (taskkill tree, no /F first) on quit.

const { app, BrowserWindow, Tray, Menu, nativeImage, nativeTheme, dialog } = require('electron');
const { spawn, execFile } = require('child_process');
const http = require('http');
const path = require('path');

const SERVER_HOST = '127.0.0.1';
const SERVER_PORT = 3100;
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;
const HEALTH_URL = `${SERVER_URL}/api/health`;
const APP_URL = `${SERVER_URL}/VIT`; // SPA handles routing; falls back to / on load failure
const HEALTH_TIMEOUT_MS = 2000;
const BOOT_POLL_INTERVAL_MS = 1000;
const BOOT_POLL_MAX_TRIES = 120; // 120s
const KILL_GRACE_MS = 8000;

let mainWindow = null;
let tray = null;
let serverProcess = null;
let ownServer = false; // true only if WE spawned the server
let isQuitting = false;
let shutdownInProgress = false;

// ---------------------------------------------------------------------------
// Single instance
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(onReady);
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
function checkHealth(timeoutMs = HEALTH_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, { timeout: timeoutMs }, (res) => {
      res.resume(); // drain
      resolve(res.statusCode >= 200 && res.statusCode < 300);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

// ---------------------------------------------------------------------------
// Server lifecycle (owned mode)
// ---------------------------------------------------------------------------
function spawnServer() {
  serverProcess = spawn('paperclipai run', [], {
    shell: true,
    detached: false,
    windowsHide: true,
    stdio: 'ignore',
  });
  ownServer = true;
  serverProcess.on('exit', () => {
    serverProcess = null;
  });
}

async function waitForServer() {
  for (let i = 0; i < BOOT_POLL_MAX_TRIES; i++) {
    if (await checkHealth(1500)) return true;
    await new Promise((r) => setTimeout(r, BOOT_POLL_INTERVAL_MS));
  }
  return false;
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function taskkill(pid, force) {
  return new Promise((resolve) => {
    const args = ['/PID', String(pid), '/T'];
    if (force) args.push('/F');
    execFile('taskkill', args, { windowsHide: true }, () => resolve());
  });
}

// Graceful tree shutdown: polite taskkill first so embedded Postgres stops
// cleanly, then /F only if the tree is still alive after the grace period.
async function shutdownOwnedServer() {
  if (!serverProcess || !serverProcess.pid) return;
  const pid = serverProcess.pid;

  await taskkill(pid, false);

  const deadline = Date.now() + KILL_GRACE_MS;
  while (Date.now() < deadline) {
    if (!pidAlive(pid)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (pidAlive(pid)) {
    await taskkill(pid, true);
  }
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    autoHideMenuBar: true,
    backgroundColor: '#F7FAFF',
    title: 'Summon - Company OS',
    icon: path.join(__dirname, 'icon.ico'),
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Keep our title instead of the page's <title>
  mainWindow.on('page-title-updated', (e) => e.preventDefault());

  // Close (X) hides to tray; real quit comes from the tray menu.
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // If /VIT fails to load (e.g. 404 on a future build), fall back to /.
  mainWindow.webContents.on(
    'did-fail-load',
    (_e, _code, _desc, validatedURL, isMainFrame) => {
      if (isMainFrame && validatedURL && validatedURL.startsWith(APP_URL)) {
        mainWindow.loadURL(`${SERVER_URL}/`);
      }
    }
  );

  return mainWindow;
}

// ---------------------------------------------------------------------------
// Theme (drives the engine UI's own theme via its localStorage key)
// ---------------------------------------------------------------------------
let currentTheme = 'light';

async function setUiTheme(theme) {
  currentTheme = theme;
  if (!mainWindow) return;
  try {
    await mainWindow.webContents.executeJavaScript(
      `localStorage.setItem('paperclip.theme', ${JSON.stringify(theme)}); location.reload();`,
      true
    );
  } catch {
    // Splash or a failed page has no UI localStorage to set; theme applies on next load.
  }
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------
// Monochrome Summon Circle glyph that follows the OS shell theme (VIT-36).
// macOS gets a Template image (system tints it); Windows/Linux pick the white
// glyph on dark shells and the ink glyph on light shells. icon.ico is the fallback.
function trayIcon() {
  const trayDir = path.join(__dirname, 'assets', 'tray');
  try {
    if (process.platform === 'darwin') {
      const img = nativeImage.createFromPath(path.join(trayDir, 'summonTrayTemplate.png'));
      if (!img.isEmpty()) {
        img.setTemplateImage(true);
        return img;
      }
    } else {
      const file = nativeTheme.shouldUseDarkColors ? 'summon-tray-dark.ico' : 'summon-tray-light.ico';
      const img = nativeImage.createFromPath(path.join(trayDir, file));
      if (!img.isEmpty()) return img;
    }
  } catch {
    // fall through to the tile icon
  }
  return nativeImage.createFromPath(path.join(__dirname, 'icon.ico'));
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('Summon - Company OS');
  nativeTheme.on('updated', () => {
    if (tray) tray.setImage(trayIcon());
  });

  const rebuildMenu = () => {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Open Summon',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: 'Theme',
        submenu: ['Light', 'Dark', 'System'].map((label) => ({
          label,
          type: 'radio',
          checked: currentTheme === label.toLowerCase(),
          click: () => setUiTheme(label.toLowerCase()).then(rebuildMenu),
        })),
      },
      {
        label: 'Start on login',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => {
          app.setLoginItemSettings({ openAtLogin: item.checked });
          rebuildMenu();
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray.setContextMenu(menu);
  };
  rebuildMenu();

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function onReady() {
  createMainWindow();
  createTray();

  const up = await checkHealth();

  if (up) {
    // Attached mode: someone else owns the server. Never kill it.
    await mainWindow.loadURL(APP_URL);
    return;
  }

  // Owned mode: show splash, spawn the server, poll until healthy.
  await mainWindow.loadFile(path.join(__dirname, 'splash.html'));
  spawnServer();

  const healthy = await waitForServer();
  if (!mainWindow) return; // quit while booting

  if (healthy) {
    await mainWindow.loadURL(APP_URL);
  } else {
    dialog.showErrorBox(
      'Summon could not start',
      `The local server did not come up on ${SERVER_URL} within ${BOOT_POLL_MAX_TRIES}s.\n\n` +
        'Try running "paperclipai run" in a terminal to see its output, then relaunch Summon.'
    );
    isQuitting = true;
    app.quit();
  }
}

// Tray app: keep running when all windows are closed/hidden.
app.on('window-all-closed', () => {
  // no-op — lifecycle is owned by the tray Quit item
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

// Graceful quit: only ever touch the server if WE spawned it.
app.on('before-quit', (e) => {
  isQuitting = true;
  if (ownServer && serverProcess && serverProcess.pid && !shutdownInProgress) {
    shutdownInProgress = true;
    e.preventDefault();
    shutdownOwnedServer().finally(() => {
      serverProcess = null;
      ownServer = false;
      app.quit();
    });
  }
});
