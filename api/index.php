<?php
/**
 * Tahfidzku — REST API entry point (single file, shared-hosting friendly).
 * All requests: /api/index.php?action=...
 */
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';

switch ($action) {

    /* ---------------- AUTH ---------------- */
    case 'login':
        $b = body();
        $u = getUserByUsername($b['username'] ?? '');
        if (!$u || !password_verify($b['password'] ?? '', $u['password'])) {
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
        $stmt = pdo()->prepare('UPDATE users SET password = ? WHERE id = ?');
        $stmt->execute([password_hash($b['new'], PASSWORD_DEFAULT), $u['uid']]);
        send(['ok' => true]);
        break;

    /* ---------------- BOOTSTRAP (all data) ---------------- */
    case 'bootstrap':
        $u = requireAuth();
        send(['user' => ['id' => $u['uid'], 'role' => $u['role'], 'refId' => $u['refId']], 'db' => bootstrapData($u)]);
        break;

    /* ---------------- RECORDS CRUD ---------------- */
    case 'records':
        $u = requireAuth();
        $type = preg_replace('/[^a-zA-Z]/', '', $_GET['type'] ?? '');
        if (!$type) err('type required', 400);

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            send(getRecords($type));
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

    /* ---------------- SETTINGS ---------------- */
    case 'settings':
        $u = requireAuth();
        if ($u['role'] !== 'admin') err('Forbidden', 403);
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
        $u = requireAuth();
        if ($u['role'] !== 'admin') err('Forbidden', 403);
        // clear all records + settings, keep users
        pdo()->exec('DELETE FROM records');
        pdo()->exec('DELETE FROM settings');
        saveSettings(defaultSettings());
        send(['ok' => true]);
        break;

    /* ---------------- SAVE (persist full db) ---------------- */
    case 'save':
        $u = requireAuth();
        $b = body();
        $types = ['santri','wali','ustadz','halaqah','kehadiran','tahsin','ziyadahBacaan','ziyadahHafalan','mutqin','catatan','notifikasi','logAktivitas'];
        foreach ($types as $t) {
            if (!isset($b[$t]) || !is_array($b[$t])) continue;
            $keep = [];
            foreach ($b[$t] as $rec) {
                $id = $rec['id'] ?? uid($t);
                $keep[] = $id;
                putRecord($t, $id, $rec);
            }
            // reconcile deletions: remove server rows not in payload
            $stmt = pdo()->prepare('SELECT id FROM records WHERE type = ?');
            $stmt->execute([$t]);
            foreach ($stmt->fetchAll() as $row) {
                if (!in_array($row['id'], $keep, true)) delRecord($t, $row['id']);
            }
        }
        if (isset($b['settings']) && is_array($b['settings'])) {
            saveSettings($b['settings']);
        }
        // users (no password overwrite from client)
        if (isset($b['users']) && is_array($b['users'])) {
            foreach ($b['users'] as $usr) {
                if (empty($usr['id'])) continue;
                $stmt = pdo()->prepare('UPDATE users SET username=?, role=?, refId=? WHERE id=?');
                $stmt->execute([$usr['username'] ?? '', $usr['role'] ?? 'wali', $usr['refId'] ?? null, $usr['id']]);
            }
        }
        send(['ok' => true]);
        break;

    default:
        err('Unknown action', 404);
}

function getUserById($id) {
    $stmt = pdo()->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$id]);
    return $stmt->fetch();
}
