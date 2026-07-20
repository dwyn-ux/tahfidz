<?php
/**
 * Tahfidzku — Backend config & helpers (PHP + MySQL/PDO)
 * Shared hosting friendly: no composer, no build step.
 *
 * SETUP:
 *  1. Edit DB_* constants below to match your hosting database.
 *  2. Change APP_SECRET to a random string.
 *  3. Upload everything, then open install.php once to create tables + seed.
 *  4. Delete install.php after first run (or keep it protected).
 */

define('DB_HOST', 'localhost');
define('DB_NAME', 'tahfidzku');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

// DB_DRIVER: 'mysql' (shared hosting) or 'sqlite' (local dev, no MySQL needed)
define('DB_DRIVER', 'sqlite');
// SQLite file (used only when DB_DRIVER === 'sqlite')
define('DB_SQLITE_PATH', __DIR__ . '/tahfidzku.sqlite');

// IMPORTANT: change this to a long random string in production!
define('APP_SECRET', 'tahfidzku-secret-change-in-production-1234567890');

/* ---------------- CORS (restrict in production) ---------------- */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
header('Content-Type: application/json; charset=utf-8');

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
    if (strpos($h, 'Bearer ') === 0) $t = substr($h, 7);
    else $t = null;
    return parseToken($t);
}
function requireAuth() {
    $u = authUser();
    if (!$u) err('Unauthorized', 401);
    return $u;
}

/* ---------------- Generic record store ----------------
   All entities live in `records` (type, id, data JSON) except
   `users` (auth) and `settings` (single row). This maps 1:1 to
   the JS `db` object so the frontend barely changes.            */
function getRecords($type): array {
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
    $stmt = pdo()->prepare('SELECT data FROM records WHERE type = ? AND id = ?');
    $stmt->execute([$type, $id]);
    $r = $stmt->fetch();
    if (!$r) return null;
    $obj = json_decode($r['data'], true);
    $obj['id'] = $id;
    return $obj;
}
function putRecord($type, $id, $obj) {
    $data = json_encode($obj, JSON_UNESCAPED_UNICODE);
    $stmt = pdo()->prepare(upsertSQL('records', ['id', 'type', 'data']));
    $stmt->execute([$id, $type, $data]);
}
function delRecord($type, $id) {
    $stmt = pdo()->prepare('DELETE FROM records WHERE type = ? AND id = ?');
    $stmt->execute([$type, $id]);
}

/* ---------------- Settings ---------------- */
function getSettings(): array {
    $stmt = pdo()->prepare('SELECT data FROM settings WHERE id = 1');
    $stmt->execute();
    $r = $stmt->fetch();
    return $r ? json_decode($r['data'], true) : defaultSettings();
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
        'kelas' => ['TK Al-Qur\'an', 'SD', 'SMP', 'SMA'],
        'levelTahfidz' => ['Tahsin', 'Ziyadah', 'Mutqin'],
        'tahunAjaranList' => ['2024/2025', '2025/2026', '2026/2027'],
        'semesterList' => ['Ganjil', 'Genap'],
    ];
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

/* ---------------- Bootstrap (all data for current user) ---------------- */
function bootstrapData($user) {
    $db = [
        'settings' => getSettings(),
        'users' => [], // filled below (without passwords)
        'santri' => getRecords('santri'),
        'wali' => getRecords('wali'),
        'ustadz' => getRecords('ustadz'),
        'halaqah' => getRecords('halaqah'),
        'kelas' => getSettings()['kelas'],
        'levelTahfidz' => getSettings()['levelTahfidz'],
        'kehadiran' => getRecords('kehadiran'),
        'tahsin' => getRecords('tahsin'),
        'ziyadahBacaan' => getRecords('ziyadahBacaan'),
        'ziyadahHafalan' => getRecords('ziyadahHafalan'),
        'mutqin' => getRecords('mutqin'),
        'catatan' => getRecords('catatan'),
        'tahunAjaran' => getSettings()['tahunAjaranList'],
        'semester' => getSettings()['semesterList'],
        'notifikasi' => getRecords('notifikasi'),
        'logAktivitas' => getRecords('logAktivitas'),
    ];
    // users without passwords (admin may view accounts)
    $stmt = pdo()->query('SELECT id, username, role, refId FROM users');
    $db['users'] = $stmt->fetchAll();
    return $db;
}
