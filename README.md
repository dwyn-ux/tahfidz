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
- **Wali**: pantau progress hafalan & kehadiran anak, lihat notifikasi.
- **Perhitungan otomatis**: total hafalan (juz/halaman/ayat), rata-rata nilai, kehadiran bulanan,
  konversi ayat ↔ halaman ↔ juz berdasarkan data 114 surat Al-Qur'an.

---

## Cara Deploy ke Shared Hosting

1. **Siapkan database MySQL** di hosting (cPanel → MySQL Databases):
   - Buat database, mis. `tahfidzku`
   - Buat user dan berikan hak akses penuh ke database tersebut.

2. **Edit konfigurasi** `api/config.php`:
   ```php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'tahfidzku');   // ganti dengan nama DB Anda
   define('DB_USER', 'user_db');     // ganti dengan user DB
   define('DB_PASS', 'password_db'); // ganti dengan password DB
   define('APP_SECRET', 'GANTI_DENGAN_STRING_ACAK_PANJANG'); // wajib diubah!
   ```

3. **Upload semua file** ke `public_html` (atau subfolder) hosting Anda.

4. **Jalankan installer sekali saja** lewat browser:
   ```
   https://domain-anda.com/api/install.php
   ```
   Ini akan membuat tabel dan mengisi data demo.

5. **HAPUS `api/install.php`** setelah berhasil (untuk keamanan).

6. **Buka aplikasi**: `https://domain-anda.com/index.html`

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
  Password di-hash dengan `password_hash()`.
- **CORS**: saat ini `Access-Control-Allow-Origin: *`. Untuk produksi, batasi ke domain Anda
  di `api/config.php`.
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
