' Start Summon with NO window at all — the Claude-Desktop-style invisible backend.
' Double-click this instead of start-summon.cmd when you don't want a terminal.
'
' What it does: runs start-summon.cmd through the Windows Script Host with
' window style 0 (hidden). The server keeps running until stopped; check it at
' http://127.0.0.1:3100 or stop it from Task Manager (node.exe serving :3100).
'
' The visible-terminal version (start-summon.cmd) still exists for when you
' WANT to watch the logs.
Dim shell, scriptDir
Set shell = CreateObject("WScript.Shell")
scriptDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
shell.Run """" & scriptDir & "start-summon.cmd""", 0, False
