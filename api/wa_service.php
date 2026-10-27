<?php
/**
 * Tahfidzku — Layanan WhatsApp otomatis (server side).
 *
 * Semua logika penjadwalan rekap (harian/mingguan/bulanan) hidup di server
 * supaya:
 *  - bisa dipanggil cron tanpa browser yang terbuka,
 *  - penanda "sudah terkirim" tersimpan di database, sehingga aplikasi yang
 *    dibuka manual dan cron tidak mengirim pesan yang sama dua kali,
 *  - kredensial bridge tidak pernah keluar dari server.
 *
 * Pengiriman tetap antre di WA Bridge (delay 8-20 detik antar pesan), jadi
 * Anti-ban tetap terjaga meskipun semua pesan dikirim dalam satu permintaan.
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/normalized_store.php';

/** Sesi yang ikut dihitung dalam rekap absensi (sama dengan frontend). */
const WA_SESI_REKAP = ['Subuh', 'Ashar', 'Maghrib', 'Isya'];

/**
 * Normalisasi setelan pemicu. Setelan dari backup lama bisa berisi teks
 * ("false" bersifat truthy di PHP), jadi setiap nilai dibaca sebagai boolean.
 * Tanpa setelan tersimpan, perilaku lama (hanya setoran) tetap dipakai.
 */
function waTriggerFlags(array $settings): array {
    $raw = $settings['waAutoTrigger'] ?? [];
    if (!is_array($raw)) $raw = [];
    $aktif = function ($value) {
        return $value === true || $value === 1 || $value === '1' || $value === 'true';
    };
    $kosong = count($raw) === 0;
    return [
        'setoran' => $kosong ? true : $aktif($raw['setoran'] ?? false),
        'harian' => $aktif($raw['harian'] ?? false),
        'mingguan' => $aktif($raw['mingguan'] ?? false),
        'bulanan' => $aktif($raw['bulanan'] ?? false),
    ];
}

/**
 * Normalisasi opsi komponen informasi laporan ke wali.
 * Default semua komponen aktif (true).
 */
function waContentFlags(array $settings): array {
    $raw = $settings['waReportContent'] ?? [];
    if (!is_array($raw)) $raw = [];
    $aktif = function ($value, $default = true) {
        if ($value === null) return $default;
        return $value === true || $value === 1 || $value === '1' || $value === 'true';
    };
    return [
        'kehadiran' => isset($raw['kehadiran']) ? $aktif($raw['kehadiran']) : true,
        'rincianSesi' => isset($raw['rincianSesi']) ? $aktif($raw['rincianSesi']) : true,
        'hafalan' => isset($raw['hafalan']) ? $aktif($raw['hafalan']) : true,
        'nilai' => isset($raw['nilai']) ? $aktif($raw['nilai']) : true,
        'catatan' => isset($raw['catatan']) ? $aktif($raw['catatan']) : true,
    ];
}

/** Jam kirim (HH:MM) sebagai menit sejak tengah malam. Default 07:00. */
function waJamMenit(array $settings): int {
    $value = trim((string)($settings['waAutoJam'] ?? '07:00'));
    if (!preg_match('/^(\d{1,2}):(\d{2})$/', $value, $m)) return 7 * 60;
    return min(23, max(0, (int)$m[1])) * 60 + min(59, max(0, (int)$m[2]));
}

/** Tambah sejumlah hari pada tanggal YYYY-MM-DD. */
function waTambahHari(string $iso, int $jumlah): string {
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $iso);
    if (!$date) return $iso;
    return $date->modify(($jumlah >= 0 ? '+' : '-') . abs($jumlah) . ' days')->format('Y-m-d');
}

/** Tanggal pertama dan terakhir bulan sebelumnya. */
function waBulanLalu(string $iso): array {
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $iso);
    if (!$date) return [$iso, $iso];
    $awal = $date->modify('first day of last month');
    $akhir = $date->modify('last day of last month');
    return [$awal->format('Y-m-d'), $akhir->format('Y-m-d')];
}

/**
 * Awal minggu (Senin) dari tanggal yang diberikan.
 */
function waAwalMinggu(string $iso): string {
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $iso);
    if (!$date) return $iso;
    // 'monday this week' memakai awal minggu Senin, sama dengan kalender.
    return $date->modify('monday this week')->format('Y-m-d');
}

/**
 * Periode rekap yang SUDAH SELESAI untuk sebuah pemicu.
 * - harian: satu hari (kemarin)
 * - mingguan: satu minggu Senin-Minggu yang sudah lewat penuh
 * - bulanan: satu bulan kalender yang sudah lewat penuh
 *
 * Mingguan dan bulanan memakai periode yang tetap (bukan jendela geser),
 * supaya rekap untuk periode yang sama tidak berubah isinya tergantung hari
 * aplikasi dijalankan.
 */
function waPeriode(string $trigger, string $hariIni): ?array {
    $kemarin = waTambahHari($hariIni, -1);
    if ($trigger === 'harian') {
        return ['dari' => $kemarin, 'sampai' => $kemarin, 'judul' => 'Rekap absensi harian', 'kunci' => $kemarin];
    }
    if ($trigger === 'mingguan') {
        // Rekap mingguan dikirim di hari Sabtu untuk periode Senin–Jumat (Sabtu & Ahad libur setoran).
        $dt = DateTimeImmutable::createFromFormat('!Y-m-d', $hariIni); $dow = $dt ? (int)$dt->format('N') : 1; $senin = waTambahHari(waAwalMinggu($hariIni), $dow >= 6 ? 0 : -7);
        return [
            'dari' => $senin,
            'sampai' => waTambahHari($senin, 4), // Jumat
            'judul' => 'Rekap absensi mingguan',
            'kunci' => $senin,
        ];
    }
    if ($trigger === 'bulanan') {
        [$awal, $akhir] = waBulanLalu($hariIni);
        return ['dari' => $awal, 'sampai' => $akhir, 'judul' => 'Rekap absensi bulanan', 'kunci' => $awal];
    }
    return null;
}

/**
 * Periode SEBELUM sebuah periode (menyusul periode yang terlewat, misalnya
 * server mati pada hari Senin sehingga rekap minggu itu belum terkirim).
 */
