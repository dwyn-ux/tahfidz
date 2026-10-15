<?php
/**
 * Penyimpanan data terstruktur untuk Tahfidzku.
 *
 * Tabel `records` dari versi lama sengaja TIDAK disentuh oleh kelas ini.
 * Setelah migrasi selesai, tabel itu menjadi arsip rollback yang read-only;
 * aplikasi menggunakan tabel per-entitas di bawah ini.
 */
final class NormalizedStore {
    public const MIGRATION_NAME = '2026_10_normalize_records';
    // Penanda penambahan kolom/tabel setelah migrasi records (absensi per ustadz).
    public const UPGRADE_NAME = '2026_10_absensi_ustadz';

    /**
     * Pemetaan nama rekaman yang dipakai frontend ke tabel dan kolom SQL.
     * `metadata` menyimpan properti baru/tidak dikenal agar migrasi tidak
     * pernah membuang data saat aplikasi dikembangkan di masa depan.
     */
    public static function definitions(): array {
        static $definitions = null;
        if ($definitions !== null) return $definitions;

        $text = 'text'; $short = 'short'; $date = 'date';
        $integer = 'integer'; $boolean = 'boolean'; $timestamp = 'timestamp';
        $definitions = [
            'santri' => [
                'table' => 'santri',
                'fields' => [
                    'nama' => ['nama', $short], 'nis' => ['nis', $short], 'jk' => ['jk', $short],
                    'tglLahir' => ['tgl_lahir', $date], 'alamat' => ['alamat', $text],
                    'noHp' => ['no_hp', $short], 'namaWali' => ['nama_wali', $short],
                    'noHpWali' => ['no_hp_wali', $short], 'status' => ['status', $short],
                    'level' => ['level', $short], 'kelas' => ['kelas', $short],
                    'halaqah' => ['halaqah', $short], 'waliId' => ['wali_id', $short],
                ],
                'indexes' => [['nis'], ['wali_id'], ['halaqah']],
            ],
            'wali' => [
                'table' => 'wali',
                'fields' => [
                    'nama' => ['nama', $short], 'noHp' => ['no_hp', $short], 'santriId' => ['santri_id', $short],
                ],
                'indexes' => [['santri_id']],
            ],
            'ustadz' => [
                'table' => 'ustadz',
                'fields' => [
                    'nama' => ['nama', $short], 'noHp' => ['no_hp', $short], 'email' => ['email', $short],
                    'status' => ['status', $short], 'halaqah' => ['halaqah', $short],
                ],
                'indexes' => [['halaqah']],
            ],
            'halaqah' => [
                'table' => 'halaqah',
                'fields' => [
                    'nama' => ['nama', $short], 'ustadz' => ['ustadz', $short], 'ustadzId' => ['ustadz_id', $short],
                    'level' => ['level', $short], 'jumlahSantri' => ['jumlah_santri', $integer],
                    'hari' => ['hari', $short], 'jam' => ['jam', $short], 'ruangan' => ['ruangan', $short],
                    'setoranBacaan' => ['setoran_bacaan', $boolean],
                ],
                'indexes' => [['nama'], ['ustadz_id']],
            ],
            'kehadiran' => [
                'table' => 'kehadiran',
                'fields' => [
                    'santriId' => ['santri_id', $short], 'halaqahId' => ['halaqah_id', $short],
                    'ustadzId' => ['ustadz_id', $short],
                    'tanggal' => ['tanggal', $date], 'sesi' => ['sesi', $short], 'status' => ['status', $short],
                    '_created' => ['created_ms', $integer],
                ],
                // Several ustadz can teach one halaqah, so one session may hold
                // more than one row for the same santri. That combination is no
                // longer unique; recap always uses a single status per session.
                'indexes' => [
                    ['santri_id', 'tanggal'], ['halaqah_id', 'tanggal'],
                    ['ustadz_id', 'tanggal'], ['santri_id', 'ustadz_id', 'tanggal', 'sesi'],
                ],
            ],
            'absensiUstadz' => [
                'table' => 'absensi_ustadz',
                'fields' => [
                    'ustadzId' => ['ustadz_id', $short], 'ustadz' => ['ustadz', $short],
                    'halaqahId' => ['halaqah_id', $short], 'halaqah' => ['halaqah', $short],
                    'tanggal' => ['tanggal', $date], 'sesi' => ['sesi', $short],
                    'status' => ['status', $short], 'waktu' => ['waktu', $timestamp],
                    'catatan' => ['catatan', $text],
                ],
                'indexes' => [['tanggal', 'sesi'], ['halaqah_id', 'tanggal']],
                'unique' => [['ustadz_id', 'tanggal', 'sesi']],
            ],
            'jurnalTalim' => [
                'table' => 'jurnal_talim',
                'fields' => [
                    'tanggal' => ['tanggal', $date], 'ustadzId' => ['ustadz_id', $short], 'ustadz' => ['ustadz', $short],
                    'halaqah' => ['halaqah', $short], 'judulKitab' => ['judul_kitab', $short],
                    'bab' => ['bab', $short], 'pembahasan' => ['pembahasan', $text], 'halaman' => ['halaman', $short],
                ],
                'indexes' => [['tanggal'], ['ustadz_id', 'tanggal'], ['halaqah', 'tanggal']],
            ],
            'tahsin' => [
                'table' => 'tahsin',
                'fields' => [
                    'santriId' => ['santri_id', $short], 'ustadzId' => ['ustadz_id', $short],
                    'tanggal' => ['tanggal', $date], 'halAwal' => ['hal_awal', $integer],
                    'halAkhir' => ['hal_akhir', $integer], 'nilai' => ['nilai', $integer],
                    'catatan' => ['catatan', $text], '_created' => ['created_ms', $integer],
                ],
                'indexes' => [['santri_id', 'tanggal'], ['ustadz_id', 'tanggal']],
            ],
            'ziyadahBacaan' => [
                'table' => 'ziyadah_bacaan',
                'fields' => [
                    'santriId' => ['santri_id', $short], 'ustadzId' => ['ustadz_id', $short],
                    'tanggal' => ['tanggal', $date], 'sAwal' => ['surat_awal', $integer],
                    'aAwal' => ['ayat_awal', $integer], 'sAkhir' => ['surat_akhir', $integer],
                    'aAkhir' => ['ayat_akhir', $integer], '_created' => ['created_ms', $integer],
                ],
                'indexes' => [['santri_id', 'tanggal'], ['ustadz_id', 'tanggal']],
            ],
            'ziyadahHafalan' => [
                'table' => 'ziyadah_hafalan',
                'fields' => [
                    'santriId' => ['santri_id', $short], 'ustadzId' => ['ustadz_id', $short],
                    'tanggal' => ['tanggal', $date], 'sAwal' => ['surat_awal', $integer],
                    'aAwal' => ['ayat_awal', $integer], 'sAkhir' => ['surat_akhir', $integer],
                    'aAkhir' => ['ayat_akhir', $integer], 'nilai' => ['nilai', $integer],
                    'catatan' => ['catatan', $text], '_created' => ['created_ms', $integer],
                ],
                'indexes' => [['santri_id', 'tanggal'], ['ustadz_id', 'tanggal']],
            ],
            'mutqin' => [
                'table' => 'mutqin',
                'fields' => [
                    'santriId' => ['santri_id', $short], 'ustadzId' => ['ustadz_id', $short],
                    'tanggal' => ['tanggal', $date], 'sAwal' => ['surat_awal', $integer],
                    'aAwal' => ['ayat_awal', $integer], 'sAkhir' => ['surat_akhir', $integer],
                    'aAkhir' => ['ayat_akhir', $integer], 'nilai' => ['nilai', $integer],
                    'catatan' => ['catatan', $text], 'totalHafalan' => ['total_hafalan', $integer],
                    '_created' => ['created_ms', $integer],
                ],
                'indexes' => [['santri_id', 'tanggal'], ['ustadz_id', 'tanggal']],
            ],
            'catatan' => [
                'table' => 'catatan',
                'fields' => [
                    'santriId' => ['santri_id', $short], 'ustadzId' => ['ustadz_id', $short],
                    'tanggal' => ['tanggal', $date], 'isi' => ['isi', $text],
                ],
                'indexes' => [['santri_id', 'tanggal'], ['ustadz_id', 'tanggal']],
            ],
            'notifikasi' => [
                'table' => 'notifikasi',
                'fields' => [
                    'userId' => ['user_id', $short], 'tipe' => ['tipe', $short], 'kategori' => ['kategori', $short],
                    'santriId' => ['santri_id', $short], 'periode' => ['periode', $short],
                    'periodKey' => ['period_key', $short], 'pesan' => ['pesan', $text],
                    'tanggal' => ['tanggal', $timestamp], 'updatedAt' => ['updated_at', $timestamp],
                    'read' => ['is_read', $boolean],
                ],
                'indexes' => [['user_id', 'is_read', 'tanggal'], ['santri_id']],
            ],
            'logAktivitas' => [
                'table' => 'log_aktivitas',
                'fields' => [
                    'userId' => ['user_id', $short], 'aksi' => ['aksi', $text], 'tanggal' => ['tanggal', $timestamp],
                ],
                'indexes' => [['user_id', 'tanggal'], ['tanggal']],
            ],
            'logWa' => [
                'table' => 'log_wa',
                'fields' => [
                    'to' => ['recipient', $short], 'status' => ['status', $short], 'detail' => ['detail', $text],
                    'message' => ['message', $text], 'tanggal' => ['tanggal', $timestamp],
                ],
                'indexes' => [['tanggal'], ['recipient']],
            ],
        ];
        return $definitions;
    }

