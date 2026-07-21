/* ============================================================
   Tahfidzku — Admin Views
   ============================================================ */
const Admin = (() => {

  function parseImportRows(raw) {
    return raw.trim().split(/\r?\n/).filter(Boolean).map(line => {
      const separator = line.includes('\t') ? '\t' : ',';
      return line.split(separator).map(value => value.trim());
    });
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
      { view: 'admin_dashboard', label: 'Dashboard', ico: '📊', active: active === 'admin_dashboard' },
      { view: 'admin_santri', label: 'Santri', ico: '🧒', active: active === 'admin_santri' },
      { view: 'admin_ustadz', label: 'Ustadz', ico: '🧑‍🏫', active: active === 'admin_ustadz' },
      { view: 'admin_halaqah', label: 'Halaqah', ico: '🏫', active: active === 'admin_halaqah' },
      { view: 'admin_master', label: 'Master Surat', ico: '📜', active: active === 'admin_master' },
      { view: 'ustadz_absensi', label: 'Absensi', ico: '✅', active: active === 'ustadz_absensi' },
      { view: 'ustadz_pembelajaran', label: 'Pembelajaran', ico: '📝', active: active === 'ustadz_pembelajaran' },
      { view: 'admin_riwayat', label: 'Riwayat', ico: '🕓', active: active === 'admin_riwayat' },
      { view: 'admin_laporan', label: 'Laporan', ico: '📈', active: active === 'admin_laporan' },
      { view: 'admin_notif', label: 'Notifikasi', ico: '🔔', active: active === 'admin_notif' },
      { view: 'admin_settings', label: 'Settings', ico: '⚙️', active: active === 'admin_settings' },
      { view: 'quran', label: 'Al-Qur\'an', ico: '📖', active: active === 'quran' }
    ];
  }

  /* ---------------- Dashboard ---------------- */
  function dashboard() {
    Store.checkSetoranTerlewat();
    Shared.shell('admin', nav('admin_dashboard'), '');
    Shared.setHeader('Dashboard Admin', 'Ringkasan lembaga');
    const db = Store.get();
    const totalHafalanPages = db.santri.reduce((acc, s) => { const h = Store.totalHafalanSantri(s.id); return acc + (h ? h.pages : 0); }, 0);
    const kpi = `
      <div class="grid kpi">
        ${Shared.statCard('🧒', db.santri.length, 'Santri', '#16A34A')}
        ${Shared.statCard('🧑‍🏫', db.ustadz.length, 'Ustadz', '#3B82F6')}
        ${Shared.statCard('🏫', db.halaqah.length, 'Halaqah', '#FACC15')}
        ${Shared.statCard('📖', db.santri.filter(s => s.level === 'Tahsin').length, 'Tahsin', '#22C55E')}
        ${Shared.statCard('📝', db.santri.filter(s => s.level === 'Ziyadah').length, 'Ziyadah', '#3B82F6')}
        ${Shared.statCard('🏆', db.santri.filter(s => s.level === 'Mutqin').length, 'Mutqin', '#16A34A')}
      </div>`;

    // progress hafalan per halaqah (avg pages)
    const halaqahData = db.halaqah.map(h => {
      const ss = db.santri.filter(s => s.halaqah === h.nama);
      const avg = ss.length ? Math.round(ss.reduce((a, s) => { const hh = Store.totalHafalanSantri(s.id); return a + (hh ? hh.pages : 0); }, 0) / ss.length) : 0;
      return { label: h.nama.replace('Halaqah ', 'H'), value: avg };
    });
    // kehadiran mingguan (dummy per hari dari data)
    const days = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    const kehadiranData = days.map(d => ({ label: d, value: db.kehadiran.filter(k => new Date(k.tanggal).getDay() === (days.indexOf(d) + 1) % 7).length + Math.floor(Math.random() * 3) }));

    const content = `
      ${kpi}
      <div class="grid cols-2 mt">
        <div class="clay-card">
          <div class="section-title">📈 Progress Hafalan per Halaqah</div>
          ${Shared.barChart(halaqahData, Math.max(1, ...halaqahData.map(d => d.value)))}
        </div>
        <div class="clay-card">
          <div class="section-title">✅ Kehadiran Mingguan</div>
          ${Shared.barChart(kehadiranData, Math.max(1, ...kehadiranData.map(d => d.value)))}
        </div>
      </div>
      <div class="grid cols-2 mt">
        <div class="clay-card">
          <div class="section-title">🏆 Ranking Halaqah</div>
          ${db.halaqah.map((h, i) => {
            const ss = db.santri.filter(s => s.halaqah === h.nama);
            const total = ss.reduce((a, s) => { const hh = Store.totalHafalanSantri(s.id); return a + (hh ? hh.pages : 0); }, 0);
            return `<div class="row center" style="justify-content:space-between;padding:8px 0"><div><b>#${i + 1}</b> ${UI.esc(h.nama)}</div><span class="badge green">${total} hlm</span></div>`;
          }).join('')}
        </div>
        <div class="clay-card">
          <div class="section-title">⚡ Quick Action</div>
          <div class="row">
            <button class="clay-btn primary" data-go="admin_santri">+ Santri</button>
            <button class="clay-btn secondary" data-go="admin_ustadz">+ Ustadz</button>
            <button class="clay-btn" data-go="admin_halaqah">+ Halaqah</button>
            <button class="clay-btn ghost" id="qa-import">⬇ Import Excel</button>
          </div>
          <div class="section-title mt">🕓 Aktivitas Terakhir</div>
          ${db.logAktivitas.slice(0, 6).map(l => `<div class="row center" style="justify-content:space-between;padding:6px 0"><span class="muted" style="font-size:13px">${UI.esc(l.aksi)}</span><span class="muted" style="font-size:12px">${UI.fmtDateTime(l.tanggal)}</span></div>`).join('') || '<div class="empty">Belum ada aktivitas.</div>'}
        </div>
      </div>`;
    document.getElementById('view-content').innerHTML = content;
    document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => App.navigate(b.dataset.go));
    const imp = document.getElementById('qa-import'); if (imp) imp.onclick = () => importSantriDialog();
  }

  /* ---------------- Santri ---------------- */
  function santri() {
    Shared.shell('admin', nav('admin_santri'), '');
    Shared.setHeader('Manajemen Santri', 'Kelola data santri & akun wali otomatis');
    const db = Store.get();
    const rows = db.santri.map(s => `<tr>
      <td><b>${UI.esc(s.nama)}</b><div class="muted">${UI.esc(s.nis)}</div></td>
      <td>${UI.esc(s.jk)}</td>
      <td>${UI.esc(s.level)}</td>
      <td>${UI.esc(s.halaqah)}</td>
      <td>${UI.esc(s.kelas)}</td>
      <td><span class="badge ${s.status === 'Aktif' ? 'green' : 'gray'}">${UI.esc(s.status)}</span></td>
      <td>
        <button class="clay-btn sm" data-edit="${s.id}">✏️</button>
        <button class="clay-btn sm danger" data-del="${s.id}">🗑</button>
      </td>
    </tr>`).join('');
    document.getElementById('view-content').innerHTML = `
      <div class="clay-card">
        <div class="row" style="justify-content:space-between">
          <div class="section-title" style="margin:0">Daftar Santri (${db.santri.length})</div>
          <div class="row">
            <button class="clay-btn ghost" id="btn-import">⬇ Import Excel</button>
            <button class="clay-btn primary" id="btn-add">+ Tambah Santri</button>
          </div>
        </div>
        <div class="table-wrap mt"><table class="clay-table">
          <thead><tr><th>Nama</th><th>JK</th><th>Level</th><th>Halaqah</th><th>Kelas</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="7"><div class="empty">Belum ada santri.</div></td></tr>`}</tbody>
        </table></div>
      </div>`;
    document.getElementById('btn-add').onclick = () => santriForm();
    document.getElementById('btn-import').onclick = () => importSantriDialog();
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
  }

  function santriForm(id) {
    const db = Store.get();
    const s = id ? Store.findSantri(id) : null;
    const body = `
      ${UI.field('Nama', `<input class="clay-input" id="f-nama" value="${s ? UI.esc(s.nama) : ''}">`)}
      <div class="row">
        <div style="flex:1">${UI.field('NIS', `<input class="clay-input" id="f-nis" value="${s ? UI.esc(s.nis) : ''}">`)}</div>
        <div style="flex:1">${UI.field('Jenis Kelamin', `<select class="clay-select" id="f-jk"><option ${s && s.jk === 'L' ? 'selected' : ''}>L</option><option ${s && s.jk === 'P' ? 'selected' : ''}>P</option></select>`)}</div>
      </div>
      ${UI.field('Tanggal Lahir', `<input class="clay-input" id="f-tgl" type="date" value="${s ? s.tglLahir : ''}">`)}
      ${UI.field('Alamat', `<input class="clay-input" id="f-alamat" value="${s ? UI.esc(s.alamat) : ''}">`)}
      <div class="row">
        <div style="flex:1">${UI.field('No HP Santri', `<input class="clay-input" id="f-hp" value="${s ? UI.esc(s.noHp) : ''}">`)}</div>
        <div style="flex:1">${UI.field('Nama Wali', `<input class="clay-input" id="f-wali" value="${s ? UI.esc(s.namaWali) : ''}">`)}</div>
      </div>
      ${UI.field('No HP Wali', `<input class="clay-input" id="f-hpwali" value="${s ? UI.esc(s.noHpWali) : ''}">`)}
      <div class="row">
        <div style="flex:1">${UI.field('Status', `<select class="clay-select" id="f-status"><option ${s && s.status === 'Aktif' ? 'selected' : ''}>Aktif</option><option ${s && s.status === 'Nonaktif' ? 'selected' : ''}>Nonaktif</option></select>`)}</div>
        <div style="flex:1">${UI.field('Level', `<select class="clay-select" id="f-level">${UI.optionsFromList(db.levelTahfidz.map(l => ({ v: l, l })), 'v', 'l', s ? s.level : 'Tahsin')}</select>`)}</div>
      </div>
      <div class="row">
        <div style="flex:1">${UI.field('Kelas', `<select class="clay-select" id="f-kelas">${UI.optionsFromList(db.kelas.map(k => ({ v: k, l: k })), 'v', 'l', s ? s.kelas : db.kelas[0])}</select>`)}</div>
        <div style="flex:1">${UI.field('Halaqah', `<select class="clay-select" id="f-halaqah">${UI.optionsFromList(db.halaqah.map(h => ({ v: h.nama, l: h.nama })), 'v', 'l', s ? s.halaqah : (db.halaqah[0] && db.halaqah[0].nama))}</select>`)}</div>
      </div>`;
    UI.openModal({
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
            level: m.querySelector('#f-level').value,
            kelas: m.querySelector('#f-kelas').value,
            halaqah: m.querySelector('#f-halaqah').value
          };
          if (!data.nama) { UI.toast('Nama wajib diisi', 'error'); return; }
          if (id) {
            Object.assign(Store.findSantri(id), data);
            Store.log('Edit santri: ' + data.nama);
          } else {
            const waliId = Store.uid('w');
            const newS = { id: Store.uid('s'), ...data, waliId };
            db.santri.push(newS);
            // akun wali otomatis
            const wali = { id: waliId, nama: data.namaWali || data.nama, noHp: data.noHpWali, santriId: newS.id };
            db.wali.push(wali);
            const uname = (data.noHpWali && data.noHpWali.replace(/\D/g, '')) || (data.namaWali || data.nama).toLowerCase().replace(/\s/g, '');
            db.users.push({ id: Store.uid('usr'), username: uname, password: db.settings.defaultPasswordFormat, role: 'wali', refId: waliId });
            Store.log('Tambah santri + akun wali: ' + data.nama);
            Store.addNotif(db.users.find(u => u.role === 'admin')?.id, 'admin', 'Santri baru ditambahkan: ' + data.nama);
          }
          Store.recalcHalaqah(); Store.save(); c(); UI.toast('Tersimpan', 'success'); santri();
        } }
      ]
    });
  }

  /* ---------------- Bulk Import Santri ---------------- */
  function importSantriDialog() {
    const body = `
      <p class="muted">Kolom: Nama | NIS | JK (L/P) | Wali | HP Wali | Level | Halaqah</p>
      <div class="row">
        <button class="clay-btn ghost" id="imp-template">⬇ Download Template Excel</button>
      </div>
      <label class="field-label mt" for="imp-file">Pilih file template yang sudah diisi (.xls atau .csv)</label>
      <input class="clay-input" id="imp-file" type="file" accept=".xls,.csv,text/csv,application/vnd.ms-excel" />
      <label class="field-label mt">Atau tempel data dari Excel/CSV</label>
      <textarea class="clay-textarea" id="imp-data" placeholder="Ahmad, S010, L, Bpk Ali, 0812..., Ziyadah, Halaqah 1&#10;Fatimah, S011, P, Ibu Sara, 0812..., Tahsin, Halaqah 2"></textarea>
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
            <div class="table-wrap mt"><table class="clay-table"><thead><tr><th>Nama</th><th>NIS</th><th>JK</th><th>Wali</th><th>HP</th><th>Level</th><th>Halaqah</th></tr></thead>
            <tbody>${valid.map(c => `<tr><td>${UI.esc(c[0])}</td><td>${UI.esc(c[1])}</td><td>${UI.esc(c[2])}</td><td>${UI.esc(c[3])}</td><td>${UI.esc(c[4])}</td><td>${UI.esc(c[5])}</td><td>${UI.esc(c[6])}</td></tr>`).join('')}</tbody></table></div></div>`;
        } },
        { label: 'Import', cls: 'primary', onClick: (m, c) => {
          const db = Store.get();
          const raw = m.querySelector('#imp-data').value.trim();
          const lines = parseImportRows(raw).filter(c => c.length >= 7 && c[0]);
          let count = 0;
          lines.forEach(c => {
            const waliId = Store.uid('w');
            const newS = { id: Store.uid('s'), nama: c[0], nis: c[1], jk: c[2], tglLahir: '', alamat: '', noHp: '', namaWali: c[3], noHpWali: c[4], status: 'Aktif', level: c[5], kelas: '', halaqah: c[6], waliId };
            db.santri.push(newS);
            const wali = { id: waliId, nama: c[3], noHp: c[4], santriId: newS.id };
            db.wali.push(wali);
            const uname = (c[4] && c[4].replace(/\D/g, '')) || (c[3] || c[0]).toLowerCase().replace(/\s/g, '');
            db.users.push({ id: Store.uid('usr'), username: uname, password: db.settings.defaultPasswordFormat, role: 'wali', refId: waliId });
            count++;
          });
          Store.recalcHalaqah(); Store.save(); Store.log('Import ' + count + ' santri');
          Store.addNotif(db.users.find(u => u.role === 'admin')?.id, 'admin', 'Import berhasil: ' + count + ' santri');
          c(); UI.toast('Import ' + count + ' santri berhasil', 'success'); santri();
        } }
      ]
    });
    bindImportFile(modal.modal, ['Nama', 'NIS', 'JK (L/P)', 'Wali', 'HP Wali', 'Level', 'Halaqah']);
    modal.modal.querySelector('#imp-template').onclick = () => Shared.downloadTemplateExcel(
      'Template_Import_Santri',
      ['Nama', 'NIS', 'JK (L/P)', 'Wali', 'HP Wali', 'Level', 'Halaqah'],
      [['Ahmad Fauzi', 'S010', 'L', 'Bpk Ali', '081234567890', 'Ziyadah', 'Halaqah 1'],
       ['Fatimah Zahra', 'S011', 'P', 'Ibu Sara', '081234567891', 'Tahsin', 'Halaqah 2']],
      'Isi tiap baris untuk 1 santri. Simpan sebagai .xls lalu salin isinya ke kolom di bawah, atau tempel langsung dari Excel.'
    );
  }

  /* ---------------- Ustadz ---------------- */
  function ustadz() {
    Shared.shell('admin', nav('admin_ustadz'), '');
    Shared.setHeader('Manajemen Ustadz', 'Kelola pengajar');
    const db = Store.get();
    const rows = db.ustadz.map(u => {
      const acc = db.users.find(usr => usr.role === 'ustadz' && usr.refId === u.id);
      const uname = acc ? acc.username : '-';
      return `<tr>
        <td><b>${UI.esc(u.nama)}</b></td>
        <td><code>${UI.esc(uname)}</code></td>
        <td>${UI.esc(u.noHp)}</td>
        <td>${UI.esc(u.email)}</td>
        <td>${UI.esc(u.halaqah)}</td>
        <td><span class="badge ${u.status === 'Aktif' ? 'green' : 'gray'}">${UI.esc(u.status)}</span></td>
        <td>
          <button class="clay-btn sm" data-edit="${u.id}">✏️</button>
          <button class="clay-btn sm danger" data-del="${u.id}">🗑</button>
        </td>
      </tr>`;
    }).join('');
    document.getElementById('view-content').innerHTML = `
      <div class="clay-card">
        <div class="row" style="justify-content:space-between">
          <div class="section-title" style="margin:0">Daftar Ustadz (${db.ustadz.length})</div>
          <div class="row">
            <button class="clay-btn ghost" id="btn-import">⬇ Import Excel</button>
            <button class="clay-btn primary" id="btn-add">+ Tambah Ustadz</button>
          </div>
        </div>
        <div class="table-wrap mt"><table class="clay-table">
          <thead><tr><th>Nama</th><th>Username Login</th><th>No HP</th><th>Email</th><th>Halaqah</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="7"><div class="empty">Belum ada ustadz.</div></td></tr>`}</tbody>
        </table></div>
      </div>`;
    document.getElementById('btn-add').onclick = () => ustadzForm();
    document.getElementById('btn-import').onclick = () => importUstadzDialog();
    document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => ustadzForm(b.dataset.edit));
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      UI.confirmDialog('Hapus Ustadz', 'Yakin hapus ustadz ini?', () => {
        const db = Store.get();
        db.ustadz = db.ustadz.filter(x => x.id !== b.dataset.del);
        db.users = db.users.filter(u => u.refId !== b.dataset.del);
        Store.save(); Store.log('Hapus ustadz'); UI.toast('Ustadz dihapus'); ustadz();
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
        <div style="flex:1">${UI.field('Halaqah', `<select class="clay-select" id="f-halaqah"><option value="">-</option>${UI.optionsFromList(db.halaqah.map(h => ({ v: h.nama, l: h.nama })), 'v', 'l', u ? u.halaqah : '')}</select>`)}</div>
      </div>
      <div class="row">
        <div style="flex:1">${UI.field('Username', `<input class="clay-input" id="f-uname" value="${u ? UI.esc(db.users.find(x => x.role === 'ustadz' && x.refId === id)?.username || '') : ''}" placeholder="Otomatis jika kosong">`)}</div>
        <div style="flex:1">${UI.field('Password', `<input class="clay-input" id="f-pass" value="${u ? '' : '12345678'}" placeholder="Kosongkan jika tidak diubah">`)}</div>
      </div>`;
    UI.openModal({
      title: id ? 'Edit Ustadz' : 'Tambah Ustadz', bodyHTML: body,
      actions: [
        { label: 'Batal', cls: 'ghost', onClick: (m, c) => c() },
        { label: 'Simpan', cls: 'primary', onClick: (m, c) => {
          const db = Store.get();
          const data = { nama: m.querySelector('#f-nama').value.trim(), noHp: m.querySelector('#f-hp').value.trim(), email: m.querySelector('#f-email').value.trim(), status: m.querySelector('#f-status').value, halaqah: m.querySelector('#f-halaqah').value };
          if (!data.nama) { UI.toast('Nama wajib', 'error'); return; }
          
          let uname = m.querySelector('#f-uname').value.trim();
          if (!uname) uname = (data.noHp && data.noHp.replace(/\D/g, '')) || data.nama.toLowerCase().replace(/\s/g, '');
          
          if (id) { 
            Object.assign(Store.findUstadz(id), data);
            const user = db.users.find(x => x.role === 'ustadz' && x.refId === id);
            if (user) {
              user.username = uname;
            }
            Store.log('Edit ustadz'); 
          }
          else {
            const nid = Store.uid('u'); const nu = { id: nid, ...data };
            db.ustadz.push(nu);
            const pass = m.querySelector('#f-pass').value.trim() || '12345678';
            db.users.push({ id: Store.uid('usr'), username: uname, password: pass, role: 'ustadz', refId: nid });
            Store.log('Tambah ustadz');
          }
          Store.save(); c(); UI.toast('Tersimpan', 'success'); ustadz();
        } }
      ]
    });
  }

  function importUstadzDialog() {
    const body = `<p class="muted">Kolom: Nama | No HP | Email | Status | Halaqah | Username | Password</p>
      <div class="row">
        <button class="clay-btn ghost" id="imp-template">⬇ Download Template Excel</button>
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
    Shared.setHeader('Manajemen Halaqah', 'Kelompok pembelajaran');
    const db = Store.get();
    const cards = db.halaqah.map(h => `<div class="clay-card pad-sm">
      <div class="row center" style="justify-content:space-between">
        <b>🏫 ${UI.esc(h.nama)}</b>
        <div><button class="clay-btn sm" data-edit="${h.id}">✏️</button> <button class="clay-btn sm danger" data-del="${h.id}">🗑</button></div>
      </div>
      <div class="muted" style="font-size:13px;margin-top:8px">
        Ustadz: ${UI.esc(h.ustadz)} · Level: ${UI.esc(h.level)}<br>
        ${h.jumlahSantri} santri · ${UI.esc(h.hari)} · ${UI.esc(h.jam)} · ${UI.esc(h.ruangan)}
      </div>
    </div>`).join('');
    document.getElementById('view-content').innerHTML = `
      <div class="row" style="justify-content:flex-end;margin-bottom:16px">
        <button class="clay-btn primary" id="btn-add">+ Tambah Halaqah</button>
      </div>
      <div class="grid cols-3">${cards || '<div class="empty">Belum ada halaqah.</div>'}</div>`;
    document.getElementById('btn-add').onclick = () => halaqahForm();
    document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => halaqahForm(b.dataset.edit));
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      UI.confirmDialog('Hapus Halaqah', 'Yakin hapus halaqah?', () => {
        const db = Store.get(); db.halaqah = db.halaqah.filter(x => x.id !== b.dataset.del); Store.save(); Store.log('Hapus halaqah'); UI.toast('Dihapus'); halaqah();
      });
    });
  }

  function halaqahForm(id) {
    const db = Store.get();
    const h = id ? db.halaqah.find(x => x.id === id) : null;
    const body = `
      ${UI.field('Nama Halaqah', `<input class="clay-input" id="f-nama" value="${h ? UI.esc(h.nama) : ''}">`)}
      <div class="row">
        <div style="flex:1">${UI.field('Ustadz', `<select class="clay-select" id="f-ustadz"><option value="">-</option>${UI.optionsFromList(db.ustadz.map(u => ({ v: u.nama, l: u.nama })), 'v', 'l', h ? h.ustadz : '')}</select>`)}</div>
        <div style="flex:1">${UI.field('Level', `<select class="clay-select" id="f-level">${UI.optionsFromList(db.levelTahfidz.map(l => ({ v: l, l })), 'v', 'l', h ? h.level : 'Ziyadah')}</select>`)}</div>
      </div>
      <div class="row">
        <div style="flex:1">${UI.field('Hari', `<input class="clay-input" id="f-hari" value="${h ? UI.esc(h.hari) : 'Senin-Rabu-Jumat'}">`)}</div>
        <div style="flex:1">${UI.field('Jam', `<input class="clay-input" id="f-jam" value="${h ? UI.esc(h.jam) : '07:00-08:30'}">`)}</div>
      </div>
      ${UI.field('Ruangan', `<input class="clay-input" id="f-ruang" value="${h ? UI.esc(h.ruangan) : ''}">`)}`;
    UI.openModal({
      title: id ? 'Edit Halaqah' : 'Tambah Halaqah', bodyHTML: body,
      actions: [
        { label: 'Batal', cls: 'ghost', onClick: (m, c) => c() },
        { label: 'Simpan', cls: 'primary', onClick: (m, c) => {
          const db = Store.get();
          const data = { nama: m.querySelector('#f-nama').value.trim(), ustadz: m.querySelector('#f-ustadz').value, level: m.querySelector('#f-level').value, hari: m.querySelector('#f-hari').value.trim(), jam: m.querySelector('#f-jam').value.trim(), ruangan: m.querySelector('#f-ruang').value.trim() };
          if (!data.nama) { UI.toast('Nama wajib', 'error'); return; }
          if (id) { Object.assign(db.halaqah.find(x => x.id === id), data); }
          else { db.halaqah.push({ id: Store.uid('h'), jumlahSantri: 0, ...data }); }
          Store.recalcHalaqah(); Store.save(); Store.log('Simpan halaqah'); c(); UI.toast('Tersimpan', 'success'); halaqah();
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
    document.getElementById('view-content').innerHTML = `
      <div class="clay-card">
        <label class="field-label">Pilih Santri</label>
        <select class="clay-select" id="pick-santri">${UI.optionsFromList(db.santri.map(s => ({ v: s.id, l: s.nama + ' (' + s.nis + ')' })), 'v', 'l', db.santri[0] && db.santri[0].id)}</select>
        <div id="riwayat-content" class="mt"></div>
      </div>`;
    const pick = document.getElementById('pick-santri');
    const render = () => { document.getElementById('riwayat-content').innerHTML = Shared.renderRiwayat(pick.value); };
    pick.onchange = render; render();
  }

  /* ---------------- Laporan ---------------- */
  function laporan() {
    Shared.shell('admin', nav('admin_laporan'), '');
    Shared.setHeader('Laporan', 'Filter & export');
    const db = Store.get();
    document.getElementById('view-content').innerHTML = `
      <div class="clay-card mb">
        <div class="section-title">🔎 Filter Laporan</div>
        <div class="row">
          <div style="flex:1">${UI.field('Bulan', `<input type="month" class="clay-input" id="f-bulan" value="${Store.todayStr().slice(0, 7)}">`)}</div>
          <div style="flex:1">${UI.field('Halaqah', `<select class="clay-select" id="f-halaqah"><option value="">Semua</option>${UI.optionsFromList(db.halaqah.map(h => ({ v: h.nama, l: h.nama })), 'v', 'l')}</select>`)}</div>
          <div style="flex:1">${UI.field('Level', `<select class="clay-select" id="f-level"><option value="">Semua</option>${UI.optionsFromList(db.levelTahfidz.map(l => ({ v: l, l })), 'v', 'l')}</select>`)}</div>
          <div style="flex:1">${UI.field('Kelas', `<select class="clay-select" id="f-kelas"><option value="">Semua</option>${UI.optionsFromList(db.kelas.map(k => ({ v: k, l: k })), 'v', 'l')}</select>`)}</div>
          <div style="flex:1">${UI.field('Status', `<select class="clay-select" id="f-status"><option value="">Semua</option><option>Aktif</option><option>Nonaktif</option></select>`)}</div>
        </div>
      </div>
      <div id="laporan-content"></div>`;
    const apply = () => {
      const f = { bulan: document.getElementById('f-bulan').value, halaqah: document.getElementById('f-halaqah').value, level: document.getElementById('f-level').value, kelas: document.getElementById('f-kelas').value, status: document.getElementById('f-status').value };
      document.getElementById('laporan-content').innerHTML = Shared.renderLaporan(f);
      Shared.bindLaporanExport();
    };
    ['f-bulan', 'f-halaqah', 'f-level', 'f-kelas', 'f-status'].forEach(id => document.getElementById(id).onchange = apply);
    apply();
  }

  /* ---------------- Notifikasi ---------------- */
  function notif() {
    Shared.shell('admin', nav('admin_notif'), '');
    Shared.setHeader('Notifikasi', 'Pemberitahuan sistem');
    const session = Store.getSession();
    document.getElementById('view-content').innerHTML = Shared.renderNotifikasi(session.userId);
  }

  /* ---------------- Settings ---------------- */
  function settings() {
    Shared.shell('admin', nav('admin_settings'), '');
    Shared.setHeader('Setting Umum', 'Konfigurasi lembaga');
    const db = Store.get(); const s = db.settings;
    document.getElementById('view-content').innerHTML = `
      <div class="clay-card">
        <div class="section-title">⚙️ Informasi Lembaga</div>
        ${UI.field('Nama Lembaga', `<input class="clay-input" id="s-nama" value="${UI.esc(s.namaLembaga)}">`)}
        ${UI.field('Alamat', `<input class="clay-input" id="s-alamat" value="${UI.esc(s.alamat)}">`)}
        <div class="row">
          <div style="flex:1">${UI.field('Tahun Ajaran', `<input class="clay-input" id="s-thn" value="${UI.esc(s.tahunAjaran)}">`)}</div>
          <div style="flex:1">${UI.field('Semester', `<select class="clay-select" id="s-sem"><option ${s.semester === 'Ganjil' ? 'selected' : ''}>Ganjil</option><option ${s.semester === 'Genap' ? 'selected' : ''}>Genap</option></select>`)}</div>
        </div>
        ${UI.field('Standar Penilaian', `<input class="clay-input" id="s-standar" value="${UI.esc(s.standarPenilaian)}">`)}
        ${UI.field('Jam Belajar', `<input class="clay-input" id="s-jam" value="${UI.esc(s.jamBelajar)}">`)}
        ${UI.field('Format Password Default Wali', `<input class="clay-input" id="s-pass" value="${UI.esc(s.defaultPasswordFormat)}">`)}
        <div class="row mt">
          <button class="clay-btn primary" id="btn-save">💾 Simpan</button>
          <button class="clay-btn ghost" id="btn-backup">💾 Backup Database</button>
          <button class="clay-btn danger" id="btn-reset">♻ Reset Data Demo</button>
        </div>
      </div>`;
    document.getElementById('btn-save').onclick = () => {
      const db = Store.get();
      db.settings.namaLembaga = document.getElementById('s-nama').value.trim();
      db.settings.alamat = document.getElementById('s-alamat').value.trim();
      db.settings.tahunAjaran = document.getElementById('s-thn').value.trim();
      db.settings.semester = document.getElementById('s-sem').value;
      db.settings.standarPenilaian = document.getElementById('s-standar').value.trim();
      db.settings.jamBelajar = document.getElementById('s-jam').value.trim();
      db.settings.defaultPasswordFormat = document.getElementById('s-pass').value.trim() || '12345678';
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
  }

  return { nav, dashboard, santri, ustadz, halaqah, master, riwayat, laporan, notif, settings, importSantriDialog };
})();