function waPeriodeSebelumnya(string $trigger, array $periode): ?array {
    if ($trigger === 'harian') {
        $kemarin = waTambahHari($periode['dari'], -1);
        return ['dari' => $kemarin, 'sampai' => $kemarin, 'judul' => $periode['judul'], 'kunci' => $kemarin];
    }
    if ($trigger === 'mingguan') {
        $senin = waTambahHari($periode['dari'], -7);
        return ['dari' => $senin, 'sampai' => waTambahHari($senin, 4), 'judul' => $periode['judul'], 'kunci' => $senin]; // Jumat
    }
    if ($trigger === 'bulanan') {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $periode['dari']);
        if (!$date) return null;
        $awal = $date->modify('first day of last month');
        $akhir = $date->modify('last day of last month');
        return [
            'dari' => $awal->format('Y-m-d'),
            'sampai' => $akhir->format('Y-m-d'),
            'judul' => $periode['judul'],
            'kunci' => $awal->format('Y-m-d'),
        ];
    }
    return null;
}

/**
 * Kunci periode yang sudah pernah terkirim untuk sebuah pemicu, beserta
 * penanda tertua. Penanda tertua menjadi batas bawah: periode yang lebih
 * lama dari itu dianggap sudah ditangani, sehingga tidak ada rekap lama
 * yang menumpuk saat pemicu baru saja dinyalakan.
 */
function waPenandaTerkirim(string $trigger): array {
    $terkirim = [];
    foreach (getRecords('waAutoLog') as $row) {
        if (($row['trigger'] ?? '') !== $trigger) continue;
        $kunci = (string)($row['tanggal'] ?? '');
        if ($kunci === '') continue;
        $terkirim[$kunci] = true;
    }
    $kunci = array_keys($terkirim);
    sort($kunci);
    return ['terkirim' => $terkirim, 'tertua' => $kunci ? $kunci[0] : null];
}

/**
 * Rekap absensi satu Santri pada periode tertentu.
 * Dihitung server-side memakai aturan yang sama dengan rekap di aplikasi:
 * satu status per sesi (catatan terbaru), dan Alfa = slot sesi yang tidak
 * punya catatan sama sekali.
 */
function waRekapSantri(array $records, string $santriId, string $dari, string $sampai): array {
    $hari = [];
    $cursor = $dari;
    while ($cursor <= $sampai && count($hari) <= 366) {
        $dt = DateTimeImmutable::createFromFormat('!Y-m-d', $cursor); $dow = $dt ? (int)$dt->format('N') : 1;
        if ($dow >= 1 && $dow <= 5) { $hari[] = $cursor; } else { foreach ($records as $r) { if (($r['santriId'] ?? '') === $santriId && ($r['tanggal'] ?? '') === $cursor) { $hari[] = $cursor; break; } } }
        $cursor = waTambahHari($cursor, 1);
    }
    $total = ['Hadir' => 0, 'Izin' => 0, 'Sakit' => 0, 'Libur' => 0, 'Alfa' => 0];
    $perSesi = [];
    foreach (WA_SESI_REKAP as $sesi) $perSesi[$sesi] = ['Hadir' => 0, 'Izin' => 0, 'Sakit' => 0, 'Libur' => 0, 'Alfa' => 0];

    foreach ($records as $record) {
        if (($record['santriId'] ?? '') !== $santriId) continue;
        $tanggal = (string)($record['tanggal'] ?? '');
        if (!in_array($tanggal, $hari, true)) continue;
        $sesi = (string)($record['sesi'] ?? 'Subuh');
        if (!in_array($sesi, WA_SESI_REKAP, true)) continue;
        $status = (string)($record['status'] ?? 'Hadir');
        if (!isset($total[$status])) continue;
        $perSesi[$sesi][$status]++;
        $total[$status]++;
    }

    // Alfa dihitung dari slot yang kosong: hari x sesi - catatan yang ada.
    foreach (WA_SESI_REKAP as $sesi) {
        $tercatat = $perSesi[$sesi]['Hadir'] + $perSesi[$sesi]['Izin']
            + $perSesi[$sesi]['Sakit'] + $perSesi[$sesi]['Libur'];
        $perSesi[$sesi]['Alfa'] = max(0, count($hari) - $tercatat);
        $total['Alfa'] += $perSesi[$sesi]['Alfa'];
    }
    return ['total' => $total, 'perSesi' => $perSesi, 'hari' => $hari];
}

/** Format tanggal Indonesia (dd/mm/yyyy) untuk isi pesan. */
function waFormatTanggal(string $iso): string {
    $parts = explode('-', $iso);
    if (count($parts) !== 3) return $iso;
    return $parts[2] . '/' . $parts[1] . '/' . $parts[0];
}

/** Format tingkat dan kelas santri. */
function waSantriKelas(array $santri): string {
    $tingkat = trim((string)($santri['tingkat'] ?? ''));
    $kelas = trim((string)($santri['kelas'] ?? ''));
    if ($tingkat !== '' && $kelas !== '') return "$tingkat - Kelas $kelas";
    if ($kelas !== '') return "Kelas $kelas";
    if ($tingkat !== '') return $tingkat;
    return '-';
}

