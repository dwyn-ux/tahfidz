<?php
/**
 * Migrasi satu kali seluruh data dari SQLite ke MySQL (atau ekspor .sql untuk phpMyAdmin).
 *
 * Aman dijalankan ulang: memakai CREATE TABLE IF NOT EXISTS dan ON DUPLICATE KEY UPDATE
 * (atau INSERT IGNORE jika --ignore), serta tidak pernah menghapus data SQLite sumber.
 *
 * CLI:
 *   php api/sqlite_to_mysql.php                                  (migrasi langsung ke MySQL sesuai api/.env)
 *   php api/sqlite_to_mysql.php --sqlite=/path/ke/file.sqlite    (pilih sumber SQLite tertentu)
 *   php api/sqlite_to_mysql.php --sql-out=tahfidzku_mysql.sql    (ekspor file .sql untuk import phpMyAdmin)
 *   php api/sqlite_to_mysql.php --dry-run                        (cek sumber & rencana tabel tanpa menulis)
 *
 * Web:
 *   api/sqlite_to_mysql.php?token=<MIGRATION_TOKEN>
 *   api/sqlite_to_mysql.php?token=<MIGRATION_TOKEN>&format=sql
 */
require_once __DIR__ . '/config.php';

$migrationToken = $envVars['MIGRATION_TOKEN'] ?? '';
$isCli = (PHP_SAPI === 'cli');
if (!$isCli) {
    if ($migrationToken === '') err('Migrasi web dinonaktifkan. Set MIGRATION_TOKEN di api/.env atau jalankan via CLI.', 403);
    $providedToken = $_GET['token'] ?? '';
    if (!hash_equals($migrationToken, $providedToken)) err('Token migrasi tidak valid.', 403);
}

function cliArg(array $argv, string $name, ?string $default = null): ?string {
    $prefix = '--' . $name . '=';
    foreach ($argv as $arg) {
        if ($arg === '--' . $name) return '1';
        if (strpos($arg, $prefix) === 0) return substr($arg, strlen($prefix));
    }
    return $default;
}

function mysqlType(string $kind): string {
    return match ($kind) {
        'id' => 'VARCHAR(64)',
        'short' => 'VARCHAR(255)',
        'date' => 'DATE',
        'timestamp' => 'VARCHAR(40)',
        'integer' => 'INT',
        'boolean' => 'TINYINT(1)',
        'json' => 'JSON',
        default => 'TEXT',
    };
}

