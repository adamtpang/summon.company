// Summon desktop — Phase 1
// Chromeless desktop shell for the local summon.company server (Paperclip fork).
// Attached mode: server already running on :3100 -> just open a window, never kill it.
// Owned mode:    server down -> spawn `paperclipai run`, show splash while it boots,
//                and shut it down gracefully (taskkill tree, no /F first) on quit.

const { app, BrowserWindow, Tray, Menu, nativeImage, nativeTheme, dialog, ipcMain } = require('electron');
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const SERVER_HOST = '127.0.0.1';
const SERVER_PORT = 3100;
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;
const HEALTH_URL = `${SERVER_URL}/api/health`;
const APP_URL = `${SERVER_URL}/`; // SPA routes itself to the last company; no hardcoded prefix
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
// Persisted appearance settings (zoom + theme survive relaunches)
// ---------------------------------------------------------------------------
// One JSON file in userData. Default zoom is one level up (~120%) — the board
// asked for a larger default; Ctrl+0 still resets to 100% and that choice is
// saved like any other.
const SETTINGS_PATH = () => path.join(app.getPath('userData'), 'summon-settings.json');
const DEFAULT_ZOOM_LEVEL = 1;
let settings = { zoomLevel: DEFAULT_ZOOM_LEVEL, theme: 'light' };

function loadSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH(), 'utf8'));
    if (typeof raw.zoomLevel === 'number' && raw.zoomLevel >= -5 && raw.zoomLevel <= 5) {
      settings.zoomLevel = raw.zoomLevel;
    }
    if (['light', 'dark', 'system'].includes(raw.theme)) settings.theme = raw.theme;
  } catch {
    // first run or unreadable file — defaults stand
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_PATH(), JSON.stringify(settings, null, 2));
  } catch {
    // best-effort; never block the UI on a settings write
  }
}

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
// The dev-seat rule (SUM-133 lineage, 2026-07-19): when this machine carries
// the summon.company source repo, owned mode MUST start the SOURCE runtime —
// spawning the npm-global `paperclipai run` here caused the all-day port
// see-saw: source dies → this spawns the (older) packaged runtime → it serves
// stale UI + misses source-only API routes → the board kills it → repeat.
// Customer machines have no repo and keep the packaged path.
const SOURCE_START_CMD = path.join(
  os.homedir(),
  'OneDrive',
  'Aether',
  'summon.company',
  'scripts',
  'start-summon.cmd'
);

function spawnServer() {
  const useSource = fs.existsSync(SOURCE_START_CMD);
  serverProcess = spawn(useSource ? `"${SOURCE_START_CMD}"` : 'paperclipai run', [], {
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
    backgroundColor: '#FFFFFF',
    title: 'Summon - Company OS',
    icon: path.join(__dirname, 'icon.ico'),
    // Open maximized: create hidden, maximize, then show — no resize flash.
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Keep our title instead of the page's <title>
  mainWindow.on('page-title-updated', (e) => e.preventDefault());

  // Zoom shortcuts. With no application menu there are no zoom roles, and
  // Electron's default zoomIn accelerator ("CommandOrControl+Plus") never
  // matches the unshifted = key anyway — so the board could zoom out but not
  // back in. Handle it ourselves: Ctrl/Cmd + '='/'+' in, '-' out, '0' reset.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta)) return;
    const wc = mainWindow.webContents;
    if (input.key === '=' || input.key === '+') {
      setZoom(Math.min(wc.getZoomLevel() + 0.5, 5));
      event.preventDefault();
    } else if (input.key === '-') {
      setZoom(Math.max(wc.getZoomLevel() - 0.5, -5));
      event.preventDefault();
    } else if (input.key === '0') {
      setZoom(0);
      event.preventDefault();
    }
  });

  // Every zoom change persists, so the level survives relaunches.
  function setZoom(level) {
    mainWindow.webContents.setZoomLevel(level);
    settings.zoomLevel = level;
    saveSettings();
  }

  // Reapply the saved zoom on every load (splash → app included). Without this
  // each navigation resets to Electron's default 100%. Also watch the web UI's
  // own theme toggle (it flips the `dark` class on <html>) and report it back
  // through the preload bridge so the native titlebar follows the app.
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setZoomLevel(settings.zoomLevel);
    mainWindow.webContents
      .executeJavaScript(
        `(() => {
          if (window.__summonThemeWatch || !window.summonDesktop) return;
          window.__summonThemeWatch = true;
          const report = () =>
            window.summonDesktop.themeChanged(
              document.documentElement.classList.contains('dark') ? 'dark' : 'light'
            );
          new MutationObserver(report).observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
          });
          report();
        })();`,
        true
      )
      .catch(() => {});
  });

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