function waNamaHari(int $n): string {
    $hari = [1 => 'Senin', 2 => 'Selasa', 3 => 'Rabu', 4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu', 7 => 'Minggu'];
    return $hari[$n] ?? '';
}

function waNamaBulan(int $m): string {
    $bulan = [
        1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April', 5 => 'Mei', 6 => 'Juni',
        7 => 'Juli', 8 => 'Agustus', 9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember'
    ];
    return $bulan[$m] ?? '';
}

function waTglIndo(string $iso, bool $denganHari = false): string {
    $dt = DateTimeImmutable::createFromFormat('!Y-m-d', $iso);
    if (!$dt) return $iso;
    $d = (int)$dt->format('j');
    $m = waNamaBulan((int)$dt->format('n'));
    $y = $dt->format('Y');
    if ($denganHari) {
        $h = waNamaHari((int)$dt->format('N'));
        return "$h, $d $m $y";
    }
    return "$d $m $y";
}

function waSurahLatin(int $n): string {
    static $surahs = [
        1 => 'Al-Fatihah', 2 => 'Al-Baqarah', 3 => "Ali 'Imran", 4 => 'An-Nisa', 5 => "Al-Ma'idah",
        6 => "Al-An'am", 7 => "Al-A'raf", 8 => 'Al-Anfal', 9 => 'At-Tawbah', 10 => 'Yunus',
        11 => 'Hud', 12 => 'Yusuf', 13 => "Ar-Ra'd", 14 => 'Ibrahim', 15 => 'Al-Hijr',
        16 => 'An-Nahl', 17 => 'Al-Isra', 18 => 'Al-Kahf', 19 => 'Maryam', 20 => 'Ta-Ha',
        21 => 'Al-Anbiya', 22 => 'Al-Hajj', 23 => "Al-Mu'minun", 24 => 'An-Nur', 25 => 'Al-Furqan',
        26 => "Asy-Syu'ara", 27 => 'An-Naml', 28 => 'Al-Qasas', 29 => "Al-'Ankabut", 30 => 'Ar-Rum',
        31 => 'Luqman', 32 => 'As-Sajdah', 33 => 'Al-Ahzab', 34 => 'Saba', 35 => 'Fatir',
        36 => 'Ya-Sin', 37 => 'As-Saffat', 38 => 'Sad', 39 => 'Az-Zumar', 40 => 'Ghafir',
        41 => 'Fussilat', 42 => 'Asy-Syura', 43 => 'Az-Zukhruf', 44 => 'Ad-Dukhan', 45 => 'Al-Jasiyah',
        46 => 'Al-Ahqaf', 47 => 'Muhammad', 48 => 'Al-Fath', 49 => 'Al-Hujurat', 50 => 'Qaf',
        51 => 'Az-Zariyat', 52 => 'At-Tur', 53 => 'An-Najm', 54 => 'Al-Qamar', 55 => 'Ar-Rahman',
        56 => "Al-Waqi'ah", 57 => 'Al-Hadid', 58 => 'Al-Mujadilah', 59 => 'Al-Hasyr', 60 => 'Al-Mumtahanah',
        61 => 'As-Saff', 62 => "Al-Jumu'ah", 63 => 'Al-Munafiqun', 64 => 'At-Taghabun', 65 => 'At-Talaq',
        66 => 'At-Tahrim', 67 => 'Al-Mulk', 68 => 'Al-Qalam', 69 => 'Al-Haqqah', 70 => "Al-Ma'arij",
        71 => 'Nuh', 72 => 'Al-Jinn', 73 => 'Al-Muzzammil', 74 => 'Al-Muddassir', 75 => 'Al-Qiyamah',
        76 => 'Al-Insan', 77 => 'Al-Mursalat', 78 => "An-Naba'", 79 => "An-Nazi'at", 80 => "'Abasa",
        81 => 'At-Takwir', 82 => 'Al-Infitar', 83 => 'Al-Mutaffifin', 84 => 'Al-Insyiqaq', 85 => 'Al-Buruj',
        86 => 'At-Tariq', 87 => "Al-A'la", 88 => 'Al-Ghasyiyah', 89 => 'Al-Fajr', 90 => 'Al-Balad',
        91 => 'Asy-Syams', 92 => 'Al-Lail', 93 => 'Ad-Duha', 94 => 'Asy-Syarh', 95 => 'At-Tin',
        96 => "Al-'Alaq", 97 => 'Al-Qadr', 98 => 'Al-Bayyinah', 99 => 'Az-Zalzalah', 100 => "Al-'Adiyat",
        101 => "Al-Qari'ah", 102 => 'At-Takasur', 103 => "Al-'Asr", 104 => 'Al-Humazah', 105 => 'Al-Fil',
        106 => 'Quraisy', 107 => "Al-Ma'un", 108 => 'Al-Kausar', 109 => 'Al-Kafirun', 110 => 'An-Nasr',
        111 => 'Al-Lahab', 112 => 'Al-Ikhlas', 113 => 'Al-Falaq', 114 => 'An-Nas'
    ];
    return $surahs[$n] ?? ('Surat ' . $n);
}

/** Susun pesan rekap harian. */
function waFormatHarian(array $santri, array $rekap, array $periode, string $lembaga, array $flags = []): string {
    $nama = $santri['nama'] ?? '-';
    $kelas = waSantriKelas($santri);
    $tglStr = waTglIndo($periode['dari'], true);
    $waktuStr = date('H:i') . ' WIB';

    $perSesi = $rekap['perSesi'] ?? [];
    $lines = [];
    foreach (WA_SESI_REKAP as $sesi) {
        $st = 'Alfa';
        if (!empty($perSesi[$sesi]['Hadir'])) $st = 'Hadir';
        elseif (!empty($perSesi[$sesi]['Izin'])) $st = 'Izin';
        elseif (!empty($perSesi[$sesi]['Sakit'])) $st = 'Sakit';
        elseif (!empty($perSesi[$sesi]['Libur'])) $st = 'Libur';
        $sesiPad = str_pad($sesi, 13, ' ');
        $lines[] = "• {$sesiPad} : {$st}";
    }
    $rincianSesi = implode("\n", $lines);

    $tot = $rekap['total'] ?? [];
    $h = $tot['Hadir'] ?? 0;
    $i = $tot['Izin'] ?? 0;
    $s = $tot['Sakit'] ?? 0;
    $a = $tot['Alfa'] ?? 0;

    $showKehadiran = $flags['kehadiran'] ?? true;
    $showRincian = $flags['rincianSesi'] ?? true;
    $showCatatan = $flags['catatan'] ?? true;

    $bodyParts = [];
    if ($showRincian) {
        $bodyParts[] = "*Rincian Kehadiran Halaqah*\n{$rincianSesi}";
    }
    if ($showKehadiran) {
        $bodyParts[] = "*Ringkasan*\nHadir : {$h}  |  Izin : {$i}  |  Sakit : {$s}  |  Alfa : {$a}";
    }

    if ($showCatatan) {
        $sId = (string)($santri['id'] ?? '');
        $catatanRecords = getRecords('catatan');
        $catatanSantri = array_values(array_filter($catatanRecords, function($c) use ($sId, $periode) {
            if (($c['santriId'] ?? '') !== $sId) return false;
            return (string)($c['tanggal'] ?? '') === $periode['dari'];
        }));
        if (!empty($catatanSantri)) {
            $lastCat = end($catatanSantri);
            $isiCat = trim((string)($lastCat['isi'] ?? ''));
            if ($isiCat !== '') {
                $bodyParts[] = "*Catatan Ustadz*\n" . $isiCat;
            }
        }
    }

    $bodyStr = !empty($bodyParts) ? implode("\n\n", $bodyParts) . "\n\n" : "";

    return "*INFORMASI KEHADIRAN HARIAN SANTRI*\n"
        . "*{$lembaga}*\n\n"
        . "Nama     : {$nama}\n"
        . "Kelas     : {$kelas}\n"
        . "Hari/Tgl : {$tglStr}\n"
        . "Waktu     : {$waktuStr}\n\n"
        . $bodyStr
        . "Demikian Laporan Kehadiran Harian kami sampaikan semoga ananda senantiasa istiqomah dalam menuntut ilmu. Amiin";
}

/** Susun pesan rekap mingguan. */
function waFormatMingguan(array $santri, array $rekap, array $periode, string $lembaga, array $setoranRecords, array $flags = []): string {
    $nama = $santri['nama'] ?? '-';
    $kelas = waSantriKelas($santri);
    $dariStr = waTglIndo($periode['dari']);
    $sampaiStr = waTglIndo($periode['sampai']);
    $waktuStr = waNamaHari((int)date('N')) . ', ' . date('H:i') . ' WIB';

    $tot = $rekap['total'] ?? [];
    $h = $tot['Hadir'] ?? 0;
    $is = ($tot['Izin'] ?? 0) + ($tot['Sakit'] ?? 0);
    $a = $tot['Alfa'] ?? 0;
    $aktifSesi = $h + $is + $a;
    $pct = $aktifSesi > 0 ? round(($h / $aktifSesi) * 100) : 0;

    $sId = (string)($santri['id'] ?? '');
    $setoranPekan = array_values(array_filter($setoranRecords, function($z) use ($sId, $periode) {
        if (($z['santriId'] ?? '') !== $sId) return false;
        $tgl = (string)($z['tanggal'] ?? '');
        return $tgl >= $periode['dari'] && $tgl <= $periode['sampai'];
    }));

    usort($setoranPekan, function($a, $b) {
        $tA = (string)($a['tanggal'] ?? '');
        $tB = (string)($b['tanggal'] ?? '');
        if ($tA !== $tB) return strcmp($tA, $tB);
        $cA = (int)($a['_created'] ?? 0);
        $cB = (int)($b['_created'] ?? 0);
        if ($cA !== $cB) return $cA <=> $cB;
        return strcmp((string)($a['id'] ?? ''), (string)($b['id'] ?? ''));
    });

    $jmlSetor = count($setoranPekan);
    if ($jmlSetor > 0) {
        $frekStr = $jmlSetor . ' Kali';
        $totalNilai = 0;
        $validNilai = 0;
        $firstSetoran = $setoranPekan[0];
        $lastSetoran = end($setoranPekan);
        foreach ($setoranPekan as $item) {
            $val = (int)($item['nilai'] ?? 0);
            if ($val > 0) { $totalNilai += $val; $validNilai++; }
        }
        if ($validNilai > 0) {
            $avg = round($totalNilai / $validNilai);
            $ket = $avg >= 90 ? 'Amat Baik' : ($avg >= 80 ? 'Baik' : ($avg >= 70 ? 'Cukup' : 'Perlu Ditingkatkan'));
            $avgNilai = $avg . ' (' . $ket . ')';
        } else {
            $avgNilai = '-';
        }

        $sA = (int)($firstSetoran['sAwal'] ?? 2);
        $aA = (int)($firstSetoran['aAwal'] ?? 1);
        $posAwalStr = 'Surat ' . waSurahLatin($sA) . ' Ayat ' . $aA;

        $sK = (int)($lastSetoran['sAkhir'] ?? 2);
        $aK = (int)($lastSetoran['aAkhir'] ?? 1);
        $posAkhirStr = 'Surat ' . waSurahLatin($sK) . ' Ayat ' . $aK;
        $capaianStr = $jmlSetor . ' Setoran tercatat';
    } else {
        $frekStr = 'Belum ada setoran pekan ini';
        $capaianStr = '-';
        $posAwalStr = '-';
        $posAkhirStr = '-';
        $avgNilai = '-';
    }

    $showKehadiran = $flags['kehadiran'] ?? true;
    $showHafalan = $flags['hafalan'] ?? true;
    $showNilai = $flags['nilai'] ?? true;
    $showCatatan = $flags['catatan'] ?? true;

    $bodyParts = [];
    if ($showKehadiran) {
        $bodyParts[] = "*Laporan Kehadiran Halaqah*\n"
            . "Hadir           : {$h} Sesi\n"
            . "Izin / Sakit    : {$is} Sesi\n"
            . "Alfa            : {$a} Sesi\n"
            . "Kehadiran       : {$pct}%";
    }

    if ($showHafalan || $showNilai) {
        $hafalanLines = [];
        if ($showHafalan) {
            $hafalanLines[] = "Frekuensi Setor : {$frekStr}";
            $hafalanLines[] = "Capaian Pekan   : {$capaianStr}";
            $hafalanLines[] = "Posisi Awal : {$posAwalStr}";
            $hafalanLines[] = "Posisi Terakhir : {$posAkhirStr}";
        }
        if ($showNilai) {
            $hafalanLines[] = "Rata-rata Nilai : {$avgNilai}";
        }
        if (!empty($hafalanLines)) {
            $bodyParts[] = "*Capaian Tahfidz Pekan Ini*\n" . implode("\n", $hafalanLines);
        }
    }

    if ($showCatatan) {
        $sId = (string)($santri['id'] ?? '');
        $catatanRecords = getRecords('catatan');
        $catatanSantri = array_values(array_filter($catatanRecords, function($c) use ($sId, $periode) {
            if (($c['santriId'] ?? '') !== $sId) return false;
            $tgl = (string)($c['tanggal'] ?? '');
            return $tgl >= $periode['dari'] && $tgl <= $periode['sampai'];
        }));
        if (!empty($catatanSantri)) {
            $lastCat = end($catatanSantri);
            $isiCat = trim((string)($lastCat['isi'] ?? ''));
            if ($isiCat !== '') {
                $bodyParts[] = "*Catatan Ustadz*\n" . $isiCat;
            }
        }
    }

    $bodyStr = !empty($bodyParts) ? implode("\n\n", $bodyParts) . "\n\n" : "";

    return "*INFORMASI REKAPITULASI MINGGUAN SANTRI*\n"
        . "*{$lembaga}*\n\n"
        . "Nama     : {$nama}\n"
        . "Kelas     : {$kelas}\n"
        . "Periode  : {$dariStr} – {$sampaiStr}\n"
        . "Waktu     : {$waktuStr}\n\n"
        . $bodyStr
        . "Demikian Laporan Mingguan kami sampaikan sebagai bahan evaluasi bersama dalam mendampingi ananda. Amiin";
}

/** Susun pesan rekap bulanan. */
function waFormatBulanan(array $santri, array $rekap, array $periode, string $lembaga, array $setoranRecords, array $flags = []): string {
    $nama = $santri['nama'] ?? '-';
    $kelas = waSantriKelas($santri);
    $dtAwal = DateTimeImmutable::createFromFormat('!Y-m-d', $periode['dari']);
    $bulanStr = $dtAwal ? (waNamaBulan((int)$dtAwal->format('n')) . ' ' . $dtAwal->format('Y')) : $periode['dari'];

    $tot = $rekap['total'] ?? [];
    $h = $tot['Hadir'] ?? 0;
    $is = ($tot['Izin'] ?? 0) + ($tot['Sakit'] ?? 0);
    $a = $tot['Alfa'] ?? 0;
    $totalSesi = $h + $is + $a + ($tot['Libur'] ?? 0);
    $aktifSesi = $h + $is + $a;
    $pct = $aktifSesi > 0 ? round(($h / $aktifSesi) * 100) : 0;

    $sId = (string)($santri['id'] ?? '');
    $setoranBulan = array_values(array_filter($setoranRecords, function($z) use ($sId, $periode) {
        if (($z['santriId'] ?? '') !== $sId) return false;
        $tgl = (string)($z['tanggal'] ?? '');
        return $tgl >= $periode['dari'] && $tgl <= $periode['sampai'];
    }));

    usort($setoranBulan, function($a, $b) {
        $tA = (string)($a['tanggal'] ?? '');
        $tB = (string)($b['tanggal'] ?? '');
        if ($tA !== $tB) return strcmp($tA, $tB);
        $cA = (int)($a['_created'] ?? 0);
        $cB = (int)($b['_created'] ?? 0);
        if ($cA !== $cB) return $cA <=> $cB;
        return strcmp((string)($a['id'] ?? ''), (string)($b['id'] ?? ''));
    });

    $jmlSetor = count($setoranBulan);
    if ($jmlSetor > 0) {
        $totalNilai = 0;
        $validNilai = 0;
        $firstSetoran = $setoranBulan[0];
        $lastSetoran = end($setoranBulan);
        foreach ($setoranBulan as $item) {
            $val = (int)($item['nilai'] ?? 0);
            if ($val > 0) { $totalNilai += $val; $validNilai++; }
        }
        if ($validNilai > 0) {
            $avg = round($totalNilai / $validNilai);
            $ket = $avg >= 90 ? 'Amat Baik' : ($avg >= 80 ? 'Baik' : ($avg >= 70 ? 'Cukup' : 'Perlu Ditingkatkan'));
            $avgNilai = $avg . ' (' . $ket . ')';
        } else {
            $avgNilai = '-';
        }

        $sA = (int)($firstSetoran['sAwal'] ?? 2);
        $aA = (int)($firstSetoran['aAwal'] ?? 1);
        $posAwalStr = 'Surat ' . waSurahLatin($sA) . ' Ayat ' . $aA;

        $sK = (int)($lastSetoran['sAkhir'] ?? 2);
        $aK = (int)($lastSetoran['aAkhir'] ?? 1);
        $posAkhirStr = 'Surat ' . waSurahLatin($sK) . ' Ayat ' . $aK;
        $hafalanBaruStr = $jmlSetor . ' Kali Setoran';
    } else {
        $hafalanBaruStr = '-';
        $posAwalStr = '-';
        $posAkhirStr = '-';
        $avgNilai = '-';
    }

    $semuaSetoran = array_values(array_filter($setoranRecords, function($z) use ($sId, $periode) {
        if (($z['santriId'] ?? '') !== $sId) return false;
        return (string)($z['tanggal'] ?? '') <= $periode['sampai'];
    }));
    $totalAkumulasi = count($semuaSetoran) . ' Kali Setoran';

    $showKehadiran = $flags['kehadiran'] ?? true;
    $showHafalan = $flags['hafalan'] ?? true;
    $showNilai = $flags['nilai'] ?? true;
    $showCatatan = $flags['catatan'] ?? true;

    $bodyParts = [];
    if ($showKehadiran) {
        $bodyParts[] = "*Laporan Kehadiran Halaqah*\n"
            . "Total Sesi      : {$totalSesi} Sesi\n"
            . "Hadir           : {$h} Sesi\n"
            . "Izin / Sakit    : {$is} Sesi\n"
            . "Alfa            : {$a} Sesi\n"
            . "Persentase      : {$pct}%";
    }

    if ($showHafalan || $showNilai) {
        $hafalanLines = [];
        if ($showHafalan) {
            $hafalanLines[] = "Setoran Bulan Ini : {$hafalanBaruStr}";
            $hafalanLines[] = "Posisi Awal       : {$posAwalStr}";
            $hafalanLines[] = "Posisi Terakhir   : {$posAkhirStr}";
            $hafalanLines[] = "Total Akumulasi   : {$totalAkumulasi}";
        }
        if ($showNilai) {
            $hafalanLines[] = "Rata-rata Nilai   : {$avgNilai}";
        }
        if (!empty($hafalanLines)) {
            $bodyParts[] = "*Laporan Capaian Tahfidz*\n" . implode("\n", $hafalanLines);
        }
    }

    if ($showCatatan) {
        $sId = (string)($santri['id'] ?? '');
        $catatanRecords = getRecords('catatan');
        $catatanSantri = array_values(array_filter($catatanRecords, function($c) use ($sId, $periode) {
            if (($c['santriId'] ?? '') !== $sId) return false;
            $tgl = (string)($c['tanggal'] ?? '');
            return $tgl >= $periode['dari'] && $tgl <= $periode['sampai'];
        }));
        if (!empty($catatanSantri)) {
            $lastCat = end($catatanSantri);
            $isiCat = trim((string)($lastCat['isi'] ?? ''));
            if ($isiCat !== '') {
                $bodyParts[] = "*Catatan Ustadz*\n" . $isiCat;
            }
        }
    }

    $bodyStr = !empty($bodyParts) ? implode("\n\n", $bodyParts) . "\n\n" : "";

    return "*INFORMASI EVALUASI BULANAN SANTRI*\n"
        . "*{$lembaga}*\n\n"
        . "Nama     : {$nama}\n"
        . "Kelas     : {$kelas}\n"
        . "Bulan    : {$bulanStr}\n\n"
        . $bodyStr
        . "Demikian Laporan Bulanan kami sampaikan semoga menjadi amal jariyah dan investasi akhirat keluarga kelak. Amiin";
}

/** Susun pesan rekap. Format disesuaikan dengan jenis pemicu (harian, mingguan, bulanan). */
function waPesanRekap(array $santri, array $rekap, array $periode, string $namaLembaga, string $trigger = 'harian', array $setoranRecords = [], array $flags = []): string {
    $lembaga = trim($namaLembaga) !== '' ? strtoupper(trim($namaLembaga)) : 'PONDOK PESANTREN ASH-SHIDDIQ';
    if ($trigger === 'harian') {
        return waFormatHarian($santri, $rekap, $periode, $lembaga, $flags);
    }
    if ($trigger === 'mingguan') {
        return waFormatMingguan($santri, $rekap, $periode, $lembaga, $setoranRecords, $flags);
    }
    if ($trigger === 'bulanan') {
        return waFormatBulanan($santri, $rekap, $periode, $lembaga, $setoranRecords, $flags);
    }
    return waFormatHarian($santri, $rekap, $periode, $lembaga, $flags);
}

/**
 * Nomor WhatsApp wali. Record wali lebih diutamakan karena wali bisa
 * memperbarui nomornya sendiri lewat halaman Profil;|No HP Santri| hanya
 * cadangan untuk data lama yang belum punya record wali.
 */
function waBersihkanNomor(string $p): string {
    $str = trim($p);
    if ($str === '') return '';
    // Ambil nomor pertama jika ada pemisah / , ; atau baris baru
    if (preg_match('/[\/;,|\n]/', $str)) {
        $parts = preg_split('/[\/;,|\n]/', $str);
        $str = trim($parts[0] ?? '');
    }
    // Hapus catatan dalam tanda kurung
    $str = trim((string)preg_replace('/\([^)]*\)/', '', $str));
    // Bersihkan karakter selain angka dan plus
    $n = (string)preg_replace('/[^\d+]/', '', $str);
    if (str_starts_with($n, '+')) $n = substr($n, 1);
    $n = (string)preg_replace('/\D/', '', $n);
    if ($n === '') return '';
    if (str_starts_with($n, '0')) $n = '62' . substr($n, 1);
    elseif (str_starts_with($n, '8')) $n = '62' . $n;
    elseif (str_starts_with($n, '620')) $n = '62' . substr($n, 3);
    return $n;
}

function waNomorWali(array $santri, array $waliRecords): string {
    $candidates = [];
    $waliId = trim((string)($santri['waliId'] ?? ''));
    if ($waliId !== '') {
        foreach ($waliRecords as $wali) {
            $wId = trim((string)($wali['id'] ?? ''));
            if ($wId !== '' && $wId === $waliId) {
                $hp = trim((string)($wali['noHp'] ?? ''));
                if ($hp !== '') $candidates[] = $hp;
            }
        }
    }
    if (!$candidates) {
        $sId = trim((string)($santri['id'] ?? ''));
        if ($sId !== '') {
            foreach ($waliRecords as $wali) {
                $wSantriId = trim((string)($wali['santriId'] ?? ''));
                if ($wSantriId !== '' && $wSantriId === $sId) {
                    $hp = trim((string)($wali['noHp'] ?? ''));
                    if ($hp !== '') $candidates[] = $hp;
                }
            }
        }
    }
    $hpSantri = trim((string)($santri['noHpWali'] ?? ''));
    if ($hpSantri !== '') $candidates[] = $hpSantri;
    foreach ($candidates as $nomor) {
        $cleaned = waBersihkanNomor((string)$nomor);
        if ($cleaned !== '') return $cleaned;
    }
    return '';
}

/** Catat hasil pengiriman ke log WA (terlihat di Settings → Log WhatsApp). */
function waCatatLog(string $to, string $status, string $detail, string $message = ''): void {
    putRecord('logWa', uid('wa'), [
        'to' => $to,
        'status' => $status,
        'detail' => mb_substr($detail, 0, 200),
        'message' => mb_substr($message, 0, 150),
        'tanggal' => date('c'),
    ]);
}

/**
 * Jalankan rekap terjadwal sesuai setelan. Dipakai oleh cron
 * (api/index.php?action=wa_auto_reminder) maupun saat aplikasi dibuka.
 *
 * Penanda "sudah terkirim" disimpan di tabel wa_auto_log dengan id
 * per pemicu-per-hari, jadi pemicu yang sama tidak dikirim dua kali walau
 * cron dan aplikasi sama-sama memanggil.
 */
function waJalankanReminder(?DateTimeImmutable $now = null): array {
    $now = $now ?: new DateTimeImmutable('now');
    $settings = getSettings();
    $contentFlags = waContentFlags($settings);

    $hasil = [
        'ok' => true,
        'detail' => '',
        'terkirim' => 0,
        'gagal' => 0,
        'pemicu' => [],
    ];

    if (!waAutoEnabled($settings)) {
        $hasil['ok'] = false;
        $hasil['detail'] = 'WhatsApp Otomatis sedang nonaktif.';
        return $hasil;
    }
    $url = rtrim((string)($settings['waBridgeUrl'] ?? ''), '/');
    $key = (string)($settings['waBridgeKey'] ?? '');
    if ($url === '' || $key === '') {
        $hasil['ok'] = false;
        $hasil['detail'] = 'WA bridge belum diatur (Settings → WhatsApp).';
        return $hasil;
    }

    $menitSekarang = ((int)$now->format('H')) * 60 + (int)$now->format('i');
    if ($menitSekarang < waJamMenit($settings)) {
        $hasil['detail'] = 'Belum sampai jam kirim.';
        return $hasil;
    }

    $flags = waTriggerFlags($settings);
    $hariIni = $now->format('Y-m-d');
    $santri = getRecords('santri');
    $waliRecords = getRecords('wali');
    $kehadiran = attendanceEffectiveRecords(getRecords('kehadiran'));
    $namaLembaga = (string)($settings['namaLembaga'] ?? '');
    $setoranRecords = getRecords('ziyadahHafalan');

    foreach (['harian', 'mingguan', 'bulanan'] as $trigger) {
        if (empty($flags[$trigger])) continue;
        if ($trigger === 'mingguan' && (int)$now->format('N') < 6) continue; // Rekap mingguan dikirim di hari Sabtu

        // Penanda memakai kunci PERIODE, bukan per hari: rekap untuk periode
        // yang sama hanya dikirim sekali, berapa kali pun cron atau aplikasi
        // memanggil. sekaligus membuat periode yang terlewat (mis. server
        // mati pada hari Senin) tetap dikirim saat server hidup kembali.
        $periode = waPeriode($trigger, $hariIni);
        if (!$periode) continue;

        $penanda = waPenandaTerkirim($trigger);
        $terkirimTrigger = 0;
        $gagalTrigger = 0;

        // Periode tertua yang sudah pernah terkirim menjadi batas bawah.
        // Bila pemicu baru dinyalakan (belum ada penanda), hanya periode
        // terakhir yang dikirim supaya tidak ada badai rekap menumpuk.
        $batasBawah = $penanda['tertua'];
        if ($batasBawah === null) {
            $sebelumnya = waPeriodeSebelumnya($trigger, $periode);
            $batasBawah = $sebelumnya ? $sebelumnya['kunci'] : $periode['kunci'];
        }

        // Batasi jumlah periode yang menyusul dalam satu pemanggilan supaya
        // server yang lama mati tidak mengirim rekap menumpuk.
        $maksPeriode = $trigger === 'harian' ? 7 : 3;
        for ($i = 0; $i < $maksPeriode; $i++) {
            // Jangan kirim periode yang belum selesai (mis. hari ini).
            if ($periode['sampai'] >= $hariIni) break;
            // Sudah melewati batas bawah: periode lama sudah tertangani.
            if ($periode['kunci'] <= $batasBawah) break;

            $markerId = 'wal_' . $trigger . '_' . $periode['kunci'];
            $sudahDikirim = isset($penanda['terkirim'][$periode['kunci']]);

            $jumlah = 0;
            $gagal = 0;
            if (!$sudahDikirim) {
                foreach ($santri as $row) {
                    if (($row['status'] ?? '') === 'Nonaktif') continue;
                    $nomor = waNomorWali($row, $waliRecords);
                    if ($nomor === '') continue;

                    $rekap = waRekapSantri($kehadiran, (string)($row['id'] ?? ''), $periode['dari'], $periode['sampai']);
                    $pesan = waPesanRekap($row, $rekap, $periode, $namaLembaga, $trigger, $setoranRecords, $contentFlags);

                    $r = waBridgeCall($url, $key, '/send', json_encode(['to' => $nomor, 'message' => $pesan]));
                    if ($r['ok']) {
                        $jumlah++;
                        waCatatLog($nomor, 'queued', 'Pesan masuk antrian bridge.', $pesan);
                    } else {
                        $gagal++;
                        waCatatLog($nomor, 'error', $r['detail'] ?: ('HTTP ' . $r['status']), $pesan);
                    }
                }

                if ($gagal > 0) {
                    // Jangan tandai sudah terkirim supaya bisa dicoba lagi nanti.
                    $hasil['pemicu'][$trigger] = $gagal . ' gagal';
                    $hasil['gagal'] += $gagal;
                    $gagalTrigger += $gagal;
                    break;
                }
                putRecord('waAutoLog', $markerId, [
                    'trigger' => $trigger,
                    'tanggal' => $periode['kunci'],
                    'jumlah' => $jumlah,
                    'waktu' => date('c'),
                ]);
                $penanda['terkirim'][$periode['kunci']] = true;
            }

            $terkirimTrigger += $jumlah;
            $hasil['terkirim'] += $jumlah;

            $sebelumnya = waPeriodeSebelumnya($trigger, $periode);
            if (!$sebelumnya || $sebelumnya['kunci'] >= $periode['kunci']) break;
            $periode = $sebelumnya;
        }

        if ($gagalTrigger === 0) {
            $hasil['pemicu'][$trigger] = $terkirimTrigger . ' pesan';
        }
    }

    if ($hasil['terkirim'] === 0 && $hasil['detail'] === '') {
        $hasil['detail'] = 'Tidak ada rekap baru yang perlu dikirim.';
    }
    return $hasil;
}

/**
 * Dapatkan periode untuk rekap uji coba / tes.
 */
function waResolveTestPeriode(string $trigger, ?string $preset = null, ?string $customDari = null, ?string $customSampai = null): array {
    $today = date('Y-m-d');
    $kemarin = waTambahHari($today, -1);

    if ($customDari && $customSampai) {
        return [
            'dari' => $customDari,
            'sampai' => $customSampai,
            'judul' => 'Rekap absensi ' . $trigger,
            'kunci' => $customDari
        ];
    }

    if ($trigger === 'harian') {
        $tgl = ($preset === 'today') ? $today : $kemarin;
        return [
            'dari' => $tgl,
            'sampai' => $tgl,
            'judul' => 'Rekap absensi harian',
            'kunci' => $tgl
        ];
    }

    if ($trigger === 'mingguan') {
        $offset = ($preset === 'this_week') ? 0 : -7;
        $senin = waTambahHari(waAwalMinggu($today), $offset);
        return [
            'dari' => $senin,
            'sampai' => waTambahHari($senin, 4), // Senin - Jumat
            'judul' => 'Rekap absensi mingguan',
            'kunci' => $senin
        ];
    }

    if ($trigger === 'bulanan') {
        if ($preset === 'this_month') {
            $dt = new DateTimeImmutable('now');
            $awal = $dt->modify('first day of this month')->format('Y-m-d');
            $akhir = $dt->modify('last day of this month')->format('Y-m-d');
            return [
                'dari' => $awal,
                'sampai' => $akhir,
                'judul' => 'Rekap absensi bulanan',
                'kunci' => $awal
            ];
        } else {
            [$awal, $akhir] = waBulanLalu($today);
            return [
                'dari' => $awal,
                'sampai' => $akhir,
                'judul' => 'Rekap absensi bulanan',
                'kunci' => $awal
            ];
        }
    }

    return waPeriode($trigger, $today) ?: ['dari' => $today, 'sampai' => $today, 'judul' => 'Rekap', 'kunci' => $today];
}

/**
 * Pratinjau pesan rekap (harian, mingguan, bulanan) untuk satu santri tertentu.
 */
function waPreviewRekap(array $input): array {
    $trigger = (string)($input['trigger'] ?? 'harian');
    if (!in_array($trigger, ['harian', 'mingguan', 'bulanan'], true)) {
        $trigger = 'harian';
    }
    $santriId = (string)($input['santriId'] ?? '');
    $preset = (string)($input['preset'] ?? '');
    $customDari = !empty($input['dari']) ? (string)$input['dari'] : null;
    $customSampai = !empty($input['sampai']) ? (string)$input['sampai'] : null;

    $periode = waResolveTestPeriode($trigger, $preset, $customDari, $customSampai);

    $santriList = getRecords('santri');
    $santri = null;
    if ($santriId !== '') {
        foreach ($santriList as $s) {
            if ((string)($s['id'] ?? '') === $santriId) {
                $santri = $s;
                break;
            }
        }
    }
    if (!$santri && count($santriList) > 0) {
        $santri = $santriList[0];
    }
    if (!$santri) {
        return ['ok' => false, 'detail' => 'Data santri tidak ditemukan.'];
    }

    $settings = getSettings();
    $namaLembaga = (string)($settings['namaLembaga'] ?? '');
    $waliRecords = getRecords('wali');
    $kehadiran = attendanceEffectiveRecords(getRecords('kehadiran'));
    $setoranRecords = getRecords('ziyadahHafalan');

    $nomorWali = waNomorWali($santri, $waliRecords);
    $rekap = waRekapSantri($kehadiran, (string)($santri['id'] ?? ''), $periode['dari'], $periode['sampai']);
    $contentFlags = waContentFlags($settings);
    if (!empty($input['contentFlags']) && is_array($input['contentFlags'])) {
        $contentFlags = array_merge($contentFlags, $input['contentFlags']);
    }
    $pesan = waPesanRekap($santri, $rekap, $periode, $namaLembaga, $trigger, $setoranRecords, $contentFlags);

    return [
        'ok' => true,
        'trigger' => $trigger,
        'periode' => $periode,
        'santri' => [
            'id' => $santri['id'] ?? '',
            'nama' => $santri['nama'] ?? '',
            'kelas' => waSantriKelas($santri),
            'nomorWali' => $nomorWali
        ],
        'pesan' => $pesan
    ];
}

/**
 * Kirim pesan uji coba rekap (harian, mingguan, bulanan) untuk daftar santri yang dipilih.
 * Tidak mencatat ke waAutoLog agar jadwal otomatis resmi tidak terpengaruh.
 */
function waKirimTestRekap(array $input): array {
    $trigger = (string)($input['trigger'] ?? 'harian');
    if (!in_array($trigger, ['harian', 'mingguan', 'bulanan'], true)) {
        $trigger = 'harian';
    }
    $santriIds = (array)($input['santriIds'] ?? []);
    if (empty($santriIds)) {
        return ['ok' => false, 'detail' => 'Pilih minimal satu santri untuk diuji.'];
    }

    $preset = (string)($input['preset'] ?? '');
    $customDari = !empty($input['dari']) ? (string)$input['dari'] : null;
    $customSampai = !empty($input['sampai']) ? (string)$input['sampai'] : null;
    $overridePhone = trim((string)($input['overridePhone'] ?? ''));

    $periode = waResolveTestPeriode($trigger, $preset, $customDari, $customSampai);

    $settings = getSettings();
    $contentFlags = waContentFlags($settings);
    if (!empty($input['contentFlags']) && is_array($input['contentFlags'])) {
        $contentFlags = array_merge($contentFlags, $input['contentFlags']);
    }
    $url = rtrim((string)($settings['waBridgeUrl'] ?? ''), '/');
    $key = (string)($settings['waBridgeKey'] ?? '');
    if ($url === '' || $key === '') {
        return ['ok' => false, 'detail' => 'WA bridge belum diatur (Settings → WhatsApp).'];
    }

    $santriList = getRecords('santri');
    $santriMap = [];
    foreach ($santriList as $s) {
        $santriMap[(string)($s['id'] ?? '')] = $s;
    }

    $waliRecords = getRecords('wali');
    $kehadiran = attendanceEffectiveRecords(getRecords('kehadiran'));
    $namaLembaga = (string)($settings['namaLembaga'] ?? '');
    $setoranRecords = getRecords('ziyadahHafalan');

    $terkirim = 0;
    $gagal = 0;
    $detailList = [];

    foreach ($santriIds as $sId) {
        $sId = (string)$sId;
        if (!isset($santriMap[$sId])) continue;
        $santri = $santriMap[$sId];

        $targetPhone = $overridePhone !== '' ? $overridePhone : waNomorWali($santri, $waliRecords);
        if ($targetPhone === '') {
            $gagal++;
            $detailList[] = ($santri['nama'] ?? $sId) . ': nomor wali tidak ada';
            continue;
        }

        $rekap = waRekapSantri($kehadiran, $sId, $periode['dari'], $periode['sampai']);
        $pesan = waPesanRekap($santri, $rekap, $periode, $namaLembaga, $trigger, $setoranRecords, $contentFlags);

        if ($overridePhone !== '') {
            $pesan = "*[PESAN UJI COBA REKAP " . strtoupper($trigger) . "]*\n"
                   . "Santri: " . ($santri['nama'] ?? '-') . " (" . waSantriKelas($santri) . ")\n"
                   . "Nomor Asli Wali: " . (waNomorWali($santri, $waliRecords) ?: '(tidak ada)') . "\n\n"
                   . $pesan;
        }

        $r = waBridgeCall($url, $key, '/send', json_encode(['to' => $targetPhone, 'message' => $pesan]));
        if ($r['ok']) {
            $terkirim++;
            waCatatLog($targetPhone, 'queued', 'Tes Rekap ' . ucfirst($trigger) . ' untuk ' . ($santri['nama'] ?? $sId), $pesan);
        } else {
            $gagal++;
            $detailList[] = ($santri['nama'] ?? $sId) . ': ' . ($r['detail'] ?: 'HTTP ' . $r['status']);
            waCatatLog($targetPhone, 'error', 'Gagal tes ' . ($santri['nama'] ?? $sId) . ': ' . ($r['detail'] ?: ('HTTP ' . $r['status'])), $pesan);
        }
    }

    return [
        'ok' => $terkirim > 0 || $gagal === 0,
        'terkirim' => $terkirim,
        'gagal' => $gagal,
        'periode' => $periode,
        'detail' => $detailList ? implode(', ', $detailList) : ($terkirim . ' pesan masuk antrian bridge.')
    ];
}
