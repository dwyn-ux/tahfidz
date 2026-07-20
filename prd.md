# Product Requirements Document (PRD)

# Tahfidzku

**Versi:** 1.0
**Platform:** Web Responsive (Desktop, Tablet, Mobile)
**Tema UI:** Modern Claymorphism + Soft Islamic Design

---

# 1. Executive Summary

Tahfidzku adalah aplikasi manajemen pembelajaran tahfidz Al-Qur'an yang dirancang untuk pondok pesantren, rumah tahfidz, maupun sekolah Islam.

Aplikasi memiliki tiga jenis pengguna:

* Admin
* Ustadz/Ustadzah
* Wali Santri

Fokus utama aplikasi adalah mempermudah pencatatan perkembangan hafalan secara harian, otomatis menghitung total hafalan santri, mempermudah monitoring wali, dan menyediakan laporan yang lengkap.

---

# 2. Tujuan Produk

## Untuk Admin

* Mengurangi pekerjaan administrasi
* Monitoring seluruh aktivitas halaqah
* Laporan otomatis
* Import data massal

## Untuk Ustadz

* Input perkembangan hanya beberapa klik
* Tidak perlu menghitung hafalan manual
* Absensi super cepat

## Untuk Wali

* Memantau perkembangan anak secara realtime
* Melihat catatan ustadz
* Mengetahui kehadiran

---

# 3. User Role

## 1. Admin

Hak akses penuh.

## 2. Ustadz

Mengelola pembelajaran.

## 3. Wali

Read Only.

---

# 4. Dashboard

## Admin Dashboard

Menampilkan:

* Jumlah Santri
* Jumlah Ustadz
* Jumlah Halaqah
* Jumlah Tahsin
* Jumlah Ziyadah
* Jumlah Mutqin

Grafik:

* Progress hafalan
* Kehadiran
* Santri aktif
* Ranking halaqah
* Aktivitas mingguan

Quick Action

* Tambah Santri
* Tambah Ustadz
* Tambah Halaqah
* Import Excel

---

## Dashboard Ustadz

Menampilkan

Hari ini:

* Halaqah yang diampu
* Jumlah hadir
* Jumlah izin
* Jumlah belum input

Shortcut

* Absensi
* Input Tahsin
* Input Ziyadah
* Input Mutqin

---

## Dashboard Wali

Menampilkan

* Progress hafalan anak
* Kehadiran bulan ini
* Catatan terakhir ustadz
* Grafik perkembangan

---

# 5. Modul Admin

---

## A. Setting Umum

Mengatur:

Nama Lembaga

Logo

Alamat

Tahun Ajaran

Semester

Standar Penilaian

Jam Belajar

Backup Database

Tema

---

## B. Manajemen Santri

Tambah Santri

Field

Nama

NIS

Jenis Kelamin

Tanggal Lahir

Alamat

No HP

Nama Wali

No HP Wali

Status

Level

* Tahsin
* Ziyadah
* Mutqin

Kelas

Halaqah

---

### Akun Wali Otomatis

Saat santri dibuat:

otomatis dibuat akun wali

Username:

```
nomor hp wali
```

atau

```
namawali
```

Password default

```
12345678
```

(Admin bisa mengubah format password default.)

---

### Bulk Import Santri

Import Excel

Template

| Nama | NIS | JK | Wali | HP Wali | Level | Halaqah |

Setelah upload:

otomatis

* membuat akun santri
* membuat akun wali
* validasi data
* preview
* import

---

## C. Manajemen Ustadz

Tambah

Edit

Hapus

Import Excel

Template

Nama

No HP

Email

Status

Halaqah

Password

---

## D. Manajemen Halaqah

CRUD

Field

Nama Halaqah

Ustadz

Level

Jumlah Santri

Hari

Jam

Ruangan

---

## E. Master Surat Al-Qur'an

Database:

114 Surat

Jumlah Ayat

Jumlah Halaman Standar Indonesia

Mapping Ayat → Halaman

Database ini menjadi dasar:

* Auto halaman
* Auto total hafalan
* Auto range

---

# 6. Modul Absensi

Default ketika membuka absensi

