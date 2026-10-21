#!/bin/sh
# ============================================================
#  Tahfidzku — Supervisor WA Bridge
#
#  Menjalankan bridge (Baileys) dan menjaga tetap hidup:
#  proses yang mati (crash / koneksi putus) otomatis
#  dijalankan ulang dengan jeda singkat.
#
#  Jalankan:
#    cd wa-bridge && ./run.sh
#
#  Untuk berjalan di background tanpa terminal:
#    setsid nohup ./run.sh > /tmp/wa-bridge.log 2>&1 &
#
#  Environment (opsional):
#    WA_KEY     kunci API bridge (bila kosong, dibaca dari .env)
#    PORT       port bridge (default 3210)
# ============================================================
cd "$(dirname "$0")" || exit 1

# .env dibaca node sendiri, tapi diekspor di sini supaya restart
# memakai nilai yang sama persis.
if [ -f .env ]; then
  while IFS='=' read -r key value; do
    case "$key" in
      ''|\#*) continue ;;
      WA_KEY|PORT|WA_MIN_DELAY|WA_MAX_DELAY)
        export "$key=$value"
        ;;
    esac
  done < .env
fi

: "${PORT:=3210}"
: "${WA_KEY:=}"

if [ -z "$WA_KEY" ]; then
  echo "WA_KEY belum di-set. Isi wa-bridge/.env dulu." >&2
  exit 1
fi

echo "[supervisor] WA bridge dijalankan di :$PORT (pid $$)"

# stop(): matikan bridge yang dijalankan supervisor ini
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
  node index.js
  code=$?
  echo "[supervisor] bridge berhenti (kode $code), dijalankan ulang dalam 5 detik..."
  sleep 5
done
