/* ============================================================
   Tahfidzku — Shared Views (shell, dashboard helpers, riwayat,
   laporan, notifikasi)
   ============================================================ */
const Shared = (() => {

  // Urutan waktu sesi absensi. dedupeKehadiran mengurutkan berdasarkan kunci,
  // jadi daftar sesi per tanggal perlu disusun ulang agar tampil kronologis.
  const URUTAN_SESI = ['Subuh', 'Ashar', 'Maghrib', 'Isya', 'Ta’lim Malam'];

  function shell(role, navItems, contentHTML) {
    const session = Store.getSession();
    const db = Store.get();
    let userName = 'Pengguna';
    if (role === 'admin') userName = 'Administrator';
    else if (role === 'ustadz') { const u = Store.findUstadz(session.refId); userName = u ? u.nama : 'Ustadz'; }
    else if (role === 'wali') { const w = Store.findWali(session.refId); userName = w ? w.nama : 'Wali'; }

    const nav = navItems.map(n => `
      <button class="nav-item ${n.active ? 'active' : ''}" data-view="${n.view}">
        ${n.label}
      </button>`).join('');

    document.getElementById('app').innerHTML = `
      <div class="app-shell">
        <div class="scrim" id="scrim"></div>
        <aside class="sidebar" id="sidebar">
          <div class="brand"><span class="logo">${UI.safeUrl(db.settings.logo) ? `<img src="${UI.esc(UI.safeUrl(db.settings.logo))}" style="width:100%;height:100%;object-fit:cover;border-radius:14px">` : ''}</span> Tahfidzku</div>
          ${nav}
          <div class="spacer"></div>
          <div class="user-box">
            <b>${UI.esc(userName)}</b>
            <span class="muted">${role.toUpperCase()}</span>
            <button class="clay-btn ghost sm" id="btn-ganti-pass" style="width:100%;margin-top:8px;justify-content:center">Ganti Password</button>
            <button class="clay-btn ghost sm" id="btn-logout" style="width:100%;margin-top:6px;justify-content:center">Keluar</button>
          </div>
        </aside>
        <main class="main">
          <div class="topbar">
            <div>
              <button class="menu-toggle" id="menu-toggle" type="button" aria-label="Buka menu navigasi" aria-controls="sidebar" aria-expanded="false">☰</button>
              <h1 id="page-title">Dashboard</h1>
              <div class="sub" id="page-sub">${UI.esc(db.settings.namaLembaga)}</div>
            </div>
            <div class="actions" id="topbar-actions">
            </div>
          </div>
          <div id="view-content">${contentHTML}</div>
        </main>
      </div>`;

    document.getElementById('btn-logout').onclick = () => {
      Store.logout(); UI.toast('Berhasil keluar', 'info'); Auth.renderLogin();
    };
    // Ganti password tersedia untuk semua role lewat kotak user ini, supaya
    // tidak harus masuk halaman Profil untuk mengubahnya.
    const gantiPassBtn = document.getElementById('btn-ganti-pass');
    if (gantiPassBtn) gantiPassBtn.onclick = () => gantiPassModal();
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const scrim = document.getElementById('scrim');
    const closeMenu = () => {
      sidebar.classList.remove('open');
      scrim.classList.remove('show');
      document.body.classList.remove('nav-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    };
    const toggleMenu = () => {
      const isOpen = sidebar.classList.toggle('open');
      scrim.classList.toggle('show', isOpen);
      document.body.classList.toggle('nav-open', isOpen);
      menuToggle.setAttribute('aria-expanded', String(isOpen));
    };
    menuToggle.onclick = toggleMenu;
    document.getElementById('scrim').onclick = () => {
      closeMenu();
    };
    document.onkeydown = (e) => { if (e.key === 'Escape') closeMenu(); };
    window.onresize = () => { if (window.innerWidth > 860) closeMenu(); };
    document.querySelectorAll('.nav-item').forEach(b => {
      b.onclick = () => { App.navigate(b.dataset.view); };
    });
  }

  function setHeader(title, sub) {
    const t = document.getElementById('page-title'); const s = document.getElementById('page-sub');
    if (t) t.textContent = title; if (s && sub) s.textContent = sub;
  }
  function setActions(html) {
    const a = document.getElementById('topbar-actions');
    if (a) a.innerHTML = html;
  }

  // Beberapa keyboard/fitur autofill ponsel tidak konsisten mengirim `input`.
  // Dengarkan event standar serta periksa perubahan nilai ketika kolom fokus,
  // sebab Chrome/WebView dapat mengisi autofill tanpa mengirim event apa pun.
  function bindSearchInput(input, onSearch) {
    if (!input || typeof onSearch !== 'function') return;
    let composing = false;
    let lastValue = input.value;
    let valuePoll = null;
    const run = (force = false) => {
      if (composing) return;
      const value = input.value;
      if (!force && value === lastValue) return;
      lastValue = value;
      onSearch();
    };
    const stopPolling = () => {
      if (valuePoll) clearInterval(valuePoll);
      valuePoll = null;
    };
    const startPolling = () => {
      stopPolling();
      let checks = 0;
      valuePoll = setInterval(() => {
        run();
        // Cukup lama untuk pilihan autofill setelah sentuhan, tanpa polling
        // terus-menerus ketika halaman dibiarkan terbuka.
        if (++checks >= 150) stopPolling();
      }, 100);
    };
    const checkAfterAutofill = () => {
      run();
      setTimeout(run, 80);
      setTimeout(run, 250);
    };
    ['input', 'change', 'search', 'keyup', 'paste', 'cut'].forEach(eventName => input.addEventListener(eventName, () => run(true)));
    input.addEventListener('compositionstart', () => { composing = true; });
    input.addEventListener('compositionend', () => { composing = false; run(true); });
    input.addEventListener('focus', () => { startPolling(); checkAfterAutofill(); });
    input.addEventListener('blur', () => { checkAfterAutofill(); stopPolling(); });
    input.addEventListener('animationstart', event => {
      if (event.animationName === 'search-autofill-detected') checkAfterAutofill();
    });
  }

  /* Ganti password sendiri. Dipakai semua role lewat tombol di kotak user
     sidebar, dan oleh halaman Profil wali. Syarat panjang minimal mengikuti
     aturan server (6 karakter) supaya pesan error dari server tidak pernah
     muncul setelah lolos validasi di sini. */
  function gantiPassModal() {
    const body = `
      ${UI.field('Password Lama', `<input class="clay-input" id="p-old" type="password" autocomplete="current-password">`)}
      ${UI.field('Password Baru', `<input class="clay-input" id="p-new" type="password" autocomplete="new-password">`)}
      ${UI.field('Ulangi Password Baru', `<input class="clay-input" id="p-new2" type="password" autocomplete="new-password">`)}
      <div class="muted" style="font-size:12px">Password baru minimal 6 karakter.</div>`;
    UI.openModal({
      title: 'Ganti Password', bodyHTML: body,
      actions: [
        { label: 'Batal', cls: 'ghost', onClick: (m, c) => c() },
        {
          label: 'Simpan', cls: 'primary',
          onClick: async (m, c) => {
            const old = m.querySelector('#p-old').value;
            const nw = m.querySelector('#p-new').value;
            const nw2 = m.querySelector('#p-new2').value;
            if (!old || !nw) { UI.toast('Isi password lama & baru', 'error'); return; }
            if (nw !== nw2) { UI.toast('Password baru tidak sama', 'error'); return; }
            if (nw.length < 6) { UI.toast('Password baru minimal 6 karakter', 'error'); return; }
            if (nw === old) { UI.toast('Password baru harus berbeda dari password lama', 'error'); return; }
            const res = await Store.changePassword(old, nw);
            if (!res.ok) { UI.toast(res.msg, 'error'); return; }
            c();
            UI.toast('Password berhasil diganti', 'success');
          }
        }
      ]
    });
  }

  /* Icons */
  const ICONS = {
    users: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    sun: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    sunset: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="9" x2="12" y2="2"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><polyline points="8 18 12 14 16 18"/></svg>',
    moon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    book: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    star: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    building: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/></svg>',
    teacher: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  };

  /* KPI stat card */
  function statCard(icon, num, label, color) {
    return `<div class="stat">
      <div class="icon" style="background:${color}22;color:${color}">${icon}</div>
      <div class="meta"><div class="num">${num}</div><div class="lbl">${label}</div></div>
    </div>`;
  }

  /* Simple bar chart from {label,value}[] */
  function barChart(data, maxVal) {
    const max = maxVal || Math.max(1, ...data.map(d => d.value));
    return `<div class="bar-chart-wrap"><div class="bar-chart">${data.map(d =>
      `<div class="bar" style="height:${Math.max(4, (d.value / max) * 100)}%" title="${UI.esc(d.label)}: ${d.value}"><span>${UI.esc(d.label)}</span></div>`
    ).join('')}</div></div>`;
  }

  function progressCircle(pct, label) {
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:8px">
      <div class="progress-circle" style="--val:${Math.round(pct)}"><span>${Math.round(pct)}%</span></div>
      <div class="muted" style="font-size:13px">${UI.esc(label)}</div>
    </div>`;
  }

  /* ---------- Peta hafalan (shared: ustadz & wali) ---------- */
  // Rank global ayat (1..total) dari surat:ayat — basis deteksi penuh/sebagian. real dari PAGE_START.
  const _rankOf = (() => {
    let cum = [0];
    for (let i = 1; i <= 114; i++) cum[i] = cum[i - 1] + getSurah(i).ayahs;
    return (s, a) => cum[Number(s) - 1] + Number(a);
  })();

  // Rentang rank ayat sebuah halaman g: [start, end] dari peta halaman↔ayat nyata.
  function pageRankRange(g) {
    const st = PAGE_START[g];
    if (!st) return null;
    const lo = _rankOf(st[0], st[1]);
    const nx = PAGE_START[g + 1];
    const hi = nx ? _rankOf(nx[0], nx[1]) - 1 : _rankOf(114, getSurah(114).ayahs);
    return [lo, hi];
  }

  // Status tiap halaman (1..600): 'full' hijau, 'part' kuning, sisanya abu-abu.
  // Hijau = ada setoran yang menutupi SELURUH rentang ayat halaman itu (sesuai peta asli).
  function hafalanStates(santriId) {
    const db = Store.get();
    const full = new Set(), part = new Set();
    const ranges = [...db.ziyadahHafalan, ...db.mutqin]
      .filter(r => r.santriId === santriId)
      .map(r => {
        const lo = _rankOf(r.sAwal, r.aAwal), hi = _rankOf(r.sAkhir, r.aAkhir);
        return lo <= hi ? [lo, hi] : [hi, lo];
      })
      .filter(Boolean);
    for (let g = 1; g <= 600; g++) {
      const pr = pageRankRange(g);
      if (!pr) continue;
      if (ranges.some(r => r[0] <= pr[0] && r[1] >= pr[1])) full.add(g);
      else if (ranges.some(r => r[1] >= pr[0] && r[0] <= pr[1])) part.add(g);
    }
    return { full, part };
  }

  // Peta hafalan ala GitHub: 30 baris juz x 20 kolom halaman.
  function hafalanMapHTML(santriId) {
    const { full, part } = hafalanStates(santriId);
    let html = '';
    for (let juz = 1; juz <= 30; juz++) {
      html += '<div style="display:flex;align-items:center;gap:3px;margin-bottom:2px">' +
        '<span style="width:38px;font-size:10px;color:var(--muted)">Juz ' + juz + '</span>';
      for (let pg = 1; pg <= 20; pg++) {
        const g = (juz - 1) * 20 + pg;
        let color = 'var(--muted)', tip = 'belum disetor';
        if (full.has(g)) { color = 'var(--success)'; tip = 'selesai disetor'; }
        else if (part.has(g)) { color = 'var(--warn)'; tip = 'disetor sebagian'; }
        html += '<span title="Juz ' + juz + ' · hal. ' + pg + ' · ' + tip + '" ' +
          'style="width:11px;height:11px;border-radius:2px;flex:0 0 11px;background:' + color + '"></span>';
      }
      html += '</div>';
    }
    return html;
  }

  /* ---------- Riwayat Santri (shared) ---------- */
  function renderRiwayat(santriId) {
    const db = Store.get();
    const s = Store.findSantri(santriId);
    if (!s) return `<div class="empty">Santri tidak ditemukan.</div>`;
    const session = Store.getSession();
    const items = [];
    db.tahsin.filter(t => t.santriId === santriId).forEach(t => items.push({
      t: t.tanggal, html: `<b>Tahsin</b> — Hal ${t.halAwal}-${t.halAkhir} · Nilai <b>${t.nilai}</b><div class="muted">${UI.esc(t.catatan || '')}</div>`,
      hapus: (session && (session.role === 'ustadz' || session.role === 'admin')) ? `<button class="clay-btn sm ghost" data-hapus="tahsin" data-id="${t.id}" style="padding:2px 8px;font-size:11px;color:var(--danger)">Hapus</button>` : ''
    }));
    db.ziyadahBacaan.filter(z => z.santriId === santriId).forEach(z => items.push({
      t: z.tanggal, html: `<b>Ziyadah Bacaan</b> — ${getSurah(z.sAwal).latin}:${z.aAwal} → ${getSurah(z.sAkhir).latin}:${z.aAkhir}`,
      hapus: (session && (session.role === 'ustadz' || session.role === 'admin')) ? `<button class="clay-btn sm ghost" data-hapus="ziyadahBacaan" data-id="${z.id}" style="padding:2px 8px;font-size:11px;color:var(--danger)">Hapus</button>` : ''
    }));
    db.ziyadahHafalan.filter(z => z.santriId === santriId).forEach(z => {
      const h = computeHafalan(z.sAwal, z.aAwal, z.sAkhir, z.aAkhir);
      items.push({
        t: z.tanggal, html: `<b>Ziyadah Hafalan</b> — ${getSurah(z.sAwal).latin}:${z.aAwal} → ${getSurah(z.sAkhir).latin}:${z.aAkhir} · <b>${formatHafalan(h)}</b> · Nilai ${z.nilai}<div class="muted">${UI.esc(z.catatan || '')}</div>`,
        hapus: (session && (session.role === 'ustadz' || session.role === 'admin')) ? `<button class="clay-btn sm ghost" data-hapus="ziyadahHafalan" data-id="${z.id}" style="padding:2px 8px;font-size:11px;color:var(--danger)">Hapus</button>` : ''
      });
    });
    db.mutqin.filter(m => m.santriId === santriId).forEach(m => {
      const h = computeHafalan(m.sAwal, m.aAwal, m.sAkhir, m.aAkhir);
      items.push({
        t: m.tanggal, html: `<b>Mutqin (Murajaah)</b> — ${getSurah(m.sAwal).latin}:${m.aAwal} → ${getSurah(m.sAkhir).latin}:${m.aAkhir} · <b>${formatHafalan(h)}</b> · Nilai ${m.nilai}<div class="muted">${UI.esc(m.catatan || '')}</div>`,
        hapus: (session && (session.role === 'ustadz' || session.role === 'admin')) ? `<button class="clay-btn sm ghost" data-hapus="mutqin" data-id="${m.id}" style="padding:2px 8px;font-size:11px;color:var(--danger)">Hapus</button>` : ''
      });
    });
    db.kehadiran.filter(k => k.santriId === santriId).forEach(k => items.push({ t: k.tanggal, html: `Kehadiran ${UI.esc(k.sesi || '')}: <span class="badge ${k.status === 'Hadir' ? 'green' : k.status === 'Izin' ? 'warn' : k.status === 'Sakit' ? 'blue' : 'danger'}">${UI.esc(k.status)}</span>`, hapus: '' }));
    db.catatan.filter(c => c.santriId === santriId).forEach(c => items.push({ t: c.tanggal, html: `<b>Catatan Ustadz:</b> ${UI.esc(c.isi)}`, hapus: '' }));

    items.sort((a, b) => b.t.localeCompare(a.t));
    if (!items.length) return `<div class="empty">Belum ada riwayat untuk ${UI.esc(s.nama)}.</div>`;
    return `<div class="timeline">${items.map(i =>
      `<div class="item"><div class="t">${UI.fmtDate(i.t)}</div><div class="d">${i.html}${i.hapus ? '<div style="margin-top:4px">' + i.hapus + '</div>' : ''}</div></div>`
    ).join('')}</div>`;
  }

  function renderPerHalaqahRiwayat(santriId, periode) {
    const db = Store.get();
    const s = Store.findSantri(santriId);
    if (!s) return `<div class="empty">Santri tidak ditemukan.</div>`;
    
    const halaqahSantri = Store.halaqahForSantri(s);
    const santri = db.santri.filter(st => halaqahSantri.some(h => Store.santriHasHalaqah(st, h)));
    if (!santri.length) return `<div class="empty">Tidak ada santri di halaqah yang sama.</div>`;
    
    const now = new Date();
    let filterFunc = (item) => true;
    if (periode === 'this-year') {
      const tahun = now.getFullYear();
      filterFunc = (item) => new Date(item.tanggal).getFullYear() === tahun;
    } else if (periode === 'this-month') {
      const bulan = now.getMonth();
      const tahun = now.getFullYear();
      filterFunc = (item) => { const d = new Date(item.tanggal); return d.getMonth() === bulan && d.getFullYear() === tahun; };
    } else if (periode === 'last-3') {
      const tigaBulanLalu = new Date();
      tigaBulanLalu.setMonth(tigaBulanLalu.getMonth() - 3);
      filterFunc = (item) => new Date(item.tanggal) >= tigaBulanLalu;
    }
    
    let periodeKehadiran = {};
    let periodeSetoran = {};
    
    santri.forEach(st => {
      // Satu sesi dapat punya catatan dari beberapa ustadz; rekap memakai satu status per sesi.
      const kehadiran = Store.dedupeKehadiran(db.kehadiran.filter(k => k.santriId === st.id));
      const tahsin = db.tahsin.filter(t => t.santriId === st.id);
      const ziyadahHafalan = db.ziyadahHafalan.filter(z => z.santriId === st.id);
      const ziyadahBacaan = db.ziyadahBacaan.filter(z => z.santriId === st.id);
      const mutqin = db.mutqin.filter(m => m.santriId === st.id);
      
      // Satu tanggal bisa punya beberapa sesi (Subuh, Ashar, Maghrib, ...).
      // Semua sesi dikumpulkan, bukan hanya satu, supaya tidak ada sesi yang
      // hilang begitu saja karena ditimpa.
      kehadiran.filter(filterFunc).forEach(k => {
        if (!periodeKehadiran[k.tanggal]) periodeKehadiran[k.tanggal] = {};
        if (!periodeKehadiran[k.tanggal][st.id]) periodeKehadiran[k.tanggal][st.id] = [];
        periodeKehadiran[k.tanggal][st.id].push(k);
      });
      tahsin.filter(filterFunc).forEach(t => {
        if (!periodeSetoran[t.tanggal]) periodeSetoran[t.tanggal] = {};
        periodeSetoran[t.tanggal][st.id] = { ...t, tipe: 'Tahsin' };
      });
      ziyadahHafalan.filter(filterFunc).forEach(z => {
        if (!periodeSetoran[z.tanggal]) periodeSetoran[z.tanggal] = {};
        periodeSetoran[z.tanggal][st.id] = { ...z, tipe: 'Ziyadah Hafalan' };
      });
      ziyadahBacaan.filter(filterFunc).forEach(z => {
        if (!periodeSetoran[z.tanggal]) periodeSetoran[z.tanggal] = {};
        periodeSetoran[z.tanggal][st.id] = { ...z, tipe: 'Ziyadah Bacaan' };
      });
      mutqin.filter(filterFunc).forEach(m => {
        if (!periodeSetoran[m.tanggal]) periodeSetoran[m.tanggal] = {};
        periodeSetoran[m.tanggal][st.id] = { ...m, tipe: 'Mutqin' };
      });
    });
    
    const tanggalList = Object.keys({ ...periodeKehadiran, ...periodeSetoran }).sort((a, b) => new Date(b) - new Date(a));
    if (!tanggalList.length) return `<div class="empty">Belum ada riwayat untuk halaqah ini.</div>`;
    
    let table = `
    <div class="clay-card" style="padding:0">
      <div class="table-wrap">
        <table class="clay-table" style="font-size:13px">
          <thead>
            <tr>
              <th class="center">Tanggal</th>
              ${santri.map(st => `<th class="center">${UI.esc(st.nama)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${tanggalList.map(tanggal => {
              let cols = `<td class="center" style="font-weight:600;white-space:nowrap">${UI.fmtDate(new Date(tanggal))}</td>`;
              santri.forEach(st => {
                const list = periodeKehadiran[tanggal] ? periodeKehadiran[tanggal][st.id] : null;
                const s = periodeSetoran[tanggal] ? periodeSetoran[tanggal][st.id] : null;
                const info = s ? (s.tipe || '') : '-';
                const badgeClass = status => status === 'Hadir' ? 'green' : status === 'Izin' ? 'warn' : status === 'Sakit' ? 'blue' : 'danger';
                const listUrut = list ? list.slice().sort((x, y) => {
                  const dx = URUTAN_SESI.indexOf(x.sesi || 'Subuh');
                  const dy = URUTAN_SESI.indexOf(y.sesi || 'Subuh');
                  return (dx < 0 ? 99 : dx) - (dy < 0 ? 99 : dy);
                }) : null;
                const absen = !listUrut || !listUrut.length
                  ? '<span class="badge gray" style="font-size:10px;padding:1px 5px">-</span>'
                  : listUrut.map(k => `<div style="line-height:1.35"><span class="muted" style="font-size:9px">${UI.esc(k.sesi || 'Subuh')}</span> <span class="badge ${badgeClass(k.status)}" style="font-size:10px;padding:1px 5px">${UI.esc(k.status)}</span></div>`).join('');
                cols += `<td style="padding:4px 6px">
                  ${absen}
                  ${info !== '-' ? `<div class="muted" style="font-size:10px;line-height:1.2">${info}</div>` : ''}
                </td>`;
              });
              return `<tr>${cols}</tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
    
    return table;
  }

  /* ---------- Laporan (shared, role-aware) ---------- */
  let _laporanFilters = {};

  const BULAN_ID = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  function bulanLabel(bulan) {
    if (!bulan) return '-';
    const parts = String(bulan).split('-');
    if (parts.length < 2) return bulan;
    return (BULAN_ID[Number(parts[1])] || parts[1]) + ' ' + parts[0];
  }

  function buildLaporanRows(filters) {
    const db = Store.get();
    const f = filters || {};
    let santri = db.santri.slice();
    if (f.halaqah) santri = santri.filter(s => Store.santriHasHalaqah(s, f.halaqah));
    if (f.level) santri = santri.filter(s => Store.santriHasProgram(s, f.level));
    if (f.tingkat) santri = santri.filter(s => Store.tingkatForSantri(s) === f.tingkat);
    // Kelas hanya bermakna di dalam tingkatnya: "7A" di SMP bukan "7A" di SD.
    // Tanpa batasan tingkat, filter ini ikut meny Santri tingkat lain yang
    // kebetulan punya nama kelas sama.
    if (f.kelas && f.tingkat) {
      santri = santri.filter(s => Store.tingkatForSantri(s) === f.tingkat
        && Store.kelasForSantri(s) === f.kelas);
    }
    if (f.status) santri = santri.filter(s => s.status === f.status);
    const bulan = f.bulan || Store.todayStr().slice(0, 7);
    return santri.map((s, i) => {
      const h = Store.totalHafalanSantri(s.id);
      const kehadiran = Store.kehadiranBulan(s.id, bulan);
      const hadirSubuh = kehadiran.filter(k => k.status === 'Hadir' && k.sesi === 'Subuh').length;
      const hadirAshar = kehadiran.filter(k => k.status === 'Hadir' && k.sesi === 'Ashar').length;
      const hadirMaghrib = kehadiran.filter(k => k.status === 'Hadir' && k.sesi === 'Maghrib').length;
      const hadirIsya = kehadiran.filter(k => k.status === 'Hadir' && k.sesi === 'Isya').length;
      const hadirTalim = kehadiran.filter(k => k.status === 'Hadir' && k.sesi === 'Ta’lim Malam').length;
      const totalHadir = hadirSubuh + hadirAshar + hadirMaghrib + hadirIsya + hadirTalim;
      const totalK = kehadiran.length;
      const pct = totalK ? Math.round((totalHadir / totalK) * 100) : 0;
      return { no: i + 1, s, hafalan: h, nilai: Store.avgNilai(s.id), hadirSubuh, hadirAshar, hadirMaghrib, hadirIsya, hadirTalim, hadir: totalHadir, totalK, pct };
    });
  }

  function renderLaporan(filters) {
    _laporanFilters = filters || {};
    const rows = buildLaporanRows(_laporanFilters);
    const bulan = _laporanFilters.bulan || Store.todayStr().slice(0, 7);
    const body = rows.map(r => `<tr>
      <td class="center">${r.no}</td>
      <td><b>${UI.esc(r.s.nama)}</b></td>
      <td>${UI.esc(r.s.nis)}</td>
      <td>${UI.esc(Store.educationLabel(r.s))}</td>
      <td>${UI.esc(Store.halaqahSummaryForSantri(r.s))}</td>
      <td>${UI.esc(Store.programSummaryForSantri(r.s))}</td>
      <td class="center">${UI.esc(r.s.jk || '-')}</td>
      <td class="center">${r.hafalan ? r.hafalan.pages + ' hlm' : '-'}</td>
      <td class="center">${r.hafalan ? (r.hafalan.juzRange === 1 ? 'Juz ' + r.hafalan.juzStart : r.hafalan.juzStart + '–' + r.hafalan.juzEnd) : '-'}</td>
      <td class="center">${r.nilai ? r.nilai : '-'}</td>
      <td class="center" style="font-size:12px">${r.hadirSubuh} ${r.hadirAshar} ${r.hadirMaghrib} ${r.hadirIsya} ${r.hadirTalim}</td>
      <td class="center">${r.hadir}/${r.totalK} (${r.pct}%)</td>
      <td><span class="badge ${r.s.status === 'Aktif' ? 'green' : 'gray'}">${UI.esc(r.s.status)}</span></td>
    </tr>`).join('');
    return `<div class="clay-card">
      <div class="section-title"> Laporan Santri — ${UI.esc(bulanLabel(bulan))}</div>
      <div class="table-wrap">
        <table class="clay-table" id="laporan-table">
          <thead><tr><th class="center">No</th><th>Santri</th><th>NIS</th><th>Tingkat & Kelas</th><th>Halaqah</th><th>Level</th><th class="center">JK</th><th class="center">Total Hafalan</th><th class="center">Juz</th><th class="center">Rata² Nilai</th><th class="center">Subuh / Ashar / Maghrib / Isya / Ta'lim</th><th class="center">Kehadiran (${UI.esc(bulanLabel(bulan))})</th><th>Status</th></tr></thead>
          <tbody>${body || `<tr><td colspan="13"><div class="empty">Tidak ada data.</div></td></tr>`}</tbody>
        </table>
      </div>
      <div class="row mt">
        <button class="clay-btn secondary" id="export-excel">Export Excel</button>
        <button class="clay-btn" id="export-pdf"> Print / PDF</button>
      </div>
    </div>`;
  }

  function bindLaporanExport() {
    const ex = document.getElementById('export-excel');
    const pdf = document.getElementById('export-pdf');
    if (ex) ex.onclick = () => exportLaporanExcel(_laporanFilters);
    if (pdf) pdf.onclick = () => window.print();
  }

  function downloadExcel(filename, html) {
    const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.xls';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  }

  function xlsxEscape(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function xlsxColumnName(index) {
    let value = index + 1;
    let result = '';
    while (value > 0) {
      const remainder = (value - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      value = Math.floor((value - 1) / 26);
    }
    return result;
  }

  function xlsxBytes(value) { return new TextEncoder().encode(value); }
  function xlsxU16(value) { return new Uint8Array([value & 255, (value >>> 8) & 255]); }
  function xlsxU32(value) { return new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]); }

  function xlsxJoin(parts) {
    const size = parts.reduce((total, part) => total + part.length, 0);
    const output = new Uint8Array(size);
    let offset = 0;
    parts.forEach(part => { output.set(part, offset); offset += part.length; });
    return output;
  }

  const XLSX_CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let value = i;
      for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xEDB88320 : 0);
      table[i] = value >>> 0;
    }
    return table;
  })();

  function xlsxCrc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ XLSX_CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function xlsxZip(entries) {
    const local = [];
    const central = [];
    let offset = 0;
    entries.forEach(entry => {
      const name = xlsxBytes(entry.name);
      const data = xlsxBytes(entry.data);
      const crc = xlsxCrc32(data);
      const header = xlsxJoin([
        xlsxU32(0x04034B50), xlsxU16(20), xlsxU16(0x0800), xlsxU16(0), xlsxU16(0), xlsxU16(0),
        xlsxU32(crc), xlsxU32(data.length), xlsxU32(data.length), xlsxU16(name.length), xlsxU16(0), name, data
      ]);
      local.push(header);
      central.push(xlsxJoin([
        xlsxU32(0x02014B50), xlsxU16(20), xlsxU16(20), xlsxU16(0x0800), xlsxU16(0), xlsxU16(0), xlsxU16(0),
        xlsxU32(crc), xlsxU32(data.length), xlsxU32(data.length), xlsxU16(name.length), xlsxU16(0), xlsxU16(0),
        xlsxU16(0), xlsxU16(0), xlsxU32(0), xlsxU32(offset), name
      ]));
      offset += header.length;
    });
    const centralBytes = xlsxJoin(central);
    return xlsxJoin([...local, centralBytes, xlsxU32(0x06054B50), xlsxU16(0), xlsxU16(0), xlsxU16(entries.length), xlsxU16(entries.length), xlsxU32(centralBytes.length), xlsxU32(offset), xlsxU16(0)]);
  }

  function xlsxSheetXml(sheet) {
    const columns = sheet.columns || [];
    const values = [columns.map(column => column.label), ...(sheet.rows || []).map(row => columns.map(column => typeof column.value === 'function' ? column.value(row) : row[column.key]))];
    const rows = values.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => {
      const ref = xlsxColumnName(columnIndex) + (rowIndex + 1);
      const style = rowIndex === 0 ? ' s="1"' : '';
      if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xlsxEscape(value)}</t></is></c>`;
    }).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;
  }

  function xlsxSheetName(name, used) {
    const base = String(name || 'Data').replace(/[\\/*?:\[\]]/g, ' ').trim().slice(0, 31) || 'Data';
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base.slice(0, 28)} ${suffix++}`;
    }
    used.add(candidate);
    return candidate;
  }

  function downloadXlsx(filename, sheets) {
    const usedNames = new Set();
    const normalizedSheets = (sheets || []).filter(sheet => sheet && Array.isArray(sheet.columns)).map(sheet => Object.assign({}, sheet, { name: xlsxSheetName(sheet.name, usedNames) }));
    if (!normalizedSheets.length) { UI.toast('Tidak ada data untuk diunduh', 'error'); return null; }
    const sheetEntries = normalizedSheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: xlsxSheetXml(sheet) }));
    const workbookSheets = normalizedSheets.map((sheet, index) => `<sheet name="${xlsxEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
    const workbookRels = normalizedSheets.map((sheet, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
    const overrides = normalizedSheets.map((sheet, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
    const entries = [
      { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}</Types>` },
      { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}<Relationship Id="rId${normalizedSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
      ...sheetEntries
    ];
    const blob = new Blob([xlsxZip(entries)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename.toLowerCase().endsWith('.xlsx') ? filename : filename + '.xlsx';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => { anchor.remove(); URL.revokeObjectURL(url); }, 1000);
    return blob;
  }

  /* Export laporan sebagai file Excel (.xls) — 1 baris per santri, siap jadi laporan bulanan */
  function exportLaporanExcel(filters) {
    const db = Store.get();
    const f = filters || {};
    const bulan = f.bulan || Store.todayStr().slice(0, 7);
    const rows = buildLaporanRows(f);
    if (!rows.length) { UI.toast('Tidak ada data untuk diekspor', 'error'); return; }
    const rowsHtml = rows.map(r => `<tr>
      <td class="center">${r.no}</td>
      <td>${UI.esc(r.s.nama)}</td>
      <td>${UI.esc(r.s.nis)}</td>
      <td>${UI.esc(Store.educationLabel(r.s))}</td>
      <td>${UI.esc(Store.halaqahSummaryForSantri(r.s))}</td>
      <td>${UI.esc(Store.programSummaryForSantri(r.s))}</td>
      <td class="center">${UI.esc(r.s.jk || '-')}</td>
      <td class="center">${r.hafalan ? r.hafalan.pages : 0}</td>
      <td class="center">${r.hafalan ? (r.hafalan.juzRange === 1 ? r.hafalan.juzStart : r.hafalan.juzStart + '-' + r.hafalan.juzEnd) : '-'}</td>
      <td class="center">${r.nilai || 0}</td>
      <td class="center">${r.hadirSubuh}</td>
      <td class="center">${r.hadirAshar}</td>
      <td class="center">${r.hadirMaghrib}</td>
      <td class="center">${r.hadirIsya}</td>
      <td class="center">${r.hadirTalim}</td>
      <td class="center">${r.hadir}</td>
      <td class="center">${r.totalK}</td>
      <td class="center">${r.pct}%</td>
      <td>${UI.esc(r.s.status)}</td>
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
</style></head><body>
  <div class="title">LAPORAN BULANAN TAHFIDZ</div>
  <div class="sub">${UI.esc(db.settings.namaLembaga)}</div>
  <div class="sub">Periode: ${UI.esc(bulanLabel(bulan))}</div>
  <table>
    <thead><tr>
      <th class="center">No</th><th>Nama Santri</th><th>NIS</th><th>Tingkat &amp; Kelas</th><th>Halaqah</th><th>Level</th><th class="center">JK</th>
      <th class="center">Total Hafalan (hlm)</th><th class="center">Juz</th><th class="center">Rata² Nilai</th>
      <th class="center">Subuh</th><th class="center">Ashar</th><th class="center">Maghrib</th><th class="center">Isya</th><th class="center">Ta’lim Malam</th>
      <th class="center">Total Hadir</th><th class="center">Total Kehadiran</th><th class="center">%</th><th>Status</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body></html>`;
    downloadExcel('Laporan_Tahfidz_' + bulan, html);
    UI.toast('Berhasil export Excel', 'success');
  }

  /* Download template Excel kosong (header + 1 baris contoh) untuk import massal */
  function downloadTemplateExcel(filename, headers, sample, note) {
    const head = headers.map(h => `<th>${UI.esc(h)}</th>`).join('');
    const samp = sample.map(r => `<tr>${r.map(c => `<td>${UI.esc(c)}</td>`).join('')}</tr>`).join('');
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>
  table{border-collapse:collapse;font-family:Calibri,Arial;font-size:11pt}
  th,td{border:1px solid #999;padding:5px 8px}
  th{background:#16a34a;color:#fff}
</style></head><body>
  ${note ? `<div style="font-family:Calibri;font-size:11pt;color:#555;margin-bottom:6px">${UI.esc(note)}</div>` : ''}
  <table><thead><tr>${head}</tr></thead><tbody>${samp}</tbody></table>
</body></html>`;
    downloadExcel(filename, html);
    UI.toast('Template berhasil didownload', 'success');
  }

  /* ---------- Rekap setoran mingguan ---------- */
  const HARI_SETORAN = [
    { label: 'Sen', offset: 0 }, { label: 'Sel', offset: 1 },
    { label: 'Rab', offset: 2 }, { label: 'Kam', offset: 3 },
    { label: 'Jum', offset: 4 }
  ];
  const JENIS_SETORAN = {
    tahsin: 'Tahsin',
    ziyadahBacaan: 'Ziyadah Bacaan',
    ziyadahHafalan: 'Ziyadah Hafalan',
    mutqin: 'Mutqin'
  };

  function jenisSetoranUntukProgram(programs) {
    const types = [];
    if (programs.includes('Tahsin')) types.push('tahsin');
    if (programs.includes('Ziyadah')) types.push('ziyadahBacaan', 'ziyadahHafalan');
    if (programs.includes('Mutqin')) types.push('mutqin');
    return types;
  }

  function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Nilai input boleh hari apa saja; laporan selalu dimulai dari hari Senin.
  function mondayOf(value) {
    const source = /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : Store.todayStr();
    const date = new Date(source + 'T12:00:00');
    const day = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    return dateKey(date);
  }

  function weeklyDepositGroups(filters) {
    const db = Store.get();
    const f = filters || {};
    const week = mondayOf(f.week);
    const start = new Date(week + 'T12:00:00');
    const days = HARI_SETORAN.map(h => {
      const date = new Date(start);
      date.setDate(start.getDate() + h.offset);
      return { ...h, tanggal: dateKey(date) };
    });
    const setoran = new Map();
    Object.keys(JENIS_SETORAN).forEach(type => {
      (db[type] || []).forEach(record => {
        if (!record.santriId || !record.tanggal) return;
        const key = record.santriId + '|' + record.tanggal;
        const existing = setoran.get(key) || [];
        if (!existing.includes(type)) existing.push(type);
        setoran.set(key, existing);
      });
    });
    let halaqah = db.halaqah.slice();
    if (f.halaqah) halaqah = halaqah.filter(h => h.nama === f.halaqah);
    if (f.ustadzId) halaqah = halaqah.filter(h => Store.ustadzIdsForHalaqah(h).includes(f.ustadzId));
    const today = Store.todayStr();
    const groups = halaqah.map(h => {
      const santri = db.santri
        .filter(s => Store.santriHasHalaqah(s, h) && s.status !== 'Nonaktif')
        .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
      const rows = santri.map(s => {
        const programs = Store.programsForSantriHalaqah(s, h);
        const relevantTypes = jenisSetoranUntukProgram(programs);
        const cells = days.map(day => {
          const types = (setoran.get(s.id + '|' + day.tanggal) || []).filter(type => relevantTypes.includes(type));
          if (day.tanggal > today) return { status: 'future', types: [] };
          return types.length ? { status: 'submitted', types } : { status: 'missing', types: [] };
        });
        return { s, programs, cells, missing: cells.filter(c => c.status === 'missing').length };
      });
      return { h, rows };
    });
    return { week, days, groups };
  }

  function renderRekapSetoranMingguan(filters) {
    const recap = weeklyDepositGroups(filters);
    const allowMakeup = !!(filters && filters.allowMakeup);
    const allowJpgDownload = !!(filters && filters.allowJpgDownload);
    const weekEnd = recap.days[recap.days.length - 1].tanggal;
    const groups = recap.groups.map(group => {
      const body = group.rows.map((row, index) => {
        const cells = row.cells.map((cell, dayIndex) => {
          if (cell.status === 'future') return '<td class="center"><span class="badge gray">—</span></td>';
          if (cell.status === 'submitted') {
            const title = cell.types.map(type => JENIS_SETORAN[type]).join(', ');
            return `<td class="center" title="${UI.esc(title)}"><span class="badge green">✓</span></td>`;
          }
          if (allowMakeup) {
            const tanggal = recap.days[dayIndex].tanggal;
            const label = tanggal < Store.todayStr() ? 'Bayar' : 'Setor';
            return `<td class="center"><button class="clay-btn sm secondary" data-bayar-setoran data-santri-id="${UI.esc(row.s.id)}" data-tanggal="${UI.esc(tanggal)}" data-programs="${UI.esc(row.programs.join(','))}" style="padding:3px 7px;font-size:11px">${label}</button></td>`;
          }
          return '<td class="center"><span class="badge danger">Belum</span></td>';
        }).join('');
        return `<tr>
          <td class="center">${index + 1}</td>
          <td><b>${UI.esc(row.s.nama)}</b><div class="muted" style="font-size:12px">${UI.esc(row.s.nis || '-')}</div></td>
          <td>${UI.esc(Store.programSummaryForSantri(row.s) || '-')}</td>
          ${cells}
          <td class="center"><b>${row.missing}</b></td>
        </tr>`;
      }).join('');
      return `<div class="clay-card mb">
        <div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:12px">
          <div><div class="section-title" style="margin:0">${UI.esc(group.h.nama)}</div><div class="muted" style="font-size:12px">Ustadz: ${UI.esc(Store.ustadzNamesForHalaqah(group.h).join(', ') || 'Belum ditetapkan')} · ${group.rows.length} santri aktif</div></div>
          <div class="row" style="gap:8px;align-items:center">
            ${allowJpgDownload ? `<button class="clay-btn sm secondary" type="button" data-download-rekap-jpg data-halaqah-id="${UI.esc(group.h.id)}">⬇ Unduh JPG</button>` : ''}
            <span class="badge blue">${UI.esc(group.h.level || '-')}</span>
          </div>
        </div>
        <div class="table-wrap"><table class="clay-table">
          <thead><tr><th class="center">No</th><th>Santri</th><th>Level</th>${recap.days.map(day => `<th class="center">${day.label}<br><span style="font-weight:400;font-size:11px">${day.tanggal.slice(8)}</span></th>`).join('')}<th class="center">Belum</th></tr></thead>
          <tbody>${body || '<tr><td colspan="9"><div class="empty">Belum ada santri aktif di halaqah ini.</div></td></tr>'}</tbody>
        </table></div>
      </div>`;
    }).join('');
    return `<div class="mb">
      <div class="muted" style="font-size:13px;margin:0 0 12px">Pekan ${UI.esc(UI.fmtDate(recap.week))}–${UI.esc(UI.fmtDate(weekEnd))}. <span class="badge green">✓</span> sudah setoran; <span class="badge danger">Belum</span> belum setoran.${allowMakeup ? ' Klik <b>Bayar</b> untuk mencatat setoran pada tanggal yang terlewat.' : ''} Setoran dihitung dari Tahsin, Ziyadah Bacaan, Ziyadah Hafalan, dan Mutqin.</div>
      ${groups || '<div class="empty">Tidak ada halaqah yang sesuai dengan filter.</div>'}
    </div>`;
  }

  function bindRekapSetoranBayar(onPay) {
    document.querySelectorAll('[data-bayar-setoran]').forEach(button => {
      button.onclick = () => onPay({
        santriId: button.dataset.santriId,
        tanggal: button.dataset.tanggal,
        programs: (button.dataset.programs || '').split(',').filter(Boolean)
      });
    });
  }

  function safeFilename(value) {
    return (value || 'halaqah')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'halaqah';
  }

  function canvasRoundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function canvasText(ctx, value, x, y, maxWidth) {
    const text = String(value || '-');
    if (ctx.measureText(text).width <= maxWidth) {
      ctx.fillText(text, x, y);
      return;
    }
    let clipped = text;
    while (clipped && ctx.measureText(clipped + '…').width > maxWidth) clipped = clipped.slice(0, -1);
    ctx.fillText((clipped || '').trimEnd() + '…', x, y);
  }

  function downloadRekapSetoranJpg(filters, halaqahId) {
    const recap = weeklyDepositGroups(filters);
    const group = recap.groups.find(item => item.h.id === halaqahId);
    if (!group) {
      UI.toast('Data halaqah tidak ditemukan', 'error');
      return;
    }

    const logicalWidth = 1600;
    const padding = 64;
    const headerHeight = 226;
    const tableHeaderHeight = 58;
    const rowHeight = 58;
    const footerHeight = 82;
    const logicalHeight = headerHeight + tableHeaderHeight + Math.max(group.rows.length, 1) * rowHeight + footerHeight;
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = logicalWidth * scale;
    canvas.height = logicalHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    const tableWidth = logicalWidth - (padding * 2);
    const noWidth = 70;
    const nameWidth = 420;
    const programWidth = 260;
    const missingWidth = 105;
    const dayWidth = (tableWidth - noWidth - nameWidth - programWidth - missingWidth) / recap.days.length;
    const columns = [
      { label: 'No', width: noWidth, align: 'center' },
      { label: 'Santri', width: nameWidth, align: 'left' },
      { label: 'Program', width: programWidth, align: 'left' },
      ...recap.days.map(day => ({ label: day.label, sublabel: day.tanggal.slice(8), width: dayWidth, align: 'center' })),
      { label: 'Belum', width: missingWidth, align: 'center' }
    ];

    ctx.fillStyle = '#f3f7f4';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, 0, logicalWidth, 18);

    ctx.fillStyle = '#166534';
    ctx.font = '700 27px Poppins, Arial, sans-serif';
    ctx.fillText('TAHFIDZKU', padding, 67);
    ctx.fillStyle = '#1f2937';
    ctx.font = '700 35px Poppins, Arial, sans-serif';
    ctx.fillText('Rekap Setoran Mingguan', padding, 116);
    ctx.fillStyle = '#166534';
    ctx.font = '700 25px Poppins, Arial, sans-serif';
    canvasText(ctx, group.h.nama, padding, 157, 900);
    ctx.fillStyle = '#4b5563';
    ctx.font = '500 18px Inter, Arial, sans-serif';
    const weekEnd = recap.days[recap.days.length - 1].tanggal;
    canvasText(ctx, `Pekan ${UI.fmtDate(recap.week)}–${UI.fmtDate(weekEnd)}`, padding, 190, 690);
    canvasText(ctx, `Ustadz: ${Store.ustadzNamesForHalaqah(group.h).join(', ') || 'Belum ditetapkan'}`, padding + 720, 190, logicalWidth - padding - (padding + 720));

    const tableY = headerHeight;
    ctx.fillStyle = '#166534';
    canvasRoundedRect(ctx, padding, tableY, tableWidth, tableHeaderHeight, 12);
    ctx.fill();
    let x = padding;
    columns.forEach(column => {
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 17px Inter, Arial, sans-serif';
      ctx.textAlign = column.align === 'center' ? 'center' : 'left';
      const textX = column.align === 'center' ? x + (column.width / 2) : x + 15;
      ctx.fillText(column.label, textX, tableY + 25);
      if (column.sublabel) {
        ctx.font = '500 14px Inter, Arial, sans-serif';
        ctx.fillText(column.sublabel, textX, tableY + 46);
      }
      x += column.width;
    });

    const rows = group.rows.length ? group.rows : [{ empty: true }];
    rows.forEach((row, index) => {
      const y = tableY + tableHeaderHeight + (index * rowHeight);
      ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f7fbf8';
      ctx.fillRect(padding, y, tableWidth, rowHeight);
      ctx.strokeStyle = '#dce7df';
      ctx.lineWidth = 1;
      ctx.strokeRect(padding, y, tableWidth, rowHeight);
      if (row.empty) {
        ctx.fillStyle = '#6b7280';
        ctx.font = '500 18px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Belum ada santri aktif di halaqah ini.', logicalWidth / 2, y + 36);
        return;
      }
      let cellX = padding;
      columns.forEach((column, columnIndex) => {
        ctx.strokeStyle = '#e3ece5';
        ctx.beginPath();
        ctx.moveTo(cellX, y);
        ctx.lineTo(cellX, y + rowHeight);
        ctx.stroke();
        const centerX = cellX + (column.width / 2);
        if (columnIndex === 0) {
          ctx.fillStyle = '#374151';
          ctx.font = '600 17px Inter, Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(String(index + 1), centerX, y + 36);
        } else if (columnIndex === 1) {
          ctx.fillStyle = '#1f2937';
          ctx.font = '700 17px Poppins, Arial, sans-serif';
          ctx.textAlign = 'left';
          canvasText(ctx, row.s.nama, cellX + 14, y + 25, column.width - 28);
          ctx.fillStyle = '#6b7280';
          ctx.font = '500 13px Inter, Arial, sans-serif';
          canvasText(ctx, row.s.nis || '-', cellX + 14, y + 45, column.width - 28);
        } else if (columnIndex === 2) {
          ctx.fillStyle = '#374151';
          ctx.font = '500 15px Inter, Arial, sans-serif';
          ctx.textAlign = 'left';
          canvasText(ctx, Store.programSummaryForSantri(row.s) || '-', cellX + 14, y + 36, column.width - 28);
        } else if (columnIndex === columns.length - 1) {
          ctx.fillStyle = row.missing ? '#b91c1c' : '#15803d';
          ctx.font = '700 18px Inter, Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(String(row.missing), centerX, y + 36);
        } else {
          const dayIndex = columnIndex - 3;
          const cell = row.cells[dayIndex];
          ctx.textAlign = 'center';
          if (cell.status === 'submitted') {
            ctx.fillStyle = '#dcfce7';
            ctx.beginPath(); ctx.arc(centerX, y + 29, 16, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#15803d';
            ctx.font = '700 22px Arial, sans-serif';
            ctx.fillText('✓', centerX, y + 37);
          } else if (cell.status === 'future') {
            ctx.fillStyle = '#6b7280';
            ctx.font = '600 20px Inter, Arial, sans-serif';
            ctx.fillText('—', centerX, y + 36);
          } else {
            ctx.fillStyle = '#b91c1c';
            ctx.font = '600 15px Inter, Arial, sans-serif';
            ctx.fillText('Belum', centerX, y + 35);
          }
        }
        cellX += column.width;
      });
    });

    ctx.fillStyle = '#4b5563';
    ctx.font = '500 16px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    const footerY = tableY + tableHeaderHeight + rows.length * rowHeight + 43;
    ctx.fillText('✓ Sudah setoran    •    Belum: belum setoran    •    — Tanggal mendatang', padding, footerY);
    ctx.textAlign = 'right';
    ctx.fillText(`Diunduh ${UI.fmtDate(Store.todayStr())}`, logicalWidth - padding, footerY);

    canvas.toBlob(blob => {
      if (!blob) {
        UI.toast('Gagal membuat gambar rekap', 'error');
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Rekap_Setoran_${safeFilename(group.h.nama)}_${recap.week}.jpg`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      UI.toast('Rekap JPG berhasil diunduh', 'success');
    }, 'image/jpeg', 0.92);
  }

  function bindRekapSetoranJpgDownload(filters) {
    document.querySelectorAll('[data-download-rekap-jpg]').forEach(button => {
      button.onclick = () => downloadRekapSetoranJpg(filters, button.dataset.halaqahId);
    });
  }

  /* ---------- Notifikasi (shared) ---------- */
  function renderNotifikasi(userId) {
    const list = Store.notifFor(userId);
    if (!list.length) return `<div class="empty">Belum ada notifikasi.</div>`;
    const icon = { wali: '', ustadz: '', admin: '' };
    return `<div class="clay-card" id="notif-card">
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="section-title" style="margin:0">Notifikasi</div>
        <button class="clay-btn sm ghost" id="clear-notif" style="color:var(--danger)">Hapus Semua</button>
      </div>
      ${list.map(n =>
      `<div class="row center" style="justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee">
        <div class="row center" style="gap:10px"><span style="font-size:20px">${icon[n.tipe] || ''}</span>
        <div><div>${UI.esc(n.pesan)}</div><div class="muted" style="font-size:12px">${UI.fmtDateTime(n.tanggal)}</div></div></div>
        ${n.read ? '' : '<span class="badge blue">Baru</span>'}
      </div>`).join('')}
    </div>`;
  }

  return { shell, setHeader, setActions, bindSearchInput, gantiPassModal, statCard, barChart, progressCircle, renderRiwayat, renderPerHalaqahRiwayat, renderLaporan, bindLaporanExport, exportLaporanExcel, downloadExcel, downloadXlsx, downloadTemplateExcel, bulanLabel, mondayOf, renderRekapSetoranMingguan, bindRekapSetoranBayar, bindRekapSetoranJpgDownload, renderNotifikasi, ICONS, hafalanMapHTML };
})();
