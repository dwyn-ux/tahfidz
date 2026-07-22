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
        ${db.settings.logo ? `<div class="stat" style="justify-content:center;padding:12px">
          <img src="${UI.esc(db.settings.logo)}" style="max-height:64px;object-fit:contain">
        </div>` : ''}
        ${db.settings.logo ? `<div class="stat" style="justify-content:center;padding:12px">
          <img src="${UI.esc(db.settings.logo)}" style="max-height:64px;object-fit:contain">
        </div>` : ''}
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
    Shared.setHeader('Pembelajaran', 'Tahsin · Ziyadah · Mutqin');
    document.getElementById('view-content').innerHTML = `
      <div class="pill-tabs" id="tabs">
        <button class="pill active" data-tab="tahsin"> Tahsin</button>
        <button class="pill" data-tab="ziyadah"> Ziyadah</button>
        <button class="pill" data-tab="mutqin"> Mutqin</button>
      </div>
      <div id="tab-content"></div>`;
    const tabs = document.getElementById('tabs');
    const render = (tab) => {
      tabs.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p.dataset.tab === tab));
      if (tab === 'tahsin') renderTahsin();
      else if (tab === 'ziyadah') renderZiyadah();
      else renderMutqin();
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
        if (el) { el.max = maxAyat; if (Number(el.value) > maxAyat) el.value = maxAyat; }
      });
    };
    surahInput.oninput = update;
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
          await Store.save(); Store.log('Input tahsin ' + s.nama); c(); UI.toast('Tersimpan', 'success'); renderTahsin();
        } }
      ]
    });
  }

  /* ----- Ziyadah (Bacaan + Hafalan) ----- */
  function renderZiyadah() {
    const db = Store.get();
    const multi = db.settings.setoranMulti;
    const santri = mySantri().filter(s => s.level === 'Ziyadah');
    const t = Store.todayStr();
    const rows = santri.map(s => {
      const last = Store.lastZiyadah(s.id);
      const rec = db.ziyadahHafalan.filter(z => z.santriId === s.id).sort((a, b) => b.tanggal.localeCompare(a.tanggal))[0];
      const bacaanHariIni = db.ziyadahBacaan.some(z => z.santriId === s.id && z.tanggal === t);
      const hafalanHariIni = db.ziyadahHafalan.some(z => z.santriId === s.id && z.tanggal === t);
      let btn = '';
      if (multi) {
        btn = `<button class="clay-btn sm primary" data-bacaan="${s.id}">+ Setor Bacaan</button>
          <button class="clay-btn sm secondary" data-hafalan="${s.id}">+ Setor Hafalan</button>`;
      } else if (!bacaanHariIni) {
        btn = `<button class="clay-btn sm primary" data-bacaan="${s.id}">+ Setor Bacaan</button>`;
      } else if (!hafalanHariIni) {
        btn = `<button class="clay-btn sm secondary" data-hafalan="${s.id}">+ Setor Hafalan</button>`;
      } else {
        btn = `<span class="badge green">Selesai ✓</span>`;
      }
      return `<tr><td><b>${UI.esc(s.nama)}</b></td><td>${last ? getSurah(last.sAkhir).latin + ':' + last.aAkhir : '<span class="muted">-</span>'}</td><td>${rec ? formatHafalan(computeHafalan(rec.sAwal, rec.aAwal, rec.sAkhir, rec.aAkhir)) : '-'}</td><td>${btn}</td></tr>`;
    }).join('');
    document.getElementById('tab-content').innerHTML = `
      <div class="clay-card">
        <div class="section-title"> Input Ziyadah</div>
        <div class="table-wrap"><table class="clay-table">
          <thead><tr><th>Santri</th><th>Lanjutan Terakhir</th><th>Total Hafalan</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4"><div class="empty">Tidak ada santri.</div></td></tr>'}</tbody>
        </table></div>
      </div>`;
    document.querySelectorAll('[data-bacaan]').forEach(b => b.onclick = () => ziyadahBacaanForm(b.dataset.bacaan));
    document.querySelectorAll('[data-hafalan]').forEach(b => b.onclick = () => ziyadahHafalanForm(b.dataset.hafalan));
  }

  function ziyadahBacaanForm(santriId) {
    const s = Store.findSantri(santriId);
    const db = Store.get();
    const last = Store.lastZiyadah(santriId);
    let defSA = 2, defAA = 1;
    if (last) {
      const n = nextHafalanPosition(last.sAkhir, last.aAkhir, db.settings.juzOrder);
      if (n) { defSA = n.surah; defAA = n.ayah; }
    }
    const body = `
      ${UI.field('Santri', `<input class="clay-input" value="${UI.esc(s.nama)}" disabled>`)}
      ${UI.field('Tanggal', `<input class="clay-input" value="${Store.todayStr()}" disabled>`)}
      <div class="row">
        <div style="flex:1">${UI.field('Awal Surat', `<input class="clay-input" id="b-sa" list="dl-surah" type="text" value="${defSA}" autocomplete="off">`)}</div>
        <div style="flex:1">${UI.field('Awal Ayat', `<input class="clay-input" id="b-aa" type="number" min="1" max="${getSurah(defSA) ? getSurah(defSA).ayahs : 286}" value="${Math.min(defAA, getSurah(defSA) ? getSurah(defSA).ayahs : 286)}">`)}</div>
      </div>
      <div class="row">
        <div style="flex:1">${UI.field('Akhir Surat', `<input class="clay-input" id="b-sk" list="dl-surah" type="text" value="${defSA}" autocomplete="off">`)}</div>
        <div style="flex:1">${UI.field('Akhir Ayat', `<input class="clay-input" id="b-ak" type="number" min="1" max="${getSurah(defSA) ? getSurah(defSA).ayahs : 286}" value="${Math.min(defAA + 4, getSurah(defSA) ? getSurah(defSA).ayahs : 286)}">`)}</div>
      </div>`;
    const modal = UI.openModal({
      title: 'Setoran Bacaan Ziyadah', sub: 'Setelah bacaan disimpan, form hafalan akan terbuka',
      bodyHTML: body,
      actions: [
        { label: 'Batal', cls: 'ghost', onClick: (m, c) => c() },
        { label: 'Simpan Bacaan', cls: 'primary', onClick: async (m, c) => {
          const db = Store.get();
          const sA = parseInt(m.querySelector('#b-sa').value) || defSA;
          const sK = parseInt(m.querySelector('#b-sk').value) || defSA;
          if (!sA || !sK) { UI.toast('Pilih surat yang valid', 'error'); return; }
          const sAyah = getSurah(sA); const sKyah = getSurah(sK);
          if (sAyah && +m.querySelector('#b-aa').value > sAyah.ayahs) { UI.toast('Awal ayat melebihi batas surat', 'error'); return; }
          if (sKyah && +m.querySelector('#b-ak').value > sKyah.ayahs) { UI.toast('Akhir ayat melebihi batas surat', 'error'); return; }
          db.ziyadahBacaan.push({ id: Store.uid('zb'), santriId, ustadzId: ustadzIdFor(santriId), tanggal: Store.todayStr(), sAwal: sA, aAwal: +m.querySelector('#b-aa').value, sAkhir: sK, aAkhir: +m.querySelector('#b-ak').value });
          await Store.save(); Store.log('Setor ziyadah bacaan ' + s.nama); c(); UI.toast('Setoran bacaan tersimpan', 'success'); renderZiyadah();
        } }
      ]
    });
    setTimeout(() => { bindAyatMax('b-sa', 'b-aa,b-ak'); bindAyatMax('b-sk', 'b-aa,b-ak'); }, 50);
  }

  function ziyadahHafalanForm(santriId) {
    const s = Store.findSantri(santriId);
    const db = Store.get();
    const t = Store.todayStr();
    const bacaan = db.ziyadahBacaan.filter(z => z.santriId === santriId && z.tanggal === t).sort((a, b) => (b.id > a.id ? 1 : -1))[0];
    let defSA = 2, defAA = 1, defSK = 2, defAK = 5;
    if (bacaan) {
      defSA = bacaan.sAwal; defAA = bacaan.aAwal; defSK = bacaan.sAkhir; defAK = bacaan.aAkhir;
    } else {
      const last = Store.lastZiyadah(santriId);
      if (last) {
        const n = nextHafalanPosition(last.sAkhir, last.aAkhir, db.settings.juzOrder);
        defSA = n.surah; defAA = n.ayah;
      }
    }
    const body = `
      ${UI.field('Santri', `<input class="clay-input" value="${UI.esc(s.nama)}" disabled>`)}
      ${UI.field('Tanggal', `<input class="clay-input" value="${t}" disabled>`)}
      <div class="clay-card pad-sm mb" style="background:var(--bg)"><b> Bacaan hari ini:</b> ${bacaan ? getSurah(bacaan.sAwal).latin + ':' + bacaan.aAwal + ' — ' + getSurah(bacaan.sAkhir).latin + ':' + bacaan.aAkhir : '-'}</div>
      <div class="row">
        <div style="flex:1">${UI.field('Awal Surat', `<input class="clay-input" id="h-sa" list="dl-surah" type="text" value="${defSA}" autocomplete="off">`)}</div>
        <div style="flex:1">${UI.field('Awal Ayat', `<input class="clay-input" id="h-aa" type="number" min="1" max="${getSurah(defSA) ? getSurah(defSA).ayahs : 286}" value="${Math.min(defAA, getSurah(defSA) ? getSurah(defSA).ayahs : 286)}">`)}</div>
      </div>
      <div class="row">
        <div style="flex:1">${UI.field('Akhir Surat', `<input class="clay-input" id="h-sk" list="dl-surah" type="text" value="${defSK}" autocomplete="off">`)}</div>
        <div style="flex:1">${UI.field('Akhir Ayat', `<input class="clay-input" id="h-ak" type="number" min="1" max="${getSurah(defSK) ? getSurah(defSK).ayahs : 286}" value="${Math.min(defAK, getSurah(defSK) ? getSurah(defSK).ayahs : 286)}">`)}</div>
      </div>
      <div id="calc-preview" class="clay-card pad-sm mt" style="background:var(--bg)"></div>
      ${UI.field('Nilai', `<input class="clay-input" id="f-nilai" type="number" min="0" max="100" value="80">`)}
      ${UI.field('Catatan', `<textarea class="clay-textarea" id="f-cat"></textarea>`)}`;
    const modal = UI.openModal({
      title: 'Setoran Hafalan Ziyadah', sub: 'Data dari setoran bacaan hari ini',
      bodyHTML: body,
      actions: [
        { label: 'Batal', cls: 'ghost', onClick: (m, c) => c() },
        { label: 'Simpan Hafalan', cls: 'primary', onClick: async (m, c) => {
          const db = Store.get();
          const sA = parseInt(m.querySelector('#h-sa').value) || defSA, aA = +m.querySelector('#h-aa').value;
          const sK = parseInt(m.querySelector('#h-sk').value) || defSK, aK = +m.querySelector('#h-ak').value;
          const sAyh = getSurah(sA); const sKyh = getSurah(sK);
          if (sAyh && aA > sAyh.ayahs) { UI.toast('Awal ayat melebihi batas surat', 'error'); return; }
          if (sKyh && aK > sKyh.ayahs) { UI.toast('Akhir ayat melebihi batas surat', 'error'); return; }
          const h = computeHafalan(sA, aA, sK, aK);
          if (!h) { UI.toast('Range ayat tidak valid', 'error'); return; }
          db.ziyadahHafalan.push({ id: Store.uid('zh'), santriId, ustadzId: ustadzIdFor(santriId), tanggal: Store.todayStr(), sAwal: sA, aAwal: aA, sAkhir: sK, aAkhir: aK, nilai: +m.querySelector('#f-nilai').value, catatan: m.querySelector('#f-cat').value.trim() });
          const wUser = db.users.find(u => u.role === 'wali' && u.refId === s.waliId);
          if (wUser) Store.addNotif(wUser.id, 'wali', 'Setoran baru: ' + s.nama + ' (' + formatHafalan(h) + ')');
          await Store.save(); Store.log('Setor ziyadah hafalan ' + s.nama); c(); UI.toast('Tersimpan · ' + formatHafalan(h), 'success'); renderZiyadah();
        } }
      ]
    });
    setTimeout(() => { bindAyatMax('h-sa', 'h-aa'); bindAyatMax('h-sk', 'h-ak'); }, 50);
    const calc = () => {
      const sA = parseInt(modal.modal.querySelector('#h-sa').value) || 0;
      const aA = +modal.modal.querySelector('#h-aa').value;
      const sK = parseInt(modal.modal.querySelector('#h-sk').value) || 0;
      const aK = +modal.modal.querySelector('#h-ak').value;
      const h = computeHafalan(sA, aA, sK, aK);
      modal.modal.querySelector('#calc-preview').innerHTML = h
        ? `<b> Auto Hitung:</b> ${h.ayahs} ayat · ${h.pages} halaman · Juz ${h.juzStart}${h.juzRange > 1 ? '-' + h.juzEnd : ''}`
        : '<span class="muted">Range belum valid.</span>';
    };
    modal.modal.querySelectorAll('#h-sa,#h-aa,#h-sk,#h-ak').forEach(i => i.oninput = calc);
    calc();
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
    const body = `
      ${UI.field('Santri', `<input class="clay-input" value="${UI.esc(s.nama)}" disabled>`)}
      <div class="row">
        <div style="flex:1">${UI.field('Awal Surat', `<input class="clay-input" id="m-sa" list="dl-surah" type="text" value="2" autocomplete="off">`)}</div>
        <div style="flex:1">${UI.field('Awal Ayat', `<input class="clay-input" id="m-aa" type="number" min="1" max="286" value="1">`)}</div>
      </div>
      <div class="row">
        <div style="flex:1">${UI.field('Akhir Surat', `<input class="clay-input" id="m-sk" list="dl-surah" type="text" value="2" autocomplete="off">`)}</div>
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
          const sA = parseInt(m.querySelector('#m-sa').value) || 2;
          const sK = parseInt(m.querySelector('#m-sk').value) || 2;
          const sAyh = getSurah(sA); const sKyh = getSurah(sK);
          if (sAyh && +m.querySelector('#m-aa').value > sAyh.ayahs) { UI.toast('Awal ayat melebihi batas surat', 'error'); return; }
          if (sKyh && +m.querySelector('#m-ak').value > sKyh.ayahs) { UI.toast('Akhir ayat melebihi batas surat', 'error'); return; }
          db.mutqin.push({ id: Store.uid('m'), santriId, ustadzId: ustadzIdFor(santriId), tanggal: Store.todayStr(), sAwal: sA, aAwal: +m.querySelector('#m-aa').value, sAkhir: sK, aAkhir: +m.querySelector('#m-ak').value, nilai: +m.querySelector('#f-nilai').value, catatan: m.querySelector('#f-cat').value.trim(), totalHafalan: +m.querySelector('#m-total').value });
          const wUser = db.users.find(u => u.role === 'wali' && u.refId === s.waliId);
          if (wUser) Store.addNotif(wUser.id, 'wali', 'Murajaah Mutqin: ' + s.nama);
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

  /* ---------------- Notifikasi ---------------- */
  function notif() {
    const c = ctx(); _scope = c.scope;
    Shared.shell(c.role, nav('ustadz_notif'), '');
    Shared.setHeader('Notifikasi', 'Pengingat untuk ustadz');
    const session = Store.getSession();
    document.getElementById('view-content').innerHTML = Shared.renderNotifikasi(session.userId);
  }

  return { nav, dashboard, absensi, pembelajaran, riwayat, laporan, notif };
})();
