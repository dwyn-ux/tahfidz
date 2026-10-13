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
      { view: 'ustadz_absensi', label: 'Absensi', active: active === 'ustadz_absensi' },
      { view: 'ustadz_talim', label: 'Ta’lim Malam', active: active === 'ustadz_talim' },
      { view: 'ustadz_pembelajaran', label: 'Pembelajaran', active: active === 'ustadz_pembelajaran' },
      { view: 'admin_riwayat', label: 'Riwayat', active: active === 'admin_riwayat' },
      { view: 'admin_laporan', label: 'Laporan', active: active === 'admin_laporan' },
      { view: 'admin_rekap_setoran', label: 'Rekap Setoran', active: active === 'admin_rekap_setoran' },
      { view: 'admin_notif', label: 'Notifikasi', active: active === 'admin_notif' },
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
    const hadirSubuh = db.kehadiran.filter(k => k.tanggal.startsWith(bulanIni) && k.sesi === 'Subuh' && k.status === 'Hadir').length;
    const hadirMaghrib = db.kehadiran.filter(k => k.tanggal.startsWith(bulanIni) && k.sesi === 'Maghrib' && k.status === 'Hadir').length;
    const hadirIsya = db.kehadiran.filter(k => k.tanggal.startsWith(bulanIni) && k.sesi === 'Isya' && k.status === 'Hadir').length;
    const hadirTalim = db.kehadiran.filter(k => k.tanggal.startsWith(bulanIni) && k.sesi === 'Ta’lim Malam' && k.status === 'Hadir').length;

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
        ${Shared.statCard(Shared.ICONS.sunset, hadirMaghrib, 'Kehadiran Maghrib', '#22C55E')}
        ${Shared.statCard(Shared.ICONS.moon, hadirIsya, 'Kehadiran Isya', '#22C55E')}
        ${Shared.statCard(Shared.ICONS.book, hadirTalim, 'Kehadiran Ta’lim Malam', '#22C55E')}
      </div>`;

    // progress hafalan per halaqah (avg pages)
    const halaqahData = db.halaqah.map(h => {
      const ss = db.santri.filter(s => Store.santriHasHalaqah(s, h));
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
    const imp = document.getElementById('qa-import'); if (imp) imp.onclick = () => importSantriDialog();
  }

  /* ---------------- Santri ---------------- */
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
        <td>${UI.esc(Store.programSummaryForSantri(s))}</td>
        <td>${UI.esc(Store.halaqahSummaryForSantri(s))}</td>
        <td>${UI.esc(s.kelas)}</td>
        <td><span class="badge ${s.status === 'Aktif' ? 'green' : 'gray'}">${UI.esc(s.status)}</span></td>
        <td><code>${UI.esc(username)}</code></td>
        <td>
          <button class="clay-btn sm" data-edit="${s.id}">✏️</button>
          <button class="clay-btn sm danger" data-del="${s.id}">🗑</button>
          <button class="clay-btn sm secondary" data-reset="${s.waliId}">🔑 Reset</button>
        </td>
      </tr>`;
    }).join('');
    document.getElementById('view-content').innerHTML = `
      <div class="clay-card">
        <div class="row" style="justify-content:space-between">
          <div class="section-title" style="margin:0">Daftar Santri (${db.santri.length})</div>
          <div class="row">
            <button class="clay-btn ghost" id="btn-gen-bulk">⚙️ Generate Username</button>
            <button class="clay-btn ghost" id="btn-import">Import Excel</button>
            <button class="clay-btn primary" id="btn-add">+ Tambah Santri</button>
          </div>
        </div>
        <div class="row" style="margin-top:12px">
          <input class="clay-input" id="search-santri" type="text" placeholder="Cari santri..." autocomplete="off" />
        </div>
        <div class="table-wrap mt"><table class="clay-table">
          <thead><tr><th>Nama</th><th>JK</th><th>Program Aktif</th><th>Halaqah</th><th>Kelas</th><th>Status</th><th>Username Login</th><th>Aksi</th></tr></thead>
          <tbody id="santri-table-body">${rows || `<tr><td colspan="8"><div class="empty">Belum ada santri.</div></td></tr>`}</tbody>
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
      searchInput.oninput = () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          const term = searchInput.value.toLowerCase().trim();
          const rows = term ? db.santri.filter(s =>
            s.nama.toLowerCase().includes(term) ||
            (s.nis && s.nis.toString().includes(term)) ||
            Store.programSummaryForSantri(s).toLowerCase().includes(term) ||
            Store.halaqahSummaryForSantri(s).toLowerCase().includes(term) ||
            s.kelas.toLowerCase().includes(term) ||
            (s.level || '').toLowerCase().includes(term)
          ) : db.santri;
          const newRows = rows.map(s => {
            const waliUser = db.users.find(u => u.role === 'wali' && u.refId === s.waliId);
            const username = waliUser ? waliUser.username : '-';
            return `<tr>
              <td><b>${UI.esc(s.nama)}</b><div class="muted">${UI.esc(s.nis)}</div></td>
              <td>${UI.esc(s.jk)}</td>
               <td>${UI.esc(Store.programSummaryForSantri(s))}</td>
               <td>${UI.esc(Store.halaqahSummaryForSantri(s))}</td>
              <td>${UI.esc(s.kelas)}</td>
              <td><span class="badge ${s.status === 'Aktif' ? 'green' : 'gray'}">${UI.esc(s.status)}</span></td>
              <td><code>${UI.esc(username)}</code></td>
              <td>
                <button class="clay-btn sm" data-edit="${s.id}">✏️</button>
                <button class="clay-btn sm danger" data-del="${s.id}">🗑</button>
                <button class="clay-btn sm secondary" data-reset="${s.waliId}">🔑 Reset</button>
              </td>
            </tr>`;
          }).join('');
          document.getElementById('santri-table-body').innerHTML = newRows || `<tr><td colspan="8"><div class="empty">Tidak ada santri yang sesuai.</div></td></tr>`;
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
    }
  }

  function santriForm(id) {
    const db = Store.get();
    const s = id ? Store.findSantri(id) : null;
    const allPrograms = db.levelTahfidz || ['Tahsin', 'Ziyadah', 'Mutqin'];
    const activePrograms = s ? Store.activeProgramsForSantri(s) : [(s && s.level) || 'Tahsin'];
    const primaryProgram = s && activePrograms.includes(s.level) ? s.level : activePrograms[0];
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
        <div style="flex:1">${UI.field('Kelas', `<select class="clay-select" id="f-kelas">${UI.optionsFromList(db.kelas.map(k => ({ v: k, l: k })), 'v', 'l', s ? s.kelas : db.kelas[0])}</select>`)}</div>
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
            kelas: m.querySelector('#f-kelas').value
          };
          if (!data.nama) { UI.toast('Nama wajib diisi', 'error'); return; }
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
      <p class="muted">Kolom: Nama | NIS | JK (L/P) | Wali | HP Wali | Level | Halaqah</p>
      <div class="row">
        <button class="clay-btn ghost" id="imp-template">Download Template Excel</button>
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
      const halaqahNames = db.halaqah.filter(h => Store.halaqahHasUstadz(h, u)).map(h => h.nama);
      return `<tr>
        <td><b>${UI.esc(u.nama)}</b></td>
        <td><code>${UI.esc(uname)}</code></td>
        <td>${UI.esc(u.noHp)}</td>
        <td>${UI.esc(u.email)}</td>
        <td>${UI.esc(halaqahNames.join(', ') || u.halaqah || '-')}</td>
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
            <button class="clay-btn ghost" id="btn-import">Import Excel</button>
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
      <td>${UI.esc(s.kelas || '-')}</td>
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
        ${h ? `<div><button class="clay-btn sm" data-edit-halaqah="${UI.esc(h.id)}">✏️ Edit Halaqah</button> <button class="clay-btn sm danger" data-del="${UI.esc(h.id)}">🗑</button></div>` : ''}
      </div>
      <div class="table-wrap"><table class="clay-table">
        <thead><tr><th class="center">No</th><th>Santri</th><th>Kelas</th><th>Jenis Setoran</th><th>Pindah ke Halaqah</th><th class="center">Aksi</th></tr></thead>
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
        <input class="clay-input" id="riwayat-search" type="text" placeholder="Ketik nama atau NIS santri..." autocomplete="off" />
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
    
    searchInput.oninput = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(updateSantriList, 150);
    };
    
    updateSantriList();
  }

  /* ---------------- Laporan ---------------- */
  function laporan() {
    Shared.shell('admin', nav('admin_laporan'), '');
    Shared.setHeader('Laporan', 'Filter & export');
    const db = Store.get();
    document.getElementById('view-content').innerHTML = `
      <div class="clay-card mb">
        <div class="section-title"> Filter Laporan</div>
        <div class="row">
          <div style="flex:1">${UI.field('Bulan', `<input type="month" class="clay-input" id="f-bulan" value="${Store.todayStr().slice(0, 7)}">`)}</div>
          <div style="flex:1">${UI.field('Halaqah', `<select class="clay-select" id="f-halaqah"><option value="">Semua</option>${UI.optionsFromList(db.halaqah.map(h => ({ v: h.nama, l: halaqahOptionLabel(h) })), 'v', 'l')}</select>`)}</div>
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

  /* ---------------- Rekap Setoran Mingguan ---------------- */
  function rekapSetoran() {
    Shared.shell('admin', nav('admin_rekap_setoran'), '');
    Shared.setHeader('Rekap Setoran Mingguan', 'Status setoran per santri dan per hari');
    const db = Store.get();
    document.getElementById('view-content').innerHTML = `
      <div class="clay-card mb">
        <div class="row">
          <div style="flex:1">${UI.field('Pekan (mulai Senin)', `<input type="date" class="clay-input" id="f-pekan" value="${Shared.mondayOf(Store.todayStr())}">`)}</div>
          <div style="flex:1">${UI.field('Ustadz', `<select class="clay-select" id="f-ustadz"><option value="">Semua Ustadz</option>${UI.optionsFromList(db.ustadz.slice().sort((a, b) => a.nama.localeCompare(b.nama, 'id')).map(u => ({ v: u.id, l: u.nama })), 'v', 'l')}</select>`)}</div>
        </div>
      </div>
      <div id="rekap-setoran-content"></div>`;
    const apply = () => {
      const weekInput = document.getElementById('f-pekan');
      weekInput.value = Shared.mondayOf(weekInput.value);
      document.getElementById('rekap-setoran-content').innerHTML = Shared.renderRekapSetoranMingguan({
        week: weekInput.value,
        ustadzId: document.getElementById('f-ustadz').value
      });
    };
    document.getElementById('f-pekan').onchange = apply;
    document.getElementById('f-ustadz').onchange = apply;
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

  /* ---------------- Settings ---------------- */
  function settings() {
    Shared.shell('admin', nav('admin_settings'), '');
    Shared.setHeader('Setting Umum', 'Konfigurasi lembaga');
    const db = Store.get(); const s = db.settings;
    document.getElementById('view-content').innerHTML = `
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
      <div class="clay-card mb">
        <div class="section-title"> WhatsApp Otomatis (ke Wali)</div>
        <div class="muted" style="font-size:12px;margin-bottom:10px">
          Hubungkan ke WA Bridge (Node) agar laporan capaian terkirim otomatis ke WhatsApp wali.
          <br>Bridge: <code>npm install && npm start</code> di folder <code>wa-bridge</code>, lalu scan QR sekali dari <code>/qr</code>.
        </div>
        <div class="row">
          <div style="flex:1">${UI.field('URL Bridge (contoh: https://wa.example.com:3210)', `<input class="clay-input" id="s-wa-url" value="${UI.esc(s.waBridgeUrl)}" placeholder="https://...:3210">`)}</div>
          <div style="flex:1">${UI.field('Key Bridge (X-WA-Key)', `<input class="clay-input" id="s-wa-key" value="${UI.esc(s.waBridgeKey)}" placeholder="nilai acak dari WA_KEY di server bridge">`)}</div>
        </div>
        <div class="row" style="margin-top:10px">
          <label style="flex:1;display:flex;align-items:center;gap:8px;margin-top:12px">
            <button class="clay-toggle ${s.waAuto ? 'on' : ''}" id="s-wa-auto"></button>
            <span id="s-wa-auto-label" style="font-size:13px">${s.waAuto ? 'WhatsApp Otomatis: Aktif' : 'WhatsApp Otomatis: Nonaktif'}</span>
          </label>
        </div>
        <div class="row mt">
          <button class="clay-btn ghost" id="btn-wa-status">Cek Status</button>
          <button class="clay-btn ghost" id="btn-wa-test">Kirim Tes</button>
        </div>
        <div id="wa-status" class="mt" style="font-size:13px"></div>
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
      <div class="clay-card">
        <div class="row">
          <button class="clay-btn primary" id="btn-save"> Simpan</button>
          <button class="clay-btn ghost" id="btn-backup"> Backup Database</button>
          <button class="clay-btn danger" id="btn-reset">Reset Data Demo</button>
        </div>
      </div>`;
    document.getElementById('s-setoran-multi').onclick = function() {
      this.classList.toggle('on');
      const on = this.classList.contains('on');
      document.getElementById('s-setoran-label').textContent = on ? 'Berkali-kali per hari' : 'Sekali sehari';
    };

    ['s-notif-active', 's-notif-wali', 's-notif-ustadz', 's-notif-absensi-wali', 's-wa-auto'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.onclick = function() {
        this.classList.toggle('on');
        const on = this.classList.contains('on');
        const label = document.getElementById(id + '-label');
        if (id === 's-notif-active') label.textContent = on ? 'Notifikasi Aktif' : 'Notifikasi Nonaktif';
        else if (id === 's-notif-wali') label.textContent = on ? 'Kirim ke Wali: Ya' : 'Kirim ke Wali: Tidak';
        else if (id === 's-notif-ustadz') label.textContent = on ? 'Kirim ke Ustadz: Ya' : 'Kirim ke Ustadz: Tidak';
        else if (id === 's-notif-absensi-wali') label.textContent = on ? 'Rekap absensi ke Wali: Aktif' : 'Rekap absensi ke Wali: Nonaktif';
        else if (id === 's-wa-auto') label.textContent = on ? 'WhatsApp Otomatis: Aktif' : 'WhatsApp Otomatis: Nonaktif';
      };
    });

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
    function waFetch(path, opts) {
      return fetch(waUrlEl.value.trim().replace(/\/$/, '') + path, Object.assign({ headers: { 'X-WA-Key': waKeyEl.value.trim() || 'tahfidz-wa-bridge' } }, opts || {}));
    }
    async function waFetchJson(path, opts) {
      const r = await waFetch(path, opts);
      const text = await r.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
      return { ok: r.ok, status: r.status, data, raw: text };
    }
    document.getElementById('btn-wa-status').onclick = async () => {
      waStatusEl.innerHTML = '<span class="muted">Memeriksa...</span>';
      if (!waUrlEl.value.trim()) { waStatusEl.innerHTML = '<span style="color:var(--danger)">URL Bridge kosong.</span>'; return; }
      try {
        const { ok, status, data, raw } = await waFetchJson('/status');
        if (!ok || !data) {
          const hint = /<!DOCTYPE|html/i.test(raw) ? ' — URL salah atau bridge tidak jalan (server balas halaman web, bukan JSON)' : (raw ? ' — ' + raw.slice(0, 80) : '');
          waStatusEl.innerHTML = '<span style="color:var(--danger)">Tidak bisa akses bridge (HTTP ' + status + ')' + UI.esc(hint) + '.</span>';
          return;
        }
        waStatusEl.innerHTML = data.connected
          ? '<span style="color:var(--success)">✓ Terhubung' + (data.phone ? ' (' + UI.esc(data.phone) + ')' : '') + '</span>'
          : '<span style="color:var(--warn)">Belum terhubung' + (data.qr ? ' — ada QR menunggu scan' : '') + '.</span> ' +
            '<a href="' + UI.esc(UI.safeUrl(waUrlEl.value.trim().replace(/\/$/, ''))) + '/qr" target="_blank" style="color:var(--primary)">Buka QR</a>';
      } catch (e) {
        waStatusEl.innerHTML = '<span style="color:var(--danger)">Tidak bisa akses bridge: ' + UI.esc(e.message) + '</span>';
      }
    };
    document.getElementById('btn-wa-test').onclick = async () => {
      const nohp = prompt('Nomor WhatsApp tujuan tes (contoh: 0812xxx):');
      if (!nohp) return;
      waStatusEl.innerHTML = '<span class="muted">Mengirim...</span>';
      const msg = '🔔 Tes WhatsApp Bridge Tahfidzku. Pesan laporan capaian akan terkirim otomatis ke wali.';
      try {
        const { ok, status, data, raw } = await waFetchJson('/send', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-WA-Key': waKeyEl.value.trim() || 'tahfidz-wa-bridge' }, body: JSON.stringify({ to: nohp, message: msg }) });
        const detail = ok ? ((data && data.error) || 'Pesan masuk antrian.') : ((data && data.error) || ('HTTP ' + status + (/<!DOCTYPE|html/i.test(raw) ? ' — URL salah / bridge tidak jalan' : '')));
        Store.waLog({ to: nohp, status: ok ? 'queued' : 'error', detail, message: msg });
        waStatusEl.innerHTML = ok ? '<span style="color:var(--success)">✓ ' + UI.esc(detail) + '</span>' : '<span style="color:var(--danger)">' + UI.esc(detail) + '</span>';
      } catch (e) {
        Store.waLog({ to: nohp, status: 'error', detail: 'Fetch gagal: ' + (e && e.message || e), message: msg });
        waStatusEl.innerHTML = '<span style="color:var(--danger)">Gagal: ' + UI.esc(e.message) + '</span>';
      }
    };

    function renderWaLog() {
      const el = document.getElementById('wa-log');
      if (!el) return;
      const logs = (Store.get().logWa || []).slice(0, 50);
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
    }
    renderWaLog();
    const waLogTimer = setInterval(() => {
      if (!document.getElementById('wa-log')) { clearInterval(waLogTimer); return; }
      renderWaLog();
    }, 5000);
    const waLogBtn = document.getElementById('btn-wa-log-refresh');
    if (waLogBtn) waLogBtn.onclick = renderWaLog;
  }

  return { nav, dashboard, santri, ustadz, halaqah, master, riwayat, laporan, rekapSetoran, notif, settings, importSantriDialog };
})();
