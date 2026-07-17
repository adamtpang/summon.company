@echo off
rem ============================================================================
rem Start Summon (the control plane) on 127.0.0.1:3100 — SOURCE runtime.
rem
rem Double-click this after a reboot, or any time the app can't connect.
rem
rem WHY THIS FILE EXISTS: the server is a plain background process and dies on
rem reboot. If you then open the desktop app, its "attach-or-start" fallback
rem silently starts the OLD packaged app (`paperclipai run`) instead — undoing
rem the July 16 upgrade every time. Starting the server with THIS script first
rem means the desktop app attaches to the right one.
rem
rem Rollback (if the new server won't boot): run `paperclipai run` instead —
rem that is the old packaged app, kept installed as the fallback.
rem ============================================================================
cd /d "%~dp0..\server"
echo Starting Summon (source runtime) on http://127.0.0.1:3100 ...
node ..\cli\node_modules\tsx\dist\cli.mjs src\index.ts
