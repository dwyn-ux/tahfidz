# Tahfidzku — Aplikasi Manajemen Tahfidz Al-Qur'an

Aplikasi web untuk mengelola pembelajaran tahfidz (hafalan) Al-Qur'an:
pendataan santri, pencatatan ziyadah & tahsin, kehadiran, penilaian,
dan laporan untuk Admin, Ustadz, dan Wali santri.

**Stack:** Frontend vanilla HTML/CSS/JS (tanpa build step) + Backend PHP + MySQL (PDO).
Sangat mudah di-deploy di shared hosting.

---

## Fitur (sesuai PRD)

- **Admin**: dashboard, manajemen santri/ustadz/wali/halaqah, pengaturan lembaga, reset data.
- **Ustadz**: input ziyadah hafalan, tahsin, kehadiran, catatan, rekap per santri.
- **Wali**: pantau progress hafalan & kehadiran anak, lihat notifikasi, edit profil & ganti password.
- **Perhitungan otomatis**: total hafalan (juz/halaman/ayat), rata-rata nilai, kehadiran bulanan,
  konversi ayat ↔ halaman ↔ juz berdasarkan data 114 surat Al-Qur'an.
- **WhatsApp otomatis**: laporan capaian (tahsin/ziyadah/mutqin) terkirim otomatis ke WhatsApp wali
  via WA Bridge (sesi WA admin, aman dari banned dengan delay antar pesan).

---

## WA Bridge (Laporan WhatsApp ke Wali)

Aplikasi bisa mengirim laporan capaian hafalan otomatis ke WhatsApp wali lewat
sesi WhatsApp admin (bukan nomor wali). Bridge berjalan sebagai service Node.js
terpisah; aplikasi PHP/JS tinggal POST pesan ke bridge.

**Cara pasang di server yang punya Node.js:**

```bash
cd wa-bridge
npm install
export WA_KEY=$(openssl rand -hex 16)   # WAJIB di-set, nilai acak
npm start                 # default port 3210
```

**Scan QR sekali (sesi admin):** buka `http://SERVER:3210/qr` di browser,
scan dengan WhatsApp Web (multi-device) di HP admin. Sesi tersimpan di
`wa-bridge/session/`, tidak perlu scan ulang.

**Endpoint bridge:**
| Method | Path      | Fungsi |
|--------|-----------|--------|
| GET    | `/status` | status koneksi WA |
| GET    | `/qr`     | QR PNG untuk scan |
| POST   | `/send`   | kirim pesan `{to: "628xxx", message}` |

Pesan antri dengan delay acak 6–12 detik antar pesan (anti-banned).
Bisa diubah lewat env `WA_MIN_DELAY` / `WA_MAX_DELAY`.

**Hubungkan ke aplikasi:** Admin → Settings → *WhatsApp Otomatis* → isi URL bridge
(`https://wa.example.com:3210`), Key bridge, lalu Cek Status & Kirim Tes.
Laporan tahsin/ziyadah/mutqin otomatis terkirim ke `noHpWali` saat setoran disimpan.

> Keamanan: pasang reverse-proxy dengan HTTPS + jangan ekspos port bridge ke publik
> tanpa proteksi (pakai `X-WA-Key` dan batasi akses).

---

## Cara Deploy ke Shared Hosting

1. **Siapkan database MySQL** di hosting (cPanel → MySQL Databases):
   - Buat database, mis. `tahfidzku`
   - Buat user dan berikan hak akses penuh ke database tersebut.

2. **Edit konfigurasi** `api/.env` (copy dari `api/.env.example`):
   ```bash
   DB_DRIVER=mysql
   DB_HOST=localhost
   DB_NAME=tahfidzku            # ganti dengan nama DB Anda
   DB_USER=user_db              # ganti dengan user DB
   DB_PASS=password_db          # ganti dengan password DB
   APP_SECRET=<string acak >= 32 karakter>   # WAJIB diisi, contoh: php -r "echo bin2hex(random_bytes(32));"
   CORS_ALLOW_ORIGIN=https://domain-anda.com
   INSTALL_TOKEN=<string acak>  # dipakai sekali untuk menjalankan installer
   ADMIN_PASSWORD=<password admin awal>
   ```

