<?php
/**
 * Tahfidzku — Installer. Run ONCE: https://yourdomain.com/api/install.php
 * Creates tables, seeds demo data, creates admin/ustadz/wali accounts.
 * DELETE THIS FILE after successful install for security.
 */
require_once __DIR__ . '/config.php';

try {
    $p = pdo();
    // tables (driver-aware DDL)
    if (DB_DRIVER === 'sqlite') {
        $p->exec("CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL, role TEXT NOT NULL, refId TEXT)");
        $p->exec("CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, data TEXT NOT NULL)");
        $p->exec("CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, type TEXT NOT NULL, data TEXT NOT NULL)");
        $p->exec("CREATE INDEX IF NOT EXISTS idx_type ON records(type)");
    } else {
        $p->exec("CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(40) PRIMARY KEY,
            username VARCHAR(60) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role ENUM('admin','ustadz','wali') NOT NULL,
            refId VARCHAR(40) NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $p->exec("CREATE TABLE IF NOT EXISTS settings (
            id INT PRIMARY KEY,
            data JSON NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $p->exec("CREATE TABLE IF NOT EXISTS records (
            id VARCHAR(40) PRIMARY KEY,
            type VARCHAR(40) NOT NULL,
            data JSON NOT NULL,
            INDEX idx_type (type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    // seed settings
    saveSettings(defaultSettings());

    // helper to insert a record
    $ins = function ($type, $obj) {
        $id = $obj['id'] ?? uid($type);
        $obj['id'] = $id;
        putRecord($type, $id, $obj);
        return $id;
    };

    // Ustadz
    $u1 = ['nama' => 'Ust. Ahmad Fauzi', 'noHp' => '0812000001', 'email' => 'ahmad@tahfidz.id', 'status' => 'Aktif', 'halaqah' => 'Halaqah 1'];
    $u2 = ['nama' => 'Ustz. Siti Aminah', 'noHp' => '0812000002', 'email' => 'siti@tahfidz.id', 'status' => 'Aktif', 'halaqah' => 'Halaqah 2'];
    $u1id = $ins('ustadz', $u1);
    $u2id = $ins('ustadz', $u2);

    // Halaqah
    $ins('halaqah', ['nama' => 'Halaqah 1', 'ustadz' => $u1['nama'], 'level' => 'Ziyadah', 'jumlahSantri' => 0, 'hari' => 'Senin-Rabu-Jumat', 'jam' => '07:00-08:30', 'ruangan' => 'Ruang A']);
    $ins('halaqah', ['nama' => 'Halaqah 2', 'ustadz' => $u2['nama'], 'level' => 'Tahsin', 'jumlahSantri' => 0, 'hari' => 'Selasa-Kamis-Sabtu', 'jam' => '07:00-08:30', 'ruangan' => 'Ruang B']);

    // Wali
    $w1 = ['nama' => 'Bpk. Budi', 'noHp' => '0812111111', 'santriId' => null];
    $w2 = ['nama' => 'Ibu. Dewi', 'noHp' => '0812222222', 'santriId' => null];
    $w1id = $ins('wali', $w1);
    $w2id = $ins('wali', $w2);

    // Santri
    $s1 = ['nama' => 'Muhammad Rizki', 'nis' => 'S001', 'jk' => 'L', 'tglLahir' => '2012-05-10', 'alamat' => 'Jl. Mawar 1', 'noHp' => '0812333333', 'namaWali' => $w1['nama'], 'noHpWali' => $w1['noHp'], 'status' => 'Aktif', 'level' => 'Ziyadah', 'kelas' => 'SD', 'halaqah' => 'Halaqah 1', 'waliId' => $w1id];
    $s2 = ['nama' => 'Aisyah Putri', 'nis' => 'S002', 'jk' => 'P', 'tglLahir' => '2013-02-20', 'alamat' => 'Jl. Melati 2', 'noHp' => '0812444444', 'namaWali' => $w2['nama'], 'noHpWali' => $w2['noHp'], 'status' => 'Aktif', 'level' => 'Tahsin', 'kelas' => 'SD', 'halaqah' => 'Halaqah 2', 'waliId' => $w2id];
    $s1id = $ins('santri', $s1);
    $s2id = $ins('santri', $s2);
    $w1['santriId'] = $s1id; $w2['santriId'] = $s2id;
    putRecord('wali', $w1id, $w1); putRecord('wali', $w2id, $w2);

    // sample records
    $t = date('Y-m-d');
    $ins('ziyadahHafalan', ['santriId' => $s1id, 'ustadzId' => $u1id, 'tanggal' => $t, 'sAwal' => 2, 'aAwal' => 1, 'sAkhir' => 2, 'aAkhir' => 45, 'nilai' => 90, 'catatan' => 'Lancar, perlu perhatian tajwid']);
    $ins('tahsin', ['santriId' => $s2id, 'ustadzId' => $u2id, 'tanggal' => $t, 'halAwal' => 1, 'halAkhir' => 3, 'nilai' => 85, 'catatan' => 'Perbaiki makharijul huruf']);
    $ins('kehadiran', ['santriId' => $s1id, 'halaqahId' => 'Halaqah 1', 'tanggal' => $t, 'status' => 'Hadir']);
    $ins('kehadiran', ['santriId' => $s2id, 'halaqahId' => 'Halaqah 2', 'tanggal' => $t, 'status' => 'Hadir']);
    $ins('catatan', ['santriId' => $s1id, 'ustadzId' => $u1id, 'tanggal' => $t, 'isi' => 'Semangat menghafal sangat baik.']);

    // users (password hashed)
    $def = defaultSettings()['defaultPasswordFormat'];
    $users = [
        ['id' => uid('usr'), 'username' => 'admin', 'password' => password_hash('admin123', PASSWORD_DEFAULT), 'role' => 'admin', 'refId' => null],
        ['id' => uid('usr'), 'username' => 'ustadz1', 'password' => password_hash('12345678', PASSWORD_DEFAULT), 'role' => 'ustadz', 'refId' => $u1id],
        ['id' => uid('usr'), 'username' => 'ustadz2', 'password' => password_hash('12345678', PASSWORD_DEFAULT), 'role' => 'ustadz', 'refId' => $u2id],
        ['id' => uid('usr'), 'username' => '0812111111', 'password' => password_hash($def, PASSWORD_DEFAULT), 'role' => 'wali', 'refId' => $w1id],
        ['id' => uid('usr'), 'username' => '0812222222', 'password' => password_hash($def, PASSWORD_DEFAULT), 'role' => 'wali', 'refId' => $w2id],
    ];
    $stmt = $p->prepare(insertIgnoreSQL('users', ['id', 'username', 'password', 'role', 'refId']));
    foreach ($users as $u) $stmt->execute([$u['id'], $u['username'], $u['password'], $u['role'], $u['refId']]);

    send(['ok' => true, 'msg' => 'Install selesai. HAPUS install.php sekarang.']);
} catch (Throwable $e) {
    err('Install gagal: ' . $e->getMessage(), 500);
}