Semua santri

✔ Hadir

Ustadz tinggal mengganti

* Izin
* Sakit
* Alfa

Sehingga cukup klik yang berubah.

Status

🟢 Hadir

🟡 Izin

🔵 Sakit

🔴 Alfa

Sangat cepat.

---

# 7. Modul Pembelajaran

## Tahsin

Input

Tanggal

Halaman Awal

Halaman Akhir

Nilai

Catatan

Output

Progress Tahsin

Riwayat

---

## Ziyadah

Flow

### A.

Setoran Bacaan

Awal Surat

Awal Ayat

↓

Akhir Surat

Akhir Ayat

↓

Simpan

Baru muncul

### B.

Setoran Hafalan

Awal Surat

Awal Ayat

↓

Akhir Surat

Akhir Ayat

↓

Nilai

↓

Catatan

---

### Auto Fill

Saat membuka form

Awal Surat

langsung mengambil

akhir surat terakhir.

Contoh

Hari Senin

Al-Baqarah

ayat 45

Hari Selasa

otomatis muncul

Al-Baqarah

ayat 46

Tidak perlu mengetik ulang.

---

### Auto Hitung Hafalan

Menggunakan

Standar Mushaf Indonesia

Database

Jumlah halaman

Jumlah ayat

Jumlah juz

Hasil

Total Hafalan

misal

4 halaman

8 halaman

35 halaman

1,5 juz

dst.

Semua otomatis.

---

## Mutqin

Input

Murajaah

Awal Surat

Awal Ayat

Akhir Surat

Akhir Ayat

Nilai

Catatan

Total Hafalan Mutqin

diisi manual oleh ustadz.

---

# 8. Jenis Input Halaqah

## Mode 1

Halaqah Saya

Hanya santri yang diampu.

---

## Mode 2

Halaqah Umum

Bisa memilih seluruh santri.

Digunakan ketika

* ujian
* munaqosyah
* pengganti ustadz
* tasmi'

---

# 9. Riwayat Santri

Semua histori.

Tahsin

Ziyadah

Mutqin

Absensi

Catatan

Grafik

Ranking

---

# 10. Laporan

Filter

Tanggal

Periode

Halaqah

Ustadz

Santri

Level

Kelas

Status

---

Jenis Laporan

## Harian

Aktivitas hari ini.

## Mingguan

Progress mingguan.

## Bulanan

Grafik.

## Semester

Rekap.

## Tahunan

Rekap keseluruhan.

---

Laporan Halaqah

Jumlah Hafalan

Rata-rata Nilai

Absensi

Ranking

Keaktifan

---

Laporan Santri

Grafik perkembangan

Riwayat

Nilai

Absensi

Total Hafalan

Catatan

---

Laporan Ustadz

Jumlah Input

Jumlah Santri

Kinerja

Kehadiran

---

Export

Excel

PDF

Print

---

# 11. Panel Wali

Dashboard sederhana.

Menu

Dashboard

Perkembangan Hafalan

Absensi

Catatan Ustadz

Profil

---

Dashboard

Foto Anak

Level

Halaqah

Ustadz

Grafik Hafalan

Progress Bulanan

Persentase Kehadiran

---

Perkembangan

Tahsin

Halaman

Nilai

Catatan

---

Ziyadah

Setoran

Total Hafalan

Grafik

---

Mutqin

Murajaah

Nilai

Catatan

---

Absensi

Kalender

Hadir

Izin

Sakit

Alfa

---

Catatan

Semua catatan ustadz.

---

# 12. Notifikasi

Untuk Wali

* Anak tidak hadir
* Ada setoran baru
* Nilai baru
* Catatan baru

Untuk Ustadz

* Halaqah hari ini
* Belum mengisi laporan

Untuk Admin

* Belum ada laporan
* Import berhasil
* Backup database

---

# 13. UI/UX

## Style

Claymorphism Modern

Soft Shadow

Rounded XL

Glass Effect

Card besar

Minimalis

---

## Warna

Primary

Hijau Emerald

```
#16A34A
```

Secondary

Biru

```
#3B82F6
```

Accent

Cream

```
#F8F4E9
```

