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
require_once __DIR__ . '/normalized_store.php';

/** Sesi yang ikut dihitung dalam rekap absensi (sama dengan frontend). */
const WA_SESI_REKAP = ['Subuh', 'Ashar', 'Maghrib', 'Isya', 'Ta’lim Malam'];

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
        // Minggu yang sudah lewat penuh: Senin lalu sampai Minggu lalu.
        $senin = waTambahHari(waAwalMinggu($hariIni), -7);
        return [
            'dari' => $senin,
            'sampai' => waTambahHari($senin, 6),
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
        return ['dari' => $senin, 'sampai' => waTambahHari($senin, 6), 'judul' => $periode['judul'], 'kunci' => $senin];
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
        $hari[] = $cursor;
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

/** Susun pesan rekap. Formatnya sama dengan rekap yang tampil di aplikasi. */
function waPesanRekap(array $santri, array $rekap, array $periode, string $namaLembaga): string {
    $total = $rekap['total'];
    $bagian = ['Hadir ' . $total['Hadir'], 'Izin ' . $total['Izin'], 'Sakit ' . $total['Sakit']];
    if (!empty($total['Libur'])) $bagian[] = 'Libur ' . $total['Libur'];
    $bagian[] = 'Alfa ' . $total['Alfa'];

    $rentang = waFormatTanggal($periode['dari']);
    if ($periode['dari'] !== $periode['sampai']) $rentang .= ' - ' . waFormatTanggal($periode['sampai']);

    $pesan = '📋 ' . $periode['judul'] . ' ' . ($santri['nama'] ?? '-') . ' (' . $rentang . '): '
        . implode(', ', $bagian) . '.';
    if ($namaLembaga !== '') $pesan .= ' — ' . $namaLembaga;
    return $pesan;
}

/**
 * Nomor WhatsApp wali. Record wali lebih diutamakan karena wali bisa
 * memperbarui nomornya sendiri lewat halaman Profil;|No HP Santri| hanya
 * cadangan untuk data lama yang belum punya record wali.
 */
function waNomorWali(array $santri, array $waliRecords): string {
    $candidates = [];
    $waliId = (string)($santri['waliId'] ?? '');
    if ($waliId !== '') {
        foreach ($waliRecords as $wali) {
            if ((string)($wali['id'] ?? '') === $waliId) $candidates[] = $wali['noHp'] ?? '';
        }
    }
    if (!$candidates) {
        foreach ($waliRecords as $wali) {
            if ((string)($wali['santriId'] ?? '') === (string)($santri['id'] ?? '')) $candidates[] = $wali['noHp'] ?? '';
        }
    }
    $candidates[] = $santri['noHpWali'] ?? '';
    foreach ($candidates as $nomor) {
        $nomor = trim((string)$nomor);
        if ($nomor !== '') return $nomor;
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

    foreach (['harian', 'mingguan', 'bulanan'] as $trigger) {
        if (empty($flags[$trigger])) continue;

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
                    $pesan = waPesanRekap($row, $rekap, $periode, $namaLembaga);

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
