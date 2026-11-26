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

/* ---------------- APP_TIMEZONE ----------------
 * Server sering berjalan di UTC, sedangkan browser pengguna memakai zona waktu
 * setempat. Tanpa penyelarasan ini, "hari ini" dan "jam kirim" di server bisa
 * berbeda sehari dari yang dilihat pengguna, sehingga rekap harian terkirim
 * untuk periode yang salah. Setel ke zona waktu lembaga (mis. Asia/Jakarta).
 * Kosongkan untuk memakai bawaan server. */
$appTimezone = trim((string)($envVars['APP_TIMEZONE'] ?? 'Asia/Jakarta'));
if ($appTimezone !== '') {
    try {
        new DateTimeZone($appTimezone);
        date_default_timezone_set($appTimezone);
    } catch (Throwable $e) {
        error_log('[tahfidzku] APP_TIMEZONE tidak valid, memakai bawaan server: ' . $appTimezone);
    }
}

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
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
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

/* ---------------- WA bridge proxy ----------------
   Browser tidak boleh memegang waBridgeKey, jadi semua panggilan ke bridge
   dilewatkan server. Settings bisa menyimpan nilai sebagai string "false" dari
   backup lama; nilai teks itu tidak boleh diperlakukan sebagai aktif. */
function waAutoEnabled(array $settings): bool {
    $value = $settings['waAuto'] ?? false;
    return $value === true || $value === 1 || $value === '1' || $value === 'true';
}

/**
 * Panggil endpoint bridge dengan X-WA-Key. Tidak ada exception yang dilempar:
 * kegagalan jaringan dikembalikan sebagai array agar API tetap membalas JSON
 * yang bisa dibaca antarmuka.
 */
function waBridgeCall(string $baseUrl, string $waKey, string $path, ?string $payload = null): array {
    $url = rtrim($baseUrl, '/') . '/' . ltrim($path, '/');
    $headers = ['X-WA-Key: ' . $waKey, 'Accept: */*'];
    if ($payload !== null) $headers[] = 'Content-Type: application/json';

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        if ($payload !== null) {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        }
        $body = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $failure = curl_error($ch);
        curl_close($ch);
        if ($body === false) {
            return ['ok' => false, 'status' => 0, 'data' => null, 'body' => '', 'detail' => 'Tidak bisa menghubungi bridge: ' . $failure];
        }
    } else {
        $opts = ['http' => [
            'method' => $payload !== null ? 'POST' : 'GET',
            'header' => implode("\r\n", $headers),
            'content' => $payload ?? '',
            'timeout' => 15,
            'ignore_errors' => true,
        ]];
        $body = @file_get_contents($url, false, stream_context_create($opts));
        $status = 0;
        if (isset($http_response_header[0]) && preg_match('#\s(\d{3})\s#', $http_response_header[0], $m)) $status = (int)$m[1];
        if ($body === false) {
            return ['ok' => false, 'status' => 0, 'data' => null, 'body' => '', 'detail' => 'Tidak bisa menghubungi bridge.'];
        }
    }

    $data = json_decode($body, true);
    return [
        'ok' => $status >= 200 && $status < 300,
        'status' => $status,
        'data' => is_array($data) ? $data : null,
        'body' => (string)$body,
        'detail' => is_array($data) ? (string)($data['error'] ?? '') : '',
    ];
}

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
function requireAdminOrSuperuser() {
    $u = requireAuth();
    if (!in_array($u['role'], ['admin', 'superuser'], true)) err('Forbidden', 403);
    return $u;
}
function requireSuperuser() {
    return requireRole('superuser');
}

require_once __DIR__ . '/normalized_store.php';

/* ---------------- Record store ----------------
   Instalasi lama tetap memakai tabel `records` sampai migrate.php selesai.
   Sesudah itu, fungsi publik yang dipakai API ini otomatis mengarah ke tabel
   per-entitas; tabel legacy tidak dihapus dan tetap menjadi arsip rollback. */