// The web UI stores its theme under 'vitals.theme' (see ui/src/lib/
// app-branding.ts — identifier, renaming it resets saved preferences). The
// tray used to write 'paperclip.theme', which the UI never reads — that's why
// the taskbar toggle did nothing.
const UI_THEME_KEY = 'vitals.theme';

// Keep the NATIVE window chrome (titlebar) on the app's theme, not the OS's.
function applyNativeTheme(theme) {
  nativeTheme.themeSource = theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : 'system';
}

async function setUiTheme(theme) {
  currentTheme = theme;
  settings.theme = theme;
  saveSettings();
  applyNativeTheme(theme);
  if (!mainWindow) return;
  try {
    // 'system': the UI has no OS-follow mode — clearing the key returns it to
    // its light-first default; explicit light/dark write the key it reads.
    const js =
      theme === 'system'
        ? `localStorage.removeItem(${JSON.stringify(UI_THEME_KEY)}); location.reload();`
        : `localStorage.setItem(${JSON.stringify(UI_THEME_KEY)}, ${JSON.stringify(theme)}); location.reload();`;
    await mainWindow.webContents.executeJavaScript(js, true);
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
// The tray sits in the OS taskbar, whose light/dark comes from the SHELL theme
// (SystemUsesLightTheme) — not from the app theme. Now that themeSource is
// pinned to the app's theme, nativeTheme.shouldUseDarkColors reflects the APP,
// so the taskbar shade must be read from the registry directly.
function windowsShellUsesDark() {
  try {
    const out = require('child_process')
      .execSync(
        'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" /v SystemUsesLightTheme',
        { windowsHide: true }
      )
      .toString();
    const m = out.match(/SystemUsesLightTheme\s+REG_DWORD\s+0x([0-9a-f]+)/i);
    if (m) return parseInt(m[1], 16) === 0;
  } catch {
    // registry unreadable — fall back below
  }
  return nativeTheme.shouldUseDarkColors;
}

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
      const file = windowsShellUsesDark() ? 'summon-tray-dark.ico' : 'summon-tray-light.ico';
      const img = nativeImage.createFromPath(path.join(trayDir, file));
      if (!img.isEmpty()) return img;
    }
  } catch {
    // fall through to the tile icon
  }
  return nativeImage.createFromPath(path.join(__dirname, 'icon.ico'));
}

// Rebuilds the tray context menu; assigned in createTray, callable from the
// theme-sync IPC handler so the radio tracks in-app toggles.
let refreshTrayMenu = () => {};

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
  refreshTrayMenu = rebuildMenu;
  rebuildMenu();

  // Single left-click opens the window — on Windows the tray only fires
  // 'double-click' unless 'click' is handled too, which is why pressing the
  // small taskbar icon did nothing.
  const openWindow = () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  };
  tray.on('click', openWindow);
  tray.on('double-click', openWindow);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function onReady() {
  loadSettings();
  currentTheme = settings.theme; // tray radio reflects the saved choice
  applyNativeTheme(currentTheme); // titlebar matches the app from first paint

  // In-app theme toggles arrive here via the preload bridge: keep the native
  // chrome, the tray radio, and the saved setting in sync with the page.
  ipcMain.on('summon:theme-changed', (_event, theme) => {
    if (theme !== 'light' && theme !== 'dark') return;
    if (currentTheme === theme) return;
    currentTheme = theme;
    settings.theme = theme;
    saveSettings();
    applyNativeTheme(theme);
    refreshTrayMenu();
  });

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
