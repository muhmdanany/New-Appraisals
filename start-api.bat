@echo off
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/competency
set PORT=5000
cd /d "%~dp0artifacts\api-server"
server.exe