Background

```
#EEF3F0
```

Success

```
#22C55E
```

Warning

```
#FACC15
```

Danger

```
#EF4444
```

---

## Font

Poppins

Inter

Nunito

---

## Komponen

Clay Button

Clay Card

Clay Input

Clay Toggle

Floating Action Button

Rounded Table

Progress Circle

Modern Chart

Timeline Hafalan

Animated Statistics

---

# 14. Database (Entitas Utama)

* Users
* Roles
* Santri
* Wali
* Ustadz
* Halaqah
* Kelas
* Level Tahfidz
* Kehadiran
* Tahsin Records
* Ziyadah Bacaan
* Ziyadah Hafalan
* Mutqin Records
* Catatan
* Penilaian
* Surah
* Ayat
* Halaman Mushaf Indonesia
* Tahun Ajaran
* Semester
* Notifikasi
* Log Aktivitas

---

# 15. Fitur Unggulan

* Import massal santri & ustadz via Excel.
* Pembuatan akun wali otomatis dengan password default yang dapat dikustomisasi.
* Absensi super cepat dengan status **Hadir** sebagai default.
* Auto-fill setoran berikutnya berdasarkan setoran terakhir santri.
* Perhitungan total hafalan otomatis menggunakan referensi Mushaf Standar Indonesia.
* Dua mode input halaqah: **Halaqah Saya** dan **Halaqah Umum**.
* Dashboard analitik interaktif dengan grafik dan KPI.
* Laporan lengkap yang dapat difilter dan diekspor ke Excel maupun PDF.
* Antarmuka modern bertema **Claymorphism** yang nyaman digunakan di desktop maupun perangkat seluler.

Dokumen ini dapat dijadikan acuan langsung untuk proses desain UI/UX, penyusunan database, pembuatan API backend, hingga implementasi frontend aplikasi **Tahfidzku**. Dengan ruang lingkup tersebut, aplikasi sudah berada pada level **MVP+** dan siap dikembangkan menjadi sistem tahfidz profesional untuk sekolah atau pesantren berskala kecil hingga besar.

Itu justru menjadi keputusan arsitektur yang sangat penting. Saya menyarankan menambahkan satu bab khusus pada PRD yaitu **Technical Requirements & System Architecture** agar developer langsung mengetahui teknologi yang digunakan dan deployment yang diharapkan.

Berikut tambahan PRD-nya.

---

# 16. Technical Requirements

## Platform

Aplikasi **Tahfidzku** dibangun sebagai aplikasi **Web Responsive** yang dapat diakses melalui:

* Desktop
* Laptop
* Tablet
* Smartphone

Tanpa perlu instalasi aplikasi Android maupun iOS.

---

# 17. Tech Stack

## Frontend

* React + Vite
* TypeScript
* Tailwind CSS
* Shadcn UI
* Framer Motion
* ApexCharts / Chart.js

Alasan:

* Ringan
* Cepat
* Mudah maintenance
* Modern
* Responsive
* Mudah dikembangkan menjadi PWA

---

## Backend

Mengingat kebutuhan Anda adalah:

* Upload ke Github
* Clone di hosting
* Import database
* Edit `.env`
* Langsung jalan

maka stack yang paling cocok adalah:

### Laravel 12 (PHP 8.3+)

Karena hampir seluruh shared hosting Indonesia sudah mendukung:

* PHP
* Composer
* MySQL
* Apache/Nginx

Deployment sangat mudah.

Struktur:

```
Github

↓

git clone

↓

composer install

↓

copy .env

↓

php artisan key:generate

↓

import database

↓

php artisan migrate --seed (opsional)

↓

jalan
```

Laravel juga mempunyai security yang jauh lebih baik dibandingkan PHP native.

---

# 18. Database

MySQL / MariaDB

Minimal

MySQL 8

atau

MariaDB 10+

Menggunakan:

* Foreign Key
* Index
* UUID (untuk data sensitif)
* Soft Delete

---

# 19. Authentication

Menggunakan:

Laravel Authentication

Role Based Access Control (RBAC)

Role

* Admin
* Ustadz
* Wali

Session login aman.

---