function getRecords($type, ?int $limit = null): array {
    if (NormalizedStore::isActive()) return NormalizedStore::getRecords($type, $limit);
    return legacyGetRecords($type, $limit);
}
function legacyGetRecords($type, ?int $limit = null): array {
    $sql = 'SELECT id, data FROM records WHERE type = ?';
    if ($limit !== null && $limit > 0) {
        $sql .= ' ORDER BY id DESC LIMIT ' . (int)$limit;
    }
    $stmt = pdo()->prepare($sql);
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

function defaultFeatures(): array {
    return [
        // Program pembelajaran (minimal default: Tahsin aktif, lainnya opsional)
        'tahsin' => true,
        'ziyadah' => false,
        'mutqin' => false,
        'murojaah' => false,
        // Operasional & monitoring
        'presensi' => false,
        'talim' => false,
        'liveMonitor' => false,
        // Laporan & utilitas data
        'rekapSetoran' => false,
        'laporanPdf' => false,
        'raport' => false,
        'importExcel' => false,
        'exportExcel' => false,
        // Portal & integrasi
        'portalWali' => false,
        'notifikasi' => false,
        'whatsapp' => false,
        'quran' => false,
        'spp' => false,
    ];
}
function normalizeFeatureFlags($raw): array {
    $defaults = defaultFeatures();
    if (!is_array($raw)) return $defaults;
    $out = [];
    foreach ($defaults as $key => $defVal) {
        if (!array_key_exists($key, $raw)) {
            $out[$key] = $defVal;
        } else {
            $v = $raw[$key];
            $out[$key] = ($v === true || $v === 1 || $v === '1' || $v === 'true');
        }
    }
    return $out;
}
function featureEnabled(array $settings, string $key): bool {
    $features = normalizeFeatureFlags($settings['features'] ?? []);
    return $features[$key] ?? true;
}
function disabledRecordTypes(array $settings): array {
    $disabled = [];
    if (!featureEnabled($settings, 'tahsin')) $disabled[] = 'tahsin';
    if (!featureEnabled($settings, 'ziyadah')) {
        $disabled[] = 'ziyadahBacaan';
        $disabled[] = 'ziyadahHafalan';
    }
    if (!featureEnabled($settings, 'mutqin')) $disabled[] = 'mutqin';
    if (!featureEnabled($settings, 'murojaah')) $disabled[] = 'murojaah';
    if (!featureEnabled($settings, 'presensi')) {
        $disabled[] = 'kehadiran';
        $disabled[] = 'absensiUstadz';
    }
    if (!featureEnabled($settings, 'talim')) $disabled[] = 'jurnalTalim';
    if (!featureEnabled($settings, 'notifikasi')) $disabled[] = 'notifikasi';
    if (!featureEnabled($settings, 'spp')) $disabled[] = 'pembayaranSpp';
    if (!featureEnabled($settings, 'raport')) $disabled[] = 'raport';
    return $disabled;
}
function defaultSubscription(): array {
    return ['status' => 'active', 'billingDate' => '', 'validUntil' => '', 'graceDays' => 7, 'nominal' => 0, 'note' => ''];
}
function normalizeSubscription($raw): array {
    $def = defaultSubscription();
    if (!is_array($raw)) return $def;
    $status = (($raw['status'] ?? 'active') === 'suspended') ? 'suspended' : 'active';
    $validUntil = trim((string)($raw['validUntil'] ?? ''));
    if ($validUntil !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $validUntil)) $validUntil = '';
    $billingDate = trim((string)($raw['billingDate'] ?? ''));
    if ($billingDate !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $billingDate)) $billingDate = '';
    $graceDays = array_key_exists('graceDays', $raw) && is_numeric($raw['graceDays'])
        ? max(0, min(30, (int)$raw['graceDays']))
        : 7;
    $nominal = array_key_exists('nominal', $raw) && is_numeric($raw['nominal'])
        ? max(0, (int)$raw['nominal'])
        : 0;
    $note = trim((string)($raw['note'] ?? ''));
    return [
        'status' => $status,
        'billingDate' => $billingDate,
        'validUntil' => $validUntil,
        'graceDays' => $graceDays,
        'nominal' => $nominal,
        'note' => $note,
    ];
}
function subscriptionSuspendDate(array $sub): string {
    if (empty($sub['validUntil'])) return '';
    $dt = DateTimeImmutable::createFromFormat('!Y-m-d', $sub['validUntil']);
    if (!$dt) return '';
    $offset = ((int)($sub['graceDays'] ?? 7)) > 0 ? (int)$sub['graceDays'] : 1;
    return $dt->modify('+' . $offset . ' days')->format('Y-m-d');
}
function subscriptionEffectiveBillingDate(array $sub): string {
    if (!empty($sub['billingDate'])) return $sub['billingDate'];
    if (empty($sub['validUntil'])) return '';
    $dt = DateTimeImmutable::createFromFormat('!Y-m-d', $sub['validUntil']);
    return $dt ? $dt->modify('-7 days')->format('Y-m-d') : '';
}
function subscriptionBlockedReason(array $settings): ?string {
    $sub = normalizeSubscription($settings['subscription'] ?? []);
    if ($sub['status'] === 'suspended') {
        return $sub['note'] !== '' ? $sub['note'] : 'Layanan lembaga sedang ditangguhkan sementara. Hubungi pengelola sistem.';
    }
    if ($sub['validUntil'] !== '') {
        $suspendDate = subscriptionSuspendDate($sub);
        if ($suspendDate !== '' && date('Y-m-d') >= $suspendDate) {
            $graceNote = $sub['graceDays'] > 0
                ? ' (melewati masa tenggang ' . $sub['graceDays'] . ' hari sejak jatuh tempo ' . $sub['validUntil'] . ')'
                : ' (jatuh tempo pada ' . $sub['validUntil'] . ')';
            $extra = $sub['note'] !== '' ? ' Info: ' . $sub['note'] : '';
            return 'Layanan lembaga disuspend otomatis karena tagihan belum dibayar' . $graceNote . '. Hubungi pengelola untuk perpanjangan.' . $extra;
        }
    }
    return null;
}
function syncSubscriptionNotifications(array $settings): void {
    $sub = normalizeSubscription($settings['subscription'] ?? []);
    if ($sub['status'] !== 'active' || $sub['validUntil'] === '') return;
    $today = date('Y-m-d');
    $billingDate = subscriptionEffectiveBillingDate($sub);
    $suspendDate = subscriptionSuspendDate($sub);
    if ($billingDate === '' || $today < $billingDate || ($suspendDate !== '' && $today >= $suspendDate)) return;

    $phase = ($today > $sub['validUntil']) ? 'tenggang' : 'tagihan';
    $nominalStr = $sub['nominal'] > 0 ? ' sebesar Rp ' . number_format($sub['nominal'], 0, ',', '.') : '';
    $noteStr = $sub['note'] !== '' ? ' Catatan: ' . $sub['note'] : '';
    $msg = $phase === 'tenggang'
        ? "⚠️ Masa tenggang layanan aplikasi{$nominalStr}! Jatuh tempo {$sub['validUntil']}. Layanan akan disuspend otomatis pada {$suspendDate} jika belum dibayar.{$noteStr}"
        : "💳 Tagihan layanan aplikasi{$nominalStr} aktif sejak {$billingDate} (jatuh tempo {$sub['validUntil']}, batas akhir sebelum suspend {$suspendDate}).{$noteStr}";

    $stmt = pdo()->query("SELECT id FROM users WHERE role = 'admin'");
    foreach ($stmt->fetchAll() as $admin) {
        $adminId = (string)($admin['id'] ?? '');
        if ($adminId === '') continue;
        $sig = md5(implode('|', [$sub['validUntil'], $billingDate, $suspendDate, $sub['nominal'], $sub['note'], $phase, $adminId]));
        $notifId = 'notif_bill_' . substr($sig, 0, 16);
        if (!getRecord('notifikasi', $notifId)) {
            putRecord('notifikasi', $notifId, [
                'id' => $notifId,
                'userId' => $adminId,
                'tipe' => 'admin',
                'kategori' => 'layanan_billing',
                'periodKey' => $sub['validUntil'] . '|' . $phase,
                'pesan' => $msg,
                'tanggal' => date('c'),
                'read' => false,
            ]);
        }
    }
}