    public static function isActive(): bool {
        try {
            $stmt = pdo()->prepare('SELECT 1 FROM app_schema_migrations WHERE name = ?');
            $stmt->execute([self::MIGRATION_NAME]);
            return (bool)$stmt->fetchColumn();
        } catch (Throwable $e) {
            return false;
        }
    }

    /** Buat skema baru tanpa memodifikasi tabel legacy `records`. */
    public static function ensureSchema(): void {
        $db = pdo();
        if (DB_DRIVER === 'sqlite') {
            $db->exec('CREATE TABLE IF NOT EXISTS app_schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL, details TEXT NOT NULL)');
        } else {
            $db->exec('CREATE TABLE IF NOT EXISTS app_schema_migrations (name VARCHAR(100) PRIMARY KEY, applied_at VARCHAR(40) NOT NULL, details JSON NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        }

        foreach (self::definitions() as $definition) {
            $parts = [self::identifier('id') . ' ' . self::columnType('id') . ' PRIMARY KEY'];
            foreach ($definition['fields'] as $field) {
                [$column, $kind] = $field;
                $parts[] = self::identifier($column) . ' ' . self::columnType($kind) . ' NULL';
            }
            $parts[] = self::identifier('metadata') . ' ' . self::columnType('json') . ' NOT NULL';
            $table = self::identifier($definition['table']);
            $db->exec('CREATE TABLE IF NOT EXISTS ' . $table . ' (' . implode(', ', $parts) . ')');
            self::ensureColumns($definition);
            self::ensureIndexes($definition);
        }
    }

    /**
     * Basis data yang sudah aktif mungkin dibuat sebelum ada kolom/tabel baru.
     * `CREATE TABLE IF NOT EXISTS` tidak menambah kolom pada tabel lama, jadi
     * setiap kolom yang belum ada ditambahkan secara additive.
     */
    private static function ensureColumns(array $definition): void {
        foreach ($definition['fields'] as $field) {
            [$column, $kind] = $field;
            if (self::columnExists($definition['table'], $column)) continue;
            pdo()->exec('ALTER TABLE ' . self::identifier($definition['table'])
                . ' ADD COLUMN ' . self::identifier($column) . ' ' . self::columnType($kind) . ' NULL');
        }
    }

    private static function columnExists(string $table, string $column): bool {
        if (DB_DRIVER === 'sqlite') {
            $rows = pdo()->query('PRAGMA table_info(' . self::identifier($table) . ')')->fetchAll();
            foreach ($rows as $row) if (($row['name'] ?? '') === $column) return true;
            return false;
        }
        $stmt = pdo()->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?');
        $stmt->execute([$table, $column]);
        return (bool)$stmt->fetchColumn();
    }

    /**
     * Index unik lama tidak lagi berlaku setelah absensi bisa dipecah per
     * ustadz. Index itu dibuang supaya dua ustadz pada sesi yang sama tidak
     * saling menimpa atau saling ditolak database.
     */
    private static function obsoleteIndexes(string $table): array {
        return $table === 'kehadiran' ? ['idx_kehadiran_santri_id_tanggal_sesi'] : [];
    }

    private static function dropObsoleteIndexes(array $definition): void {
        $table = $definition['table'];
        foreach (self::obsoleteIndexes($table) as $name) {
            if (!self::indexExists($table, $name)) continue;
            $sql = DB_DRIVER === 'sqlite'
                ? 'DROP INDEX ' . self::identifier($name)
                : 'ALTER TABLE ' . self::identifier($table) . ' DROP INDEX ' . self::identifier($name);
            pdo()->exec($sql);
        }
    }

    /**
     * Terapkan penambahan kolom/tabel baru pada basis data yang sudah aktif.
     * Dijalankan sekali saja lewat penanda migrasi supaya request biasa tidak
     * melakukan DDL berulang.
     */
    public static function ensureUpgrade(): void {
        try {
            if (self::upgradeApplied()) return;
            if (!self::isActive()) return;
            self::ensureSchema();
            self::markApplied(self::UPGRADE_NAME, ['upgrade' => self::UPGRADE_NAME]);
        } catch (Throwable $e) {
            // Kegagalan upgrade tidak boleh memblokir aplikasi; request berikutnya
            // akan mencobanya lagi karena penanda belum tersimpan.
            error_log('[tahfidzku] upgrade skema gagal: ' . $e->getMessage());
        }
    }

    private static function upgradeApplied(): bool {
        $stmt = pdo()->prepare('SELECT 1 FROM app_schema_migrations WHERE name = ?');
        $stmt->execute([self::UPGRADE_NAME]);
        return (bool)$stmt->fetchColumn();
    }

    /** Tandai basis data baru sebagai aktif setelah skemanya tersedia. */
    public static function activateFreshDatabase(): void {
        self::ensureSchema();
        self::markApplied(self::MIGRATION_NAME, ['source' => 'fresh_install', 'records' => []]);
        self::markApplied(self::UPGRADE_NAME, ['upgrade' => self::UPGRADE_NAME]);
    }

    /**
     * Salin seluruh data lama secara atomik. Tidak ada DELETE/DROP pada
     * users/settings/records; jika validasi gagal, marker tidak diaktifkan.
     */
    public static function migrateLegacyRecords(): array {
        self::ensureSchema();
        if (self::isActive()) return ['status' => 'already_migrated', 'migration' => self::MIGRATION_NAME];
        if (!self::legacyRecordsTableExists()) {
            self::activateFreshDatabase();
            return ['status' => 'activated_empty_schema', 'migration' => self::MIGRATION_NAME];
        }

        $manualTransaction = self::beginMigrationTransaction();
        try {
            // Dua proses migrasi bisa saja dipanggil hampir bersamaan. Setelah
            // lock didapat, cek kembali marker sebelum menyentuh data apa pun.
            if (self::isActive()) {
                self::commitMigrationTransaction($manualTransaction);
                return ['status' => 'already_migrated', 'migration' => self::MIGRATION_NAME];
            }
            $legacy = [];
            foreach (array_keys(self::definitions()) as $type) $legacy[$type] = self::legacyRecords($type);
            self::validateLegacyRecords($legacy);
            self::assertDestinationIsEmpty();
            foreach ($legacy as $type => $records) {
                foreach ($records as $record) self::put($type, $record['id'], $record);
            }
            $counts = [];
            foreach ($legacy as $type => $records) {
                $actual = self::count($type);
                $expected = count($records);
                if ($actual !== $expected) throw new RuntimeException("Validasi jumlah $type gagal: $actual dari $expected tersalin.");
                $counts[$type] = $actual;
            }
            self::markApplied(self::MIGRATION_NAME, ['source' => 'legacy_records', 'records' => $counts]);
            self::commitMigrationTransaction($manualTransaction);
            return ['status' => 'migrated', 'migration' => self::MIGRATION_NAME, 'records' => $counts];
        } catch (Throwable $e) {
            self::rollBackMigrationTransaction($manualTransaction);
            throw $e;
        }
    }

    public static function getRecords(string $type): array {
        $definition = self::definition($type);
        $stmt = pdo()->query('SELECT * FROM ' . self::identifier($definition['table']));
        $records = [];
        foreach ($stmt->fetchAll() as $row) $records[] = self::hydrate($definition, $row);
        return $records;
    }

    public static function getRecord(string $type, string $id): ?array {
        $definition = self::definition($type);
        $stmt = pdo()->prepare('SELECT * FROM ' . self::identifier($definition['table']) . ' WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ? self::hydrate($definition, $row) : null;
    }

    public static function put(string $type, string $id, array $record): void {
        $definition = self::definition($type);
        $record = self::normalizeRecord($type, $id, $record);
        $columns = ['id'];
        $values = [$id];
        $known = ['id' => true];
        foreach ($definition['fields'] as $property => [$column, $kind]) {
            $columns[] = $column;
            $values[] = self::toDatabaseValue($record[$property] ?? null, $kind);
            $known[$property] = true;
        }
        $metadata = array_diff_key($record, $known);
        // Bedakan properti yang memang bernilai null dari properti yang tidak
        // ada sama sekali. Ini menjaga bentuk data legacy tetap utuh.
        foreach ($definition['fields'] as $property => $_field) {
            if (array_key_exists($property, $record) && $record[$property] === null) $metadata[$property] = null;
        }
        $columns[] = 'metadata';
        $values[] = json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $sql = upsertSQL($definition['table'], $columns);
        pdo()->prepare($sql)->execute($values);
    }

    public static function delete(string $type, string $id): void {
        $definition = self::definition($type);
        pdo()->prepare('DELETE FROM ' . self::identifier($definition['table']) . ' WHERE id = ?')->execute([$id]);
    }

    /** Hanya menghapus data aktif hasil migrasi; arsip `records` tetap ada. */
    public static function clearCurrentRecords(): void {
        $db = pdo();
        $db->beginTransaction();
        try {
            foreach (self::definitions() as $definition) $db->exec('DELETE FROM ' . self::identifier($definition['table']));
            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw $e;
        }
    }

    private static function definition(string $type): array {
        $definitions = self::definitions();
        if (!isset($definitions[$type])) throw new InvalidArgumentException('Tipe data tidak dikenal: ' . $type);
        return $definitions[$type];
    }

    private static function normalizeRecord(string $type, string $id, array $record): array {
        $record['id'] = $id;
        // Versi awal absensi belum punya sesi; samakan perilakunya dengan
        // Store.load() agar unique index dapat dipasang tanpa mengubah makna data.
        if ($type === 'kehadiran' && empty($record['sesi'])) $record['sesi'] = 'Subuh';
        return $record;
    }

    private static function hydrate(array $definition, array $row): array {
        $metadata = json_decode($row['metadata'] ?? '{}', true);
        $record = is_array($metadata) ? $metadata : [];
        foreach ($definition['fields'] as $property => [$column, $kind]) {
            if (!array_key_exists($column, $row) || $row[$column] === null) continue;
            $record[$property] = self::fromDatabaseValue($row[$column], $kind);
        }
        $record['id'] = $row['id'];
        return $record;
    }

    private static function toDatabaseValue($value, string $kind) {
        if ($value === null) return null;
        if ($kind === 'integer') return $value === '' ? null : (int)$value;
        if ($kind === 'boolean') return $value ? 1 : 0;
        return (string)$value;
    }

    private static function fromDatabaseValue($value, string $kind) {
        if ($kind === 'integer') return (int)$value;
        if ($kind === 'boolean') return (bool)$value;
        return $value;
    }

    private static function columnType(string $kind): string {
        $sqlite = DB_DRIVER === 'sqlite';
        return match ($kind) {
            'id' => $sqlite ? 'TEXT' : 'VARCHAR(64)',
            'short' => $sqlite ? 'TEXT' : 'VARCHAR(255)',
            'date' => $sqlite ? 'TEXT' : 'DATE',
            'timestamp' => $sqlite ? 'TEXT' : 'VARCHAR(40)',
            'integer' => $sqlite ? 'INTEGER' : 'INT',
            'boolean' => $sqlite ? 'INTEGER' : 'TINYINT(1)',
            'json' => $sqlite ? 'TEXT' : 'JSON',
            default => 'TEXT',
        };
    }

    private static function ensureIndexes(array $definition): void {
        $table = $definition['table'];
        self::dropObsoleteIndexes($definition);
        foreach ([['indexes', false], ['unique', true]] as [$key, $unique]) {
            foreach ($definition[$key] ?? [] as $columns) {
                $name = 'idx_' . $table . '_' . implode('_', $columns);
                if (self::indexExists($table, $name)) continue;
                $sql = 'CREATE ' . ($unique ? 'UNIQUE ' : '') . 'INDEX ' . self::identifier($name)
                    . ' ON ' . self::identifier($table) . ' (' . implode(', ', array_map([self::class, 'identifier'], $columns)) . ')';
                pdo()->exec($sql);
            }
        }
    }

    private static function indexExists(string $table, string $name): bool {
        if (DB_DRIVER === 'sqlite') {
            $rows = pdo()->query('PRAGMA index_list(' . self::identifier($table) . ')')->fetchAll();
            foreach ($rows as $row) if (($row['name'] ?? '') === $name) return true;
            return false;
        }
        $stmt = pdo()->prepare('SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?');
        $stmt->execute([$table, $name]);
        return (bool)$stmt->fetchColumn();
    }

    private static function legacyRecordsTableExists(): bool {
        if (DB_DRIVER === 'sqlite') {
            $stmt = pdo()->prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'records'");
            $stmt->execute();
            return (bool)$stmt->fetchColumn();
        }
        $stmt = pdo()->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?');
        $stmt->execute(['records']);
        return (bool)$stmt->fetchColumn();
    }

    /**
     * Kunci penulisan legacy sebelum snapshot dibaca. SQLite memakai
     * BEGIN IMMEDIATE; MySQL/InnoDB mengunci seluruh rows+gap records dengan
     * FOR UPDATE. Dengan begitu tidak ada simpanan yang lolos di antara copy
     * data dan aktivasi marker skema baru.
     */
    private static function beginMigrationTransaction(): bool {
        $db = pdo();
        if (DB_DRIVER === 'sqlite') {
            $db->exec('BEGIN IMMEDIATE');
            return true;
        }
        $db->beginTransaction();
        $db->query('SELECT id FROM records FOR UPDATE')->fetchAll();
        return false;
    }

    private static function commitMigrationTransaction(bool $manualTransaction): void {
        if ($manualTransaction) {
            pdo()->exec('COMMIT');
            return;
        }
        if (pdo()->inTransaction()) pdo()->commit();
    }

    private static function rollBackMigrationTransaction(bool $manualTransaction): void {
        try {
            if ($manualTransaction) {
                pdo()->exec('ROLLBACK');
                return;
            }
            if (pdo()->inTransaction()) pdo()->rollBack();
        } catch (Throwable $ignored) {
            // Pertahankan error migrasi asal; error rollback tidak perlu bocor.
        }
    }

    private static function legacyRecords(string $type): array {
        $stmt = pdo()->prepare('SELECT id, data FROM records WHERE type = ?');
        $stmt->execute([$type]);
        $records = [];
        foreach ($stmt->fetchAll() as $row) {
            $record = json_decode($row['data'], true);
            if (!is_array($record)) throw new RuntimeException('Data legacy tidak valid pada ' . $type . ' ID ' . $row['id']);
            $record['id'] = $row['id'];
            $records[] = self::normalizeRecord($type, $row['id'], $record);
        }
        return $records;
    }

    private static function validateLegacyRecords(array $legacy): void {
        // Constraint absensi lama hanya menolak duplikat untuk satu pasangan
        // (santri, tanggal, sesi) karena saat itu satu sesi hanya boleh punya
        // satu catatan. Sekarang setiap ustadz punya catatannya sendiri, jadi
        // pencacahannya ikut memasukkan ustadzId.
        $seen = [];
        foreach ($legacy['kehadiran'] ?? [] as $record) {
            $key = implode('|', [
                $record['santriId'] ?? '', $record['ustadzId'] ?? '',
                $record['tanggal'] ?? '', $record['sesi'] ?? 'Subuh',
            ]);
            if (isset($seen[$key])) throw new RuntimeException('Absensi ganda ditemukan untuk ' . $key . '. Migrasi dibatalkan; tabel lama tetap utuh.');
            $seen[$key] = true;
        }
    }

    private static function assertDestinationIsEmpty(): void {
        foreach (array_keys(self::definitions()) as $type) {
            if (self::count($type) > 0) throw new RuntimeException('Tabel tujuan ' . self::definition($type)['table'] . ' sudah berisi data. Migrasi tidak dijalankan untuk menjaga data yang ada.');
        }
    }

    private static function count(string $type): int {
        $definition = self::definition($type);
        return (int)pdo()->query('SELECT COUNT(*) FROM ' . self::identifier($definition['table']))->fetchColumn();
    }

    private static function markApplied(string $name, array $details): void {
        $stmt = pdo()->prepare(insertIgnoreSQL('app_schema_migrations', ['name', 'applied_at', 'details']));
        $stmt->execute([$name, nowISO(), json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
    }

    private static function identifier(string $name): string {
        if (!preg_match('/^[a-z_][a-z0-9_]*$/', $name)) throw new InvalidArgumentException('Identifier SQL tidak valid.');
        return DB_DRIVER === 'sqlite' ? '"' . $name . '"' : '`' . $name . '`';
    }
}
