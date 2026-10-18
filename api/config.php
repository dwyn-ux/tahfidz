<?php
/**
 * Tahfidzku — Backend config & helpers (PHP + MySQL/PDO)
 * Shared hosting friendly: no composer, no build step.
 *
 * SETUP:
 *  1. Copy .env.example to .env and edit DB_* constants + APP_SECRET.
 *  2. Or edit the defaults below to match your hosting database.
 *  3. Upload everything, then open install.php once to create tables + seed.
 *  4. Delete install.php after first run (or keep it protected).
 */

// Errors go to the server log, never shown to users (display_errors leaks internals).
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/error.log');
error_reporting(E_ALL);

/* ---------------- .env loader (simple, no dependencies) ---------------- */
function loadEnvArr(): array {
    $env = [];
    $envFile = __DIR__ . '/.env';
    if (file_exists($envFile)) {
        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) return $env;
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') continue;
            if (strpos($line, '=') === false) continue;
            $parts = explode('=', $line, 2);
            if (count($parts) !== 2) continue;
            $value = trim($parts[1]);
            // Strip surrounding quotes (allows DB_PASS="x!y#z" style values)
            $vlen = strlen($value);
            if ($vlen >= 2 && (($value[0] === '"' && $value[$vlen - 1] === '"') || ($value[0] === "'" && $value[$vlen - 1] === "'"))) {
                $value = substr($value, 1, -1);
            }
            $env[trim($parts[0])] = $value;
        }
    }
    return $env;
}
$envVars = loadEnvArr();

define('DB_HOST', isset($envVars['DB_HOST']) ? $envVars['DB_HOST'] : 'localhost');
define('DB_NAME', isset($envVars['DB_NAME']) ? $envVars['DB_NAME'] : 'tahfidzku');
define('DB_USER', isset($envVars['DB_USER']) ? $envVars['DB_USER'] : 'root');
define('DB_PASS', isset($envVars['DB_PASS']) ? $envVars['DB_PASS'] : '');
define('DB_CHARSET', isset($envVars['DB_CHARSET']) ? $envVars['DB_CHARSET'] : 'utf8mb4');

// DB_DRIVER: 'mysql' (shared hosting) or 'sqlite' (local dev, no MySQL needed)
define('DB_DRIVER', isset($envVars['DB_DRIVER']) ? $envVars['DB_DRIVER'] : 'sqlite');
// SQLite file (used only when DB_DRIVER === 'sqlite')
define('DB_SQLITE_PATH', __DIR__ . '/tahfidzku.sqlite');

/* ---------------- APP_SECRET (HMAC signing key) ----------------
 * Loaded from .env. If not set, a random secret is generated and
 * persisted to .secret file. NEVER use the old hardcoded default. */