function defaultSesiHalaqah(): array {
    return [
        ['nama' => 'Subuh', 'jamMulai' => '04:30', 'jamSelesai' => '06:00'],
        ['nama' => 'Ashar', 'jamMulai' => '15:30', 'jamSelesai' => '17:00'],
        ['nama' => 'Maghrib', 'jamMulai' => '18:00', 'jamSelesai' => '19:15'],
        ['nama' => 'Isya', 'jamMulai' => '19:30', 'jamSelesai' => '21:00'],
    ];
}
function normalizeSesiHalaqah($raw): array {
    if (!is_array($raw)) return defaultSesiHalaqah();
    $out = [];
    $seen = [];
    $validTime = fn($v, $fb) => preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', (string)$v) ? (string)$v : $fb;
    foreach ($raw as $item) {
        if (!is_array($item)) continue;
        $nama = trim((string)($item['nama'] ?? ''));
        if ($nama === '' || in_array(strtolower($nama), ['kajian', 'materi kajian', 'ta’lim malam', "ta'lim malam"], true)) continue;
        $key = strtolower($nama);
        if (isset($seen[$key])) continue;
        $seen[$key] = true;
        $out[] = [
            'nama' => $nama,
            'jamMulai' => $validTime($item['jamMulai'] ?? '', '07:00'),
            'jamSelesai' => $validTime($item['jamSelesai'] ?? '', '08:00'),
        ];
    }
    return count($out) ? $out : defaultSesiHalaqah();
}
function sesiNames(array $settings): array {
    return array_values(array_map(fn($s) => $s['nama'], normalizeSesiHalaqah($settings['sesiHalaqah'] ?? [])));
}

