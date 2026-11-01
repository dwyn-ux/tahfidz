<?php

function laporanDataForUser(array $user, array $filters): array {
    $from = trim((string)($filters['dari'] ?? ''));
    $to = trim((string)($filters['sampai'] ?? ''));
    if (($from !== '') !== ($to !== '')) err('Rentang tanggal laporan harus lengkap.', 400);
    if ($from !== '') {
        foreach ([$from, $to] as $date) {
            $parts = explode('-', $date);
            if (count($parts) !== 3 || !checkdate((int)$parts[1], (int)$parts[2], (int)$parts[0])) {
                err('Tanggal laporan tidak valid.', 400);
            }
        }
        if ($from > $to) err('Tanggal awal laporan tidak boleh melewati tanggal akhir.', 400);
        $periodFrom = $from;
        $periodTo = $to;
    } else {
        $month = (string)($filters['bulan'] ?? date('Y-m'));
        if (!preg_match('/^(\d{4})-(\d{2})$/', $month, $parts) || !checkdate((int)$parts[2], 1, (int)$parts[1])) {
            err('Bulan laporan tidak valid.', 400);
        }
        $periodFrom = $month . '-01';
        $periodTo = date('Y-m-t', strtotime($periodFrom));
    }

    $allSantri = getRecords('santri');
    $halaqahRows = getRecords('halaqah');
    $halaqahByReference = [];
    foreach ($halaqahRows as $halaqah) {
        if (!empty($halaqah['id'])) $halaqahByReference[(string)$halaqah['id']] = $halaqah;
        if (!empty($halaqah['nama'])) $halaqahByReference[(string)$halaqah['nama']] = $halaqah;
    }

    $settings = publicSettings(getSettings(), $user['role']);
    $availableTingkat = is_array($settings['tingkat'] ?? null) ? $settings['tingkat'] : ['TPQ', 'SD', 'SMP', 'SMA'];
    $ownedHalaqah = [];
    if ($user['role'] === 'ustadz') {
        $teacher = getRecord('ustadz', (string)($user['refId'] ?? ''));
        $teacherName = (string)($teacher['nama'] ?? '');
        foreach ($halaqahRows as $halaqah) {
            $ids = $halaqah['ustadzIds'] ?? [];
            $names = $halaqah['ustadzNames'] ?? [];
            if (!is_array($ids)) $ids = [];
            if (!is_array($names)) $names = [];
            if (!empty($halaqah['ustadzId'])) $ids[] = $halaqah['ustadzId'];
            if (!$names && !empty($halaqah['ustadz'])) $names[] = $halaqah['ustadz'];
            if (in_array($user['refId'], $ids, true) || ($teacherName !== '' && in_array($teacherName, $names, true))) {
                $ownedHalaqah[(string)$halaqah['id']] = true;
                $ownedHalaqah[(string)$halaqah['nama']] = true;
            }
        }
        if ($teacher && !empty($teacher['halaqah'])) {
            $reference = (string)$teacher['halaqah'];
            if (isset($halaqahByReference[$reference])) {
                $ownedHalaqah[(string)$halaqahByReference[$reference]['id']] = true;
                $ownedHalaqah[(string)$halaqahByReference[$reference]['nama']] = true;
            } elseif (!$ownedHalaqah) {
                $ownedHalaqah[$reference] = true;
            }
        }
    }

    $selectedHalaqah = trim((string)($filters['halaqah'] ?? ''));
    $selectedProgram = trim((string)($filters['level'] ?? ''));
    $selectedTingkat = trim((string)($filters['tingkat'] ?? ''));
    $selectedKelas = trim((string)($filters['kelas'] ?? ''));
    $selectedStatus = trim((string)($filters['status'] ?? ''));
    $santriIds = [];
    foreach ($allSantri as $santri) {
        $id = (string)($santri['id'] ?? '');
        if ($id === '' || ($selectedStatus !== '' && ($santri['status'] ?? '') !== $selectedStatus)) continue;

        $programs = $santri['programAktif'] ?? [];
        if (!is_array($programs)) $programs = [];
        $programs = array_values(array_unique(array_filter($programs, 'is_string')));
        if (!$programs && !empty($santri['level'])) $programs = [(string)$santri['level']];
        if ($selectedProgram !== '' && !in_array($selectedProgram, $programs, true)) continue;

        $assignments = $santri['halaqahProgram'] ?? [];
        if (!is_array($assignments)) $assignments = [];
        $references = [];
        foreach ($programs as $program) {
            $reference = $assignments[$program] ?? (($program === ($santri['level'] ?? '') ? ($santri['halaqah'] ?? '') : ''));
            if ($reference !== '') $references[] = (string)$reference;
        }
        if (!empty($santri['halaqah'])) $references[] = (string)$santri['halaqah'];
        $assignedHalaqah = [];
        foreach (array_unique($references) as $reference) {
            $target = $halaqahByReference[$reference] ?? null;
            if ($target) {
                $assignedHalaqah[(string)$target['id']] = true;
                $assignedHalaqah[(string)$target['nama']] = true;
            }
        }
        if ($selectedHalaqah !== '' && !isset($assignedHalaqah[$selectedHalaqah])) continue;
        if ($user['role'] === 'ustadz') {
            $authorized = false;
            foreach ($assignedHalaqah as $reference => $_) {
                if (isset($ownedHalaqah[$reference])) { $authorized = true; break; }
            }
            if (!$authorized) continue;
        }

        $storedKelas = trim((string)($santri['kelas'] ?? ''));
        $tingkat = in_array($santri['tingkat'] ?? '', $availableTingkat, true) ? $santri['tingkat'] : '';
        if (!$tingkat) {
            if (in_array($storedKelas, ['TK Al-Qur\'an', 'TK Alquran', 'TKQ'], true)) $tingkat = 'TPQ';
            elseif (in_array($storedKelas, $availableTingkat, true)) $tingkat = $storedKelas;
        }
        $kelas = in_array($storedKelas, $availableTingkat, true)
            || in_array($storedKelas, ['TK Al-Qur\'an', 'TK Alquran', 'TKQ'], true)
            ? '' : $storedKelas;
        if ($selectedTingkat !== '' && $tingkat !== $selectedTingkat) continue;
        if ($selectedKelas !== '' && ($selectedTingkat === '' || $kelas !== $selectedKelas)) continue;
        $santriIds[] = $id;
    }
    if (!$santriIds) return [];

    if (NormalizedStore::isActive()) {
        $attendance = NormalizedStore::getReportRecords('kehadiran', $santriIds, $periodFrom, $periodTo);
        $gradeAverages = NormalizedStore::getReportGradeAverages($santriIds, $from !== '' ? $from : null, $from !== '' ? $to : null);
        $setoranRecords = $from !== ''
            ? array_merge(
                NormalizedStore::getReportRecords('ziyadahHafalan', $santriIds, $from, $to),
                NormalizedStore::getReportRecords('mutqin', $santriIds, $from, $to)
            )
            : [];
    } else {
        $idSet = array_fill_keys($santriIds, true);
        $inRange = static fn($record) => isset($idSet[$record['santriId'] ?? ''])
            && ($record['tanggal'] ?? '') >= $periodFrom && ($record['tanggal'] ?? '') <= $periodTo;
        $attendance = array_values(array_filter(getRecords('kehadiran'), $inRange));
        $gradeAverages = ['period' => [], 'all' => []];
        foreach (['tahsin', 'ziyadahHafalan', 'mutqin'] as $type) {
            foreach (getRecords($type) as $record) {
                $id = (string)($record['santriId'] ?? '');
                if (!isset($idSet[$id]) || !isset($record['nilai']) || !is_numeric($record['nilai'])) continue;
                foreach (['all' => true, 'period' => ($from !== '' && ($record['tanggal'] ?? '') >= $from && ($record['tanggal'] ?? '') <= $to)] as $scope => $include) {
                    if (!$include) continue;
                    $gradeAverages[$scope][$id]['sum'] = ($gradeAverages[$scope][$id]['sum'] ?? 0) + (float)$record['nilai'];
                    $gradeAverages[$scope][$id]['count'] = ($gradeAverages[$scope][$id]['count'] ?? 0) + 1;
                }
            }
        }
        foreach ($gradeAverages as $scope => $grades) {
            foreach ($grades as $id => $grade) {
                $gradeAverages[$scope][$id] = (int)round($grade['sum'] / $grade['count']);
            }
        }
        $setoranRecords = [];
        if ($from !== '') {
            foreach (['ziyadahHafalan', 'mutqin'] as $type) {
                $setoranRecords = array_merge($setoranRecords, array_values(array_filter(getRecords($type), $inRange)));
            }
        }
    }

    $latestAttendance = [];
    foreach ($attendance as $record) {
        $session = (string)($record['sesi'] ?? 'Subuh');
        if ($session === 'Ta’lim Malam') continue;
        $key = implode('|', [(string)$record['santriId'], (string)$record['tanggal'], $session]);
        $created = (int)($record['_created'] ?? 0);
        if (!isset($latestAttendance[$key]) || $created >= (int)($latestAttendance[$key]['_created'] ?? 0)) {
            $latestAttendance[$key] = $record;
        }
    }
    $stats = [];
    foreach ($santriIds as $id) {
        $stats[$id] = ['hadirSubuh' => 0, 'hadirAshar' => 0, 'hadirMaghrib' => 0, 'hadirIsya' => 0, 'hadir' => 0, 'totalK' => 0];
    }
    foreach ($latestAttendance as $record) {
        $id = (string)$record['santriId'];
        if (!isset($stats[$id])) continue;
        $stats[$id]['totalK']++;
        if (($record['status'] ?? '') === 'Hadir') {
            $stats[$id]['hadir']++;
            $key = match ($record['sesi'] ?? 'Subuh') {
                'Subuh' => 'hadirSubuh', 'Ashar' => 'hadirAshar',
                'Maghrib' => 'hadirMaghrib', 'Isya' => 'hadirIsya', default => null,
            };
            if ($key !== null) $stats[$id][$key]++;
        }
    }

    $setoranBySantri = [];
    foreach ($setoranRecords as $record) $setoranBySantri[(string)$record['santriId']][] = $record;
    foreach ($stats as $id => &$row) {
        $row['pct'] = $row['totalK'] ? (int)round($row['hadir'] * 100 / $row['totalK']) : 0;
        $periodGrade = (int)($gradeAverages['period'][$id] ?? 0);
        $row['nilai'] = $periodGrade ?: (int)($gradeAverages['all'][$id] ?? 0);
        $records = $setoranBySantri[$id] ?? [];
        usort($records, static function ($a, $b): int {
            $created = (int)($b['_created'] ?? 0) <=> (int)($a['_created'] ?? 0);
            return $created ?: strcmp((string)($b['tanggal'] ?? ''), (string)($a['tanggal'] ?? ''));
        });
        if ($records) {
            $first = $records[count($records) - 1];
            $last = $records[0];
            foreach (['sAwal', 'aAwal', 'sAkhir', 'aAkhir'] as $field) {
                $row['setoranAwal'][$field] = $first[$field] ?? null;
                $row['setoranAkhir'][$field] = $last[$field] ?? null;
            }
        } else {
            $row['setoranAwal'] = null;
            $row['setoranAkhir'] = null;
        }
    }
    unset($row);
    return $stats;
}