3. **Upload semua file** ke `public_html` (atau subfolder) hosting Anda.

4. **Jalankan installer sekali saja** lewat browser:
   ```
   https://domain-anda.com/api/install.php?token=ISI_INSTALL_TOKEN
   ```
   Ini akan membuat tabel dan mengisi data demo, lalu menghapus `install.php` otomatis.

5. **HAPUS `api/install.php`** jika masih ada (untuk keamanan).

6. **Buka aplikasi**: `https://domain-anda.com/index.html`

> File `api/.htaccess` ikut ter-upload dan akan melindungi `api/.env`, `api/.secret`,
> dan file database dari akses web, serta meneruskan header `Authorization`
> (diperlukan untuk login di PHP-FPM/FastCGI).

---

## Demo Login

| Role   | Username    | Password   |
|--------|-------------|------------|
| Admin  | `admin`     | `admin123` |
| Ustadz | `ustadz1`   | `12345678` |
| Wali   | `0812111111`| `12345678` |

> Password default wali = nomor HP wali (sesuai `defaultPasswordFormat` di settings).

---

## Struktur Folder

```
tahfidzku/
├── index.html              # Entry point frontend
├── assets/
│   ├── css/style.css       # Tema Claymorphism Islami
│   └── js/
│       ├── surah.js        # Data 114 surat + kalkulasi hafalan
│       ├── store.js        # State + komunikasi API (fetch ke api/index.php)
│       ├── ui.js           # Komponen UI & helper render
│       ├── auth.js         # Login & sesi (JWT stateless)
│       ├── views_shared.js # Dashboard & layout bersama
│       ├── views_admin.js  # Modul admin
│       ├── views_ustadz.js # Modul ustadz
│       ├── views_wali.js   # Modul wali
│       └── app.js          # Router & bootstrap
└── api/
    ├── config.php          # Koneksi DB + helper (EDIT DI SINI)
    ├── index.php           # REST API (login, bootstrap, records, save, settings)
    └── install.php         # Installer DB (HAPUS setelah dipakai)
```

---

## Catatan Teknis

- **Penyimpanan**: tabel generik `records` (id, type, data JSON) untuk semua entitas,
  tabel `users` untuk autentikasi, dan `settings` untuk konfigurasi lembaga.
  Model ini memetakan 1:1 ke struktur data frontend sehingga migrasi dari localStorage mulus.
- **Autentikasi**: token HMAC-SHA256 (gaya JWT) di header `Authorization: Bearer`.
  Password di-hash dengan `password_hash()`. Kunci token dari `APP_SECRET` di `.env`
  (jika kosong, otomatis dibuat dan disimpan di `api/.secret`; folder `api/` harus bisa ditulis).
- **CORS**: konfigurasi lewat `CORS_ALLOW_ORIGIN` di `api/.env` (daftar origin, pisah koma).
  Kosongkan untuk same-origin only (rekomendasi).
- **Backup**: cukup ekspor database MySQL secara berkala.

---

## Pengembangan Lokal (tanpa MySQL)

Backend mendukung dua driver lewat konstanta `DB_DRIVER` di `api/config.php`:

- `'sqlite'` (default) — tidak perlu MySQL, cukup PHP. Database disimpan di
  `api/tahfidzku.sqlite`. Cocok untuk testing lokal.
- `'mysql'` — untuk production di shared hosting (lihat cara deploy di atas).

```bash
# 1. Pastikan DB_DRIVER = 'sqlite' di api/config.php (sudah default)
# 2. Seed database (buat tabel + data demo) sekali saja:
php api/install.php

# 3. Jalankan server PHP bawaan dari root project:
php -S localhost:8080

# 4. Buka di browser:
#    http://localhost:8080/index.html
```

> File `api/tahfidzku.sqlite` akan otomatis dibuat saat pertama kali diakses.
> Hapus file tersebut lalu jalankan `php api/install.php` lagi untuk reset data demo.
