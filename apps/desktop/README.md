# Vitals Desktop (Phase 1)

Chromeless Electron shell for the local summon.company company OS server
(`http://127.0.0.1:3100`). Window + tray icon + single instance + graceful
lifecycle. It does **not** bundle the server yet - Phase 1 attaches to (or
starts) the globally-installed `paperclipai` CLI.

## Run

```powershell
cd apps/desktop
npm install --no-workspaces   # npm, NOT pnpm - keeps Electron out of the workspace hoist
npm start
```

`npm start` opens a 1440x900 window on `http://127.0.0.1:3100/VIT` with a tray
icon. Closing the window (X) hides it to the tray; **Quit** lives in the tray
menu, along with **Open Vitals** and a **Start on login** checkbox.

## Attached vs owned mode

- **Attached** - the server was already running when the app launched (e.g. you
  started `paperclipai run` yourself). The app just opens a window on it and
  will **never** stop the server, even on quit.
- **Owned** - the server was down, so the app spawned `paperclipai run` itself
  (you see the dark "starting your company…" EKG splash while it boots, up to
  120s). On quit, the app terminates the spawned process tree gracefully
  (`taskkill /T` first, `/F` only after 8s) so the embedded Postgres on :54329
  shuts down cleanly.

## Icon

`icon.ico` is generated from `icon.svg` (the landing-page EKG mark) by
`node build-icon.js` (sharp + png-to-ico, 16–256px sizes). Re-run it after
editing `icon.svg`.

## Packaging (scaffolded, Phase 2 completes it)

```powershell
npm run dist   # electron-builder --win nsis -> dist/
```

## Roadmap

- **Phase 2** - self-contained payload: bundle node + server + embedded
  Postgres as `extraResources` so the NSIS installer needs no preinstalled CLI.
- **Phase 3** - code signing via Azure Trusted Signing (no SmartScreen scare
  screen), auto-update channel.
