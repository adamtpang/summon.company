// Summon desktop preload — the minimal shell bridge (SUM-146 seed).
// Exposes exactly one capability today: telling the shell the web UI's theme
// changed, so the native window chrome (titlebar) can follow the APP's theme
// instead of the OS's. Extend deliberately; every addition is renderer-reachable.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('summonDesktop', {
  themeChanged: (theme) => {
    if (theme === 'light' || theme === 'dark') {
      ipcRenderer.send('summon:theme-changed', theme);
    }
  },
});