/* ---------------- Settings ---------------- */
function getSettings(): array {
    $stmt = pdo()->prepare('SELECT data FROM settings WHERE id = 1');
    $stmt->execute();
    $r = $stmt->fetch();
    $merged = $r ? array_merge(defaultSettings(), json_decode($r['data'], true)) : defaultSettings();
    $merged['features'] = normalizeFeatureFlags($merged['features'] ?? []);
    $merged['subscription'] = normalizeSubscription($merged['subscription'] ?? []);
    $merged['sesiHalaqah'] = normalizeSesiHalaqah($merged['sesiHalaqah'] ?? []);
    return $merged;
}
function saveSettings(array $s) {
    $s['features'] = normalizeFeatureFlags($s['features'] ?? []);
    $s['subscription'] = normalizeSubscription($s['subscription'] ?? []);
    $s['sesiHalaqah'] = normalizeSesiHalaqah($s['sesiHalaqah'] ?? []);
    $data = json_encode($s, JSON_UNESCAPED_UNICODE);
    $stmt = pdo()->prepare(upsertSQL('settings', ['id', 'data']));
    $stmt->execute([1, $data]);
}
function defaultSettings(): array {
    return [
        'features' => defaultFeatures(),
        'subscription' => defaultSubscription(),
        'sppNominal' => 100000,
        'sppJatuhTempo' => 10,
        'namaLembaga' => 'Rumah Tahfidz Al-Hikmah',
        'alamat' => 'Jl. Pendidikan No. 10, Jakarta',
        'kota' => '',
        'jabatanPimpinan' => 'Mudir / Kepala Lembaga',
        'namaPimpinan' => '',
        'ttdPimpinan' => '',
        'capLembaga' => '',
        'tahunAjaran' => '2025/2026',
        'semester' => 'Ganjil',
        'standarPenilaian' => 'A (90-100), B (80-89), C (70-79), D (<70)',
        'jamBelajar' => '07:00 - 09:00',
        'sesiHalaqah' => defaultSesiHalaqah(),
        'tema' => 'Claymorphism',
        'defaultPasswordFormat' => '12345678',
        'logo' => '',
        'setoranMulti' => false,
        'tingkat' => ['TPQ', 'SD', 'SMP', 'SMA'],
        // Setiap nomor kelas punya dua rombongan (A dan B), jadi "Kelas 7A"
        // dan "Kelas 7B". Daftar ini hanya nilai awal; admin dapat
        // menambah/menghapusnya lewat Settings -> Kelas & Tingkat.
        'kelasPerTingkat' => [
            'TPQ' => ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B'],
            'SD' => ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B'],
            'SMP' => ['7A', '7B', '8A', '8B', '9A', '9B'],
            'SMA' => ['10A', '10B', '11A', '11B', '12A', '12B'],
        ],
        'talimMapel' => [],
        'talimMalam' => ['ustadzIds' => [], 'judulKitab' => '', 'bab' => ''],
        // Kalender libur lembaga: [{ tanggal, keterangan, sesi: 'semua'|[...] }]
        'liburLembaga' => [],
        'notifActive' => true,
        'notifMaxPerDay' => 3,
        'notifWali' => true,
        'notifUstadz' => true,
        'notifAbsensiWali' => true,
        'notifAbsensiPeriode' => 'harian',
        'waBridgeUrl' => '', 'waBridgeKey' => '', 'waAuto' => false,
        'waReportContent' => [
            'kehadiran' => true,
            'rincianSesi' => true,
            'hafalan' => true,
            'nilai' => true,
            'catatan' => true,
        ],
        'juzOrder' => [30,29,28,27,26,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],
        'kelas' => ['TK Al-Qur\'an', 'SD', 'SMP', 'SMA'],
        'levelTahfidz' => ['Tahsin', 'Ziyadah', 'Mutqin'],
        'tahunAjaranList' => ['2024/2025', '2025/2026', '2026/2027'],
        'semesterList' => ['Ganjil', 'Genap'],
    ];
}

