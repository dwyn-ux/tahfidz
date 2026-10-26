/* ============================================================
   Tahfidzku — Admin Views
   ============================================================ */
const Admin = (() => {

  const WALI_PASS = 'Santri123!';

  function parseImportRows(raw) {
    return raw.trim().split(/\r?\n/).filter(Boolean).map(line => {
      const separator = line.includes('\t') ? '\t' : ',';
      return line.split(separator).map(value => value.trim());
    });
  }

  function genWaliUsername(nama) {
    const words = (nama || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    return words.slice(0, 2).join('') || 'wali';
  }

  function uniqueUsername(base, taken) {
    if (!taken.has(base)) return base;
    let i = 2;
    while (taken.has(base + i)) i++;
    return base + i;
  }

  // Data lama hanya menyimpan satu nama/ID ustadz. Data baru menyimpan daftar
  // ID dan nama agar satu halaqah dapat memiliki beberapa pengampu, sambil
  // mempertahankan kolom lama sebagai pengampu utama untuk kompatibilitas.
  function applyHalaqahUstadz(db, halaqah, ustadzIds) {
    const ids = [...new Set((ustadzIds || []).filter(id => db.ustadz.some(u => u.id === id)))];
    const names = ids.map(id => db.ustadz.find(u => u.id === id)?.nama).filter(Boolean);
    halaqah.ustadzIds = ids;
    halaqah.ustadzNames = names;
    halaqah.ustadzId = ids[0] || '';
    halaqah.ustadz = names[0] || '';
  }

  function refreshUstadzHalaqah(db) {
    db.ustadz.forEach(ustadz => {
      const halaqah = db.halaqah.find(h => Store.ustadzIdsForHalaqah(h).includes(ustadz.id));
      ustadz.halaqah = halaqah ? halaqah.nama : '';
    });
  }

  function assignUstadzToHalaqah(db, ustadzId, halaqahName) {
    const ustadz = db.ustadz.find(u => u.id === ustadzId);
    if (!ustadz) return;
    db.halaqah.forEach(h => {
      const ids = Store.ustadzIdsForHalaqah(h);
      if (ids.includes(ustadzId)) applyHalaqahUstadz(db, h, ids.filter(id => id !== ustadzId));
    });
    const halaqah = halaqahName && db.halaqah.find(h => h.nama === halaqahName);
    if (halaqah) applyHalaqahUstadz(db, halaqah, [...Store.ustadzIdsForHalaqah(halaqah), ustadzId]);
    refreshUstadzHalaqah(db);
  }

  function syncHalaqahUstadz(db, halaqah, ustadzIds) {
    const selected = [...new Set((ustadzIds || []).filter(id => db.ustadz.some(u => u.id === id)))];
    db.halaqah.forEach(h => {
      if (h.id === halaqah.id) return;
      const ids = Store.ustadzIdsForHalaqah(h);
      const remaining = ids.filter(id => !selected.includes(id));
      if (remaining.length !== ids.length) applyHalaqahUstadz(db, h, remaining);
    });
    applyHalaqahUstadz(db, halaqah, selected);
    refreshUstadzHalaqah(db);
  }

  function halaqahOptionLabel(halaqah, includeLevel = true) {
    const pengampu = Store.ustadzNamesForHalaqah(halaqah).join(', ') || 'Belum ada pengampu';
    return halaqah.nama + ' (' + pengampu + ')' + (includeLevel && halaqah.level ? ' · ' + halaqah.level : '');
  }

  function bindImportFile(modal, headers) {
    const input = modal.querySelector('#imp-file');
    const textarea = modal.querySelector('#imp-data');
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        let rows;
        if (/<!doctype|<html|<table/i.test(text)) {
          const doc = new DOMParser().parseFromString(text, 'text/html');
          rows = [...doc.querySelectorAll('table tr')].map(row =>
            [...row.querySelectorAll('th, td')].map(cell => cell.textContent.trim())
          );
        } else {
          rows = parseImportRows(text);
        }
        if (rows.length && rows[0][0].toLowerCase() === headers[0].toLowerCase()) rows.shift();
        rows = rows.filter(row => row.some(Boolean));
        if (!rows.length) throw new Error('File tidak berisi data');
        textarea.value = rows.map(row => row.join('\t')).join('\n');
        UI.toast(rows.length + ' baris berhasil dibaca', 'success');
      } catch (error) {
        input.value = '';
        UI.toast(error.message || 'File tidak dapat dibaca', 'error');
      }
    };
  }

  function nav(active) {
    return [
      { view: 'admin_dashboard', label: 'Dashboard', active: active === 'admin_dashboard' },
      { view: 'admin_santri', label: 'Santri', active: active === 'admin_santri' },
      { view: 'admin_ustadz', label: 'Ustadz', active: active === 'admin_ustadz' },
      { view: 'admin_halaqah', label: 'Halaqah', active: active === 'admin_halaqah' },
      { view: 'admin_master', label: 'Master Surat', active: active === 'admin_master' },
      { view: 'admin_absensi_ustadz', label: 'Absensi Ustadz', active: active === 'admin_absensi_ustadz' },
      { view: 'admin_libur', label: 'Kalender Libur', active: active === 'admin_libur' },
      { view: 'admin_riwayat', label: 'Riwayat', active: active === 'admin_riwayat' },
      { view: 'admin_laporan', label: 'Laporan', active: active === 'admin_laporan' },
      { view: 'admin_rekap_kehadiran', label: 'Rekap Kehadiran', active: active === 'admin_rekap_kehadiran' },
      { view: 'admin_rekap_setoran', label: 'Rekap Setoran', active: active === 'admin_rekap_setoran' },
      { view: 'admin_notif', label: 'Notifikasi', active: active === 'admin_notif' },
      { view: 'admin_talim', label: 'Ta’lim', active: active === 'admin_talim' },
      { view: 'admin_settings', label: 'Settings', active: active === 'admin_settings' },
      { view: 'quran', label: 'Al-Qur\'an', active: active === 'quran' }
    ];
  }

  function navUstadz(active) {
    return [
      { view: 'ustadz_dashboard', label: 'Dashboard', active: active === 'ustadz_dashboard' },
      { view: 'ustadz_absensi', label: 'Absensi', active: active === 'ustadz_absensi' },
      { view: 'ustadz_talim', label: 'Ta’lim Malam', active: active === 'ustadz_talim' },
      { view: 'ustadz_pembelajaran', label: 'Pembelajaran', active: active === 'ustadz_pembelajaran' },
      { view: 'ustadz_riwayat', label: 'Riwayat', active: active === 'ustadz_riwayat' },
      { view: 'ustadz_laporan', label: 'Laporan', active: active === 'ustadz_laporan' },
      { view: 'ustadz_notif', label: 'Notifikasi', active: active === 'ustadz_notif' },
      { view: 'quran', label: 'Al-Qur\'an', active: active === 'quran' }
    ];
  }

  /* ---------------- Dashboard ---------------- */
  function dashboard() {
    Store.checkSetoranTerlewat();
    Shared.shell('admin', nav('admin_dashboard'), '');
    Shared.setHeader('Dashboard Admin', 'Ringkasan lembaga');
    const db = Store.get();
    const totalHafalanPages = db.santri.reduce((acc, s) => { const h = Store.totalHafalanSantri(s.id); return acc + (h ? h.pages : 0); }, 0);
    const bulanIni = Store.todayStr().slice(0, 7);
    // Satu sesi bisa dicatat lebih dari satu ustadz (satu halaqah boleh diampu
    // beberapa ustadz), jadi rekap memakai satu status per sesi.
    const hadirBulanIni = Store.dedupeKehadiran(db.kehadiran.filter(k => k.tanggal.startsWith(bulanIni)));
    const countHadir = sesi => hadirBulanIni.filter(k => k.sesi === sesi && k.status === 'Hadir').length;
    const hadirSubuh = countHadir('Subuh');
    const hadirAshar = countHadir('Ashar');
    const hadirMaghrib = countHadir('Maghrib');
    const hadirIsya = countHadir('Isya');
    const hadirTalim = countHadir('Ta’lim Malam');
    const ustadzHadirHariIni = new Set((db.absensiUstadz || [])
      .filter(a => a.tanggal === Store.todayStr() && a.status === 'Hadir')
      .map(a => a.ustadzId)).size;

    // Banner libur lembaga (dari Settings → Kalender Libur) bila hari ini libur.
    function adminLiburBanner() {
      const info = Store.getLiburLembagaInfo(Store.todayStr());
      if (!info) return '';
      return `
        <div class="clay-card mt" style="border-left:4px solid #a855f7;background:#faf5ff">
          <div class="row center" style="gap:10px;flex-wrap:wrap">
            <span class="badge purple" style="font-size:13px">Libur Lembaga</span>
            <b>${UI.esc(info.keterangan || 'Libur Lembaga')}</b>
            <span class="muted" style="font-size:12px">Sesi: ${UI.esc(info.sesi === 'semua' ? 'Semua Sesi' : (Array.isArray(info.sesi) ? info.sesi.join(', ') : String(info.sesi)))}</span>
            <button class="clay-btn sm ghost" data-go="admin_libur" style="margin-left:auto;color:#7e22ce;border:1px solid #d8b4fe">Kelola Kalender Libur</button>
          </div>
        </div>`;
    }

    // Rekap absensi per halaqah × sesi hari ini: memetakan status ustadz
    // pengampu (bisa lebih dari satu) — Libur bila ada yang mencatat Libur,
    // selain itu tampilkan status gabungan atau "Belum".
    function adminRekapAbsensiHariIni() {
      const SESI_HARI = ['Subuh', 'Ashar', 'Maghrib', 'Isya', 'Ta’lim Malam'];
      const today = Store.todayStr();
      const rows = db.halaqah.map(h => {
        const uIds = Store.ustadzIdsForHalaqah(h);
        const cells = SESI_HARI.map(sesi => {
          const recs = (db.absensiUstadz || []).filter(a =>
            a.tanggal === today && a.sesi === sesi && uIds.includes(a.ustadzId));
          if (recs.some(r => r.status === 'Libur')) return '<td><span class="badge purple">Libur</span></td>';
          if (!recs.length) return '<td><span class="badge warn">Belum</span></td>';
          const uniq = [...new Set(recs.map(r => r.status))];
          return `<td><span class="badge ${uniq.every(s => s === 'Hadir') ? 'green' : 'blue'}">${UI.esc(uniq.join('+'))}</span></td>`;
        }).join('');
        const belumSesi = SESI_HARI.filter(sesi => !(db.absensiUstadz || []).some(a =>
          a.tanggal === today && a.sesi === sesi && uIds.includes(a.ustadzId)));
        return `<tr>
          <td><b>${UI.esc(h.nama)}</b></td>${cells}
          <td>${(belumSesi.length && uIds.length)
            ? `<button class="clay-btn sm ghost" data-libur-cepat="${UI.esc(h.nama)}" style="color:#7e22ce;border:1px solid #d8b4fe">Libur Semua Sesi</button>`
            : ''}</td>
        </tr>`;
      }).join('');
      if (!db.halaqah.length) return '';
      return `
        <div class="clay-card mt">
          <div class="row center" style="justify-content:space-between">
            <div class="section-title" style="margin:0">Status Absensi Halaqah Hari Ini</div>
            <button class="clay-btn sm ghost" data-go="admin_libur" style="color:#7e22ce;border:1px solid #d8b4fe">+ Libur Terjadwal</button>
          </div>
          <div class="muted" style="font-size:12px;margin:6px 0 10px">Halaqah yang belum absen bisa langsung diliburkan dari barisnya.</div>
          <div class="table-wrap"><table class="clay-table">
            <thead><tr><th>Halaqah</th>${SESI_HARI.map(s => `<th>${s}</th>`).join('')}<th>Aksi</th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>
        </div>`;
    }

    const kpi = `
      <div class="grid kpi">
        ${Shared.statCard(Shared.ICONS.users, db.santri.length, 'Santri', '#16A34A')}
        ${Shared.statCard(Shared.ICONS.teacher, db.ustadz.length, 'Ustadz', '#3B82F6')}
        ${Shared.statCard(Shared.ICONS.building, db.halaqah.length, 'Halaqah', '#FACC15')}
        ${Shared.statCard(Shared.ICONS.book, db.santri.filter(s => Store.santriHasProgram(s, 'Tahsin')).length, 'Tahsin', '#22C55E')}
        ${Shared.statCard(Shared.ICONS.star, db.santri.filter(s => Store.santriHasProgram(s, 'Ziyadah')).length, 'Ziyadah', '#3B82F6')}
        ${Shared.statCard(Shared.ICONS.star, db.santri.filter(s => Store.santriHasProgram(s, 'Mutqin')).length, 'Mutqin', '#16A34A')}
      </div>
      <div class="grid kpi mt">
        ${Shared.statCard(Shared.ICONS.sun, hadirSubuh, 'Kehadiran Subuh', '#22C55E')}
        ${Shared.statCard(Shared.ICONS.sun, hadirAshar, 'Kehadiran Ashar', '#22C55E')}
        ${Shared.statCard(Shared.ICONS.sunset, hadirMaghrib, 'Kehadiran Maghrib', '#22C55E')}
        ${Shared.statCard(Shared.ICONS.moon, hadirIsya, 'Kehadiran Isya', '#22C55E')}
        ${Shared.statCard(Shared.ICONS.book, hadirTalim, 'Kehadiran Ta’lim Malam', '#22C55E')}
        ${Shared.statCard(Shared.ICONS.teacher, ustadzHadirHariIni + '/' + db.ustadz.length, 'Ustadz Hadir Hari Ini', '#3B82F6')}
      </div>`;

    // progress hafalan per halaqah (avg pages)
    const halaqahData = db.halaqah.map(h => {
      const ss = db.santri.filter(s => Store.santriHasHalaqah(s, h));
      const avg = ss.length ? Math.round(ss.reduce((a, s) => { const hh = Store.totalHafalanSantri(s.id); return a + (hh ? hh.pages : 0); }, 0) / ss.length) : 0;
      return { label: h.nama.replace('Halaqah ', 'H'), value: avg };
    });
    // kehadiran mingguan (dummy per hari dari data)
    const days = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    const kehadiranData = days.map(d => ({ label: d, value: hadirBulanIni.filter(k => new Date(k.tanggal).getDay() === (days.indexOf(d) + 1) % 7).length + Math.floor(Math.random() * 3) }));

    const content = `
      ${kpi}
      ${adminLiburBanner()}
      ${adminRekapAbsensiHariIni()}
      <div class="grid cols-2 mt">
        <div class="clay-card">
          <div class="section-title"> Progress Hafalan per Halaqah</div>
          ${Shared.barChart(halaqahData, Math.max(1, ...halaqahData.map(d => d.value)))}
        </div>
        <div class="clay-card">
          <div class="section-title">Kehadiran Mingguan</div>
          ${Shared.barChart(kehadiranData, Math.max(1, ...kehadiranData.map(d => d.value)))}
        </div>
      </div>
      <div class="grid cols-2 mt">
        <div class="clay-card">
          <div class="section-title"> Ranking Halaqah</div>
          ${db.halaqah.map((h, i) => {
            const ss = db.santri.filter(s => Store.santriHasHalaqah(s, h));
            const total = ss.reduce((a, s) => { const hh = Store.totalHafalanSantri(s.id); return a + (hh ? hh.pages : 0); }, 0);
            return `<div class="row center" style="justify-content:space-between;padding:8px 0"><div><b>#${i + 1}</b> ${UI.esc(h.nama)}</div><span class="badge green">${total} hlm</span></div>`;
          }).join('')}
        </div>
        <div class="clay-card">
          <div class="section-title">Quick Action</div>
          <div class="row">
            <button class="clay-btn primary" data-go="admin_santri">+ Santri</button>
            <button class="clay-btn secondary" data-go="admin_ustadz">+ Ustadz</button>
            <button class="clay-btn" data-go="admin_halaqah">+ Halaqah</button>
            <button class="clay-btn ghost" id="qa-import">Import Excel</button>
          </div>
          <div class="section-title mt"> Aktivitas Terakhir</div>
          ${db.logAktivitas.slice(0, 6).map(l => `<div class="row center" style="justify-content:space-between;padding:6px 0"><span class="muted" style="font-size:13px">${UI.esc(l.aksi)}</span><span class="muted" style="font-size:12px">${UI.fmtDateTime(l.tanggal)}</span></div>`).join('') || '<div class="empty">Belum ada aktivitas.</div>'}
        </div>
      </div>`;
    document.getElementById('view-content').innerHTML = content;
    document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => App.navigate(b.dataset.go));
    // Libur cepat dari tabel rekap: meliburkan semua sesi hari ini untuk satu
    // halaqah tanpa membuka dialog panjang (dipakai saat halaqah lupa absen).
    document.querySelectorAll('[data-libur-cepat]').forEach(btn => {
      btn.onclick = () => {
        const hNama = btn.dataset.liburCepat;
        const halaqah = db.halaqah.find(h => h.nama === hNama);
        if (!halaqah) return;
        const uId = Store.ustadzIdsForHalaqah(halaqah)[0];
        if (!uId) { UI.toast('Halaqah belum punya ustadz pengampu', 'error'); return; }
        UI.confirmDialog(
          'Libur Semua Sesi',
          `Halaqah <b>${UI.esc(hNama)}</b> akan dicatat <b>Libur</b> untuk semua sesi hari ini (${UI.fmtDate(Store.todayStr())}). Seluruh santri tidak terhitung Alfa. Lanjutkan?`,
          async () => {
            const sesiAll = ['Subuh', 'Ashar', 'Maghrib', 'Isya', 'Ta’lim Malam'];
            const ok = await Store.liburkanHalaqah(uId, sesiAll, hNama, 'Libur (diatur admin)', Store.todayStr());
            if (ok) {
              UI.toast(`Halaqah ${hNama} diliburkan semua sesi ✓`, 'success');
              dashboard();
            }
          }
        );
      };
    });
    const imp = document.getElementById('qa-import'); if (imp) imp.onclick = () => importSantriDialog();
  }

  /* ---------------- Santri ---------------- */
  function downloadSantriXlsx() {
    const db = Store.get();
    const rows = db.santri.slice().sort((a, b) => a.nama.localeCompare(b.nama, 'id')).map(s => {
      const waliUser = db.users.find(u => u.role === 'wali' && u.refId === s.waliId);
      return {
        nama: s.nama, nis: s.nis || '', jk: s.jk || '', tingkat: Store.tingkatForSantri(s), kelas: Store.kelasForSantri(s),
        program: Store.programSummaryForSantri(s), halaqah: Store.halaqahSummaryForSantri(s), status: s.status || '',
        usernameWali: waliUser ? waliUser.username : '',
        wali: s.namaWali || '', hpWali: s.noHpWali || '', hpSantri: s.noHp || '', alamat: s.alamat || '', tglLahir: s.tglLahir || ''
      };
    });
    Shared.downloadXlsx('Data_Santri_' + Store.todayStr(), [{
      name: 'Santri', rows,
      columns: [
        { key: 'nama', label: 'Nama' }, { key: 'nis', label: 'NIS' }, { key: 'jk', label: 'JK' },
        { key: 'tingkat', label: 'Tingkat' }, { key: 'kelas', label: 'Kelas' }, { key: 'program', label: 'Program Aktif' },
        { key: 'halaqah', label: 'Halaqah' }, { key: 'status', label: 'Status' },
        { key: 'usernameWali', label: 'Username Login Wali' },
        { key: 'wali', label: 'Nama Wali' },
        { key: 'hpWali', label: 'No. HP Wali' }, { key: 'hpSantri', label: 'No. HP Santri' }, { key: 'alamat', label: 'Alamat' }, { key: 'tglLahir', label: 'Tanggal Lahir' }
      ]
    }]);
    UI.toast('Data santri berhasil diunduh (.xlsx)', 'success');
  }

  /* ---------------- Tombol aksi baris tabel ----------------
     Sebelumnya tombol aksi hanya berupa ikon (✏️ / 🗑) sehingga di HP tampak
     seperti tombol kosong dan rawan salah pencet. Semua aksi baris sekarang
     memakai label teks dengan ukuran seragam. */
  function rowActionButtons(actions) {
    return `<div class="row actions-inline">${actions.map(action =>
      `<button type="button" class="clay-btn sm ${action.cls || 'ghost'}"${action.attr} title="${UI.esc(action.title || action.label)}" aria-label="${UI.esc(action.title || action.label)}">${UI.esc(action.label)}</button>`
    ).join('')}</div>`;
  }

  function santriRowActions(santri) {
    return rowActionButtons([
      { label: 'Edit', attr: ` data-edit="${UI.esc(santri.id)}"` },
      { label: 'Reset', cls: 'secondary', attr: ` data-reset="${UI.esc(santri.waliId || '')}"` },
      { label: 'Hapus', cls: 'danger', attr: ` data-del="${UI.esc(santri.id)}"` }
    ]);
  }

  function ustadzRowActions(ustadz) {
    return rowActionButtons([
      { label: 'Edit', attr: ` data-edit="${UI.esc(ustadz.id)}"` },
      { label: 'Hapus', cls: 'danger', attr: ` data-del="${UI.esc(ustadz.id)}"` }
    ]);
  }

  function santri() {
    Shared.shell('admin', nav('admin_santri'), '');
    Shared.setHeader('Manajemen Santri', 'Kelola data santri & akun wali otomatis');
    const db = Store.get();
    const rows = db.santri.map(s => {
      const waliUser = db.users.find(u => u.role === 'wali' && u.refId === s.waliId);
      const username = waliUser ? waliUser.username : '-';
      return `<tr>
        <td><b>${UI.esc(s.nama)}</b><div class="muted">${UI.esc(s.nis)}</div></td>
        <td>${UI.esc(s.jk)}</td>
        <td>${UI.esc(Store.tingkatForSantri(s) || '-')}</td>
        <td>${UI.esc(Store.kelasForSantri(s) || '-')}</td>
        <td>${UI.esc(Store.programSummaryForSantri(s))}</td>
        <td>${UI.esc(Store.halaqahSummaryForSantri(s))}</td>
        <td><span class="badge ${s.status === 'Aktif' ? 'green' : 'gray'}">${UI.esc(s.status)}</span></td>
        <td><code>${UI.esc(username)}</code></td>
        <td>${santriRowActions(s)}</td>
      </tr>`;
    }).join('');
    document.getElementById('view-content').innerHTML = `
      <div class="clay-card">
        <div class="row" style="justify-content:space-between">
          <div class="section-title" style="margin:0">Daftar Santri (${db.santri.length})</div>
          <div class="row">
            <button class="clay-btn ghost" id="btn-gen-bulk">⚙️ Generate Username</button>
            <button class="clay-btn ghost" id="btn-import">Import Excel</button>
            <button class="clay-btn secondary" id="btn-download-xlsx">⬇ Download XLSX</button>
            <button class="clay-btn primary" id="btn-add">+ Tambah Santri</button>
          </div>
        </div>
        <div class="row" style="margin-top:12px">
          <input class="clay-input" id="search-santri" type="search" placeholder="Cari santri..." autocomplete="off" />
        </div>
        <div class="table-wrap mt"><table class="clay-table">
          <thead><tr><th>Nama</th><th>JK</th><th>Tingkat</th><th>Kelas</th><th>Program Aktif</th><th>Halaqah</th><th>Status</th><th>Username Login</th><th>Aksi</th></tr></thead>
          <tbody id="santri-table-body">${rows || `<tr><td colspan="9"><div class="empty">Belum ada santri.</div></td></tr>`}</tbody>
        </table></div>
      </div>`;
    document.getElementById('btn-add').onclick = () => santriForm();
    document.getElementById('btn-import').onclick = () => importSantriDialog();
    document.getElementById('btn-download-xlsx').onclick = downloadSantriXlsx;
    document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => santriForm(b.dataset.edit));
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      UI.confirmDialog('Hapus Santri', 'Yakin ingin menghapus santri ini?', () => {
        const db = Store.get();
        const s = Store.findSantri(b.dataset.del);
        db.santri = db.santri.filter(x => x.id !== b.dataset.del);
        db.wali = db.wali.filter(w => w.santriId !== b.dataset.del);
        db.users = db.users.filter(u => !(u.role === 'wali' && s && u.refId === s.waliId));
        Store.recalcHalaqah(); Store.save(); Store.log('Hapus santri'); UI.toast('Santri dihapus'); santri();
      });
    });
    document.querySelectorAll('[data-reset]').forEach(b => b.onclick = () => {
      UI.confirmDialog('Reset Password', 'Yakin reset password akun wali ini ke ' + WALI_PASS + '?', () => {
        const db = Store.get();
        const wUser = db.users.find(u => u.role === 'wali' && u.refId === b.dataset.reset);
        if (wUser) {
          wUser.password = WALI_PASS;
          Store.save(); UI.toast('Password direset ke ' + WALI_PASS, 'success'); santri();
        }
      });
    });
    document.getElementById('btn-gen-bulk').onclick = () => {
      UI.confirmDialog('Generate Username', 'Generate username & reset password semua akun wali ke ' + WALI_PASS + '?', () => {
        const db = Store.get();
        const taken = new Set(db.users.filter(u => u.role !== 'wali').map(u => u.username));
        db.users.filter(u => u.role === 'wali').forEach(u => taken.add(u.username));
        let n = 0;
        db.santri.forEach(s => {
          const wali = db.wali.find(w => w.id === s.waliId);
          let user = db.users.find(u => u.role === 'wali' && u.refId === s.waliId);
          if (!user) {
            user = { id: Store.uid('usr'), username: '', password: WALI_PASS, role: 'wali', refId: s.waliId };
            db.users.push(user);
          }
          const base = genWaliUsername(s.nama);
          user.username = uniqueUsername(base, taken);
          taken.add(user.username);
          user.password = WALI_PASS;
          n++;
        });
        Store.save(); Store.log('Generate username wali'); UI.toast('Generate ' + n + ' akun wali', 'success'); santri();
      });
    };

    const searchInput = document.getElementById('search-santri');
    if (searchInput) {
      let searchTimer = null;
      const scheduleSearch = () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          const term = searchInput.value.toLowerCase().trim();
          const rows = term ? db.santri.filter(s =>
            s.nama.toLowerCase().includes(term) ||
            (s.nis && s.nis.toString().includes(term)) ||
            Store.tingkatForSantri(s).toLowerCase().includes(term) ||
            Store.kelasForSantri(s).toLowerCase().includes(term) ||
            Store.programSummaryForSantri(s).toLowerCase().includes(term) ||
            Store.halaqahSummaryForSantri(s).toLowerCase().includes(term) ||
            (s.level || '').toLowerCase().includes(term)
          ) : db.santri;
          const newRows = rows.map(s => {
            const waliUser = db.users.find(u => u.role === 'wali' && u.refId === s.waliId);
            const username = waliUser ? waliUser.username : '-';
            return `<tr>
              <td><b>${UI.esc(s.nama)}</b><div class="muted">${UI.esc(s.nis)}</div></td>
              <td>${UI.esc(s.jk)}</td>
              <td>${UI.esc(Store.tingkatForSantri(s) || '-')}</td>
              <td>${UI.esc(Store.kelasForSantri(s) || '-')}</td>
              <td>${UI.esc(Store.programSummaryForSantri(s))}</td>
              <td>${UI.esc(Store.halaqahSummaryForSantri(s))}</td>
              <td><span class="badge ${s.status === 'Aktif' ? 'green' : 'gray'}">${UI.esc(s.status)}</span></td>
              <td><code>${UI.esc(username)}</code></td>
              <td>${santriRowActions(s)}</td>
            </tr>`;
          }).join('');
          document.getElementById('santri-table-body').innerHTML = newRows || `<tr><td colspan="9"><div class="empty">Tidak ada santri yang sesuai.</div></td></tr>`;
          document.querySelectorAll('#santri-table-body [data-edit], #santri-table-body [data-del], #santri-table-body [data-reset]').forEach(b => {
            b.onclick = () => {
              if (b.dataset.edit) santriForm(b.dataset.edit);
              else if (b.dataset.del) {
                UI.confirmDialog('Hapus Santri', 'Yakin ingin menghapus santri ini?', () => {
                  const db = Store.get();
                  const s = Store.findSantri(b.dataset.del);
                  db.santri = db.santri.filter(x => x.id !== b.dataset.del);
                  db.wali = db.wali.filter(w => w.santriId !== b.dataset.del);
                  db.users = db.users.filter(u => !(u.role === 'wali' && s && u.refId === s.waliId));
                  Store.recalcHalaqah(); Store.save(); Store.log('Hapus santri'); UI.toast('Santri dihapus'); santri();
                });
              } else if (b.dataset.reset) {
                UI.confirmDialog('Reset Password', 'Yakin reset password akun wali ini ke ' + WALI_PASS + '?', () => {
                  const db = Store.get();
                  const wUser = db.users.find(u => u.role === 'wali' && u.refId === b.dataset.reset);
                  if (wUser) {
                    wUser.password = WALI_PASS;
                    Store.save(); UI.toast('Password direset ke ' + WALI_PASS, 'success'); santri();
                  }
                });
              }
            };
          });
        }, 150);
      };
      Shared.bindSearchInput(searchInput, scheduleSearch);
    }
  }

  function santriForm(id) {
    const db = Store.get();
    const s = id ? Store.findSantri(id) : null;
    const allPrograms = db.levelTahfidz || ['Tahsin', 'Ziyadah', 'Mutqin'];
    const activePrograms = s ? Store.activeProgramsForSantri(s) : [(s && s.level) || 'Tahsin'];
    const primaryProgram = s && activePrograms.includes(s.level) ? s.level : activePrograms[0];
    const selectedTingkat = s ? Store.tingkatForSantri(s) : (Store.tingkatOptions()[0] || '');
    const selectedKelas = s ? Store.kelasForSantri(s) : '';
    // Santri lama bisa menyimpan kelas yang sudah tidak ada di daftar (mis. "4"
    // setelah daftar diubah jadi 4A/4B). Nilai lama tetap ditampilkan sebagai
    // opsi supaya data tidak hilang diam-diam saat form disimpan.
    const kelasOptions = (tingkat, selected = '') => {
      const list = Store.kelasOptions(tingkat);
      if (selected && !list.includes(selected)) list.push(selected);
      return `<option value="">Pilih kelas</option>${UI.optionsFromList(
        list.map(kelas => ({ v: kelas, l: 'Kelas ' + kelas })), 'v', 'l', selected
      )}`;
    };
    const halaqahOptions = program => {
      const selected = s ? (Store.halaqahForSantriProgram(s, program) || {}).id : '';
      const choices = db.halaqah.map(h => ({ v: h.id, l: halaqahOptionLabel(h) }));
      return `<option value="">Pilih halaqah untuk setoran ${UI.esc(program)}</option>${UI.optionsFromList(choices, 'v', 'l', selected)}`;
    };
    const programChecks = allPrograms.map(program => `
      <label class="row" style="gap:8px;cursor:pointer;padding:5px 0">
        <input type="checkbox" data-program-active value="${UI.esc(program)}" ${activePrograms.includes(program) ? 'checked' : ''}>
        <span>${UI.esc(program)}</span>
      </label>`).join('');
    const programHalaqahFields = allPrograms.map(program => `
      <div data-program-halaqah-row="${UI.esc(program)}" class="row" style="align-items:end;gap:12px;margin-top:8px">
        <div style="min-width:100px"><b>${UI.esc(program)}</b></div>
        <div style="flex:1"><select class="clay-select" data-program-halaqah="${UI.esc(program)}">${halaqahOptions(program)}</select></div>
      </div>`).join('');
    const body = `
      ${UI.field('Nama', `<input class="clay-input" id="f-nama" value="${s ? UI.esc(s.nama) : ''}">`)}
      <div class="row">
        <div style="flex:1">${UI.field('NIS', `<input class="clay-input" id="f-nis" value="${s ? UI.esc(s.nis) : ''}">`)}</div>
        <div style="flex:1">${UI.field('Jenis Kelamin', `<select class="clay-select" id="f-jk"><option ${s && s.jk === 'L' ? 'selected' : ''}>L</option><option ${s && s.jk === 'P' ? 'selected' : ''}>P</option></select>`)}</div>
      </div>
      ${UI.field('Tanggal Lahir', `<input class="clay-input" id="f-tgl" type="date" value="${s ? UI.esc(s.tglLahir) : ''}">`)}
      ${UI.field('Alamat', `<input class="clay-input" id="f-alamat" value="${s ? UI.esc(s.alamat) : ''}">`)}
      <div class="row">
        <div style="flex:1">${UI.field('No HP Santri', `<input class="clay-input" id="f-hp" value="${s ? UI.esc(s.noHp) : ''}">`)}</div>
        <div style="flex:1">${UI.field('Nama Wali', `<input class="clay-input" id="f-wali" value="${s ? UI.esc(s.namaWali) : ''}">`)}</div>
      </div>
      ${UI.field('No HP Wali', `<input class="clay-input" id="f-hpwali" value="${s ? UI.esc(s.noHpWali) : ''}">`)}
      <div class="row">
        <div style="flex:1">${UI.field('Username', `<input class="clay-input" id="f-uname" value="${s ? UI.esc((db.users.find(u => u.role === 'wali' && u.refId === s.waliId) || {}).username || '') : ''}" placeholder="Otomatis dari HP/nama wali">`)}</div>
        <div style="flex:1">${UI.field('Password', `<input class="clay-input" id="f-pass" value="${s ? '' : WALI_PASS}" placeholder="Kosongkan jika tidak diubah">`)}</div>
      </div>
      <button class="clay-btn sm secondary" id="btn-gen-uname" type="button">⚙️ Generate Username</button>
      <div class="row mt">
        <div style="flex:1">${UI.field('Status', `<select class="clay-select" id="f-status"><option ${s && s.status === 'Aktif' ? 'selected' : ''}>Aktif</option><option ${s && s.status === 'Nonaktif' ? 'selected' : ''}>Nonaktif</option></select>`)}</div>
        <div style="flex:1">${UI.field('Program Utama', `<select class="clay-select" id="f-level"></select><div class="muted" style="font-size:12px;margin-top:4px">Ditampilkan sebagai level utama pada laporan lama.</div>`)}</div>
      </div>
      <div class="row">
        <div style="flex:1">${UI.field('Tingkat', `<select class="clay-select" id="f-tingkat"><option value="">Pilih tingkat</option>${UI.optionsFromList(Store.tingkatOptions().map(tingkat => ({ v: tingkat, l: tingkat })), 'v', 'l', selectedTingkat)}</select>`)}</div>
        <div style="flex:1">${UI.field('Kelas', `<select class="clay-select" id="f-kelas">${kelasOptions(selectedTingkat, selectedKelas)}</select>`)}</div>
      </div>
      ${UI.field('Program Aktif', `<div class="clay-card pad-sm">${programChecks}</div><div class="muted" style="font-size:12px;margin-top:4px">Santri dapat aktif di lebih dari satu program pada waktu yang sama.</div>`) }
      ${UI.field('Halaqah per Jenis Setoran', `<div class="clay-card pad-sm">${programHalaqahFields}</div><div class="muted" style="font-size:12px;margin-top:4px">Jenis setoran mengikuti Program Aktif, bukan level halaqah. Contoh: centang Ziyadah lalu pilih halaqah Mutqin agar masuk kelompok Mutqin, tetapi setorannya tetap Ziyadah.</div>`)}`;
    const modal = UI.openModal({
      title: id ? 'Edit Santri' : 'Tambah Santri', sub: id ? '' : 'Akun wali otomatis dibuat',
      bodyHTML: body,
      actions: [
        { label: 'Batal', cls: 'ghost', onClick: (m, c) => c() },
        { label: 'Simpan', cls: 'primary', onClick: (m, c) => {
          const db = Store.get();
          const data = {
            nama: m.querySelector('#f-nama').value.trim(),
            nis: m.querySelector('#f-nis').value.trim(),
            jk: m.querySelector('#f-jk').value,
            tglLahir: m.querySelector('#f-tgl').value,
            alamat: m.querySelector('#f-alamat').value.trim(),
            noHp: m.querySelector('#f-hp').value.trim(),
            namaWali: m.querySelector('#f-wali').value.trim(),
            noHpWali: m.querySelector('#f-hpwali').value.trim(),
            status: m.querySelector('#f-status').value,
            tingkat: m.querySelector('#f-tingkat').value,
            kelas: m.querySelector('#f-kelas').value
          };
          if (!data.nama) { UI.toast('Nama wajib diisi', 'error'); return; }
          if (!data.tingkat || !data.kelas) {
            UI.toast('Pilih tingkat dan kelas yang sesuai', 'error'); return;
          }
          const programs = [...m.querySelectorAll('[data-program-active]:checked')].map(input => input.value);
          const primary = m.querySelector('#f-level').value;
          if (!programs.length) { UI.toast('Pilih minimal satu program aktif', 'error'); return; }
          const programHalaqah = {};
          for (const program of programs) {
            const halaqahId = m.querySelector(`[data-program-halaqah="${program}"]`).value;
            if (!halaqahId) { UI.toast('Pilih halaqah untuk program ' + program, 'error'); return; }
            programHalaqah[program] = halaqahId;
          }
          if (id) {
            const santri = Store.findSantri(id);
            Object.assign(santri, data);
            Store.configureSantriPrograms(santri, programs, programHalaqah, primary);
            const waliUser = db.users.find(u => u.role === 'wali' && u.refId === santri.waliId);
            if (waliUser) {
              waliUser.username = m.querySelector('#f-uname').value.trim() || waliUser.username;
              const pass = m.querySelector('#f-pass').value.trim();
              if (pass) waliUser.password = pass;
            }
            const waliRec = db.wali.find(w => w.id === Store.findSantri(id).waliId);
            if (waliRec) {
              waliRec.nama = data.namaWali || waliRec.nama;
              waliRec.noHp = data.noHpWali || waliRec.noHp;
            }
            Store.log('Edit santri: ' + data.nama);
          } else {
            const waliId = Store.uid('w');
            const newS = { id: Store.uid('s'), ...data, waliId };
            Store.configureSantriPrograms(newS, programs, programHalaqah, primary);
            db.santri.push(newS);
            // akun wali otomatis
            const wali = { id: waliId, nama: data.namaWali || data.nama, noHp: data.noHpWali, santriId: newS.id };
            db.wali.push(wali);
            const uname = m.querySelector('#f-uname').value.trim() || genWaliUsername(data.nama);
            const pass = m.querySelector('#f-pass').value.trim() || WALI_PASS;
            db.users.push({ id: Store.uid('usr'), username: uname, password: pass, role: 'wali', refId: waliId });
            Store.log('Tambah santri + akun wali: ' + data.nama);
            Store.addNotif(db.users.find(u => u.role === 'admin')?.id, 'admin', 'Santri baru ditambahkan: ' + data.nama);
          }
          Store.recalcHalaqah(); Store.save(); c(); UI.toast('Tersimpan', 'success'); santri();
        } }
      ]
    });
    modal.modal.querySelector('#btn-gen-uname').onclick = () => {
      const nama = modal.modal.querySelector('#f-nama').value.trim();
      const base = genWaliUsername(nama);
      const taken = new Set(db.users.filter(u => u.username).map(u => u.username));
      modal.modal.querySelector('#f-uname').value = uniqueUsername(base, taken);
    };
    const syncKelasInput = () => {
      const tingkat = modal.modal.querySelector('#f-tingkat').value;
      const select = modal.modal.querySelector('#f-kelas');
      const previous = select.value;
      select.innerHTML = kelasOptions(tingkat, Store.kelasOptions(tingkat).includes(previous) ? previous : '');
    };
    modal.modal.querySelector('#f-tingkat').onchange = syncKelasInput;
    const syncProgramInputs = () => {
      const checked = [...modal.modal.querySelectorAll('[data-program-active]:checked')].map(input => input.value);
      const primarySelect = modal.modal.querySelector('#f-level');
      const previous = primarySelect.value || primaryProgram;
      primarySelect.innerHTML = UI.optionsFromList(checked.map(program => ({ v: program, l: program })), 'v', 'l', checked.includes(previous) ? previous : checked[0]);
      allPrograms.forEach(program => {
        const row = modal.modal.querySelector(`[data-program-halaqah-row="${program}"]`);
        const select = modal.modal.querySelector(`[data-program-halaqah="${program}"]`);
        const enabled = checked.includes(program);
        row.style.display = enabled ? 'flex' : 'none';
        select.disabled = !enabled;
      });
    };
    modal.modal.querySelectorAll('[data-program-active]').forEach(input => { input.onchange = syncProgramInputs; });
    syncProgramInputs();
  }

  /* ---------------- Bulk Import Santri ---------------- */
  function importSantriDialog() {
    const body = `
      <p class="muted">Kolom: Nama | NIS | JK (L/P) | Wali | HP Wali | Program | Halaqah | Tingkat | Kelas</p>
      <div class="row">
        <button class="clay-btn ghost" id="imp-template">Download Template Excel</button>
      </div>
      <label class="field-label mt" for="imp-file">Pilih file template yang sudah diisi (.xls atau .csv)</label>
      <input class="clay-input" id="imp-file" type="file" accept=".xls,.csv,text/csv,application/vnd.ms-excel" />
      <label class="field-label mt">Atau tempel data dari Excel/CSV</label>
      <textarea class="clay-textarea" id="imp-data" placeholder="Ahmad, S010, L, Bpk Ali, 0812..., Ziyadah, Halaqah 1, SD, 4&#10;Fatimah, S011, P, Ibu Sara, 0812..., Tahsin, Halaqah 2, SMP, 8"></textarea>
      <div id="imp-preview" class="mt"></div>`;
    const modal = UI.openModal({
      title: 'Import Santri (Excel/CSV)', sub: 'Validasi otomatis, preview sebelum import',
      bodyHTML: body,
      actions: [
        { label: 'Batal', cls: 'ghost', onClick: (m, c) => c() },
        { label: 'Preview', cls: '', onClick: (m) => {
          const raw = m.querySelector('#imp-data').value.trim();
          if (!raw) { UI.toast('Masukkan data', 'error'); return; }
          const lines = parseImportRows(raw);
          const valid = lines.filter(c => c.length >= 7 && c[0]);
          m.querySelector('#imp-preview').innerHTML = `<div class="clay-card pad-sm"><div class="muted" style="font-size:13px">${valid.length} baris valid dari ${lines.length}.</div>
            <div class="table-wrap mt"><table class="clay-table"><thead><tr><th>Nama</th><th>NIS</th><th>JK</th><th>Wali</th><th>HP</th><th>Program</th><th>Halaqah</th><th>Tingkat</th><th>Kelas</th></tr></thead>
            <tbody>${valid.map(c => `<tr><td>${UI.esc(c[0])}</td><td>${UI.esc(c[1])}</td><td>${UI.esc(c[2])}</td><td>${UI.esc(c[3])}</td><td>${UI.esc(c[4])}</td><td>${UI.esc(c[5])}</td><td>${UI.esc(c[6])}</td><td>${UI.esc(c[7] || '-')}</td><td>${UI.esc(c[8] || '-')}</td></tr>`).join('')}</tbody></table></div></div>`;
        } },
        { label: 'Import', cls: 'primary', onClick: (m, c) => {
          const db = Store.get();
          const raw = m.querySelector('#imp-data').value.trim();
          const lines = parseImportRows(raw).filter(c => c.length >= 7 && c[0]);
          let count = 0;
          lines.forEach(c => {
            const waliId = Store.uid('w');
            const newS = { id: Store.uid('s'), nama: c[0], nis: c[1], jk: c[2], tglLahir: '', alamat: '', noHp: '', namaWali: c[3], noHpWali: c[4], status: 'Aktif', level: c[5], tingkat: c[7] || '', kelas: c[8] || '', halaqah: c[6], waliId };
            Store.normalizeSantriEducation(newS);
            db.santri.push(newS);
            const wali = { id: waliId, nama: c[3], noHp: c[4], santriId: newS.id };
            db.wali.push(wali);
            const uname = genWaliUsername(c[0]);
            db.users.push({ id: Store.uid('usr'), username: uname, password: WALI_PASS, role: 'wali', refId: waliId });
            count++;
          });
          Store.recalcHalaqah(); Store.save(); Store.log('Import ' + count + ' santri');
          Store.addNotif(db.users.find(u => u.role === 'admin')?.id, 'admin', 'Import berhasil: ' + count + ' santri');
          c(); UI.toast('Import ' + count + ' santri berhasil', 'success'); santri();
        } }
      ]
    });
    bindImportFile(modal.modal, ['Nama', 'NIS', 'JK (L/P)', 'Wali', 'HP Wali', 'Program', 'Halaqah', 'Tingkat', 'Kelas']);
    modal.modal.querySelector('#imp-template').onclick = () => Shared.downloadTemplateExcel(
      'Template_Import_Santri',
      ['Nama', 'NIS', 'JK (L/P)', 'Wali', 'HP Wali', 'Program', 'Halaqah', 'Tingkat', 'Kelas'],
      [['Ahmad Fauzi', 'S010', 'L', 'Bpk Ali', '081234567890', 'Ziyadah', 'Halaqah 1', 'SD', '4'],
       ['Fatimah Zahra', 'S011', 'P', 'Ibu Sara', '081234567891', 'Tahsin', 'Halaqah 2', 'SMP', '8']],
      'Isi tiap baris untuk 1 santri. Simpan sebagai .xls lalu salin isinya ke kolom di bawah, atau tempel langsung dari Excel.'
    );
  }

  /* ---------------- Ustadz ---------------- */
  function talimAssignmentSummary(ustadz) {
    return Store.talimAssignmentsForUstadz(ustadz).map(assignment => {
      const classes = assignment.kelasKeys.map(Store.talimClassLabel).join(', ');
      return assignment.mapel.nama + (classes ? ' · ' + classes : ' · Belum ada kelas');
    }).join('; ');
  }

  function downloadUstadzXlsx() {
    const db = Store.get();
    const rows = db.ustadz.slice().sort((a, b) => a.nama.localeCompare(b.nama, 'id')).map(u => {
      const account = db.users.find(user => user.role === 'ustadz' && user.refId === u.id);
      const halaqah = db.halaqah.filter(h => Store.halaqahHasUstadz(h, u)).map(h => h.nama).join(', ') || u.halaqah || '';
      return { nama: u.nama, username: account?.username || '', noHp: u.noHp || '', email: u.email || '', status: u.status || '', halaqah, talim: talimAssignmentSummary(u) };
    });
    Shared.downloadXlsx('Data_Ustadz_' + Store.todayStr(), [{
      name: 'Ustadz', rows,
      columns: [
        { key: 'nama', label: 'Nama' }, { key: 'username', label: 'Username Login' }, { key: 'noHp', label: 'No. HP' },
        { key: 'email', label: 'Email' }, { key: 'status', label: 'Status' }, { key: 'halaqah', label: 'Halaqah' }, { key: 'talim', label: 'Penugasan Ta’lim' }
      ]
    }]);
    UI.toast('Data ustadz berhasil diunduh (.xlsx)', 'success');
  }

  function ustadz() {
    Shared.shell('admin', nav('admin_ustadz'), '');
    Shared.setHeader('Manajemen Ustadz', 'Kelola pengajar');
    const db = Store.get();
    const rows = db.ustadz.map(u => {
      const acc = db.users.find(usr => usr.role === 'ustadz' && usr.refId === u.id);
      const uname = acc ? acc.username : '-';
      const halaqahNames = db.halaqah.filter(h => Store.halaqahHasUstadz(h, u)).map(h => h.nama);
      const penugasanTalim = talimAssignmentSummary(u);
      return `<tr>
        <td><b>${UI.esc(u.nama)}</b></td>
        <td><code>${UI.esc(uname)}</code>${acc ? '' : ' <span class="badge danger">Belum ada akun</span>'}</td>
        <td>${UI.esc(u.noHp)}</td>
        <td>${UI.esc(u.email)}</td>
        <td>${UI.esc(halaqahNames.join(', ') || u.halaqah || '-')}</td>
        <td>${UI.esc(penugasanTalim || '-')}</td>
        <td><span class="badge ${u.status === 'Aktif' ? 'green' : 'gray'}">${UI.esc(u.status)}</span></td>
        <td>${ustadzRowActions(u)}</td>
      </tr>`;
    }).join('');
    document.getElementById('view-content').innerHTML = `
      <div class="clay-card">
        <div class="row" style="justify-content:space-between">
          <div class="section-title" style="margin:0">Daftar Ustadz (${db.ustadz.length})</div>
          <div class="row">
            <button class="clay-btn ghost" id="btn-import">Import Excel</button>
            <button class="clay-btn secondary" id="btn-download-xlsx">⬇ Download XLSX</button>
            <button class="clay-btn primary" id="btn-add">+ Tambah Ustadz</button>
          </div>
        </div>
        <div class="table-wrap mt"><table class="clay-table">
          <thead><tr><th>Nama</th><th>Username Login</th><th>No HP</th><th>Email</th><th>Halaqah</th><th>Penugasan Ta’lim</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="8"><div class="empty">Belum ada ustadz.</div></td></tr>`}</tbody>
        </table></div>
      </div>`;
    document.getElementById('btn-add').onclick = () => ustadzForm();
    document.getElementById('btn-import').onclick = () => importUstadzDialog();
    document.getElementById('btn-download-xlsx').onclick = downloadUstadzXlsx;
    document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => ustadzForm(b.dataset.edit));
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      UI.confirmDialog('Hapus Ustadz', 'Yakin hapus ustadz ini?', () => {
        const db = Store.get();
        const deleted = db.ustadz.find(x => x.id === b.dataset.del);
        db.halaqah.forEach(h => {
          const ids = Store.ustadzIdsForHalaqah(h);
          if (ids.includes(b.dataset.del) || (deleted && h.ustadz === deleted.nama)) {
            applyHalaqahUstadz(db, h, ids.filter(id => id !== b.dataset.del));
          }
        });
        db.ustadz = db.ustadz.filter(x => x.id !== b.dataset.del);
        db.users = db.users.filter(u => u.refId !== b.dataset.del);
        refreshUstadzHalaqah(db);
        Store.log('Hapus ustadz'); Store.save(); UI.toast('Ustadz dihapus'); ustadz();
      });
    });
  }

  function ustadzForm(id) {
    const db = Store.get();
    const u = id ? Store.findUstadz(id) : null;
    const body = `
      ${UI.field('Nama', `<input class="clay-input" id="f-nama" value="${u ? UI.esc(u.nama) : ''}">`)}
      <div class="row">
        <div style="flex:1">${UI.field('No HP', `<input class="clay-input" id="f-hp" value="${u ? UI.esc(u.noHp) : ''}">`)}</div>
        <div style="flex:1">${UI.field('Email', `<input class="clay-input" id="f-email" value="${u ? UI.esc(u.email) : ''}">`)}</div>
      </div>
      <div class="row">
        <div style="flex:1">${UI.field('Status', `<select class="clay-select" id="f-status"><option ${u && u.status === 'Aktif' ? 'selected' : ''}>Aktif</option><option ${u && u.status === 'Nonaktif' ? 'selected' : ''}>Nonaktif</option></select>`)}</div>
        <div style="flex:1">${UI.field('Halaqah', `<select class="clay-select" id="f-halaqah"><option value="">-</option>${UI.optionsFromList(db.halaqah.map(h => ({ v: h.nama, l: halaqahOptionLabel(h) })), 'v', 'l', u ? u.halaqah : '')}</select>`)}</div>
      </div>
      <div class="row">
        <div style="flex:1">${UI.field('Username', `<input class="clay-input" id="f-uname" value="${u ? UI.esc(db.users.find(x => x.role === 'ustadz' && x.refId === id)?.username || '') : ''}" placeholder="Otomatis jika kosong">`)}</div>
        <div style="flex:1">${UI.field('Password', `<input class="clay-input" id="f-pass" value="${u ? '' : '12345678'}" placeholder="Kosongkan jika tidak diubah">`)}</div>
      </div>`;
    UI.openModal({
      title: id ? 'Edit Ustadz' : 'Tambah Ustadz', bodyHTML: body,
      actions: [
        { label: 'Batal', cls: 'ghost', onClick: (m, c) => c() },
        { label: 'Simpan', cls: 'primary', onClick: async (m, c) => {
          const db = Store.get();
          const data = { nama: m.querySelector('#f-nama').value.trim(), noHp: m.querySelector('#f-hp').value.trim(), email: m.querySelector('#f-email').value.trim(), status: m.querySelector('#f-status').value, halaqah: m.querySelector('#f-halaqah').value };
          if (!data.nama) { UI.toast('Nama wajib', 'error'); return; }
          
          let uname = m.querySelector('#f-uname').value.trim();
          if (!uname) uname = (data.noHp && data.noHp.replace(/\D/g, '')) || data.nama.toLowerCase().replace(/\s/g, '');
          const password = m.querySelector('#f-pass').value.trim();
          const account = id ? db.users.find(x => x.role === 'ustadz' && x.refId === id) : null;
          if (db.users.some(x => x.id !== (account && account.id) && x.username.toLowerCase() === uname.toLowerCase())) {
            UI.toast('Username sudah digunakan akun lain', 'error'); return;
          }
          if (password && password.length < 6) { UI.toast('Password minimal 6 karakter', 'error'); return; }
          
          if (id) { 
            const current = Store.findUstadz(id);
            const oldName = current.nama;
            const assigned = db.halaqah.filter(h => Store.halaqahHasUstadz(h, current) || h.ustadz === oldName);
            Object.assign(current, data);
            assigned.forEach(h => {
              const ids = Store.ustadzIdsForHalaqah(h);
              applyHalaqahUstadz(db, h, ids.includes(id) ? ids : [...ids, id]);
            });
            const user = account;
            if (user) {
              user.username = uname;
              if (password) user.password = password;
            } else {
              db.users.push({ id: Store.uid('usr'), username: uname, password: password || '12345678', role: 'ustadz', refId: id });
            }
            assignUstadzToHalaqah(db, id, data.halaqah);
          }
          else {
            const nid = Store.uid('u'); const nu = { id: nid, ...data };
            db.ustadz.push(nu);
            const pass = password || '12345678';
            db.users.push({ id: Store.uid('usr'), username: uname, password: pass, role: 'ustadz', refId: nid });
            assignUstadzToHalaqah(db, nid, data.halaqah);
          }
          Store.log(id ? 'Edit ustadz' : 'Tambah ustadz');
          await Store.save(); c(); UI.toast('Tersimpan', 'success'); ustadz();
        } }
      ]
    });
  }

  function importUstadzDialog() {
    const body = `<p class="muted">Kolom: Nama | No HP | Email | Status | Halaqah | Username | Password</p>
      <div class="row">
        <button class="clay-btn ghost" id="imp-template">Download Template Excel</button>
      </div>
      <label class="field-label mt" for="imp-file">Pilih file template yang sudah diisi (.xls atau .csv)</label>
      <input class="clay-input" id="imp-file" type="file" accept=".xls,.csv,text/csv,application/vnd.ms-excel" />
      <label class="field-label mt">Atau tempel data dari Excel/CSV</label>
      <textarea class="clay-textarea mt" id="imp-data" placeholder="Ust. Ali, 0812..., ali@x.id, Aktif, Halaqah 1, ali_ustadz, 12345678"></textarea>`;
    const modal = UI.openModal({
      title: 'Import Ustadz', bodyHTML: body,
      actions: [
        { label: 'Batal', cls: 'ghost', onClick: (m, c) => c() },
        { label: 'Import', cls: 'primary', onClick: (m, c) => {
          const db = Store.get();
          const lines = parseImportRows(m.querySelector('#imp-data').value).filter(c => c[0]);
          let count = 0;
          lines.forEach(c => {
            const nid = Store.uid('u');
            db.ustadz.push({ id: nid, nama: c[0], noHp: c[1] || '', email: c[2] || '', status: c[3] || 'Aktif', halaqah: c[4] || '' });
            const uname = c[5] || (c[1] && c[1].replace(/\D/g, '')) || c[0].toLowerCase().replace(/\s/g, '');
            db.users.push({ id: Store.uid('usr'), username: uname, password: c[6] || '12345678', role: 'ustadz', refId: nid });
            assignUstadzToHalaqah(db, nid, c[4] || '');
            count++;
          });
          Store.save(); Store.log('Import ' + count + ' ustadz'); c(); UI.toast('Import ' + count + ' ustadz', 'success'); ustadz();
        } }
      ]
    });
    bindImportFile(modal.modal, ['Nama', 'No HP', 'Email', 'Status', 'Halaqah', 'Username', 'Password']);
    modal.modal.querySelector('#imp-template').onclick = () => Shared.downloadTemplateExcel(
      'Template_Import_Ustadz',
      ['Nama', 'No HP', 'Email', 'Status', 'Halaqah', 'Username', 'Password'],
      [['Ust. Ali', '081234567890', 'ali@contoh.id', 'Aktif', 'Halaqah 1', 'ali_ustadz', '12345678'],
       ['Ust. Budi', '081234567891', 'budi@contoh.id', 'Aktif', 'Halaqah 2', 'budi_ustadz', '12345678']],
      'Isi tiap baris untuk 1 ustadz. Simpan sebagai .xls lalu salin isinya ke kolom di bawah, atau tempel langsung dari Excel.'
    );
  }

  /* ---------------- Halaqah ---------------- */
  function halaqah() {
    Shared.shell('admin', nav('admin_halaqah'), '');
    Shared.setHeader('Manajemen Halaqah', 'Ustadz, halaqah, dan santri');
    const db = Store.get();
    const moveOptions = selected => {
      const options = db.halaqah.map(h => ({ value: h.id, label: halaqahOptionLabel(h) }));
      return `<option value="" ${!selected ? 'selected' : ''}>Pilih halaqah</option>${UI.optionsFromList(options, 'value', 'label', selected)}`;
    };
    const santriRows = (santri, currentHalaqah) => santri.flatMap(s => {
      const programs = currentHalaqah
        ? Store.programsForSantriHalaqah(s, currentHalaqah)
        : Store.activeProgramsForSantri(s);
      return programs.map(program => {
        const assigned = Store.halaqahForSantriProgram(s, program);
        return { s, program, assigned };
      });
    }).map(({ s, program, assigned }, i) => `<tr>
      <td class="center">${i + 1}</td>
      <td><b>${UI.esc(s.nama)}</b><div class="muted" style="font-size:12px">${UI.esc(s.nis || '-')}</div></td>
      <td>${UI.esc(Store.educationLabel(s))}</td>
      <td><span class="badge ${program === 'Ziyadah' ? 'green' : program === 'Mutqin' ? 'warn' : 'blue'}">${UI.esc(program || '-')}</span></td>
      <td><select class="clay-select" data-move-target style="min-width:160px">${moveOptions(assigned && assigned.id)}</select></td>
      <td class="center"><button class="clay-btn sm secondary" data-save-move="${UI.esc(s.id)}" data-program="${UI.esc(program)}">Simpan</button></td>
    </tr>`).join('');
    const group = (title, h, santri) => `<div class="clay-card mb">
      <div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px">
        <div>
          <div class="section-title" style="margin:0">${UI.esc(title)}${h ? ` <span class="muted" style="font-size:13px;font-weight:400">· ${UI.esc(Store.ustadzNamesForHalaqah(h).join(', ') || 'Belum ditetapkan')}</span>` : ''}</div>
          ${h ? `<div class="muted" style="font-size:13px;margin-top:5px">Level: ${UI.esc(h.level || '-')} · ${UI.esc(h.hari || '-')} · ${UI.esc(h.jam || '-')} · ${UI.esc(h.ruangan || '-')}<br>Setoran Bacaan: <b>${h.setoranBacaan ? 'Aktif' : 'Nonaktif'}</b></div>` : '<div class="muted" style="font-size:13px;margin-top:5px">Santri yang belum memiliki halaqah aktif.</div>'}
        </div>
        ${h ? `<div>${rowActionButtons([
          { label: 'Edit Halaqah', attr: ` data-edit-halaqah="${UI.esc(h.id)}"` },
          { label: 'Hapus', cls: 'danger', attr: ` data-del="${UI.esc(h.id)}"` }
        ])}</div>` : ''}
      </div>
      <div class="table-wrap"><table class="clay-table">
        <thead><tr><th class="center">No</th><th>Santri</th><th>Tingkat & Kelas</th><th>Jenis Setoran</th><th>Pindah ke Halaqah</th><th class="center">Aksi</th></tr></thead>
        <tbody>${santriRows(santri, h) || '<tr><td colspan="6"><div class="empty">Belum ada santri.</div></td></tr>'}</tbody>
      </table></div>
    </div>`;
    const groups = db.halaqah.map(h => group(h.nama, h, db.santri
      .filter(s => Store.santriHasHalaqah(s, h))
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id')))).join('');
    const withoutHalaqah = db.santri.filter(s => !Store.halaqahForSantri(s).length).sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
    document.getElementById('view-content').innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:16px">
      <div class="muted" style="font-size:13px">Penempatan dan jenis setoran disimpan terpisah. Santri Ziyadah boleh ditempatkan di halaqah Mutqin dan tetap setoran Ziyadah.</div>
        <button class="clay-btn primary" id="btn-add">+ Tambah Halaqah</button>
      </div>
      ${groups || '<div class="empty">Belum ada halaqah.</div>'}
      ${withoutHalaqah.length ? group('Belum Ditentukan Halaqah', null, withoutHalaqah) : ''}`;
    document.getElementById('btn-add').onclick = () => halaqahForm();
    document.querySelectorAll('[data-edit-halaqah]').forEach(b => b.onclick = () => halaqahForm(b.dataset.editHalaqah));
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      UI.confirmDialog('Hapus Halaqah', 'Yakin hapus halaqah?', () => {
        const db = Store.get();
        db.santri.forEach(santri => {
          const assignments = Object.assign({}, santri.halaqahProgram || {});
          Object.keys(assignments).forEach(program => { if (assignments[program] === b.dataset.del) delete assignments[program]; });
          santri.halaqahProgram = assignments;
        });
        db.halaqah = db.halaqah.filter(x => x.id !== b.dataset.del);
        Store.recalcHalaqah(); Store.save(); Store.log('Hapus halaqah'); UI.toast('Dihapus'); halaqah();
      });
    });
    document.querySelectorAll('[data-save-move]').forEach(button => button.onclick = async () => {
      const row = button.closest('tr');
      const target = row.querySelector('[data-move-target]').value;
      const santri = Store.findSantri(button.dataset.saveMove);
      const program = button.dataset.program;
      const targetHalaqah = Store.findHalaqahById(target);
      const currentHalaqah = santri && Store.halaqahForSantriProgram(santri, program);
      if (!santri || !targetHalaqah) { UI.toast('Pilih halaqah tujuan', 'error'); return; }
      if (currentHalaqah && currentHalaqah.id === targetHalaqah.id) { UI.toast('Belum ada perubahan halaqah', 'error'); return; }
      const previous = {
        programAktif: [...Store.activeProgramsForSantri(santri)],
        halaqahProgram: Object.assign({}, santri.halaqahProgram || {}),
        level: santri.level,
        halaqah: santri.halaqah
      };
      const assignments = Object.assign({}, previous.halaqahProgram, { [program]: targetHalaqah.id });
      Store.configureSantriPrograms(santri, previous.programAktif, assignments, previous.level);
      Store.recalcHalaqah();
      button.disabled = true;
      const saved = await Store.save();
      if (!saved) {
        Object.assign(santri, previous);
        Store.recalcHalaqah();
        button.disabled = false;
        UI.toast('Perpindahan gagal disimpan', 'error');
        return;
      }
      Store.log('Pindah santri: ' + santri.nama + ' ke ' + targetHalaqah.nama + ' (' + program + ')');
      UI.toast('Halaqah ' + santri.nama + ' untuk ' + program + ' diperbarui', 'success');
      halaqah();
    });
  }

  function halaqahForm(id) {
    const db = Store.get();
    const h = id ? db.halaqah.find(x => x.id === id) : null;
    const selectedUstadzIds = h ? Store.ustadzIdsForHalaqah(h) : [];
    const ustadzChecks = db.ustadz.slice().sort((a, b) => a.nama.localeCompare(b.nama, 'id')).map(u => `
      <label class="row" style="gap:8px;cursor:pointer;padding:5px 0">
        <input type="checkbox" data-halaqah-ustadz value="${UI.esc(u.id)}" ${selectedUstadzIds.includes(u.id) ? 'checked' : ''}>
        <span>${UI.esc(u.nama)} <span class="muted" style="font-size:12px">(${UI.esc(u.halaqah || 'Belum ditugaskan')})</span></span>
      </label>`).join('');
    const body = `
      ${UI.field('Nama Halaqah', `<input class="clay-input" id="f-nama" value="${h ? UI.esc(h.nama) : ''}">`)}
      ${UI.field('Ustadz Pengampu', `<div class="clay-card pad-sm" style="max-height:190px;overflow:auto">${ustadzChecks || '<div class="muted">Belum ada ustadz.</div>'}</div><div class="muted" style="font-size:12px;margin-top:4px">Boleh pilih lebih dari satu ustadz. Ustadz yang dipilih akan dipindahkan dari halaqah sebelumnya.</div>`)}
      <div class="row">
        <div style="flex:1">${UI.field('Level', `<select class="clay-select" id="f-level">${UI.optionsFromList(db.levelTahfidz.map(l => ({ v: l, l })), 'v', 'l', h ? h.level : 'Ziyadah')}</select>`)}</div>
      </div>
      <div class="row">
        <div style="flex:1">${UI.field('Hari', `<input class="clay-input" id="f-hari" value="${h ? UI.esc(h.hari) : 'Senin-Rabu-Jumat'}">`)}</div>
        <div style="flex:1">${UI.field('Jam', `<input class="clay-input" id="f-jam" value="${h ? UI.esc(h.jam) : '07:00-08:30'}">`)}</div>
      </div>
      ${UI.field('Ruangan', `<input class="clay-input" id="f-ruang" value="${h ? UI.esc(h.ruangan) : ''}">`)}
      ${UI.field('Fitur Setoran', `<label class="row" style="gap:8px;cursor:pointer"><input id="f-setoran-bacaan" type="checkbox" ${h && h.setoranBacaan ? 'checked' : ''}> <span>Aktifkan tahap Setoran Bacaan untuk halaqah ini</span></label><div class="muted" style="font-size:12px;margin-top:4px">Jika nonaktif, ustadz langsung menginput setoran hafalan.</div>`)}`;
    UI.openModal({
      title: id ? 'Edit Halaqah' : 'Tambah Halaqah', bodyHTML: body,
      actions: [
        { label: 'Batal', cls: 'ghost', onClick: (m, c) => c() },
        { label: 'Simpan', cls: 'primary', onClick: async (m, c) => {
          const db = Store.get();
          const data = { nama: m.querySelector('#f-nama').value.trim(), level: m.querySelector('#f-level').value, hari: m.querySelector('#f-hari').value.trim(), jam: m.querySelector('#f-jam').value.trim(), ruangan: m.querySelector('#f-ruang').value.trim(), setoranBacaan: m.querySelector('#f-setoran-bacaan').checked };
          const ustadzIds = [...m.querySelectorAll('[data-halaqah-ustadz]:checked')].map(input => input.value);
          if (!data.nama) { UI.toast('Nama wajib', 'error'); return; }
          if (db.halaqah.some(x => x.id !== id && x.nama.toLowerCase() === data.nama.toLowerCase())) { UI.toast('Nama halaqah sudah digunakan', 'error'); return; }
          let target;
          if (id) {
            target = db.halaqah.find(x => x.id === id);
            const oldName = target.nama;
            Object.assign(target, data);
            if (oldName !== target.nama) {
              db.santri.forEach(s => {
                if (s.halaqah === oldName) s.halaqah = target.nama;
                const primaryHalaqah = Store.halaqahForSantriProgram(s, s.level);
                if (primaryHalaqah && primaryHalaqah.id === target.id) s.halaqah = target.nama;
              });
              db.ustadz.forEach(u => { if (u.halaqah === oldName) u.halaqah = target.nama; });
              (db.jurnalTalim || []).forEach(j => { if (j.halaqah === oldName) j.halaqah = target.nama; });
            }
          } else {
            target = { id: Store.uid('h'), jumlahSantri: 0, ...data };
            db.halaqah.push(target);
          }
          syncHalaqahUstadz(db, target, ustadzIds);
          Store.recalcHalaqah(); Store.log('Simpan halaqah'); await Store.save(); c(); UI.toast('Tersimpan', 'success'); halaqah();
        } }
      ]
    });
  }

  /* ---------------- Master Surat ---------------- */
  function master() {
    Shared.shell('admin', nav('admin_master'), '');
    Shared.setHeader('Master Surat Al-Qur\'an', '114 Surat · Referensi Mushaf Standar Indonesia');
    const rows = SURAHS.map(s => `<tr>
      <td>${s.n}</td><td><b>${UI.esc(s.latin)}</b> <span class="muted">${s.arab}</span></td>
      <td>${s.ayahs}</td><td>${s.page}</td><td>${surahEndPage(s.n)}</td>
      <td>${pageToJuz(s.page)}</td>
    </tr>`).join('');
    document.getElementById('view-content').innerHTML = `
      <div class="clay-card">
        <div class="section-title">📜 Database Surat (${SURAHS.length})</div>
        <div class="table-wrap"><table class="clay-table">
          <thead><tr><th>#</th><th>Nama</th><th>Ayat</th><th>Hal Awal</th><th>Hal Akhir</th><th>Juz</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`;
  }

  /* ---------------- Riwayat (admin: pilih santri) ---------------- */
  function riwayat() {
    Shared.shell('admin', nav('admin_riwayat'), '');
    Shared.setHeader('Riwayat Santri', 'Histori lengkap per santri');
    const db = Store.get();
    const santriList = db.santri;
    
    document.getElementById('view-content').innerHTML = `
      <div class="clay-card">
        <label class="field-label">Cari Santri</label>
        <input class="clay-input" id="riwayat-search" type="search" placeholder="Ketik nama atau NIS santri..." autocomplete="off" />
        <div id="riwayat-santri-list" class="mt" style="max-height:200px;overflow-y:auto"></div>
        <div id="riwayat-content" class="mt"></div>
      </div>`;
    const searchInput = document.getElementById('riwayat-search');
    const santriListEl = document.getElementById('riwayat-santri-list');
    
    let selectedSantriId = santriList[0] && santriList[0].id;
    let searchTimer = null;
    
    function updateSantriList() {
      const term = searchInput.value.trim().toLowerCase();
      const filtered = santriList.filter(s => {
        return s.nama.toLowerCase().includes(term) || (s.nis && s.nis.toString().includes(term));
      });
      
      if (!filtered.length) {
        santriListEl.innerHTML = '<div class="empty">Santri tidak ditemukan.</div>';
        document.getElementById('riwayat-content').innerHTML = '';
        return;
      }
      
      santriListEl.innerHTML = filtered.map(s => `
        <div class="search-item ${s.id === selectedSantriId ? 'active' : ''}" data-sid="${s.id}" style="padding:8px 12px;cursor:pointer;border-radius:8px;margin:2px 0">
          <b>${UI.esc(s.nama)}</b> <span class="muted">(${UI.esc(s.nis || '-')})</span> <span class="muted" style="font-size:12px">${UI.esc(Store.halaqahSummaryForSantri(s))}</span>
        </div>
      `).join('');
      
      santriListEl.querySelectorAll('.search-item').forEach(el => {
        el.onclick = () => {
          santriListEl.querySelectorAll('.search-item').forEach(x => x.classList.remove('active'));
          el.classList.add('active');
          selectedSantriId = el.dataset.sid;
          const content = document.getElementById('riwayat-content');
          content.innerHTML = Shared.renderRiwayat(selectedSantriId);
          bindActions();
        };
      });
      
      if (!filtered.some(s => s.id === selectedSantriId)) {
        selectedSantriId = filtered[0].id;
        document.getElementById('riwayat-content').innerHTML = Shared.renderRiwayat(selectedSantriId);
        bindActions();
      }
    }
    
    function bindActions() {
      document.querySelectorAll('[data-hapus]').forEach(el => {
        el.onclick = () => {
          const type = el.dataset.hapus;
          const id = el.dataset.id;
          UI.confirmDialog('Hapus Setoran', 'Yakin ingin menghapus setoran ini?', () => {
            const db = Store.get();
            if (type === 'tahsin') db.tahsin = db.tahsin.filter(x => x.id !== id);
            else if (type === 'ziyadahBacaan') db.ziyadahBacaan = db.ziyadahBacaan.filter(x => x.id !== id);
            else if (type === 'ziyadahHafalan') db.ziyadahHafalan = db.ziyadahHafalan.filter(x => x.id !== id);
            else if (type === 'mutqin') db.mutqin = db.mutqin.filter(x => x.id !== id);
            Store.save(); UI.toast('Setoran dihapus', 'success');
            document.getElementById('riwayat-content').innerHTML = Shared.renderRiwayat(selectedSantriId);
            bindActions();
          });
        };
      });
    }
    
    const scheduleSearch = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(updateSantriList, 150);
    };
    Shared.bindSearchInput(searchInput, scheduleSearch);
    
    updateSantriList();
  }

  /* ---------------- Laporan ---------------- */
  function laporan() {
    Shared.shell('admin', nav('admin_laporan'), '');
    Shared.setHeader('Laporan', 'Filter & export');
    const db = Store.get();
    const range = Shared.rekapSetoranRange();
    document.getElementById('view-content').innerHTML = `
      <div class="clay-card mb">
        <div class="section-title"> Filter Laporan</div>
        <div class="row">
          <div style="flex:1">${UI.field('Dari Tanggal', `<input type="date" class="clay-input" id="f-dari" value="${range.dari}">`)}</div>
          <div style="flex:1">${UI.field('Sampai Tanggal', `<input type="date" class="clay-input" id="f-sampai" value="${range.sampai}">`)}</div>
          <div style="flex:1">${UI.field('Halaqah', `<select class="clay-select" id="f-halaqah"><option value="">Semua</option>${UI.optionsFromList(db.halaqah.map(h => ({ v: h.nama, l: halaqahOptionLabel(h) })), 'v', 'l')}</select>`)}</div>
          <div style="flex:1">${UI.field('Level', `<select class="clay-select" id="f-level"><option value="">Semua</option>${UI.optionsFromList(db.levelTahfidz.map(l => ({ v: l, l })), 'v', 'l')}</select>`)}</div>
          <div style="flex:1">${UI.field('Tingkat', `<select class="clay-select" id="f-tingkat"><option value="">Semua</option>${UI.optionsFromList(Store.tingkatOptions().map(t => ({ v: t, l: t })), 'v', 'l')}</select>`)}</div>
          <div style="flex:1">${UI.field('Kelas', `<select class="clay-select" id="f-kelas" disabled><option value="">Pilih tingkat dahulu</option></select>`)}</div>
          <div style="flex:1">${UI.field('Status', `<select class="clay-select" id="f-status"><option value="">Semua</option><option>Aktif</option><option>Nonaktif</option></select>`)}</div>
        </div>
        <div class="row mt">
          <button class="clay-btn ghost" data-lap-preset="week">7 Hari</button>
          <button class="clay-btn ghost" data-lap-preset="month">Bulan Ini</button>
          <button class="clay-btn ghost" data-lap-preset="lastmonth">Bulan Lalu</button>
        </div>
      </div>
      <div id="laporan-content"></div>`;
    const apply = () => {
      const f = {
        dari: document.getElementById('f-dari').value,
        sampai: document.getElementById('f-sampai').value,
        halaqah: document.getElementById('f-halaqah').value,
        level: document.getElementById('f-level').value,
        tingkat: document.getElementById('f-tingkat').value,
        kelas: document.getElementById('f-kelas').value,
        status: document.getElementById('f-status').value,
        bulan: (document.getElementById('f-dari').value || '').slice(0, 7)
      };
      Shared.setRekapSetoranRange(f.dari, f.sampai);
      document.getElementById('laporan-content').innerHTML = Shared.renderLaporan(f);
      Shared.bindLaporanExport();
    };
    document.querySelectorAll('[data-lap-preset]').forEach(button => button.onclick = () => {
      const today = Store.todayStr();
      const preset = button.dataset.lapPreset;
      let dari = today, sampai = today;
      if (preset === 'week') dari = Store.tambahHari(today, -6);
      if (preset === 'month') dari = today.slice(0, 8) + '01';
      if (preset === 'lastmonth') {
        const awal = new Date(today.slice(0, 8) + '01T12:00:00');
        awal.setMonth(awal.getMonth() - 1);
        const akhir = new Date(awal.getFullYear(), awal.getMonth() + 1, 0);
        dari = `${awal.getFullYear()}-${String(awal.getMonth() + 1).padStart(2, '0')}-01`;
        sampai = `${akhir.getFullYear()}-${String(akhir.getMonth() + 1).padStart(2, '0')}-${String(akhir.getDate()).padStart(2, '0')}`;
      }
      document.getElementById('f-dari').value = dari;
      document.getElementById('f-sampai').value = sampai;
      apply();
    });
    // Kelas selalu mengikuti Tingkat: daftar kelas di luar tingkat terpilih tidak
    // relevan, jadi dropdown-nya dinonaktifkan sampai tingkat dipilih.
    document.getElementById('f-tingkat').onchange = () => {
      const tingkat = document.getElementById('f-tingkat').value;
      const kelasSelect = document.getElementById('f-kelas');
      if (!tingkat) {
        kelasSelect.innerHTML = '<option value="">Pilih tingkat dahulu</option>';
        kelasSelect.disabled = true;
      } else {
        kelasSelect.innerHTML = `<option value="">Semua</option>${UI.optionsFromList(Store.kelasOptions(tingkat).map(k => ({ v: k, l: 'Kelas ' + k })), 'v', 'l')}`;
        kelasSelect.disabled = false;
      }
      apply();
    };
    ['f-dari', 'f-sampai', 'f-halaqah', 'f-level', 'f-kelas', 'f-status'].forEach(id => document.getElementById(id).onchange = apply);
    apply();
  }

  /* ---------------- Rekap Kehadiran ----------------
     Totalan Hadir/Izin/Sakit/Alfa per orang untuk satu periode. Alfa dihitung
     dari slot yang tidak ada catatannya, jadi angkanya selalu cocok dengan
     "jumlah hari x sesi". */
  function rekapKehadiran() {
    Shared.shell('admin', nav('admin_rekap_kehadiran'), '');
    Shared.setHeader('Rekap Kehadiran', 'Totalan hadir, izin, sakit, dan alfa per periode');
    const db = Store.get();
    const hariIni = Store.todayStr();
    const awalBulan = hariIni.slice(0, 8) + '01';

    document.getElementById('view-content').innerHTML = `
      <div class="clay-card mb">
        <div class="row">
          <div style="flex:1;min-width:140px">${UI.field('Dari Tanggal', `<input type="date" class="clay-input" id="rk-dari" value="${awalBulan}">`)}</div>
          <div style="flex:1;min-width:140px">${UI.field('Sampai Tanggal', `<input type="date" class="clay-input" id="rk-sampai" value="${hariIni}">`)}</div>
          <div style="flex:1;min-width:140px">${UI.field('Sesi', `<select class="clay-select" id="rk-sesi"><option value="">Semua Sesi</option>${Store.SESI_REKAP.map(s => `<option>${UI.esc(s)}</option>`).join('')}</select>`)}</div>
          <div style="flex:1;min-width:150px">${UI.field('Halaqah', `<select class="clay-select" id="rk-halaqah"><option value="">Semua Halaqah</option>${UI.optionsFromList(db.halaqah.map(h => ({ v: h.id, l: halaqahOptionLabel(h, false) })), 'v', 'l')}</select>`)}</div>
        </div>
        <div class="row mt">
          <button class="clay-btn ghost" data-rk-preset="today">Hari Ini</button>
          <button class="clay-btn ghost" data-rk-preset="week">7 Hari</button>
          <button class="clay-btn ghost" data-rk-preset="month">Bulan Ini</button>
          <button class="clay-btn ghost" data-rk-preset="lastmonth">Bulan Lalu</button>
          <button class="clay-btn secondary" id="rk-export">Export Excel</button>
        </div>
      </div>
      <div class="pill-tabs" id="rk-tab-bar">
        <button class="pill active" data-rk-tab="santri">Santri</button>
        <button class="pill" data-rk-tab="ustadz">Ustadz</button>
      </div>
      <div data-rk-panel="santri"><div id="rk-santri"></div></div>
      <div data-rk-panel="ustadz" style="display:none"><div id="rk-ustadz"></div></div>`;

    function filter() {
      const dari = document.getElementById('rk-dari').value;
      let sampai = document.getElementById('rk-sampai').value || dari;
      const batas = dari ? Store.tambahHari(dari, 365) : '';
      if (batas && sampai > batas) sampai = batas;
      const sesi = document.getElementById('rk-sesi').value;
      return {
        dari,
        sampai,
        sesiList: sesi ? [sesi] : Store.SESI_REKAP.slice(),
        halaqahId: document.getElementById('rk-halaqah').value
      };
    }

    // Persentase kehadiran dihitung dari slot efektif (total slot dikurangi sesi libur).
    function persen(total) {
      if (typeof total.persen === 'number') return total.persen;
      const eff = (total.slot || 0) - (total.Libur || 0);
      if (!eff) return (total.Hadir ? 100 : 0);
      return Math.round(((total.Hadir || 0) / eff) * 100);
    }

    function badgeAngka(value, cls) {
      if (!value) return '<span class="muted">-</span>';
      return `<span class="badge ${cls}">${value}</span>`;
    }

    function renderSantri(f) {
      const target = f.halaqahId ? Store.findHalaqahById(f.halaqahId) : null;
      const list = db.santri
        .filter(s => s.status !== 'Nonaktif')
        .filter(s => !target || Store.santriHasHalaqah(s, target))
        .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

      const rows = list.map(s => {
        const r = Store.rekapKehadiranSantri(s.id, f.dari, f.sampai, f.sesiList);
        return { s, ...r.total, perSesi: r.perSesi };
      });
      const jumlah = rows.reduce((acc, r) => ({
        Hadir: acc.Hadir + r.Hadir, Izin: acc.Izin + r.Izin,
        Sakit: acc.Sakit + r.Sakit, Libur: acc.Libur + (r.Libur || 0), Alfa: acc.Alfa + r.Alfa
      }), { Hadir: 0, Izin: 0, Sakit: 0, Libur: 0, Alfa: 0 });

      const sesiHeads = f.sesiList.map(sesi => `<th class="center">${UI.esc(sesi)}</th>`).join('');
      const body = rows.map((r, i) => {
        const sesiCells = f.sesiList.map(sesi => {
          const p = r.perSesi[sesi];
          return `<td class="center" style="font-size:12px">${UI.esc(p.Hadir || 0)}/${UI.esc(p.Izin || 0)}/${UI.esc(p.Sakit || 0)}/${UI.esc(p.Libur ? p.Libur + '/' : '')}${UI.esc(p.Alfa || 0)}</td>`;
        }).join('');
        return `<tr>
          <td class="center">${i + 1}</td>
          <td><b>${UI.esc(r.s.nama)}</b><div class="muted" style="font-size:11px">${UI.esc(r.s.nis || '-')}</div></td>
          <td>${UI.esc(Store.educationLabel(r.s))}</td>
          <td>${UI.esc(Store.halaqahSummaryForSantri(r.s))}</td>
          ${sesiCells}
          <td class="center">${badgeAngka(r.Hadir, 'green')}</td>
          <td class="center">${badgeAngka(r.Izin, 'warn')}</td>
          <td class="center">${badgeAngka(r.Sakit, 'blue')}</td>
          <td class="center">${badgeAngka(r.Libur, 'purple')}</td>
          <td class="center">${badgeAngka(r.Alfa, 'danger')}</td>
          <td class="center"><b>${persen(r)}%</b></td>
        </tr>`;
      }).join('');

      document.getElementById('rk-santri').innerHTML = `
        <div class="clay-card">
          <div class="row" style="justify-content:space-between;margin-bottom:10px">
            <div class="section-title" style="margin:0">Totalan Santri</div>
            <span class="muted" style="font-size:13px">${rows.length} santri</span>
          </div>
          <div class="grid kpi mb">
            ${Shared.statCard(Shared.ICONS.moon, jumlah.Hadir, 'Total Hadir', '#22C55E')}
            ${Shared.statCard(Shared.ICONS.users, jumlah.Izin, 'Total Izin', '#FACC15')}
            ${Shared.statCard(Shared.ICONS.teacher, jumlah.Sakit, 'Total Sakit', '#3B82F6')}
            ${Shared.statCard(Shared.ICONS.sun, jumlah.Libur, 'Total Libur', '#A855F7')}
            ${Shared.statCard(Shared.ICONS.book, jumlah.Alfa, 'Total Alfa', '#EF4444')}
          </div>
          <div class="muted" style="font-size:12px;margin-bottom:8px">Kolom sesi berisi <b>Hadir/Izin/Sakit/Libur/Alfa</b>. Libur ditiadakan dari perhitungan Alfa.</div>
          <div class="table-wrap"><table class="clay-table">
            <thead><tr><th class="center">No</th><th>Santri</th><th>Tingkat & Kelas</th><th>Halaqah</th>${sesiHeads}<th class="center">Hadir</th><th class="center">Izin</th><th class="center">Sakit</th><th class="center">Libur</th><th class="center">Alfa</th><th class="center">%</th></tr></thead>
            <tbody>${body || '<tr><td colspan="11"><div class="empty">Tidak ada santri.</div></td></tr>'}</tbody>
          </table></div>
        </div>`;
    }

    function renderUstadz(f) {
      const list = db.ustadz
        .filter(u => u.status !== 'Nonaktif')
        .filter(u => !f.halaqahId || Store.halaqahHasUstadz(Store.findHalaqahById(f.halaqahId) || {}, u))
        .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

      const rows = list.map(u => {
        const r = Store.rekapKehadiranUstadz(u.id, f.dari, f.sampai, f.sesiList);
        return { u, ...r.total, perSesi: r.perSesi };
      });
      const jumlah = rows.reduce((acc, r) => ({
        Hadir: acc.Hadir + r.Hadir, Izin: acc.Izin + r.Izin,
        Sakit: acc.Sakit + r.Sakit, Libur: acc.Libur + (r.Libur || 0), Alfa: acc.Alfa + r.Alfa
      }), { Hadir: 0, Izin: 0, Sakit: 0, Libur: 0, Alfa: 0 });

      const body = rows.map((r, i) => {
        const sesiCells = f.sesiList.map(sesi => {
          const p = r.perSesi[sesi];
          return `<td class="center" style="font-size:12px">${UI.esc(p.Hadir || 0)}/${UI.esc(p.Izin || 0)}/${UI.esc(p.Sakit || 0)}/${UI.esc(p.Libur ? p.Libur + '/' : '')}${UI.esc(p.Alfa || 0)}</td>`;
        }).join('');
        return `<tr>
          <td class="center">${i + 1}</td>
          <td><b>${UI.esc(r.u.nama)}</b></td>
          <td>${UI.esc(Store.ustadzNamesForHalaqah(Store.findHalaqahForUstadz(r.u) || {}).join(', ') || '-')}</td>
          ${sesiCells}
          <td class="center">${badgeAngka(r.Hadir, 'green')}</td>
          <td class="center">${badgeAngka(r.Izin, 'warn')}</td>
          <td class="center">${badgeAngka(r.Sakit, 'blue')}</td>
          <td class="center">${badgeAngka(r.Libur, 'purple')}</td>
          <td class="center">${badgeAngka(r.Alfa, 'danger')}</td>
          <td class="center"><b>${persen(r)}%</b></td>
        </tr>`;
      }).join('');

      document.getElementById('rk-ustadz').innerHTML = `
        <div class="clay-card">
          <div class="row" style="justify-content:space-between;margin-bottom:10px">
            <div class="section-title" style="margin:0">Totalan Ustadz</div>
            <span class="muted" style="font-size:13px">${rows.length} ustadz</span>
          </div>
          <div class="grid kpi mb">
            ${Shared.statCard(Shared.ICONS.moon, jumlah.Hadir, 'Total Hadir', '#22C55E')}
            ${Shared.statCard(Shared.ICONS.users, jumlah.Izin, 'Total Izin', '#FACC15')}
            ${Shared.statCard(Shared.ICONS.teacher, jumlah.Sakit, 'Total Sakit', '#3B82F6')}
            ${Shared.statCard(Shared.ICONS.sun, jumlah.Libur, 'Total Libur', '#A855F7')}
            ${Shared.statCard(Shared.ICONS.book, jumlah.Alfa, 'Total Alfa', '#EF4444')}
          </div>
          <div class="muted" style="font-size:12px;margin-bottom:8px">Kolom sesi berisi <b>Hadir/Izin/Sakit/Libur/Alfa</b>. Alfa = sesi tanpa catatan absensi di luar libur.</div>
          <div class="table-wrap"><table class="clay-table">
            <thead><tr><th class="center">No</th><th>Ustadz</th><th>Halaqah</th>${f.sesiList.map(sesi => `<th class="center">${UI.esc(sesi)}</th>`).join('')}<th class="center">Hadir</th><th class="center">Izin</th><th class="center">Sakit</th><th class="center">Libur</th><th class="center">Alfa</th><th class="center">%</th></tr></thead>
            <tbody>${body || '<tr><td colspan="11"><div class="empty">Tidak ada ustadz.</div></td></tr>'}</tbody>
          </table></div>
        </div>`;
    }

    function apply() {
      const f = filter();
      if (!f.dari || !f.sampai) {
        document.getElementById('rk-santri').innerHTML = '<div class="empty">Pilih rentang tanggal.</div>';
        document.getElementById('rk-ustadz').innerHTML = '<div class="empty">Pilih rentang tanggal.</div>';
        return;
      }
      renderSantri(f);
      renderUstadz(f);
    }

    document.querySelectorAll('#rk-tab-bar [data-rk-tab]').forEach(button => button.onclick = () => {
      document.querySelectorAll('#rk-tab-bar [data-rk-tab]').forEach(b => b.classList.toggle('active', b === button));
      document.querySelectorAll('[data-rk-panel]').forEach(panel => {
        panel.style.display = panel.dataset.rkPanel === button.dataset.rkTab ? '' : 'none';
      });
    });
    document.querySelectorAll('[data-rk-preset]').forEach(button => button.onclick = () => {
      const today = Store.todayStr();
      const preset = button.dataset.rkPreset;
      let dari = today, sampai = today;
      if (preset === 'week') dari = Store.tambahHari(today, -6);
      if (preset === 'month') dari = today.slice(0, 8) + '01';
      if (preset === 'lastmonth') {
        const awal = new Date(today.slice(0, 8) + '01T12:00:00');
        awal.setMonth(awal.getMonth() - 1);
        const akhir = new Date(awal.getFullYear(), awal.getMonth() + 1, 0);
        dari = `${awal.getFullYear()}-${String(awal.getMonth() + 1).padStart(2, '0')}-01`;
        sampai = `${akhir.getFullYear()}-${String(akhir.getMonth() + 1).padStart(2, '0')}-${String(akhir.getDate()).padStart(2, '0')}`;
      }
      document.getElementById('rk-dari').value = dari;
      document.getElementById('rk-sampai').value = sampai;
      apply();
    });
    ['rk-dari', 'rk-sampai', 'rk-sesi', 'rk-halaqah'].forEach(id => {
      document.getElementById(id).onchange = apply;
    });
    document.getElementById('rk-export').onclick = () => {
      const f = filter();
      if (!f.dari || !f.sampai) { UI.toast('Pilih rentang tanggal', 'error'); return; }
      const periode = UI.fmtDate(f.dari) + ' - ' + UI.fmtDate(f.sampai);
      const sesiHeads = f.sesiList.map(s => `<th class="center">${UI.esc(s)}</th>`).join('');
      const baris = (judul, list, ambil) => {
        const body = list.map((item, i) => {
          const r = ambil(item);
          const sesiCells = f.sesiList.map(sesi => {
            const p = r.perSesi[sesi];
            return `<td class="center">${UI.esc(p.Hadir || 0)}/${UI.esc(p.Izin || 0)}/${UI.esc(p.Sakit || 0)}/${UI.esc(p.Libur ? p.Libur + '/' : '')}${UI.esc(p.Alfa || 0)}</td>`;
          }).join('');
          return `<tr>
            <td class="center">${i + 1}</td>
            <td>${UI.esc(r.nama)}</td>
            ${sesiCells}
            <td class="center">${UI.esc(r.Hadir || 0)}</td>
            <td class="center">${UI.esc(r.Izin || 0)}</td>
            <td class="center">${UI.esc(r.Sakit || 0)}</td>
            <td class="center">${UI.esc(r.Libur || 0)}</td>
            <td class="center">${UI.esc(r.Alfa || 0)}</td>
            <td class="center">${persen(r)}%</td>
          </tr>`;
        }).join('');
        return `<div class="title">${UI.esc(judul)}</div>
          <div class="sub">Periode: ${UI.esc(periode)}</div>
          <table>
            <thead><tr><th class="center">No</th><th>Nama</th>${sesiHeads}<th class="center">Hadir</th><th class="center">Izin</th><th class="center">Sakit</th><th class="center">Libur</th><th class="center">Alfa</th><th class="center">%</th></tr></thead>
            <tbody>${body}</tbody>
          </table>`;
      };

      const target = f.halaqahId ? Store.findHalaqahById(f.halaqahId) : null;
      const daftarSantri = db.santri
        .filter(s => s.status !== 'Nonaktif')
        .filter(s => !target || Store.santriHasHalaqah(s, target))
        .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
        .map(s => {
          const r = Store.rekapKehadiranSantri(s.id, f.dari, f.sampai, f.sesiList);
          return { nama: s.nama, ...r.total, perSesi: r.perSesi };
        });
      const ustadz = db.ustadz
        .filter(u => u.status !== 'Nonaktif')
        .filter(u => !f.halaqahId || Store.halaqahHasUstadz(Store.findHalaqahById(f.halaqahId) || {}, u))
        .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
        .map(u => {
          const r = Store.rekapKehadiranUstadz(u.id, f.dari, f.sampai, f.sesiList);
          return { nama: u.nama, ...r.total, perSesi: r.perSesi };
        });

      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>
  body{font-family:Calibri,Arial,sans-serif}
  table{border-collapse:collapse;font-size:11pt;margin-bottom:18px}
  th,td{border:1px solid #999;padding:5px 8px}
  th{background:#16a34a;color:#fff;text-align:center}
  .center{text-align:center}
  .title{font-size:13pt;font-weight:bold;text-align:center}
  .sub{font-size:10pt;color:#555;text-align:center;margin-bottom:4px}
</style></head>
<body>
  <div class="title">REKAP KEHADIRAN — ${UI.esc(db.settings.namaLembaga)}</div>
  ${baris('Santri', daftarSantri, x => x)}
  ${baris('Ustadz', ustadz, x => x)}
</body></html>`;
      // Rekap kehadiran memuat dua tabel (Santri & Ustadz), jadi dikirim ke
      // Excel sebagai satu file dengan dua sheet terpisah, bukan digabung.
      const parsed = Shared.htmlTableToSheet(html);
      if (parsed) {
        const sumber = new DOMParser().parseFromString(html, 'text/html');
        const sheets = [...sumber.querySelectorAll('table')].map(tabel => {
          const wrapper = document.createElement('div');
          wrapper.appendChild(tabel.cloneNode(true));
          const sheet = Shared.htmlTableToSheet(wrapper.innerHTML);
          return sheet && sheet.sheet;
        }).filter(Boolean);
        if (sheets.length) {
          Shared.downloadXlsx('Rekap_Kehadiran_' + f.dari + '_sd_' + f.sampai, sheets);
        } else {
          Shared.downloadExcel('Rekap_Kehadiran_' + f.dari + '_sd_' + f.sampai, html);
        }
      } else {
        Shared.downloadExcel('Rekap_Kehadiran_' + f.dari + '_sd_' + f.sampai, html);
      }
      UI.toast('Berhasil export Excel', 'success');
    };
    apply();
  }

/* ---------------- Absensi Ustadz ---------------- */
  const SESI_ABSENSI = ['Subuh', 'Ashar', 'Maghrib', 'Isya', 'Ta’lim Malam'];
  const STATUS_ABSENSI = ['Hadir', 'Izin', 'Sakit', 'Libur'];

  function absensiBadgeClass(status) {
    return status === 'Hadir' ? 'green' : status === 'Izin' ? 'warn' : status === 'Sakit' ? 'blue' : status === 'Libur' ? 'purple' : 'danger';
  }

  // Batasi rekap agar tabel tidak pernah memuat ribuan baris dari satu klik.
  const AU_MAX_HARI = 366;

  function auAddDays(iso, days) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + days);
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // Daftar tanggal inklusif dari `dari` sampai `sampai`. String tanggal selalu
  // berformat YYYY-MM-DD sehingga perbandingan leksikografis sama dengan urutan.
  function auDateRange(dari, sampai) {
    if (!dari || !sampai || sampai < dari) return [];
    const list = [];
    let cursor = dari;
    while (cursor <= sampai && list.length <= AU_MAX_HARI) { list.push(cursor); cursor = auAddDays(cursor, 1); }
    return list;
  }

  function auRangeLabel(dari, sampai) {
    if (!dari && !sampai) return '-';
    if (dari === sampai) return UI.fmtDate(dari);
    return UI.fmtDate(dari) + ' - ' + UI.fmtDate(sampai);
  }

  /* Rekap absensi ustadz untuk admin/koordinator. Satu ustadz hanya punya satu
     catatan per sesi, jadi tabel ini bisa dibaca apa adanya. */
  function absensiUstadz() {
    Shared.shell('admin', nav('admin_absensi_ustadz'), '');
    Shared.setHeader('Absensi Ustadz', 'Kehadiran ustadz pengampu per sesi');
    const db = Store.get();
    const ustadzAktif = db.ustadz.filter(u => u.status !== 'Nonaktif');

    document.getElementById('view-content').innerHTML = `
      <div class="clay-card mb">
        <div class="row">
          <div style="flex:1;min-width:150px">${UI.field('Dari Tanggal', `<input type="date" class="clay-input" id="au-dari" value="${Store.todayStr()}">`)}</div>
          <div style="flex:1;min-width:150px">${UI.field('Sampai Tanggal', `<input type="date" class="clay-input" id="au-sampai" value="${Store.todayStr()}">`)}</div>
          <div style="flex:1;min-width:130px">${UI.field('Sesi', `<select class="clay-select" id="au-sesi"><option value="">Semua Sesi</option>${SESI_ABSENSI.map(x => `<option>${UI.esc(x)}</option>`).join('')}</select>`)}</div>
          <div style="flex:1;min-width:140px">${UI.field('Status', `<select class="clay-select" id="au-status"><option value="">Semua</option>${STATUS_ABSENSI.map(x => `<option>${UI.esc(x)}</option>`).join('')}<option value="__none">Belum Absen</option></select>`)}</div>
          <div style="flex:1;min-width:160px">${UI.field('Halaqah', `<select class="clay-select" id="au-halaqah"><option value="">Semua Halaqah</option>${UI.optionsFromList(db.halaqah.map(h => ({ v: h.id, l: halaqahOptionLabel(h, false) })), 'v', 'l')}</select>`)}</div>
          <div style="flex:1;min-width:160px">${UI.field('Cari Ustadz', `<input class="clay-input" id="au-cari" type="search" placeholder="Nama ustadz" autocomplete="off">`)}</div>
        </div>
        <div class="row mt">
          <button class="clay-btn secondary" id="au-export">Export Excel</button>
          <button class="clay-btn ghost" data-au-preset="today">Hari Ini</button>
          <button class="clay-btn ghost" data-au-preset="7">7 Hari</button>
          <button class="clay-btn ghost" data-au-preset="30">30 Hari</button>
          <button class="clay-btn ghost" data-au-preset="month">Bulan Ini</button>
        </div>
      </div>
      <div id="au-content"></div>`;

    // Satu hari tetap memakai baris per ustadz per sesi (termasuk yang belum
    // absen). Lebih dari satu hari memakai satu baris per catatan yang benar-benar
    // ada, karena menyorot setiap slot kosong untuk puluhan hari hanya menambah
    // baris kosong tanpa informasi baru.
    function isDaily(f) { return f.dari === f.sampai; }

    function filter() {
      const dari = document.getElementById('au-dari').value;
      let sampai = document.getElementById('au-sampai').value || dari;
      // Panjang periode dibatasi supaya rekap tetap ringan dimuat dan terbaca.
      const batas = dari ? auAddDays(dari, AU_MAX_HARI - 1) : '';
      if (batas && sampai > batas) sampai = batas;
      return {
        dari,
        sampai,
        sesi: document.getElementById('au-sesi').value,
        status: document.getElementById('au-status').value,
        halaqahId: document.getElementById('au-halaqah').value,
        term: document.getElementById('au-cari').value.trim().toLowerCase()
      };
    }

    // Bila tanggal terbalik (sampai lebih dulu dari dari), urutannya dibalik.
    function normalize(f) {
      if (f.dari && f.sampai && f.sampai < f.dari) return Object.assign({}, f, { dari: f.sampai, sampai: f.dari });
      return f;
    }

    function ustadzOf(f) {
      const target = f.halaqahId ? Store.findHalaqahById(f.halaqahId) : null;
      return ustadzAktif.filter(u => {
        if (target && !Store.halaqahHasUstadz(target, u)) return false;
        if (f.term && !(u.nama || '').toLowerCase().includes(f.term)) return false;
        return true;
      });
    }

    function rowsOf(f) {
      f = normalize(f);
      // Tanpa tanggal, rekap tidak menampilkan apa pun. Menampilkan seluruh
      // ustadz sebagai "Belum Absen" hanya menyesatkan.
      if (!f.dari || !f.sampai) return [];
      const sesiList = f.sesi ? [f.sesi] : SESI_ABSENSI;
      const ustadz = ustadzOf(f);
      const rows = [];
      if (isDaily(f)) {
        ustadz.forEach(u => {
          sesiList.forEach(sesi => {
            const rec = db.absensiUstadz.find(a => a.ustadzId === u.id && a.tanggal === f.dari && a.sesi === sesi);
            if (f.status === '__none') { if (rec) return; }
            else if (f.status) { if (!rec || rec.status !== f.status) return; }
            rows.push({ tanggal: f.dari, ustadz: u, sesi, rec });
          });
        });
        return rows;
      }
      const days = new Set(auDateRange(f.dari, f.sampai));
      db.absensiUstadz.forEach(rec => {
        if (!days.has(rec.tanggal)) return;
        if (f.sesi && rec.sesi !== f.sesi) return;
        if (f.status === '__none') return;
        if (f.status && rec.status !== f.status) return;
        const u = ustadz.find(x => x.id === rec.ustadzId);
        if (!u) return;
        rows.push({ tanggal: rec.tanggal, ustadz: u, sesi: rec.sesi, rec });
      });
      rows.sort((a, b) => (a.tanggal === b.tanggal
        ? SESI_ABSENSI.indexOf(a.sesi) - SESI_ABSENSI.indexOf(b.sesi)
        : (a.tanggal < b.tanggal ? 1 : -1)));
      return rows;
    }

    function render() {
      const f = normalize(filter());
      // "Belum Absen" hanya terisi untuk mode harian. Bila dipakai bersama
      // rentang hari, kembalikan ke "semua" agar tabel tidak kosong tanpa alasan.
      if (f.status === '__none' && !isDaily(f)) {
        document.getElementById('au-status').value = '';
        f.status = '';
      }
      const rows = rowsOf(f);
      // Angka rekap harus dihitung tanpa filter status supaya "Belum Absen"
      // tetap aware jumlah catatan yang benar-benar ada pada periode itu.
      const allRows = f.status ? rowsOf(Object.assign({}, f, { status: '' })) : rows;
      const sesiList = f.sesi ? [f.sesi] : SESI_ABSENSI;
      const total = ustadzAktif.length;
      const days = auDateRange(f.dari, f.sampai);
      const belum = days.length ? total * days.length : 0;
      const kpi = sesiList.map(sesi => {
        const list = allRows.filter(r => r.sesi === sesi);
        const count = status => list.filter(r => r.rec && r.rec.status === status).length;
        const tercatat = list.filter(r => r.rec).length;
        const kosong = isDaily(f)
          ? list.filter(r => !r.rec).length
          : Math.max(0, belum - tercatat);
        const suffix = isDaily(f) ? '/' + total : '';
        return `<div class="grid kpi">
          ${Shared.statCard(Shared.ICONS.moon, count('Hadir') + suffix, sesi + ' - Hadir', '#22C55E')}
          ${Shared.statCard(Shared.ICONS.users, count('Izin') + suffix, sesi + ' - Izin', '#FACC15')}
          ${Shared.statCard(Shared.ICONS.teacher, count('Sakit') + suffix, sesi + ' - Sakit', '#3B82F6')}
          ${Shared.statCard(Shared.ICONS.calendar, count('Libur') + suffix, sesi + ' - Libur', '#A855F7')}
          ${Shared.statCard(Shared.ICONS.book, kosong + suffix, sesi + ' - Belum Absen', '#EF4444')}
        </div>`;
      }).join('');

      const showTanggal = !isDaily(f);
      const body = rows.map(r => {
        const halaqah = Store.findHalaqahForUstadz(r.ustadz);
        return `<tr>
          ${showTanggal ? `<td>${UI.esc(UI.fmtDate(r.tanggal))}</td>` : ''}
          <td><b>${UI.esc(r.ustadz.nama)}</b><div class="muted" style="font-size:11px">${UI.esc(halaqah ? halaqah.nama : (r.ustadz.halaqah || '-'))}</div></td>
          <td>${UI.esc(r.sesi)}</td>
          <td>${r.rec ? `<span class="badge ${absensiBadgeClass(r.rec.status)}">${UI.esc(r.rec.status)}</span>` : '<span class="badge gray">Belum Absen</span>'}</td>
          <td>${r.rec && r.rec.waktu ? UI.fmtDateTime(r.rec.waktu) : '<span class="muted">-</span>'}</td>
          <td style="font-size:12px">${UI.esc(r.rec && r.rec.catatan ? r.rec.catatan : '-')}</td>
          <td>${r.rec ? `<button class="clay-btn ghost sm" data-hapus-au="${UI.esc(r.rec.id)}">Hapus</button>` : ''}</td>
        </tr>`;
      }).join('');

      const heads = (showTanggal ? '<th>Tanggal</th>' : '') + '<th>Ustadz</th><th>Sesi</th><th>Status</th><th>Jam</th><th>Catatan</th><th></th>';
      document.getElementById('au-content').innerHTML = `
        ${kpi}
        <div class="clay-card mt">
          <div class="row" style="justify-content:space-between">
            <div class="section-title" style="margin:0">${UI.esc(auRangeLabel(f.dari, f.sampai))}${f.sesi ? ' - ' + UI.esc(f.sesi) : ''}${days.length > 1 ? ' (' + days.length + ' hari)' : ''}</div>
            <span class="muted" style="font-size:13px">${rows.length} baris${auDateRange(document.getElementById('au-dari').value, document.getElementById('au-sampai').value).length > AU_MAX_HARI ? ' — periode dipotong maksimal ' + AU_MAX_HARI + ' hari' : ''}</span>
          </div>
          <div class="table-wrap mt"><table class="clay-table">
            <thead><tr>${heads}</tr></thead>
            <tbody>${body || `<tr><td colspan="${showTanggal ? 7 : 6}"><div class="empty">Belum ada absensi ustadz.</div></td></tr>`}</tbody>
          </table></div>
        </div>`;

      document.querySelectorAll('[data-hapus-au]').forEach(btn => {
        btn.onclick = () => {
          const id = btn.dataset.hapusAu;
          UI.confirmDialog('Hapus Absensi Ustadz', 'Ustadz akan diminta absen ulang di sesi ini. Yakin dihapus?', async () => {
            const d = Store.get();
            d.absensiUstadz = d.absensiUstadz.filter(a => a.id !== id);
            if (await Store.save()) { UI.toast('Absensi ustadz dihapus', 'success'); render(); }
          });
        };
      });
    }

    function setRange(dari, sampai) {
      document.getElementById('au-dari').value = dari;
      document.getElementById('au-sampai').value = sampai || dari;
      render();
    }

    ['au-dari', 'au-sampai', 'au-sesi', 'au-status', 'au-halaqah'].forEach(id => {
      document.getElementById(id).onchange = render;
    });
    Shared.bindSearchInput(document.getElementById('au-cari'), render);
    document.querySelectorAll('[data-au-preset]').forEach(button => {
      button.onclick = () => {
        const today = Store.todayStr();
        const preset = button.dataset.auPreset;
        if (preset === 'today') return setRange(today, today);
        if (preset === 'month') return setRange(today.slice(0, 8) + '01', today);
        const days = parseInt(preset, 10) || 7;
        setRange(auAddDays(today, -(days - 1)), today);
      };
    });
    document.getElementById('au-export').onclick = () => {
      const f = normalize(filter());
      const rows = rowsOf(f);
      if (!rows.length) { UI.toast('Tidak ada data untuk diekspor', 'error'); return; }
      const bodyHtml = rows.map(r => `<tr>
        <td class="center">${UI.esc(r.tanggal)}</td>
        <td>${UI.esc(r.ustadz.nama)}</td>
        <td>${UI.esc((Store.findHalaqahForUstadz(r.ustadz) || {}).nama || r.ustadz.halaqah || '-')}</td>
        <td>${UI.esc(r.sesi)}</td>
        <td>${UI.esc(r.rec ? r.rec.status : 'Belum Absen')}</td>
        <td>${r.rec && r.rec.waktu ? UI.esc(UI.fmtDateTime(r.rec.waktu)) : '-'}</td>
        <td>${UI.esc(r.rec && r.rec.catatan ? r.rec.catatan : '-')}</td>
      </tr>`).join('');
      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>
  body{font-family:Calibri,Arial,sans-serif}
  table{border-collapse:collapse;font-size:11pt}
  th,td{border:1px solid #999;padding:5px 8px}
  th{background:#16a34a;color:#fff;text-align:center}
  .center{text-align:center}
  .title{font-size:16pt;font-weight:bold;text-align:center}
  .sub{font-size:11pt;color:#555;text-align:center;margin-bottom:2px}
</style></head>
<body>
  <div class="title">ABSENSI USTADZ</div>
  <div class="sub">${UI.esc(db.settings.namaLembaga)}</div>
  <div class="sub">Periode: ${UI.esc(auRangeLabel(f.dari, f.sampai))}${f.sesi ? ' - ' + UI.esc(f.sesi) : ''}</div>
  <table>
    <thead><tr><th class="center">Tanggal</th><th>Nama Ustadz</th><th>Halaqah</th><th>Sesi</th><th>Status</th><th>Jam</th><th>Catatan</th></tr></thead>
    <tbody>${bodyHtml}</tbody>
  </table>
</body></html>`;
      const suffix = isDaily(f) ? f.dari : f.dari + '_sd_' + f.sampai;
      Shared.downloadExcel('Absensi_Ustadz_' + suffix + (f.sesi ? '_' + f.sesi : ''), html);
      UI.toast('Berhasil export Excel', 'success');
    };
    render();
  }

  /* ---------------- Rekap Setoran Mingguan ---------------- */
  function rekapSetoran() {
    Shared.shell('admin', nav('admin_rekap_setoran'), '');
    Shared.setHeader('Rekap Setoran', 'Setoran dan kehadiran per santri dalam satu periode');
    const db = Store.get();
    const range = Shared.rekapSetoranRange();
    document.getElementById('view-content').innerHTML = `
      <div class="clay-card mb">
        <div class="row">
          <div style="flex:1;min-width:140px">${UI.field('Dari Tanggal', `<input type="date" class="clay-input" id="f-dari" value="${range.dari}">`)}</div>
          <div style="flex:1;min-width:140px">${UI.field('Sampai Tanggal', `<input type="date" class="clay-input" id="f-sampai" value="${range.sampai}">`)}</div>
          <div style="flex:1">${UI.field('Ustadz', `<select class="clay-select" id="f-ustadz"><option value="">Semua Ustadz</option>${UI.optionsFromList(db.ustadz.slice().sort((a, b) => a.nama.localeCompare(b.nama, 'id')).map(u => ({ v: u.id, l: u.nama })), 'v', 'l')}</select>`)}</div>
        </div>
        <div class="row mt">
          <button class="clay-btn ghost" data-rs-preset="today">Hari Ini</button>
          <button class="clay-btn ghost" data-rs-preset="week">7 Hari</button>
          <button class="clay-btn ghost" data-rs-preset="month">Bulan Ini</button>
          <button class="clay-btn ghost" data-rs-preset="lastmonth">Bulan Lalu</button>
        </div>
      </div>
      <div id="rekap-setoran-content"></div>`;
    const apply = () => {
      const filters = {
        dari: document.getElementById('f-dari').value,
        sampai: document.getElementById('f-sampai').value,
        ustadzId: document.getElementById('f-ustadz').value,
        allowJpgDownload: true
      };
      Shared.setRekapSetoranRange(filters.dari, filters.sampai);
      document.getElementById('rekap-setoran-content').innerHTML = Shared.renderRekapSetoranMingguan(filters);
      Shared.bindRekapSetoranJpgDownload(filters);
    };
    document.querySelectorAll('[data-rs-preset]').forEach(button => button.onclick = () => {
      const today = Store.todayStr();
      const preset = button.dataset.rsPreset;
      let dari = today, sampai = today;
      if (preset === 'week') dari = Store.tambahHari(today, -6);
      if (preset === 'month') dari = today.slice(0, 8) + '01';
      if (preset === 'lastmonth') {
        const awal = new Date(today.slice(0, 8) + '01T12:00:00');
        awal.setMonth(awal.getMonth() - 1);
        const akhir = new Date(awal.getFullYear(), awal.getMonth() + 1, 0);
        dari = `${awal.getFullYear()}-${String(awal.getMonth() + 1).padStart(2, '0')}-01`;
        sampai = `${akhir.getFullYear()}-${String(akhir.getMonth() + 1).padStart(2, '0')}-${String(akhir.getDate()).padStart(2, '0')}`;
      }
      document.getElementById('f-dari').value = dari;
      document.getElementById('f-sampai').value = sampai;
      apply();
    });
    ['f-dari', 'f-sampai', 'f-ustadz'].forEach(id => document.getElementById(id).onchange = apply);
    apply();
  }

  /* ---------------- Notifikasi ---------------- */
  function notif() {
    Shared.shell('admin', nav('admin_notif'), '');
    Shared.setHeader('Notifikasi', 'Pemberitahuan sistem');
    const session = Store.getSession();
    document.getElementById('view-content').innerHTML = Shared.renderNotifikasi(session.userId);
    const clearBtn = document.getElementById('clear-notif');
    if (clearBtn) clearBtn.onclick = () => {
      if (confirm('Hapus semua notifikasi?')) {
        Store.clearNotifs(session.userId);
        document.getElementById('view-content').innerHTML = '<div class="empty">Notifikasi dikosongkan.</div>';
        UI.toast('Notifikasi dihapus', 'success');
      }
    };
  }

  // Markup halaman Ta'lim dipakai oleh menu Ta'lim, bukan tab Settings.
  function talimPanelHtml() {
    return `
      <div class="clay-card mb">
        <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px">
          <div>
            <div class="section-title" style="margin:0">Mata Pelajaran & Kitab Ta’lim</div>
            <div class="muted" style="font-size:12px;margin-top:2px">Kelola mata pelajaran dan upload file PDF kitab pegangan santri & ustadz.</div>
          </div>
          <button class="clay-btn primary" id="btn-talim-modal-add" type="button">+ Tambah Mapel & Kitab</button>
        </div>
        <div class="table-wrap mt"><table class="clay-table">
          <thead><tr><th>Mapel</th><th>Kitab Pegangan</th><th>Pengajar</th><th>Aksi</th></tr></thead>
          <tbody id="talim-mapel-list"></tbody>
        </table></div>
      </div>
      <div class="clay-card mb">
        <div class="section-title">Penugasan Mengajar Ustadz</div>
        <div class="muted" style="font-size:12px;margin-bottom:10px">Pilih ustadz dan mapel, lalu centang semua kelas yang diajar untuk mapel tersebut. Satu ustadz boleh mengajar beberapa mapel, dan satu mapel boleh diajar untuk beberapa kelas sekaligus.</div>
        <div class="row">
          <div style="flex:1">${UI.field('Ustadz', `<select class="clay-select" id="talim-ustadz"></select>`)}</div>
          <div style="flex:1">${UI.field('Mapel', `<select class="clay-select" id="talim-mapel"></select>`)}</div>
        </div>
        <div class="field-label">Kelas yang Diajar</div>
        <div class="clay-card pad-sm" id="talim-kelas-checks" style="margin-top:6px"></div>
        <div class="row mt"><button class="clay-btn primary" id="btn-talim-save-assignment" type="button">Simpan Penugasan</button></div>
        <div class="table-wrap mt"><table class="clay-table">
          <thead><tr><th>Ustadz</th><th>Mapel</th><th>Kelas</th><th>Aksi</th></tr></thead>
          <tbody id="talim-assignment-list"></tbody>
        </table></div>
      </div>
      <div class="clay-card">
        <div class="section-title">Ta’lim Malam</div>
        <div class="muted" style="font-size:12px;margin-bottom:10px">Pilih ustadz pengampu dan isi materi default. Pilihan ini dipakai sebagai awal saat ustadz mengisi jurnal Ta’lim Malam.</div>
        <div class="field-label">Ustadz Pengampu</div>
        <div class="clay-card pad-sm" id="talim-malam-ustadz" style="margin-top:6px"></div>
        <div class="row mt">
          <div style="flex:1">${UI.field('Judul Kitab Default', `<input class="clay-input" id="talim-malam-kitab" placeholder="Contoh: Riyadhus Shalihin">`)}</div>
          <div style="flex:1">${UI.field('Bab Default', `<input class="clay-input" id="talim-malam-bab" placeholder="Contoh: Bab Keikhlasan">`)}</div>
        </div>
        <div class="row mt"><button class="clay-btn primary" id="btn-talim-malam-save" type="button">Simpan Ta’lim Malam</button></div>
      </div>`;
  }
  /* ---------------- Ta’lim ---------------- */
  // Konfigurasi Ta'lim (mapel, penugasan mengajar, Ta'lim Malam) berdiri
  // sebagai menu sendiri di sidebar, bukan tab di dalam Settings.
  function talim() {
    Shared.shell('admin', nav('admin_talim'), '');
    Shared.setHeader('Ta’lim', 'Mapel, penugasan mengajar, dan Ta’lim Malam');
    document.getElementById('view-content').innerHTML = talimPanelHtml();

  const talimClassesByTingkat = () => Store.tingkatOptions().map(tingkat => ({
    tingkat,
    items: Store.kelasOptions(tingkat).map(kelas => ({ key: Store.talimClassKey(tingkat, kelas), kelas }))
  })).filter(group => group.items.length);

  function openMapelKitabModal(mapelItem = null) {
    const isEdit = !!mapelItem;
    let removeExistingKitab = false;

    const body = `
      ${UI.field('Nama Mapel', `<input class="clay-input" id="m-mapel-nama" placeholder="Contoh: Fiqih" value="${UI.esc(mapelItem?.nama || '')}">`)}
      ${UI.field('Nama Kitab Pegangan', `<input class="clay-input" id="m-kitab-nama" placeholder="Contoh: Safinatun Najah" value="${UI.esc(mapelItem?.kitabNama || '')}">`)}
      <div style="margin-top:12px">
        <label class="field-label">File PDF Kitab</label>
        ${mapelItem?.kitabUrl ? `
          <div class="clay-card pad-sm" id="m-existing-kitab-box" style="margin-bottom:8px;background:var(--bg)">
            <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
              <div>
                <b>📖 ${UI.esc(mapelItem.kitabNama || 'Kitab PDF')}</b>
                <div class="muted" style="font-size:11px">${mapelItem.kitabSize ? (mapelItem.kitabSize / (1024 * 1024)).toFixed(1) + ' MB' : 'File tersimpan'}</div>
              </div>
              <div class="row" style="gap:6px">
                <button class="clay-btn sm ghost" type="button" id="btn-preview-existing-kitab">📖 Baca</button>
                <button class="clay-btn sm danger" type="button" id="btn-delete-existing-kitab">✕ Hapus File</button>
              </div>
            </div>
          </div>` : ''}
        <input class="clay-input" type="file" id="m-kitab-file" accept=".pdf">
        <div class="muted" style="font-size:11px;margin-top:4px">Upload file PDF (maksimal 50 MB) untuk diakses langsung oleh ustadz saat mengajar. ${isEdit && mapelItem?.kitabUrl ? 'Biarkan kosong bila tidak ingin mengganti file.' : ''}</div>
      </div>`;

    const m = UI.openModal({
      title: isEdit ? 'Edit Mapel & Kitab Ta’lim' : 'Tambah Mapel & Kitab Ta’lim',
      bodyHTML: body,
      actions: [
        { label: 'Batal', cls: 'ghost', onClick: (modal, close) => close() },
        { label: isEdit ? 'Simpan Perubahan' : 'Tambah Mapel', cls: 'primary', onClick: async (modal, close) => {
          const namaInput = modal.querySelector('#m-mapel-nama').value.trim();
          const kitabNamaInput = modal.querySelector('#m-kitab-nama').value.trim();
          const fileInput = modal.querySelector('#m-kitab-file');
          const file = fileInput?.files?.[0];

          if (!namaInput) { UI.toast('Nama mapel wajib diisi', 'error'); return; }

          const data = Store.get();
          data.settings.talimMapel = Array.isArray(data.settings.talimMapel) ? data.settings.talimMapel : [];

          const dup = data.settings.talimMapel.some(item => item.id !== mapelItem?.id && item.nama.toLowerCase() === namaInput.toLowerCase());
          if (dup) { UI.toast('Nama mapel sudah digunakan', 'error'); return; }

          let kitabUrl = removeExistingKitab ? '' : (mapelItem?.kitabUrl || '');
          let kitabSize = removeExistingKitab ? 0 : (mapelItem?.kitabSize || 0);

          if (file) {
            UI.toast('Mengunggah file kitab...', 'info');
            try {
              const uploadRes = await Store.uploadKitab(file);
              kitabUrl = uploadRes.url;
              kitabSize = uploadRes.fileSize || file.size;
            } catch (err) {
              UI.toast('Gagal mengunggah file: ' + err.message, 'error');
              return;
            }
          }

          const targetKitabNama = removeExistingKitab && !file && !kitabNamaInput
            ? ''
            : (kitabNamaInput || (file ? file.name.replace(/\.[^/.]+$/, '') : (removeExistingKitab ? '' : (mapelItem?.kitabNama || ''))));

          if (isEdit) {
            const idx = data.settings.talimMapel.findIndex(item => item.id === mapelItem.id);
            if (idx !== -1) {
              data.settings.talimMapel[idx].nama = namaInput;
              data.settings.talimMapel[idx].kitabNama = targetKitabNama;
              data.settings.talimMapel[idx].kitabUrl = kitabUrl;
              data.settings.talimMapel[idx].kitabSize = kitabSize;
            }
            // Update nama mapel di riwayat jurnal jika nama berubah
            if (Array.isArray(data.jurnalTalim)) {
              data.jurnalTalim.forEach(j => {
                if (j.mapelId === mapelItem.id) j.mapel = namaInput;
              });
            }
          } else {
            data.settings.talimMapel.push({
              id: Store.uid('mapel'),
              nama: namaInput,
              kitabNama: targetKitabNama,
              kitabUrl,
              kitabSize
            });
          }

          if (await Store.save()) {
            UI.toast(isEdit ? 'Mapel & Kitab diperbarui' : 'Mapel & Kitab ditambahkan', 'success');
            close();
            renderTalimSettings({ mapelId: mapelItem?.id });
          }
        }}
      ]
    });

    if (mapelItem?.kitabUrl) {
      const prevBtn = m.modal.querySelector('#btn-preview-existing-kitab');
      if (prevBtn) {
        prevBtn.onclick = () => {
          UI.openKitabViewer({
            title: mapelItem.kitabNama || mapelItem.nama,
            sub: 'Mapel: ' + mapelItem.nama,
            url: mapelItem.kitabUrl
          });
        };
      }
      const delKitabBtn = m.modal.querySelector('#btn-delete-existing-kitab');
      if (delKitabBtn) {
        delKitabBtn.onclick = () => {
          removeExistingKitab = true;
          const box = m.modal.querySelector('#m-existing-kitab-box');
          if (box) box.style.display = 'none';
          UI.toast('File kitab akan dihapus saat Simpan Perubahan diklik', 'info');
        };
      }
    }
  }

  const renderTalimSettings = (preferred = {}) => {
    const currentDb = Store.get();
    const mapel = Store.talimMapel();
    const ustadz = currentDb.ustadz.slice().sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
    const ustadzSelect = document.getElementById('talim-ustadz');
    const mapelSelect = document.getElementById('talim-mapel');
    const selectedUstadzId = preferred.ustadzId ?? ustadzSelect?.value ?? ustadz[0]?.id ?? '';
    const selectedMapelId = preferred.mapelId ?? mapelSelect?.value ?? mapel[0]?.id ?? '';
    ustadzSelect.innerHTML = `<option value="">Pilih ustadz</option>${UI.optionsFromList(ustadz.map(u => ({ v: u.id, l: u.nama })), 'v', 'l', selectedUstadzId)}`;
    mapelSelect.innerHTML = `<option value="">Pilih mapel</option>${UI.optionsFromList(mapel.map(item => ({ v: item.id, l: item.nama })), 'v', 'l', selectedMapelId)}`;

    const selectedUstadz = currentDb.ustadz.find(u => u.id === ustadzSelect.value);
    const assignment = Store.talimAssignmentsForUstadz(selectedUstadz).find(item => item.mapel.id === mapelSelect.value);
    const assignedKeys = new Set(assignment?.kelasKeys || []);
    const groups = talimClassesByTingkat();
    document.getElementById('talim-kelas-checks').innerHTML = groups.length
      ? groups.map(group => `<div style="margin-bottom:8px">
          <div class="muted" style="font-size:12px;font-weight:600;margin-bottom:2px">${UI.esc(group.tingkat)}</div>
          ${group.items.map(item => `<label style="display:inline-flex;align-items:center;gap:6px;margin:2px 14px 2px 0;cursor:pointer"><input type="checkbox" data-talim-kelas value="${UI.esc(item.key)}" ${assignedKeys.has(item.key) ? 'checked' : ''}> Kelas ${UI.esc(item.kelas)}</label>`).join('')}
        </div>`).join('')
      : '<span class="muted">Belum ada kelas yang dapat dipilih.</span>';

    const mapelRows = mapel.map(item => {
      const pengajar = currentDb.ustadz.filter(u => Store.talimAssignmentsForUstadz(u).some(a => a.mapel.id === item.id)).length;
      const sizeBadge = item.kitabSize ? ` <span class="badge blue" style="font-size:11px">${(item.kitabSize / (1024 * 1024)).toFixed(1)} MB</span>` : '';
      const kitabDisplay = item.kitabUrl ? `
        <div class="row center" style="gap:6px;flex-wrap:wrap">
          <b>📖 ${UI.esc(item.kitabNama || 'Kitab PDF')}</b>${sizeBadge}
          <button class="clay-btn sm ghost" type="button" data-read-kitab="${UI.esc(item.id)}">📖 Baca</button>
        </div>` : `<span class="muted" style="font-size:12px">Belum ada file kitab</span>`;
      return `<tr>
        <td><b>${UI.esc(item.nama)}</b></td>
        <td>${kitabDisplay}</td>
        <td>${pengajar} ustadz</td>
        <td>
          <div class="row" style="gap:6px">
            <button class="clay-btn sm ghost" type="button" data-edit-talim-mapel="${UI.esc(item.id)}">✏ Edit</button>
            <button class="clay-btn sm danger" type="button" data-del-talim-mapel="${UI.esc(item.id)}" style="background:#EF4444;color:#fff;font-weight:600">Hapus</button>
          </div>
        </td>
      </tr>`;
    }).join('');
    document.getElementById('talim-mapel-list').innerHTML = mapelRows || '<tr><td colspan="4"><div class="empty">Belum ada mapel.</div></td></tr>';

    const assignmentRows = ustadz.flatMap(u => Store.talimAssignmentsForUstadz(u).map(item => `<tr>
      <td>${UI.esc(u.nama)}</td><td>${UI.esc(item.mapel.nama)}</td><td>${UI.esc(item.kelasKeys.map(Store.talimClassLabel).join(', ') || '-')}</td>
      <td><button class="clay-btn sm danger" type="button" data-remove-talim-ustadz="${UI.esc(u.id)}" data-remove-talim-mapel="${UI.esc(item.mapel.id)}">Hapus</button></td>
    </tr>`)).join('');
    document.getElementById('talim-assignment-list').innerHTML = assignmentRows || '<tr><td colspan="4"><div class="empty">Belum ada penugasan Ta’lim.</div></td></tr>';

    ustadzSelect.onchange = () => renderTalimSettings({ ustadzId: ustadzSelect.value, mapelId: mapelSelect.value });
    mapelSelect.onchange = () => renderTalimSettings({ ustadzId: ustadzSelect.value, mapelId: mapelSelect.value });

    // Event binding untuk baris Mapel (Edit, Baca, Hapus)
    document.querySelectorAll('[data-read-kitab]').forEach(btn => {
      btn.onclick = () => {
        const item = Store.findTalimMapel(btn.dataset.readKitab);
        if (item && item.kitabUrl) {
          UI.openKitabViewer({
            title: item.kitabNama || item.nama,
            sub: 'Mapel: ' + item.nama,
            url: item.kitabUrl
          });
        }
      };
    });

    document.querySelectorAll('[data-edit-talim-mapel]').forEach(btn => {
      btn.onclick = () => {
        const item = Store.findTalimMapel(btn.dataset.editTalimMapel);
        if (item) openMapelKitabModal(item);
      };
    });

    document.querySelectorAll('[data-del-talim-mapel]').forEach(button => button.onclick = () => {
      const mapelId = button.dataset.delTalimMapel;
      const mapelName = Store.findTalimMapel(mapelId)?.nama || 'mapel ini';
      UI.confirmDialog('Hapus Mapel Ta’lim', `Hapus ${mapelName}? Penugasan mapel ini pada semua ustadz juga akan dihapus.`, () => {
        const data = Store.get();
        data.settings.talimMapel = (data.settings.talimMapel || []).filter(item => item.id !== mapelId);
        data.ustadz.forEach(u => { u.talimMengajar = (u.talimMengajar || []).filter(item => item.mapelId !== mapelId); });
        Store.save();
        renderTalimSettings({ ustadzId: ustadzSelect.value });
        UI.toast('Mapel dan penugasannya dihapus', 'success');
      });
    });

    document.querySelectorAll('[data-remove-talim-ustadz]').forEach(button => button.onclick = () => {
      const ustadzId = button.dataset.removeTalimUstadz;
      const mapelId = button.dataset.removeTalimMapel;
      const teacher = Store.findUstadz(ustadzId);
      const mapelName = Store.findTalimMapel(mapelId)?.nama || 'mapel ini';
      UI.confirmDialog('Hapus Penugasan', `Hapus penugasan ${mapelName} dari ${teacher?.nama || 'ustadz ini'}?`, () => {
        if (teacher) teacher.talimMengajar = (teacher.talimMengajar || []).filter(item => item.mapelId !== mapelId);
        Store.save();
        renderTalimSettings({ ustadzId, mapelId });
        UI.toast('Penugasan dihapus', 'success');
      });
    });
  };

  const btnModalAdd = document.getElementById('btn-talim-modal-add');
  if (btnModalAdd) btnModalAdd.onclick = () => openMapelKitabModal();

  document.getElementById('btn-talim-save-assignment').onclick = () => {
    const ustadzId = document.getElementById('talim-ustadz').value;
    const mapelId = document.getElementById('talim-mapel').value;
    const kelasKeys = [...document.querySelectorAll('[data-talim-kelas]:checked')].map(input => input.value);
    const teacher = Store.findUstadz(ustadzId);
    if (!teacher || !mapelId) { UI.toast('Pilih ustadz dan mapel', 'error'); return; }
    if (!kelasKeys.length) { UI.toast('Pilih minimal satu kelas', 'error'); return; }
    const assignments = Array.isArray(teacher.talimMengajar) ? teacher.talimMengajar.slice() : [];
    const existing = assignments.find(item => item.mapelId === mapelId);
    if (existing) existing.kelasKeys = kelasKeys;
    else assignments.push({ mapelId, kelasKeys });
    teacher.talimMengajar = assignments;
    Store.save();
    renderTalimSettings({ ustadzId, mapelId });
    UI.toast('Penugasan Ta’lim tersimpan', 'success');
  };
  const renderTalimMalamSettings = (selectedIds) => {
    const malam = Store.talimMalamSettings();
    const ids = new Set(selectedIds || malam.ustadzIds);
    const teachers = Store.get().ustadz.slice().sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
    document.getElementById('talim-malam-ustadz').innerHTML = teachers.length
      ? teachers.map(u => `<label style="display:inline-flex;align-items:center;gap:6px;margin:4px 14px 4px 0;cursor:pointer"><input type="checkbox" data-talim-malam-ustadz value="${UI.esc(u.id)}" ${ids.has(u.id) ? 'checked' : ''}> ${UI.esc(u.nama)}</label>`).join('')
      : '<span class="muted">Belum ada ustadz.</span>';
    document.getElementById('talim-malam-kitab').value = malam.judulKitab;
    document.getElementById('talim-malam-bab').value = malam.bab;
  };
  document.getElementById('btn-talim-malam-save').onclick = () => {
    const data = Store.get();
    const ustadzIds = [...document.querySelectorAll('[data-talim-malam-ustadz]:checked')].map(input => input.value);
    const judulKitab = document.getElementById('talim-malam-kitab').value.trim();
    const bab = document.getElementById('talim-malam-bab').value.trim();
    if (!ustadzIds.length) { UI.toast('Pilih minimal satu ustadz pengampu', 'error'); return; }
    data.settings.talimMalam = { ustadzIds, judulKitab, bab };
    Store.save();
    renderTalimMalamSettings(ustadzIds);
    UI.toast('Pengaturan Ta’lim Malam tersimpan', 'success');
  };
  renderTalimMalamSettings();
  renderTalimSettings();
  document.getElementById('talim-mapel-nama').onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('btn-talim-add-mapel').click(); }
  };
  }
  /* ---------------- Settings ---------------- */
  function settings() {
    Shared.shell('admin', nav('admin_settings'), '');
    Shared.setHeader('Setting Umum', 'Konfigurasi lembaga');
    const db = Store.get(); const s = db.settings;
    const _sesi = Store.getSession() || {};
    const _akun = db.users.find(u => u.id === _sesi.userId) || { username: '-' };
    const waTrigger = (key) => {
      const raw = (s.waAutoTrigger && s.waAutoTrigger[key]);
      if (!s.waAutoTrigger || typeof s.waAutoTrigger !== 'object' || !Object.keys(s.waAutoTrigger).length) {
        return key === 'setoran';
      }
      return raw === true || raw === 1 || raw === '1' || raw === 'true';
    };
    document.getElementById('view-content').innerHTML = `
      <div class="pill-tabs" id="set-tab-bar">
        <button class="pill active" data-set-tab="lembaga">Lembaga</button>
        <button class="pill" data-set-tab="kelas">Kelas &amp; Tingkat</button>
        <button class="pill" data-set-tab="notifikasi">Notifikasi</button>
        <button class="pill" data-set-tab="wa">WhatsApp</button>
        <button class="pill" data-set-tab="akun">Akun &amp; Data</button>
      </div>
      <div data-set-panel="lembaga">
      <div class="clay-card mb">
        <div class="section-title">Informasi Lembaga</div>
        <div class="row">
          <div style="flex:0 0 120px;text-align:center">
            <div id="s-logo-preview" style="width:100px;height:100px;border-radius:14px;background:var(--bg);display:flex;align-items:center;justify-content:center;margin:0 auto 8px;overflow:hidden">
              ${UI.safeUrl(s.logo) ? `<img src="${UI.esc(UI.safeUrl(s.logo))}" style="max-width:100%;max-height:100%">` : '<span style="font-size:32px;color:var(--text-soft)">+</span>'}
            </div>
            <label class="clay-btn sm ghost" style="font-size:12px;cursor:pointer">Upload Logo
              <input type="file" id="s-logo-upload" accept="image/*" style="display:none">
            </label>
          </div>
          <div style="flex:1">
            ${UI.field('Nama Lembaga', `<input class="clay-input" id="s-nama" value="${UI.esc(s.namaLembaga)}">`)}
            ${UI.field('Alamat', `<input class="clay-input" id="s-alamat" value="${UI.esc(s.alamat)}">`)}
          </div>
        </div>
        <div class="row">
          <div style="flex:1">${UI.field('Tahun Ajaran', `<input class="clay-input" id="s-thn" value="${UI.esc(s.tahunAjaran)}">`)}</div>
          <div style="flex:1">${UI.field('Semester', `<select class="clay-select" id="s-sem"><option ${s.semester === 'Ganjil' ? 'selected' : ''}>Ganjil</option><option ${s.semester === 'Genap' ? 'selected' : ''}>Genap</option></select>`)}</div>
        </div>
        ${UI.field('Standar Penilaian', `<input class="clay-input" id="s-standar" value="${UI.esc(s.standarPenilaian)}">`)}
        ${UI.field('Jam Belajar', `<input class="clay-input" id="s-jam" value="${UI.esc(s.jamBelajar)}">`)}
        ${UI.field('Format Password Default Wali', `<input class="clay-input" id="s-pass" value="${UI.esc(s.defaultPasswordFormat)}">`)}
        <div class="row">
          <label class="field-label" style="flex:1">Setoran Ziyadah</label>
          <label style="flex:1;display:flex;align-items:center;gap:8px;margin-top:12px">
            <button class="clay-toggle ${s.setoranMulti ? 'on' : ''}" id="s-setoran-multi"></button>
            <span id="s-setoran-label" style="font-size:13px">${s.setoranMulti ? 'Berkali-kali per hari' : 'Sekali sehari'}</span>
          </label>
        </div>
      </div>
      </div>
      <div data-set-panel="kelas" style="display:none">
      <div class="clay-card mb">
        <div class="section-title">Tingkat</div>
        <div class="muted" style="font-size:12px;margin-bottom:10px">Tingkat pendidikan yang dipakai, misalnya TPQ, SD, SMP. Setiap tingkat punya daftar kelas sendiri.</div>
        <div class="row">
          <input class="clay-input" id="kt-tingkat-nama" placeholder="Contoh: SMP" autocomplete="off">
          <button class="clay-btn secondary" id="kt-add-tingkat" type="button">+ Tambah Tingkat</button>
        </div>
        <div class="table-wrap mt"><table class="clay-table">
          <thead><tr><th>Tingkat</th><th>Jumlah Kelas</th><th>Aksi</th></tr></thead>
          <tbody id="kt-tingkat-list"></tbody>
        </table></div>
      </div>
      <div class="clay-card">
        <div class="section-title">Kelas per Tingkat</div>
        <div class="muted" style="font-size:12px;margin-bottom:10px">Nama kelas memakai format nomor + rombongan, misalnya <b>7A</b> dan <b>7B</b> untuk Kelas 7A dan 7B.</div>
        <div class="row">
          <div style="flex:1">${UI.field('Tingkat', `<select class="clay-select" id="kt-tingkat"></select>`)}</div>
          <div style="flex:1">${UI.field('Kelas', `<input class="clay-input" id="kt-kelas-nama" placeholder="Contoh: 7A" autocomplete="off">`)}</div>
          <div style="flex:0 0 auto;display:flex;align-items:flex-end;padding-bottom:2px">
            <button class="clay-btn primary" id="kt-add-kelas" type="button">+ Tambah Kelas</button>
          </div>
        </div>
        <div class="table-wrap mt"><table class="clay-table">
          <thead><tr><th>Kelas</th><th>Santri</th><th>Ta’lim</th><th>Aksi</th></tr></thead>
          <tbody id="kt-kelas-list"></tbody>
        </table></div>
      </div>
      </div>
      <div data-set-panel="notifikasi">
      <div class="clay-card mb">
        <div class="section-title"> Pengaturan Notifikasi</div>
        <div class="row">
          <label style="flex:1;display:flex;align-items:center;gap:8px;margin-top:12px">
            <button class="clay-toggle ${s.notifActive ? 'on' : ''}" id="s-notif-active"></button>
            <span id="s-notif-active-label" style="font-size:13px">${s.notifActive ? 'Notifikasi Aktif' : 'Notifikasi Nonaktif'}</span>
          </label>
        </div>
        <div class="row" style="margin-top:10px">
          <label style="flex:1;display:flex;align-items:center;gap:8px">
            <button class="clay-toggle ${s.notifWali ? 'on' : ''}" id="s-notif-wali"></button>
            <span id="s-notif-wali-label" style="font-size:13px">${s.notifWali ? 'Kirim ke Wali: Ya' : 'Kirim ke Wali: Tidak'}</span>
          </label>
          <label style="flex:1;display:flex;align-items:center;gap:8px">
            <button class="clay-toggle ${s.notifUstadz ? 'on' : ''}" id="s-notif-ustadz"></button>
            <span id="s-notif-ustadz-label" style="font-size:13px">${s.notifUstadz ? 'Kirim ke Ustadz: Ya' : 'Kirim ke Ustadz: Tidak'}</span>
          </label>
        </div>
        <div class="row" style="margin-top:10px">
          <div style="flex:1">${UI.field('Maks Notif per Hari', `<input class="clay-input" id="s-notif-max" type="number" min="1" max="20" value="${s.notifMaxPerDay || 3}">`)}</div>
        </div>
        <div class="row" style="margin-top:10px;align-items:flex-end">
          <label style="flex:1;display:flex;align-items:center;gap:8px;margin-bottom:12px">
            <button class="clay-toggle ${s.notifAbsensiWali !== false ? 'on' : ''}" id="s-notif-absensi-wali"></button>
            <span id="s-notif-absensi-wali-label" style="font-size:13px">${s.notifAbsensiWali !== false ? 'Rekap absensi ke Wali: Aktif' : 'Rekap absensi ke Wali: Nonaktif'}</span>
          </label>
          <div style="flex:1">${UI.field('Periode Rekap Absensi Wali', `<select class="clay-select" id="s-notif-absensi-periode">
            <option value="harian" ${(s.notifAbsensiPeriode || 'harian') === 'harian' ? 'selected' : ''}>Harian</option>
            <option value="halaqah" ${s.notifAbsensiPeriode === 'halaqah' ? 'selected' : ''}>Tiap Halaqah</option>
            <option value="mingguan" ${s.notifAbsensiPeriode === 'mingguan' ? 'selected' : ''}>Mingguan</option>
            <option value="bulanan" ${s.notifAbsensiPeriode === 'bulanan' ? 'selected' : ''}>Bulanan</option>
          </select>`)}</div>
        </div>
        <div class="muted" style="font-size:12px">Satu rekap diperbarui saat absensi dikoreksi, sehingga wali tidak menerima notifikasi ganda.</div>
      </div>
      </div>
      <div data-set-panel="wa">
      <div class="clay-card mb">
        <div class="section-title"> Pemicu WA Otomatis</div>
        <div class="muted" style="font-size:12px;margin-bottom:10px">
          Pemicu "Setoran" dikirim langsung saat ustadz menyimpan setoran (jika aktif).
          Pemicu jadwal (Harian/Mingguan/Bulanan) memakai periode yang sudah selesai (kemarin / minggu lalu / bulan lalu) dan dijalankan di server, sehingga tidak perlu ada yang membuka aplikasi.
          Setelan ini cukup untuk aplikasi biasa. Agar terkirim tepat waktu tanpa interaksi pengguna, jalankan cron di server:
          <code>curl -H "Authorization: Bearer &lt;TOKEN_ADMIN&gt;" "https://domain/api/index.php?action=wa_auto_reminder"</code>
          <br>Rekap untuk periode yang sama hanya terkirim sekali, jadi cron dan aplikasi yang dibuka manual tidak mengirim dobel. Bila server sempat mati, periode yang terlewat tetap dikirim saat server hidup kembali.
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <label style="display:flex;align-items:center;gap:8px">
            <button class="clay-toggle ${waTrigger('setoran') ? 'on' : ''}" id="s-wa-setoran"></button>
            <span id="s-wa-setoran-label" style="font-size:13px">${waTrigger('setoran') ? 'Saat Setoran: Aktif' : 'Saat Setoran: Nonaktif'}</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px">
            <button class="clay-toggle ${waTrigger('harian') ? 'on' : ''}" id="s-wa-harian"></button>
            <span id="s-wa-harian-label" style="font-size:13px">${waTrigger('harian') ? 'Rekap Harian: Aktif' : 'Rekap Harian: Nonaktif'}</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px">
            <button class="clay-toggle ${waTrigger('mingguan') ? 'on' : ''}" id="s-wa-mingguan"></button>
            <span id="s-wa-mingguan-label" style="font-size:13px">${waTrigger('mingguan') ? 'Rekap Mingguan (Sabtu): Aktif' : 'Rekap Mingguan (Sabtu): Nonaktif'}</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px">
            <button class="clay-toggle ${waTrigger('bulanan') ? 'on' : ''}" id="s-wa-bulanan"></button>
            <span id="s-wa-bulanan-label" style="font-size:13px">${waTrigger('bulanan') ? 'Rekap Bulanan (Tgl 1): Aktif' : 'Rekap Bulanan (Tgl 1): Nonaktif'}</span>
          </label>
        </div>
        <div style="max-width:160px;margin-top:10px">${UI.field('Jam Kirim (HH:MM)', `<input class="clay-input" id="s-wa-jam" type="time" value="${UI.esc(s.waAutoJam || '07:00')}">`)}</div>
      </div>
      <div class="clay-card mb">
        <div class="section-title"> Koneksi WA Bridge</div>
        <div class="muted" style="font-size:12px;margin-bottom:10px">
          Hubungkan ke WA Bridge (Node) agar laporan terkirim ke WhatsApp wali.
          <br>Bridge: <code>npm install &amp;&amp; npm start</code> di folder <code>wa-bridge</code> (isi <code>WA_KEY</code> di <code>wa-bridge/.env</code>), lalu tekan <b>Cek Status</b> dan scan QR.
          <br>Panggilan ke bridge diteruskan server, jadi <code>X-WA-Key</code> tidak pernah dibuka ke browser.
        </div>
        <div class="row">
          <div style="flex:1">${UI.field('URL Bridge (contoh: http://127.0.0.1:3210 atau https://wa.example.com)', `<input class="clay-input" id="s-wa-url" value="${UI.esc(s.waBridgeUrl)}" placeholder="http://127.0.0.1:3210">`)}</div>
          <div style="flex:1">${UI.field('Key Bridge (X-WA-Key)', `<input class="clay-input" id="s-wa-key" value="${UI.esc(s.waBridgeKey)}" placeholder="nilai acak dari WA_KEY di server bridge">`)}</div>
        </div>
        <div class="row" style="margin-top:10px">
          <label style="flex:1;display:flex;align-items:center;gap:8px;margin-top:12px">
            <button class="clay-toggle ${s.waAuto ? 'on' : ''}" id="s-wa-auto"></button>
            <span id="s-wa-auto-label" style="font-size:13px">${s.waAuto ? 'WhatsApp Aktif: Aktif' : 'WhatsApp Aktif: Nonaktif'}</span>
          </label>
        </div>
        <div class="row mt" style="gap:8px;flex-wrap:wrap;align-items:center">
          <button class="clay-btn ghost" id="btn-wa-status">Cek Status Bridge</button>
          <button class="clay-btn ghost" id="btn-wa-test">Tes Koneksi</button>
          <button class="clay-btn ghost" id="btn-wa-test-recap" style="border:1.5px solid #2563eb;color:#1d4ed8;font-weight:600;background:#eff6ff">Tes Kirim Rekap (Pilih Santri)</button>
          <button class="clay-btn primary" id="btn-wa-recap">Kirim Rekap Sekarang (Semua)</button>
        </div>
        <div id="wa-status" class="mt" style="font-size:13px"></div>

        <!-- Kartu Permanen: Progres & Pembatalan Antrian Pengiriman -->
        <div class="clay-card pad-sm mt" id="wa-queue-card" style="background:#f8fafc;border:1px solid var(--border)">
          <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div>
              <div style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:8px">
                <span>Status Antrian Pengiriman:</span>
                <span id="wa-queue-badge" class="badge ok" style="font-size:11px">Antrian Kosong (0 Pesan)</span>
              </div>
              <div id="wa-queue-desc" class="muted" style="font-size:12px;margin-top:3px">
                Tidak ada pesan dalam antrian pengiriman.
              </div>
            </div>
            <div class="row" style="gap:8px;align-items:center">
              <button class="clay-btn sm ghost" id="btn-wa-refresh-queue" type="button">Perbarui Antrian</button>
              <button class="clay-btn sm danger" id="btn-wa-stop" type="button" style="background:#EF4444;color:#fff;font-weight:600">
                Batalkan Pengiriman
              </button>
            </div>
          </div>
          <!-- Bar Progres Pengiriman -->
          <div id="wa-queue-progress-bar-wrap" style="display:none;margin-top:10px">
            <div style="background:#e2e8f0;border-radius:999px;height:9px;overflow:hidden;width:100%">
              <div id="wa-queue-progress-bar" style="background:#2563eb;height:100%;width:0%;transition:width .3s ease"></div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;margin-top:5px" class="muted">
              <span id="wa-queue-progress-status">Mengirim pesan dengan jeda anti-banned...</span>
              <span id="wa-queue-progress-count" style="font-weight:600">0 / 0</span>
            </div>
          </div>
        </div>
      </div>
      <div class="clay-card mb">
        <div class="row" style="align-items:center">
          <div class="section-title" style="margin:0">Log WhatsApp</div>
          <button class="clay-btn ghost" id="btn-wa-log-refresh" style="margin-left:auto">Muat Ulang</button>
        </div>
        <div class="muted" style="font-size:12px;margin:6px 0 10px">
          Riwayat pengiriman WA (terakhir 100, auto-refresh 5 detik). Status: <b style="color:var(--success)">queued</b> = masuk antrian bridge,
          <b style="color:var(--warn)">skipped</b> = dilewati (lihat detail), <b style="color:var(--danger)">error</b> = gagal (lihat detail).
        </div>
        <div id="wa-log" style="font-size:12px;max-height:280px;overflow:auto"></div>
      </div>
      </div>
      <div data-set-panel="akun" style="display:none">
      <div class="clay-card mb">
        <div class="section-title">Akun Admin</div>
        <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Username</span><b>${UI.esc(_akun.username)}</b></div>
        <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Peran</span><b>Admin</b></div>
        <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Password</span><b>••••••••</b></div>
        <div class="row mt">
          <button class="clay-btn secondary" id="btn-ganti-pass-admin">Ganti Password Admin</button>
        </div>
        <div class="muted" style="font-size:12px;margin-top:8px">Tombol yang sama juga ada di kotak user pada sidebar.</div>
      </div>
      <div class="clay-card">
        <div class="row" style="align-items:center">
          <div class="section-title" style="margin:0">Data</div>
          <div class="row" style="margin-left:auto">
            <button class="clay-btn ghost" id="btn-backup"> Backup Database</button>
            <button class="clay-btn danger" id="btn-reset">Reset Data Demo</button>
          </div>
        </div>
      </div>
      </div>
      <div class="clay-card" style="margin-top:16px">
        <div class="row" style="align-items:center">
          <span class="muted" style="font-size:13px">Perubahan pada tab mana pun ikut disimpan saat tombol ditekan. Tab <b>Kelas &amp; Tingkat</b> langsung tersimpan sendiri.</span>
          <button class="clay-btn primary" id="btn-save" style="margin-left:auto">Simpan Pengaturan</button>
        </div>
      </div>`;
    /* Tab: Kelas & Tingkat ------------------------------------------------
       Tingkat dan kelas menyimpan datanya sendiri (bukan lewat tombol Simpan
       di bawah), karena kelas juga dipakai form Santri dan penugasan Ta'lim:
       perubahan harus langsung berlaku tanpa menunggu tab lain disimpan. */
    let ktTingkatAktif = Store.tingkatOptions()[0] || '';
    function renderKelasTingkat() {
      const tingkatList = Store.tingkatOptions();
      if (!tingkatList.includes(ktTingkatAktif)) ktTingkatAktif = tingkatList[0] || '';

      document.getElementById('kt-tingkat-list').innerHTML = tingkatList.length
        ? tingkatList.map(t => `<tr>
            <td><b>${UI.esc(t)}</b></td>
            <td>${Store.kelasOptions(t).length} kelas</td>
            <td><button class="clay-btn sm danger" type="button" data-kt-del-tingkat="${UI.esc(t)}">Hapus</button></td>
          </tr>`).join('')
        : '<tr><td colspan="3"><div class="empty">Belum ada tingkat.</div></td></tr>';

      const select = document.getElementById('kt-tingkat');
      select.innerHTML = UI.optionsFromList(tingkatList.map(t => ({ v: t, l: t })), 'v', 'l', ktTingkatAktif);

      const kelasList = ktTingkatAktif ? Store.kelasOptions(ktTingkatAktif) : [];
      document.getElementById('kt-kelas-list').innerHTML = kelasList.length
        ? kelasList.map(k => {
            const santris = Store.jumlahSantriKelas(ktTingkatAktif, k);
            const talim = Store.kelasDipakaiDiTalim(ktTingkatAktif, k);
            return `<tr>
              <td><b>Kelas ${UI.esc(k)}</b></td>
              <td>${santris} santri</td>
              <td>${talim ? '<span class="badge green">Dipakai</span>' : '<span class="muted">-</span>'}</td>
              <td><button class="clay-btn sm danger" type="button" data-kt-del-kelas="${UI.esc(k)}">Hapus</button></td>
            </tr>`;
          }).join('')
        : `<tr><td colspan="4"><div class="empty">Belum ada kelas di tingkat ini.</div></td></tr>`;

      document.getElementById('kt-add-kelas').disabled = !ktTingkatAktif;
      document.querySelectorAll('[data-kt-del-tingkat]').forEach(button => button.onclick = () => {
        const target = button.dataset.ktDelTingkat;
        // Hapus tingkat ikut memeriksa dampaknya, karena kelasnya masih bisa
        // tercatat pada penugasan Ta'lim atau jurnal lama.
        const kelas = Store.kelasOptions(target);
        const terpakai = kelas.filter(k => Store.kelasDipakaiDiTalim(target, k));
        const jumlahSantri = kelas.map(k => Store.jumlahSantriKelas(target, k)).reduce((a, b) => a + b, 0);
        const catatan = [];
        if (terpakai.length) catatan.push(`${terpakai.length} kelas masih dipakai penugasan Ta’lim`);
        if (jumlahSantri) catatan.push(`${jumlahSantri} santri`);
        UI.confirmDialog('Hapus Tingkat', `Hapus tingkat ${target} beserta ${kelas.length} kelasnya?`
          + (catatan.length ? ' Catatan: ' + catatan.join(', ') + '. Data riwayat tidak dihapus.' : ''), () => {
            Store.hapusTingkat(target);
            renderKelasTingkat();
            UI.toast('Tingkat dihapus', 'success');
          });
      });
      document.querySelectorAll('[data-kt-del-kelas]').forEach(button => button.onclick = () => {
        const target = button.dataset.ktDelKelas;
        const santris = Store.jumlahSantriKelas(ktTingkatAktif, target);
        const talim = Store.kelasDipakaiDiTalim(ktTingkatAktif, target);
        const catatan = [];
        if (santris) catatan.push(`${santris} santri`);
        if (talim) catatan.push('masih dipakai penugasan Ta’lim');
        UI.confirmDialog('Hapus Kelas', `Hapus Kelas ${target} dari tingkat ${ktTingkatAktif}?`
          + (catatan.length ? ' Catatan: ' + catatan.join(', ') + '. Data riwayat tidak dihapus.' : ''), () => {
            Store.hapusKelas(ktTingkatAktif, target);
            renderKelasTingkat();
            UI.toast('Kelas dihapus', 'success');
          });
      });
    }
    document.getElementById('kt-add-tingkat').onclick = () => {
      const input = document.getElementById('kt-tingkat-nama');
      const hasil = Store.simpanTingkat(input.value);
      if (!hasil.ok) { UI.toast(hasil.msg, 'error'); return; }
      ktTingkatAktif = input.value.trim();
      input.value = '';
      renderKelasTingkat();
      UI.toast('Tingkat ditambahkan', 'success');
    };
    document.getElementById('kt-add-kelas').onclick = () => {
      const input = document.getElementById('kt-kelas-nama');
      const hasil = Store.simpanKelas(ktTingkatAktif, input.value);
      if (!hasil.ok) { UI.toast(hasil.msg, 'error'); return; }
      input.value = '';
      renderKelasTingkat();
      UI.toast('Kelas ditambahkan', 'success');
    };
    document.getElementById('kt-tingkat').onchange = event => {
      ktTingkatAktif = event.target.value;
      renderKelasTingkat();
    };
    document.getElementById('kt-tingkat-nama').onkeydown = event => {
      if (event.key === 'Enter') { event.preventDefault(); document.getElementById('kt-add-tingkat').click(); }
    };
    document.getElementById('kt-kelas-nama').onkeydown = event => {
      if (event.key === 'Enter') { event.preventDefault(); document.getElementById('kt-add-kelas').click(); }
    };
    renderKelasTingkat();

    document.getElementById('s-wa-auto').onclick = function() {
      this.classList.toggle('on');
      const on = this.classList.contains('on');
      const label = document.getElementById('s-wa-auto-label');
      if (label) label.textContent = on ? 'WhatsApp Aktif: Aktif' : 'WhatsApp Aktif: Nonaktif';
    };

    ['s-wa-setoran', 's-wa-harian', 's-wa-mingguan', 's-wa-bulanan'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.onclick = function() {
        this.classList.toggle('on');
        const on = this.classList.contains('on');
        const label = document.getElementById(id + '-label');
        const key = id.replace('s-wa-', '');
        if (label) {
          if (key === 'setoran') label.textContent = on ? 'Saat Setoran: Aktif' : 'Saat Setoran: Nonaktif';
          else if (key === 'harian') label.textContent = on ? 'Rekap Harian: Aktif' : 'Rekap Harian: Nonaktif';
          else if (key === 'mingguan') label.textContent = on ? 'Rekap Mingguan (Sabtu): Aktif' : 'Rekap Mingguan (Sabtu): Nonaktif';
          else if (key === 'bulanan') label.textContent = on ? 'Rekap Bulanan (Tgl 1): Aktif' : 'Rekap Bulanan (Tgl 1): Nonaktif';
        }
      };
    });

    /* Tab: semua panel tetap berada di DOM supaya nilai yang belum disimpan
       tidak hilang saat berpindah tab, dan satu tombol Simpan tetap bisa
       membaca seluruh field. */
    let waTimer = null;
    function stopWaTimer() {
      if (!waTimer) return;
      clearInterval(waTimer);
      waTimer = null;
    }
    function startWaTimer() {
      if (waTimer) return;
      waTimer = setInterval(() => {
        if (!document.getElementById('wa-log')) { stopWaTimer(); return; }
        renderWaLog();
      }, 5000);
    }
    function showTab(tab) {
      document.querySelectorAll('#set-tab-bar [data-set-tab]').forEach(b => b.classList.toggle('active', b.dataset.setTab === tab));
      document.querySelectorAll('[data-set-panel]').forEach(p => { p.style.display = p.dataset.setPanel === tab ? '' : 'none'; });
      // Log WhatsApp hanya perlu berjalan saat tabnya sedang dilihat.
      if (tab === 'wa') { renderWaLog(); startWaTimer(); } else stopWaTimer();
    }
    document.querySelectorAll('#set-tab-bar [data-set-tab]').forEach(b => b.onclick = () => showTab(b.dataset.setTab));

    document.getElementById('btn-ganti-pass-admin').onclick = () => Shared.gantiPassModal();
    showTab('lembaga');

    document.getElementById('s-logo-upload').onchange = function(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        document.getElementById('s-logo-preview').innerHTML = `<img src="${UI.esc(dataUrl)}" style="max-width:100%;max-height:100%">`;
        _logoData = dataUrl;
        setFavicon(dataUrl);
      };
      reader.readAsDataURL(file);
    };
    let _logoData = s.logo || '';

    document.getElementById('btn-save').onclick = () => {
      const db = Store.get();
      db.settings.namaLembaga = document.getElementById('s-nama').value.trim();
      db.settings.alamat = document.getElementById('s-alamat').value.trim();
      db.settings.tahunAjaran = document.getElementById('s-thn').value.trim();
      db.settings.semester = document.getElementById('s-sem').value;
      db.settings.standarPenilaian = document.getElementById('s-standar').value.trim();
      db.settings.jamBelajar = document.getElementById('s-jam').value.trim();
      db.settings.defaultPasswordFormat = document.getElementById('s-pass').value.trim() || '12345678';
      db.settings.setoranMulti = document.getElementById('s-setoran-multi').classList.contains('on');
      db.settings.notifActive = document.getElementById('s-notif-active').classList.contains('on');
      db.settings.notifWali = document.getElementById('s-notif-wali').classList.contains('on');
      db.settings.notifUstadz = document.getElementById('s-notif-ustadz').classList.contains('on');
      db.settings.notifMaxPerDay = parseInt(document.getElementById('s-notif-max').value) || 3;
      db.settings.notifAbsensiWali = document.getElementById('s-notif-absensi-wali').classList.contains('on');
      db.settings.notifAbsensiPeriode = document.getElementById('s-notif-absensi-periode').value;
      db.settings.waBridgeUrl = document.getElementById('s-wa-url').value.trim();
      db.settings.waBridgeKey = document.getElementById('s-wa-key').value.trim();
      db.settings.waAuto = document.getElementById('s-wa-auto').classList.contains('on');
      // Pemicu WA baru (bisa lebih dari satu)
      if (!db.settings.waAutoTrigger || typeof db.settings.waAutoTrigger !== 'object') db.settings.waAutoTrigger = {};
      ['setoran', 'harian', 'mingguan', 'bulanan'].forEach(key => {
        const el = document.getElementById('s-wa-' + key);
        if (el) db.settings.waAutoTrigger[key] = el.classList.contains('on');
      });
      const jamWa = document.getElementById('s-wa-jam');
      if (jamWa) db.settings.waAutoJam = jamWa.value || '07:00';
      db.settings.logo = _logoData || '';
      Store.save(); Store.log('Update settings'); UI.toast('Settings tersimpan', 'success');
    };
    document.getElementById('btn-backup').onclick = () => {
      const data = JSON.stringify(Store.get());
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'tahfidzku_backup_' + Store.todayStr() + '.json'; a.click();
      URL.revokeObjectURL(url);
      Store.addNotif(Store.getSession().userId, 'admin', 'Backup database dilakukan');
      UI.toast('Backup berhasil', 'success');
    };
    document.getElementById('btn-reset').onclick = () => {
      UI.confirmDialog('Reset Data', 'Seluruh data akan dikembalikan ke demo awal.', () => {
        Store.reset(); UI.toast('Data direset', 'info'); App.start();
      });
    };

    const waStatusEl = document.getElementById('wa-status');
    const waUrlEl = document.getElementById('s-wa-url');
    const waKeyEl = document.getElementById('s-wa-key');
    // Semua panggilan ke bridge dilewatkan API. Bridge hanya hidup di jaringan
    // internal, jadi X-WA-Key tidak dibutuhkan di sisi browser.
    function waBelumTersimpan() {
      const s = Store.get().settings;
      return waUrlEl.value.trim() !== (s.waBridgeUrl || '') || waKeyEl.value.trim() !== (s.waBridgeKey || '');
    }
    function waMintaSimpan() {
      waStatusEl.innerHTML = '<span style="color:var(--warn)">URL/Key Bridge berubah. Tekan <b>Simpan Pengaturan</b> dulu — bridge dipanggil dari server memakai nilai yang tersimpan.</span>';
      return false;
    }
    document.getElementById('btn-wa-status').onclick = async () => {
      waStatusEl.innerHTML = '<span class="muted">Memeriksa...</span>';
      if (!waUrlEl.value.trim()) { waStatusEl.innerHTML = '<span style="color:var(--danger)">URL Bridge kosong.</span>'; return; }
      if (waBelumTersimpan()) { waMintaSimpan(); return; }
      try {
        const data = await Store.waStatus();
        if (!data) { waStatusEl.innerHTML = '<span style="color:var(--danger)">Tidak ada balasan dari bridge.</span>'; return; }
        if (data.connected) {
          waStatusEl.innerHTML = '<span style="color:var(--success)">✓ Terhubung' + (data.phone ? ' (' + UI.esc(data.phone) + ')' : '') + '</span>';
          return;
        }
        // QR diambil dari API memakai sesi admin, jadi frontend tidak perlu
        //	url bridge beserta kuncinya.
        const qrImg = document.createElement('img');
        qrImg.alt = 'QR WhatsApp';
        qrImg.style.cssText = 'display:block;margin-top:10px;width:220px;max-width:100%;border-radius:10px;background:#fff';
        waStatusEl.innerHTML = '<span style="color:var(--warn)">Belum terhubung' + (data.qr ? ' — scan QR di bawah dari WhatsApp di HP admin.' : '.') + '</span>';
        waStatusEl.appendChild(qrImg);
        try {
          qrImg.src = await Store.waQrDataUrl();
        } catch (e) {
          qrImg.remove();
          waStatusEl.insertAdjacentHTML('beforeend', ' <span style="color:var(--danger)">(' + UI.esc(e.message) + ')</span>');
        }
      } catch (e) {
        waStatusEl.innerHTML = '<span style="color:var(--danger)">Tidak bisa menghubungi bridge: ' + UI.esc(e.message) + '</span>';
      }
    };
    document.getElementById('btn-wa-test').onclick = async () => {
      const nohp = prompt('Nomor WhatsApp tujuan tes (contoh: 0812xxx):');
      if (!nohp) return;
      if (waBelumTersimpan()) { waMintaSimpan(); return; }
      waStatusEl.innerHTML = '<span class="muted">Mengirim...</span>';
      const msg = 'Tes WhatsApp Bridge Tahfidzku. Pesan laporan capaian akan terkirim otomatis ke wali.';
      Store.waSend(nohp, msg).then(ok => {
        waStatusEl.innerHTML = ok
          ? '<span style="color:var(--success)">✓ Pesan masuk antrian bridge.</span>'
          : '<span style="color:var(--danger)">Gagal mengirim. Lihat Log WhatsApp di bawah.</span>';
      });
    };

    // Jalankan rekap terjadwal sekarang juga, untuk mencoba tanpa menunggu
    // jadwal. Pakai endpoint yang sama dengan cron, jadi penanda "sudah
    // terkirim" tetap konsisten dan tidak ada pesan dobel.
    let queuePollTimer = null;
    let maxQueueSeen = 0;

    async function checkQueueProgress() {
      const qBadge = document.getElementById('wa-queue-badge');
      const qDesc = document.getElementById('wa-queue-desc');
      const stopBtn = document.getElementById('btn-wa-stop');
      const pBarWrap = document.getElementById('wa-queue-progress-bar-wrap');
      const pBar = document.getElementById('wa-queue-progress-bar');
      const pStatus = document.getElementById('wa-queue-progress-status');
      const pCount = document.getElementById('wa-queue-progress-count');

      if (!qBadge) return;

      const q = await Store.waQueueStatus();
      const pending = (q && q.pending) ? Number(q.pending) : 0;
      const sending = Boolean(q && q.sending);

      if (pending > 0 || sending) {
        if (pending > maxQueueSeen) maxQueueSeen = pending;
        const total = Math.max(maxQueueSeen, pending);
        const sent = Math.max(0, total - pending);
        const pct = total > 0 ? Math.round((sent / total) * 100) : 0;

        qBadge.className = 'badge warn';
        qBadge.textContent = `Sedang Mengirim (${pending} pesan tersisa)`;
        if (qDesc) qDesc.textContent = 'Pesan dikirim berurutan dengan jeda aman anti-banned. Anda dapat membatalkan sisa pesan kapan saja.';

        if (stopBtn) {
          stopBtn.disabled = false;
          stopBtn.style.opacity = '1';
          stopBtn.textContent = 'Batalkan Pengiriman (' + pending + ')';
        }

        if (pBarWrap) pBarWrap.style.display = 'block';
        if (pBar) pBar.style.width = pct + '%';
        if (pStatus) pStatus.textContent = `Mengirim pesan... ${pct}% selesai`;
        if (pCount) pCount.textContent = `${sent} / ${total} pesan`;
      } else {
        maxQueueSeen = 0;
        qBadge.className = 'badge ok';
        qBadge.textContent = 'Antrian Kosong (0 Pesan)';
        if (qDesc) qDesc.textContent = 'Tidak ada pesan dalam antrian pengiriman.';

        if (stopBtn) {
          stopBtn.disabled = false;
          stopBtn.style.opacity = '0.7';
          stopBtn.textContent = 'Batalkan Pengiriman';
        }

        if (pBarWrap) pBarWrap.style.display = 'none';

        if (queuePollTimer) {
          clearInterval(queuePollTimer);
          queuePollTimer = null;
        }
      }
    }

    function startQueuePolling() {
      if (queuePollTimer) clearInterval(queuePollTimer);
      checkQueueProgress();
      queuePollTimer = setInterval(async () => {
        await checkQueueProgress();
        renderWaLog();
      }, 2000);
    }

    async function handleStopQueue() {
      const stopBtn = document.getElementById('btn-wa-stop');
      if (stopBtn) { stopBtn.disabled = true; stopBtn.textContent = 'Membatalkan...'; }
      try {
        const res = await Store.waStopQueue();
        const cancelled = (res && res.data && res.data.cancelled) ?? (res && res.cancelled) ?? 0;
        if (cancelled > 0) {
          UI.toast(`Pengiriman dihentikan. ${cancelled} pesan dibatalkan!`, 'warn');
          waStatusEl.innerHTML = `<span style="color:var(--danger);font-weight:600">Pengiriman dihentikan. ${cancelled} pesan dalam antrian dibatalkan.</span>`;
        } else {
          UI.toast('Antrian pengiriman kosong / sudah selesai.', 'info');
          waStatusEl.innerHTML = '<span class="muted">Antrian pengiriman kosong / sudah dibatalkan.</span>';
        }
        maxQueueSeen = 0;
        await checkQueueProgress();
        renderWaLog();
      } catch (err) {
        UI.toast('Gagal membatalkan antrian: ' + err.message, 'error');
      } finally {
        if (stopBtn) { stopBtn.disabled = false; stopBtn.textContent = 'Batalkan Pengiriman'; }
      }
    }

    const waStopBtn = document.getElementById('btn-wa-stop');
    if (waStopBtn) waStopBtn.onclick = handleStopQueue;

    const waRefreshQueueBtn = document.getElementById('btn-wa-refresh-queue');
    if (waRefreshQueueBtn) waRefreshQueueBtn.onclick = () => {
      checkQueueProgress();
      renderWaLog();
      UI.toast('Status antrian diperbarui.', 'info');
    };

    const waTestRecapBtn = document.getElementById('btn-wa-test-recap');
    if (waTestRecapBtn) waTestRecapBtn.onclick = () => openWaTestRecapModal();

    function openWaTestRecapModal() {
      if (waBelumTersimpan()) { waMintaSimpan(); return; }

      const rawSantri = (Store.santri() || []).filter(s => (s.status || '') !== 'Nonaktif');
      if (!rawSantri.length) {
        UI.toast('Belum ada data santri aktif.', 'warn');
        return;
      }

      const santriList = [...rawSantri].sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));

      let trigger = 'harian';
      let preset = 'yesterday';
      let targetMode = 'admin';
      let customDari = '';
      let customSampai = '';
      const selectedIds = new Set();
      if (santriList[0]) selectedIds.add(santriList[0].id);
      let activePreviewId = santriList[0]?.id || '';
      let filterText = '';
      let previewReqId = 0;

      const defaultAdminPhone = (Store.getSettings() && Store.getSettings().waTestPhone) || '';

      const bodyHTML = `
        <div style="display:flex;flex-direction:column;gap:12px">
          <!-- 1. Pilihan Jenis Rekap & Periode -->
          <div class="clay-card pad-sm" style="background:var(--bg,#f8fafc);border:1px solid var(--border)">
            <div class="row" style="gap:12px;flex-wrap:wrap;align-items:flex-end">
              <div style="flex:1;min-width:200px">
                <label class="field-label" style="font-weight:600;font-size:12px;margin-bottom:6px;display:block">1. Jenis Laporan Rekap</label>
                <div style="display:flex;gap:6px">
                  <button type="button" class="clay-btn sm test-wa-trigger-btn active" data-trigger="harian" style="flex:1;justify-content:center;background:#2563eb;color:#fff;font-weight:600">Harian</button>
                  <button type="button" class="clay-btn sm ghost test-wa-trigger-btn" data-trigger="mingguan" style="flex:1;justify-content:center">Mingguan</button>
                  <button type="button" class="clay-btn sm ghost test-wa-trigger-btn" data-trigger="bulanan" style="flex:1;justify-content:center">Bulanan</button>
                </div>
              </div>

              <div style="flex:1;min-width:200px">
                <label class="field-label" style="font-weight:600;font-size:12px;margin-bottom:6px;display:block">2. Periode Laporan</label>
                <select id="test-wa-preset-select" class="field-input" style="width:100%;padding:6px 10px;font-size:13px">
                  <option value="yesterday">Kemarin (Rekomendasi)</option>
                  <option value="today">Hari Ini</option>
                  <option value="custom">Pilih Tanggal Khusus...</option>
                </select>
              </div>
            </div>

            <div id="test-wa-custom-dates" class="row mt-sm" style="display:none;gap:10px;align-items:center;background:#fff;padding:8px 12px;border-radius:8px;border:1px dashed var(--border)">
              <div style="flex:1">
                <span style="font-size:11px;color:var(--text-soft)">Tanggal Awal:</span>
                <input type="date" id="test-wa-custom-dari" class="field-input" style="width:100%;padding:4px 8px;font-size:12px">
              </div>
              <div style="flex:1">
                <span style="font-size:11px;color:var(--text-soft)">Tanggal Akhir:</span>
                <input type="date" id="test-wa-custom-sampai" class="field-input" style="width:100%;padding:4px 8px;font-size:12px">
              </div>
            </div>
          </div>

          <!-- 2. Tujuan Pengiriman -->
          <div class="clay-card pad-sm" style="background:#fefce8;border:1px solid #fef08a">
            <label class="field-label" style="font-weight:600;font-size:12px;color:#854d0e;margin-bottom:6px;display:block">3. Tujuan Pengiriman Uji Coba</label>
            <div style="display:flex;flex-direction:column;gap:8px">
              <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:13px">
                <input type="radio" name="test-wa-target-mode" value="admin" checked style="margin-top:3px">
                <div>
                  <b style="color:#713f12">Kirim ke Nomor Tes Admin (Direkomendasikan untuk uji coba)</b>
                  <div class="muted" style="font-size:11.5px">Seluruh rekap santri terpilih akan dikirimkan ke nomor ini agar admin bisa mengecek langsung tampilan pesan di WhatsApp.</div>
                  <div id="test-wa-phone-input-wrap" style="margin-top:6px">
                    <input type="tel" id="test-wa-admin-phone" class="field-input" placeholder="Nomor WhatsApp Admin (contoh: 08123456789)" value="${UI.esc(defaultAdminPhone)}" style="max-width:320px;padding:6px 10px;font-size:13px">
                  </div>
                </div>
              </label>
              <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:13px">
                <input type="radio" name="test-wa-target-mode" value="wali" style="margin-top:3px">
                <div>
                  <b style="color:#713f12">Kirim Langsung ke Nomor HP Wali Santri (Asli)</b>
                  <div class="muted" style="font-size:11.5px">Pesan akan dikirim langsung ke masing-masing wali santri yang dipilih di bawah.</div>
                </div>
              </label>
            </div>
          </div>

          <!-- 3. Dua Kolom: Pilih Santri & Pratinjau Pesan -->
          <div class="row" style="gap:14px;flex-wrap:wrap;align-items:stretch">
            <!-- Kolom Kiri: Pilih Santri -->
            <div style="flex:1;min-width:280px;display:flex;flex-direction:column">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <label class="field-label" style="font-weight:600;font-size:12px;margin:0">4. Pilih Santri (<span id="test-wa-selected-badge">1 dipilih</span>)</label>
                <div style="display:flex;gap:4px">
                  <button type="button" class="clay-btn sm ghost" id="test-wa-btn-all" style="padding:2px 8px;font-size:11px">Pilih Semua</button>
                  <button type="button" class="clay-btn sm ghost" id="test-wa-btn-none" style="padding:2px 8px;font-size:11px">Kosongkan</button>
                </div>
              </div>
              <input type="text" id="test-wa-search" class="field-input" placeholder="Cari nama atau kelas santri..." style="width:100%;padding:6px 10px;font-size:12.5px;margin-bottom:8px">
              
              <div id="test-wa-santri-container" style="max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;padding:4px;background:#fff;display:flex;flex-direction:column;gap:3px">
                <!-- Diisi via renderSantriList() -->
              </div>
            </div>

            <!-- Kolom Kanan: Pratinjau Teks WhatsApp -->
            <div style="flex:1;min-width:280px;display:flex;flex-direction:column">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <label class="field-label" style="font-weight:600;font-size:12px;margin:0">Pratinjau Pesan WhatsApp</label>
                <span id="test-wa-preview-chip" class="badge ok" style="font-size:11px">-</span>
              </div>
              <div style="flex:1;display:flex;flex-direction:column;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;min-height:260px">
                <div style="font-size:11px;color:#166534;margin-bottom:6px;display:flex;justify-content:space-between;border-bottom:1px dashed #bbf7d0;padding-bottom:4px;flex-wrap:wrap;gap:4px">
                  <span id="test-wa-preview-dest-info">Tujuan: Nomor Admin</span>
                  <span id="test-wa-preview-periode-info">Periode: -</span>
                </div>
                <pre id="test-wa-preview-box" style="white-space:pre-wrap;font-family:monospace;font-size:11.5px;color:#1e293b;line-height:1.45;margin:0;flex:1;overflow-y:auto;max-height:240px">Memuat pratinjau pesan...</pre>
              </div>
            </div>
          </div>
        </div>
      `;

      const { modal, close } = UI.openModal({
        cls: 'modal-lg',
        title: 'Uji Coba Pengiriman Rekap WhatsApp',
        sub: 'Uji coba format rekap (Harian, Mingguan, Bulanan) untuk santri tertentu dan periksa tampilannya sebelum dikirim resmi.',
        bodyHTML,
        actions: [
          { label: 'Batal', cls: 'ghost', onClick: (m, c) => c() },
          {
            label: 'Kirim Pesan Uji Coba',
            cls: 'primary',
            onClick: async (m, c) => {
              if (!selectedIds.size) {
                UI.toast('Pilih minimal satu santri untuk diuji coba.', 'warn');
                return;
              }
              let overridePhone = '';
              if (targetMode === 'admin') {
                const adminPhoneInput = m.querySelector('#test-wa-admin-phone');
                overridePhone = adminPhoneInput ? adminPhoneInput.value.trim() : '';
                if (!overridePhone) {
                  UI.toast('Masukkan nomor WhatsApp tujuan uji coba.', 'warn');
                  return;
                }
              }

              const btnSend = m.querySelector('.modal-actions .clay-btn.primary');
              if (btnSend) { btnSend.disabled = true; btnSend.textContent = 'Mengirim Uji Coba...'; }

              try {
                const payload = {
                  trigger,
                  preset,
                  santriIds: Array.from(selectedIds),
                  overridePhone: targetMode === 'admin' ? overridePhone : '',
                  dari: preset === 'custom' ? customDari : null,
                  sampai: preset === 'custom' ? customSampai : null
                };

                const res = await Store.waSendTestRecap(payload);
                if (!res || !res.ok) {
                  UI.toast('Gagal mengirim pesan uji coba: ' + ((res && res.detail) || 'Error'), 'error');
                  return;
                }

                UI.toast(`✓ ${res.terkirim} pesan uji coba masuk antrian bridge!`, 'success');
                c();
                startQueuePolling();
                renderWaLog();
              } catch (err) {
                UI.toast('Terjadi kesalahan: ' + err.message, 'error');
              } finally {
                if (btnSend && btnSend.isConnected) {
                  btnSend.disabled = false;
                  btnSend.textContent = 'Kirim Pesan Uji Coba';
                }
              }
            }
          }
        ]
      });

      // Element references inside modal
      const santriContainer = modal.querySelector('#test-wa-santri-container');
      const selectedBadge = modal.querySelector('#test-wa-selected-badge');
      const previewBox = modal.querySelector('#test-wa-preview-box');
      const previewChip = modal.querySelector('#test-wa-preview-chip');
      const previewDestInfo = modal.querySelector('#test-wa-preview-dest-info');
      const previewPeriodeInfo = modal.querySelector('#test-wa-preview-periode-info');
      const presetSelect = modal.querySelector('#test-wa-preset-select');
      const customDatesWrap = modal.querySelector('#test-wa-custom-dates');
      const customDariInput = modal.querySelector('#test-wa-custom-dari');
      const customSampaiInput = modal.querySelector('#test-wa-custom-sampai');
      const searchInput = modal.querySelector('#test-wa-search');
      const btnAll = modal.querySelector('#test-wa-btn-all');
      const btnNone = modal.querySelector('#test-wa-btn-none');
      const phoneInputWrap = modal.querySelector('#test-wa-phone-input-wrap');
      const adminPhoneInput = modal.querySelector('#test-wa-admin-phone');

      const todayIso = new Date().toISOString().split('T')[0];
      if (customDariInput) customDariInput.value = todayIso;
      if (customSampaiInput) customSampaiInput.value = todayIso;
      customDari = todayIso;
      customSampai = todayIso;

      function updateSelectedBadge() {
        if (selectedBadge) {
          selectedBadge.textContent = `${selectedIds.size} dipilih`;
        }
      }

      function renderSantriList() {
        if (!santriContainer) return;
        const q = (filterText || '').toLowerCase().trim();
        const filtered = santriList.filter(s => {
          if (!q) return true;
          const nama = (s.nama || '').toLowerCase();
          const kelas = (Store.educationLabel(s) || '').toLowerCase();
          return nama.includes(q) || kelas.includes(q);
        });

        if (!filtered.length) {
          santriContainer.innerHTML = '<div class="pad-sm muted" style="text-align:center;font-size:12px">Santri tidak ditemukan.</div>';
          return;
        }

        santriContainer.innerHTML = filtered.map(s => {
          const isSelected = selectedIds.has(s.id);
          const isActive = s.id === activePreviewId;
          const noHp = Store.waNomorWali(s.id);
          const kelasLbl = Store.educationLabel(s);
          const bgStyle = isActive ? 'background:#eff6ff;border:1px solid #93c5fd;' : (isSelected ? 'background:#f8fafc;' : 'background:#fff;');

          return `
            <div class="test-wa-santri-item" data-id="${UI.esc(s.id)}" style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:6px;gap:8px;cursor:pointer;border-left:3px solid ${isActive ? '#2563eb' : 'transparent'};${bgStyle}">
              <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1">
                <input type="checkbox" class="test-wa-santri-check" data-id="${UI.esc(s.id)}" ${isSelected ? 'checked' : ''} style="cursor:pointer">
                <div style="min-width:0;flex:1">
                  <div style="font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${UI.esc(s.nama)}</div>
                  <div class="muted" style="font-size:11px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                    <span>${UI.esc(kelasLbl)}</span>
                    ${noHp ? `<span style="color:#0284c7">${UI.esc(noHp)}</span>` : '<span style="color:#d97706">Tanpa No. HP</span>'}
                  </div>
                </div>
              </div>
              <button type="button" class="clay-btn sm ghost test-wa-btn-preview" data-id="${UI.esc(s.id)}" style="padding:2px 6px;font-size:10.5px;flex-shrink:0">
                ${isActive ? 'Aktif' : 'Pratinjau'}
              </button>
            </div>
          `;
        }).join('');

        santriContainer.querySelectorAll('.test-wa-santri-check').forEach(chk => {
          chk.onchange = (e) => {
            const sid = e.target.getAttribute('data-id');
            if (e.target.checked) selectedIds.add(sid);
            else selectedIds.delete(sid);
            updateSelectedBadge();
          };
        });

        santriContainer.querySelectorAll('.test-wa-santri-item').forEach(item => {
          item.onclick = (e) => {
            if (e.target.tagName === 'INPUT') return;
            const sid = item.getAttribute('data-id');
            if (sid) {
              activePreviewId = sid;
              renderSantriList();
              fetchPreview();
            }
          };
        });
      }

      async function fetchPreview() {
        const reqId = ++previewReqId;
        if (previewBox) previewBox.innerHTML = '<span class="muted">Memuat dan menghitung data rekap...</span>';

        const activeSantri = santriList.find(s => s.id === activePreviewId) || santriList[0];
        const santriPhone = activeSantri ? Store.waNomorWali(activeSantri.id) : '';
        const adminPhone = adminPhoneInput ? adminPhoneInput.value.trim() : '';

        if (previewDestInfo) {
          previewDestInfo.textContent = targetMode === 'admin'
            ? `Tujuan Tes: Admin (${adminPhone || 'Belum diisi'})`
            : `Tujuan Asli: Wali (${santriPhone || 'Tanpa No. HP'})`;
        }

        try {
          const res = await Store.waPreviewTest({
            trigger,
            preset,
            santriId: activePreviewId,
            dari: preset === 'custom' ? customDari : null,
            sampai: preset === 'custom' ? customSampai : null
          });

          if (reqId !== previewReqId) return;

          if (!res || !res.ok) {
            if (previewBox) previewBox.textContent = 'Gagal memuat pratinjau: ' + ((res && res.detail) || 'Error');
            return;
          }

          if (previewBox) previewBox.textContent = res.pesan || '(Pesan kosong)';
          if (previewChip) previewChip.textContent = `${res.santri?.nama || '-'} (${res.santri?.kelas || '-'})`;
          if (previewPeriodeInfo) {
            const p = res.periode || {};
            previewPeriodeInfo.textContent = p.dari === p.sampai ? `Tgl: ${p.dari}` : `${p.dari} s/d ${p.sampai}`;
          }
        } catch (e) {
          if (reqId === previewReqId && previewBox) {
            previewBox.textContent = 'Gagal memuat: ' + e.message;
          }
        }
      }

      function updatePresetDropdown() {
        if (!presetSelect) return;
        if (trigger === 'harian') {
          presetSelect.innerHTML = `
            <option value="yesterday">Kemarin (Rekomendasi)</option>
            <option value="today">Hari Ini</option>
            <option value="custom">Pilih Tanggal Khusus...</option>
          `;
          preset = 'yesterday';
        } else if (trigger === 'mingguan') {
          presetSelect.innerHTML = `
            <option value="this_week">Pekan Ini (Senin – Jumat)</option>
            <option value="last_week">Pekan Lalu (Senin – Jumat)</option>
            <option value="custom">Pilih Rentang Khusus...</option>
          `;
          preset = 'this_week';
        } else if (trigger === 'bulanan') {
          presetSelect.innerHTML = `
            <option value="this_month">Bulan Ini</option>
            <option value="last_month">Bulan Lalu (Rekomendasi)</option>
            <option value="custom">Pilih Rentang Khusus...</option>
          `;
          preset = 'this_month';
        }
        if (customDatesWrap) customDatesWrap.style.display = 'none';
      }

      modal.querySelectorAll('.test-wa-trigger-btn').forEach(btn => {
        btn.onclick = () => {
          modal.querySelectorAll('.test-wa-trigger-btn').forEach(b => {
            b.classList.remove('active');
            b.classList.add('ghost');
            b.style.background = '';
            b.style.color = '';
            b.style.fontWeight = '';
          });
          btn.classList.add('active');
          btn.classList.remove('ghost');
          btn.style.background = '#2563eb';
          btn.style.color = '#fff';
          btn.style.fontWeight = '600';

          trigger = btn.getAttribute('data-trigger') || 'harian';
          updatePresetDropdown();
          fetchPreview();
        };
      });

      if (presetSelect) {
        presetSelect.onchange = () => {
          preset = presetSelect.value;
          if (customDatesWrap) {
            customDatesWrap.style.display = preset === 'custom' ? 'flex' : 'none';
          }
          fetchPreview();
        };
      }

      if (customDariInput) customDariInput.onchange = () => { customDari = customDariInput.value; fetchPreview(); };
      if (customSampaiInput) customSampaiInput.onchange = () => { customSampai = customSampaiInput.value; fetchPreview(); };

      modal.querySelectorAll('input[name="test-wa-target-mode"]').forEach(r => {
        r.onchange = () => {
          targetMode = r.value;
          if (phoneInputWrap) phoneInputWrap.style.display = targetMode === 'admin' ? 'block' : 'none';
          fetchPreview();
        };
      });

      if (adminPhoneInput) {
        adminPhoneInput.oninput = () => fetchPreview();
      }

      if (searchInput) {
        searchInput.oninput = () => {
          filterText = searchInput.value;
          renderSantriList();
        };
      }

      if (btnAll) {
        btnAll.onclick = () => {
          const q = (filterText || '').toLowerCase().trim();
          santriList.forEach(s => {
            if (!q || (s.nama || '').toLowerCase().includes(q) || (Store.educationLabel(s) || '').toLowerCase().includes(q)) {
              selectedIds.add(s.id);
            }
          });
          renderSantriList();
          updateSelectedBadge();
        };
      }

      if (btnNone) {
        btnNone.onclick = () => {
          selectedIds.clear();
          renderSantriList();
          updateSelectedBadge();
        };
      }

      updateSelectedBadge();
      renderSantriList();
      fetchPreview();
    }

    const waRecapBtn = document.getElementById('btn-wa-recap');
    if (waRecapBtn) waRecapBtn.onclick = async () => {
      if (waBelumTersimpan()) { waMintaSimpan(); return; }
      waStatusEl.innerHTML = '<span class="muted">Menyiapkan dan mengirim rekap ke antrian...</span>';
      const qBadge = document.getElementById('wa-queue-badge');
      const qDesc = document.getElementById('wa-queue-desc');
      if (qBadge) { qBadge.className = 'badge warn'; qBadge.textContent = 'Sedang Memproses...'; }
      if (qDesc) { qDesc.textContent = 'Menyiapkan rekap dan memasukkan pesan ke antrian bridge...'; }
      startQueuePolling();

      const res = await Store.waAutoReminder();
      if (!res || !res.ok) {
        waStatusEl.innerHTML = '<span style="color:var(--danger)">' + UI.esc((res && res.detail) || 'Gagal menjalankan rekap.') + '</span>';
      } else if (!res.terkirim) {
        waStatusEl.innerHTML = '<span class="muted">' + UI.esc(res.detail || 'Tidak ada rekap baru yang perlu dikirim.') + '</span>';
      } else {
        waStatusEl.innerHTML = '<span style="color:var(--success)">✓ ' + res.terkirim + ' pesan masuk antrian bridge.</span>';
      }
      checkQueueProgress();
      renderWaLog();
    };

    checkQueueProgress();

    function renderWaLog() {
      const el = document.getElementById('wa-log');
      if (!el) return;
      // Log juga ditulis server (cron / rekap terjadwal), jadi ambil versi
      // terbaru dari server, bukan hanya salinan yang ada di browser.
      Store.waLogServer().then(serverLogs => {
        if (!serverLogs) return;
        const merged = serverLogs.concat(Store.get().logWa || []);
        const seen = new Set();
        const logs = merged.filter(l => {
          const key = l.id || (l.to + '|' + l.tanggal + '|' + l.message);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, 50);
        if (!logs.length) { el.innerHTML = '<span class="muted">Belum ada pengiriman.</span>'; return; }
        el.innerHTML = logs.map(l => {
          const status = l.status || '?';
          const color = status === 'queued' ? 'var(--success)' : status === 'skipped' ? 'var(--warn)' : 'var(--danger)';
          const tgl = (l.tanggal || '').replace('T', ' ').slice(5, 19);
          const detail = l.detail ? '<div style="color:var(--danger);margin-top:2px">' + UI.esc(l.detail) + '</div>' : '';
          const msg = l.message ? '<div class="muted" style="margin-top:2px">' + UI.esc(l.message) + '</div>' : '';
          return '<div style="padding:6px 0;border-bottom:1px solid var(--line,#eee)">' +
            '<span style="color:' + color + ';font-weight:600">' + UI.esc(status) + '</span> ' +
            '<span class="muted">' + UI.esc(tgl) + '</span> → <b>' + UI.esc(l.to || '-') + '</b>' +
            detail + msg + '</div>';
        }).join('');
      });
    }
    const waLogBtn = document.getElementById('btn-wa-log-refresh');
    if (waLogBtn) waLogBtn.onclick = renderWaLog;
  }

  /* ---------------- Kalender Libur (Libur Lembaga) ----------------
     Admin menetapkan tanggal libur untuk seluruh lembaga. Tanggal di masa
     lalu bisa langsung diterapkan ke absensi semua halaqah; tanggal depan
     tersimpan sebagai jadwal dan diterapkan saat admin menekan Terapkan. */
  function adminLibur() {
    Shared.shell('admin', nav('admin_libur'), '');
    Shared.setHeader('Kalender Libur', 'Libur lembaga untuk semua halaqah & santri');
    const db = Store.get();
    const t = Store.todayStr();
    const SESI_LIST = Store.SESI_REKAP;

    function sesiLabel(sesi) {
      if (sesi === 'semua' || !sesi) return 'Semua Sesi';
      return (Array.isArray(sesi) ? sesi : [sesi]).join(', ');
    }

    function sudahDiterapkan(tanggal) {
      return (db.absensiUstadz || []).some(a => a.tanggal === tanggal && a.status === 'Libur');
    }

    function renderLibur() {
      const items = Store.getLiburLembaga();
      const masaDepan = items.filter(i => i.tanggal >= t);
      const lampau = items.filter(i => i.tanggal < t).reverse();

      const rowHtml = i => {
        const applied = sudahDiterapkan(i.tanggal);
        const isToday = i.tanggal === t;
        return `<tr>
          <td><b>${UI.fmtDate(i.tanggal)}</b>${isToday ? ' <span class="badge purple">Hari Ini</span>' : ''}</td>
          <td>${UI.esc(i.keterangan || 'Libur Lembaga')}</td>
          <td>${UI.esc(sesiLabel(i.sesi))}</td>
          <td>${applied
            ? '<span class="badge purple">Sudah diterapkan</span>'
            : '<span class="badge warn">Belum diterapkan</span>'}</td>
          <td>
            <div class="row" style="gap:6px">
              ${applied ? '' : `<button class="clay-btn sm secondary" data-terapkan="${UI.esc(i.tanggal)}">Terapkan</button>`}
              <button class="clay-btn sm danger ghost" data-hapus-libur="${UI.esc(i.tanggal)}">Hapus</button>
            </div>
          </td>
        </tr>`;
      };

      const tableHtml = list => list.length
        ? `<div class="table-wrap"><table class="clay-table">
            <thead><tr><th>Tanggal</th><th>Keterangan</th><th>Sesi</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>${list.map(rowHtml).join('')}</tbody>
          </table></div>`
        : '<div class="empty">Belum ada data.</div>';

      document.getElementById('view-content').innerHTML = `
        <div class="clay-card mb">
          <div class="section-title">Tambah Tanggal Libur</div>
          <div class="muted" style="font-size:12px;margin-bottom:10px">
            Tanggal libur berlaku untuk <b>semua halaqah</b>. Bisa diatur jauh hari ke depan.
            Tekan <b>Terapkan</b> pada tabel untuk mencatat status Libur ke absensi semua ustadz &amp; santri.
          </div>
          <div class="row" style="align-items:flex-end">
            <div style="flex:0 0 170px">${UI.field('Tanggal', '<input type="date" class="clay-input" id="libur-tanggal" value="' + t + '">')}</div>
            <div style="flex:1">${UI.field('Keterangan', '<input class="clay-input" id="libur-ket" placeholder="Contoh: Libur Maulid Nabi / Ujian Semester">')}</div>
          </div>
          <div class="mt">
            <div class="field-label">Sesi yang Diliburkan</div>
            <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:4px">
              <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">
                <input type="radio" name="libur-lembaga-sesi" value="semua" checked> <span>Semua Sesi</span>
              </label>
              <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">
                <input type="radio" name="libur-lembaga-sesi" value="custom"> <span>Pilih Sesi Tertentu</span>
              </label>
            </div>
            <div id="libur-lembaga-custom" style="display:none;margin-top:8px;padding:8px 12px;background:var(--bg);border-radius:var(--radius-md)">
              <div class="row" style="gap:12px;flex-wrap:wrap">
                ${SESI_LIST.map(s => `<label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer"><input type="checkbox" data-libur-lembaga-sesi value="${UI.esc(s)}"> ${UI.esc(s)}</label>`).join('')}
              </div>
            </div>
          </div>
          <div class="row mt">
            <button class="clay-btn primary" id="btn-tambah-libur">+ Tambah Libur Lembaga</button>
          </div>
        </div>
        <div class="clay-card mb">
          <div class="section-title">Jadwal Libur Mendatang</div>
          ${tableHtml(masaDepan)}
        </div>
        <div class="clay-card">
          <div class="section-title">Riwayat Libur (Lampau)</div>
          ${tableHtml(lampau)}
        </div>`;

      document.querySelectorAll('input[name="libur-lembaga-sesi"]').forEach(r => {
        r.onchange = () => {
          const custom = document.getElementById('libur-lembaga-custom');
          if (custom) custom.style.display = r.value === 'custom' && r.checked ? 'block' : 'none';
        };
      });

      document.getElementById('btn-tambah-libur').onclick = async () => {
        const tanggal = document.getElementById('libur-tanggal').value;
        const keterangan = document.getElementById('libur-ket').value.trim();
        if (!tanggal) { UI.toast('Pilih tanggal libur', 'error'); return; }
        const scope = document.querySelector('input[name="libur-lembaga-sesi"]:checked')?.value || 'semua';
        let sesiList = 'semua';
        if (scope === 'custom') {
          sesiList = [...document.querySelectorAll('[data-libur-lembaga-sesi]:checked')].map(cb => cb.value);
          if (!sesiList.length) { UI.toast('Pilih minimal satu sesi', 'error'); return; }
        }
        const ok = await Store.tambahLiburLembaga(tanggal, keterangan || 'Libur Lembaga', sesiList);
        if (ok) {
          UI.toast('Libur lembaga tersimpan ✓', 'success');
          renderLibur();
        }
      };

      document.querySelectorAll('[data-terapkan]').forEach(btn => {
        btn.onclick = () => {
          const tanggal = btn.dataset.terapkan;
          UI.confirmDialog(
            'Terapkan Libur Lembaga',
            `Seluruh halaqah akan dicatat <b>Libur</b> pada <b>${UI.fmtDate(tanggal)}</b> untuk sesi yang dipilih. Absensi yang sudah ada pada sesi tersebut akan ditimpa. Lanjutkan?`,
            async () => {
              const ok = await Store.terapkanLiburLembaga(tanggal);
              if (ok) {
                UI.toast('Libur lembaga diterapkan ke semua halaqah ✓', 'success');
                renderLibur();
              }
            }
          );
        };
      });

      document.querySelectorAll('[data-hapus-libur]').forEach(btn => {
        btn.onclick = () => {
          const tanggal = btn.dataset.hapusLibur;
          const applied = sudahDiterapkan(tanggal);
          UI.confirmDialog(
            'Hapus Tanggal Libur',
            `Jadwal libur <b>${UI.fmtDate(tanggal)}</b> akan dihapus${applied ? '. Catatan absensi Libur yang sudah terpasang tidak ikut terhapus (batalkan per halaqah bila perlu)' : ''}. Lanjutkan?`,
            async () => {
              const ok = await Store.hapusLiburLembaga(tanggal);
              if (ok) {
                UI.toast('Tanggal libur dihapus', 'info');
                renderLibur();
              }
            }
          );
        };
      });
    }

    renderLibur();
  }

  return { nav, dashboard, santri, ustadz, halaqah, master, absensiUstadz, riwayat, laporan, rekapKehadiran, rekapSetoran, notif, talim, adminLibur, settings, importSantriDialog };
})();