function sanitizeValue($val, string $kind) {
    if ($val === null) return null;
    if ($kind === 'date') {
        $s = trim((string)$val);
        if ($s === '') return null;
        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $s, $m)) return $m[0];
        return null;
    }
    if ($kind === 'integer') {
        if ($val === '') return null;
        return is_numeric($val) ? (int)$val : null;
    }
    if ($kind === 'boolean') {
        return ($val === true || $val === 1 || $val === '1' || $val === 'true') ? 1 : 0;
    }
    if ($kind === 'json') {
        $s = trim((string)$val);
        if ($s === '') return '[]';
        json_decode($s);
        return (json_last_error() === JSON_ERROR_NONE) ? $s : json_encode($val, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    return (string)$val;
}

function sqliteTables(PDO $sqlite): array {
    return $sqlite->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        ->fetchAll(PDO::FETCH_COLUMN);
}

function sqliteColumns(PDO $sqlite, string $table): array {
    $rows = $sqlite->query('PRAGMA table_info("' . str_replace('"', '""', $table) . '")')->fetchAll();
    return array_map(fn($r) => $r['name'], $rows);
}

function sqlLiteral($val): string {
    if ($val === null) return 'NULL';
    if (is_int($val) || is_float($val)) return (string)$val;
    $s = (string)$val;
    $s = str_replace(['\\', "\0", "\n", "\r", "'", '"', "\x1a"], ['\\\\', '\\0', '\\n', '\\r', "\\'", '\\"', '\\Z'], $s);
    return "'" . $s . "'";
}

function buildSchemaStatements(array $existingSqliteTables): array {
    $ddl = [];
    $ddl[] = "CREATE TABLE IF NOT EXISTS `users` (`id` VARCHAR(64) PRIMARY KEY, `username` VARCHAR(255) NOT NULL, `password` VARCHAR(255) NOT NULL, `role` VARCHAR(32) NOT NULL, `refId` VARCHAR(64) NULL, UNIQUE KEY `idx_users_username` (`username`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
    $ddl[] = "CREATE TABLE IF NOT EXISTS `settings` (`id` INT PRIMARY KEY, `data` LONGTEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
    $ddl[] = "CREATE TABLE IF NOT EXISTS `app_schema_migrations` (`name` VARCHAR(100) PRIMARY KEY, `applied_at` VARCHAR(40) NOT NULL, `details` JSON NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
    if (in_array('records', $existingSqliteTables, true)) {
        $ddl[] = "CREATE TABLE IF NOT EXISTS `records` (`id` VARCHAR(64) PRIMARY KEY, `type` VARCHAR(64) NOT NULL, `data` LONGTEXT NOT NULL, INDEX `idx_records_type` (`type`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
    }

    foreach (NormalizedStore::definitions() as $def) {
        $table = $def['table'];
        $cols = ['`id` VARCHAR(64) PRIMARY KEY'];
        foreach ($def['fields'] as [$col, $kind]) {
            $cols[] = "`{$col}` " . mysqlType($kind) . ' NULL';
        }
        $cols[] = '`metadata` JSON NOT NULL';
        $ddl[] = "CREATE TABLE IF NOT EXISTS `{$table}` (" . implode(', ', $cols) . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    }
    return $ddl;
}

function buildIndexSpecs(): array {
    $specs = [];
    foreach (NormalizedStore::definitions() as $def) {
        $table = $def['table'];
        foreach ([['indexes', false], ['unique', true]] as [$key, $unique]) {
            foreach ($def[$key] ?? [] as $columns) {
                $name = 'idx_' . $table . '_' . implode('_', $columns);
                $specs[] = ['table' => $table, 'name' => $name, 'unique' => $unique, 'columns' => $columns];
            }
        }
    }
    return $specs;
}

function buildTableDescriptors(array $existingSqliteTables): array {
    $tables = [
        'users' => ['id' => 'id', 'username' => 'short', 'password' => 'short', 'role' => 'short', 'refId' => 'id'],
        'settings' => ['id' => 'integer', 'data' => 'text'],
        'app_schema_migrations' => ['name' => 'short', 'applied_at' => 'timestamp', 'details' => 'json'],
    ];
    if (in_array('records', $existingSqliteTables, true)) {
        $tables['records'] = ['id' => 'id', 'type' => 'short', 'data' => 'text'];
    }
    foreach (NormalizedStore::definitions() as $def) {
        $cols = ['id' => 'id'];
        foreach ($def['fields'] as [$col, $kind]) {
            $cols[$col] = $kind;
        }
        $cols['metadata'] = 'json';
        $tables[$def['table']] = $cols;
    }
    return $tables;
}

try {
    $argvList = $isCli ? ($argv ?? []) : [];
    $sqlitePath = $isCli ? (cliArg($argvList, 'sqlite', DB_SQLITE_PATH)) : DB_SQLITE_PATH;
    $sqlOut = $isCli ? cliArg($argvList, 'sql-out') : (($_GET['format'] ?? '') === 'sql' ? 'php://output' : null);
    $dryRun = $isCli && cliArg($argvList, 'dry-run') !== null;

    if (!file_exists($sqlitePath)) {
        throw new RuntimeException('File SQLite tidak ditemukan: ' . $sqlitePath);
    }

    $sqlite = new PDO('sqlite:' . $sqlitePath, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $existingTables = sqliteTables($sqlite);
    $ddlStatements = buildSchemaStatements($existingTables);
    $indexSpecs = buildIndexSpecs();
    $descriptors = buildTableDescriptors($existingTables);

    $summary = [];
    foreach ($descriptors as $table => $colKinds) {
        if (!in_array($table, $existingTables, true)) {
            $summary[$table] = 0;
            continue;
        }
        $summary[$table] = (int)$sqlite->query('SELECT COUNT(*) FROM "' . str_replace('"', '""', $table) . '"')->fetchColumn();
    }

    if ($dryRun) {
        $out = ['ok' => true, 'mode' => 'dry-run', 'sqlite' => $sqlitePath, 'counts' => $summary];
        if ($isCli) { echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL; exit(0); }
        send($out);
    }

    if ($sqlOut !== null) {
        $fh = fopen($sqlOut, 'wb');
        if ($fh === false) throw new RuntimeException('Gagal membuka file output SQL: ' . $sqlOut);
        if (!$isCli) {
            header('Content-Type: application/sql; charset=utf-8');
            header('Content-Disposition: attachment; filename="tahfidzku_mysql_' . date('Ymd_His') . '.sql"');
        }
        fwrite($fh, "-- Tahfidzku SQLite -> MySQL Dump\n-- Source: " . basename($sqlitePath) . "\n-- Generated: " . nowISO() . "\n\n");
        fwrite($fh, "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n\n");
        foreach ($ddlStatements as $sql) {
            fwrite($fh, $sql . ";\n");
        }
        fwrite($fh, "\n");
        foreach ($descriptors as $table => $colKinds) {
            if (!in_array($table, $existingTables, true)) continue;
            $srcCols = sqliteColumns($sqlite, $table);
            $cols = array_values(array_filter(array_keys($colKinds), fn($c) => in_array($c, $srcCols, true)));
            if (!$cols) continue;
            $rows = $sqlite->query('SELECT ' . implode(', ', array_map(fn($c) => '"' . str_replace('"', '""', $c) . '"', $cols)) . ' FROM "' . str_replace('"', '""', $table) . '"')->fetchAll();
            if (!$rows) continue;
            $colSql = implode(', ', array_map(fn($c) => "`{$c}`", $cols));
            $updSql = implode(', ', array_map(fn($c) => "`{$c}` = VALUES(`{$c}`)", $cols));
            foreach ($rows as $row) {
                $vals = [];
                foreach ($cols as $c) {
                    $vals[] = sqlLiteral(sanitizeValue($row[$c] ?? null, $colKinds[$c]));
                }
                fwrite($fh, "INSERT INTO `{$table}` ({$colSql}) VALUES (" . implode(', ', $vals) . ") ON DUPLICATE KEY UPDATE {$updSql};\n");
            }
            fwrite($fh, "\n");
        }
        foreach ($indexSpecs as $ix) {
            $u = $ix['unique'] ? 'UNIQUE ' : '';
            $c = implode(', ', array_map(fn($col) => "`{$col}`", $ix['columns']));
            fwrite($fh, "CREATE {$u}INDEX `{$ix['name']}` ON `{$ix['table']}` ({$c});\n");
        }
        fwrite($fh, "\nSET FOREIGN_KEY_CHECKS=1;\n");
        fclose($fh);
        if ($isCli) {
            echo json_encode(['ok' => true, 'mode' => 'sql-export', 'file' => $sqlOut, 'counts' => $summary], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
        }
        exit(0);
    }

    $host = $isCli ? cliArg($argvList, 'host', DB_HOST) : DB_HOST;
    $port = $isCli ? cliArg($argvList, 'port', $envVars['DB_PORT'] ?? '3306') : ($envVars['DB_PORT'] ?? '3306');
    $dbName = $isCli ? cliArg($argvList, 'db', DB_NAME) : DB_NAME;
    $dbUser = $isCli ? cliArg($argvList, 'user', DB_USER) : DB_USER;
    $dbPass = $isCli ? cliArg($argvList, 'pass', DB_PASS) : DB_PASS;

    $dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset=" . DB_CHARSET;
    $mysql = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    foreach ($ddlStatements as $sql) {
        $mysql->exec($sql);
    }
    $roleCol = $mysql->query("SHOW COLUMNS FROM `users` LIKE 'role'")->fetch();
    if ($roleCol && stripos((string)($roleCol['Type'] ?? ''), 'enum') !== false && stripos((string)$roleCol['Type'], 'superuser') === false) {
        $mysql->exec("ALTER TABLE `users` MODIFY COLUMN `role` VARCHAR(32) NOT NULL");
    }
    $colCheck = $mysql->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?');
    foreach ($descriptors as $table => $colKinds) {
        foreach ($colKinds as $col => $kind) {
            if ($col === 'id') continue;
            $colCheck->execute([$table, $col]);
            if ($colCheck->fetchColumn()) continue;
            $typeSql = ($table === 'settings' && $col === 'data') ? 'LONGTEXT' : mysqlType($kind);
            $mysql->exec("ALTER TABLE `{$table}` ADD COLUMN `{$col}` {$typeSql} NULL");
        }
    }
    $statCheck = $mysql->prepare('SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?');
    $statCheck->execute(['kehadiran', 'idx_kehadiran_santri_id_tanggal_sesi']);
    if ($statCheck->fetchColumn()) {
        $mysql->exec('ALTER TABLE `kehadiran` DROP INDEX `idx_kehadiran_santri_id_tanggal_sesi`');
    }
    foreach ($indexSpecs as $ix) {
        $statCheck->execute([$ix['table'], $ix['name']]);
        if (!$statCheck->fetchColumn()) {
            $u = $ix['unique'] ? 'UNIQUE ' : '';
            $c = implode(', ', array_map(fn($col) => "`{$col}`", $ix['columns']));
            $mysql->exec("CREATE {$u}INDEX `{$ix['name']}` ON `{$ix['table']}` ({$c})");
        }
    }

    $mysql->beginTransaction();
    $copied = [];
    try {
        foreach ($descriptors as $table => $colKinds) {
            if (!in_array($table, $existingTables, true)) {
                $copied[$table] = 0;
                continue;
            }
            $srcCols = sqliteColumns($sqlite, $table);
            $cols = array_values(array_filter(array_keys($colKinds), fn($c) => in_array($c, $srcCols, true)));
            if (!$cols) {
                $copied[$table] = 0;
                continue;
            }
            $rows = $sqlite->query('SELECT ' . implode(', ', array_map(fn($c) => '"' . str_replace('"', '""', $c) . '"', $cols)) . ' FROM "' . str_replace('"', '""', $table) . '"')->fetchAll();
            if (!$rows) {
                $copied[$table] = 0;
                continue;
            }
            $colSql = implode(', ', array_map(fn($c) => "`{$c}`", $cols));
            $placeholders = implode(', ', array_fill(0, count($cols), '?'));
            $updSql = implode(', ', array_map(fn($c) => "`{$c}` = VALUES(`{$c}`)", $cols));
            $stmt = $mysql->prepare("INSERT INTO `{$table}` ({$colSql}) VALUES ({$placeholders}) ON DUPLICATE KEY UPDATE {$updSql}");
            foreach ($rows as $row) {
                $params = [];
                foreach ($cols as $c) {
                    $params[] = sanitizeValue($row[$c] ?? null, $colKinds[$c]);
                }
                $stmt->execute($params);
            }
            $copied[$table] = count($rows);
        }
        $mysql->commit();
    } catch (Throwable $e) {
        if ($mysql->inTransaction()) $mysql->rollBack();
        throw $e;
    }

    $out = ['ok' => true, 'mode' => 'mysql-direct', 'sqlite' => $sqlitePath, 'database' => $dbName, 'copied' => $copied];
    if ($isCli) { echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL; exit(0); }
    send($out);
} catch (Throwable $e) {
    error_log('[tahfidzku sqlite_to_mysql] ' . $e->getMessage());
    if (PHP_SAPI === 'cli') {
        fwrite(STDERR, 'Migrasi gagal: ' . $e->getMessage() . PHP_EOL);
        exit(1);
    }
    err('Migrasi gagal: ' . $e->getMessage(), 500);
}
