@echo off
set "DATABASE_URL=postgres://postgres@localhost:5432/competency?sslmode=disable"
set "PORT=5000"
cd /d "C:\Users\Anany's PC\Desktop\New folder\artifacts\api-server"
api-server.exe