/** Return settings with sensitive fields stripped for non-admin users. */
function publicSettings(array $s, string $role): array {
    $s['features'] = normalizeFeatureFlags($s['features'] ?? []);
    if ($role === 'admin' || $role === 'superuser') return $s;
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
    $count = ['Hadir' => 0, 'Izin' => 0, 'Sakit' => 0, 'Alfa' => 0, 'Libur' => 0];
    foreach ($records as $record) {
        $status = $record['status'] ?? 'Hadir';
        if (isset($count[$status])) $count[$status]++;
    }
    $ringkas = 'Hadir ' . $count['Hadir'] . ', Izin ' . $count['Izin'] . ', Sakit ' . $count['Sakit'] . ', Alfa ' . $count['Alfa'];
    if ($count['Libur'] > 0) $ringkas .= ', Libur ' . $count['Libur'];
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
    if (!featureEnabled($settings, 'notifikasi') || empty($settings['notifActive']) || empty($settings['notifWali']) || empty($settings['notifAbsensiWali'])) return;
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
function ensureSuperuserSeed(): void {
    global $envVars;
    try {
        $exists = (int)pdo()->query("SELECT COUNT(*) FROM users WHERE role = 'superuser'")->fetchColumn();
        if ($exists > 0) return;
        $username = trim((string)($envVars['SUPERUSER_USERNAME'] ?? 'superuser'));
        $password = (string)($envVars['SUPERUSER_PASSWORD'] ?? 'superuser123');
        if ($username === '' || $password === '') return;
        if (getUserByUsername($username)) return;
        $stmt = pdo()->prepare(insertIgnoreSQL('users', ['id', 'username', 'password', 'role', 'refId']));
        $stmt->execute([uid('usr'), $username, password_hash($password, PASSWORD_DEFAULT), 'superuser', null]);
    } catch (Throwable $e) {
        // Table users belum ada sebelum install; abaikan dengan aman.
    }
}
function publicUser($u) {
    return ['id' => $u['id'], 'username' => $u['username'], 'role' => $u['role'], 'refId' => $u['refId']];
}

/* ---------------- Git Commit & Version Notifications ---------------- */
function determineUpdateTargetRoles(string $commitMsg): array {
    $msgLower = strtolower($commitMsg);

    // Admin & Pengawas always receive update notifications
    $roles = ['admin', 'pengawas'];

    // Keywords relevant to Ustadz
    $ustadzKeywords = [
        'setoran', 'maju', 'bayar', 'hafalan', 'bacaan', 'mutqin', 'tahsin',
        'absensi', 'halaqah', 'talim', 'ta’lim', 'ta\'lim', 'santri',
        'laporan', 'rekap', 'jurnal', 'ustadz', 'guru', 'kelas', 'quran',
        'minggu ini', 'pembelajaran', 'kehadiran'
    ];
    $isUstadz = false;
    foreach ($ustadzKeywords as $kw) {
        if (strpos($msgLower, $kw) !== false) {
            $isUstadz = true;
            break;
        }
    }
    // General user-facing changes (feat, ui, pwa, update, etc.) are also relevant to ustadz
    if ($isUstadz || preg_match('/^(feat|ui)(\([^)]+\))?:/i', $commitMsg) || strpos($msgLower, 'pwa') !== false) {
        $roles[] = 'ustadz';
    }

    // Keywords relevant to Wali
    $waliKeywords = ['wali', 'ortu', 'orang tua', 'rekap orang tua'];
    foreach ($waliKeywords as $kw) {
        if (strpos($msgLower, $kw) !== false) {
            $roles[] = 'wali';
            break;
        }
    }

    return array_values(array_unique($roles));
}

function syncGitUpdateNotifications(): void {
    static $alreadyRun = false;
    if ($alreadyRun) return;
    $alreadyRun = true;

    $commits = [];
    $repoDir = dirname(__DIR__);
    if (is_dir($repoDir . '/.git')) {
        $lines = [];
        @exec('git log -5 --format="%h||%s"', $lines);
        foreach ($lines as $line) {
            $parts = explode('||', trim($line), 2);
            if (count($parts) === 2 && !empty($parts[0])) {
                $commits[] = ['hash' => trim($parts[0]), 'message' => trim($parts[1])];
            }
        }
        // Keep version.json in sync for environments without .git or exec
        if (!empty($commits[0]['hash'])) {
            $latestDate = trim(@exec('git log -1 --format="%cI"'));
            @file_put_contents($repoDir . '/version.json', json_encode([
                'hash' => $commits[0]['hash'],
                'message' => $commits[0]['message'],
                'date' => $latestDate ?: date('c')
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }
    }
    if (empty($commits)) {
        $verFile = $repoDir . '/version.json';
        if (file_exists($verFile)) {
            $data = json_decode(file_get_contents($verFile), true);
            if (!empty($data['hash'])) {
                $commits[] = ['hash' => $data['hash'], 'message' => $data['message'] ?? ''];
            }
        }
    }
    if (empty($commits)) return;

    // Get current synced commit hashes from settings
    $settings = getSettings();
    $syncedCommits = $settings['syncedGitCommits'] ?? [];
    if (!is_array($syncedCommits)) $syncedCommits = [];

    // Filter commits that have not been broadcasted
    $newCommits = [];
    foreach ($commits as $c) {
        if (!in_array($c['hash'], $syncedCommits, true)) {
            $newCommits[] = $c;
        }
    }
    if (empty($newCommits)) return;

    $stmt = pdo()->query('SELECT id, role FROM users');
    $allUsers = $stmt->fetchAll();
    if (empty($allUsers)) return;

    $newSyncedHashes = [];
    foreach ($newCommits as $c) {
        $hash = $c['hash'];
        $msg = $c['message'];
        if (empty($hash) || empty($msg)) continue;
        if (stripos($msg, 'Merge ') === 0) {
            $newSyncedHashes[] = $hash;
            continue;
        }

        $targetRoles = determineUpdateTargetRoles($msg);
        $targetUsers = array_filter($allUsers, fn($u) => in_array($u['role'], $targetRoles, true));

        $cleanMsg = preg_replace('/^(feat|fix|refactor|perf|chore|docs|style)(\([^)]+\))?:\s*/i', '', $msg);
        $cleanMsg = ucfirst(trim($cleanMsg));

        foreach ($targetUsers as $user) {
            $notifId = 'notif_git_' . $hash . '_' . $user['id'];
            $existing = getRecord('notifikasi', $notifId);
            if (!$existing) {
                putRecord('notifikasi', $notifId, [
                    'id' => $notifId,
                    'userId' => $user['id'],
                    'tipe' => $user['role'],
                    'kategori' => 'update',
                    'pesan' => "🚀 Update Aplikasi (v.{$hash}): {$cleanMsg}",
                    'commitHash' => $hash,
                    'tanggal' => date('c'),
                    'updatedAt' => date('c'),
                    'read' => false,
                ]);
            }
        }
        $newSyncedHashes[] = $hash;
    }

    if (!empty($newSyncedHashes)) {
        $merged = array_values(array_slice(array_unique(array_merge($syncedCommits, $newSyncedHashes)), -30));
        $settings['syncedGitCommits'] = $merged;
        saveSettings($settings);
    }
}

/* ---------------- Bootstrap (role-filtered data for current user) ---------------- */
function bootstrapData($user) {
    // Terapkan kolom/tabel baru (mis. absensi ustadz) sebelum data dibaca.
    NormalizedStore::ensureUpgrade();
    syncGitUpdateNotifications();
    $settings = publicSettings(getSettings(), $user['role']);

    // Admin, Superuser & Pengawas: return everything (except superuser accounts hidden from non-superuser)
    if ($user['role'] === 'admin' || $user['role'] === 'pengawas' || $user['role'] === 'superuser') {
        if ($user['role'] === 'admin') {
            syncSubscriptionNotifications(getSettings());
        }
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
            'murojaah' => getRecords('murojaah'),
            'catatan' => getRecords('catatan'),
            'raport' => featureEnabled(getSettings(), 'raport') ? getRecords('raport') : [],
            'pembayaranSpp' => featureEnabled(getSettings(), 'spp') ? getRecords('pembayaranSpp') : [],
            'tahunAjaran' => getSettings()['tahunAjaranList'],
            'semester' => getSettings()['semesterList'],
            'notifikasi' => getRecords('notifikasi'),
            'logAktivitas' => getRecords('logAktivitas', 150),
            'logWa' => getRecords('logWa', 150),
        ];
        if ($user['role'] === 'superuser') {
            $stmt = pdo()->query('SELECT id, username, role, refId FROM users');
        } else {
            $stmt = pdo()->query("SELECT id, username, role, refId FROM users WHERE role != 'superuser'");
        }
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
            'murojaah' => getRecords('murojaah'),
            'catatan' => getRecords('catatan'),
            'raport' => featureEnabled(getSettings(), 'raport') ? getRecords('raport') : [],
            'pembayaranSpp' => featureEnabled(getSettings(), 'spp') ? getRecords('pembayaranSpp') : [],
            'tahunAjaran' => getSettings()['tahunAjaranList'],
            'semester' => getSettings()['semesterList'],
            'notifikasi' => array_values(array_filter(getRecords('notifikasi'), fn($n) => $n['userId'] === $user['uid'])),
            'logAktivitas' => getRecords('logAktivitas', 150),
            'logWa' => getRecords('logWa', 150),
        ];
        // Ustadz sees only their own user account + admin accounts (for reference)
        $stmt = pdo()->query('SELECT id, username, role, refId FROM users');
        $allUsers = $stmt->fetchAll();
        $db['users'] = array_values(array_filter($allUsers, fn($u) => $u['id'] === $user['uid'] || $u['role'] === 'admin'));
        return $db;
    }

    // Wali: return ONLY their child's (or children's) data (read-only, privacy-protected)
    $wali = $user['refId'] ? getRecord('wali', $user['refId']) : null;
    $santriIds = [];
    if ($wali) {
        if (!empty($wali['santriId'])) {
            $santriIds[] = $wali['santriId'];
        }
        // Link siblings sharing same phone number or waliId
        if (NormalizedStore::isActive()) {
            $query = 'SELECT id FROM santri WHERE wali_id = ?';
            $params = [$wali['id']];
            if (!empty($wali['noHp'])) {
                $cleanPhone = preg_replace('/[^0-9]/', '', $wali['noHp']);
                if (strlen($cleanPhone) >= 8) {
                    $query .= " OR REPLACE(REPLACE(REPLACE(no_hp_wali, '-', ''), ' ', ''), '+', '') LIKE ?";
                    $params[] = '%' . substr($cleanPhone, -8);
                }
            }
            $stmt = pdo()->prepare($query);
            $stmt->execute($params);
            foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $sid) {
                $santriIds[] = (string)$sid;
            }
        }
    }
    $santriIds = array_values(array_unique(array_filter($santriIds)));

    if (!empty($santriIds)) {
        if (NormalizedStore::isActive()) {
            $santri = NormalizedStore::getRecordsForSantri('santri', $santriIds);
            $kehadiran = NormalizedStore::getRecordsForSantri('kehadiran', $santriIds);
            $tahsin = NormalizedStore::getRecordsForSantri('tahsin', $santriIds);
            $ziyadahBacaan = NormalizedStore::getRecordsForSantri('ziyadahBacaan', $santriIds);
            $ziyadahHafalan = NormalizedStore::getRecordsForSantri('ziyadahHafalan', $santriIds);
            $mutqin = NormalizedStore::getRecordsForSantri('mutqin', $santriIds);
            $murojaah = NormalizedStore::getRecordsForSantri('murojaah', $santriIds);
            $catatan = NormalizedStore::getRecordsForSantri('catatan', $santriIds);
            $raport = featureEnabled($settings, 'raport') ? NormalizedStore::getRecordsForSantri('raport', $santriIds) : [];
            $pembayaranSpp = featureEnabled($settings, 'spp') ? NormalizedStore::getRecordsForSantri('pembayaranSpp', $santriIds) : [];
        } else {
            $santri = array_values(array_filter(getRecords('santri'), fn($s) => in_array($s['id'], $santriIds, true)));
            $kehadiran = array_values(array_filter(getRecords('kehadiran'), fn($k) => in_array($k['santriId'] ?? '', $santriIds, true)));
            $tahsin = array_values(array_filter(getRecords('tahsin'), fn($t) => in_array($t['santriId'] ?? '', $santriIds, true)));
            $ziyadahBacaan = array_values(array_filter(getRecords('ziyadahBacaan'), fn($z) => in_array($z['santriId'] ?? '', $santriIds, true)));
            $ziyadahHafalan = array_values(array_filter(getRecords('ziyadahHafalan'), fn($z) => in_array($z['santriId'] ?? '', $santriIds, true)));
            $mutqin = array_values(array_filter(getRecords('mutqin'), fn($m) => in_array($m['santriId'] ?? '', $santriIds, true)));
            $murojaah = array_values(array_filter(getRecords('murojaah'), fn($m) => in_array($m['santriId'] ?? '', $santriIds, true)));
            $catatan = array_values(array_filter(getRecords('catatan'), fn($c) => in_array($c['santriId'] ?? '', $santriIds, true)));
            $raport = featureEnabled($settings, 'raport') ? array_values(array_filter(getRecords('raport'), fn($r) => in_array($r['santriId'] ?? '', $santriIds, true))) : [];
            $pembayaranSpp = featureEnabled($settings, 'spp') ? array_values(array_filter(getRecords('pembayaranSpp'), fn($p) => in_array($p['santriId'] ?? '', $santriIds, true))) : [];
        }
    } else {
        $santri = []; $kehadiran = []; $tahsin = []; $ziyadahBacaan = [];
        $ziyadahHafalan = []; $mutqin = []; $murojaah = []; $catatan = []; $raport = []; $pembayaranSpp = [];
    }

    // Wali sees only their own notifications
    $notifikasi = array_values(array_filter(getRecords('notifikasi'), fn($n) => $n['userId'] === $user['uid']));

    // Wali sees their own wali record + every ustadz who teaches one of their
    // children's active-program halaqah.
    $waliRecords = $wali ? [$wali] : [];
    $ustadzRecords = [];
    $ustadzIds = [];
    $halaqahForWali = [];
    if (!empty($santri)) {
        $halaqahRecords = getRecords('halaqah');
        $references = [];
        foreach ($santri as $santriData) {
            if (!empty($santriData['halaqah'])) $references[] = $santriData['halaqah'];
            if (!empty($santriData['halaqahProgram']) && is_array($santriData['halaqahProgram'])) {
                foreach ($santriData['halaqahProgram'] as $reference) if ($reference) $references[] = $reference;
            }
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

    // Wali hanya melihat jurnal Materi Kajian yang sesuai kelas anaknya.
    $jurnalTalim = [];
    if (featureEnabled($settings, 'talim') && !empty($santri)) {
        $childKeys = [];
        foreach ($santri as $santriData) {
            $tk = trim((string)($santriData['tingkat'] ?? ''));
            $kl = trim((string)($santriData['kelas'] ?? ''));
            if ($tk !== '' && $kl !== '') $childKeys[$tk . '|' . $kl] = true;
            elseif ($kl !== '') $childKeys['|' . $kl] = true;
        }
        if ($childKeys) {
            $jurnalTalim = array_values(array_filter(getRecords('jurnalTalim'), function ($j) use ($childKeys) {
                $keys = is_array($j['kelasKeys'] ?? null) ? $j['kelasKeys'] : [];
                if (!$keys && (!empty($j['tingkat']) || !empty($j['kelas']))) {
                    $keys[] = trim((string)($j['tingkat'] ?? '')) . '|' . trim((string)($j['kelas'] ?? ''));
                }
                foreach ($keys as $k) {
                    if (isset($childKeys[(string)$k])) return true;
                }
                return false;
            }));
        }
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
        'murojaah' => $murojaah,
        'catatan' => $catatan,
        'raport' => $raport,
        'pembayaranSpp' => $pembayaranSpp,
        'tahunAjaran' => getSettings()['tahunAjaranList'],
        'semester' => getSettings()['semesterList'],
        'notifikasi' => $notifikasi,
        'logAktivitas' => [],
        'logWa' => [],
    ];
    return $db;
}
