<?php
/**
 * Tahfidzku — REST API entry point (single file, shared-hosting friendly).
 * All requests: /api/index.php?action=...
 */
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';

try {
switch ($action) {

    /* ---------------- AUTH ---------------- */
    case 'login':
        $b = body();
        $username = $b['username'] ?? '';
        // Rate limit: 5 FAILED attempts per 5 minutes per (IP + username)
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $rlKey = 'login_fail_' . $ip . '|' . strtolower($username);
        if (!rateCheck($rlKey, 5, 300)) {
            err('Terlalu banyak percobaan login gagal. Coba lagi dalam 5 menit.', 429);
        }
        $u = getUserByUsername($username);
        if (!$u || !password_verify($b['password'] ?? '', $u['password'])) {
            rateLimit($rlKey, 5, 300); // count only failed attempts
            err('Username atau password salah.', 401);
        }
        $pub = publicUser($u);
        send(['token' => makeToken($pub), 'user' => $pub]);
        break;

    case 'me':
        $u = requireAuth();
        send(['user' => ['id' => $u['uid'], 'role' => $u['role'], 'refId' => $u['refId']]]);
        break;

    case 'password':
        $u = requireAuth();
        $b = body();
        $stmt = pdo()->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$u['uid']]);
        $row = $stmt->fetch();
        if (!password_verify($b['old'] ?? '', $row['password'])) err('Password lama salah.', 400);
        // Validate new password length
        $newPass = $b['new'] ?? '';
        if (strlen($newPass) < 6) err('Password baru minimal 6 karakter.', 400);
        $stmt = pdo()->prepare('UPDATE users SET password = ? WHERE id = ?');
        $stmt->execute([password_hash($newPass, PASSWORD_DEFAULT), $u['uid']]);
        send(['ok' => true]);
        break;

    /* ---------------- BOOTSTRAP (all data, role-filtered) ---------------- */
    case 'bootstrap':
        $u = requireAuth();
        send(['user' => ['id' => $u['uid'], 'role' => $u['role'], 'refId' => $u['refId']], 'db' => bootstrapData($u)]);
        break;

    /* ---------------- RECORDS CRUD (role-restricted) ---------------- */
    case 'records':
        $u = requireAuth();
        $type = preg_replace('/[^a-zA-Z]/', '', $_GET['type'] ?? '');
        if (!$type) err('type required', 400);

        // Define allowed record types per role
        NormalizedStore::ensureUpgrade();
        $ustadzWritable = ['kehadiran','absensiUstadz','jurnalTalim','tahsin','ziyadahBacaan','ziyadahHafalan','mutqin','catatan','notifikasi','logAktivitas','logWa'];

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if ($u['role'] === 'wali') {
                err('Forbidden: Wali hanya dapat mengakses data sendiri (via bootstrap).', 403);
            }
            if ($u['role'] === 'ustadz' && !in_array($type, $ustadzWritable, true)) {
                err('Forbidden: Ustadz hanya dapat membaca data pembelajaran.', 403);
            }
            send(getRecords($type));
        }

        // Write operations (POST/PUT/DELETE): restrict by role
        if ($u['role'] === 'wali') {
            err('Forbidden: Wali tidak dapat mengubah data.', 403);
        }
        if ($u['role'] === 'ustadz' && !in_array($type, $ustadzWritable, true)) {
            err('Forbidden: Ustadz hanya dapat mengubah data pembelajaran.', 403);
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $b = body();
            $id = $b['id'] ?? uid($type);
            $b['id'] = $id;
            putRecord($type, $id, $b);
            send(['id' => $id], 201);
        }
        if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            $id = $_GET['id'] ?? '';
            if (!$id) err('id required', 400);
            $b = body();
            $b['id'] = $id;
            putRecord($type, $id, $b);
            send(['id' => $id]);
        }
        if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
            $id = $_GET['id'] ?? '';
            if (!$id) err('id required', 400);
            delRecord($type, $id);
            send(['ok' => true]);
        }
        err('Method not allowed', 405);
        break;

    /* ---------------- SETTINGS (admin only) ---------------- */
    case 'settings':
        $u = requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            send(getSettings());
        }
        if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            $b = body();
            saveSettings($b);
            send(['ok' => true]);
        }
        err('Method not allowed', 405);
        break;

    /* ---------------- RESET (admin reseed) ---------------- */
    case 'reset':
        $u = requireAdmin();
        // Bersihkan data aktif saja. Setelah migrasi, tabel `records` lama
        // tetap merupakan arsip rollback dan tidak pernah dihapus di sini.
        resetApplicationRecords();
        pdo()->exec('DELETE FROM settings');
        saveSettings(defaultSettings());
        send(['ok' => true]);
        break;

    /* ---------------- SAVE (delta-first, role-restricted) ---------------- */
    case 'save':
        $u = requireAuth();
        $b = body();

        // Define allowed types per role
        $adminTypes = ['santri','wali','ustadz','halaqah','kehadiran','absensiUstadz','jurnalTalim','tahsin','ziyadahBacaan','ziyadahHafalan','mutqin','catatan','notifikasi','logAktivitas','logWa'];
        $ustadzTypes = ['kehadiran','absensiUstadz','jurnalTalim','tahsin','ziyadahBacaan','ziyadahHafalan','mutqin','catatan','notifikasi','logAktivitas','logWa'];

        // Basis data lama bisa belum punya kolom/tabel terbaru. Penanda upgrade
        // membuat pemanggilan berikutnya tanpa biaya DDL.
        NormalizedStore::ensureUpgrade();

        if ($u['role'] === 'wali') {
            // Wali is read-only EXCEPT their own wali record (nama/noHp, Profil page).
            $waliRows = $b['changes']['records']['wali']['upsert'] ?? ($b['wali'] ?? null);
            if (is_array($waliRows) && $u['refId']) {
                $w = getRecord('wali', $u['refId']);
                if ($w) {
                    foreach ($waliRows as $rec) {
                        if (($rec['id'] ?? null) === $u['refId']) {
                            foreach (['nama', 'noHp'] as $f) {
                                if (array_key_exists($f, $rec)) $w[$f] = $rec[$f];
                            }
                            putRecord('wali', $u['refId'], $w);
                        }
                    }
                }
            }
            send(['ok' => true]);
            break;
        }

        $allowedTypes = ($u['role'] === 'admin') ? $adminTypes : $ustadzTypes;

        /*
         * Modern clients send a delta instead of a whole browser cache.  The
         * old full-payload reconcile below is kept for compatibility, but it
         * is unsafe for concurrent staff sessions: a stale payload can erase
         * a record that was just entered by somebody else.
         */
        if (isset($b['changes']) && is_array($b['changes'])) {
            $changes = $b['changes'];

            $attendanceChanged = false;
            $recordChanges = $changes['records'] ?? [];
            if (is_array($recordChanges)) {
                foreach ($recordChanges as $type => $change) {
                    if (!in_array($type, $allowedTypes, true) || !is_array($change)) continue;
                    foreach (($change['upsert'] ?? []) as $rec) {
                        if (!is_array($rec)) continue;
                        $id = $rec['id'] ?? uid($type);
                        $rec['id'] = $id;
                        putRecord($type, $id, $rec);
                        if ($type === 'kehadiran') $attendanceChanged = true;
                    }
                    foreach (($change['remove'] ?? []) as $id) {
                        if (!is_string($id) || $id === '') continue;
                        delRecord($type, $id);
                        if ($type === 'kehadiran') $attendanceChanged = true;
                    }
                }
            }

            if ($u['role'] === 'admin' && isset($changes['settings']) && is_array($changes['settings'])) {
                saveSettings($changes['settings']);
            }
            if ($u['role'] === 'admin' && isset($changes['users']) && is_array($changes['users'])) {
                foreach (($changes['users']['upsert'] ?? []) as $usr) {
                    if (!is_array($usr) || empty($usr['id'])) continue;
                    $existing = getUserById($usr['id']);
                    if ($existing) {
                        $passSql = '';
                        $params = [];
                        if (!empty($usr['password']) && !preg_match('/^\$2[aby]\$/', $usr['password'])) {
                            $passSql = ', password=?';
                            $params[] = password_hash($usr['password'], PASSWORD_DEFAULT);
                        }
                        $stmt = pdo()->prepare('UPDATE users SET username=?, role=?, refId=?' . $passSql . ' WHERE id=?');
                        $stmt->execute(array_merge([$usr['username'] ?? '', $usr['role'] ?? 'wali', $usr['refId'] ?? null], $params, [$usr['id']]));
                    } else {
                        $pass = !empty($usr['password']) ? password_hash($usr['password'], PASSWORD_DEFAULT) : password_hash('12345678', PASSWORD_DEFAULT);
                        $stmt = pdo()->prepare(insertIgnoreSQL('users', ['id', 'username', 'password', 'role', 'refId']));
                        $stmt->execute([$usr['id'], $usr['username'] ?? '', $pass, $usr['role'] ?? 'wali', $usr['refId'] ?? null]);
                    }
                }
                foreach (($changes['users']['remove'] ?? []) as $id) {
                    if (is_string($id) && $id !== '' && $id !== $u['uid']) {
                        pdo()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
                    }
                }
            }
            if ($attendanceChanged) syncAttendanceWaliNotifications();
            send(['ok' => true]);
        }

        // Fallback untuk klien versi lama. Payload penuh hanya boleh di-merge;
        // jangan pernah dipakai untuk menyimpulkan bahwa baris di server harus
        // dihapus, karena browser lama bisa membawa cache yang sudah tertinggal.
        // Klien baru mengirim `changes.remove` bila pengguna memang menghapus.
        foreach ($allowedTypes as $t) {
            if (!isset($b[$t]) || !is_array($b[$t])) continue;
            foreach ($b[$t] as $rec) {
                $id = $rec['id'] ?? uid($t);
                putRecord($t, $id, $rec);
            }
        }

        // Settings: admin only
        if ($u['role'] === 'admin' && isset($b['settings']) && is_array($b['settings'])) {
            saveSettings($b['settings']);
        }

        // Users: admin only
        if ($u['role'] === 'admin' && isset($b['users']) && is_array($b['users'])) {
            $existingIds = [];
            $stmtAll = pdo()->query('SELECT id FROM users');
            foreach ($stmtAll->fetchAll() as $row) $existingIds[] = $row['id'];

            foreach ($b['users'] as $usr) {
                if (empty($usr['id'])) continue;
                if (in_array($usr['id'], $existingIds, true)) {
                    // update username/role/refId; update password only if it's a new plaintext value
                    $passSql = '';
                    $params = [];
                    if (!empty($usr['password']) && !preg_match('/^\$2[aby]\$/', $usr['password'])) {
                        $passSql = ', password=?';
                        $params[] = password_hash($usr['password'], PASSWORD_DEFAULT);
                    }
                    $stmt = pdo()->prepare('UPDATE users SET username=?, role=?, refId=?' . $passSql . ' WHERE id=?');
                    $stmt->execute(array_merge([$usr['username'] ?? '', $usr['role'] ?? 'wali', $usr['refId'] ?? null], $params, [$usr['id']]));
                } else {
                    $pass = !empty($usr['password']) ? password_hash($usr['password'], PASSWORD_DEFAULT) : password_hash('12345678', PASSWORD_DEFAULT);
                    $stmt = pdo()->prepare(insertIgnoreSQL('users', ['id', 'username', 'password', 'role', 'refId']));
                    $stmt->execute([$usr['id'], $usr['username'] ?? '', $pass, $usr['role'] ?? 'wali', $usr['refId'] ?? null]);
                }
            }
            // Legacy full payloads are merge-only. User deletion is handled
            // exclusively by the delta path above.
        }
        // Attendance notifications are generated server-side so ustadz do not
        // need access to guardian account data, and corrections stay deduplicated.
        if (isset($b['kehadiran']) && is_array($b['kehadiran'])) {
            syncAttendanceWaliNotifications();
        }
        send(['ok' => true]);
        break;

    /* ---------------- WHATSAPP BRIDGE (proksi) ----------------
       Browser tidak pernah melihat waBridgeKey: bridge hanya hidup di jaringan
       internal, jadi permintaannya diteruskan server yang holding kredensial.
      Ustadz pun tetap bisa mengirim laporan ke wali tanpa memegang kunci. */
    case 'wa':
        $waUser = requireAuth();
        $waIsAdmin = ($waUser['role'] ?? '') === 'admin';
        $waOp = $_GET['op'] ?? 'status';
        if (!in_array($waOp, ['status', 'qr', 'send'], true)) err('Unknown wa op', 400);
        // Cek koneksi dan QR hanya untuk admin: keduanya menyangkut nomor
        // bridge dan kuncinya, bukan data wali.
        if ($waOp !== 'send' && !$waIsAdmin) err('Method not allowed', 403);

        $waSettings = getSettings();
        $waUrl = rtrim((string)($waSettings['waBridgeUrl'] ?? ''), '/');
        $waKey = (string)($waSettings['waBridgeKey'] ?? '');
        if (!$waUrl) err('WA bridge belum diatur (Settings → WhatsApp).', 400);
        if (!$waKey) err('Key WA bridge belum diatur (Settings → WhatsApp).', 400);

        $to = null;
        $message = null;
        if ($waOp === 'send') {
            $waBody = body();
            $to = trim((string)($waBody['to'] ?? ''));
            $message = trim((string)($waBody['message'] ?? ''));
            // Ustadz hanya boleh mengirim lewat jalur laporan otomatis.
            if (!$waIsAdmin && !waAutoEnabled($waSettings)) err('WhatsApp Otomatis sedang nonaktif.', 409);
            if (!$to || !$message) err('to & message required', 400);
        }

        $waPath = $waOp === 'qr' ? '/qr' : ($waOp === 'send' ? '/send' : '/status');
        $waPayload = $waOp === 'send' ? json_encode(['to' => $to, 'message' => $message]) : null;
        $r = waBridgeCall($waUrl, $waKey, $waPath, $waPayload);

        if ($waOp === 'qr') {
            if (!$r['ok']) err($r['detail'] ?: ('Bridge menjawab HTTP ' . $r['status']), $r['status'] ?: 502);
            header('Content-Type: image/png');
            header('Cache-Control: no-store');
            http_response_code(200);
            echo $r['body'];
            exit;
        }
        if ($waOp === 'status') send(['ok' => $r['ok'], 'status' => $r['status'], 'data' => $r['data']]);
        send(['ok' => $r['ok'], 'status' => $r['status'], 'detail' => $r['detail']]);
        break;

    default:
        err('Unknown action', 404);
}
} catch (Throwable $e) {
    // Log the real error (web-inaccessible api/error.log) but never leak it to clients.
    error_log('[tahfidzku] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    err('Terjadi kesalahan server. Cek api/error.log.', 500);
}

function getUserById($id) {
    $stmt = pdo()->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$id]);
    return $stmt->fetch();
}
