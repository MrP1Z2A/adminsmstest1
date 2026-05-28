@echo off
title LiveKit Server - Development Mode
echo Starting LiveKit Server in Development Mode...
echo Server Port: 7880
echo API Key: devkey
echo API Secret: secret
echo.
"%~dp0tmp\livekit-bin\livekit-server.exe" --dev
pause