$secret = isset($envVars['APP_SECRET']) ? $envVars['APP_SECRET'] : '';
if (!$secret || strlen($secret) < 32) {
    $secretFile = __DIR__ . '/.secret';
    if (file_exists($secretFile)) {
        $secret = trim(@file_get_contents($secretFile));
    }
    if (!$secret || strlen($secret) < 32) {
        $secret = bin2hex(random_bytes(32));
        // If we can't persist the secret, it would rotate on every request and
        // invalidate every token (login appears broken). Fail loudly instead.
        if (@file_put_contents($secretFile, $secret, LOCK_EX) === false) {
            error_log('[tahfidzku] Gagal menulis ' . $secretFile . ' — set APP_SECRET di api/.env');
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(500);
            echo json_encode(['error' => 'Konfigurasi server salah: set APP_SECRET di api/.env (atau buat folder api/ dapat ditulis).'], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
}
define('APP_SECRET', $secret);

/* ---------------- CORS (configurable, restrict in production) ----------------
 * Set CORS_ALLOW_ORIGIN in .env to your domain, e.g. https://tahfidzku.com
 * Use comma-separated for multiple origins. Default: same-origin only. */
$allowedOrigins = array_filter(array_map('trim', explode(',', isset($envVars['CORS_ALLOW_ORIGIN']) ? $envVars['CORS_ALLOW_ORIGIN'] : '')));
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
// Only check CORS when Origin header is present (browser requests).
// CLI/curl requests don't have Origin and should always be allowed.
if ($origin !== '') {
    if (!empty($allowedOrigins) && in_array($origin, $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Vary: Origin');
    } elseif (!empty($allowedOrigins)) {
        // Origins configured but request origin not allowed — deny CORS
        http_response_code(403);
        echo json_encode(['error' => 'Origin not allowed'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
// If no origins configured, same-origin requests work without CORS headers.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
header('Content-Type: application/json; charset=utf-8');

/* ---------------- Security headers ---------------- */
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');
if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}

/* ---------------- PDO ---------------- */
function pdo(): PDO {
    static $p = null;
    if ($p === null) {
        if (DB_DRIVER === 'sqlite') {
            $p = new PDO('sqlite:' . DB_SQLITE_PATH, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            $p->exec('PRAGMA foreign_keys = OFF');
        } else {
            $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
            $p = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        }
    }
    return $p;
}

/* ---------------- Driver-aware SQL helpers ---------------- */
// Returns SQL that upserts a row by primary key `id`.
function upsertSQL($table, $cols) {
    $placeholders = implode(', ', array_fill(0, count($cols), '?'));
    if (DB_DRIVER === 'sqlite') {
        $updates = implode(', ', array_map(fn($c) => "$c = excluded.$c", $cols));
        return "INSERT INTO $table (" . implode(', ', $cols) . ") VALUES ($placeholders)
            ON CONFLICT(id) DO UPDATE SET $updates";
    }
    $updates = implode(', ', array_map(fn($c) => "$c = VALUES($c)", $cols));
    return "INSERT INTO $table (" . implode(', ', $cols) . ") VALUES ($placeholders)
        ON DUPLICATE KEY UPDATE $updates";
}
function insertIgnoreSQL($table, $cols) {
    $placeholders = implode(', ', array_fill(0, count($cols), '?'));
    if (DB_DRIVER === 'sqlite') {
        return "INSERT OR IGNORE INTO $table (" . implode(', ', $cols) . ") VALUES ($placeholders)";
    }
    return "INSERT IGNORE INTO $table (" . implode(', ', $cols) . ") VALUES ($placeholders)";
}

/* ---------------- JSON helpers ---------------- */
function send($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function err($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}
function body() {
    $raw = file_get_contents('php://input');
    if ($raw === '') return [];
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}
function uid($prefix = 'id') {
    return $prefix . '_' . bin2hex(random_bytes(5)) . substr(base_convert(time(), 10, 36), -4);
}
function nowISO() { return gmdate('Y-m-d\TH:i:s\Z'); }

/* ---------------- Rate limiting (file-based, no dependencies) ----------------
 * rateCheck: read-only, returns true if allowed.
 * rateLimit: increments counter, returns true if still allowed.
 * Count only FAILED logins so a legit user's successful attempts never lock them out. */
function rateCheck(string $key, int $max, int $windowSec): bool {
    $file = sys_get_temp_dir() . '/tahfidzku_rl_' . md5($key);
    if (file_exists($file)) {
        $decoded = json_decode(file_get_contents($file), true);
        if (is_array($decoded) && isset($decoded['reset']) && time() < $decoded['reset']) {
            return ($decoded['count'] ?? 0) < $max;
        }
    }
    return true;
}
function rateLimit(string $key, int $max, int $windowSec): bool {
    $file = sys_get_temp_dir() . '/tahfidzku_rl_' . md5($key);
    $now = time();
    $data = ['count' => 0, 'reset' => $now + $windowSec];
    if (file_exists($file)) {
        $raw = file_get_contents($file);
        $decoded = json_decode($raw, true);
        if (is_array($decoded) && isset($decoded['reset'])) {
            if ($now < $decoded['reset']) {
                $data = $decoded;
            }
        }
    }
    $data['count']++;
    file_put_contents($file, json_encode($data), LOCK_EX);
    return $data['count'] <= $max;
}

/* ---------------- Token (HMAC, stateless) ---------------- */
function b64url($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function b64url_decode($s) { return base64_decode(strtr($s, '-_', '+/')); }

function makeToken(array $u): string {
    $payload = [
        'uid' => $u['id'], 'role' => $u['role'], 'refId' => $u['refId'] ?? null,
        'exp' => time() + 60 * 60 * 24 * 7
    ];
    $b = b64url(json_encode($payload));
    return $b . '.' . hash_hmac('sha256', $b, APP_SECRET);
}
function parseToken($t) {
    if (!$t) return null;
    $parts = explode('.', $t);
    if (count($parts) !== 2) return null;
    [$b, $sig] = $parts;
    if (!hash_equals(hash_hmac('sha256', $b, APP_SECRET), $sig)) return null;
    $p = json_decode(b64url_decode($b), true);
    if (!$p || ($p['exp'] ?? 0) < time()) return null;
    return $p;
}
function authUser() {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    // Some Apache/PHP-FPM setups don't expose HTTP_AUTHORIZATION.
    // Fall back to getallheaders() (Apache/CLI) and REDIRECT_HTTP_AUTHORIZATION.
    if ($h === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $k => $v) {
            if (strcasecmp($k, 'Authorization') === 0) { $h = $v; break; }
        }
    }
    if ($h === '') $h = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (strpos($h, 'Bearer ') === 0) $t = substr($h, 7);
    else $t = null;
    return parseToken($t);
}
function requireAuth() {
    $u = authUser();
    if (!$u) err('Unauthorized', 401);
    return $u;
}
function requireRole($role) {
    $u = requireAuth();
    if ($u['role'] !== $role) err('Forbidden', 403);
    return $u;
}
function requireAdmin() {
    return requireRole('admin');
}

require_once __DIR__ . '/normalized_store.php';

/* ---------------- Record store ----------------
   Instalasi lama tetap memakai tabel `records` sampai migrate.php selesai.
   Sesudah itu, fungsi publik yang dipakai API ini otomatis mengarah ke tabel
   per-entitas; tabel legacy tidak dihapus dan tetap menjadi arsip rollback. */
function getRecords($type): array {
    if (NormalizedStore::isActive()) return NormalizedStore::getRecords($type);
    return legacyGetRecords($type);
}
function legacyGetRecords($type): array {
    $stmt = pdo()->prepare('SELECT id, data FROM records WHERE type = ?');
    $stmt->execute([$type]);
    $out = [];
    foreach ($stmt->fetchAll() as $r) {
        $obj = json_decode($r['data'], true);
        $obj['id'] = $r['id'];
        $out[] = $obj;
    }
    return $out;
}
function getRecord($type, $id) {
    if (NormalizedStore::isActive()) return NormalizedStore::getRecord($type, $id);
    return legacyGetRecord($type, $id);
}
function legacyGetRecord($type, $id) {
    $stmt = pdo()->prepare('SELECT data FROM records WHERE type = ? AND id = ?');
    $stmt->execute([$type, $id]);
    $r = $stmt->fetch();
    if (!$r) return null;
    $obj = json_decode($r['data'], true);
    $obj['id'] = $id;
    return $obj;
}
function putRecord($type, $id, $obj) {
    if (NormalizedStore::isActive()) {
        NormalizedStore::put($type, $id, $obj);
        return;
    }
    $data = json_encode($obj, JSON_UNESCAPED_UNICODE);
    $stmt = pdo()->prepare(upsertSQL('records', ['id', 'type', 'data']));
    $stmt->execute([$id, $type, $data]);
}
function delRecord($type, $id) {
    if (NormalizedStore::isActive()) {
        NormalizedStore::delete($type, $id);
        return;
    }
    $stmt = pdo()->prepare('DELETE FROM records WHERE type = ? AND id = ?');
    $stmt->execute([$type, $id]);
}

function resetApplicationRecords(): void {
    if (NormalizedStore::isActive()) {
        // Jangan menyentuh `records`: setelah migrasi tabel itu adalah arsip.
        NormalizedStore::clearCurrentRecords();
        return;
    }
    pdo()->exec('DELETE FROM records');
}

/* ---------------- Settings ---------------- */
function getSettings(): array {
    $stmt = pdo()->prepare('SELECT data FROM settings WHERE id = 1');
    $stmt->execute();
    $r = $stmt->fetch();
    return $r ? array_merge(defaultSettings(), json_decode($r['data'], true)) : defaultSettings();
}
function saveSettings(array $s) {
    $data = json_encode($s, JSON_UNESCAPED_UNICODE);
    $stmt = pdo()->prepare(upsertSQL('settings', ['id', 'data']));
    $stmt->execute([1, $data]);
}
function defaultSettings(): array {
    return [
        'namaLembaga' => 'Rumah Tahfidz Al-Hikmah',
        'alamat' => 'Jl. Pendidikan No. 10, Jakarta',
        'tahunAjaran' => '2025/2026',
        'semester' => 'Ganjil',
        'standarPenilaian' => 'A (90-100), B (80-89), C (70-79), D (<70)',
        'jamBelajar' => '07:00 - 09:00',
        'tema' => 'Claymorphism',
        'defaultPasswordFormat' => '12345678',
        'logo' => '',
        'setoranMulti' => false,
        'tingkat' => ['TPQ', 'SD', 'SMP', 'SMA'],
        'kelasPerTingkat' => [
            'TPQ' => ['1', '2', '3', '4', '5', '6'],
            'SD' => ['1', '2', '3', '4', '5', '6'],
            'SMP' => ['7', '8', '9'],
            'SMA' => ['10', '11', '12'],
        ],
        'talimMapel' => [],
        'talimMalam' => ['ustadzIds' => [], 'judulKitab' => '', 'bab' => ''],
        'notifActive' => true,
        'notifMaxPerDay' => 3,
        'notifWali' => true,
        'notifUstadz' => true,
        'notifAbsensiWali' => true,
        'notifAbsensiPeriode' => 'harian',
        'waBridgeUrl' => '', 'waBridgeKey' => '', 'waAuto' => false,
        'juzOrder' => [30,29,28,27,26,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],
        'kelas' => ['TK Al-Qur\'an', 'SD', 'SMP', 'SMA'],
        'levelTahfidz' => ['Tahsin', 'Ziyadah', 'Mutqin'],
        'tahunAjaranList' => ['2024/2025', '2025/2026', '2026/2027'],
        'semesterList' => ['Ganjil', 'Genap'],
    ];
}

/** Return settings with sensitive fields stripped for non-admin users. */
function publicSettings(array $s, string $role): array {
    if ($role === 'admin') return $s;
    // Non-admin: remove WhatsApp bridge credentials
    unset($s['waBridgeUrl'], $s['waBridgeKey']);
    return $s;
}

/* ---------------- Attendance summaries for guardians ---------------- */
/**
 * Satu halaqah boleh diampu beberapa ustadz sehingga satu sesi dapat memuat
 * lebih dari satu catatan untuk wali yang sama. Rekap memilih satu status
 * per sesi: catatan paling baru (`_created`), sehingga koreksi terakhir selalu
 * yang ditampilkan dan angka rekap tidak pernah dobel.
 */
function attendanceEffectiveRecords(array $records): array {
    $latest = [];
    foreach ($records as $record) {
        $key = implode('|', [
            $record['santriId'] ?? '',
            $record['tanggal'] ?? '',
            $record['sesi'] ?? 'Subuh',
        ]);
        $previous = $latest[$key] ?? null;
        if ($previous === null || ((int)($record['_created'] ?? 0)) >= ((int)($previous['_created'] ?? 0))) {
            $latest[$key] = $record;
        }
    }
    ksort($latest);
    return array_values($latest);
}

function attendancePeriodInfo(string $mode, string $date, string $halaqah = ''): array {
    $dt = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    if (!$dt) return [$date, $date];
    if ($mode === 'mingguan') {
        $start = $dt->modify('monday this week');
        $end = $start->modify('+6 days');
        return [$start->format('Y-m-d'), $start->format('d M') . ' - ' . $end->format('d M Y')];
    }
    if ($mode === 'bulanan') return [$dt->format('Y-m'), $dt->format('F Y')];
    if ($mode === 'halaqah') return [$date . '|' . $halaqah, $date];
    return [$date, $date];
}

function attendanceSummaryMessage(array $santri, array $records, string $mode, string $periodLabel, string $halaqah): string {
    $count = ['Hadir' => 0, 'Izin' => 0, 'Sakit' => 0, 'Alfa' => 0];
    foreach ($records as $record) {
        $status = $record['status'] ?? 'Hadir';
        if (isset($count[$status])) $count[$status]++;
    }
    $ringkas = 'Hadir ' . $count['Hadir'] . ', Izin ' . $count['Izin'] . ', Sakit ' . $count['Sakit'] . ', Alfa ' . $count['Alfa'];
    $judul = $mode === 'halaqah'
        ? 'Rekap absensi Halaqah ' . ($halaqah ?: '-')
        : 'Rekap absensi ' . $mode;
    return '📋 ' . $judul . ' ' . $santri['nama'] . ' (' . $periodLabel . '): ' . $ringkas . '.';
}

/**
 * Refresh one guardian notification per child and period. A deterministic ID
 * prevents duplicate notifications when staff correct an attendance record.
 */
function syncAttendanceWaliNotifications(): void {
    $settings = getSettings();
    if (empty($settings['notifActive']) || empty($settings['notifWali']) || empty($settings['notifAbsensiWali'])) return;
    $mode = $settings['notifAbsensiPeriode'] ?? 'harian';
    if (!in_array($mode, ['harian', 'halaqah', 'mingguan', 'bulanan'], true)) $mode = 'harian';

    $today = date('Y-m-d');
    $allAttendance = attendanceEffectiveRecords(getRecords('kehadiran'));
    $todayRecords = array_values(array_filter($allAttendance, fn($k) => ($k['tanggal'] ?? '') === $today));
    if (!$todayRecords) return;

    $santriById = [];
    foreach (getRecords('santri') as $santri) $santriById[$santri['id']] = $santri;
    $waliUsers = [];
    $stmt = pdo()->query("SELECT id, refId FROM users WHERE role = 'wali'");
    foreach ($stmt->fetchAll() as $user) $waliUsers[$user['refId']] = $user['id'];

    foreach ($todayRecords as $todayRecord) {
        $santriId = $todayRecord['santriId'] ?? '';
        $santri = $santriById[$santriId] ?? null;
        if (!$santri) continue;
        $waliUserId = $waliUsers[$santri['waliId'] ?? ''] ?? null;
        if (!$waliUserId) continue;

        $halaqah = $santri['halaqah'] ?? '';
        [$periodKey, $periodLabel] = attendancePeriodInfo($mode, $today, $halaqah);
        $records = array_values(array_filter($allAttendance, function ($record) use ($santriId, $mode, $periodKey, $halaqah) {
            if (($record['santriId'] ?? '') !== $santriId) return false;
            [$recordKey] = attendancePeriodInfo($mode, $record['tanggal'] ?? '', $halaqah);
            return $recordKey === $periodKey;
        }));
        if (!$records) continue;

        $message = attendanceSummaryMessage($santri, $records, $mode, $periodLabel, $halaqah);
        $id = 'abs_' . substr(sha1($santriId . '|' . $mode . '|' . $periodKey), 0, 24);
        $existing = getRecord('notifikasi', $id);
        $changed = !$existing || ($existing['pesan'] ?? '') !== $message;
        putRecord('notifikasi', $id, [
            'id' => $id,
            'userId' => $waliUserId,
            'tipe' => 'wali',
            'kategori' => 'absensi',
            'santriId' => $santriId,
            'periode' => $mode,
            'periodKey' => $periodKey,
            'pesan' => $message,
            'tanggal' => $existing['tanggal'] ?? date('c'),
            'updatedAt' => date('c'),
            'read' => $changed ? false : ($existing['read'] ?? false),
        ]);
    }
}

/* ---------------- Users ---------------- */
function getUserByUsername($username) {
    $stmt = pdo()->prepare('SELECT * FROM users WHERE username = ?');
    $stmt->execute([$username]);
    return $stmt->fetch();
}
function publicUser($u) {
    return ['id' => $u['id'], 'username' => $u['username'], 'role' => $u['role'], 'refId' => $u['refId']];
}

/* ---------------- Bootstrap (role-filtered data for current user) ---------------- */
function bootstrapData($user) {
    // Terapkan kolom/tabel baru (mis. absensi ustadz) sebelum data dibaca.
    NormalizedStore::ensureUpgrade();
    $settings = publicSettings(getSettings(), $user['role']);

    // Admin: return everything (same as before)
    if ($user['role'] === 'admin') {
        $db = [
            'settings' => $settings,
            'users' => [],
            'santri' => getRecords('santri'),
            'wali' => getRecords('wali'),
            'ustadz' => getRecords('ustadz'),
            'halaqah' => getRecords('halaqah'),
            'kelas' => getSettings()['kelas'],
            'levelTahfidz' => getSettings()['levelTahfidz'],
            'kehadiran' => getRecords('kehadiran'),
            'absensiUstadz' => getRecords('absensiUstadz'),
            'jurnalTalim' => getRecords('jurnalTalim'),
            'tahsin' => getRecords('tahsin'),
            'ziyadahBacaan' => getRecords('ziyadahBacaan'),
            'ziyadahHafalan' => getRecords('ziyadahHafalan'),
            'mutqin' => getRecords('mutqin'),
            'catatan' => getRecords('catatan'),
            'tahunAjaran' => getSettings()['tahunAjaranList'],
            'semester' => getSettings()['semesterList'],
            'notifikasi' => getRecords('notifikasi'),
            'logAktivitas' => getRecords('logAktivitas'),
            'logWa' => getRecords('logWa'),
        ];
        $stmt = pdo()->query('SELECT id, username, role, refId FROM users');
        $db['users'] = $stmt->fetchAll();
        return $db;
    }

    // Ustadz: return all data (needed for Halaqah Umum mode) but filtered settings
    if ($user['role'] === 'ustadz') {
        $db = [
            'settings' => $settings,
            'users' => [],
            'santri' => getRecords('santri'),
            'wali' => getRecords('wali'),
            'ustadz' => getRecords('ustadz'),
            'halaqah' => getRecords('halaqah'),
            'kelas' => getSettings()['kelas'],
            'levelTahfidz' => getSettings()['levelTahfidz'],
            'kehadiran' => getRecords('kehadiran'),
            'absensiUstadz' => getRecords('absensiUstadz'),
            'jurnalTalim' => getRecords('jurnalTalim'),
            'tahsin' => getRecords('tahsin'),
            'ziyadahBacaan' => getRecords('ziyadahBacaan'),
            'ziyadahHafalan' => getRecords('ziyadahHafalan'),
            'mutqin' => getRecords('mutqin'),
            'catatan' => getRecords('catatan'),
            'tahunAjaran' => getSettings()['tahunAjaranList'],
            'semester' => getSettings()['semesterList'],
            'notifikasi' => array_values(array_filter(getRecords('notifikasi'), fn($n) => $n['userId'] === $user['uid'])),
            'logAktivitas' => getRecords('logAktivitas'),
            'logWa' => getRecords('logWa'),
        ];
        // Ustadz sees only their own user account + admin accounts (for reference)
        $stmt = pdo()->query('SELECT id, username, role, refId FROM users');
        $allUsers = $stmt->fetchAll();
        $db['users'] = array_values(array_filter($allUsers, fn($u) => $u['id'] === $user['uid'] || $u['role'] === 'admin'));
        return $db;
    }

    // Wali: return ONLY their child's data (read-only, privacy-protected)
    $wali = $user['refId'] ? getRecord('wali', $user['refId']) : null;
    $santriId = $wali['santriId'] ?? null;

    $santri = getRecords('santri');
    $kehadiran = getRecords('kehadiran');
    $jurnalTalim = getRecords('jurnalTalim');
    $tahsin = getRecords('tahsin');
    $ziyadahBacaan = getRecords('ziyadahBacaan');
    $ziyadahHafalan = getRecords('ziyadahHafalan');
    $mutqin = getRecords('mutqin');
    $catatan = getRecords('catatan');
    $notifikasi = getRecords('notifikasi');

    if ($santriId) {
        $santri = array_values(array_filter($santri, fn($s) => $s['id'] === $santriId));
        $kehadiran = array_values(array_filter($kehadiran, fn($k) => $k['santriId'] === $santriId));
        $tahsin = array_values(array_filter($tahsin, fn($t) => $t['santriId'] === $santriId));
        $ziyadahBacaan = array_values(array_filter($ziyadahBacaan, fn($z) => $z['santriId'] === $santriId));
        $ziyadahHafalan = array_values(array_filter($ziyadahHafalan, fn($z) => $z['santriId'] === $santriId));
        $mutqin = array_values(array_filter($mutqin, fn($m) => $m['santriId'] === $santriId));
        $catatan = array_values(array_filter($catatan, fn($c) => $c['santriId'] === $santriId));
    } else {
        $santri = []; $kehadiran = []; $tahsin = []; $ziyadahBacaan = [];
        $ziyadahHafalan = []; $mutqin = []; $catatan = [];
    }

    // Wali sees only their own notifications
    $notifikasi = array_values(array_filter($notifikasi, fn($n) => $n['userId'] === $user['uid']));

    // Wali sees their own wali record + every ustadz who teaches one of their
    // child's active-program halaqah. Legacy data has one `level`/`halaqah`;
    // newer data can contain `programAktif` and `halaqahProgram`.
    $waliRecords = $wali ? [$wali] : [];
    $ustadzRecords = [];
    $ustadzIds = [];
    $halaqahForWali = [];
    if (!empty($santri)) {
        $halaqahRecords = getRecords('halaqah');
        $santriData = $santri[0];
        $references = [];
        if (!empty($santriData['halaqah'])) $references[] = $santriData['halaqah'];
        if (!empty($santriData['halaqahProgram']) && is_array($santriData['halaqahProgram'])) {
            foreach ($santriData['halaqahProgram'] as $reference) if ($reference) $references[] = $reference;
        }
        $references = array_values(array_unique($references));
        $halaqahForWali = array_values(array_filter($halaqahRecords, fn($h) =>
            in_array($h['id'] ?? '', $references, true) || in_array($h['nama'] ?? '', $references, true)
        ));
        $ustadzIds = [];
        $ustadzNames = [];
        foreach ($halaqahForWali as $halaqah) {
            $ids = $halaqah['ustadzIds'] ?? [];
            $names = $halaqah['ustadzNames'] ?? [];
            if (!is_array($ids)) $ids = [];
            if (!is_array($names)) $names = [];
            if (!$names && !empty($halaqah['ustadz'])) $names[] = $halaqah['ustadz'];
            $ustadzIds = array_merge($ustadzIds, $ids);
            $ustadzNames = array_merge($ustadzNames, $names);
        }
        $ustadzIds = array_values(array_unique($ustadzIds));
        $ustadzNames = array_values(array_unique($ustadzNames));
        $halaqahNames = array_map(fn($h) => $h['nama'] ?? '', $halaqahForWali);
        $allUstadz = getRecords('ustadz');
        $ustadzRecords = array_values(array_filter($allUstadz, fn($u) =>
            in_array($u['id'] ?? '', $ustadzIds, true)
            || in_array($u['nama'] ?? '', $ustadzNames, true)
            || in_array($u['halaqah'] ?? '', $halaqahNames, true)
        ));
    }

    // Wali hanya melihat absensi ustadz yang mengampu halaqah anaknya.
    $absensiUstadz = [];
    if ($ustadzIds) {
        $absensiUstadz = array_values(array_filter(getRecords('absensiUstadz'), fn($a) =>
            in_array($a['ustadzId'] ?? '', $ustadzIds, true)
        ));
    }

    $db = [
        'settings' => $settings,
        'users' => [['id' => $user['uid'], 'username' => '', 'role' => 'wali', 'refId' => $user['refId']]],
        'santri' => $santri,
        'wali' => $waliRecords,
        'ustadz' => $ustadzRecords,
        'halaqah' => $halaqahForWali,
        'kelas' => getSettings()['kelas'],
        'levelTahfidz' => getSettings()['levelTahfidz'],
        'kehadiran' => $kehadiran,
        'absensiUstadz' => $absensiUstadz,
        'jurnalTalim' => $jurnalTalim,
        'tahsin' => $tahsin,
        'ziyadahBacaan' => $ziyadahBacaan,
        'ziyadahHafalan' => $ziyadahHafalan,
        'mutqin' => $mutqin,
        'catatan' => $catatan,
        'tahunAjaran' => getSettings()['tahunAjaranList'],
        'semester' => getSettings()['semesterList'],
        'notifikasi' => $notifikasi,
        'logAktivitas' => [],
        'logWa' => [],
    ];
    return $db;
}
