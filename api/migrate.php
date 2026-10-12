<?php
/**
 * Migrasi satu arah dari tabel legacy `records` ke tabel per-entitas.
 *
 * Aman dijalankan ulang: bila sudah selesai, hanya mengembalikan status.
 * Script ini TIDAK pernah DELETE atau DROP tabel users/settings/records.
 *
 * CLI: php api/migrate.php
 * Web: api/migrate.php?token=<MIGRATION_TOKEN>
 */
require_once __DIR__ . '/config.php';

$migrationToken = $envVars['MIGRATION_TOKEN'] ?? '';
if (PHP_SAPI !== 'cli') {
    if ($migrationToken === '') err('Migrasi web dinonaktifkan. Set MIGRATION_TOKEN di api/.env atau jalankan via CLI.', 403);
    $providedToken = $_GET['token'] ?? '';
    if (!hash_equals($migrationToken, $providedToken)) err('Token migrasi tidak valid.', 403);
}

try {
    $result = NormalizedStore::migrateLegacyRecords();
    send(array_merge(['ok' => true], $result));
} catch (Throwable $e) {
    error_log('[tahfidzku migration] ' . $e->getMessage());
    err('Migrasi dibatalkan: ' . $e->getMessage(), 409);
}
