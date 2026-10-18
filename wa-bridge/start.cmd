@echo off
REM Menjalankan WA Bridge Tahfidzku di foreground.
REM WA_KEY dan PORT dibaca dari .env (lihat wa-bridge/.env.example).
if not exist "%~dp0.env" (
  echo File .env belum ada. Salin .env.example menjadi .env lalu isi WA_KEY.
  exit /b 1
)
cd /d "%~dp0"
node index.js