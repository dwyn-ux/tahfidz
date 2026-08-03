/* ============================================================
   Tahfidzku — Ustadz Views
   ============================================================ */
const Ustadz = (() => {

  function nav(active) {
    return [
      { view: 'ustadz_dashboard', label: 'Dashboard', active: active === 'ustadz_dashboard' },
      { view: 'ustadz_absensi', label: 'Absensi', active: active === 'ustadz_absensi' },
      { view: 'ustadz_pembelajaran', label: 'Pembelajaran', active: active === 'ustadz_pembelajaran' },
      { view: 'ustadz_riwayat', label: 'Riwayat', active: active === 'ustadz_riwayat' },
      { view: 'ustadz_laporan', label: 'Laporan', active: active === 'ustadz_laporan' },
      { view: 'ustadz_notif', label: 'Notifikasi', active: active === 'ustadz_notif' },
      { view: 'quran', label: 'Al-Qur\'an', active: active === 'quran' }
    ];
  }

  // _scope: 'saya' (ustadz hanya halaqahnya) atau 'all' (admin lihat semua)
  let _scope = 'saya';

  // Tentukan konteks berdasarkan session: admin membuka view ini untuk semua data.
  function ctx() {
    const s = Store.getSession();
    return (s && s.role === 'admin') ? { role: 'admin', scope: 'all' } : { role: 'ustadz', scope: 'saya' };
  }

  // Kirim laporan WA ke wali; toast hasil (terkirim/gagal) tanpa nunggu simpan.
  function waReport(santriId, message) {
    return Store.waSendWali(santriId, message).then(ok => {
      UI.toast(ok ? 'WA terkirim ke wali ✓' : 'WA gagal dikirim ke wali (cek Log WhatsApp di Admin)', ok ? 'success' : 'error');
    });
  }

  function myHalaqah() {
    if (_scope === 'all') return null; // admin: tidak terikat 1 halaqah
    const session = Store.getSession();
    const u = Store.findUstadz(session.refId);
    return u ? u.halaqah : null;
  }
  function mySantri() {
    const db = Store.get();
    if (_scope === 'all') return db.santri; // admin: semua santri
    const h = myHalaqah();
    return h ? db.santri.filter(s => s.halaqah === h) : [];
  }
  // ustadzId yang dicatat: ustadz session, atau ustadz halaqah santri (jika admin)
  function ustadzIdFor(santriId) {
    const session = Store.getSession();
    if (session && session.role === 'ustadz') return session.refId;
    const s = Store.findSantri(santriId);
    if (!s) return null;
    const h = Store.findHalaqahByName(s.halaqah);
    if (!h) return null;
    const u = Store.findUstadzByName(h.ustadz);
    return u ? u.id : null;
  }

  /* ---------------- Dashboard ---------------- */
  function dashboard() {
    const c = ctx(); _scope = c.scope;
    Store.checkSetoranTerlewat();
    Shared.shell(c.role, nav('ustadz_dashboard'), '');
    Shared.setHeader('Dashboard Ustadz', myHalaqah() || '');
    const db = Store.get();
    const santri = mySantri();
    const t = Store.todayStr();
    const sesiStats = SESI.map(s => {
      const h = db.kehadiran.filter(k => k.tanggal === t && k.sesi === s && santri.some(x => x.id === k.santriId) && k.status === 'Hadir').length;
      const i = db.kehadiran.filter(k => k.tanggal === t && k.sesi === s && santri.some(x => x.id === k.santriId) && k.status === 'Izin').length;
      const b = santri.length - (db.kehadiran.filter(k => k.tanggal === t && k.sesi === s && santri.some(x => x.id === k.santriId)).length);
      return { s, h, i, b };
    });
    const bulanIni = Store.todayStr().slice(0, 7);
    const kehadiranBulan = santri.map(s => {
      const k = Store.kehadiranBulan(s.id, bulanIni);
      return {
        subuh: k.filter(k => k.sesi === 'Subuh' && k.status === 'Hadir').length,
        maghrib: k.filter(k => k.sesi === 'Maghrib' && k.status === 'Hadir').length,
        isya: k.filter(k => k.sesi === 'Isya' && k.status === 'Hadir').length
      };
    });
    const totalSubuh = kehadiranBulan.reduce((a, b) => a + b.subuh, 0);
    const totalMaghrib = kehadiranBulan.reduce((a, b) => a + b.maghrib, 0);
    const totalIsya = kehadiranBulan.reduce((a, b) => a + b.isya, 0);

    document.getElementById('view-content').innerHTML = `
      <div class="grid kpi">
        ${Shared.statCard(Shared.ICONS.users, santri.length, 'Santri Diampu', '#16A34A')}
        ${sesiStats.map(st => Shared.statCard(
          st.s === 'Subuh' ? Shared.ICONS.sun : st.s === 'Maghrib' ? Shared.ICONS.sunset : Shared.ICONS.moon,
          st.h + '/' + santri.length + ' Hadir', st.s, '#22C55E')).join('')}
      </div>
      <div class="grid kpi mt">
        ${Shared.statCard(Shared.ICONS.sun, totalSubuh, 'Kehadiran Subuh (Bulan Ini)', '#22C55E')}
        ${Shared.statCard(Shared.ICONS.sunset, totalMaghrib, 'Kehadiran Maghrib (Bulan Ini)', '#22C55E')}
        ${Shared.statCard(Shared.ICONS.moon, totalIsya, 'Kehadiran Isya (Bulan Ini)', '#22C55E')}
      </div>
      <div class="grid cols-2 mt">
        <div class="clay-card">
          <div class="section-title">Shortcut</div>
          <div class="row">
            <button class="clay-btn primary" data-go="ustadz_absensi">Absensi</button>
            <button class="clay-btn secondary" data-go="ustadz_pembelajaran"> Pembelajaran</button>
          </div>
        </div>
        <div class="clay-card">
          <div class="section-title"> Daftar Santri</div>
          ${santri.map(s => {
            const h = Store.totalHafalanSantri(s.id);
            return `<div class="row center" style="justify-content:space-between;padding:6px 0"><span>${UI.esc(s.nama)} <span class="muted" style="font-size:12px">(${UI.esc(s.level)})</span></span><span class="badge green">${h ? formatHafalan(h) : '-'}</span></div>`;
          }).join('') || '<div class="empty">Tidak ada santri.</div>'}
        </div>
      </div>`;
    document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => App.navigate(b.dataset.go));
  }

  /* ---------------- Absensi (multi-sesi) ---------------- */
  const SESI = ['Subuh', 'Maghrib', 'Isya'];

  function absensi() {
    const c = ctx(); _scope = c.scope;
    const navItems = (c.role === 'admin') ? Admin.nav('ustadz_absensi') : nav('ustadz_absensi');
    Shared.shell(c.role, navItems, '');
    Shared.setHeader('Absensi', 'Default: Hadir (klik yang berubah)');
    const db = Store.get();
    const santri = mySantri();
    const t = Store.todayStr();
    let sesiAktif = 'Subuh';

    function renderAbsensi() {
      const existing = {};
      db.kehadiran.filter(k => k.tanggal === t && k.sesi === sesiAktif && santri.some(s => s.id === k.santriId)).forEach(k => existing[k.santriId] = k.status);

      const rows = santri.map(s => {
        const cur = existing[s.id] || 'Hadir';
        return `<tr data-id="${s.id}">
          <td><b>${UI.esc(s.nama)}</b></td>
          <td>
            <div class="row" style="gap:6px">
              <button class="clay-btn sm ${cur === 'Hadir' ? 'primary' : 'ghost'}" data-st="Hadir"> Hadir</button>
              <button class="clay-btn sm ${cur === 'Izin' ? '' : 'ghost'}" data-st="Izin" style="${cur === 'Izin' ? 'background:#FACC15;color:#000' : ''}"> Izin</button>
              <button class="clay-btn sm ${cur === 'Sakit' ? 'secondary' : 'ghost'}" data-st="Sakit"> Sakit</button>
              <button class="clay-btn sm ${cur === 'Alfa' ? 'danger' : 'ghost'}" data-st="Alfa"> Alfa</button>
            </div>
          </td>
          <td><span class="badge ${cur === 'Hadir' ? 'green' : cur === 'Izin' ? 'warn' : cur === 'Sakit' ? 'blue' : 'danger'}">${cur}</span></td>
        </tr>`;
      }).join('');

      document.getElementById('view-content').innerHTML = `
        <div class="clay-card">
          <div class="row" style="justify-content:space-between">
            <div class="section-title" style="margin:0">Absensi ${UI.fmtDate(t)}</div>
            <button class="clay-btn primary" id="btn-save"> Simpan Absensi</button>
          </div>
          <div class="row mb" style="margin-top:12px">
            <span class="muted" style="font-size:13px">Sesi:</span>
            ${SESI.map(s => `<button class="pill ${s === sesiAktif ? 'active' : ''}" data-sesi="${s}">${s === 'Subuh' ? '' : s === 'Maghrib' ? '' : ''} ${s}</button>`).join('')}
          </div>
          <div class="table-wrap mt"><table class="clay-table">
            <thead><tr><th>Santri</th><th>Status</th><th></th></tr></thead>
            <tbody id="abs-body">${rows || `<tr><td colspan="3"><div class="empty">Tidak ada santri di halaqah Anda.</div></td></tr>`}</tbody>
          </table></div>
        </div>`;

      document.querySelectorAll('[data-sesi]').forEach(b => b.onclick = () => {
        sesiAktif = b.dataset.sesi;
        renderAbsensi();
      });

      const state = {};
      santri.forEach(s => state[s.id] = existing[s.id] || 'Hadir');
      document.querySelectorAll('#abs-body tr[data-id]').forEach(tr => {
        const id = tr.dataset.id;
        tr.querySelectorAll('button[data-st]').forEach(btn => {
          btn.onclick = () => {
            state[id] = btn.dataset.st;
            tr.querySelectorAll('button[data-st]').forEach(b => {
              b.className = 'clay-btn sm ghost';
              if (b.dataset.st === 'Izin') b.style = '';
            });
            if (btn.dataset.st === 'Hadir') btn.className = 'clay-btn sm primary';
            if (btn.dataset.st === 'Izin') { btn.className = 'clay-btn sm'; btn.style = 'background:#FACC15;color:#000'; }
            if (btn.dataset.st === 'Sakit') btn.className = 'clay-btn sm secondary';
            if (btn.dataset.st === 'Alfa') btn.className = 'clay-btn sm danger';
            const badge = tr.querySelector('td:last-child span');
            badge.className = 'badge ' + (btn.dataset.st === 'Hadir' ? 'green' : btn.dataset.st === 'Izin' ? 'warn' : btn.dataset.st === 'Sakit' ? 'blue' : 'danger');
            badge.textContent = btn.dataset.st;
          };
        });
      });

      document.getElementById('btn-save').onclick = async () => {
        const db = Store.get();
        const t = Store.todayStr();
        db.kehadiran = db.kehadiran.filter(k => !(k.tanggal === t && k.sesi === sesiAktif && santri.some(s => s.id === k.santriId)));
        Object.keys(state).forEach(sid => {
          const sObj = Store.findSantri(sid);
          const hObj = sObj ? Store.findHalaqahByName(sObj.halaqah) : null;
          db.kehadiran.push({ id: Store.uid('k'), santriId: sid, halaqahId: hObj ? hObj.id : (myHalaqah() || ''), tanggal: t, sesi: sesiAktif, status: state[sid] });
          if (state[sid] !== 'Hadir') {
            const s = Store.findSantri(sid);
            if (s) { const wUser = db.users.find(u => u.role === 'wali' && u.refId === s.waliId); if (wUser) Store.addNotif(wUser.id, 'wali', s.nama + ' ' + sesiAktif + ' (' + state[sid] + ')'); }
          }
        });
        await Store.save(); Store.log('Input absensi ' + sesiAktif); UI.toast('Absensi ' + sesiAktif + ' tersimpan', 'success');
      };
    }
    renderAbsensi();
  }

  /* ---------------- Pembelajaran ---------------- */
  function pembelajaran() {
    const c = ctx(); _scope = c.scope;
    const navItems = (c.role === 'admin') ? Admin.nav('ustadz_pembelajaran') : nav('ustadz_pembelajaran');
    Shared.shell(c.role, navItems, '');
    Shared.setHeader('Pembelajaran', 'Tahsin · Ziyadah · Mutqin · Umum');
    document.getElementById('view-content').innerHTML = `
      <div class="pill-tabs" id="tabs">
        <button class="pill active" data-tab="tahsin"> Tahsin</button>
        <button class="pill" data-tab="ziyadah"> Ziyadah</button>
        <button class="pill" data-tab="mutqin"> Mutqin</button>
        <button class="pill" data-tab="umum"> Umum</button>
      </div>
      <div id="tab-content"></div>`;
    const tabs = document.getElementById('tabs');
    const render = (tab) => {
      tabs.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p.dataset.tab === tab));
      if (tab === 'tahsin') renderTahsin();
      else if (tab === 'ziyadah') renderZiyadah();
      else if (tab === 'mutqin') renderMutqin();
      else renderUmum();
    };
    tabs.querySelectorAll('.pill').forEach(p => p.onclick = () => render(p.dataset.tab));
    render('tahsin');
  }

  function modeSelector(onChange) {
    return `<div class="row mb">
      <span class="muted" style="font-size:13px">Mode:</span>
      <button class="pill active" data-mode="saya"> Halaqah Saya</button>
      <button class="pill" data-mode="umum">🌐 Halaqah Umum</button>
    </div>`;
  }
  function bindMode(container, getSantriFn, rerender) {
    container.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
      container.querySelectorAll('[data-mode]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      rerender(b.dataset.mode);
    });
  }

  /* ----- Tahsin ----- */
  function renderTahsin() {
    const db = Store.get();
    const santri = mySantri().filter(s => s.level === 'Tahsin');
    const rows = santri.map(s => {
      const rec = db.tahsin.filter(t => t.santriId === s.id).sort((a, b) => b.tanggal.localeCompare(a.tanggal))[0];
      return `<tr><td><b>${UI.esc(s.nama)}</b></td><td>${rec ? 'Hal ' + rec.halAwal + '-' + rec.halAkhir : '<span class="muted">-</span>'}</td><td>${rec ? rec.nilai : '-'}</td><td><button class="clay-btn sm primary" data-input="${s.id}">+ Input</button></td></tr>`;
    }).join('');
    document.getElementById('tab-content').innerHTML = `
      <div class="clay-card">
        <div class="section-title"> Input Tahsin</div>
        <div class="table-wrap"><table class="clay-table">
          <thead><tr><th>Santri</th><th>Terakhir</th><th>Nilai</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4"><div class="empty">Tidak ada santri.</div></td></tr>'}</tbody>
        </table></div>
      </div>`;
    document.querySelectorAll('[data-input]').forEach(b => b.onclick = () => tahsinForm(b.dataset.input));
  }

  function bindAyatMax(surahInputId, ayatInputIds) {
    const surahInput = document.getElementById(surahInputId);
    if (!surahInput) return;
    const parseSurah = (v) => { const m = String(v).match(/^\d+/); return m ? Number(m[0]) : 0; };
    const update = () => {
      const n = parseSurah(surahInput.value);
      const s = getSurah(n);
      const maxAyat = s ? s.ayahs : 0;
      ayatInputIds.split(',').forEach(id => {
        const el = document.getElementById(id.trim());
        if (el) { el.max = maxAyat; if (maxAyat > 0 && Number(el.value) > maxAyat) el.value = maxAyat; }
      });
    };
    surahInput.oninput = update;
  }

  // Estimasi halaman global (1..604) untuk satu posisi surah:ayat,
  // lewat interpolasi linier di dalam rentang halaman surah.
  function pageForAyah(sn, ayah) {
    const s = getSurah(sn);
    if (!s) return null;
    const nxt = getSurah(sn + 1);
    const endPage = nxt ? nxt.page - 1 : 604;
    const span = Math.max(1, endPage - s.page + 1);
    const ratio = Math.min(1, Math.max(0, (Number(ayah) - 1) / s.ayahs));
    return Math.min(endPage, s.page + Math.floor(ratio * span));
  }

  // Himpunan halaman yang pernah disetorkan santri (ziyadahHafalan + mutqin).
  function setoranPages(santriId) {
    const db = Store.get();
    const pages = new Set();
    const add = (rec) => {
      const p1 = pageForAyah(rec.sAwal, rec.aAwal);
      const p2 = pageForAyah(rec.sAkhir, rec.aAkhir);
      if (!p1 || !p2) return;
      const lo = Math.min(p1, p2), hi = Math.max(p1, p2);
      for (let p = lo; p <= hi; p++) pages.add(p);
    };
    db.ziyadahHafalan.filter(r => r.santriId === santriId).forEach(add);
    db.mutqin.filter(r => r.santriId === santriId).forEach(add);
    return pages;
  }

  // Peta hafalan ala GitHub: 30 baris juz x 20 kolom halaman.
  function hafalanMapHTML(santriId) {
    const covered = setoranPages(santriId);
    let html = '';
    for (let juz = 1; juz <= 30; juz++) {
      html += '<div style="display:flex;align-items:center;gap:3px;margin-bottom:2px">' +
        '<span style="width:38px;font-size:10px;color:var(--muted)">Juz ' + juz + '</span>';
      for (let pg = 1; pg <= 20; pg++) {
        const g = (juz - 1) * 20 + pg;
        const ok = covered.has(g);
        html += '<span title="Juz ' + juz + ' · hal. ' + pg + (ok ? ' · sudah disetor' : ' · belum') + '" ' +
          'style="width:11px;height:11px;border-radius:2px;flex:0 0 11px;background:' + (ok ? 'var(--success)' : 'var(--warn)') + '"></span>';
      }
      html += '</div>';
    }
    return html;
  }

  function tahsinForm(santriId) {
    const s = Store.findSantri(santriId);
    const body = `
      ${UI.field('Santri', `<input class="clay-input" value="${UI.esc(s.nama)}" disabled>`)}
      ${UI.field('Tanggal', `<input class="clay-input" id="f-tgl" type="date" value="${Store.todayStr()}">`)}
      <div class="row">
        <div style="flex:1">${UI.field('Halaman Awal', `<input class="clay-input" id="f-ha" type="number" min="1" value="1">`)}</div>
        <div style="flex:1">${UI.field('Halaman Akhir', `<input class="clay-input" id="f-hk" type="number" min="1" value="2">`)}</div>
      </div>
      ${UI.field('Nilai', `<input class="clay-input" id="f-nilai" type="number" min="0" max="100" value="80">`)}
      ${UI.field('Catatan', `<textarea class="clay-textarea" id="f-cat"></textarea>`)}`;
    UI.openModal({
      title: 'Input Tahsin', bodyHTML: body,
      actions: [
        { label: 'Batal', cls: 'ghost', onClick: (m, c) => c() },
        { label: 'Simpan', cls: 'primary', onClick: async (m, c) => {
          const db = Store.get();
          const session = Store.getSession();
          db.tahsin.push({ id: Store.uid('ts'), santriId, ustadzId: ustadzIdFor(santriId), tanggal: m.querySelector('#f-tgl').value, halAwal: +m.querySelector('#f-ha').value, halAkhir: +m.querySelector('#f-hk').value, nilai: +m.querySelector('#f-nilai').value, catatan: m.querySelector('#f-cat').value.trim() });
          const wUser = db.users.find(u => u.role === 'wali' && u.refId === s.waliId);
          if (wUser) Store.addNotif(wUser.id, 'wali', 'Nilai Tahsin baru: ' + s.nama);
          waReport(santriId, '📖 Laporan Tahsin ' + s.nama + ': halaman ' + m.querySelector('#f-ha').value + '-' + m.querySelector('#f-hk').value + ', nilai ' + m.querySelector('#f-nilai').value + '. — ' + db.settings.namaLembaga);
          await Store.save(); Store.log('Input tahsin ' + s.nama); c(); UI.toast('Tersimpan', 'success'); renderTahsin();
        } }
      ]
    });
  }

  /* ----- Ziyadah (Bacaan + Hafalan) ----- */
  function renderZiyadah() {
    const db = Store.get();
    const santri = mySantri().filter(s => s.level === 'Ziyadah');
    const t = Store.todayStr();
    const rows = santri.map(s => {
      const last = Store.lastZiyadah(s.id);
      const totalH = Store.totalHafalanSantri(s.id);
      const bacaanToday = db.ziyadahBacaan.some(z => z.santriId === s.id && z.tanggal === t);
      const hafalanToday = db.ziyadahHafalan.some(z => z.santriId === s.id && z.tanggal === t);
      let badge = '';
      if (hafalanToday) badge = ' <span class="badge green">Selesai ✓</span>';
      else if (bacaanToday) badge = ' <span class="badge" style="background:var(--blue,#2196F3)">Bacaan ✓</span>';
      return `<tr><td><b>${UI.esc(s.nama)}</b></td><td>${last ? getSurah(last.sAkhir).latin + ':' + last.aAkhir : '<span class="muted">-</span>'}</td><td>${totalH ? formatHafalan(totalH) : '-'}</td><td><button class="clay-btn sm primary" data-setoran="${s.id}">+ Setoran</button>${badge}</td></tr>`;
    }).join('');
    document.getElementById('tab-content').innerHTML = `
      <div class="clay-card">
        <div class="section-title"> Input Ziyadah</div>
        <div class="table-wrap"><table class="clay-table">
          <thead><tr><th>Santri</th><th>Lanjutan Terakhir</th><th>Total Hafalan</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4"><div class="empty">Tidak ada santri.</div></td></tr>'}</tbody>
        </table></div>
      </div>`;
    document.querySelectorAll('[data-setoran]').forEach(b => b.onclick = () => ziyadahForm(b.dataset.setoran));
  }

  function ziyadahForm(santriId) {
    const s = Store.findSantri(santriId);
    const db = Store.get();
    const t = Store.todayStr();
    const bacaanToday = db.ziyadahBacaan.filter(z => z.santriId === santriId && z.tanggal === t).sort((a, b) => (b._created||0)-(a._created||0))[0];
    const hafalanToday = db.ziyadahHafalan.some(z => z.santriId === santriId && z.tanggal === t);
    const skipBacaan = !!bacaanToday && !hafalanToday;

    const last = Store.lastZiyadah(santriId);
    const lastH = Store.lastHafalan(santriId);
    let defSA = 2, defAA = 1, defSK = 2, defAK = 5;
    if (bacaanToday) {
      defSA = bacaanToday.sAwal; defAA = bacaanToday.aAwal;
      defSK = bacaanToday.sAkhir; defAK = bacaanToday.aAkhir;
    } else if (lastH) {
      const n = nextHafalanPosition(lastH.sAkhir, lastH.aAkhir, db.settings.juzOrder);
      if (n) { defSA = n.surah; defAA = n.ayah; defSK = n.surah; defAK = n.ayah + 4; }
    } else if (last) {
      const n = nextHafalanPosition(last.sAkhir, last.aAkhir, db.settings.juzOrder);
      if (n) { defSA = n.surah; defAA = n.ayah; defSK = n.surah; defAK = n.ayah + 4; }
    }
    function surahLabel(n) { const s = getSurah(n); return s ? s.n + '. ' + s.latin : n; }
    function riwayatSingkat() {
      const d = Store.get();
      const semua = [...d.ziyadahHafalan.filter(z => z.santriId === santriId), ...d.ziyadahBacaan.filter(z => z.santriId === santriId)]
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || ((b._created||0)-(a._created||0)))
        .slice(0, 3);
      if (!semua.length) return '<span class="muted">Belum ada setoran</span>';
      return semua.map(r => {
        const label = r.nilai !== undefined ? 'Hafalan' : 'Bacaan';
        const sA = getSurah(r.sAwal).latin;
        const sK = getSurah(r.sAkhir).latin;
        return `<div style="font-size:13px;padding:4px 0">${UI.fmtDate(r.tanggal)} — ${label}: ${sA}:${r.aAwal} → ${sK}:${r.aAkhir}</div>`;
      }).join('');
    }

    let hSlide = null;

    const bacaanLocked = skipBacaan ? 'opacity:0.5;border-left:3px solid var(--muted)' : 'border-left:3px solid var(--primary)';
    const bacaanDisabled = skipBacaan ? 'disabled' : '';
    const btnBacaanHide = skipBacaan ? 'style="display:none"' : '';
    const bacaanOkShow = skipBacaan ? 'style="display:inline"' : 'style="display:none"';
    const hafalanActive = skipBacaan ? 'opacity:1;border-left:3px solid var(--primary)' : 'opacity:0.5;border-left:3px solid var(--muted)';
    const hafalanDisabled = skipBacaan ? '' : 'disabled';
    const btnHafalanDisabled = skipBacaan ? '' : 'disabled';

    const body = `
      ${UI.field('Santri', `<input class="clay-input" value="${UI.esc(s.nama)}" disabled>`)}
      ${UI.field('Tanggal', `<input class="clay-input" value="${t}" disabled>`)}
      <hr style="border:none;border-top:1px solid var(--border,#ddd);margin:12px 0">
      <div id="sec-bacaan" class="clay-card pad-sm mb" style="background:var(--bg);${bacaanLocked}">
        <div class="section-title" style="font-size:14px;margin:0 0 8px 0">📖 Setoran Bacaan</div>
        <div class="row">
          <div style="flex:1">${UI.field('Awal Surat', `<input class="clay-input" id="b-sa" list="dl-surah" type="text" value="${surahLabel(defSA)}" autocomplete="off" ${bacaanDisabled}>`)}</div>
          <div style="flex:1">${UI.field('Awal Ayat', `<input class="clay-input" id="b-aa" type="number" min="1" max="${getSurah(defSA) ? getSurah(defSA).ayahs : 286}" value="${Math.min(defAA, getSurah(defSA) ? getSurah(defSA).ayahs : 286)}" ${bacaanDisabled}>`)}</div>
        </div>
        <div class="row">
          <div style="flex:1">${UI.field('Akhir Surat', `<input class="clay-input" id="b-sk" list="dl-surah" type="text" value="${surahLabel(defSK)}" autocomplete="off" ${bacaanDisabled}>`)}</div>
          <div style="flex:1">${UI.field('Akhir Ayat', `<input class="clay-input" id="b-ak" type="number" min="1" max="${getSurah(defSK) ? getSurah(defSK).ayahs : 286}" value="${Math.min(defAK, getSurah(defSK) ? getSurah(defSK).ayahs : 286)}" ${bacaanDisabled}>`)}</div>
        </div>
        <button class="clay-btn primary" id="btn-simpan-bacaan" style="margin-top:8px" ${btnBacaanHide}>💾 Simpan Bacaan</button>
        <span id="bacaan-ok" ${bacaanOkShow} style="margin-top:8px;color:var(--green)">✓ Bacaan tersimpan</span>
      </div>
      <div id="sec-hafalan" class="clay-card pad-sm mb" style="background:var(--bg);${hafalanActive}">
        <div class="section-title" style="font-size:14px;margin:0 0 8px 0">📝 Setoran Hafalan</div>
        <div class="row">
          <div style="flex:1">${UI.field('Awal Surat', `<input class="clay-input" id="h-sa" list="dl-surah" type="text" value="${surahLabel(defSA)}" autocomplete="off" ${hafalanDisabled}>`)}</div>
          <div style="flex:1">${UI.field('Awal Ayat', `<input class="clay-input" id="h-aa" type="number" min="1" max="${getSurah(defSA) ? getSurah(defSA).ayahs : 286}" value="${Math.min(defAA, getSurah(defSA) ? getSurah(defSA).ayahs : 286)}" ${hafalanDisabled}>`)}</div>
        </div>
        <div class="row">
          <div style="flex:1">${UI.field('Akhir Surat', `<input class="clay-input" id="h-sk" list="dl-surah" type="text" value="${surahLabel(defSK)}" autocomplete="off" ${hafalanDisabled}>`)}</div>
          <div style="flex:1">${UI.field('Akhir Ayat', `<input class="clay-input" id="h-ak" type="number" min="1" max="${getSurah(defSK) ? getSurah(defSK).ayahs : 286}" value="${Math.min(defAK, getSurah(defSK) ? getSurah(defSK).ayahs : 286)}" ${hafalanDisabled}>`)}</div>
        </div>
        <div id="calc-preview" class="clay-card pad-sm mt" style="background:var(--bg);font-size:13px"></div>
        ${UI.field('Nilai', `<input class="clay-input" id="f-nilai" type="number" min="0" max="100" value="80" ${hafalanDisabled}>`)}
        ${UI.field('Catatan', `<textarea class="clay-textarea" id="f-cat" ${hafalanDisabled}></textarea>`)}
        <button class="clay-btn primary" id="btn-simpan-hafalan" style="margin-top:8px" ${btnHafalanDisabled}>💾 Simpan Hafalan</button>
      </div>
      <div class="clay-card pad-sm" style="background:var(--bg)"><b>Peta Hafalan</b> <span class="muted" style="font-size:11px">· hijau = sudah disetor, kuning = belum</span><div id="hafalan-map" style="margin-top:8px;overflow:auto;max-height:300px">${hafalanMapHTML(santriId)}</div></div>
      <div class="clay-card pad-sm" style="background:var(--bg);font-size:13px"><b> Riwayat 3 setoran terakhir:</b> <div id="riwayat-list">${riwayatSingkat()}</div></div>`;

    const modal = UI.openModal({
      title: 'Setoran Ziyadah',
      sub: s.nama,
      bodyHTML: body,
      actions: [
        { label: 'Tutup', cls: 'ghost', onClick: (m, c) => c() }
      ]
    });

    setTimeout(() => {
      bindAyatMax('b-sa', 'b-aa,b-ak');
      bindAyatMax('b-sk', 'b-aa,b-ak');
    }, 50);

    if (skipBacaan) {
      document.getElementById('sec-hafalan').style.opacity = '1';
      document.getElementById('sec-hafalan').style.borderLeftColor = 'var(--primary)';
      setTimeout(() => {
        bindAyatMax('h-sa', 'h-aa');
        bindAyatMax('h-sk', 'h-ak');
        const calc = () => {
          const hsa = parseInt(document.getElementById('h-sa').value) || 0;
          const hsk = parseInt(document.getElementById('h-sk').value) || 0;
          const haa = +document.getElementById('h-aa').value;
          const hak = +document.getElementById('h-ak').value;
          const hh = computeHafalan(hsa, haa, hsk, hak);
          document.getElementById('calc-preview').innerHTML = hh
            ? `<b> Auto Hitung:</b> ${hh.ayahs} ayat · ${hh.pages} halaman · Juz ${hh.juzStart}${hh.juzRange > 1 ? '-' + hh.juzEnd : ''}`
            : '<span class="muted">Range belum valid.</span>';
        };
        document.querySelectorAll('#h-sa,#h-aa,#h-sk,#h-ak').forEach(el => el.oninput = calc);
        calc();
        hSlide = setInterval(calc, 300);
      }, 50);
    }

    document.getElementById('btn-simpan-bacaan').onclick = async () => {
      const sa = document.getElementById('b-sa').value;
      const sk = document.getElementById('b-sk').value;
      const sA = sa ? parseInt(sa) : defSA;
      const sK = sk ? parseInt(sk) : defSK;
      if (!sA || !sK) { UI.toast('Pilih surat yang valid', 'error'); return; }
      const sAyah = getSurah(sA); const sKyah = getSurah(sK);
      const aaEl = document.getElementById('b-aa');
      const akEl = document.getElementById('b-ak');
      if (sAyah && +aaEl.value > sAyah.ayahs) { UI.toast('Awal ayat melebihi batas surat', 'error'); return; }
      if (sKyah && +akEl.value > sKyah.ayahs) { UI.toast('Akhir ayat melebihi batas surat', 'error'); return; }

      const d = Store.get();
      d.ziyadahBacaan.push({
        id: Store.uid('zb'), santriId, ustadzId: ustadzIdFor(santriId),
        tanggal: Store.todayStr(), sAwal: sA, aAwal: +aaEl.value,
        sAkhir: sK, aAkhir: +akEl.value, _created: Date.now()
      });
      await Store.save();
      Store.log('Setor ziyadah bacaan ' + s.nama);
      UI.toast('Setoran bacaan tersimpan', 'success');

      document.getElementById('sec-bacaan').style.opacity = '0.5';
      document.getElementById('sec-bacaan').style.borderLeftColor = 'var(--muted)';
      document.querySelectorAll('#sec-bacaan input').forEach(el => el.disabled = true);
      document.getElementById('btn-simpan-bacaan').style.display = 'none';
      document.getElementById('bacaan-ok').style.display = 'inline';

      document.getElementById('h-sa').value = surahLabel(sA);
      document.getElementById('h-sk').value = surahLabel(sK);
      document.getElementById('h-aa').value = aaEl.value;
      document.getElementById('h-ak').value = akEl.value;

      document.getElementById('sec-hafalan').style.opacity = '1';
      document.getElementById('sec-hafalan').style.borderLeftColor = 'var(--primary)';
      document.querySelectorAll('#h-sa,#h-aa,#h-sk,#h-ak,#f-nilai,#f-cat').forEach(el => el.disabled = false);
      document.getElementById('btn-simpan-hafalan').disabled = false;

      bindAyatMax('h-sa', 'h-aa');
      bindAyatMax('h-sk', 'h-ak');

      const calc = () => {
        const hsa = parseInt(document.getElementById('h-sa').value) || 0;
        const hsk = parseInt(document.getElementById('h-sk').value) || 0;
        const haa = +document.getElementById('h-aa').value;
        const hak = +document.getElementById('h-ak').value;
        const hh = computeHafalan(hsa, haa, hsk, hak);
        document.getElementById('calc-preview').innerHTML = hh
          ? `<b> Auto Hitung:</b> ${hh.ayahs} ayat · ${hh.pages} halaman · Juz ${hh.juzStart}${hh.juzRange > 1 ? '-' + hh.juzEnd : ''}`
          : '<span class="muted">Range belum valid.</span>';
      };
      document.querySelectorAll('#h-sa,#h-aa,#h-sk,#h-ak').forEach(el => el.oninput = calc);
      calc();

      document.getElementById('riwayat-list').innerHTML = riwayatSingkat();
      hSlide = setInterval(calc, 300);
    };

    document.getElementById('btn-simpan-hafalan').onclick = async () => {
      const sa = document.getElementById('h-sa').value;
      const sk = document.getElementById('h-sk').value;
      const sA = sa ? parseInt(sa) : defSA;
      const sK = sk ? parseInt(sk) : defSK;
      const aA = +document.getElementById('h-aa').value;
      const aK = +document.getElementById('h-ak').value;
      const sAyh = getSurah(sA); const sKyh = getSurah(sK);
      if (sAyh && aA > sAyh.ayahs) { UI.toast('Awal ayat melebihi batas surat', 'error'); return; }
      if (sKyh && aK > sKyh.ayahs) { UI.toast('Akhir ayat melebihi batas surat', 'error'); return; }
      const h = computeHafalan(sA, aA, sK, aK);
      if (!h) { UI.toast('Range ayat tidak valid', 'error'); return; }

      const d = Store.get();
      d.ziyadahHafalan.push({
        id: Store.uid('zh'), santriId, ustadzId: ustadzIdFor(santriId),
        tanggal: Store.todayStr(), sAwal: sA, aAwal: aA,
        sAkhir: sK, aAkhir: aK, nilai: +document.getElementById('f-nilai').value,
        catatan: document.getElementById('f-cat').value.trim(), _created: Date.now()
      });
      const wUser = d.users.find(u => u.role === 'wali' && u.refId === s.waliId);
      if (wUser) Store.addNotif(wUser.id, 'wali', 'Setoran baru: ' + s.nama + ' (' + formatHafalan(h) + ')');
      waReport(santriId, '📚 Setoran hafalan ' + s.nama + ' berhasil: ' + formatHafalan(h) + ' (' + getSurah(sA).latin + ':' + aA + ' - ' + getSurah(sK).latin + ':' + aK + '). Semangat terus! — ' + d.settings.namaLembaga);
      await Store.save();
      Store.log('Setor ziyadah hafalan ' + s.nama);
      if (hSlide) clearInterval(hSlide);
      modal.close();
      UI.toast('Tersimpan · ' + formatHafalan(h), 'success');
      renderZiyadah();
    };
  }

  /* ----- Mutqin ----- */
  function renderMutqin() {
    const db = Store.get();
    const santri = mySantri().filter(s => s.level === 'Mutqin');
    const rows = santri.map(s => {
      const rec = db.mutqin.filter(m => m.santriId === s.id).sort((a, b) => b.tanggal.localeCompare(a.tanggal))[0];
      return `<tr><td><b>${UI.esc(s.nama)}</b></td><td>${rec ? getSurah(rec.sAkhir).latin + ':' + rec.aAkhir : '<span class="muted">-</span>'}</td><td>${rec ? rec.totalHafalan + ' hlm' : '-'}</td><td><button class="clay-btn sm primary" data-input="${s.id}">+ Murajaah</button></td></tr>`;
    }).join('');
    document.getElementById('tab-content').innerHTML = `
      <div class="clay-card">
        <div class="section-title"> Input Mutqin (Murajaah)</div>
        <div class="table-wrap"><table class="clay-table">
          <thead><tr><th>Santri</th><th>Terakhir</th><th>Total</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4"><div class="empty">Tidak ada santri.</div></td></tr>'}</tbody>
        </table></div>
      </div>`;
    document.querySelectorAll('[data-input]').forEach(b => b.onclick = () => mutqinForm(b.dataset.input));
  }

  function mutqinForm(santriId) {
    const s = Store.findSantri(santriId);
    function surahLabel(n) { const s = getSurah(n); return s ? s.n + '. ' + s.latin : n; }
    const body = `
      ${UI.field('Santri', `<input class="clay-input" value="${UI.esc(s.nama)}" disabled>`)}
      <div class="row">
        <div style="flex:1">${UI.field('Awal Surat', `<input class="clay-input" id="m-sa" list="dl-surah" type="text" value="${surahLabel(2)}" autocomplete="off">`)}</div>
        <div style="flex:1">${UI.field('Awal Ayat', `<input class="clay-input" id="m-aa" type="number" min="1" max="286" value="1">`)}</div>
      </div>
      <div class="row">
        <div style="flex:1">${UI.field('Akhir Surat', `<input class="clay-input" id="m-sk" list="dl-surah" type="text" value="${surahLabel(2)}" autocomplete="off">`)}</div>
        <div style="flex:1">${UI.field('Akhir Ayat', `<input class="clay-input" id="m-ak" type="number" min="1" max="286" value="5">`)}</div>
      </div>
      ${UI.field('Total Hafalan Mutqin (manual, halaman)', `<input class="clay-input" id="m-total" type="number" min="0" value="0">`)}
      ${UI.field('Nilai', `<input class="clay-input" id="f-nilai" type="number" min="0" max="100" value="80">`)}
      ${UI.field('Catatan', `<textarea class="clay-textarea" id="f-cat"></textarea>`)}`;
    const modal = UI.openModal({
      title: 'Murajaah Mutqin', bodyHTML: body,
      actions: [
        { label: 'Batal', cls: 'ghost', onClick: (m, c) => c() },
        { label: 'Simpan', cls: 'primary', onClick: async (m, c) => {
          const db = Store.get();
          const sAInput = m.querySelector('#m-sa').value;
          const sKInput = m.querySelector('#m-sk').value;
          const sA = sAInput ? parseInt(sAInput) : 2;
          const sK = sKInput ? parseInt(sKInput) : 2;
          const sAyh = getSurah(sA); const sKyh = getSurah(sK);
          if (sAyh && +m.querySelector('#m-aa').value > sAyh.ayahs) { UI.toast('Awal ayat melebihi batas surat', 'error'); return; }
          if (sKyh && +m.querySelector('#m-ak').value > sKyh.ayahs) { UI.toast('Akhir ayat melebihi batas surat', 'error'); return; }
          db.mutqin.push({ id: Store.uid('m'), santriId, ustadzId: ustadzIdFor(santriId), tanggal: Store.todayStr(), sAwal: sA, aAwal: +m.querySelector('#m-aa').value, sAkhir: sK, aAkhir: +m.querySelector('#m-ak').value, nilai: +m.querySelector('#f-nilai').value, catatan: m.querySelector('#f-cat').value.trim(), totalHafalan: +m.querySelector('#m-total').value });
          const wUser = db.users.find(u => u.role === 'wali' && u.refId === s.waliId);
          if (wUser) Store.addNotif(wUser.id, 'wali', 'Murajaah Mutqin: ' + s.nama);
          waReport(santriId, '🌟 Murajaah Mutqin ' + s.nama + ': ' + getSurah(sA).latin + ':' + m.querySelector('#m-aa').value + ' - ' + getSurah(sK).latin + ':' + m.querySelector('#m-ak').value + '. Total ' + m.querySelector('#m-total').value + ' halaman. — ' + db.settings.namaLembaga);
          await Store.save(); Store.log('Input mutqin ' + s.nama); c(); UI.toast('Tersimpan', 'success'); renderMutqin();
        } }
      ]
    });
    setTimeout(() => { bindAyatMax('m-sa', 'm-aa'); bindAyatMax('m-sk', 'm-ak'); }, 50);
  }

  /* ---------------- Riwayat ---------------- */
  function riwayat() {
    const c = ctx(); _scope = c.scope;
    Shared.shell(c.role, nav('ustadz_riwayat'), '');
    Shared.setHeader('Riwayat Santri', 'Histori per santri');
    
    const santriList = mySantri();
    
    document.getElementById('view-content').innerHTML = `
      <div class="clay-card">
        <label class="field-label">Cari Santri</label>
        <input class="clay-input" id="riwayat-search" type="text" placeholder="Ketik nama atau NIS santri..." autocomplete="off" />
        <div id="riwayat-santri-list" class="mt" style="max-height:200px;overflow-y:auto"></div>
        <label class="field-label mt">Riwayat</label>
        <div id="riwayat-content"></div>
      </div>`;
    
    const searchInput = document.getElementById('riwayat-search');
    const santriListEl = document.getElementById('riwayat-santri-list');
    
    let selectedSantriId = santriList[0] && santriList[0].id;
    let searchTimer = null;
    
    function updateSantriList() {
      const term = searchInput.value.trim().toLowerCase();
      const filtered = santriList.filter(s => {
        const nameMatch = s.nama.toLowerCase().includes(term);
        const nisMatch = s.nis && s.nis.toString().includes(term);
        return nameMatch || nisMatch;
      });
      
      if (!filtered.length) {
        santriListEl.innerHTML = '<div class="empty">Santri tidak ditemukan.</div>';
        document.getElementById('riwayat-content').innerHTML = '';
        return;
      }
      
      santriListEl.innerHTML = filtered.map(s => `
        <div class="search-item ${s.id === selectedSantriId ? 'active' : ''}" data-sid="${s.id}" style="padding:8px 12px;cursor:pointer;border-radius:8px;margin:2px 0">
          <b>${UI.esc(s.nama)}</b> <span class="muted">(${UI.esc(s.nis || '-')})</span> <span class="muted" style="font-size:12px">${UI.esc(s.halaqah)}</span>
        </div>
      `).join('');
      
      let lastSelected = selectedSantriId;
      santriListEl.querySelectorAll('.search-item').forEach(el => {
        el.onclick = () => {
          santriListEl.querySelectorAll('.search-item').forEach(x => x.classList.remove('active'));
          el.classList.add('active');
          selectedSantriId = el.dataset.sid;
          document.getElementById('riwayat-content').innerHTML = Shared.renderRiwayat(selectedSantriId);
          bindActions();
        };
      });
      
      if (!selectedSantriId || !filtered.some(s => s.id === selectedSantriId)) {
        selectedSantriId = filtered[0].id;
      }
      if (selectedSantriId !== lastSelected) {
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
    const c = ctx(); _scope = c.scope;
    Shared.shell(c.role, nav('ustadz_laporan'), '');
    Shared.setHeader('Laporan Halaqah', 'Santri yang Anda ampu');
    const db = Store.get();
    document.getElementById('view-content').innerHTML = `
      <div class="clay-card mb">
        <div class="row">
          <div style="flex:1">${UI.field('Bulan', `<input type="month" class="clay-input" id="f-bulan" value="${Store.todayStr().slice(0, 7)}">`)}</div>
        </div>
      </div>
      <div id="lap"></div>`;
    const apply = () => {
      const bulan = document.getElementById('f-bulan').value;
      document.getElementById('lap').innerHTML = Shared.renderLaporan({ halaqah: myHalaqah(), bulan });
      Shared.bindLaporanExport();
    };
    document.getElementById('f-bulan').onchange = apply;
    apply();
  }

  /* ---------------- Umum (Semua kelas) ---------------- */
  function renderUmum() {
    const db = Store.get();
    const allSantri = db.santri.filter(s => s.status === 'Aktif');
    let filterText = '';
    
    function renderTable(santri) {
      let html = `
        <div class="clay-card">
          <div class="row" style="justify-content:space-between">
            <div class="section-title" style="margin:0">Setoran Umum (${santri.length} santri)</div>
            <input class="clay-input" id="cari-santri" type="text" placeholder="Cari nama santri..." value="${UI.esc(filterText)}" style="max-width:260px" autocomplete="off" />
          </div>
          <div class="table-wrap mt">
            <table class="clay-table">
              <thead>
                <tr><th>Santri</th><th>Kelas</th><th>Level</th><th>Total Hafalan</th><th>Nilai</th><th>Aksi</th></tr>
              </thead>
              <tbody>`;
      
      if (!santri.length) {
        html += '<tr><td colspan="6"><div class="empty">Tidak ada santri.</div></td></tr>';
      }
      santri.forEach(s => {
        const totalH = Store.totalHafalanSantri(s.id);
        const avg = Store.avgNilai(s.id);
        let btnLabel = '+ Input', btnCls = 'primary';
        if (s.level === 'Ziyadah') { btnLabel = '+ Setoran'; btnCls = 'secondary'; }
        else if (s.level === 'Mutqin') { btnLabel = '+ Murajaah'; btnCls = 'success'; }
        
        html += `<tr>
          <td><b>${UI.esc(s.nama)}</b><div class="muted" style="font-size:12px">${UI.esc(s.nis)}</div></td>
          <td>${UI.esc(s.kelas)}</td>
          <td><span class="badge ${s.level === 'Tahsin' ? 'blue' : s.level === 'Ziyadah' ? 'green' : 'warn'}">${UI.esc(s.level)}</span></td>
          <td>${totalH ? formatHafalan(totalH) : '<span class="muted">-</span>'}</td>
          <td>${avg ? '<b>' + avg + '</b>' : '<span class="muted">-</span>'}</td>
          <td><button class="clay-btn sm ${btnCls}" data-input="${s.id}">${btnLabel}</button></td>
        </tr>`;
      });
      
      html += '</tbody></table></div></div>';
      
      document.getElementById('tab-content').innerHTML = html;
      
      const input = document.getElementById('cari-santri');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        input.oninput = () => {
          filterText = input.value.trim().toLowerCase();
          const filtered = allSantri.filter(s =>
            s.nama.toLowerCase().includes(filterText) ||
            (s.nis && s.nis.toString().toLowerCase().includes(filterText))
          );
          renderTable(filtered);
        };
      }
      
      document.querySelectorAll('[data-input]').forEach(b => b.onclick = () => umumInput(b.dataset.input));
    }
    
    renderTable(allSantri);
  }

  function formatHafalan(h) {
    if (!h) return '-';
    return `${h.ayahs} ayat · ${h.pages} hlm`;
  }

  function umumInput(santriId) {
    const s = Store.findSantri(santriId);
    if (!s) return;
    const level = s.level;
    
    let body = `
      ${UI.field('Santri', `<input class="clay-input" value="${UI.esc(s.nama)}" disabled>`)}
      ${UI.field('Kelas', `<input class="clay-input" value="${UI.esc(s.kelas)}" disabled>`)}
      ${UI.field('Halaqah', `<input class="clay-input" value="${UI.esc(s.halaqah)}" disabled>`)}
      ${UI.field('Tanggal', `<input class="clay-input" id="f-tgl" type="date" value="${Store.todayStr()}">`)}`;
    
    if (level === 'Tahsin') {
      body += `
        <div class="row">
          <div style="flex:1">${UI.field('Halaman Awal', `<input class="clay-input" id="f-ha" type="number" min="1" value="1">`)}</div>
          <div style="flex:1">${UI.field('Halaman Akhir', `<input class="clay-input" id="f-hk" type="number" min="1" value="2">`)}</div>
        </div>`;
    } else if (level === 'Ziyadah') {
      const t = Store.todayStr();
      const db = Store.get();
      const bacaanToday = db.ziyadahBacaan.filter(z => z.santriId === santriId && z.tanggal === t).sort((a, b) => (b._created||0)-(a._created||0))[0];
      const hafalanToday = db.ziyadahHafalan.some(z => z.santriId === santriId && z.tanggal === t);
      const skipBacaan = !!bacaanToday && !hafalanToday;

      const last = Store.lastZiyadah(santriId);
      const lastH = Store.lastHafalan(santriId);
      let defSA = 2, defAA = 1, defSK = 2, defAK = 5;
      if (bacaanToday) {
        defSA = bacaanToday.sAwal; defAA = bacaanToday.aAwal;
        defSK = bacaanToday.sAkhir; defAK = bacaanToday.aAkhir;
      } else if (lastH) {
        const n = nextHafalanPosition(lastH.sAkhir, lastH.aAkhir, db.settings.juzOrder);
        if (n) { defSA = n.surah; defAA = n.ayah; defSK = n.surah; defAK = n.ayah + 4; }
      } else if (last) {
        const n = nextHafalanPosition(last.sAkhir, last.aAkhir, db.settings.juzOrder);
        if (n) { defSA = n.surah; defAA = n.ayah; defSK = n.surah; defAK = n.ayah + 4; }
      }

      function surahLabel(n) { const s = getSurah(n); return s ? s.n + '. ' + s.latin : n; }

      const bacaanLocked = skipBacaan ? 'opacity:0.5;border-left:3px solid var(--muted)' : 'border-left:3px solid var(--primary)';
      const bacaanDisabled = skipBacaan ? 'disabled' : '';
      const btnBacaanHide = skipBacaan ? 'style="display:none"' : '';
      const bacaanOkShow = skipBacaan ? 'style="display:inline"' : 'style="display:none"';
      const hafalanActive = skipBacaan ? 'opacity:1;border-left:3px solid var(--primary)' : 'opacity:0.5;border-left:3px solid var(--muted)';
      const hafalanDisabled = skipBacaan ? '' : 'disabled';
      const btnHafalanDisabled = skipBacaan ? '' : 'disabled';

      const bacaanSection = `
        <hr style="border:none;border-top:1px solid var(--border,#ddd);margin:12px 0">
        <div id="sec-bacaan" class="clay-card pad-sm mb" style="background:var(--bg);${bacaanLocked}">
          <div class="section-title" style="font-size:14px;margin:0 0 8px 0">📖 Setoran Bacaan</div>
          <div class="row">
            <div style="flex:1">${UI.field('Awal Surat', `<input class="clay-input" id="b-sa" list="dl-surah" type="text" value="${surahLabel(defSA)}" autocomplete="off" ${bacaanDisabled}>`)}</div>
            <div style="flex:1">${UI.field('Awal Ayat', `<input class="clay-input" id="b-aa" type="number" min="1" max="${getSurah(defSA) ? getSurah(defSA).ayahs : 286}" value="${Math.min(defAA, getSurah(defSA) ? getSurah(defSA).ayahs : 286)}" ${bacaanDisabled}>`)}</div>
          </div>
          <div class="row">
            <div style="flex:1">${UI.field('Akhir Surat', `<input class="clay-input" id="b-sk" list="dl-surah" type="text" value="${surahLabel(defSK)}" autocomplete="off" ${bacaanDisabled}>`)}</div>
            <div style="flex:1">${UI.field('Akhir Ayat', `<input class="clay-input" id="b-ak" type="number" min="1" max="${getSurah(defSK) ? getSurah(defSK).ayahs : 286}" value="${Math.min(defAK, getSurah(defSK) ? getSurah(defSK).ayahs : 286)}" ${bacaanDisabled}>`)}</div>
          </div>
          <button class="clay-btn primary" id="btn-simpan-bacaan" style="margin-top:8px" ${btnBacaanHide}>💾 Simpan Bacaan</button>
          <span id="bacaan-ok" ${bacaanOkShow} style="margin-top:8px;color:var(--green)">✓ Bacaan tersimpan</span>
        </div>`;

      const hafalanSection = `
        <div id="sec-hafalan" class="clay-card pad-sm mb" style="background:var(--bg);${hafalanActive}">
          <div class="section-title" style="font-size:14px;margin:0 0 8px 0">📝 Setoran Hafalan</div>
          <div class="row">
            <div style="flex:1">${UI.field('Awal Surat', `<input class="clay-input" id="h-sa" list="dl-surah" type="text" value="${surahLabel(defSA)}" autocomplete="off" ${hafalanDisabled}>`)}</div>
            <div style="flex:1">${UI.field('Awal Ayat', `<input class="clay-input" id="h-aa" type="number" min="1" max="${getSurah(defSA) ? getSurah(defSA).ayahs : 286}" value="${Math.min(defAA, getSurah(defSA) ? getSurah(defSA).ayahs : 286)}" ${hafalanDisabled}>`)}</div>
          </div>
          <div class="row">
            <div style="flex:1">${UI.field('Akhir Surat', `<input class="clay-input" id="h-sk" list="dl-surah" type="text" value="${surahLabel(defSK)}" autocomplete="off" ${hafalanDisabled}>`)}</div>
            <div style="flex:1">${UI.field('Akhir Ayat', `<input class="clay-input" id="h-ak" type="number" min="1" max="${getSurah(defSK) ? getSurah(defSK).ayahs : 286}" value="${Math.min(defAK, getSurah(defSK) ? getSurah(defSK).ayahs : 286)}" ${hafalanDisabled}>`)}</div>
          </div>
          <div id="calc-preview" class="clay-card pad-sm mt" style="background:var(--bg);font-size:13px"></div>
          ${UI.field('Nilai', `<input class="clay-input" id="f-nilai" type="number" min="0" max="100" value="80" ${hafalanDisabled}>`)}
          ${UI.field('Catatan', `<textarea class="clay-textarea" id="f-cat" ${hafalanDisabled}></textarea>`)}
          <button class="clay-btn primary" id="btn-simpan-hafalan" style="margin-top:8px" ${btnHafalanDisabled}>💾 Simpan Hafalan</button>
        </div>`;

      body += bacaanSection + hafalanSection;
    } else if (level === 'Mutqin') {
      body += `
        <div class="row">
          <div style="flex:1">${UI.field('Awal Surat', `<input class="clay-input" id="f-sa" list="dl-surah" type="text" placeholder="1. Al-Fatihah" autocomplete="off">`)}</div>
          <div style="flex:1">${UI.field('Awal Ayat', `<input class="clay-input" id="f-aa" type="number" min="1" max="286" value="1">`)}</div>
        </div>
        <div class="row">
          <div style="flex:1">${UI.field('Akhir Surat', `<input class="clay-input" id="f-sk" list="dl-surah" type="text" placeholder="2. Al-Baqarah" autocomplete="off">`)}</div>
          <div style="flex:1">${UI.field('Akhir Ayat', `<input class="clay-input" id="f-ak" type="number" min="1" max="286" value="5">`)}</div>
        </div>
        ${UI.field('Total Hafalan Mutqin (hlm)', `<input class="clay-input" id="f-total" type="number" min="0" value="0">`)}`;
    }
    
    if (level !== 'Ziyadah') {
      body += `
        ${UI.field('Nilai', `<input class="clay-input" id="f-nilai" type="number" min="0" max="100" value="80">`)}
        ${UI.field('Catatan', `<textarea class="clay-textarea" id="f-cat"></textarea>`)}`;
    }

    const modal = UI.openModal({
      title: 'Input ' + level + ' - ' + s.nama,
      sub: s.kelas + ' · ' + s.halaqah,
      bodyHTML: body,
      actions: level === 'Ziyadah'
        ? [{ label: 'Tutup', cls: 'ghost', onClick: (m, c) => c() }]
        : [
        { label: 'Batal', cls: 'ghost', onClick: (m, c) => c() },
        { label: 'Simpan', cls: 'primary', onClick: async (m, c) => {
          const d = Store.get();

          if (level === 'Tahsin') {
            const record = {
              id: Store.uid('ts'), santriId, ustadzId: ustadzIdFor(santriId),
              tanggal: m.querySelector('#f-tgl').value,
              halAwal: +m.querySelector('#f-ha').value, halAkhir: +m.querySelector('#f-hk').value,
              nilai: +m.querySelector('#f-nilai').value, catatan: m.querySelector('#f-cat').value.trim()
            };
            d.tahsin.push(record);
          } else if (level === 'Mutqin') {
            const sA = parseInt(m.querySelector('#f-sa').value) || 2;
            const sK = parseInt(m.querySelector('#f-sk').value) || 2;
            const record = {
              id: Store.uid('m'), santriId, ustadzId: ustadzIdFor(santriId),
              tanggal: m.querySelector('#f-tgl').value,
              sAwal: sA, aAwal: +m.querySelector('#f-aa').value,
              sAkhir: sK, aAkhir: +m.querySelector('#f-ak').value,
              nilai: +m.querySelector('#f-nilai').value, catatan: m.querySelector('#f-cat').value.trim(),
              totalHafalan: +m.querySelector('#f-total').value
            };
            d.mutqin.push(record);
          } else {
            return;
          }

          const w = d.users.find(u => u.role === 'wali' && u.refId === s.waliId);
          if (w) Store.addNotif(w.id, 'wali', 'Setoran baru: ' + s.nama + ' (' + level + ')');
          waReport(santriId, '✅ Laporan setoran ' + s.nama + ' (' + level + ') tersimpan. Terima kasih. — ' + d.settings.namaLembaga);
          await Store.save();
          Store.log('Input umum: ' + s.nama + ' (' + level + ')');
          c();
          UI.toast('Setoran ' + level + ' tersimpan', 'success');
          renderUmum();
        } }
      ]
    });

    if (level === 'Ziyadah') {
      const modalContent = modal.modal;
      const t = Store.todayStr();
      const db = Store.get();
      let hSlide = null;

      setTimeout(() => {
        bindAyatMax('b-sa', 'b-aa,b-ak');
        bindAyatMax('b-sk', 'b-aa,b-ak');
      }, 50);

      if (skipBacaan) {
        modalContent.querySelector('#sec-hafalan').style.opacity = '1';
        modalContent.querySelector('#sec-hafalan').style.borderLeftColor = 'var(--primary)';
        setTimeout(() => {
          bindAyatMax('h-sa', 'h-aa');
          bindAyatMax('h-sk', 'h-ak');
          const calc = () => {
            const hsa = parseInt(document.getElementById('h-sa').value) || 0;
            const hsk = parseInt(document.getElementById('h-sk').value) || 0;
            const haa = +document.getElementById('h-aa').value;
            const hak = +document.getElementById('h-ak').value;
            const hh = computeHafalan(hsa, haa, hsk, hak);
            document.getElementById('calc-preview').innerHTML = hh
              ? `<b> Auto Hitung:</b> ${hh.ayahs} ayat · ${hh.pages} halaman · Juz ${hh.juzStart}${hh.juzRange > 1 ? '-' + hh.juzEnd : ''}`
              : '<span class="muted">Range belum valid.</span>';
          };
          document.querySelectorAll('#h-sa,#h-aa,#h-sk,#h-ak').forEach(el => el.oninput = calc);
          calc();
          hSlide = setInterval(calc, 300);
        }, 50);
      }

      modalContent.querySelector('#btn-simpan-bacaan').onclick = async () => {
        const sa = modalContent.querySelector('#b-sa').value;
        const sk = modalContent.querySelector('#b-sk').value;
        const sA = sa ? parseInt(sa) : defSA;
        const sK = sk ? parseInt(sk) : defSK;
        if (!sA || !sK) { UI.toast('Pilih surat yang valid', 'error'); return; }
        const sAyah = getSurah(sA); const sKyah = getSurah(sK);
        const aaEl = modalContent.querySelector('#b-aa');
        const akEl = modalContent.querySelector('#b-ak');
        if (sAyah && +aaEl.value > sAyah.ayahs) { UI.toast('Awal ayat melebihi batas surat', 'error'); return; }
        if (sKyah && +akEl.value > sKyah.ayahs) { UI.toast('Akhir ayat melebihi batas surat', 'error'); return; }

        const d = Store.get();
        d.ziyadahBacaan.push({
          id: Store.uid('zb'), santriId, ustadzId: ustadzIdFor(santriId),
          tanggal: Store.todayStr(), sAwal: sA, aAwal: +aaEl.value,
          sAkhir: sK, aAkhir: +akEl.value, _created: Date.now()
        });
        await Store.save();
        Store.log('Setor ziyadah bacaan ' + s.nama);
        UI.toast('Setoran bacaan tersimpan', 'success');

        modalContent.querySelector('#sec-bacaan').style.opacity = '0.5';
        modalContent.querySelector('#sec-bacaan').style.borderLeftColor = 'var(--muted)';
        modalContent.querySelectorAll('#sec-bacaan input').forEach(el => el.disabled = true);
        modalContent.querySelector('#btn-simpan-bacaan').style.display = 'none';
        modalContent.querySelector('#bacaan-ok').style.display = 'inline';

        modalContent.querySelector('#h-sa').value = surahLabel(sA);
        modalContent.querySelector('#h-sk').value = surahLabel(sK);
        modalContent.querySelector('#h-aa').value = aaEl.value;
        modalContent.querySelector('#h-ak').value = akEl.value;

        modalContent.querySelector('#sec-hafalan').style.opacity = '1';
        modalContent.querySelector('#sec-hafalan').style.borderLeftColor = 'var(--primary)';
        modalContent.querySelectorAll('#h-sa,#h-aa,#h-sk,#h-ak,#f-nilai,#f-cat').forEach(el => el.disabled = false);
        modalContent.querySelector('#btn-simpan-hafalan').disabled = false;

        bindAyatMax('h-sa', 'h-aa');
        bindAyatMax('h-sk', 'h-ak');

        const calc = () => {
          const hsa = parseInt(document.getElementById('h-sa').value) || 0;
          const hsk = parseInt(document.getElementById('h-sk').value) || 0;
          const haa = +document.getElementById('h-aa').value;
          const hak = +document.getElementById('h-ak').value;
          const hh = computeHafalan(hsa, haa, hsk, hak);
          document.getElementById('calc-preview').innerHTML = hh
            ? `<b> Auto Hitung:</b> ${hh.ayahs} ayat · ${hh.pages} halaman · Juz ${hh.juzStart}${hh.juzRange > 1 ? '-' + hh.juzEnd : ''}`
            : '<span class="muted">Range belum valid.</span>';
        };
        document.querySelectorAll('#h-sa,#h-aa,#h-sk,#h-ak').forEach(el => el.oninput = calc);
        calc();
        hSlide = setInterval(calc, 300);
      };

      modalContent.querySelector('#btn-simpan-hafalan').onclick = async () => {
        const sa = modalContent.querySelector('#h-sa').value;
        const sk = modalContent.querySelector('#h-sk').value;
        const sA = sa ? parseInt(sa) : defSA;
        const sK = sk ? parseInt(sk) : defSK;
        const aA = +modalContent.querySelector('#h-aa').value;
        const aK = +modalContent.querySelector('#h-ak').value;
        const sAyh = getSurah(sA); const sKyh = getSurah(sK);
        if (sAyh && aA > sAyh.ayahs) { UI.toast('Awal ayat melebihi batas surat', 'error'); return; }
        if (sKyh && aK > sKyh.ayahs) { UI.toast('Akhir ayat melebihi batas surat', 'error'); return; }
        const h = computeHafalan(sA, aA, sK, aK);
        if (!h) { UI.toast('Range ayat tidak valid', 'error'); return; }

        const d = Store.get();
        d.ziyadahHafalan.push({
          id: Store.uid('zh'), santriId, ustadzId: ustadzIdFor(santriId),
          tanggal: Store.todayStr(), sAwal: sA, aAwal: aA,
          sAkhir: sK, aAkhir: aK, nilai: +modalContent.querySelector('#f-nilai').value,
          catatan: modalContent.querySelector('#f-cat').value.trim(), _created: Date.now()
        });
        const wUser = d.users.find(u => u.role === 'wali' && u.refId === s.waliId);
        if (wUser) Store.addNotif(wUser.id, 'wali', 'Setoran baru: ' + s.nama + ' (' + formatHafalan(h) + ')');
        waReport(santriId, '📚 Setoran hafalan ' + s.nama + ' berhasil: ' + formatHafalan(h) + ' (' + getSurah(sA).latin + ':' + aA + ' - ' + getSurah(sK).latin + ':' + aK + '). Semangat terus! — ' + d.settings.namaLembaga);
        await Store.save();
        Store.log('Setor ziyadah hafalan ' + s.nama);
        if (hSlide) clearInterval(hSlide);
        modal.close();
        UI.toast('Tersimpan · ' + formatHafalan(h), 'success');
        renderUmum();
      };
    }
  }

  /* ---------------- Notifikasi ---------------- */
  function notif() {
    const c = ctx(); _scope = c.scope;
    Shared.shell(c.role, nav('ustadz_notif'), '');
    Shared.setHeader('Notifikasi', 'Pengingat untuk ustadz');
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

  return { nav, dashboard, absensi, pembelajaran, riwayat, laporan, notif };
})();
