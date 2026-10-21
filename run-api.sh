#!/bin/sh
# ============================================================
#  Tahfidzku — Supervisor Server API (PHP built-in server)
#
#  Server bawaan PHP untuk pengembangan/penggunaan lokal.
#  Dijalankan ulang otomatis kalau prosesnya berhenti.
#
#  Jalankan:
#    ./run-api.sh
#
#  Untuk background:
#    setsid nohup ./run-api.sh > /tmp/tahfidz-api.log 2>&1 &
#
#  Environment (opsional):
#    API_HOST  alamat bind (default 0.0.0.0 agar bisa dibuka dari HP)
#    API_PORT  port (default 8000)
#    API_ROOT  folder aplikasi (default folder script ini)
# ============================================================
cd "$(dirname "$0")" || exit 1

: "${API_HOST:=0.0.0.0}"
: "${API_PORT:=8000}"
: "${API_ROOT:=$(pwd)}"

echo "[supervisor] API PHP dijalankan di http://$API_HOST:$API_PORT (pid $$)"

stop() {
  trap - TERM INT
  if [ -n "$child" ]; then
    kill "$child" 2>/dev/null
    wait "$child" 2>/dev/null
  fi
  exit 0
}
trap stop TERM INT

while true; do
  php -S "$API_HOST:$API_PORT" -t "$API_ROOT"
  code=$?
  echo "[supervisor] API berhenti (kode $code), dijalankan ulang dalam 5 detik..."
  sleep 5
done
