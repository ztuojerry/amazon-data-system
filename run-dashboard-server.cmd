@echo off
cd /d "%~dp0"
"D:\Program Files (x86)\nodejs\node.exe" scripts\serve-dashboard.js > tmp\dashboard-server.log 2> tmp\dashboard-server.err.log