# 20. Keamanan

Target keamanan tinggi.

## Password

Disimpan menggunakan

```
bcrypt
```

atau

```
Argon2id
```

Bukan MD5 ataupun SHA1.

---

## CSRF Protection

Semua Form

CSRF Token

aktif.

---

## XSS Protection

Semua input

disanitasi.

---

## SQL Injection

Seluruh query menggunakan

Laravel Eloquent ORM

atau Query Builder.

Tidak boleh menggunakan raw SQL kecuali benar-benar diperlukan.

---

## Rate Limit

Login

dibatasi misalnya:

```
5 kali gagal

↓

akun dikunci 10 menit
```

---

## Audit Log

Mencatat:

Login

Logout

Tambah data

Edit data

Hapus data

Import

Export

Reset Password

Semua aktivitas admin.

---

## HTTPS Ready

Support SSL

Tanpa konfigurasi tambahan.

---

## Backup

Menu Backup Database

Download SQL

Restore SQL

Hanya Admin.

---

## Environment

Konfigurasi melalui

```
.env
```

Contoh

```
APP_NAME=Tahfidzku

APP_ENV=production

APP_KEY=

APP_URL=

DB_HOST=

DB_DATABASE=

DB_USERNAME=

DB_PASSWORD=

MAIL_HOST=

MAIL_PORT=
```

Tidak ada konfigurasi yang di-hardcode.

---

# 21. Deployment

Target deployment sesederhana mungkin.

Flow

```
Developer

↓

Push Github

↓

Hosting

↓

Git Clone

↓

Composer Install

↓

Copy .env

↓

Generate APP_KEY

↓

Import Database

↓

Storage Link

↓

Jalan
```

Tidak memerlukan konfigurasi server yang rumit.

---

# 22. Struktur Folder

```
Tahfidzku/

app/

bootstrap/

config/

database/

public/

resources/

routes/

storage/

tests/

vendor/

.env.example

composer.json

artisan
```

Mengikuti standar Laravel sehingga mudah dipelihara.

---

# 23. Backup & Restore

Admin dapat:

* Backup Database
* Download Backup
* Restore Database
* Backup File Upload
* Jadwal Backup Otomatis (cron)

---

# 24. Performance

Target:

* Load Dashboard < 2 detik
* Input Absensi < 1 detik
* Input Hafalan < 1 detik
* Mendukung hingga ±20.000 santri
* Mendukung >100 pengguna aktif secara bersamaan pada VPS menengah

Menggunakan:

* Redis (opsional)
* Queue untuk proses berat
* Cache konfigurasi
* Cache route
* Lazy Loading pada tabel besar

---

# 25. Arsitektur Sistem

```
Browser
        │
        ▼
Frontend (React + Vite)
        │ REST API
        ▼
Laravel Backend
        │
 ┌──────┴──────────┐
 │                 │
MySQL         File Storage
 │                 │
Backup       Upload Dokumen
```

## Rekomendasi Arsitektur yang Lebih Praktis

Jika target utama adalah **hosting murah, instalasi sangat mudah, dan maintenance jangka panjang**, saya justru menyarankan sedikit mengubah stack menjadi:

* **Backend + Frontend:** Laravel 12 + Livewire 3 + Volt
* **UI:** Tailwind CSS + Shadcn UI (atau Flux UI)
* **Database:** MySQL/MariaDB

Alasannya:

* Satu repository (tidak perlu memisahkan React dan API).
* Tidak perlu build frontend yang kompleks di hosting shared.
* Cukup `git clone`, `composer install`, salin `.env`, import database, lalu aplikasi berjalan.
* Tetap terasa modern karena Livewire memberikan pengalaman interaktif seperti SPA.
* Lebih hemat resource server dan lebih mudah dipelihara oleh tim PHP.

Untuk aplikasi seperti **Tahfidzku** (CRUD, dashboard, grafik, laporan, import Excel, export PDF, autentikasi, dan monitoring), kombinasi **Laravel + Livewire** umumnya lebih efisien daripada memisahkan React dan backend API, kecuali memang ada rencana membuat aplikasi mobile native yang menggunakan API yang sama.
