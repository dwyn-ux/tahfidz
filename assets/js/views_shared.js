/* ============================================================
   Tahfidzku — Shared Views (shell, dashboard helpers, riwayat,
   laporan, notifikasi)
   ============================================================ */
const Shared = (() => {

  // Urutan waktu sesi absensi. dedupeKehadiran mengurutkan berdasarkan kunci,
  // jadi daftar sesi per tanggal perlu disusun ulang agar tampil kronologis.
  const URUTAN_SESI = ['Subuh', 'Ashar', 'Maghrib', 'Isya'];

  function shell(role, navItems, contentHTML) {
    const session = Store.getSession();
    const db = Store.get();
    let userName = 'Pengguna';
    if (role === 'superuser') userName = 'Superuser';
    else if (role === 'admin') userName = 'Administrator';
    else if (role === 'pengawas') userName = 'Pengawas';
    else if (role === 'ustadz') { const u = Store.findUstadz(session.refId); userName = u ? u.nama : 'Ustadz'; }
    else if (role === 'wali') { const w = Store.findWali(session.refId); userName = w ? w.nama : 'Wali'; }

    // Buang header grup kosong bila seluruh item di bawahnya disembunyikan fitur.
    const cleanNav = (navItems || []).filter((item, idx, arr) => {
      if (!item.group) return true;
      for (let i = idx + 1; i < arr.length; i++) {
        if (arr[i].group) return false;
        return true;
      }
      return false;
    });

    let nav = '';
    let inGrid = false;
    cleanNav.forEach(n => {
      if (n.group) {
        if (inGrid) nav += '</div>';
        nav += `<div class="nav-section-title">${UI.esc(n.group)}</div><div class="nav-section-grid">`;
        inGrid = true;
      } else {
        if (!inGrid) { nav += '<div class="nav-section-grid">'; inGrid = true; }
        nav += `
          <button class="nav-item ${n.active ? 'active' : ''}" data-view="${n.view}">
            ${n.icon ? `<span class="nav-ico">${n.icon}</span>` : ''}
            <span class="nav-text">${n.label}</span>
          </button>`;
      }
    });
    if (inGrid) nav += '</div>';

    // Bottom Navbar per Role (tampil di web desktop & HP, hingga 4 pintasan aktif + tombol Menu)
    const activeNav = cleanNav.find(n => n.active);
    const activeViewKey = activeNav ? activeNav.view : '';
    const hasFeat = (k) => (role === 'superuser' || typeof Store.hasFeature !== 'function' || Store.hasFeature(k));
    const bFeat = {
      admin_live_monitor: 'liveMonitor',
      admin_absensi_ustadz: 'presensi',
      admin_rekap_setoran: 'rekapSetoran',
      admin_raport: 'raport',
      admin_spp: 'spp',
      ustadz_absensi: 'presensi',
      ustadz_rekap_setoran: 'rekapSetoran',
      ustadz_laporan_murojaah: 'murojaah',
      ustadz_raport: 'raport',
      wali_absensi: 'presensi',
      wali_raport: 'raport',
      wali_spp: 'spp',
      quran: 'quran'
    };
    const roleShortcuts = {
      superuser: [
        { view: 'superuser_panel', label: 'Kontrol', icon: icon('settings') },
        { view: 'quran', label: 'Al-Qur’an', icon: icon('quran') }
      ],
      wali: [
        { view: 'wali_dashboard', label: 'Beranda', icon: icon('dashboard') },
        { view: 'wali_perkembangan', label: 'Capaian', icon: icon('laporan') },
        { view: 'wali_raport', label: 'Raport', icon: icon('award') },
        { view: 'wali_spp', label: 'SPP', icon: icon('award') },
        { view: 'wali_absensi', label: 'Presensi', icon: icon('calendar') },
        { view: 'wali_catatan', label: 'Catatan', icon: icon('chat') }
      ],
      ustadz: [
        { view: 'ustadz_dashboard', label: 'Beranda', icon: icon('dashboard') },
        { view: 'ustadz_pembelajaran', label: 'Setoran', icon: icon('setoran') },
        { view: 'ustadz_absensi', label: 'Presensi', icon: icon('presensi') },
        { view: 'ustadz_raport', label: 'Raport', icon: icon('award') },
        { view: 'ustadz_rekap_setoran', label: 'Rekap', icon: icon('setoran') },
        { view: 'ustadz_riwayat', label: 'Riwayat', icon: icon('riwayat') }
      ],
      admin: [
        { view: 'admin_dashboard', label: 'Beranda', icon: icon('dashboard') },
        { view: 'admin_santri', label: 'Santri', icon: icon('users') },
        { view: 'admin_spp', label: 'SPP', icon: icon('award') },
        { view: 'admin_raport', label: 'Raport', icon: icon('award') },
        { view: 'admin_rekap_setoran', label: 'Setoran', icon: icon('setoran') },
        { view: 'admin_live_monitor', label: 'Live', icon: icon('monitor') },
        { view: 'admin_absensi_ustadz', label: 'Presensi', icon: icon('presensi') },
        { view: 'admin_halaqah', label: 'Halaqah', icon: icon('halaqah') }
      ],
      pengawas: [
        { view: 'admin_live_monitor', label: 'Live', icon: icon('monitor') },
        { view: 'admin_dashboard', label: 'Beranda', icon: icon('dashboard') },
        { view: 'admin_rekap_setoran', label: 'Setoran', icon: icon('setoran') },
        { view: 'admin_raport', label: 'Raport', icon: icon('award') },
        { view: 'admin_riwayat', label: 'Riwayat', icon: icon('riwayat') }
      ]
    };
    const quickViews = (roleShortcuts[role] || []).filter(b => !bFeat[b.view] || hasFeat(bFeat[b.view])).slice(0, 4);
    const bNavItems = [...quickViews, { action: 'menu', label: 'Menu', icon: icon('menu') }];
    const inQuickBar = quickViews.some(b => b.view === activeViewKey);

    const bottomNavHtml = bNavItems.length ? `
      <nav class="bottom-nav" id="bottom-nav" aria-label="Navigasi Bawah">
        ${bNavItems.map(b => {
          const isActive = (b.view && b.view === activeViewKey) || (b.action === 'menu' && activeViewKey && !inQuickBar);
          return `
            <button class="bottom-nav-item ${isActive ? 'active' : ''}" ${b.view ? `data-view="${b.view}"` : `data-action="${b.action}"`} type="button" aria-label="${b.label}">
              <span class="b-ico">${b.icon}</span>
              <span class="b-lbl">${b.label}</span>
            </button>
          `;
        }).join('')}
      </nav>
    ` : '';

    document.getElementById('app').innerHTML = `
      <div class="app-shell">
        <div class="scrim" id="scrim"></div>
        <aside class="sidebar" id="sidebar">
          <div class="brand">
            <span class="logo">${UI.safeUrl(db.settings.logo) ? `<img src="${UI.esc(UI.safeUrl(db.settings.logo))}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">` : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`}</span>
            <div style="line-height:1.2;flex:1;min-width:0">
              <div style="font-size:16px;font-weight:700;color:var(--text);letter-spacing:-0.3px">Tahfidzku</div>
              <div class="muted" style="font-size:11px;font-weight:normal">Manajemen Tahfidz</div>
            </div>
            <button class="clay-btn sm ghost" id="btn-close-sidebar" type="button" aria-label="Tutup menu" style="padding:4px 9px;font-size:15px">✕</button>
          </div>
          <div class="nav-container">
            ${nav}
          </div>
          <div class="user-box">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <div class="user-avatar">${userName.slice(0, 1).toUpperCase()}</div>
              <div style="flex:1;min-width:0;line-height:1.2">
                <b style="display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${UI.esc(userName)}</b>
                <span class="badge sm ${role === 'superuser' ? 'purple' : role === 'admin' ? 'blue' : role === 'ustadz' ? 'green' : 'gray'}" style="margin-top:2px">${role.toUpperCase()}</span>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
              <button class="clay-btn ghost sm" id="btn-ganti-pass" title="Ganti Password" style="justify-content:center;padding:5px 6px;font-size:11.5px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg> Sandi</button>
              <button class="clay-btn danger ghost sm" id="btn-logout" title="Keluar" style="justify-content:center;padding:5px 6px;font-size:11.5px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Keluar</button>
            </div>
            <button class="clay-btn primary sm pwa-install-btn" id="btn-pwa-install" style="width:100%;margin-top:6px;justify-content:center;display:none;background:var(--primary);color:#fff;font-size:11.5px;padding:6px">Install Aplikasi</button>
          </div>
        </aside>
        <main class="main">
          <div class="topbar">
            <div style="display:flex;align-items:center;gap:12px">
              <button class="menu-toggle" id="menu-toggle" type="button" aria-label="Buka menu navigasi" aria-controls="sidebar" aria-expanded="false"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg><span>Menu</span></button>
              <div>
                <h1 id="page-title">Dashboard</h1>
                <div class="sub" id="page-sub">${UI.esc(db.settings.namaLembaga)}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              ${Store.hasFeature('notifikasi') ? `<button class="clay-btn sm ghost" id="btn-topbar-notif-perm" title="Notifikasi Sistem" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:6px 10px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> <span id="topbar-notif-label">Notif</span>
              </button>` : ''}
              <div class="actions" id="topbar-actions"></div>
            </div>
          </div>
          <div id="view-content">${contentHTML}</div>
        </main>
        ${bottomNavHtml}
      </div>`;

    // PWA Install & Notifikasi
    const pwaInstallBtn = document.getElementById('btn-pwa-install');
    if (pwaInstallBtn) pwaInstallBtn.onclick = () => PWA.promptInstall();

    const notifBtn = document.getElementById('btn-topbar-notif-perm');
    const notifLabel = document.getElementById('topbar-notif-label');
    const updateNotifBtnUI = () => {
      if (!notifBtn || typeof PWA === 'undefined') return;
      const perm = PWA.getNotificationPermission();
      if (perm === 'granted') {
        notifBtn.title = 'Notifikasi Perangkat: Aktif (Klik untuk tes)';
        if (notifLabel) notifLabel.innerHTML = '<span style="color:#16a34a;font-weight:600">Aktif</span>';
      } else if (perm === 'denied') {
        notifBtn.title = 'Notifikasi Perangkat: Diblokir di browser';
        if (notifLabel) notifLabel.innerHTML = '<span style="color:#dc2626">Mati</span>';
      } else {
        notifBtn.title = 'Aktifkan Notifikasi Perangkat';
        if (notifLabel) notifLabel.textContent = 'Aktifkan';
      }
    };
    if (notifBtn) {
      notifBtn.onclick = async () => {
        const perm = PWA.getNotificationPermission();
        if (perm === 'granted') {
          PWA.testNotification();
        } else {
          await PWA.requestNotificationPermission();
          updateNotifBtnUI();
        }
      };
      updateNotifBtnUI();
    }
    if (typeof PWA !== 'undefined' && PWA.renderInstallButtons) PWA.renderInstallButtons();

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
    const closeBtn = document.getElementById('btn-close-sidebar');
    if (closeBtn) closeBtn.onclick = closeMenu;
    document.getElementById('scrim').onclick = () => {
      closeMenu();
    };
    document.onkeydown = (e) => { if (e.key === 'Escape') closeMenu(); };
    window.onresize = null;
    document.querySelectorAll('.nav-item').forEach(b => {
      b.onclick = () => {
        closeMenu();
        App.navigate(b.dataset.view);
      };
    });
    document.querySelectorAll('.bottom-nav-item').forEach(b => {
      b.onclick = () => {
        if (b.dataset.action === 'menu') {
          toggleMenu();
        } else if (b.dataset.view) {
          closeMenu();
          App.navigate(b.dataset.view);
        }
      };
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

  /* ---------------- Pemicu WA otomatis berjadwal ----------------
     Rekap harian/mingguan/bulanan dijalankan di server, bukan di browser.
     Alasannya:
       - server bisa dipanggil cron, sehingga laporan terkirim tepat waktu
         tanpa harus ada orang yang membuka aplikasi,
       - penanda "sudah terkirim" tersimpan di database, jadi cron dan
         aplikasi yang dibuka manual tidak mengirim pesan yang sama dua kali,
       - kredensial bridge tidak pernah menyentuh browser.
     Pemicu "Saat Setoran" tetap di browser karena terjadi saat ustadz
     menyimpan setoran, bukan terjadwal.
     Cron harian:
       curl -H "Authorization: Bearer <TOKEN_ADMIN>" \
            "https://domain/api/index.php?action=wa_auto_reminder" */
  function kirimRekapOtomatis() {
    if (typeof Store.hasFeature === 'function' && !Store.hasFeature('whatsapp')) return Promise.resolve(0);
    const pemicu = Store.waAutoTriggerSettings();
    const butuhJadwal = pemicu.harian || pemicu.mingguan || pemicu.bulanan;
    if (!butuhJadwal) return Promise.resolve(0);
    if (!Store.waAutoEnabled() || !Store.waReady()) return Promise.resolve(0);
    // Wali hanya menerima laporan, bukan memicu pengiriman massal.
    const session = Store.getSession();
    if (!session || (session.role !== 'admin' && session.role !== 'ustadz')) return Promise.resolve(0);
    return Store.waAutoReminder().then(res => (res && res.terkirim) || 0);
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

  /* Icons (SVG 18x18, stroke 2) */
  const ICONS = {
    dashboard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
    monitor: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    users: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    teacher: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
    halaqah: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
    building: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/></svg>',
    book: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    quran: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    presensi: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><polyline points="9 14 11 16 15 11"/></svg>',
    calendar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    setoran: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    riwayat: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/><polyline points="12 7 12 12 15 15"/></svg>',
    laporan: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
    award: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
    bell: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    star: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    sunset: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="9" x2="12" y2="2"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><polyline points="8 18 12 14 16 18"/></svg>',
    moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    user: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    chat: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    menu: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>'
  };

  function icon(name) {
    return ICONS[name] || '';
  }

  /* KPI stat card */
  function statCard(icon, num, label, color) {
    const c = color || 'var(--primary)';
    const iconHtml = icon ? `<div class="icon" style="color:${c};background:var(--slate-100)">${icon}</div>` : '';
    return `<div class="stat">
      ${iconHtml}
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

  /* ---------- Peta hafalan (shared: ustadz & wali) ----------
     Memakai cakupanHalaman() yang sama dengan perhitungan total hafalan, supaya
     warna peta dan angka halaman tidak bisa bertentangan. */
  function hafalanStates(santriId) {
    const db = Store.get();
    const { full, part } = cakupanHalaman([
      ...db.ziyadahHafalan, ...db.mutqin
    ].filter(r => r.santriId === santriId));
    return { full, part };
  }

  // Peta hafalan ala GitHub: 30 baris juz, kolom mengikuti jumlah halaman asli
  // tiap juz (19/20/21 halaman, tidak selalu 20).
  function hafalanMapHTML(santriId) {
    const { full, part } = hafalanStates(santriId);
    let html = '';
    for (let juz = 1; juz <= 30; juz++) {
      const mulai = JUZ_PAGES[juz - 1];
      const akhir = juz < 30 ? JUZ_PAGES[juz] - 1 : MUSHAF_PAGES;
      html += '<div style="display:flex;align-items:center;gap:3px;margin-bottom:2px">' +
        '<span style="width:38px;font-size:10px;color:var(--muted)">Juz ' + juz + '</span>';
      for (let g = mulai; g <= akhir; g++) {
        let color = 'var(--muted)', tip = 'belum disetor';
        if (full.has(g)) { color = 'var(--success)'; tip = 'selesai disetor'; }
        else if (part.has(g)) { color = 'var(--warn)'; tip = 'disetor sebagian'; }
        html += '<span title="Juz ' + juz + ' · hal. ' + g + ' · ' + tip + '" ' +
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
    const canDelete = !!(session && (session.role === 'ustadz' || session.role === 'admin'));
    const items = [];
    db.tahsin.filter(t => t.santriId === santriId).forEach(t => items.push({
      t: t.tanggal, html: `<b>Tahsin</b> — Hal ${t.halAwal}-${t.halAkhir} · Nilai <b>${t.nilai}</b><div class="muted">${UI.esc(t.catatan || '')}</div>`,
      hapus: (canDelete && Store.hasFeature('tahsin')) ? `<button class="clay-btn sm ghost" data-hapus="tahsin" data-id="${t.id}" style="padding:2px 8px;font-size:11px;color:var(--danger)">Hapus</button>` : ''
    }));
    db.ziyadahBacaan.filter(z => z.santriId === santriId).forEach(z => items.push({
      t: z.tanggal, html: `<b>Ziyadah Bacaan</b> — ${getSurah(z.sAwal).latin}:${z.aAwal} → ${getSurah(z.sAkhir).latin}:${z.aAkhir}`,
      hapus: (canDelete && Store.hasFeature('ziyadah')) ? `<button class="clay-btn sm ghost" data-hapus="ziyadahBacaan" data-id="${z.id}" style="padding:2px 8px;font-size:11px;color:var(--danger)">Hapus</button>` : ''
    }));
    db.ziyadahHafalan.filter(z => z.santriId === santriId).forEach(z => {
      const h = computeHafalan(z.sAwal, z.aAwal, z.sAkhir, z.aAkhir);
      items.push({
        t: z.tanggal, html: `<b>Ziyadah Hafalan</b> — ${getSurah(z.sAwal).latin}:${z.aAwal} → ${getSurah(z.sAkhir).latin}:${z.aAkhir} · <b>${formatHafalan(h)}</b> · Nilai ${z.nilai}<div class="muted">${UI.esc(z.catatan || '')}</div>`,
        hapus: (canDelete && Store.hasFeature('ziyadah')) ? `<button class="clay-btn sm ghost" data-hapus="ziyadahHafalan" data-id="${z.id}" style="padding:2px 8px;font-size:11px;color:var(--danger)">Hapus</button>` : ''
      });
    });
    db.mutqin.filter(m => m.santriId === santriId).forEach(m => {
      const h = computeHafalan(m.sAwal, m.aAwal, m.sAkhir, m.aAkhir);
      items.push({
        t: m.tanggal, html: `<b>Mutqin (Murajaah)</b> — ${getSurah(m.sAwal).latin}:${m.aAwal} → ${getSurah(m.sAkhir).latin}:${m.aAkhir} · <b>${formatHafalan(h)}</b> · Nilai ${m.nilai}<div class="muted">${UI.esc(m.catatan || '')}</div>`,
        hapus: (canDelete && Store.hasFeature('mutqin')) ? `<button class="clay-btn sm ghost" data-hapus="mutqin" data-id="${m.id}" style="padding:2px 8px;font-size:11px;color:var(--danger)">Hapus</button>` : ''
      });
    });
    (db.murojaah || []).filter(m => m.santriId === santriId).forEach(m => {
      const h = computeHafalan(m.sAwal, m.aAwal, m.sAkhir, m.aAkhir);
      items.push({
        t: m.tanggal, html: `<span class="badge purple" style="padding:2px 7px;font-size:10px">Murojaah</span> — ${getSurah(m.sAwal).latin}:${m.aAwal} → ${getSurah(m.sAkhir).latin}:${m.aAkhir} · <b>${formatHafalan(h)}</b>${m.nilai === null || m.nilai === undefined || m.nilai === '' ? '' : ' · Nilai ' + m.nilai}<div class="muted">${UI.esc(m.catatan || '')}</div>`,
        hapus: (canDelete && Store.hasFeature('murojaah')) ? `<button class="clay-btn sm ghost" data-hapus="murojaah" data-id="${m.id}" style="padding:2px 8px;font-size:11px;color:var(--danger)">Hapus</button>` : ''
      });
    });
    db.kehadiran.filter(k => k.santriId === santriId).forEach(k => {
      const ket = k.keterangan || k.catatan || '';
      items.push({
        t: k.tanggal,
        html: `Kehadiran ${UI.esc(k.sesi || '')}: <span class="badge ${k.status === 'Hadir' ? 'green' : k.status === 'Izin' ? 'warn' : k.status === 'Sakit' ? 'blue' : k.status === 'Libur' ? 'purple' : 'danger'}">${UI.esc(k.status)}</span>${ket ? ` <span class="muted" style="font-size:12px;font-style:italic">(${UI.esc(ket)})</span>` : ''}`,
        hapus: ''
      });
    });
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
                const urutanSesi = Store.sesiList();
                const fallbackSesi = Store.defaultSesi();
                const listUrut = list ? list.slice().sort((x, y) => {
                  const dx = urutanSesi.indexOf(x.sesi || fallbackSesi);
                  const dy = urutanSesi.indexOf(y.sesi || fallbackSesi);
                  return (dx < 0 ? 99 : dx) - (dy < 0 ? 99 : dy);
                }) : null;
                const absen = !listUrut || !listUrut.length
                  ? '<span class="badge gray" style="font-size:10px;padding:1px 5px">-</span>'
                  : listUrut.map(k => `<div style="line-height:1.35"><span class="muted" style="font-size:9px">${UI.esc(k.sesi || fallbackSesi)}</span> <span class="badge ${badgeClass(k.status)}" style="font-size:10px;padding:1px 5px">${UI.esc(k.status)}</span></div>`).join('');
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
    
    return table; /*
  })(); /*
  }

*/ } /* ---------- Laporan (shared, role-aware) ---------- */
  let _laporanFilters = {};
let _laporanData = null;
let _laporanBaseRows = [];
  let _laporanTableSort = { field: '', direction: 'asc' };
const _laporanRequests = new WeakMap();

  const BULAN_ID = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  function bulanLabel(bulan) {
    if (!bulan) return '-';
    const parts = String(bulan).split('-');
    if (parts.length < 2) return bulan;
    return (BULAN_ID[Number(parts[1])] || parts[1]) + ' ' + parts[0];
  }

  function buildLaporanRows(filters, reportData) {
    const santriData = Store.get().santri;
    const stats = reportData && reportData.rows ? reportData.rows : {};
    const santri = santriData.filter(s => Object.prototype.hasOwnProperty.call(stats, s.id));
    return santri.map((s, i) => {
      const h = Store.totalHafalanSantri(s.id);
      const summary = stats[s.id];
      const perSesi = summary.hadirPerSesi || {
        Subuh: summary.hadirSubuh || 0,
        Ashar: summary.hadirAshar || 0,
        Maghrib: summary.hadirMaghrib || 0,
        Isya: summary.hadirIsya || 0
      };
      return {
        no: i + 1, s, hafalan: h, nilai: summary.nilai || 0,
        hadirPerSesi: perSesi,
        hadirSubuh: summary.hadirSubuh || 0,
        hadirAshar: summary.hadirAshar || 0,
        hadirMaghrib: summary.hadirMaghrib || 0,
        hadirIsya: summary.hadirIsya || 0,
        hadir: summary.hadir || 0,
        totalK: summary.totalK || 0,
        pct: summary.pct || 0,
        setoranAwal: summary.setoranAwal,
        setoranAkhir: summary.setoranAkhir,
        juzLabel: Store.juzHafalanDisplay(s.id)
      };
    });
  }

  function laporanSortValue(row, field) {
    if (field === 'nama') return String(row.s.nama || '');
    if (field === 'kelas') return String(Store.educationLabel(row.s));
    return String(Store.halaqahSummaryForSantri(row.s));
  }

  function sortLaporanRows(rows) {
    const { field, direction } = _laporanTableSort;
    if (!field) return rows.map((row, index) => ({ ...row, no: index + 1 }));
    const multiplier = direction === 'desc' ? -1 : 1;
    return rows.slice().sort((a, b) =>
      multiplier * laporanSortValue(a, field).localeCompare(laporanSortValue(b, field), 'id', { numeric: true, sensitivity: 'base' })
    ).map((row, index) => ({ ...row, no: index + 1 }));
  }

  function laporanSortHeader(label, field) {
    const active = _laporanTableSort.field === field;
    const direction = active ? _laporanTableSort.direction : '';
    const sortLabel = active && direction === 'asc' ? 'menurun' : 'menaik';
    return `<th class="laporan-sort-heading" aria-sort="${active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}">
      <button class="laporan-sort-toggle" type="button" data-laporan-sort="${field}" aria-label="Urutkan ${label} ${sortLabel}" aria-pressed="${active}">
        ${label}<span aria-hidden="true">${active ? (direction === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>`;
  }

  function laporanMobileSortControls() {
    return `<div class="laporan-mobile-sort" aria-label="Urutkan laporan">
      ${[['nama', 'Nama'], ['kelas', 'Tingkat & Kelas'], ['halaqah', 'Halaqah']].map(([field, label]) => {
        const active = _laporanTableSort.field === field;
        const direction = active ? _laporanTableSort.direction : '';
        return `<button class="clay-btn sm ${active ? 'primary' : 'ghost'}" type="button" data-laporan-sort="${field}" aria-pressed="${active}">
          ${label}${active ? (direction === 'asc' ? ' ↑' : ' ↓') : ''}
        </button>`;
      }).join('')}
    </div>`;
  }

  function laporanIncludeAttendance(filters) {
    const f = filters || {};
    if (typeof f.includeAttendance === 'boolean') return f.includeAttendance;
    return Store.getSettings().laporanSertakanKehadiran !== false;
  }

  function renderLaporanRows(rows, showAtt = true) {
    const sesiList = Store.sesiList();
    return rows.map(r => {
      const hp = r.hadirPerSesi || {};
      const titleParts = sesiList.map(s => `${s}: ${hp[s] || 0}`).join(', ');
      const numParts = sesiList.map(s => hp[s] || 0).join(' ');
      return `<tr>
        <td class="center">${r.no}</td>
        <td><b>${UI.esc(r.s.nama)}</b></td>
        <td>${UI.esc(r.s.nis)}</td>
        <td>${UI.esc(Store.educationLabel(r.s))}</td>
        <td>${UI.esc(Store.halaqahSummaryForSantri(r.s))}</td>
        <td>${UI.esc(Store.programSummaryForSantri(r.s))}</td>
        <td class="center">${UI.esc(r.s.jk || '-')}</td>
        <td class="center">${r.setoranAwal ? UI.esc(formatSetoranLabel(r.setoranAwal)) : '-'}</td>
        <td class="center">${r.setoranAkhir ? UI.esc(formatSetoranLabel(r.setoranAkhir)) : '-'}</td>
        <td class="center">${r.hafalan ? r.hafalan.pages + ' hlm' + (r.juzLabel ? '<br><span style="font-size:11px">' + UI.esc(r.juzLabel) + '</span>' : '') : '-'}</td>
        <td class="center">${r.nilai ? r.nilai : '-'}</td>
        ${showAtt ? `<td class="center" style="font-size:12px" title="${UI.esc('Hadir ' + titleParts)}">${numParts}</td>
        <td class="center">${r.hadir}/${r.totalK} (${r.pct}%)</td>` : ''}
      </tr>`;
    }).join('');
  }

  function applyLaporanTableSort(container) {
    const showAtt = laporanIncludeAttendance(_laporanFilters);
    const colCount = showAtt ? 13 : 11;
    const rows = sortLaporanRows(_laporanBaseRows);
    const tbody = container.querySelector('#laporan-table tbody');
    if (!tbody) return;
    tbody.innerHTML = renderLaporanRows(rows, showAtt) || `<tr><td colspan="${colCount}"><div class="empty">Tidak ada data yang cocok.</div></td></tr>`;
    const count = container.querySelector('[data-laporan-result-count]');
    if (count) count.textContent = `Menampilkan ${rows.length} dari ${_laporanBaseRows.length} santri`;
    container.querySelectorAll('[data-laporan-sort]').forEach(button => {
      const active = _laporanTableSort.field === button.dataset.laporanSort;
      const direction = active ? _laporanTableSort.direction : '';
      button.setAttribute('aria-pressed', String(active));
      const labels = { nama: 'Santri', kelas: 'Tingkat dan kelas', halaqah: 'Halaqah' };
      if (button.closest('th')) {
        button.setAttribute('aria-label', `Urutkan ${labels[button.dataset.laporanSort]} ${active && direction === 'asc' ? 'menurun' : 'menaik'}`);
        button.querySelector('span').textContent = active ? (direction === 'asc' ? '↑' : '↓') : '↕';
        button.closest('th').setAttribute('aria-sort', active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none');
      } else {
        const mobileLabels = { nama: 'Nama', kelas: 'Tingkat & Kelas', halaqah: 'Halaqah' };
        button.textContent = `${mobileLabels[button.dataset.laporanSort]}${active ? (direction === 'asc' ? ' ↑' : ' ↓') : ''}`;
        button.className = `clay-btn sm ${active ? 'primary' : 'ghost'}`;
      }
    });
  }

  function bindLaporanTableFilters(container) {
    container.querySelectorAll('[data-laporan-sort]').forEach(button => {
      button.onclick = () => {
        const field = button.dataset.laporanSort;
        _laporanTableSort = {
          field,
          direction: _laporanTableSort.field === field && _laporanTableSort.direction === 'asc' ? 'desc' : 'asc'
        };
        applyLaporanTableSort(container);
      };
    });
  }

  async function loadLaporan(container, filters) {
    const requestId = (_laporanRequests.get(container) || 0) + 1;
    _laporanRequests.set(container, requestId);
    _laporanTableSort = { field: '', direction: 'asc' };
    container.innerHTML = '<div class="clay-card muted" role="status">Memuat rekap laporan...</div>';
    try {
      const reportData = await Store.laporanData(filters);
      if (_laporanRequests.get(container) !== requestId || !container.isConnected) return;
      container.innerHTML = renderLaporan(filters, reportData);
      bindLaporanExport();
    } catch (error) {
      if (_laporanRequests.get(container) !== requestId || !container.isConnected) return;
      container.innerHTML = `<div class="clay-card"><div class="section-title">Laporan gagal dimuat</div><div class="muted">${UI.esc(error.message || 'Kesalahan server')}</div><button class="clay-btn mt" type="button" data-retry-laporan>Coba Lagi</button></div>`;
      container.querySelector('[data-retry-laporan]').onclick = () => loadLaporan(container, filters);
    }
  }

  function renderLaporan(filters, reportData) {
    _laporanFilters = filters || {};
    _laporanData = reportData;
    _laporanBaseRows = buildLaporanRows(_laporanFilters, _laporanData);
    const showAtt = laporanIncludeAttendance(_laporanFilters);
    const colCount = showAtt ? 13 : 11;
    const rows = sortLaporanRows(_laporanBaseRows);
    const bulan = _laporanFilters.bulan || Store.todayStr().slice(0, 7);
    const periode = (_laporanFilters.dari && _laporanFilters.sampai)
      ? UI.fmtDate(_laporanFilters.dari) + ' – ' + UI.fmtDate(_laporanFilters.sampai)
      : bulanLabel(bulan);
    const body = renderLaporanRows(rows, showAtt);
    return `<div class="clay-card">
      <div class="section-title">Laporan Santri — ${UI.esc(periode)}</div>
      ${laporanMobileSortControls()}
      <div class="table-wrap">
        <table class="clay-table" id="laporan-table">
          <thead><tr>
            <th class="center">No</th>${laporanSortHeader('Santri', 'nama')}<th>NIS</th>${laporanSortHeader('Tingkat &amp; Kelas', 'kelas')}${laporanSortHeader('Halaqah', 'halaqah')}<th>Level</th>
            <th class="center">JK</th><th class="center">Setoran Awal</th><th class="center">Setoran Akhir</th>
            <th class="center">Total Hafalan</th><th class="center">Rata Nilai</th>
            ${showAtt ? `<th class="center" title="${UI.esc('Rincian Sesi Hadir: ' + Store.sesiList().join(' · '))}">Hadir per Sesi<br><span style="font-weight:400;font-size:10px">${UI.esc(Store.sesiList().map(s => s.slice(0, 3)).join(' · '))}</span></th>
            <th class="center">Kehadiran (${UI.esc(periode)})</th>` : ''}
          </tr></thead>
          <tbody>${body || `<tr><td colspan="${colCount}"><div class="empty">Tidak ada data.</div></td></tr>`}</tbody>
        </table>
      </div>
      <div class="muted laporan-result-count" data-laporan-result-count>Menampilkan ${rows.length} dari ${_laporanBaseRows.length} santri</div>
      <div class="row mt">
        ${Store.hasFeature('exportExcel') ? '<button class="clay-btn secondary" id="export-excel">Export Excel</button>' : ''}
        <button class="clay-btn" id="export-pdf">Unduh PDF</button>
      </div>
    </div>`;
  }

  function downloadLaporanPdf() {
    const table = document.querySelector('#laporan-table');
    if (!table) {
      UI.toast('Data laporan tidak ditemukan', 'error');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      UI.toast('Izinkan pop-up untuk mengunduh laporan PDF', 'error');
      return;
    }

    const heading = table.closest('.clay-card')?.querySelector('.section-title');
    const institution = document.getElementById('page-sub');
    const filename = 'Laporan_Tahfidz_' + Store.todayStr();
    const printableTable = table.cloneNode(true);
    printableTable.querySelectorAll('.laporan-sort-toggle, .laporan-filter-toggle').forEach(button => {
      button.querySelectorAll('[aria-hidden="true"]').forEach(el => el.remove());
      button.replaceWith(document.createTextNode(button.textContent.trim()));
    });
    printableTable.querySelectorAll('.laporan-filter-control').forEach(control => control.remove());
    printWindow.onafterprint = () => printWindow.close();
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="id">
      <head>
        <meta charset="utf-8">
        <title>${UI.esc(filename)}</title>
        <style>
          @page { size: landscape; margin: 8mm; }
          * { box-sizing: border-box; }
          body { color: #1f2937; font: 8pt Arial, sans-serif; }
          h1 { margin: 0 0 3px; font-size: 15pt; }
          .institution, .period, .generated { margin: 2px 0; }
          .institution { font-size: 10pt; font-weight: 600; }
          .generated { color: #4b5563; font-size: 7pt; }
          table { width: 100%; margin-top: 10px; border-collapse: collapse; table-layout: fixed; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; }
          th, td { padding: 4px 3px; border: 1px solid #9ca3af; vertical-align: top; overflow-wrap: anywhere; }
          th { background: #e5e7eb; font-size: 6.5pt; }
          td { font-size: 6.5pt; }
          .center { text-align: center; }
          .signature { width: 58mm; margin: 24px 12mm 0 auto; text-align: center; break-inside: avoid; page-break-inside: avoid; }
          .signature-date { margin-bottom: 4px; }
          .signature-title { margin-bottom: 42px; }
          .signature-name { font-weight: 700; text-decoration: underline; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <h1>Laporan Tahfidz</h1>
        <div class="institution">${UI.esc(institution ? institution.textContent : '')}</div>
        <div class="period">${UI.esc(heading ? heading.textContent : 'Laporan Santri')}</div>
        <div class="generated">Dicetak pada ${UI.esc(UI.fmtDate(Store.todayStr()))}</div>
        ${printableTable.outerHTML}
        <div class="signature">
          <div class="signature-date">${UI.esc((Store.getSettings().kota || 'Ngawen'))}, ${UI.esc(UI.fmtDate(Store.todayStr()))}</div>
          <div class="signature-title">${UI.esc(Store.getSettings().jabatanPimpinan || 'TTD Mudir')}</div>
          <div class="signature-name">${UI.esc(Store.getSettings().namaPimpinan || 'KH. Suroto Abu Nizam, M. Pd.')}</div>
        </div>
      </body>
      </html>`);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      UI.toast('Pilih “Simpan sebagai PDF” pada dialog cetak untuk mengunduh laporan', 'info');
    }, 250);
  }

  function bindLaporanExport() {
    const ex = document.getElementById('export-excel');
    const pdf = document.getElementById('export-pdf');
    if (ex) ex.onclick = () => exportLaporanExcel(_laporanFilters);
    if (pdf) pdf.onclick = downloadLaporanPdf;
    const container = document.getElementById('laporan-content') || document.getElementById('lap');
    if (container) bindLaporanTableFilters(container);
  }

  /* ---------------- Konversi tabel HTML ke .xlsx ----------------
     Beberapa layar sudah menyusun isi laporan sebagai tabel HTML. File .xls
     berbasis HTML sering ditolak aplikasi HP (Android hanya melihatnya sebagai
     teks), jadi markup itu dibaca ulang di sini lalu diunduh sebagai .xlsx
     asli yang pasti bisa dibuka. Kalau strukturnya tak terduga, pemanggil
     kembali memakai jalur .xls lama. */
  function htmlTableToSheet(html) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const table = doc.querySelector('table');
    if (!table) return null;
    const columns = [];
    [...table.querySelectorAll('thead th')].forEach((th, index) => {
      // Sub-label pada header (mis. tanggal di bawah nama hari) digabung
      // dengan spasi supaya tidak menempel pada judul kolomnya.
      const label = (th.textContent || '').replace(/\s+/g, ' ').trim() || ('Kolom ' + (index + 1));
      columns.push({ key: 'c' + index, label });
    });
    if (!columns.length) return null;
    const cellValue = (cell, index) => {
      // Satu sel Excel tidak bisa memuat ganti baris, jadi <br> jadi pemisah.
      const clone = cell.cloneNode(true);
      clone.querySelectorAll('br').forEach(br => br.replaceWith(' '));
      const text = (clone.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) return '';
      if (index === 0 && /^\d+$/.test(text)) return Number(text); // kolom No tetap angka
      return text;
    };
    const rows = [...table.querySelectorAll('tbody tr')].map(tr => {
      const cells = [...tr.querySelectorAll('td')];
      const row = {};
      columns.forEach((column, index) => {
        row[column.key] = cells[index] ? cellValue(cells[index], index) : '';
      });
      return row;
    });
    if (!rows.length) return null;
    const heading = sel => {
      const node = doc.querySelector(sel);
      return node ? (node.textContent || '').replace(/\s+/g, ' ').trim() : '';
    };
    const sheetName = heading('.title') || heading('.sub') || 'Data';
    return { sheet: { name: sheetName, columns, rows } };
  }

  function downloadExcel(filename, html) {
    if (typeof Store.hasFeature === 'function' && !Store.hasFeature('exportExcel')) {
      UI.toast('Fitur Export Excel belum diaktifkan', 'error');
      return;
    }
    const parsed = htmlTableToSheet(html);
    if (parsed) {
      downloadXlsx(filename, [parsed.sheet]);
      return;
    }
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

  function xlsxBytes(value) { return value instanceof Uint8Array ? value : new TextEncoder().encode(value); }
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
      for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xEDB88320 : 0); table[i] = value >>> 0; } return table; })(); /*
      table[i] = value >>> 0;
    }
    return table; /*
  })(); /*
  })();

// Detail info saat centang setoran di-hover (desktop) atau di-tap/hold (HP)
if (typeof document !== 'undefined' && !document._setoranDetailBound) {
  document._setoranDetailBound = true;
  let holdTimer = null;
  let didHold = false;

  function openSetoranInfo(el) {
    const info = el.getAttribute('data-setoran-info');
    if (!info) return;
    const nama = el.getAttribute('data-santri-nama') || 'Santri';
    const tgl = el.getAttribute('data-tanggal') || '';
    UI.openModal({
      title: 'Detail Setoran · ' + nama,
      sub: tgl ? ('Tanggal: ' + UI.fmtDate(tgl)) : '',
      bodyHTML: `<div class="clay-card pad-sm" style="white-space:pre-line;line-height:1.7;font-size:14px;background:var(--bg)">${UI.esc(info)}</div>`,
      actions: [{ label: 'Tutup', cls: 'primary', onClick: (m, c) => c() }]
    });
  }

  document.addEventListener('touchstart', e => {
    const badge = e.target.closest('.setoran-check-badge');
    if (!badge) return;
    didHold = false;
    holdTimer = setTimeout(() => {
      didHold = true;
      openSetoranInfo(badge);
    }, 350);
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  });

  document.addEventListener('touchmove', () => {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  });

  document.addEventListener('click', e => {
    const badge = e.target.closest('.setoran-check-badge');
    if (!badge) return;
    if (didHold) { didHold = false; return; }
    openSetoranInfo(badge);
  });

  document.addEventListener('contextmenu', e => {
    if (e.target.closest('.setoran-check-badge')) {
      e.preventDefault();
    }
  });
}

  */ function xlsxCrc32(bytes) {
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
    if (typeof Store.hasFeature === 'function' && !Store.hasFeature('exportExcel')) {
      UI.toast('Fitur Export Excel belum diaktifkan', 'error');
      return null;
    }
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
    const showAtt = laporanIncludeAttendance(f);
    const bulan = f.bulan || Store.todayStr().slice(0, 7);
    const periode = (f.dari && f.sampai)
      ? UI.fmtDate(f.dari) + ' – ' + UI.fmtDate(f.sampai)
      : bulanLabel(bulan);
    const rows = sortLaporanRows(buildLaporanRows(f, _laporanData));
    if (!rows.length) { UI.toast('Tidak ada data untuk diekspor', 'error'); return; }
    const sesiList = Store.sesiList();
    const rowsHtml = rows.map(r => `<tr>
      <td class="center">${r.no}</td>
      <td>${UI.esc(r.s.nama)}</td>
      <td>${UI.esc(r.s.nis)}</td>
      <td>${UI.esc(Store.educationLabel(r.s))}</td>
      <td>${UI.esc(Store.halaqahSummaryForSantri(r.s))}</td>
      <td>${UI.esc(Store.programSummaryForSantri(r.s))}</td>
      <td class="center">${UI.esc(r.s.jk || '-')}</td>
      <td class="center">${r.setoranAwal ? UI.esc(formatSetoranLabel(r.setoranAwal)) : '-'}</td>
      <td class="center">${r.setoranAkhir ? UI.esc(formatSetoranLabel(r.setoranAkhir)) : '-'}</td>
      <td class="center">${r.hafalan ? r.hafalan.pages + (r.juzLabel ? '<br><span style="font-size:10px">' + UI.esc(r.juzLabel) + '</span>' : '') : '-'}</td>
      <td class="center">${r.nilai || 0}</td>
      ${showAtt ? `${sesiList.map(sesi => `<td class="center">${(r.hadirPerSesi && r.hadirPerSesi[sesi]) || 0}</td>`).join('')}
      <td class="center">${r.hadir}</td>
      <td class="center">${r.totalK}</td>
      <td class="center">${r.pct}%</td>` : ''}
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
  <div class="title">LAPORAN TAHFIDZ</div>
  <div class="sub">${UI.esc(db.settings.namaLembaga)}</div>
  <div class="sub">Periode: ${UI.esc(periode)}</div>
  <table>
    <thead><tr>
      <th class="center">No</th><th>Santri</th><th>NIS</th><th>Tingkat &amp; Kelas</th><th>Halaqah</th><th>Level</th><th class="center">JK</th>
      <th class="center">Setoran Awal</th><th class="center">Setoran Akhir</th>
      <th class="center">Total Hafalan</th><th class="center">Rata Nilai</th>
      ${showAtt ? `${sesiList.map(sesi => `<th class="center">${UI.esc(sesi)}</th>`).join('')}
      <th class="center">Total Hadir</th><th class="center">Total Kehadiran</th><th class="center">%</th>` : ''}<th>Status</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body></html>`;
    const filename = (f.dari && f.sampai) ? 'Laporan_Tahfidz_' + f.dari + '_sd_' + f.sampai : 'Laporan_Tahfidz_' + bulan;
    downloadExcel(filename, html);
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

  /* ---------- Rekap setoran per periode ---------- */
  const HARI_SINGKAT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
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
    if (programs.includes('Mutqin')) types.push('mutqin'); return types;

  }

  function formatSetoranShort(rec, type) {
    if (!rec) return '';
    const label = JENIS_SETORAN[type] || type;
    let detail = '';
    if (type === 'tahsin') {
      detail = (rec.halAwal === rec.halAkhir || !rec.halAkhir) ? ('Hal ' + rec.halAwal) : ('Hal ' + rec.halAwal + '–' + rec.halAkhir);
    } else {
      detail = formatSetoranLabel(rec);
      if (type === 'ziyadahHafalan') {
        const h = computeHafalan(rec.sAwal, rec.aAwal, rec.sAkhir, rec.aAkhir);
        if (h) detail += ' (' + formatHafalan(h) + ')';
      } else if (type === 'mutqin' && rec.totalHafalan) {
        detail += ' (' + rec.totalHafalan + ' hlm)';
      }
    }
    let res = label + ': ' + detail;
    if (rec.nilai) res += ' | Nilai: ' + rec.nilai;
    if (rec.catatan) res += ' | Catatan: ' + rec.catatan;
    return res;
  }

  function formatSetoranDetail(rec, type) {
    if (!rec) return '';
    const label = JENIS_SETORAN[type] || type;
    const lines = [label];
    if (type === 'tahsin') {
      const hal = (rec.halAwal === rec.halAkhir || !rec.halAkhir) ? ('Hal ' + rec.halAwal) : ('Hal ' + rec.halAwal + '–' + rec.halAkhir);
      lines.push('Halaman: ' + hal);
    } else {
      lines.push('Surat: ' + formatSetoranLabel(rec));
      if (type === 'ziyadahHafalan') {
        const h = computeHafalan(rec.sAwal, rec.aAwal, rec.sAkhir, rec.aAkhir);
        if (h) lines.push('Panjang: ' + formatHafalan(h));
      } else if (type === 'mutqin' && rec.totalHafalan) {
        lines.push('Total Murajaah: ' + rec.totalHafalan + ' halaman');
      }
    }
    if (rec.nilai) lines.push('Nilai: ' + rec.nilai);
    if (rec.catatan) lines.push('Catatan: ' + rec.catatan);
    if (rec.ustadzId) {
      const u = Store.findUstadz(rec.ustadzId);
      if (u && u.nama) lines.push('Penyimak: ' + u.nama);
    }
    return lines.join('\n');
  } /*
  }



  }

  */ function dateKey(date) {
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

  // Rentang tanggal rekap setoran disimpan di modul supaya tidak kembali ke
  // default (7 hari terakhir) setiap kali pindah menu lalu kembali ke halaman ini.
  let _rekapSetoranRange = null;
  function rekapSetoranRange() {
    if (!_rekapSetoranRange) {
      const today = Store.todayStr();
      _rekapSetoranRange = { dari: Store.tambahHari(today, -6), sampai: today };
    }
    return _rekapSetoranRange;
  }
  function setRekapSetoranRange(dari, sampai) {
    if (dari && sampai) _rekapSetoranRange = { dari, sampai };
    return rekapSetoranRange();
  }

  /* ---------- Laporan Murojaah (sengaja terpisah dari laporan setoran) ----------
     Murojaah tidak masuk JENIS_SETORAN maupun rekap setoran. Halamannya tetap
     dihitung dengan cakupan ayat penuh seperti ziyadah, tetapi angkanya tidak
     ikut total hafalan. */
  function renderLaporanMurojaah(container, options) {
    if (!container) return;
    const opt = options || {};
    const daftarSantri = opt.santriList || Store.get().santri || [];
    const awal = rekapSetoranRange();
    const state = { dari: awal.dari, sampai: awal.sampai, cari: '' };

    function presetRange(preset) {
      const today = Store.todayStr();
      if (preset === 'week') return { dari: Store.tambahHari(today, -6), sampai: today };
      if (preset === 'thisweek') return { dari: mondayOf(today), sampai: today };
      if (preset === 'month') return { dari: today.slice(0, 8) + '01', sampai: today };
      if (preset === 'lastmonth') {
        const start = new Date(today.slice(0, 8) + '01T12:00:00');
        start.setMonth(start.getMonth() - 1);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        return {
          dari: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`,
          sampai: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
        };
      }
      return { dari: today, sampai: today };
    }

    function kumpulkan() {
      const db = Store.get();
      const recs = (db.murojaah || []).filter(r =>
        (!state.dari || String(r.tanggal || '') >= state.dari) &&
        (!state.sampai || String(r.tanggal || '') <= state.sampai));
      const term = state.cari.trim().toLowerCase();
      const rows = [];
      daftarSantri.forEach(s => {
        if (term && !s.nama.toLowerCase().includes(term) && !String(s.nis || '').includes(term)) return;
        const list = recs.filter(r => r.santriId === s.id);
        if (!list.length) return;
        const total = Store.totalMurojaahSantri(s.id, state.dari, state.sampai);
        if (!total) return;
        rows.push({ s, list, total });
      });
      rows.sort((a, b) => String(a.s.nama).localeCompare(String(b.s.nama), 'id', { numeric: true }));
      return rows;
    }

    function paint() {
      const rows = kumpulkan();
      const totSetoran = rows.reduce((n, r) => n + r.list.length, 0);
      const totHalaman = rows.reduce((n, r) => n + r.total.pages, 0);
      const totAyat = rows.reduce((n, r) => n + r.total.ayahs, 0);
      const body = container.querySelector('#laporan-murojaah-body');
      if (!body) return;
      let activeMuroTab = 'ringkasan';
      body.innerHTML = `
        <div class="grid kpi">
          ${statCard('', rows.length, 'Santri Murojaah', '#7E22CE')}
          ${statCard('', totSetoran, 'Setoran Murojaah', '#3B82F6')}
          ${statCard('', totHalaman, 'Halaman Penuh', '#16A34A')}
          ${statCard('', totAyat, 'Total Ayat', '#F59E0B')}
        </div>
        ${rows.length ? `<div class="pill-tabs mt" id="lm-subtabs" style="margin-bottom:10px">
          <button class="pill active" type="button" data-lm-subtab="ringkasan">Ringkasan per Santri (${rows.length})</button>
          <button class="pill" type="button" data-lm-subtab="rincian">Rincian Setoran (${totSetoran})</button>
        </div>` : ''}
        <div class="clay-card mt" data-lm-panel="ringkasan">
          <div class="row" style="justify-content:space-between;align-items:center">
            <div class="section-title" style="margin:0">Rekap Murojaah per Santri</div>
            ${Store.hasFeature('exportExcel') ? '<button class="clay-btn ghost sm" id="lm-export">⬇ Unduh Excel</button>' : ''}
          </div>
          <div class="muted" style="font-size:12px;margin:6px 0">Halaman penuh = seluruh ayat di halaman itu sudah dimurojaah, boleh terkumpul dari beberapa setoran. Tidak termasuk total hafalan ziyadah.</div>
          <div class="table-wrap"><table class="clay-table">
            <thead><tr><th>No</th><th>Santri</th><th>Kelas</th><th>Setoran</th><th>Ayat</th><th>Halaman Penuh</th><th>Juz</th><th>Nilai Rata²</th><th>Terakhir</th></tr></thead>
            <tbody>${rows.map((r, i) => `<tr>
              <td class="center">${i + 1}</td>
              <td><b>${UI.esc(r.s.nama)}</b><div class="muted" style="font-size:11px">${UI.esc(Store.halaqahSummaryForSantri(r.s))}</div></td>
              <td>${UI.esc(Store.educationLabel(r.s))}</td>
              <td class="center">${r.list.length}</td>
              <td class="center">${r.total.ayahs}</td>
              <td class="center"><span class="badge purple">${r.total.pages} hlm</span></td>
              <td class="center">${r.total.juzRange === 1 ? 'Juz ' + r.total.juzStart : 'Juz ' + r.total.juzStart + '–' + r.total.juzEnd}</td>
              <td class="center">${r.total.nilaiRata === null ? '-' : r.total.nilaiRata}</td>
              <td class="center" style="font-size:12px">${r.total.terakhir ? UI.esc(formatSetoranLabel(r.total.terakhir)) : '-'}</td>
            </tr>`).join('') || '<tr><td colspan="9"><div class="empty">Belum ada setoran murojaah pada periode ini.</div></td></tr>'}</tbody>
          </table></div>
        </div>
        ${rows.length ? `<div class="clay-card mt" data-lm-panel="rincian" style="display:none">
          <div class="section-title">Rincian Setoran per Santri</div>
          ${rows.map(r => `<details style="margin-bottom:8px">
            <summary style="cursor:pointer;font-size:13px"><b>${UI.esc(r.s.nama)}</b> — ${r.list.length} setoran · ${r.total.pages} halaman penuh</summary>
            <div class="table-wrap mt"><table class="clay-table">
              <thead><tr><th>Tanggal</th><th>Rentang Ayat</th><th>Capaian</th><th>Nilai</th><th>Catatan</th></tr></thead>
              <tbody>${r.list.slice().sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || ''))).map(m => {
                const h = computeHafalan(m.sAwal, m.aAwal, m.sAkhir, m.aAkhir);
                return `<tr><td>${UI.esc(UI.fmtDate(m.tanggal))}</td><td>${UI.esc(formatSetoranLabel(m))}</td><td>${formatHafalan(h)}</td><td>${m.nilai === null || m.nilai === undefined || m.nilai === '' ? '-' : m.nilai}</td><td class="muted">${UI.esc(m.catatan || '')}</td></tr>`;
              }).join('')}</tbody>
            </table></div>
          </details>`).join('')}
        </div>` : ''}`;

      body.querySelectorAll('[data-lm-subtab]').forEach(btn => {
        btn.onclick = () => {
          activeMuroTab = btn.dataset.lmSubtab;
          body.querySelectorAll('[data-lm-subtab]').forEach(b => b.classList.toggle('active', b.dataset.lmSubtab === activeMuroTab));
          body.querySelectorAll('[data-lm-panel]').forEach(p => { p.style.display = p.dataset.lmPanel === activeMuroTab ? '' : 'none'; });
        };
      });

      const lmExportBtn = container.querySelector('#lm-export');
      if (lmExportBtn) lmExportBtn.onclick = () => {
        const head = '<thead><tr><th>No</th><th>Santri</th><th>NIS</th><th>Setoran</th><th>Ayat</th><th>Halaman Penuh</th><th>Juz</th><th>Nilai Rata²</th><th>Terakhir</th></tr></thead>';
        const isi = rows.map((r, i) => `<tr><td>${i + 1}</td><td>${UI.esc(r.s.nama)}</td><td>${UI.esc(r.s.nis || '')}</td><td>${r.list.length}</td><td>${r.total.ayahs}</td><td>${r.total.pages}</td><td>${r.total.juzRange === 1 ? 'Juz ' + r.total.juzStart : 'Juz ' + r.total.juzStart + '-' + r.total.juzEnd}</td><td>${r.total.nilaiRata === null ? '' : r.total.nilaiRata}</td><td>${r.total.terakhir ? UI.esc(UI.fmtDate(r.total.terakhir.tanggal)) : ''}</td></tr>`).join('');
        downloadExcel('Laporan Murojaah ' + (state.dari || '') + ' s.d. ' + (state.sampai || ''), '<table>' + head + '<tbody>' + isi + '</tbody></table>');
      };
    }

    container.innerHTML = `
      <div class="clay-card mb">
        <div class="section-title">Filter Laporan Murojaah</div>
        <div class="row">
          <div style="flex:1">${UI.field('Dari Tanggal', `<input type="date" class="clay-input" id="lm-dari" value="${state.dari}">`)}</div>
          <div style="flex:1">${UI.field('Sampai Tanggal', `<input type="date" class="clay-input" id="lm-sampai" value="${state.sampai}">`)}</div>
        </div>
        <div class="row mt">
          <button class="clay-btn ghost" data-lm-preset="week">7 Hari</button>
          <button class="clay-btn ghost" data-lm-preset="thisweek">Minggu Ini</button>
          <button class="clay-btn ghost" data-lm-preset="month">Bulan Ini</button>
          <button class="clay-btn ghost" data-lm-preset="lastmonth">Bulan Lalu</button>
        </div>
        <div class="mt">${UI.field('Cari Santri', `<input class="clay-input" id="lm-cari" type="search" placeholder="Nama atau NIS..." autocomplete="off">`)}</div>
      </div>
      <div id="laporan-murojaah-body"></div>`;

    const dariEl = container.querySelector('#lm-dari');
    const sampaiEl = container.querySelector('#lm-sampai');
    const cariEl = container.querySelector('#lm-cari');
    const apply = () => {
      state.dari = dariEl.value;
      state.sampai = sampaiEl.value;
      setRekapSetoranRange(state.dari, state.sampai);
      paint();
    };
    dariEl.onchange = apply;
    sampaiEl.onchange = apply;
    bindSearchInput(cariEl, () => { state.cari = cariEl.value; paint(); });
    container.querySelectorAll('[data-lm-preset]').forEach(button => button.onclick = () => {
      const r = presetRange(button.dataset.lmPreset);
      dariEl.value = r.dari; sampaiEl.value = r.sampai;
      apply();
    });
    paint();
  }

  /* ---------- Raport Santri (Admin, Ustadz, & Portal Wali) ---------- */
  const RAPORT_MODEL_OPTIONS = [
    { v: 'model1', l: 'Model 1 — Bahasa Indonesia' },
    { v: 'model2', l: 'Model 2 — Indonesia & Arab' },
    { v: 'model3', l: 'Model 3 — Full Bahasa Arab' }
  ];
  const ARABIC_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  function normalizeRaportModel(model) {
    return ['model1', 'model2', 'model3'].includes(model) ? model : 'model1';
  }

  function toArabicDigits(value) {
    const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(value == null ? '' : value)
      .replace(/\d/g, d => map[Number(d)])
      .replace(/%/g, '٪');
  }

  function fmtDateArab(iso) {
    if (!iso) return '-';
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const y = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10) - 1;
      const day = parseInt(m[3], 10);
      if (mo >= 0 && mo < 12) return `${toArabicDigits(day)} ${ARABIC_MONTHS[mo]} ${toArabicDigits(y)}`;
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return `${toArabicDigits(d.getDate())} ${ARABIC_MONTHS[d.getMonth()]} ${toArabicDigits(d.getFullYear())}`;
  }

  function formatSetoranLabelArab(rec) {
    if (!rec) return '-';
    const sAwal = getSurah(rec.sAwal);
    const sAkhir = getSurah(rec.sAkhir);
    if (!sAwal || !sAkhir) return '-';
    const a1 = toArabicDigits(rec.aAwal);
    const a2 = toArabicDigits(rec.aAkhir);
    if (rec.sAwal === rec.sAkhir) {
      return `${sAwal.arab} ${a1}${rec.aAwal !== rec.aAkhir ? '-' + a2 : ''}`;
    }
    return `من ${sAwal.arab}: ${a1} إلى ${sAkhir.arab}: ${a2}`;
  }

  function juzHafalanArab(label) {
    if (!label) return '';
    const isPlural = /[–,-]|\bdan\b/i.test(label);
    return toArabicDigits(
      String(label)
        .replace(/\bJuz\s+/gi, isPlural ? 'الأجزاء ' : 'الجزء ')
        .replace(/\bdan\b/gi, 'و')
    );
  }

  function raportPredikat(nilai, model = 'model1') {
    const m = normalizeRaportModel(model);
    if (!nilai || nilai <= 0) return '-';
    if (nilai >= 90) return m === 'model3' ? 'ممتاز (أ)' : (m === 'model2' ? 'A (Mumtaz / ممتاز)' : 'A (Mumtaz)');
    if (nilai >= 80) return m === 'model3' ? 'جيد جدًا (ب)' : (m === 'model2' ? 'B (Jayyid Jiddan / جيد جدًا)' : 'B (Jayyid Jiddan)');
    if (nilai >= 70) return m === 'model3' ? 'جيد (ج)' : (m === 'model2' ? 'C (Jayyid / جيد)' : 'C (Jayyid)');
    return m === 'model3' ? 'مقبول (د)' : (m === 'model2' ? 'D (Maqbul / مقبول)' : 'D (Maqbul)');
  }

  function raportSikapLabel(sikap, model = 'model1') {
    const m = normalizeRaportModel(model);
    const raw = sikap || '-';
    const arMap = {
      'Sangat Baik': 'ممتاز',
      'Baik': 'جيد',
      'Cukup': 'مقبول',
      'Perlu Bimbingan': 'يحتاج إلى توجيه'
    };
    const ar = arMap[raw];
    if (!ar || m === 'model1') return raw;
    return m === 'model3' ? ar : `${raw} (${ar})`;
  }

  function raportSemesterLabel(sem, model = 'model1') {
    const m = normalizeRaportModel(model);
    const arMap = { Ganjil: 'الفصل الأول', Genap: 'الفصل الثاني' };
    const ar = arMap[sem];
    if (!ar || m === 'model1') return sem || '-';
    return m === 'model3' ? ar : `${sem} (${ar})`;
  }

  function raportProgramArab(program) {
    const p = String(program || '').trim().toLowerCase();
    if (p === 'tahsin') return 'تحسين التلاوة';
    if (p === 'ziyadah') return 'الزيادة (حفظ القرآن)';
    if (p === 'mutqin') return 'برنامج الإتقان';
    if (p === 'murojaah') return 'المراجعة';
    return program || '-';
  }

  function raportTingkatArab(tingkat) {
    const t = String(tingkat || '').trim().toUpperCase();
    if (t === 'TPQ' || t === 'TKQ' || t === "TK AL-QUR'AN" || t === 'TK ALQURAN') return 'مرحلة التمهيدي (TPQ)';
    if (t === 'SD') return 'المرحلة الابتدائية (SD)';
    if (t === 'SMP') return 'المرحلة المتوسطة (SMP)';
    if (t === 'SMA') return 'المرحلة الثانوية (SMA)';
    return tingkat || '-';
  }

  function raportHalaqahSummaryArab(s) {
    if (!s) return '-';
    const programs = Store.activeProgramsForSantri ? Store.activeProgramsForSantri(s) : [];
    const parts = [];
    programs.forEach(p => {
      const h = Store.halaqahForSantriProgram ? Store.halaqahForSantriProgram(s, p) : null;
      const hName = h ? ((h.namaArab || '').trim() || h.nama) : '';
      if (hName) parts.push(`${hName} (${raportProgramArab(p)})`);
    });
    if (parts.length) return [...new Set(parts)].join('، ');
    const hList = Store.halaqahForSantri ? Store.halaqahForSantri(s) : [];
    if (hList.length) return hList.map(h => (h.namaArab || '').trim() || h.nama).filter(Boolean).join('، ');
    return Store.halaqahSummaryForSantri(s) || '-';
  }

  function raportEducationLabel(s, model = 'model1') {
    if (normalizeRaportModel(model) !== 'model3') return Store.educationLabel(s);
    const tk = raportTingkatArab(Store.tingkatForSantri(s));
    const kl = Store.kelasForSantri(s);
    return kl ? `${tk} · فصل ${toArabicDigits(kl)}` : `${tk} · لم يُحدد الفصل`;
  }

  function raportFileSuffix(model) {
    const m = normalizeRaportModel(model);
    if (m === 'model2') return '_IndoArab';
    if (m === 'model3') return '_Arab';
    return '';
  }

  function defaultRaportRange(tahunAjaran, semester) {
    const today = Store.todayStr();
    const curYear = parseInt(today.slice(0, 4), 10) || new Date().getFullYear();
    const curMonth = parseInt(today.slice(5, 7), 10) || 1;
    const m = String(tahunAjaran || '').match(/(\d{4})/);
    const startYear = m ? parseInt(m[1], 10) : (curMonth >= 7 ? curYear : curYear - 1);
    const bounds = semester === 'Genap'
      ? { dari: `${startYear + 1}-01-01`, sampai: `${startYear + 1}-06-30` }
      : { dari: `${startYear}-07-01`, sampai: `${startYear}-12-31` };
    if (today >= bounds.dari && today <= bounds.sampai) return { dari: bounds.dari, sampai: today };
    // Fallback ke semester kalender berjalan agar data terbaru langsung tampil.
    return curMonth >= 7
      ? { dari: `${curYear}-07-01`, sampai: today }
      : { dari: `${curYear}-01-01`, sampai: today };
  }

  function raportIncludeAttendance(state) {
    if (state && typeof state.includeAttendance === 'boolean') return state.includeAttendance;
    return Store.getSettings().raportSertakanKehadiran !== false;
  }

  function buildRaportInfo(s, state) {
    const db = Store.get();
    const dari = state.dari;
    const sampai = state.sampai;
    const inPeriod = t => Store.padaRentang(t, dari, sampai);
    const sortByTime = (a, b) => String(a.tanggal || '').localeCompare(String(b.tanggal || '')) || ((a._created || 0) - (b._created || 0));

    const tahsinList = Store.hasFeature('tahsin')
      ? (db.tahsin || []).filter(t => t.santriId === s.id && inPeriod(t.tanggal)).slice().sort(sortByTime)
      : [];
    const ziyadahList = Store.hasFeature('ziyadah')
      ? (db.ziyadahHafalan || []).filter(z => z.santriId === s.id && inPeriod(z.tanggal)).slice().sort(sortByTime)
      : [];
    const mutqinList = Store.hasFeature('mutqin')
      ? (db.mutqin || []).filter(m => m.santriId === s.id && inPeriod(m.tanggal)).slice().sort(sortByTime)
      : [];
    const murojaahStats = Store.hasFeature('murojaah')
      ? Store.totalMurojaahSantri(s.id, dari, sampai)
      : null;
    const talimJournals = Store.hasFeature('talim')
      ? Store.jurnalTalimForSantri(s, dari, sampai)
      : [];

    const avg = list => {
      const nums = list.map(x => Number(x.nilai)).filter(n => Number.isFinite(n) && n > 0);
      return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
    };
    const totalH = Store.hasFeature('ziyadah') || Store.hasFeature('mutqin') ? Store.totalHafalanSantri(s.id) : null;
    const juzLabel = totalH ? Store.juzHafalanDisplay(s.id) : null;
    const includeAtt = raportIncludeAttendance(state);
    const today = Store.todayStr();
    const absSampai = (sampai && sampai > today) ? today : sampai;
    const kehadiran = (includeAtt && Store.hasFeature('presensi')) ? Store.rekapKehadiranSantri(s.id, dari, absSampai).total : null;
    const talimAbsen = (includeAtt && Store.hasFeature('talim') && Store.hasFeature('presensi'))
      ? Store.rekapKehadiranSantri(s.id, dari, absSampai, Store.TALIM_SESI_ALIASES).total
      : null;
    const saved = Store.raportFor(s.id, state.tahunAjaran, state.semester);
    const savedKajian = (saved && saved.nilaiKajian && typeof saved.nilaiKajian === 'object') ? saved.nilaiKajian : {};
    const kajianByMapel = new Map();
    talimJournals.forEach(j => {
      const key = j.mapelId || j.mapel || j.judulKitab || 'kajian';
      if (!kajianByMapel.has(key)) kajianByMapel.set(key, []);
      kajianByMapel.get(key).push(j);
    });
    // Sertakan juga mapel yang ditugaskan untuk kelas santri ini walau belum ada jurnal pada periode raport
    if (Store.hasFeature('talim')) {
      const santriClassKey = Store.talimClassKey(Store.tingkatForSantri(s), Store.kelasForSantri(s));
      if (santriClassKey && santriClassKey !== '|') {
        (db.ustadz || []).forEach(u => {
          Store.talimAssignmentsForUstadz(u).forEach(a => {
            if (a.mapel && a.mapel.id && a.kelasKeys.includes(santriClassKey) && !kajianByMapel.has(a.mapel.id)) {
              kajianByMapel.set(a.mapel.id, []);
            }
          });
        });
      }
    }
    // Include any saved Materi Kajian subjects even if journals were cleared/moved
    Object.keys(savedKajian).forEach(key => {
      if (!kajianByMapel.has(key)) kajianByMapel.set(key, []);
    });
    const kajianItems = [...kajianByMapel.entries()].map(([key, list]) => {
      const first = list[0] || {};
      const last = list[list.length - 1] || {};
      const savedEntry = savedKajian[key];
      const mapelObj = Store.findTalimMapel ? Store.findTalimMapel(key) : null;
      const mapelName = (savedEntry && typeof savedEntry === 'object' && savedEntry.mapel)
        || last.mapel || (mapelObj && mapelObj.nama) || key;
      const kitabName = (savedEntry && typeof savedEntry === 'object' && savedEntry.kitab)
        || last.judulKitab || (mapelObj && mapelObj.kitabNama) || '';
      const babAwal = first.bab || '';
      const babAkhir = last.bab || '';
      const babSpan = (babAwal && babAkhir && babAwal !== babAkhir)
        ? `${babAwal} → ${babAkhir}`
        : (babAkhir || babAwal);
      const halAwal = first.halaman || '';
      const halAkhir = last.halaman || '';
      const halSpan = halAwal && halAkhir && halAwal !== halAkhir
        ? `${String(halAwal).split(/[–-]/)[0].trim()}–${String(halAkhir).split(/[–-]/).pop().trim()}`
        : (halAkhir || halAwal);
      const halPart = (halAwal || halAkhir) ? `Hal ${halSpan}` : '';
      const defaultCapaian = [
        babSpan,
        list.length ? `${list.length}x kajian${halPart ? ' · ' + halPart : ''}` : ''
      ].filter(Boolean).join(' · ') || 'Belum ada jurnal materi';
      const defaultCapaianAr = [
        babSpan,
        list.length ? `${toArabicDigits(list.length)} دروس${halSpan ? ' · ص ' + toArabicDigits(halSpan) : ''}` : ''
      ].filter(Boolean).join(' · ') || 'لم تُسجل دروس بعد';
      const hasCustomCapaian = !!(savedEntry && typeof savedEntry === 'object' && savedEntry.capaian && savedEntry.capaian !== defaultCapaian);
      const capaian = (savedEntry && typeof savedEntry === 'object' && savedEntry.capaian)
        ? savedEntry.capaian
        : defaultCapaian;
      const capaianArab = (savedEntry && typeof savedEntry === 'object' && savedEntry.capaianArab)
        ? String(savedEntry.capaianArab).trim()
        : '';
      const rawNilai = (savedEntry && typeof savedEntry === 'object') ? savedEntry.nilai : savedEntry;
      const numNilai = Number(rawNilai);
      const nilai = (rawNilai !== '' && rawNilai !== null && rawNilai !== undefined && Number.isFinite(numNilai) && numNilai > 0)
        ? Math.round(numNilai)
        : 0;
      return { key, mapel: mapelName, kitab: kitabName, count: list.length, defaultCapaian, defaultCapaianAr, hasCustomCapaian, capaian, capaianArab, nilai };
    });

    const scoredPrograms = [];
    if (Store.hasFeature('tahsin') && avg(tahsinList)) scoredPrograms.push(avg(tahsinList));
    if (Store.hasFeature('ziyadah') && avg(ziyadahList)) scoredPrograms.push(avg(ziyadahList));
    if (Store.hasFeature('mutqin') && avg(mutqinList)) scoredPrograms.push(avg(mutqinList));
    if (Store.hasFeature('murojaah') && murojaahStats && murojaahStats.nilaiRata) scoredPrograms.push(murojaahStats.nilaiRata);
    kajianItems.forEach(k => { if (k.nilai > 0) scoredPrograms.push(k.nilai); });
    const avgNilai = scoredPrograms.length
      ? Math.round(scoredPrograms.reduce((sum, v) => sum + v, 0) / scoredPrograms.length)
      : Store.avgNilaiRentang(s.id, dari, sampai);

    const fallbackCat = (db.catatan || []).filter(c => c.santriId === s.id && inPeriod(c.tanggal)).slice().sort(sortByTime).pop();
    const ustadzList = [...new Set(Store.halaqahForSantri(s).flatMap(h => Store.ustadzNamesForHalaqah(h)))];
    const ustadzListArab = [...new Set(Store.halaqahForSantri(s).flatMap(h =>
      Store.ustadzIdsForHalaqah(h).map(id => {
        const u = Store.findUstadz(id);
        return u ? ((u.namaArab || '').trim() || u.nama) : '';
      }).filter(Boolean)
    ))];
    const primaryUstadz = (saved && saved.ustadzId ? Store.findUstadz(saved.ustadzId) : null)
      || Store.halaqahForSantri(s).flatMap(h => Store.ustadzIdsForHalaqah(h).map(id => Store.findUstadz(id))).find(Boolean)
      || null;
    const cfg = db.settings || {};
    const ustadzTtd = UI.safeUrl((saved && saved.ttdUstadz) || (primaryUstadz && primaryUstadz.ttd) || '');
    const pimpinanTtd = UI.safeUrl(cfg.ttdPimpinan || '');
    const capLembaga = UI.safeUrl(cfg.capLembaga || '');

    return {
      s,
      tahsinList, tahsinAvg: avg(tahsinList),
      ziyadahList, ziyadahAvg: avg(ziyadahList),
      mutqinList, mutqinAvg: avg(mutqinList),
      mutqinPages: mutqinList.reduce((sum, m) => sum + (Number(m.totalHafalan) || 0), 0),
      murojaahStats,
      talimJournals, talimAbsen, kajianItems,
      totalH, juzLabel,
      avgNilai,
      predikat: raportPredikat(avgNilai),
      kehadiran,
      saved,
      sikap: saved ? (saved.sikap || '-') : '-',
      catatan: saved ? (saved.catatan || '') : (fallbackCat ? fallbackCat.isi : ''),
      catatanArab: saved ? (saved.catatanArab || '') : '',
      rekomendasi: saved ? (saved.rekomendasi || '') : '',
      rekomendasiArab: saved ? (saved.rekomendasiArab || '') : '',
      ustadzLabel: ustadzList.join(', ') || '-',
      ustadzLabelArab: ustadzListArab.join('، ') || (ustadzList.join(', ') || '-'),
      ustadzTtd,
      pimpinanTtd,
      capLembaga
    };
  }

  function buildRaportModelData(info, state) {
    const db = Store.get();
    const cfg = db.settings || {};
    const s = info.s;
    const model = normalizeRaportModel(state.model || cfg.raportModel);
    const isRtl = model === 'model3';
    const isBi = model === 'model2';
    const isFemale = s.jk === 'P';
    const studentAr = isFemale ? 'اسم الطالبة' : 'اسم الطالب';
    const genderAr = s.jk === 'L' ? 'ذكر' : (s.jk === 'P' ? 'أنثى' : '-');

    const kotaTtd = (cfg.kota || '').trim();
    const kotaTtdAr = (cfg.kotaArab || cfg.kota || '').trim();
    const tglTtdId = (kotaTtd ? kotaTtd + ', ' : '') + UI.fmtDate(Store.todayStr());
    const tglTtdAr = (kotaTtdAr ? kotaTtdAr + '، ' : '') + fmtDateArab(Store.todayStr());
    const jabPimpinan = cfg.jabatanPimpinan || 'Mudir / Kepala Lembaga';
    const jabAr = (cfg.jabatanPimpinanArab || '').trim() || (jabPimpinan === 'Mudir / Kepala Lembaga'
      ? 'مدير المؤسسة'
      : (/[\u0600-\u06FF]/.test(jabPimpinan) ? jabPimpinan : 'مدير المؤسسة'));
    const namaPimpinan = (cfg.namaPimpinan || '').trim() || '( ________________________ )';
    const namaPimpinanAr = (cfg.namaPimpinanArab || '').trim() || namaPimpinan;
    const santriNameAr = (s.namaArab || '').trim() || s.nama;
    const waliNameAr = (s.namaWaliArab || '').trim() || (s.namaWali || '( .............................. )');
    const halaqahIdStr = Store.halaqahSummaryForSantri(s) || '-';
    const halaqahArStr = raportHalaqahSummaryArab(s);
    const ustadzArStr = info.ustadzLabelArab || info.ustadzLabel;

    const progRows = [];
    if (Store.hasFeature('tahsin') && (Store.santriHasProgram(s, 'Tahsin') || info.tahsinList.length)) {
      const first = info.tahsinList[0], last = info.tahsinList[info.tahsinList.length - 1];
      progRows.push({
        idName: 'Tahsin / Bacaan',
        arName: 'تحسين التلاوة',
        idCap: info.tahsinList.length
          ? `${info.tahsinList.length}x setoran · Hal ${first.halAwal} → ${last.halAkhir}`
          : 'Belum ada setoran pada periode ini',
        arCap: info.tahsinList.length
          ? `${toArabicDigits(info.tahsinList.length)} مرات تسميع · صفحة ${toArabicDigits(first.halAwal)} إلى ${toArabicDigits(last.halAkhir)}`
          : 'لم يتم التسميع خلال هذه الفترة',
        idSub: '',
        arSub: '',
        nilai: info.tahsinAvg,
        nilaiAr: info.tahsinAvg ? toArabicDigits(info.tahsinAvg) : '',
        pred: raportPredikat(info.tahsinAvg, model),
        predId: raportPredikat(info.tahsinAvg, 'model1'),
        predAr: info.tahsinAvg ? raportPredikat(info.tahsinAvg, 'model3') : ''
      });
    }
    if (Store.hasFeature('ziyadah') && (Store.santriHasProgram(s, 'Ziyadah') || info.ziyadahList.length)) {
      const first = info.ziyadahList[0], last = info.ziyadahList[info.ziyadahList.length - 1];
      progRows.push({
        idName: 'Ziyadah (Tahfidz)',
        arName: 'الزيادة (حفظ القرآن)',
        idCap: info.ziyadahList.length
          ? `${info.ziyadahList.length}x setoran (${formatSetoranLabel(first)} → ${formatSetoranLabel(last)})`
          : 'Belum ada setoran pada periode ini',
        arCap: info.ziyadahList.length
          ? `${toArabicDigits(info.ziyadahList.length)} مرات تسميع (${formatSetoranLabelArab(first)} ← ${formatSetoranLabelArab(last)})`
          : 'لم يتم التسميع خلال هذه الفترة',
        idSub: info.totalH
          ? `Total Hafalan: ${info.totalH.pages} halaman penuh${info.juzLabel ? ' (' + info.juzLabel + ')' : ''}`
          : 'Total Hafalan: -',
        arSub: info.totalH
          ? `إجمالي الحفظ: ${toArabicDigits(info.totalH.pages)} صفحة كاملة${info.juzLabel ? ' (' + juzHafalanArab(info.juzLabel) + ')' : ''}`
          : 'إجمالي الحفظ: -',
        nilai: info.ziyadahAvg,
        nilaiAr: info.ziyadahAvg ? toArabicDigits(info.ziyadahAvg) : '',
        pred: raportPredikat(info.ziyadahAvg, model),
        predId: raportPredikat(info.ziyadahAvg, 'model1'),
        predAr: info.ziyadahAvg ? raportPredikat(info.ziyadahAvg, 'model3') : ''
      });
    }
    if (Store.hasFeature('mutqin') && (Store.santriHasProgram(s, 'Mutqin') || info.mutqinList.length)) {
      const last = info.mutqinList[info.mutqinList.length - 1];
      progRows.push({
        idName: 'Program Mutqin',
        arName: 'برنامج الإتقان',
        idCap: info.mutqinList.length
          ? `${info.mutqinList.length}x ujian · ${info.mutqinPages ? info.mutqinPages + ' hlm · ' : ''}${formatSetoranLabel(last)}`
          : 'Belum ada setoran pada periode ini',
        arCap: info.mutqinList.length
          ? `${toArabicDigits(info.mutqinList.length)} مرات اختبار · ${info.mutqinPages ? toArabicDigits(info.mutqinPages) + ' صفحة · ' : ''}${formatSetoranLabelArab(last)}`
          : 'لم يتم الاختبار خلال هذه الفترة',
        idSub: '',
        arSub: '',
        nilai: info.mutqinAvg,
        nilaiAr: info.mutqinAvg ? toArabicDigits(info.mutqinAvg) : '',
        pred: raportPredikat(info.mutqinAvg, model),
        predId: raportPredikat(info.mutqinAvg, 'model1'),
        predAr: info.mutqinAvg ? raportPredikat(info.mutqinAvg, 'model3') : ''
      });
    }
    if (Store.hasFeature('murojaah') && info.murojaahStats) {
      const ms = info.murojaahStats;
      const mAvg = ms.nilaiRata || 0;
      progRows.push({
        idName: 'Murojaah',
        arName: 'المراجعة',
        idCap: ms.setoran
          ? `${ms.setoran}x pengulangan · ${ms.pages} halaman penuh (${ms.ayahs} ayat)`
          : 'Belum ada catatan murojaah pada periode ini',
        arCap: ms.setoran
          ? `${toArabicDigits(ms.setoran)} مرات مراجعة · ${toArabicDigits(ms.pages)} صفحة كاملة (${toArabicDigits(ms.ayahs)} آية)`
          : 'لم تُسجل مراجعة خلال هذه الفترة',
        idSub: '',
        arSub: '',
        nilai: mAvg,
        nilaiAr: mAvg ? toArabicDigits(mAvg) : '',
        pred: raportPredikat(mAvg, model),
        predId: raportPredikat(mAvg, 'model1'),
        predAr: mAvg ? raportPredikat(mAvg, 'model3') : ''
      });
    }
    if (Store.hasFeature('talim')) {
      if (info.kajianItems.length) {
        info.kajianItems.forEach(k => {
          const kajianTitle = /^kajian\b/i.test(k.mapel) ? k.mapel : `Kajian ${k.mapel}`;
          progRows.push({
            idName: kajianTitle,
            arName: `مادة ${k.mapel}`,
            idCap: k.capaian,
            arCap: k.capaianArab || (k.hasCustomCapaian ? k.capaian : k.defaultCapaianAr),
            idSub: k.kitab ? `Kitab: ${k.kitab}` : '',
            arSub: k.kitab ? `الكتاب: ${k.kitab}` : '',
            nilai: k.nilai,
            nilaiAr: k.nilai ? toArabicDigits(k.nilai) : '',
            pred: raportPredikat(k.nilai, model),
            predId: raportPredikat(k.nilai, 'model1'),
            predAr: k.nilai ? raportPredikat(k.nilai, 'model3') : ''
          });
        });
      } else {
        progRows.push({
          idName: 'Kajian',
          arName: 'المواد الدراسية',
          idCap: 'Belum ada jurnal kajian pada periode ini',
          arCap: 'لم تُسجل دروس علمية خلال هذه الفترة',
          idSub: '',
          arSub: '',
          nilai: 0,
          nilaiAr: '',
          pred: '-',
          predId: '-',
          predAr: ''
        });
      }
    }

    const santriArInput = (s.namaArab || '').trim();
    const metaPairs = [
      {
        lId: 'Nama Santri', lAr: studentAr,
        lValId: s.nama,
        lValAr: santriArInput,
        lVal: isRtl ? santriNameAr : s.nama,
        rId: 'Tahun Ajaran', rAr: 'العام الدراسي',
        rValId: state.tahunAjaran,
        rValAr: toArabicDigits(state.tahunAjaran),
        rVal: isRtl ? toArabicDigits(state.tahunAjaran) : state.tahunAjaran
      },
      {
        lId: 'NIS / JK', lAr: 'رقم القيد / الجنس',
        lValId: `${s.nis || '-'} / ${s.jk || '-'}`,
        lValAr: `${s.nis ? toArabicDigits(s.nis) : '-'} / ${genderAr}`,
        lVal: isRtl ? `${s.nis ? toArabicDigits(s.nis) : '-'} / ${genderAr}` : `${s.nis || '-'} / ${s.jk || '-'}`,
        rId: 'Semester', rAr: 'الفصل الدراسي',
        rValId: state.semester || '-',
        rValAr: raportSemesterLabel(state.semester, 'model3'),
        rVal: isRtl ? raportSemesterLabel(state.semester, 'model3') : (state.semester || '-')
      },
      {
        lId: 'Tingkat & Kelas', lAr: 'المرحلة والفصل',
        lValId: Store.educationLabel(s),
        lValAr: raportEducationLabel(s, 'model3'),
        lVal: isRtl ? raportEducationLabel(s, 'model3') : Store.educationLabel(s),
        rId: 'Periode Penilaian', rAr: 'فترة التقييم',
        rValId: `${UI.fmtDate(state.dari)} – ${UI.fmtDate(state.sampai)}`,
        rValAr: `${fmtDateArab(state.dari)} – ${fmtDateArab(state.sampai)}`,
        rVal: isRtl ? `${fmtDateArab(state.dari)} – ${fmtDateArab(state.sampai)}` : `${UI.fmtDate(state.dari)} – ${UI.fmtDate(state.sampai)}`
      },
      {
        lId: 'Halaqah / Program', lAr: 'الحلقة / البرنامج',
        lValId: halaqahIdStr,
        lValAr: halaqahArStr !== '-' ? halaqahArStr : '',
        lVal: isRtl ? halaqahArStr : halaqahIdStr,
        rId: 'Pembimbing', rAr: 'المشرف',
        rValId: info.ustadzLabel,
        rValAr: ustadzArStr !== info.ustadzLabel ? ustadzArStr : '',
        rVal: isRtl ? ustadzArStr : info.ustadzLabel
      }
    ];

    const hasKajianAtt = !!(info.talimAbsen && info.talimAbsen.slot > 0);
    const attRows = info.kehadiran ? [
      { idName: 'Halaqah (Al-Qur’an)', arName: 'حلقة القرآن الكريم', att: info.kehadiran },
      ...(hasKajianAtt ? [{ idName: 'Kajian', arName: 'الدرس العلمي', att: info.talimAbsen }] : [])
    ] : [];

    const sikapArOnly = info.sikap && info.sikap !== '-' ? raportSikapLabel(info.sikap, 'model3') : '';
    const closingRows = [
      {
        idLabel: 'Akhlaq & Kedisiplinan', arLabel: 'الأخلاق والانضباط',
        valId: info.sikap || '-', valAr: sikapArOnly !== info.sikap ? sikapArOnly : '',
        val: isRtl ? (sikapArOnly || '-') : (info.sikap || '-'), multiline: false
      },
      {
        idLabel: 'Catatan Ustadz', arLabel: 'ملاحظات المشرف',
        valId: info.catatan || '-', valAr: info.catatanArab || '',
        val: isRtl ? (info.catatanArab || info.catatan || '-') : (info.catatan || '-'), multiline: true
      },
      {
        idLabel: 'Rekomendasi', arLabel: 'التوصيات',
        valId: info.rekomendasi || '-', valAr: info.rekomendasiArab || '',
        val: isRtl ? (info.rekomendasiArab || info.rekomendasi || '-') : (info.rekomendasi || '-'), multiline: false
      }
    ];

    const waliIdName = s.namaWali || '( .............................. )';
    const ustIdName = info.ustadzLabel !== '-' ? info.ustadzLabel : '( .............................. )';
    const signs = [
      {
        idTop: 'Mengetahui,', arTop: 'يعتمد،',
        idRole: 'Orang Tua / Wali Santri', arRole: isFemale ? 'ولي أمر الطالبة' : 'ولي أمر الطالب',
        name: isRtl ? waliNameAr : waliIdName,
        nameAr: (s.namaWaliArab || '').trim(),
        ttdUrl: '', capUrl: ''
      },
      {
        idTop: '', arTop: '',
        idRole: 'Ustadz Pembimbing', arRole: 'الأستاذ المشرف',
        name: isRtl ? (ustadzArStr !== '-' ? ustadzArStr : '( .............................. )') : ustIdName,
        nameAr: ustadzArStr !== info.ustadzLabel && ustadzArStr !== '-' ? ustadzArStr : '',
        ttdUrl: info.ustadzTtd, capUrl: ''
      },
      {
        idTop: tglTtdId, arTop: tglTtdAr,
        idRole: jabPimpinan, arRole: jabAr,
        name: isRtl ? namaPimpinanAr : namaPimpinan,
        nameAr: (cfg.namaPimpinanArab || '').trim(),
        ttdUrl: info.pimpinanTtd, capUrl: info.capLembaga
      }
    ];

    const instId = cfg.namaLembaga || 'Lembaga Tahfidz';
    const instAr = (cfg.namaLembagaArab || '').trim();
    const addrId = cfg.alamat || '';
    const addrAr = (cfg.alamatArab || '').trim();

    return {
      model, isRtl, isBi,
      logoUrl: UI.safeUrl(cfg.logo),
      instName: isRtl ? (instAr || instId) : instId,
      instNameAr: instAr,
      instAddr: isRtl ? (addrAr || addrId) : addrId,
      instAddrAr: addrAr,
      titleId: 'RAPORT HASIL BELAJAR TAHFIDZ AL-QUR’AN',
      titleAr: 'كشف نتائج دراسة وتحفيظ القرآن الكريم',
      metaPairs,
      progRows,
      avgScoreStr: info.avgNilai ? (isRtl ? toArabicDigits(info.avgNilai) : String(info.avgNilai)) : '-',
      avgScoreAr: info.avgNilai ? toArabicDigits(info.avgNilai) : '',
      avgPred: raportPredikat(info.avgNilai, model),
      avgPredId: raportPredikat(info.avgNilai, 'model1'),
      avgPredAr: info.avgNilai ? raportPredikat(info.avgNilai, 'model3') : '',
      hasKajianAtt,
      attRows,
      closingRows,
      signs
    };
  }

  function buildRaportSheetHtml(info, state) {
    const d = buildRaportModelData(info, state);
    const fmtNum = v => (v ? (d.isRtl ? toArabicDigits(v) : String(v)) : '-');

    if (d.model === 'model1') {
      const rows = d.progRows.map(r => {
        const subHtml = r.idSub
          ? `<div class="rp-sub">${r.idName.startsWith('Ziyadah') ? UI.esc(r.idSub).replace('Total Hafalan: ', 'Total Hafalan: <b>').replace(/(\s*\(|$)/, '</b>$1') : `<i>${UI.esc(r.idSub)}</i>`}</div>`
          : '';
        return `<tr><td><b>${UI.esc(r.idName)}</b></td><td>${UI.esc(r.idCap)}${subHtml}</td><td class="center">${fmtNum(r.nilai)}</td><td class="center">${UI.esc(r.pred)}</td></tr>`;
      }).join('');

      return `
        <section class="raport-sheet">
          <div class="rp-header">
            ${d.logoUrl ? `<img class="rp-logo" src="${UI.esc(d.logoUrl)}" alt="Logo">` : ''}
            <div>
              <div class="rp-inst">${UI.esc(d.instName)}</div>
              <div class="rp-addr">${UI.esc(d.instAddr)}</div>
              <div class="rp-title">${UI.esc(d.titleId)}</div>
            </div>
          </div>
          <table class="rp-meta">
            ${d.metaPairs.map(mp => `<tr>
              <td><b>${UI.esc(mp.lId)}</b></td><td>: ${UI.esc(mp.lVal)}</td>
              <td><b>${UI.esc(mp.rId)}</b></td><td>: ${UI.esc(mp.rVal)}</td>
            </tr>`).join('')}
          </table>

          <div class="rp-sec">A. Capaian Pembelajaran &amp; Hafalan</div>
          <table class="rp-table">
            <thead><tr><th>Program / Bidang</th><th>Capaian Periode Ini</th><th class="center" style="width:72px">Nilai</th><th class="center" style="width:130px">Predikat</th></tr></thead>
            <tbody>
              ${rows || '<tr><td colspan="4" class="center">Belum ada modul program pembelajaran yang aktif.</td></tr>'}
              <tr class="rp-summary">
                <td colspan="2"><b>Rata-rata Nilai Akhir Periode</b></td>
                <td class="center"><b>${UI.esc(d.avgScoreStr)}</b></td>
                <td class="center"><b>${UI.esc(d.avgPred)}</b></td>
              </tr>
            </tbody>
          </table>

          ${d.attRows.length ? `
          <div class="rp-sec">B. Rekapitulasi Kehadiran</div>
          <table class="rp-table rp-att">
            <thead><tr>${d.hasKajianAtt ? '<th>Kegiatan</th>' : ''}<th class="center">Hadir</th><th class="center">Izin</th><th class="center">Sakit</th><th class="center">Libur</th><th class="center">Alfa</th><th class="center">Persentase</th></tr></thead>
            <tbody>
              ${d.attRows.map(ar => `<tr>
                ${d.hasKajianAtt ? `<td><b>${UI.esc(ar.idName)}</b></td>` : ''}
                <td class="center">${ar.att.Hadir}</td>
                <td class="center">${ar.att.Izin}</td>
                <td class="center">${ar.att.Sakit}</td>
                <td class="center">${ar.att.Libur}</td>
                <td class="center">${ar.att.Alfa}</td>
                <td class="center"><b>${ar.att.persen}%</b></td>
              </tr>`).join('')}
            </tbody>
          </table>` : ''}

          <div class="rp-closing">
            <div class="rp-sec">${d.attRows.length ? 'C' : 'B'}. Akhlaq, Catatan Pembimbing &amp; Rekomendasi</div>
            <table class="rp-table">
              <tbody>
                ${d.closingRows.map(cr => `<tr><td style="width:170px"><b>${UI.esc(cr.idLabel)}</b></td><td${cr.multiline ? ' style="white-space:pre-line"' : ''}>${UI.esc(cr.val)}</td></tr>`).join('')}
              </tbody>
            </table>

            <div class="rp-signs">
              ${d.signs.map(sc => `
                <div class="rp-sign">
                  <div>${sc.idTop ? UI.esc(sc.idTop) : '&nbsp;'}</div>
                  <div>${UI.esc(sc.idRole)}</div>
                  <div class="rp-sign-space">
                    ${sc.capUrl ? `<img class="rp-cap-img" src="${UI.esc(sc.capUrl)}" alt="Cap Lembaga">` : ''}
                    ${sc.ttdUrl ? `<img class="rp-sign-img" src="${UI.esc(sc.ttdUrl)}" alt="TTD">` : ''}
                  </div>
                  <div class="rp-sign-name">${UI.esc(sc.name)}</div>
                </div>`).join('')}
            </div>
          </div>
        </section>`;
    }

    if (d.model === 'model2') {
      const rows = d.progRows.map(r => {
        const showArCap = r.arCap && r.arCap !== r.idCap;
        return `<tr>
          <td><b>${UI.esc(r.idName)}</b><div class="rp-ar-sub" dir="rtl">${UI.esc(r.arName)}</div></td>
          <td>
            <div>${UI.esc(r.idCap)}${r.idSub ? `<div class="rp-sub">${UI.esc(r.idSub)}</div>` : ''}</div>
            ${showArCap ? `<div class="rp-ar-cap" dir="rtl">${UI.esc(r.arCap)}${r.arSub ? `<div class="rp-ar-sub">${UI.esc(r.arSub)}</div>` : ''}</div>` : (r.arSub ? `<div class="rp-ar-cap" dir="rtl">${UI.esc(r.arSub)}</div>` : '')}
          </td>
          <td class="center"><div>${fmtNum(r.nilai)}</div>${r.nilaiAr ? `<div class="rp-ar-sub" dir="rtl">${UI.esc(r.nilaiAr)}</div>` : ''}</td>
          <td class="center"><div>${UI.esc(r.predId)}</div>${r.predAr ? `<div class="rp-ar-sub" dir="rtl">${UI.esc(r.predAr)}</div>` : ''}</td>
        </tr>`;
      }).join('');

      const attHeaders = [
        ...(d.hasKajianAtt ? [{ id: 'Kegiatan', ar: 'النشاط', cls: '' }] : []),
        { id: 'Hadir', ar: 'الحضور', cls: 'center' },
        { id: 'Izin', ar: 'الاستئذان', cls: 'center' },
        { id: 'Sakit', ar: 'المرض', cls: 'center' },
        { id: 'Libur', ar: 'العطلة', cls: 'center' },
        { id: 'Alfa', ar: 'الغياب', cls: 'center' },
        { id: 'Persentase', ar: 'النسبة', cls: 'center' }
      ];

      return `
        <section class="raport-sheet rp-bilingual">
          <div class="rp-header">
            ${d.logoUrl ? `<img class="rp-logo" src="${UI.esc(d.logoUrl)}" alt="Logo">` : ''}
            <div style="flex:1">
              <div class="rp-inst">${UI.esc(d.instName)}</div>
              ${d.instNameAr ? `<div class="rp-ar-sub" dir="rtl" style="font-weight:700;text-align:left">${UI.esc(d.instNameAr)}</div>` : ''}
              <div class="rp-addr">${UI.esc(d.instAddr)}</div>
              ${d.instAddrAr ? `<div class="rp-ar-sub" dir="rtl" style="text-align:left;font-size:11.5px">${UI.esc(d.instAddrAr)}</div>` : ''}
              <div class="rp-title">${UI.esc(d.titleId)}</div>
              <div class="rp-title-ar" dir="rtl">${UI.esc(d.titleAr)}</div>
            </div>
          </div>
          <table class="rp-meta">
            ${d.metaPairs.map(mp => `<tr>
              <td><b>${UI.esc(mp.lId)}</b><div class="rp-ar-lbl" dir="rtl">${UI.esc(mp.lAr)}</div></td>
              <td>: ${UI.esc(mp.lValId)}${mp.lValAr ? `<div class="rp-ar-lbl" dir="rtl">${UI.esc(mp.lValAr)}</div>` : ''}</td>
              <td><b>${UI.esc(mp.rId)}</b><div class="rp-ar-lbl" dir="rtl">${UI.esc(mp.rAr)}</div></td>
              <td>: ${UI.esc(mp.rValId)}${mp.rValAr ? `<div class="rp-ar-lbl" dir="rtl">${UI.esc(mp.rValAr)}</div>` : ''}</td>
            </tr>`).join('')}
          </table>

          <div class="rp-sec rp-sec-bi"><span>A. Capaian Pembelajaran &amp; Hafalan</span><span class="rp-ar-sec" dir="rtl">نتائج التعلم والحفظ</span></div>
          <table class="rp-table">
            <thead><tr>
              <th>Program / Bidang<div class="rp-ar-th" dir="rtl">البرنامج / المادة</div></th>
              <th>Capaian Periode Ini<div class="rp-ar-th" dir="rtl">الإنجاز خلال الفترة</div></th>
              <th class="center" style="width:74px">Nilai<div class="rp-ar-th" dir="rtl">الدرجة</div></th>
              <th class="center" style="width:155px">Predikat<div class="rp-ar-th" dir="rtl">التقدير</div></th>
            </tr></thead>
            <tbody>
              ${rows || '<tr><td colspan="4" class="center">Belum ada modul program pembelajaran yang aktif.</td></tr>'}
              <tr class="rp-summary">
                <td colspan="2"><b>Rata-rata Nilai Akhir Periode</b><div class="rp-ar-sub" dir="rtl">المعدل العام للفترة</div></td>
                <td class="center"><b>${UI.esc(d.avgScoreStr)}</b>${d.avgScoreAr ? `<div class="rp-ar-sub" dir="rtl">${UI.esc(d.avgScoreAr)}</div>` : ''}</td>
                <td class="center"><b>${UI.esc(d.avgPredId)}</b>${d.avgPredAr ? `<div class="rp-ar-sub" dir="rtl">${UI.esc(d.avgPredAr)}</div>` : ''}</td>
              </tr>
            </tbody>
          </table>

          ${d.attRows.length ? `
          <div class="rp-sec rp-sec-bi"><span>B. Rekapitulasi Kehadiran</span><span class="rp-ar-sec" dir="rtl">خلاصة الحضور والغياب</span></div>
          <table class="rp-table rp-att">
            <thead><tr>${attHeaders.map(h => `<th${h.cls ? ` class="${h.cls}"` : ''}>${UI.esc(h.id)}<div class="rp-ar-th" dir="rtl">${UI.esc(h.ar)}</div></th>`).join('')}</tr></thead>
            <tbody>
              ${d.attRows.map(ar => `<tr>
                ${d.hasKajianAtt ? `<td><b>${UI.esc(ar.idName)}</b><div class="rp-ar-sub" dir="rtl">${UI.esc(ar.arName)}</div></td>` : ''}
                <td class="center"><div>${ar.att.Hadir}</div><div class="rp-ar-sub" dir="rtl">${toArabicDigits(ar.att.Hadir)}</div></td>
                <td class="center"><div>${ar.att.Izin}</div><div class="rp-ar-sub" dir="rtl">${toArabicDigits(ar.att.Izin)}</div></td>
                <td class="center"><div>${ar.att.Sakit}</div><div class="rp-ar-sub" dir="rtl">${toArabicDigits(ar.att.Sakit)}</div></td>
                <td class="center"><div>${ar.att.Libur}</div><div class="rp-ar-sub" dir="rtl">${toArabicDigits(ar.att.Libur)}</div></td>
                <td class="center"><div>${ar.att.Alfa}</div><div class="rp-ar-sub" dir="rtl">${toArabicDigits(ar.att.Alfa)}</div></td>
                <td class="center"><div><b>${ar.att.persen}%</b></div><div class="rp-ar-sub" dir="rtl">${toArabicDigits(ar.att.persen + '%')}</div></td>
              </tr>`).join('')}
            </tbody>
          </table>` : ''}

          <div class="rp-closing">
            <div class="rp-sec rp-sec-bi"><span>${d.attRows.length ? 'C' : 'B'}. Akhlaq, Catatan Pembimbing &amp; Rekomendasi</span><span class="rp-ar-sec" dir="rtl">السلوك وملاحظات المشرف والتوصيات</span></div>
            <table class="rp-table">
              <tbody>
                ${d.closingRows.map(cr => `<tr><td style="width:190px"><b>${UI.esc(cr.idLabel)}</b><div class="rp-ar-sub" dir="rtl">${UI.esc(cr.arLabel)}</div></td><td${cr.multiline ? ' style="white-space:pre-line"' : ''}><div>${UI.esc(cr.valId)}</div>${cr.valAr ? `<div class="rp-ar-cap" dir="rtl">${UI.esc(cr.valAr)}</div>` : ''}</td></tr>`).join('')}
              </tbody>
            </table>

            <div class="rp-signs">
              ${d.signs.map(sc => `
                <div class="rp-sign">
                  <div>${sc.idTop ? UI.esc(sc.idTop) : '&nbsp;'}</div>
                  ${sc.arTop ? `<div class="rp-ar-sub" dir="rtl">${UI.esc(sc.arTop)}</div>` : ''}
                  <div>${UI.esc(sc.idRole)}</div>
                  <div class="rp-ar-sub" dir="rtl">${UI.esc(sc.arRole)}</div>
                  <div class="rp-sign-space">
                    ${sc.capUrl ? `<img class="rp-cap-img" src="${UI.esc(sc.capUrl)}" alt="Cap Lembaga">` : ''}
                    ${sc.ttdUrl ? `<img class="rp-sign-img" src="${UI.esc(sc.ttdUrl)}" alt="TTD">` : ''}
                  </div>
                  <div class="rp-sign-name">${UI.esc(sc.name)}</div>
                  ${sc.nameAr ? `<div class="rp-ar-sub" dir="rtl" style="font-weight:700">${UI.esc(sc.nameAr)}</div>` : ''}
                </div>`).join('')}
            </div>
          </div>
        </section>`;
    }

    // Model 3 — Full Bahasa Arab (RTL)
    const rowsAr = d.progRows.map(r => {
      const subHtml = r.arSub ? `<div class="rp-sub">${UI.esc(r.arSub)}</div>` : '';
      return `<tr><td><b>${UI.esc(r.arName)}</b></td><td>${UI.esc(r.arCap)}${subHtml}</td><td class="center">${fmtNum(r.nilai)}</td><td class="center">${UI.esc(r.pred)}</td></tr>`;
    }).join('');
    const secBPrefix = d.attRows.length ? 'ثالثًا' : 'ثانيًا';

    return `
      <section class="raport-sheet rp-rtl" dir="rtl" lang="ar">
        <div class="rp-header">
          ${d.logoUrl ? `<img class="rp-logo" src="${UI.esc(d.logoUrl)}" alt="Logo">` : ''}
          <div style="flex:1">
            <div class="rp-inst">${UI.esc(d.instName)}</div>
            <div class="rp-addr">${UI.esc(d.instAddr)}</div>
            <div class="rp-title">${UI.esc(d.titleAr)}</div>
          </div>
        </div>
        <table class="rp-meta">
          ${d.metaPairs.map(mp => `<tr>
            <td><b>${UI.esc(mp.lAr)}</b></td><td>: ${UI.esc(mp.lVal)}</td>
            <td><b>${UI.esc(mp.rAr)}</b></td><td>: ${UI.esc(mp.rVal)}</td>
          </tr>`).join('')}
        </table>

        <div class="rp-sec">أولًا: نتائج التعلم وحفظ القرآن الكريم</div>
        <table class="rp-table">
          <thead><tr><th>البرنامج / المادة</th><th>الإنجاز خلال الفترة</th><th class="center" style="width:72px">الدرجة</th><th class="center" style="width:125px">التقدير</th></tr></thead>
          <tbody>
            ${rowsAr || '<tr><td colspan="4" class="center">لا توجد برامج دراسية مفعلة حاليًا.</td></tr>'}
            <tr class="rp-summary">
              <td colspan="2"><b>المعدل العام للفترة</b></td>
              <td class="center"><b>${UI.esc(d.avgScoreStr)}</b></td>
              <td class="center"><b>${UI.esc(d.avgPred)}</b></td>
            </tr>
          </tbody>
        </table>

        ${d.attRows.length ? `
        <div class="rp-sec">ثانيًا: خلاصة الحضور والغياب</div>
        <table class="rp-table rp-att">
          <thead><tr>${d.hasKajianAtt ? '<th>النشاط</th>' : ''}<th class="center">الحضور</th><th class="center">الاستئذان</th><th class="center">المرض</th><th class="center">العطلة</th><th class="center">الغياب</th><th class="center">النسبة</th></tr></thead>
          <tbody>
            ${d.attRows.map(ar => `<tr>
              ${d.hasKajianAtt ? `<td><b>${UI.esc(ar.arName)}</b></td>` : ''}
              <td class="center">${toArabicDigits(ar.att.Hadir)}</td>
              <td class="center">${toArabicDigits(ar.att.Izin)}</td>
              <td class="center">${toArabicDigits(ar.att.Sakit)}</td>
              <td class="center">${toArabicDigits(ar.att.Libur)}</td>
              <td class="center">${toArabicDigits(ar.att.Alfa)}</td>
              <td class="center"><b>${toArabicDigits(ar.att.persen + '%')}</b></td>
            </tr>`).join('')}
          </tbody>
        </table>` : ''}

        <div class="rp-closing">
          <div class="rp-sec">${secBPrefix}: السلوك وملاحظات المشرف والتوصيات</div>
          <table class="rp-table">
            <tbody>
              ${d.closingRows.map(cr => `<tr><td style="width:170px"><b>${UI.esc(cr.arLabel)}</b></td><td${cr.multiline ? ' style="white-space:pre-line"' : ''}>${UI.esc(cr.val)}</td></tr>`).join('')}
            </tbody>
          </table>

          <div class="rp-signs">
            ${d.signs.map(sc => `
              <div class="rp-sign">
                <div>${sc.arTop ? UI.esc(sc.arTop) : '&nbsp;'}</div>
                <div>${UI.esc(sc.arRole)}</div>
                <div class="rp-sign-space">
                  ${sc.capUrl ? `<img class="rp-cap-img" src="${UI.esc(sc.capUrl)}" alt="Cap Lembaga">` : ''}
                  ${sc.ttdUrl ? `<img class="rp-sign-img" src="${UI.esc(sc.ttdUrl)}" alt="TTD">` : ''}
                </div>
                <div class="rp-sign-name">${UI.esc(sc.name)}</div>
              </div>`).join('')}
          </div>
        </div>
      </section>`;
  }

  function printRaportSheets(sheetsHtml, docTitle) {
    if (!sheetsHtml) {
      UI.toast('Tidak ada data raport untuk dicetak', 'error');
      return;
    }
    const w = window.open('', '_blank');
    if (!w) {
      UI.toast('Izinkan pop-up untuk mencetak Raport PDF', 'error');
      return;
    }
    w.onafterprint = () => w.close();
    w.document.open();
    w.document.write(`<!doctype html>
      <html lang="id">
      <head>
        <meta charset="utf-8">
        <title>${UI.esc(docTitle || 'Raport_Santri')}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" rel="stylesheet" />
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          * { box-sizing: border-box; }
          body { margin: 0; background: #fff; color: #000; font: 9.5pt Arial, sans-serif; line-height: 1.32; }
          .raport-sheet { page-break-after: always; break-after: page; color: #000; }
          .raport-sheet:last-child { page-break-after: auto; break-after: auto; }
          .raport-sheet.rp-rtl { direction: rtl; text-align: right; font-family: 'Amiri', 'Traditional Arabic', Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; }
          .rp-header { display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 9px; }
          .rp-logo { width: 46px; height: 46px; object-fit: contain; }
          .rp-inst { font-size: 12.5pt; font-weight: 700; text-transform: uppercase; color: #000; }
          .rp-addr { font-size: 8pt; color: #000; }
          .rp-title { font-size: 10.5pt; font-weight: 700; margin-top: 2px; letter-spacing: 0.3px; color: #000; }
          .rp-rtl .rp-title { font-size: 13pt; letter-spacing: 0; }
          .rp-title-ar { font-family: 'Amiri', 'Traditional Arabic', serif; font-size: 11.5pt; font-weight: 700; margin-top: 2px; color: #000; text-align: left; }
          .rp-meta { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 9pt; color: #000; }
          .rp-rtl .rp-meta { font-size: 10pt; }
          .rp-meta td { padding: 2px 4px; vertical-align: top; color: #000; }
          .rp-ar-lbl { font-family: 'Amiri', 'Traditional Arabic', serif; font-size: 9pt; font-weight: 400; color: #222; line-height: 1.25; }
          .rp-sec { font-size: 9.5pt; font-weight: 700; margin: 8px 0 4px; color: #000; page-break-after: avoid; break-after: avoid; }
          .rp-rtl .rp-sec { font-size: 11pt; }
          .rp-sec-bi { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
          .rp-ar-sec { font-family: 'Amiri', 'Traditional Arabic', serif; font-size: 10.5pt; font-weight: 700; }
          .rp-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; color: #000; }
          .rp-table tr { page-break-inside: avoid; break-inside: avoid; }
          .rp-table th, .rp-table td { border: 1px solid #000; padding: 4px 6px; font-size: 8.8pt; vertical-align: top; color: #000; background: #fff; }
          .rp-rtl .rp-table th, .rp-rtl .rp-table td { font-size: 9.8pt; padding: 4px 7px; }
          .rp-table th { background: #fff; font-weight: 700; text-align: left; }
          .rp-rtl .rp-table th { text-align: right; }
          .rp-table th.center, .rp-table td.center { text-align: center; }
          .rp-ar-th { font-family: 'Amiri', 'Traditional Arabic', serif; font-size: 9pt; font-weight: 700; line-height: 1.25; }
          .rp-ar-sub { font-family: 'Amiri', 'Traditional Arabic', serif; font-size: 9pt; font-weight: 400; color: #111; line-height: 1.3; margin-top: 1px; }
          .rp-ar-cap { font-family: 'Amiri', 'Traditional Arabic', serif; font-size: 9.2pt; color: #111; line-height: 1.35; margin-top: 2px; }
          .rp-ar-inline { font-family: 'Amiri', 'Traditional Arabic', serif; font-size: 9.5pt; font-weight: 700; }
          .rp-sub { font-size: 8pt; color: #000; margin-top: 1.5px; }
          .rp-rtl .rp-sub { font-size: 9pt; }
          .rp-summary td { background: #fff; font-weight: 700; }
          .rp-closing { page-break-inside: avoid; break-inside: avoid; }
          .rp-signs { display: flex; justify-content: space-between; gap: 14px; margin-top: 14px; page-break-inside: avoid; break-inside: avoid; color: #000; }
          .rp-sign { flex: 1; text-align: center; font-size: 8.8pt; color: #000; }
          .rp-rtl .rp-sign { font-size: 9.8pt; }
          .rp-sign-space { position: relative; height: 52px; display: flex; align-items: center; justify-content: center; margin: 2px 0; }
          .rp-sign-img { max-height: 48px; max-width: 135px; object-fit: contain; position: relative; z-index: 2; }
          .rp-cap-img { position: absolute; left: 50%; top: 50%; transform: translate(-72%, -52%) rotate(-6deg); max-height: 62px; max-width: 90px; object-fit: contain; opacity: 0.85; z-index: 1; pointer-events: none; }
          .rp-rtl .rp-cap-img { transform: translate(-28%, -52%) rotate(6deg); }
          .rp-sign-name { font-weight: 700; text-decoration: underline; color: #000; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>${sheetsHtml}</body>
      </html>`);
    w.document.close();
    const imgs = [...w.document.images];
    const imgsReady = Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => {
      img.onload = res;
      img.onerror = res;
    })));
    const fontsReady = (w.document.fonts && w.document.fonts.ready) ? w.document.fonts.ready.catch(() => {}) : Promise.resolve();
    let printed = false;
    const triggerPrint = () => {
      if (printed || w.closed) return;
      printed = true;
      w.focus();
      w.print();
      UI.toast('Pilih "Simpan sebagai PDF" pada dialog cetak untuk mengunduh PDF', 'info');
    };
    Promise.race([Promise.all([imgsReady, fontsReady]), new Promise(res => setTimeout(res, 1800))]).then(() => setTimeout(triggerPrint, 80));
  }

  function renderRaportPage(container, options) {
    if (!container) return;
    const db = Store.get();
    const cfg = db.settings || {};
    const opt = options || {};
    const isWali = opt.mode === 'wali';
    const isAdmin = Store.getSession()?.role === 'admin';
    const canEdit = !!opt.canEdit;
    const allSantri = (opt.santriList || []).filter(s => s && s.status !== 'Nonaktif');
    const tahunOpts = [...new Set([...(db.tahunAjaran || ['2024/2025', '2025/2026', '2026/2027']), cfg.tahunAjaran].filter(Boolean))];
    const semOpts = [...new Set([...(db.semester || ['Ganjil', 'Genap']), cfg.semester].filter(Boolean))];
    const initTa = cfg.tahunAjaran || tahunOpts[0] || '2025/2026';
    const initSem = cfg.semester || semOpts[0] || 'Ganjil';
    const initRange = defaultRaportRange(initTa, initSem);
    const state = {
      tahunAjaran: initTa,
      semester: initSem,
      dari: initRange.dari,
      sampai: initRange.sampai,
      model: normalizeRaportModel(cfg.raportModel),
      ustadzId: opt.isUstadzScope ? '' : (opt.ustadzId || ''),
      halaqahId: opt.halaqahId || '',
      cari: '',
      includeAttendance: cfg.raportSertakanKehadiran !== false
    };

    const previewStyle = `
      <style>
        .rp-preview-card .raport-sheet { background:#fff; color:#000; padding:4px; }
        .rp-preview-card .raport-sheet.rp-rtl { direction:rtl; text-align:right; font-family:'Amiri','Traditional Arabic',Arial,sans-serif; font-size:14.5px; line-height:1.5; }
        .rp-preview-card .rp-header { display:flex; align-items:center; gap:12px; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:12px; color:#000; }
        .rp-preview-card .rp-logo { width:48px; height:48px; object-fit:contain; border-radius:6px; }
        .rp-preview-card .rp-inst { font-size:15px; font-weight:700; text-transform:uppercase; color:#000; }
        .rp-preview-card .rp-addr { font-size:12px; color:#000; }
        .rp-preview-card .rp-title { font-size:13.5px; font-weight:700; margin-top:2px; color:#000; }
        .rp-preview-card .rp-rtl .rp-title { font-size:17px; }
        .rp-preview-card .rp-title-ar { font-family:'Amiri','Traditional Arabic',serif; font-size:15.5px; font-weight:700; margin-top:2px; color:#000; text-align:left; }
        .rp-preview-card .rp-meta { width:100%; border-collapse:collapse; font-size:13px; margin-bottom:12px; color:#000; }
        .rp-preview-card .rp-rtl .rp-meta { font-size:14.5px; }
        .rp-preview-card .rp-meta td { padding:3px 6px; vertical-align:top; color:#000; }
        .rp-preview-card .rp-ar-lbl { font-family:'Amiri','Traditional Arabic',serif; font-size:12.5px; font-weight:400; color:#222; line-height:1.3; }
        .rp-preview-card .rp-sec { font-size:13.5px; font-weight:700; margin:12px 0 6px; color:#000; }
        .rp-preview-card .rp-rtl .rp-sec { font-size:15.5px; }
        .rp-preview-card .rp-sec-bi { display:flex; justify-content:space-between; align-items:baseline; gap:8px; flex-wrap:wrap; }
        .rp-preview-card .rp-ar-sec { font-family:'Amiri','Traditional Arabic',serif; font-size:14.5px; font-weight:700; }
        .rp-preview-card .rp-table { width:100%; border-collapse:collapse; margin-bottom:8px; font-size:13px; color:#000; }
        .rp-preview-card .rp-rtl .rp-table { font-size:14.5px; }
        .rp-preview-card .rp-table th, .rp-preview-card .rp-table td { border:1px solid #000; padding:6px 8px; vertical-align:top; color:#000; background:#fff; }
        .rp-preview-card .rp-table th { background:#fff; font-weight:700; text-align:left; }
        .rp-preview-card .rp-rtl .rp-table th { text-align:right; }
        .rp-preview-card .rp-table th.center, .rp-preview-card .rp-table td.center { text-align:center; }
        .rp-preview-card .rp-ar-th { font-family:'Amiri','Traditional Arabic',serif; font-size:12.5px; font-weight:700; line-height:1.3; }
        .rp-preview-card .rp-ar-sub { font-family:'Amiri','Traditional Arabic',serif; font-size:13px; font-weight:400; color:#111; line-height:1.35; margin-top:2px; }
        .rp-preview-card .rp-ar-cap { font-family:'Amiri','Traditional Arabic',serif; font-size:13.5px; color:#111; line-height:1.4; margin-top:3px; }
        .rp-preview-card .rp-ar-inline { font-family:'Amiri','Traditional Arabic',serif; font-size:13.5px; font-weight:700; }
        .rp-preview-card .rp-sub { font-size:12px; color:#000; margin-top:2px; }
        .rp-preview-card .rp-rtl .rp-sub { font-size:13px; }
        .rp-preview-card .rp-summary td { background:#fff; font-weight:700; }
        .rp-preview-card .rp-signs { display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:16px; margin-top:20px; text-align:center; font-size:12.5px; color:#000; }
        .rp-preview-card .rp-rtl .rp-signs { font-size:14px; }
        .rp-preview-card .rp-sign-space { position:relative; height:58px; display:flex; align-items:center; justify-content:center; margin:2px 0; }
        .rp-preview-card .rp-sign-img { max-height:54px; max-width:140px; object-fit:contain; position:relative; z-index:2; }
        .rp-preview-card .rp-cap-img { position:absolute; left:50%; top:50%; transform:translate(-72%, -52%) rotate(-6deg); max-height:66px; max-width:94px; object-fit:contain; opacity:0.85; z-index:1; pointer-events:none; }
        .rp-preview-card .rp-rtl .rp-cap-img { transform:translate(-28%, -52%) rotate(6deg); }
        .rp-preview-card .rp-sign-name { font-weight:700; text-decoration:underline; color:#000; }
      </style>`;

    const halaqahOpts = Array.isArray(opt.halaqahList)
      ? opt.halaqahList
      : (db.halaqah || []).filter(h => allSantri.some(s => Store.santriHasHalaqah(s, h)));
    const ustadzOpts = (!isWali && !opt.isUstadzScope)
      ? (db.ustadz || []).filter(u => halaqahOpts.some(h => Store.halaqahHasUstadz(h, u)))
        .slice().sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
      : [];
    const halaqahForUstadz = uId => {
      if (!uId) return halaqahOpts;
      const u = Store.findUstadz(uId);
      if (!u) return halaqahOpts;
      const list = halaqahOpts.filter(h => Store.halaqahHasUstadz(h, u));
      if (list.length) return list;
      return u.halaqah ? halaqahOpts.filter(h => h.nama === u.halaqah) : [];
    };
    const visibleHalaqahOpts = () => halaqahForUstadz(state.ustadzId);
    container.innerHTML = `
      ${previewStyle}
      <div class="clay-card mb">
        <div class="section-title">Periode Raport Santri</div>
        <div class="row" style="gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:140px">${UI.field('Tahun Ajaran', `<select class="clay-select" id="rp-ta">${UI.optionsFromList(tahunOpts.map(v => ({ v, l: v })), 'v', 'l', state.tahunAjaran)}</select>`)}</div>
          <div style="flex:1;min-width:120px">${UI.field('Semester', `<select class="clay-select" id="rp-sem">${UI.optionsFromList(semOpts.map(v => ({ v, l: v })), 'v', 'l', state.semester)}</select>`)}</div>
          <div style="flex:1;min-width:140px">${UI.field('Dari Tanggal', `<input type="date" class="clay-input" id="rp-dari" value="${state.dari}">`)}</div>
          <div style="flex:1;min-width:140px">${UI.field('Sampai Tanggal', `<input type="date" class="clay-input" id="rp-sampai" value="${state.sampai}">`)}</div>
          <div style="flex:1;min-width:190px">${UI.field('Model Raport', `<select class="clay-select" id="rp-model">${UI.optionsFromList(RAPORT_MODEL_OPTIONS, 'v', 'l', state.model)}</select>`)}</div>
          ${(!isWali && !opt.isUstadzScope) ? `<div style="flex:1;min-width:150px">${UI.field('Ustadz Pengampu', `<select class="clay-select" id="rp-ust"><option value="">Semua Ustadz</option>${UI.optionsFromList(ustadzOpts, 'id', 'nama', state.ustadzId)}</select>`)}</div>` : ''}
          ${!isWali ? `<div style="flex:1;min-width:150px">${UI.field('Halaqah', `<select class="clay-select" id="rp-hal"><option value="">${opt.isUstadzScope ? 'Semua Halaqah Saya' : 'Semua Halaqah'}</option>${UI.optionsFromList(visibleHalaqahOpts(), 'id', 'nama', state.halaqahId)}</select>`)}</div>` : ''}
        </div>
        ${!isWali ? `<div class="row center" style="justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:8px">
          <div style="flex:1;min-width:220px"><input class="clay-input" id="rp-cari" type="search" placeholder="Cari nama atau NIS santri..." autocomplete="off"></div>
          <div class="row center" style="gap:10px;flex-wrap:wrap">
            ${isAdmin ? `<label class="row center" style="gap:6px;cursor:pointer;font-size:13px;user-select:none">
              <input type="checkbox" id="rp-sertakan-kehadiran" ${state.includeAttendance ? 'checked' : ''}>
              <span>Sertakan Kehadiran</span>
            </label>` : ''}
            <button class="clay-btn secondary" type="button" id="rp-download-zip">⬇ Unduh JPG (ZIP)</button>
            <button class="clay-btn primary" type="button" id="rp-print-all">Cetak / PDF Semua</button>
          </div>
        </div>` : ''}
      </div>
      <div id="rp-body"></div>`;

    const taEl = container.querySelector('#rp-ta');
    const semEl = container.querySelector('#rp-sem');
    const dariEl = container.querySelector('#rp-dari');
    const sampaiEl = container.querySelector('#rp-sampai');
    const modelEl = container.querySelector('#rp-model');
    const ustEl = container.querySelector('#rp-ust');
    const halEl = container.querySelector('#rp-hal');
    const cariEl = container.querySelector('#rp-cari');
    const attEl = container.querySelector('#rp-sertakan-kehadiran');
    const bodyEl = container.querySelector('#rp-body');
    const printAllBtn = container.querySelector('#rp-print-all');
    const zipAllBtn = container.querySelector('#rp-download-zip');

    function filteredSantri() {
      const term = state.cari.trim().toLowerCase();
      const ustHalaqahs = state.ustadzId ? halaqahForUstadz(state.ustadzId) : null;
      const targetH = state.halaqahId ? Store.findHalaqahById(state.halaqahId) : null;
      return allSantri
        .filter(s => !ustHalaqahs || ustHalaqahs.some(h => Store.santriHasHalaqah(s, h)))
        .filter(s => !targetH || Store.santriHasHalaqah(s, targetH))
        .filter(s => !term || s.nama.toLowerCase().includes(term) || String(s.nis || '').includes(term))
        .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
    }

    function openEditModal(info) {
      const s = info.s;
      const cur = info.saved;
      const sikapOpts = ['Sangat Baik', 'Baik', 'Cukup', 'Perlu Bimbingan'];
      const kajianEditorHtml = (Store.hasFeature('talim') && info.kajianItems.length) ? `
        <div style="border-top:1px solid var(--border);margin:12px 0;padding-top:10px">
          <div style="font-weight:700;font-size:13px;margin-bottom:8px">Nilai &amp; Capaian Kajian Per Mapel</div>
          ${info.kajianItems.map((k, idx) => `
            <div class="clay-card pad-sm" style="background:var(--bg);margin-bottom:8px">
              <div style="font-weight:600;font-size:13px;margin-bottom:6px">${UI.esc(k.mapel)}${k.kitab ? ` <span class="muted">(${UI.esc(k.kitab)})</span>` : ''}</div>
              <div class="row" style="gap:8px;align-items:flex-end;flex-wrap:wrap">
                <div style="flex:3;min-width:180px">
                  <label class="field-label" style="font-size:11.5px">Bab / Materi Dicapai</label>
                  <input class="clay-input" data-kajian-capaian="${idx}" value="${UI.esc(k.capaian)}" placeholder="Contoh: Bab 1 s.d. Bab 6">
                </div>
                <div style="flex:3;min-width:180px">
                  <label class="field-label" style="font-size:11.5px">Bab / Materi (Arab — Opsional)</label>
                  <input class="clay-input" dir="rtl" data-kajian-capaian-arab="${idx}" value="${UI.esc(k.capaianArab || '')}" placeholder="الموضوع بالعربية (اختياري)">
                </div>
                <div style="flex:1;min-width:90px">
                  <label class="field-label" style="font-size:11.5px">Nilai (0–100)</label>
                  <input class="clay-input" type="number" min="0" max="100" data-kajian-nilai="${idx}" value="${k.nilai || ''}" placeholder="85">
                </div>
              </div>
            </div>`).join('')}
        </div>` : '';
      let _rpTtdUstadz = UI.safeUrl((cur && cur.ttdUstadz) || '') || '';
      const mEdit = UI.openModal({
        title: `Input Catatan & Nilai Raport — ${s.nama}`,
        sub: `${state.tahunAjaran} · Semester ${state.semester}`,
        bodyHTML: `
          ${UI.field('Akhlaq & Kedisiplinan', `<select class="clay-select" id="rp-f-sikap">${UI.optionsFromList(sikapOpts.map(v => ({ v, l: v })), 'v', 'l', cur ? cur.sikap : 'Baik')}</select>`)}
          ${kajianEditorHtml}
          <div class="row">
            <div style="flex:1;min-width:220px">${UI.field('Catatan Ustadz / Pembimbing', `<textarea class="clay-textarea" id="rp-f-cat" rows="4" placeholder="Contoh: Hafalan lancar, pertahankan murojaah rutin di rumah.">${UI.esc(cur ? cur.catatan : info.catatan)}</textarea>`)}</div>
            <div style="flex:1;min-width:220px">${UI.field('Catatan Ustadz (Arab — Opsional)', `<textarea class="clay-textarea" id="rp-f-cat-arab" dir="rtl" rows="4" placeholder="ملاحظات المشرف باللغة العربية (اختياري)">${UI.esc(cur ? (cur.catatanArab || '') : '')}</textarea>`)}</div>
          </div>
          <div class="row">
            <div style="flex:1;min-width:220px">${UI.field('Rekomendasi / Keterangan', `<input class="clay-input" id="rp-f-rek" value="${UI.esc(cur ? cur.rekomendasi : '')}" placeholder="Contoh: Lanjutkan ke juz berikutnya">`)}</div>
            <div style="flex:1;min-width:220px">${UI.field('Rekomendasi (Arab — Opsional)', `<input class="clay-input" id="rp-f-rek-arab" dir="rtl" value="${UI.esc(cur ? (cur.rekomendasiArab || '') : '')}" placeholder="التوصيات باللغة العربية (اختياري)">`)}</div>
          </div>
          <div style="margin-top:8px">
            <label class="field-label">TTD Ustadz Pembimbing (opsional, menimpa TTD bawaan)</label>
            <div class="row center" style="gap:8px;flex-wrap:wrap">
              <div id="rp-f-ttd-prev" style="width:130px;height:52px;border:1px dashed var(--border);border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden">
                ${(_rpTtdUstadz || info.ustadzTtd) ? `<img src="${UI.esc(_rpTtdUstadz || info.ustadzTtd)}" style="max-width:95%;max-height:48px;object-fit:contain">` : '<span class="muted" style="font-size:11px">Belum ada TTD</span>'}
              </div>
              <label class="clay-btn sm ghost" style="cursor:pointer">Upload TTD
                <input type="file" id="rp-f-ttd-up" accept="image/*" style="display:none">
              </label>
              <button class="clay-btn sm ghost" type="button" id="rp-f-ttd-del" style="color:#dc2626">Reset / Hapus</button>
            </div>
          </div>`,
        actions: [
          { label: 'Batal', role: 'cancel', onClick: (m, c) => c() },
          { label: 'Simpan Raport', role: 'primary', cls: 'primary', onClick: async (m, c) => {
            const storeDb = Store.get();
            if (!Array.isArray(storeDb.raport)) storeDb.raport = [];
            const session = Store.getSession();
            const existing = Store.raportFor(s.id, state.tahunAjaran, state.semester);
            const nilaiKajian = Object.assign({}, (existing && existing.nilaiKajian) || {});
            info.kajianItems.forEach((k, idx) => {
              const capInp = m.querySelector(`[data-kajian-capaian="${idx}"]`);
              const capArInp = m.querySelector(`[data-kajian-capaian-arab="${idx}"]`);
              const valInp = m.querySelector(`[data-kajian-nilai="${idx}"]`);
              if (!capInp && !valInp) return;
              const rawVal = valInp ? valInp.value.trim() : '';
              const numVal = rawVal === '' ? 0 : Math.max(0, Math.min(100, Math.round(Number(rawVal) || 0)));
              const capTxt = capInp ? capInp.value.trim() : k.capaian;
              const capArTxt = capArInp ? capArInp.value.trim() : (k.capaianArab || '');
              nilaiKajian[k.key] = {
                mapel: k.mapel,
                kitab: k.kitab || '',
                capaian: capTxt || k.defaultCapaian,
                capaianArab: capArTxt,
                nilai: numVal > 0 ? numVal : null
              };
            });
            const payload = {
              santriId: s.id,
              ustadzId: (session && session.refId) || (existing && existing.ustadzId) || '',
              tahunAjaran: state.tahunAjaran,
              semester: state.semester,
              sikap: m.querySelector('#rp-f-sikap').value,
              catatan: m.querySelector('#rp-f-cat').value.trim(),
              catatanArab: (m.querySelector('#rp-f-cat-arab')?.value || '').trim(),
              rekomendasi: m.querySelector('#rp-f-rek').value.trim(),
              rekomendasiArab: (m.querySelector('#rp-f-rek-arab')?.value || '').trim(),
              nilaiKajian,
              ttdUstadz: _rpTtdUstadz,
              _created: Date.now()
            };
            if (existing) Object.assign(existing, payload);
            else storeDb.raport.push(Object.assign({ id: Store.uid('rp') }, payload));
            if (await Store.save()) {
              Store.log(`Simpan catatan raport ${s.nama} (${state.tahunAjaran} ${state.semester})`);
              UI.toast('Catatan raport tersimpan ✓', 'success');
              c();
              paint();
            }
          } }
        ]
      });
      const prevEl = mEdit.modal.querySelector('#rp-f-ttd-prev');
      mEdit.modal.querySelector('#rp-f-ttd-up').onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          _rpTtdUstadz = await UI.readImageDataUrl(file, 420, 180);
          prevEl.innerHTML = `<img src="${UI.esc(_rpTtdUstadz)}" style="max-width:95%;max-height:48px;object-fit:contain">`;
        } catch (err) { UI.toast(err.message, 'error'); }
      };
      mEdit.modal.querySelector('#rp-f-ttd-del').onclick = () => {
        _rpTtdUstadz = '';
        prevEl.innerHTML = '<span class="muted" style="font-size:11px">Belum ada TTD</span>';
      };
    }

    function buildRaportWaText(info) {
      const d = buildRaportModelData(info, state);
      const s = info.s;
      if (d.model === 'model3') {
        const lines = [
          `*${d.titleAr}*`,
          `*${d.instName}*`,
          `العام الدراسي: ${d.metaPairs[0].rVal} (${d.metaPairs[1].rVal})`,
          `فترة التقييم: ${d.metaPairs[2].rVal}`,
          '',
          `الاسم: *${d.metaPairs[0].lVal}* (${s.nis ? toArabicDigits(s.nis) : '-'})`,
          `المرحلة والفصل: ${d.metaPairs[2].lVal}`,
          `الحلقة / البرنامج: ${d.metaPairs[3].lVal}`,
          `المشرف: ${d.metaPairs[3].rVal}`,
          '',
          `*أولًا: نتائج التعلم وحفظ القرآن الكريم*`
        ];
        d.progRows.forEach(r => {
          const valStr = r.nilai ? toArabicDigits(r.nilai) : '-';
          const subStr = r.arSub ? ` (${r.arSub})` : '';
          lines.push(`• ${r.arName}: ${r.arCap}${subStr} | الدرجة: ${valStr} (${r.pred})`);
        });
        lines.push(`*المعدل العام للفترة: ${d.avgScoreStr} (${d.avgPred})*`);
        if (d.attRows.length) {
          lines.push('', `*ثانيًا: خلاصة الحضور والغياب*`);
          d.attRows.forEach(ar => {
            lines.push(`• ${ar.arName}: الحضور ${toArabicDigits(ar.att.Hadir)}، الاستئذان ${toArabicDigits(ar.att.Izin)}، المرض ${toArabicDigits(ar.att.Sakit)}، الغياب ${toArabicDigits(ar.att.Alfa)} (*${toArabicDigits(ar.att.persen + '%')}*)`);
          });
        }
        lines.push('', `*الأخلاق والانضباط:* ${d.closingRows[0].val}`);
        if (d.closingRows[1].val && d.closingRows[1].val !== '-') lines.push(`*ملاحظات المشرف:* ${d.closingRows[1].val}`);
        if (d.closingRows[2].val && d.closingRows[2].val !== '-') lines.push(`*التوصيات:* ${d.closingRows[2].val}`);
        lines.push('', `جزاكم الله خيرًا.`);
        return lines.join('\n');
      }

      if (d.model === 'model2') {
        const biVal = (idV, arV, sep = ' / ') => (arV && arV !== idV) ? `${idV}${sep}${arV}` : idV;
        const lines = [
          `*${d.titleId}*`,
          `*${d.titleAr}*`,
          `*${biVal(d.instName, d.instNameAr)}*`,
          `Tahun Ajaran / العام الدراسي: ${biVal(d.metaPairs[0].rValId, d.metaPairs[0].rValAr)} (${biVal(d.metaPairs[1].rValId, d.metaPairs[1].rValAr)})`,
          `Periode / الفترة: ${biVal(d.metaPairs[2].rValId, d.metaPairs[2].rValAr)}`,
          '',
          `Nama / الاسم: *${biVal(d.metaPairs[0].lValId, d.metaPairs[0].lValAr)}*`,
          `NIS / JK (رقم القيد / الجنس): ${biVal(d.metaPairs[1].lValId, d.metaPairs[1].lValAr)}`,
          `Kelas / الفصل: ${biVal(d.metaPairs[2].lValId, d.metaPairs[2].lValAr)}`,
          `Halaqah / الحلقة: ${biVal(d.metaPairs[3].lValId, d.metaPairs[3].lValAr)}`,
          `Pembimbing / المشرف: ${biVal(d.metaPairs[3].rValId, d.metaPairs[3].rValAr)}`,
          '',
          `*A. Capaian Pembelajaran & Hafalan (نتائج التعلم والحفظ)*`
        ];
        d.progRows.forEach(r => {
          const capText = (r.arCap && r.arCap !== r.idCap) ? `${r.idCap} / ${r.arCap}` : r.idCap;
          const subText = r.idSub ? ` (${r.idSub})` : '';
          lines.push(`• ${r.idName} (${r.arName}): ${capText}${subText} | Nilai: ${r.nilai || '-'} (${r.pred})`);
        });
        lines.push(`*Rata-rata Nilai Akhir / المعدل العام: ${d.avgScoreStr} (${d.avgPred})*`);
        if (d.attRows.length) {
          lines.push('', `*B. Kehadiran (الحضور والغياب)*`);
          d.attRows.forEach(ar => {
            lines.push(`• ${ar.idName} (${ar.arName}): Hadir ${ar.att.Hadir}, Izin ${ar.att.Izin}, Sakit ${ar.att.Sakit}, Alfa ${ar.att.Alfa} (*${ar.att.persen}%*)`);
          });
        }
        lines.push('', `*Akhlaq & Kedisiplinan (الأخلاق والانضباط):* ${biVal(d.closingRows[0].valId, d.closingRows[0].valAr)}`);
        if (d.closingRows[1].valId !== '-' || d.closingRows[1].valAr) lines.push(`*Catatan Ustadz (ملاحظات المشرف):* ${biVal(d.closingRows[1].valId, d.closingRows[1].valAr, '\n')}`);
        if (d.closingRows[2].valId !== '-' || d.closingRows[2].valAr) lines.push(`*Rekomendasi (التوصيات):* ${biVal(d.closingRows[2].valId, d.closingRows[2].valAr)}`);
        lines.push('', `Jazakumullahu khairan / جزاكم الله خيرًا.`);
        return lines.join('\n');
      }

      const lines = [
        `*RAPORT HASIL BELAJAR TAHFIDZ AL-QUR'AN*`,
        `*${d.instName}*`,
        `Tahun Ajaran: ${state.tahunAjaran} (${state.semester})`,
        `Periode: ${UI.fmtDate(state.dari)} s.d. ${UI.fmtDate(state.sampai)}`,
        '',
        `Nama: *${s.nama}* (${s.nis || '-'})`,
        `Kelas: ${Store.educationLabel(s)}`,
        `Halaqah / Program: ${Store.halaqahSummaryForSantri(s) || '-'}`,
        `Pembimbing: ${info.ustadzLabel}`,
        '',
        `*A. Capaian Pembelajaran & Hafalan*`
      ];
      if (Store.hasFeature('tahsin') && (Store.santriHasProgram(s, 'Tahsin') || info.tahsinList.length)) {
        const first = info.tahsinList[0], last = info.tahsinList[info.tahsinList.length - 1];
        const cap = info.tahsinList.length ? `${info.tahsinList.length}x setoran (Hal ${first.halAwal} → ${last.halAkhir})` : 'Belum ada setoran';
        lines.push(`• Tahsin: ${cap} | Nilai: ${info.tahsinAvg || '-'} (${raportPredikat(info.tahsinAvg)})`);
      }
      if (Store.hasFeature('ziyadah') && (Store.santriHasProgram(s, 'Ziyadah') || info.ziyadahList.length)) {
        const first = info.ziyadahList[0], last = info.ziyadahList[info.ziyadahList.length - 1];
        const cap = info.ziyadahList.length ? `${info.ziyadahList.length}x (${formatSetoranLabel(first)} → ${formatSetoranLabel(last)})` : 'Belum ada setoran';
        const kum = info.totalH ? `, Total: ${info.totalH.pages} hlm${info.juzLabel ? ' (' + info.juzLabel + ')' : ''}` : '';
        lines.push(`• Ziyadah: ${cap}${kum} | Nilai: ${info.ziyadahAvg || '-'} (${raportPredikat(info.ziyadahAvg)})`);
      }
      if (Store.hasFeature('mutqin') && (Store.santriHasProgram(s, 'Mutqin') || info.mutqinList.length)) {
        const last = info.mutqinList[info.mutqinList.length - 1];
        const cap = info.mutqinList.length ? `${info.mutqinList.length}x ujian${info.mutqinPages ? ', ' + info.mutqinPages + ' hlm' : ''} (${formatSetoranLabel(last)})` : 'Belum ada ujian';
        lines.push(`• Mutqin: ${cap} | Nilai: ${info.mutqinAvg || '-'} (${raportPredikat(info.mutqinAvg)})`);
      }
      if (Store.hasFeature('murojaah') && info.murojaahStats) {
        const ms = info.murojaahStats;
        const cap = ms.setoran ? `${ms.setoran}x pengulangan (${ms.pages} hlm / ${ms.ayahs} ayat)` : 'Belum ada catatan';
        lines.push(`• Murojaah: ${cap} | Nilai: ${ms.nilaiRata || '-'} (${raportPredikat(ms.nilaiRata || 0)})`);
      }
      if (Store.hasFeature('talim') && info.kajianItems.length) {
        info.kajianItems.forEach(k => {
          const title = /^kajian\b/i.test(k.mapel) ? k.mapel : `Kajian ${k.mapel}`;
          lines.push(`• ${title}${k.kitab ? ' (' + k.kitab + ')' : ''}: ${k.capaian} | Nilai: ${k.nilai || '-'} (${raportPredikat(k.nilai)})`);
        });
      }
      lines.push(`*Rata-rata Nilai Akhir: ${info.avgNilai || '-'} (${info.predikat})*`);

      if (info.kehadiran) {
        lines.push('', `*B. Kehadiran*`);
        lines.push(`• Halaqah: Hadir ${info.kehadiran.Hadir}, Izin ${info.kehadiran.Izin}, Sakit ${info.kehadiran.Sakit}, Alfa ${info.kehadiran.Alfa} (*${info.kehadiran.persen}%*)`);
        if (info.talimAbsen && info.talimAbsen.slot > 0) {
          lines.push(`• Kajian: Hadir ${info.talimAbsen.Hadir}, Izin ${info.talimAbsen.Izin}, Sakit ${info.talimAbsen.Sakit}, Alfa ${info.talimAbsen.Alfa} (*${info.talimAbsen.persen}%*)`);
        }
      }
      lines.push('', `*Akhlaq & Kedisiplinan:* ${info.sikap}`);
      if (info.catatan) lines.push(`*Catatan Ustadz:* ${info.catatan}`);
      if (info.rekomendasi) lines.push(`*Rekomendasi:* ${info.rekomendasi}`);
      lines.push('', `Jazakumullahu khairan.`);
      return lines.join('\n');
    }

    function loadCanvasImage(src) {
      return new Promise(resolve => {
        const clean = UI.safeUrl(src);
        if (!clean) { resolve(null); return; }
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = clean;
      });
    }

    function wrapCanvasLines(ctx, text, maxW) {
      const paragraphs = String(text || '-').split('\n');
      const lines = [];
      paragraphs.forEach(p => {
        const words = p.trim().split(/\s+/).filter(Boolean);
        if (!words.length) { lines.push(''); return; }
        let line = words[0];
        for (let i = 1; i < words.length; i++) {
          const cand = line + ' ' + words[i];
          if (ctx.measureText(cand).width <= maxW) line = cand;
          else { lines.push(line); line = words[i]; }
        }
        lines.push(line);
      });
      return lines.length ? lines : ['-'];
    }

    async function buildRaportCanvas(info) {
      const db = Store.get();
      const cfg = db.settings || {};
      const s = info.s;
      const d = buildRaportModelData(info, state);
      const fontsWait = (d.model !== 'model1' && document.fonts && document.fonts.ready)
        ? Promise.race([document.fonts.ready.catch(() => {}), new Promise(res => setTimeout(res, 1000))])
        : Promise.resolve();
      const [logoImg, ustTtdImg, pimTtdImg, capImg] = await Promise.all([
        loadCanvasImage(cfg.logo),
        loadCanvasImage(info.ustadzTtd),
        loadCanvasImage(info.pimpinanTtd),
        loadCanvasImage(info.capLembaga),
        fontsWait
      ]);
      const W = 1240, pad = 74, innerW = W - pad * 2;
      const tmp = document.createElement('canvas');
      const ctx0 = tmp.getContext('2d');
      const fontSans = 'Arial, sans-serif';
      const fontAr = '"Amiri", "Traditional Arabic", Arial, sans-serif';
      const fileSuffix = raportFileSuffix(d.model);
      const linkName = `Raport_${safeFilename(s.nama)}_${safeFilename(state.semester)}${fileSuffix}.jpg`;

      const drawSignBlock = (ctx, signItems, yStart, colW, isRtl) => {
        signItems.forEach((sc, idx) => {
          const cx = isRtl
            ? (W - pad - colW * idx - colW / 2)
            : (pad + colW * idx + colW / 2);
          ctx.direction = isRtl ? 'rtl' : 'ltr';
          ctx.textAlign = 'center';
          ctx.font = `400 18px ${isRtl ? fontAr : fontSans}`;
          if (sc.top) canvasText(ctx, sc.top, cx, yStart, colW - 16);
          let roleY = yStart + 24;
          if (sc.arTop) {
            ctx.direction = 'rtl';
            ctx.font = `400 16px ${fontAr}`;
            canvasText(ctx, sc.arTop, cx, yStart + 22, colW - 16);
            ctx.direction = 'ltr';
            ctx.font = `400 18px ${fontSans}`;
            roleY = yStart + 44;
          }
          canvasText(ctx, sc.role, cx, roleY, colW - 16);
          let nameYOffset = sc.arTop ? 154 : 132;
          if (sc.arRole) {
            ctx.direction = 'rtl';
            ctx.font = `400 17px ${fontAr}`;
            canvasText(ctx, sc.arRole, cx, roleY + 22, colW - 16);
            ctx.direction = 'ltr';
            nameYOffset = sc.arTop ? 168 : 148;
          }
          const imgCenterY = yStart + nameYOffset - 56;
          if (sc.cap) {
            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.translate(cx + (isRtl ? 46 : -46), imgCenterY);
            ctx.rotate(isRtl ? 0.1 : -0.1);
            const cr = Math.min(120 / Math.max(1, sc.cap.naturalWidth || 120), 100 / Math.max(1, sc.cap.naturalHeight || 100), 1);
            const cw = (sc.cap.naturalWidth || 100) * cr, ch = (sc.cap.naturalHeight || 100) * cr;
            ctx.drawImage(sc.cap, -cw / 2, -ch / 2, cw, ch);
            ctx.restore();
          }
          if (sc.ttd) {
            const tr = Math.min(200 / Math.max(1, sc.ttd.naturalWidth || 200), 76 / Math.max(1, sc.ttd.naturalHeight || 76), 1);
            const tw = (sc.ttd.naturalWidth || 160) * tr, th = (sc.ttd.naturalHeight || 70) * tr;
            ctx.drawImage(sc.ttd, cx - tw / 2, imgCenterY - th / 2, tw, th);
          }
          ctx.direction = isRtl ? 'rtl' : 'ltr';
          ctx.font = `700 18px ${isRtl ? fontAr : fontSans}`;
          const nameLines = wrapCanvasLines(ctx, sc.name, colW - 24);
          nameLines.forEach((ln, li) => {
            const ly = yStart + nameYOffset + li * 22;
            ctx.fillText(ln, cx, ly);
            const lw = Math.min(colW - 24, ctx.measureText(ln).width);
            ctx.beginPath(); ctx.moveTo(cx - lw / 2, ly + 4); ctx.lineTo(cx + lw / 2, ly + 4); ctx.stroke();
          });
          if (sc.arName) {
            ctx.direction = 'rtl';
            ctx.font = `700 17px ${fontAr}`;
            canvasText(ctx, sc.arName, cx, yStart + nameYOffset + nameLines.length * 22 + 2, colW - 24);
            ctx.direction = 'ltr';
          }
        });
        ctx.direction = 'ltr';
        ctx.textAlign = 'left';
      };

      if (d.model === 'model1') {
        const progRows = [];
        if (Store.hasFeature('tahsin') && (Store.santriHasProgram(s, 'Tahsin') || info.tahsinList.length)) {
          const first = info.tahsinList[0], last = info.tahsinList[info.tahsinList.length - 1];
          progRows.push(['Tahsin / Bacaan', info.tahsinList.length ? `${info.tahsinList.length}x setoran · Hal ${first.halAwal} → ${last.halAkhir}` : 'Belum ada setoran pada periode ini', String(info.tahsinAvg || '-'), raportPredikat(info.tahsinAvg)]);
        }
        if (Store.hasFeature('ziyadah') && (Store.santriHasProgram(s, 'Ziyadah') || info.ziyadahList.length)) {
          const first = info.ziyadahList[0], last = info.ziyadahList[info.ziyadahList.length - 1];
          const range = info.ziyadahList.length ? `${info.ziyadahList.length}x setoran (${formatSetoranLabel(first)} → ${formatSetoranLabel(last)})` : 'Belum ada setoran pada periode ini';
          const kum = info.totalH ? `Total: ${info.totalH.pages} hlm${info.juzLabel ? ' (' + info.juzLabel + ')' : ''}` : '';
          progRows.push(['Ziyadah (Tahfidz)', kum ? `${range}\n${kum}` : range, String(info.ziyadahAvg || '-'), raportPredikat(info.ziyadahAvg)]);
        }
        if (Store.hasFeature('mutqin') && (Store.santriHasProgram(s, 'Mutqin') || info.mutqinList.length)) {
          const last = info.mutqinList[info.mutqinList.length - 1];
          const cap = info.mutqinList.length ? `${info.mutqinList.length}x ujian · ${info.mutqinPages ? info.mutqinPages + ' hlm · ' : ''}${formatSetoranLabel(last)}` : 'Belum ada setoran pada periode ini';
          progRows.push(['Program Mutqin', cap, String(info.mutqinAvg || '-'), raportPredikat(info.mutqinAvg)]);
        }
        if (Store.hasFeature('murojaah') && info.murojaahStats) {
          const ms = info.murojaahStats;
          const mAvg = ms.nilaiRata || 0;
          progRows.push(['Murojaah', ms.setoran ? `${ms.setoran}x pengulangan · ${ms.pages} hlm (${ms.ayahs} ayat)` : 'Belum ada catatan murojaah', String(mAvg || '-'), raportPredikat(mAvg)]);
        }
        if (Store.hasFeature('talim')) {
          if (info.kajianItems.length) {
            info.kajianItems.forEach(k => {
              const title = /^kajian\b/i.test(k.mapel) ? k.mapel : `Kajian ${k.mapel}`;
              progRows.push([title, k.kitab ? `${k.capaian}\nKitab: ${k.kitab}` : k.capaian, String(k.nilai || '-'), raportPredikat(k.nilai)]);
            });
          } else {
            progRows.push(['Kajian', 'Belum ada jurnal kajian pada periode ini', '-', '-']);
          }
        }

        ctx0.font = `400 18px ${fontSans}`;
        const metaRowsRaw = d.metaPairs.map(mp => [mp.lId, mp.lVal, mp.rId, mp.rVal]);
        const leftValW = 365, rightValW = innerW - 735;
        const calcMeta = metaRowsRaw.map(mr => {
          const lLines = wrapCanvasLines(ctx0, ': ' + mr[1], leftValW);
          const rLines = wrapCanvasLines(ctx0, ': ' + mr[3], rightValW);
          const rowH = Math.max(lLines.length, rLines.length) * 24 + 6;
          return { lLabel: mr[0], lLines, rLabel: mr[2], rLines, rowH };
        });
        const totalMetaH = calcMeta.reduce((sum, mr) => sum + mr.rowH, 0);

        const capColW = 520;
        const calcProg = progRows.map(r => {
          const pLines = wrapCanvasLines(ctx0, r[0], 220);
          const cLines = wrapCanvasLines(ctx0, r[1], capColW);
          const h = Math.max(44, Math.max(pLines.length, cLines.length) * 24 + 18);
          return { pLines, cLines, n: r[2], pred: r[3], h };
        });
        const catLines = wrapCanvasLines(ctx0, info.catatan || '-', innerW - 265);
        const rekLines = wrapCanvasLines(ctx0, info.rekomendasi || '-', innerW - 265);
        const totalProgH = calcProg.reduce((a, r) => a + r.h, 0);
        const attRowsCount = d.attRows.length;
        const hCatEst = Math.max(46, catLines.length * 24 + 18);
        const hRekEst = Math.max(46, rekLines.length * 24 + 18);
        const colW = innerW / 3;
        const namaPimpinanEst = (cfg.namaPimpinan || '').trim() || '( ________________________ )';
        ctx0.font = `700 18px ${fontSans}`;
        const maxSignNameLines = Math.max(
          wrapCanvasLines(ctx0, s.namaWali || '( .............................. )', colW - 24).length,
          wrapCanvasLines(ctx0, info.ustadzLabel !== '-' ? info.ustadzLabel : '( .............................. )', colW - 24).length,
          wrapCanvasLines(ctx0, namaPimpinanEst, colW - 24).length
        );
        const contentH = 196 + totalMetaH + (totalProgH + 116) + (attRowsCount ? 82 + attRowsCount * 38 : 0) + (84 + hCatEst + hRekEst) + (180 + maxSignNameLines * 22 + 48);
        const H = Math.max(1754, contentH);

        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#000000';
        ctx.strokeStyle = '#000000';

        let y = 64;
        let textX = pad;
        if (logoImg) {
          ctx.drawImage(logoImg, pad, y, 86, 86);
          textX = pad + 106;
        }
        ctx.font = `700 26px ${fontSans}`;
        canvasText(ctx, String(d.instName).toUpperCase(), textX, y + 26, W - pad - textX);
        ctx.font = `400 17px ${fontSans}`;
        canvasText(ctx, d.instAddr, textX, y + 52, W - pad - textX);
        ctx.font = `700 21px ${fontSans}`;
        canvasText(ctx, d.titleId, textX, y + 82, W - pad - textX);
        y += 104;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
        ctx.lineWidth = 1;
        y += 28;

        calcMeta.forEach(mr => {
          ctx.font = `700 18px ${fontSans}`;
          ctx.fillText(mr.lLabel, pad, y);
          ctx.fillText(mr.rLabel, pad + 560, y);
          ctx.font = `400 18px ${fontSans}`;
          mr.lLines.forEach((ln, li) => ctx.fillText(ln, pad + 165, y + li * 24));
          mr.rLines.forEach((ln, li) => ctx.fillText(ln, pad + 725, y + li * 24));
          y += mr.rowH;
        });

        const drawCell = (x, cy, cw, ch, bold = false) => {
          ctx.strokeStyle = '#000000';
          ctx.strokeRect(x, cy, cw, ch);
          ctx.fillStyle = '#000000';
          ctx.font = bold ? `700 18px ${fontSans}` : `400 18px ${fontSans}`;
        };

        y += 18;
        ctx.font = `700 20px ${fontSans}`;
        ctx.fillText('A. Capaian Pembelajaran & Hafalan', pad, y);
        y += 14;
        const wA = [245, 550, 95, innerW - 890];
        drawCell(pad, y, wA[0], 42, true); ctx.fillText('Program / Bidang', pad + 10, y + 27);
        drawCell(pad + wA[0], y, wA[1], 42, true); ctx.fillText('Capaian Periode Ini', pad + wA[0] + 10, y + 27);
        drawCell(pad + wA[0] + wA[1], y, wA[2], 42, true); ctx.textAlign = 'center'; ctx.fillText('Nilai', pad + wA[0] + wA[1] + wA[2] / 2, y + 27); ctx.textAlign = 'left';
        drawCell(pad + wA[0] + wA[1] + wA[2], y, wA[3], 42, true); ctx.textAlign = 'center'; ctx.fillText('Predikat', pad + wA[0] + wA[1] + wA[2] + wA[3] / 2, y + 27); ctx.textAlign = 'left';
        y += 42;

        calcProg.forEach(r => {
          drawCell(pad, y, wA[0], r.h, true);
          r.pLines.forEach((ln, i) => canvasText(ctx, ln, pad + 10, y + 25 + i * 24, wA[0] - 20));
          drawCell(pad + wA[0], y, wA[1], r.h, false);
          r.cLines.forEach((ln, i) => canvasText(ctx, ln, pad + wA[0] + 10, y + 25 + i * 24, wA[1] - 20));
          drawCell(pad + wA[0] + wA[1], y, wA[2], r.h, false);
          ctx.textAlign = 'center'; ctx.fillText(r.n, pad + wA[0] + wA[1] + wA[2] / 2, y + 26);
          drawCell(pad + wA[0] + wA[1] + wA[2], y, wA[3], r.h, false);
          ctx.textAlign = 'center'; canvasText(ctx, r.pred, pad + wA[0] + wA[1] + wA[2] + wA[3] / 2, y + 26, wA[3] - 12);
          ctx.textAlign = 'left';
          y += r.h;
        });
        drawCell(pad, y, wA[0] + wA[1], 42, true); ctx.fillText('Rata-rata Nilai Akhir Periode', pad + 10, y + 27);
        drawCell(pad + wA[0] + wA[1], y, wA[2], 42, true); ctx.textAlign = 'center'; ctx.fillText(d.avgScoreStr, pad + wA[0] + wA[1] + wA[2] / 2, y + 27);
        drawCell(pad + wA[0] + wA[1] + wA[2], y, wA[3], 42, true); canvasText(ctx, d.avgPred, pad + wA[0] + wA[1] + wA[2] + wA[3] / 2, y + 27, wA[3] - 12);
        ctx.textAlign = 'left';
        y += 42;

        if (d.attRows.length) {
          y += 30;
          ctx.font = `700 20px ${fontSans}`;
          ctx.fillText('B. Rekapitulasi Kehadiran', pad, y);
          y += 14;
          const wK = d.hasKajianAtt ? 250 : 0;
          const wCell = (innerW - wK) / 6;
          if (d.hasKajianAtt) { drawCell(pad, y, wK, 38, true); ctx.fillText('Kegiatan', pad + 10, y + 25); }
          ['Hadir', 'Izin', 'Sakit', 'Libur', 'Alfa', 'Persentase'].forEach((hLabel, idx) => {
            const cx = pad + wK + idx * wCell;
            drawCell(cx, y, wCell, 38, true);
            ctx.textAlign = 'center'; ctx.fillText(hLabel, cx + wCell / 2, y + 25); ctx.textAlign = 'left';
          });
          y += 38;
          d.attRows.forEach(ar => {
            if (d.hasKajianAtt) { drawCell(pad, y, wK, 38, true); ctx.fillText(ar.idName, pad + 10, y + 25); }
            [ar.att.Hadir, ar.att.Izin, ar.att.Sakit, ar.att.Libur, ar.att.Alfa, ar.att.persen + '%'].forEach((val, idx) => {
              const cx = pad + wK + idx * wCell;
              drawCell(cx, y, wCell, 38, idx === 5);
              ctx.textAlign = 'center'; ctx.fillText(String(val), cx + wCell / 2, y + 25); ctx.textAlign = 'left';
            });
            y += 38;
          });
        }

        y += 30;
        ctx.font = `700 20px ${fontSans}`;
        ctx.fillText(`${d.attRows.length ? 'C' : 'B'}. Akhlaq, Catatan Pembimbing & Rekomendasi`, pad, y);
        y += 14;
        const wLabel = 245, wVal = innerW - wLabel;
        drawCell(pad, y, wLabel, 40, true); ctx.fillText('Akhlaq & Kedisiplinan', pad + 10, y + 26);
        drawCell(pad + wLabel, y, wVal, 40, false); ctx.fillText(info.sikap || '-', pad + wLabel + 10, y + 26);
        y += 40;
        const hCat = Math.max(46, catLines.length * 24 + 18);
        drawCell(pad, y, wLabel, hCat, true); ctx.fillText('Catatan Ustadz', pad + 10, y + 26);
        drawCell(pad + wLabel, y, wVal, hCat, false);
        catLines.forEach((ln, i) => canvasText(ctx, ln, pad + wLabel + 10, y + 25 + i * 24, wVal - 20));
        y += hCat;
        const hRek = Math.max(46, rekLines.length * 24 + 18);
        drawCell(pad, y, wLabel, hRek, true); ctx.fillText('Rekomendasi', pad + 10, y + 26);
        drawCell(pad + wLabel, y, wVal, hRek, false);
        rekLines.forEach((ln, i) => canvasText(ctx, ln, pad + wLabel + 10, y + 25 + i * 24, wVal - 20));
        y += hRek;

        y += 48;
        drawSignBlock(ctx, d.signs.map((sc, i) => ({
          top: sc.idTop, role: sc.idRole, name: sc.name,
          ttd: i === 1 ? ustTtdImg : (i === 2 ? pimTtdImg : null),
          cap: i === 2 ? capImg : null
        })), y, colW, false);

        return { canvas, linkName };
      }

      if (d.model === 'model2') {
        const wA = [250, 500, 88, innerW - 838];
        ctx0.font = `400 17px ${fontSans}`;
        const leftValW = 355, rightValW = innerW - 745;
        const calcMeta = d.metaPairs.map(mp => {
          ctx0.font = `400 17px ${fontSans}`;
          const lLines = wrapCanvasLines(ctx0, ': ' + mp.lValId, leftValW);
          const rLines = wrapCanvasLines(ctx0, ': ' + mp.rValId, rightValW);
          ctx0.font = `400 16px ${fontAr}`;
          const lArLines = mp.lValAr ? wrapCanvasLines(ctx0, mp.lValAr, leftValW) : [];
          const rArLines = mp.rValAr ? wrapCanvasLines(ctx0, mp.rValAr, rightValW) : [];
          const leftH = lLines.length * 22 + lArLines.length * 21;
          const rightH = rLines.length * 22 + rArLines.length * 21;
          const rowH = Math.max(48, leftH + 12, rightH + 12);
          return { mp, lLines, lArLines, rLines, rArLines, rowH };
        });
        const totalMetaH = calcMeta.reduce((sum, mr) => sum + mr.rowH, 0);

        const calcProg = d.progRows.map(r => {
          ctx0.font = `700 17px ${fontSans}`;
          const pIdLines = wrapCanvasLines(ctx0, r.idName, wA[0] - 20);
          ctx0.font = `400 17px ${fontAr}`;
          const pArLines = wrapCanvasLines(ctx0, r.arName, wA[0] - 20);

          ctx0.font = `400 17px ${fontSans}`;
          const idCapText = r.idSub ? `${r.idCap}\n${r.idSub}` : r.idCap;
          const cIdLines = wrapCanvasLines(ctx0, idCapText, wA[1] - 20);
          const showArCap = r.arCap && r.arCap !== r.idCap;
          const arCapText = showArCap ? (r.arSub ? `${r.arCap}\n${r.arSub}` : r.arCap) : (r.arSub || '');
          ctx0.font = `400 17px ${fontAr}`;
          const cArLines = arCapText ? wrapCanvasLines(ctx0, arCapText, wA[1] - 20) : [];

          ctx0.font = `400 16px ${fontSans}`;
          const predIdLines = wrapCanvasLines(ctx0, r.predId, wA[3] - 14);
          ctx0.font = `400 16px ${fontAr}`;
          const predArLines = r.predAr ? wrapCanvasLines(ctx0, r.predAr, wA[3] - 14) : [];

          const leftH = (pIdLines.length + pArLines.length) * 22 + 20;
          const midH = (cIdLines.length + cArLines.length) * 22 + 22;
          const rightH = (predIdLines.length + predArLines.length) * 22 + 20;
          const h = Math.max(58, leftH, midH, rightH);
          return { r, pIdLines, pArLines, cIdLines, cArLines, predIdLines, predArLines, h };
        });
        ctx0.font = `700 16px ${fontSans}`;
        const avgPredIdLines = wrapCanvasLines(ctx0, d.avgPredId, wA[3] - 14);
        ctx0.font = `400 16px ${fontAr}`;
        const avgPredArLines = d.avgPredAr ? wrapCanvasLines(ctx0, d.avgPredAr, wA[3] - 14) : [];
        const hAvg = Math.max(56, (avgPredIdLines.length + avgPredArLines.length) * 22 + 18);

        const wLabel = 265, wVal = innerW - wLabel;
        const calcClosing = d.closingRows.map(cr => {
          ctx0.font = `400 17px ${fontSans}`;
          const valIdLines = wrapCanvasLines(ctx0, cr.valId, wVal - 22);
          ctx0.font = `400 17px ${fontAr}`;
          const valArLines = cr.valAr ? wrapCanvasLines(ctx0, cr.valAr, wVal - 22) : [];
          const h = Math.max(56, (valIdLines.length + valArLines.length) * 24 + 20);
          return { cr, valIdLines, valArLines, h };
        });

        const totalProgH = calcProg.reduce((a, r) => a + r.h, 0) + hAvg;
        const attRowsCount = d.attRows.length;
        const totalClosingH = calcClosing.reduce((a, r) => a + r.h, 0);
        const colW = innerW / 3;
        const namaPimpinanEst = (cfg.namaPimpinan || '').trim() || '( ________________________ )';
        ctx0.font = `700 18px ${fontSans}`;
        const maxSignNameLines = Math.max(
          wrapCanvasLines(ctx0, s.namaWali || '( .............................. )', colW - 24).length,
          wrapCanvasLines(ctx0, info.ustadzLabel !== '-' ? info.ustadzLabel : '( .............................. )', colW - 24).length,
          wrapCanvasLines(ctx0, namaPimpinanEst, colW - 24).length
        );
        const kopExtraH = (d.instNameAr ? 24 : 0) + (d.instAddrAr ? 20 : 0);
        const contentH = 225 + kopExtraH + totalMetaH + (totalProgH + 106) + (attRowsCount ? 104 + attRowsCount * 60 : 0) + (82 + totalClosingH) + (245 + maxSignNameLines * 22 + 48);
        const H = Math.max(1754, contentH);

        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        ctx.direction = 'ltr';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#000000';
        ctx.strokeStyle = '#000000';

        // Kop (Bilingual)
        let y = 56;
        let textX = pad;
        if (logoImg) {
          ctx.drawImage(logoImg, pad, y + 6, 90, 90);
          textX = pad + 110;
        }
        let ky = y + 24;
        ctx.font = `700 25px ${fontSans}`;
        canvasText(ctx, String(d.instName).toUpperCase(), textX, ky, W - pad - textX);
        ky += 24;
        if (d.instNameAr) {
          ctx.direction = 'rtl'; ctx.textAlign = 'left';
          ctx.font = `700 21px ${fontAr}`;
          canvasText(ctx, d.instNameAr, textX, ky, W - pad - textX);
          ctx.direction = 'ltr';
          ky += 24;
        }
        ctx.font = `400 16px ${fontSans}`;
        canvasText(ctx, d.instAddr, textX, ky, W - pad - textX);
        ky += 22;
        if (d.instAddrAr) {
          ctx.direction = 'rtl'; ctx.textAlign = 'left';
          ctx.font = `400 16px ${fontAr}`;
          canvasText(ctx, d.instAddrAr, textX, ky, W - pad - textX);
          ctx.direction = 'ltr';
          ky += 22;
        }
        ctx.font = `700 20px ${fontSans}`;
        canvasText(ctx, d.titleId, textX, ky + 4, W - pad - textX);
        ky += 30;
        ctx.direction = 'rtl';
        ctx.textAlign = 'left';
        ctx.font = `700 21px ${fontAr}`;
        canvasText(ctx, d.titleAr, textX, ky + 2, W - pad - textX);
        ctx.direction = 'ltr';
        y = Math.max(y + 114, ky + 20);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
        ctx.lineWidth = 1;
        y += 28;

        calcMeta.forEach(mr => {
          ctx.textAlign = 'left';
          ctx.font = `700 17px ${fontSans}`;
          ctx.fillText(mr.mp.lId, pad, y);
          ctx.fillText(mr.mp.rId, pad + 560, y);
          ctx.direction = 'rtl';
          ctx.textAlign = 'left';
          ctx.font = `400 15px ${fontAr}`;
          ctx.fillText(mr.mp.lAr, pad, y + 20);
          ctx.fillText(mr.mp.rAr, pad + 560, y + 20);
          ctx.direction = 'ltr';

          let ly = y;
          ctx.font = `400 17px ${fontSans}`;
          mr.lLines.forEach(ln => { canvasText(ctx, ln, pad + 175, ly, leftValW); ly += 22; });
          if (mr.lArLines.length) {
            ctx.direction = 'rtl'; ctx.textAlign = 'left';
            ctx.font = `400 16px ${fontAr}`;
            mr.lArLines.forEach(ln => { canvasText(ctx, ln, pad + 175, ly, leftValW); ly += 21; });
            ctx.direction = 'ltr';
          }

          let ry = y;
          ctx.font = `400 17px ${fontSans}`;
          mr.rLines.forEach(ln => { canvasText(ctx, ln, pad + 735, ry, rightValW); ry += 22; });
          if (mr.rArLines.length) {
            ctx.direction = 'rtl'; ctx.textAlign = 'left';
            ctx.font = `400 16px ${fontAr}`;
            mr.rArLines.forEach(ln => { canvasText(ctx, ln, pad + 735, ry, rightValW); ry += 21; });
            ctx.direction = 'ltr';
          }
          y += mr.rowH;
        });

        const drawCell = (x, cy, cw, ch) => {
          ctx.strokeStyle = '#000000';
          ctx.strokeRect(x, cy, cw, ch);
          ctx.fillStyle = '#000000';
        };

        // Section A
        y += 18;
        ctx.font = `700 19px ${fontSans}`;
        ctx.fillText('A. Capaian Pembelajaran & Hafalan', pad, y);
        ctx.direction = 'rtl';
        ctx.textAlign = 'right';
        ctx.font = `700 19px ${fontAr}`;
        ctx.fillText('نتائج التعلم والحفظ', W - pad, y);
        ctx.direction = 'ltr';
        ctx.textAlign = 'left';
        y += 14;

        const hHeadA = 56;
        const headsA = [
          { x: pad, w: wA[0], id: 'Program / Bidang', ar: 'البرنامج / المادة', center: false },
          { x: pad + wA[0], w: wA[1], id: 'Capaian Periode Ini', ar: 'الإنجاز خلال الفترة', center: false },
          { x: pad + wA[0] + wA[1], w: wA[2], id: 'Nilai', ar: 'الدرجة', center: true },
          { x: pad + wA[0] + wA[1] + wA[2], w: wA[3], id: 'Predikat', ar: 'التقدير', center: true }
        ];
        headsA.forEach(hd => {
          drawCell(hd.x, y, hd.w, hHeadA);
          ctx.font = `700 17px ${fontSans}`;
          if (hd.center) {
            ctx.textAlign = 'center';
            ctx.fillText(hd.id, hd.x + hd.w / 2, y + 23);
            ctx.direction = 'rtl';
            ctx.font = `700 17px ${fontAr}`;
            ctx.fillText(hd.ar, hd.x + hd.w / 2, y + 46);
            ctx.direction = 'ltr';
            ctx.textAlign = 'left';
          } else {
            ctx.fillText(hd.id, hd.x + 10, y + 23);
            ctx.direction = 'rtl';
            ctx.font = `700 17px ${fontAr}`;
            ctx.fillText(hd.ar, hd.x + 10, y + 46);
            ctx.direction = 'ltr';
          }
        });
        y += hHeadA;

        calcProg.forEach(item => {
          drawCell(pad, y, wA[0], item.h);
          let py = y + 23;
          ctx.font = `700 17px ${fontSans}`;
          item.pIdLines.forEach(ln => { canvasText(ctx, ln, pad + 10, py, wA[0] - 20); py += 22; });
          ctx.direction = 'rtl'; ctx.textAlign = 'left';
          ctx.font = `400 17px ${fontAr}`;
          item.pArLines.forEach(ln => { canvasText(ctx, ln, pad + 10, py, wA[0] - 20); py += 22; });
          ctx.direction = 'ltr';

          drawCell(pad + wA[0], y, wA[1], item.h);
          let cy = y + 23;
          ctx.font = `400 17px ${fontSans}`;
          item.cIdLines.forEach(ln => { canvasText(ctx, ln, pad + wA[0] + 10, cy, wA[1] - 20); cy += 22; });
          if (item.cArLines.length) {
            ctx.direction = 'rtl'; ctx.textAlign = 'left';
            ctx.font = `400 17px ${fontAr}`;
            item.cArLines.forEach(ln => { canvasText(ctx, ln, pad + wA[0] + 10, cy, wA[1] - 20); cy += 22; });
            ctx.direction = 'ltr';
          }

          drawCell(pad + wA[0] + wA[1], y, wA[2], item.h);
          ctx.textAlign = 'center';
          ctx.font = `400 18px ${fontSans}`;
          ctx.fillText(String(item.r.nilai || '-'), pad + wA[0] + wA[1] + wA[2] / 2, y + 26);
          if (item.r.nilaiAr) {
            ctx.direction = 'rtl';
            ctx.font = `400 17px ${fontAr}`;
            ctx.fillText(item.r.nilaiAr, pad + wA[0] + wA[1] + wA[2] / 2, y + 48);
            ctx.direction = 'ltr';
          }

          drawCell(pad + wA[0] + wA[1] + wA[2], y, wA[3], item.h);
          let pry = y + 24;
          ctx.font = `400 16px ${fontSans}`;
          item.predIdLines.forEach(ln => { canvasText(ctx, ln, pad + wA[0] + wA[1] + wA[2] + wA[3] / 2, pry, wA[3] - 12); pry += 22; });
          if (item.predArLines.length) {
            ctx.direction = 'rtl';
            ctx.font = `400 16px ${fontAr}`;
            item.predArLines.forEach(ln => { canvasText(ctx, ln, pad + wA[0] + wA[1] + wA[2] + wA[3] / 2, pry, wA[3] - 12); pry += 22; });
            ctx.direction = 'ltr';
          }
          ctx.textAlign = 'left';
          y += item.h;
        });

        drawCell(pad, y, wA[0] + wA[1], hAvg);
        ctx.font = `700 17px ${fontSans}`;
        ctx.fillText('Rata-rata Nilai Akhir Periode', pad + 10, y + 24);
        ctx.direction = 'rtl'; ctx.textAlign = 'left';
        ctx.font = `700 17px ${fontAr}`;
        ctx.fillText('المعدل العام للفترة', pad + 10, y + 46);
        ctx.direction = 'ltr';

        drawCell(pad + wA[0] + wA[1], y, wA[2], hAvg);
        ctx.textAlign = 'center';
        ctx.font = `700 18px ${fontSans}`;
        ctx.fillText(d.avgScoreStr, pad + wA[0] + wA[1] + wA[2] / 2, y + 25);
        if (d.avgScoreAr) {
          ctx.direction = 'rtl';
          ctx.font = `700 17px ${fontAr}`;
          ctx.fillText(d.avgScoreAr, pad + wA[0] + wA[1] + wA[2] / 2, y + 47);
          ctx.direction = 'ltr';
        }

        drawCell(pad + wA[0] + wA[1] + wA[2], y, wA[3], hAvg);
        let apy = y + 24;
        ctx.font = `700 16px ${fontSans}`;
        avgPredIdLines.forEach(ln => { canvasText(ctx, ln, pad + wA[0] + wA[1] + wA[2] + wA[3] / 2, apy, wA[3] - 12); apy += 22; });
        if (avgPredArLines.length) {
          ctx.direction = 'rtl';
          ctx.font = `700 16px ${fontAr}`;
          avgPredArLines.forEach(ln => { canvasText(ctx, ln, pad + wA[0] + wA[1] + wA[2] + wA[3] / 2, apy, wA[3] - 12); apy += 22; });
          ctx.direction = 'ltr';
        }
        ctx.textAlign = 'left';
        y += hAvg;

        // Section B
        if (d.attRows.length) {
          y += 28;
          ctx.font = `700 19px ${fontSans}`;
          ctx.fillText('B. Rekapitulasi Kehadiran', pad, y);
          ctx.direction = 'rtl';
          ctx.textAlign = 'right';
          ctx.font = `700 19px ${fontAr}`;
          ctx.fillText('خلاصة الحضور والغياب', W - pad, y);
          ctx.direction = 'ltr';
          ctx.textAlign = 'left';
          y += 14;

          const wK = d.hasKajianAtt ? 250 : 0;
          const wCell = (innerW - wK) / 6;
          if (d.hasKajianAtt) {
            drawCell(pad, y, wK, 54);
            ctx.font = `700 16px ${fontSans}`; ctx.fillText('Kegiatan', pad + 10, y + 22);
            ctx.direction = 'rtl'; ctx.textAlign = 'left'; ctx.font = `700 16px ${fontAr}`; ctx.fillText('النشاط', pad + 10, y + 44); ctx.direction = 'ltr';
          }
          [
            ['Hadir', 'الحضور'], ['Izin', 'الاستئذان'], ['Sakit', 'المرض'],
            ['Libur', 'العطلة'], ['Alfa', 'الغياب'], ['Persentase', 'النسبة']
          ].forEach((pair, idx) => {
            const cx = pad + wK + idx * wCell;
            drawCell(cx, y, wCell, 54);
            ctx.textAlign = 'center';
            ctx.font = `700 16px ${fontSans}`; ctx.fillText(pair[0], cx + wCell / 2, y + 22);
            ctx.direction = 'rtl'; ctx.font = `700 16px ${fontAr}`; ctx.fillText(pair[1], cx + wCell / 2, y + 44); ctx.direction = 'ltr';
            ctx.textAlign = 'left';
          });
          y += 54;

          d.attRows.forEach(ar => {
            const rowH = 54;
            if (d.hasKajianAtt) {
              drawCell(pad, y, wK, rowH);
              ctx.font = `700 16px ${fontSans}`; ctx.fillText(ar.idName, pad + 10, y + 22);
              ctx.direction = 'rtl'; ctx.textAlign = 'left'; ctx.font = `400 16px ${fontAr}`; ctx.fillText(ar.arName, pad + 10, y + 44); ctx.direction = 'ltr';
            }
            [ar.att.Hadir, ar.att.Izin, ar.att.Sakit, ar.att.Libur, ar.att.Alfa, ar.att.persen + '%'].forEach((val, idx) => {
              const cx = pad + wK + idx * wCell;
              drawCell(cx, y, wCell, rowH);
              ctx.textAlign = 'center';
              ctx.font = idx === 5 ? `700 17px ${fontSans}` : `400 17px ${fontSans}`;
              ctx.fillText(String(val), cx + wCell / 2, y + 23);
              ctx.direction = 'rtl';
              ctx.font = `400 16px ${fontAr}`;
              ctx.fillText(toArabicDigits(val), cx + wCell / 2, y + 45);
              ctx.direction = 'ltr';
              ctx.textAlign = 'left';
            });
            y += rowH;
          });
        }

        // Section C
        y += 28;
        ctx.font = `700 19px ${fontSans}`;
        ctx.fillText(`${d.attRows.length ? 'C' : 'B'}. Akhlaq, Catatan Pembimbing & Rekomendasi`, pad, y);
        ctx.direction = 'rtl';
        ctx.textAlign = 'right';
        ctx.font = `700 19px ${fontAr}`;
        ctx.fillText('السلوك وملاحظات المشرف والتوصيات', W - pad, y);
        ctx.direction = 'ltr';
        ctx.textAlign = 'left';
        y += 14;

        calcClosing.forEach(item => {
          drawCell(pad, y, wLabel, item.h);
          ctx.font = `700 17px ${fontSans}`; ctx.fillText(item.cr.idLabel, pad + 10, y + 24);
          ctx.direction = 'rtl'; ctx.textAlign = 'left'; ctx.font = `400 17px ${fontAr}`; ctx.fillText(item.cr.arLabel, pad + 10, y + 46); ctx.direction = 'ltr';
          drawCell(pad + wLabel, y, wVal, item.h);
          let vy = y + 25;
          ctx.font = `400 17px ${fontSans}`;
          item.valIdLines.forEach(ln => { canvasText(ctx, ln, pad + wLabel + 10, vy, wVal - 20); vy += 23; });
          if (item.valArLines.length) {
            ctx.direction = 'rtl'; ctx.textAlign = 'left';
            ctx.font = `400 17px ${fontAr}`;
            item.valArLines.forEach(ln => { canvasText(ctx, ln, pad + wLabel + 10, vy, wVal - 20); vy += 23; });
            ctx.direction = 'ltr';
          }
          y += item.h;
        });

        y += 44;
        drawSignBlock(ctx, d.signs.map((sc, i) => ({
          top: sc.idTop, arTop: sc.arTop, role: sc.idRole, arRole: sc.arRole, name: sc.name, arName: sc.nameAr,
          ttd: i === 1 ? ustTtdImg : (i === 2 ? pimTtdImg : null),
          cap: i === 2 ? capImg : null
        })), y, colW, false);

        return { canvas, linkName };
      }

      // Model 3 — Full Bahasa Arab (RTL)
      const wA = [245, 550, 95, innerW - 890];
      ctx0.font = `400 19px ${fontAr}`;
      const leftValW = 365, rightValW = innerW - 735;
      const calcMeta = d.metaPairs.map(mp => {
        const lLines = wrapCanvasLines(ctx0, ': ' + mp.lVal, leftValW);
        const rLines = wrapCanvasLines(ctx0, ': ' + mp.rVal, rightValW);
        const rowH = Math.max(lLines.length, rLines.length) * 26 + 8;
        return { mp, lLines, rLines, rowH };
      });
      const totalMetaH = calcMeta.reduce((sum, mr) => sum + mr.rowH, 0);

      const calcProg = d.progRows.map(r => {
        const pLines = wrapCanvasLines(ctx0, r.arName, wA[0] - 24);
        const capStr = r.arSub ? `${r.arCap}\n${r.arSub}` : r.arCap;
        const cLines = wrapCanvasLines(ctx0, capStr, wA[1] - 24);
        const h = Math.max(48, Math.max(pLines.length, cLines.length) * 26 + 20);
        return { r, pLines, cLines, h };
      });
      const wLabel = 245, wVal = innerW - wLabel;
      const calcClosing = d.closingRows.map(cr => {
        const valLines = wrapCanvasLines(ctx0, cr.val, wVal - 24);
        const h = Math.max(50, valLines.length * 26 + 20);
        return { cr, valLines, h };
      });
      const totalProgH = calcProg.reduce((a, r) => a + r.h, 0) + 46;
      const attRowsCount = d.attRows.length;
      const totalClosingH = calcClosing.reduce((a, r) => a + r.h, 0);
      const colW = innerW / 3;
      const namaPimpinanEst = (cfg.namaPimpinan || '').trim() || '( ________________________ )';
      ctx0.font = `700 19px ${fontAr}`;
      const maxSignNameLines = Math.max(
        wrapCanvasLines(ctx0, s.namaWali || '( .............................. )', colW - 24).length,
        wrapCanvasLines(ctx0, info.ustadzLabel !== '-' ? info.ustadzLabel : '( .............................. )', colW - 24).length,
        wrapCanvasLines(ctx0, namaPimpinanEst, colW - 24).length
      );
      const contentH = 210 + totalMetaH + (totalProgH + 110) + (attRowsCount ? 86 + attRowsCount * 42 : 0) + (86 + totalClosingH) + (190 + maxSignNameLines * 24 + 48);
      const H = Math.max(1754, contentH);

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#000000';
      ctx.strokeStyle = '#000000';

      // Kop RTL (logo on top-right)
      let y = 64;
      let textRight = W - pad;
      if (logoImg) {
        ctx.drawImage(logoImg, W - pad - 86, y, 86, 86);
        textRight = W - pad - 106;
      }
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.font = `700 27px ${fontAr}`;
      canvasText(ctx, d.instName, textRight, y + 26, textRight - pad);
      ctx.font = `400 18px ${fontAr}`;
      canvasText(ctx, d.instAddr, textRight, y + 54, textRight - pad);
      ctx.font = `700 24px ${fontAr}`;
      canvasText(ctx, d.titleAr, textRight, y + 86, textRight - pad);
      y += 108;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
      ctx.lineWidth = 1;
      y += 30;

      // Meta 2 columns RTL
      calcMeta.forEach(mr => {
        ctx.direction = 'rtl';
        ctx.textAlign = 'right';
        ctx.font = `700 19px ${fontAr}`;
        ctx.fillText(mr.mp.lAr, W - pad, y);
        ctx.fillText(mr.mp.rAr, W - pad - 560, y);
        ctx.font = `400 19px ${fontAr}`;
        mr.lLines.forEach((ln, li) => ctx.fillText(ln, W - pad - 180, y + li * 26));
        mr.rLines.forEach((ln, li) => ctx.fillText(ln, W - pad - 730, y + li * 26));
        y += mr.rowH;
      });

      const drawCellRtl = (x, cy, cw, ch, bold = false) => {
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(x, cy, cw, ch);
        ctx.fillStyle = '#000000';
        ctx.font = bold ? `700 19px ${fontAr}` : `400 19px ${fontAr}`;
      };

      // Section A RTL
      y += 18;
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.font = `700 22px ${fontAr}`;
      ctx.fillText('أولًا: نتائج التعلم وحفظ القرآن الكريم', W - pad, y);
      y += 14;
      const xCol0 = W - pad - wA[0];
      const xCol1 = xCol0 - wA[1];
      const xCol2 = xCol1 - wA[2];
      const xCol3 = pad;
      drawCellRtl(xCol0, y, wA[0], 46, true); ctx.textAlign = 'right'; ctx.fillText('البرنامج / المادة', W - pad - 12, y + 30);
      drawCellRtl(xCol1, y, wA[1], 46, true); ctx.textAlign = 'right'; ctx.fillText('الإنجاز خلال الفترة', xCol0 - 12, y + 30);
      drawCellRtl(xCol2, y, wA[2], 46, true); ctx.textAlign = 'center'; ctx.fillText('الدرجة', xCol2 + wA[2] / 2, y + 30);
      drawCellRtl(xCol3, y, wA[3], 46, true); ctx.textAlign = 'center'; ctx.fillText('التقدير', xCol3 + wA[3] / 2, y + 30);
      y += 46;

      calcProg.forEach(item => {
        drawCellRtl(xCol0, y, wA[0], item.h, true);
        ctx.textAlign = 'right';
        item.pLines.forEach((ln, i) => canvasText(ctx, ln, W - pad - 12, y + 28 + i * 26, wA[0] - 24));
        drawCellRtl(xCol1, y, wA[1], item.h, false);
        ctx.textAlign = 'right';
        item.cLines.forEach((ln, i) => canvasText(ctx, ln, xCol0 - 12, y + 28 + i * 26, wA[1] - 24));
        drawCellRtl(xCol2, y, wA[2], item.h, false);
        ctx.textAlign = 'center';
        ctx.fillText(item.r.nilai ? toArabicDigits(item.r.nilai) : '-', xCol2 + wA[2] / 2, y + 30);
        drawCellRtl(xCol3, y, wA[3], item.h, false);
        ctx.textAlign = 'center';
        canvasText(ctx, item.r.pred, xCol3 + wA[3] / 2, y + 30, wA[3] - 14);
        y += item.h;
      });
      drawCellRtl(xCol1, y, wA[0] + wA[1], 46, true); ctx.textAlign = 'right'; ctx.fillText('المعدل العام للفترة', W - pad - 12, y + 30);
      drawCellRtl(xCol2, y, wA[2], 46, true); ctx.textAlign = 'center'; ctx.fillText(d.avgScoreStr, xCol2 + wA[2] / 2, y + 30);
      drawCellRtl(xCol3, y, wA[3], 46, true); ctx.textAlign = 'center'; canvasText(ctx, d.avgPred, xCol3 + wA[3] / 2, y + 30, wA[3] - 14);
      y += 46;

      // Section B RTL
      if (d.attRows.length) {
        y += 30;
        ctx.textAlign = 'right';
        ctx.font = `700 22px ${fontAr}`;
        ctx.fillText('ثانيًا: خلاصة الحضور والغياب', W - pad, y);
        y += 14;
        const wK = d.hasKajianAtt ? 250 : 0;
        const wCell = (innerW - wK) / 6;
        if (d.hasKajianAtt) {
          drawCellRtl(W - pad - wK, y, wK, 42, true);
          ctx.textAlign = 'right'; ctx.fillText('النشاط', W - pad - 12, y + 28);
        }
        ['الحضور', 'الاستئذان', 'المرض', 'العطلة', 'الغياب', 'النسبة'].forEach((hLabel, idx) => {
          const cx = W - pad - wK - (idx + 1) * wCell;
          drawCellRtl(cx, y, wCell, 42, true);
          ctx.textAlign = 'center'; ctx.fillText(hLabel, cx + wCell / 2, y + 28);
        });
        y += 42;
        d.attRows.forEach(ar => {
          if (d.hasKajianAtt) {
            drawCellRtl(W - pad - wK, y, wK, 42, true);
            ctx.textAlign = 'right'; ctx.fillText(ar.arName, W - pad - 12, y + 28);
          }
          [ar.att.Hadir, ar.att.Izin, ar.att.Sakit, ar.att.Libur, ar.att.Alfa, ar.att.persen + '%'].forEach((val, idx) => {
            const cx = W - pad - wK - (idx + 1) * wCell;
            drawCellRtl(cx, y, wCell, 42, idx === 5);
            ctx.textAlign = 'center'; ctx.fillText(toArabicDigits(val), cx + wCell / 2, y + 28);
          });
          y += 42;
        });
      }

      // Section C RTL
      y += 30;
      ctx.textAlign = 'right';
      ctx.font = `700 22px ${fontAr}`;
      ctx.fillText(`${d.attRows.length ? 'ثالثًا' : 'ثانيًا'}: السلوك وملاحظات المشرف والتوصيات`, W - pad, y);
      y += 14;
      calcClosing.forEach(item => {
        drawCellRtl(W - pad - wLabel, y, wLabel, item.h, true);
        ctx.textAlign = 'right';
        ctx.fillText(item.cr.arLabel, W - pad - 12, y + 30);
        drawCellRtl(pad, y, wVal, item.h, false);
        ctx.textAlign = 'right';
        item.valLines.forEach((ln, i) => canvasText(ctx, ln, W - pad - wLabel - 12, y + 28 + i * 26, wVal - 24));
        y += item.h;
      });

      y += 48;
      drawSignBlock(ctx, d.signs.map((sc, i) => ({
        top: sc.arTop, role: sc.arRole, name: sc.name,
        ttd: i === 1 ? ustTtdImg : (i === 2 ? pimTtdImg : null),
        cap: i === 2 ? capImg : null
      })), y, colW, true);

      return { canvas, linkName };
    }

    async function downloadRaportJpg(info) {
      const { canvas, linkName } = await buildRaportCanvas(info);
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/jpeg', 0.94);
      link.download = linkName;
      link.click();
      UI.toast('Gambar Raport (TTD & Cap) diunduh ✓', 'success');
    }

    function bulkScopeSlug() {
      const targetH = state.halaqahId ? Store.findHalaqahById(state.halaqahId) : null;
      if (targetH) return safeFilename(targetH.nama);
      if (state.ustadzId) {
        const u = Store.findUstadz(state.ustadzId);
        if (u) return safeFilename(u.nama);
      }
      if (opt.isUstadzScope && halaqahOpts.length === 1) return safeFilename(halaqahOpts[0].nama);
      return 'Santri';
    }

    async function downloadRaportZip(infos) {
      if (!infos.length) {
        UI.toast('Tidak ada data raport untuk diunduh', 'error');
        return;
      }
      const origText = zipAllBtn ? zipAllBtn.textContent : '';
      if (zipAllBtn) zipAllBtn.disabled = true;
      if (printAllBtn) printAllBtn.disabled = true;
      try {
        const entries = [];
        const usedNames = new Set();
        const fileSuffix = raportFileSuffix(state.model);
        for (let i = 0; i < infos.length; i++) {
          if (zipAllBtn) zipAllBtn.textContent = `Menyiapkan ${i + 1}/${infos.length}...`;
          const { canvas } = await buildRaportCanvas(infos[i]);
          const jpgBytes = await new Promise(resolve => {
            canvas.toBlob(blob => {
              if (!blob) { resolve(null); return; }
              blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf))).catch(() => resolve(null));
            }, 'image/jpeg', 0.92);
          });
          if (!jpgBytes) continue;
          const prefix = String(i + 1).padStart(2, '0');
          const base = `${prefix}_${safeFilename(infos[i].s.nama)}_${safeFilename(state.semester)}${fileSuffix}`;
          let fileName = `${base}.jpg`;
          let suffix = 2;
          while (usedNames.has(fileName)) fileName = `${base}_${suffix++}.jpg`;
          usedNames.add(fileName);
          entries.push({ name: fileName, data: jpgBytes });
        }
        if (!entries.length) {
          UI.toast('Gagal membuat file ZIP raport', 'error');
          return;
        }
        const zipName = `Raport_${bulkScopeSlug()}_${safeFilename(state.tahunAjaran)}_${safeFilename(state.semester)}${fileSuffix}.zip`;
        const blob = new Blob([xlsxZip(entries)], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = zipName;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        setTimeout(() => { anchor.remove(); URL.revokeObjectURL(url); }, 1000);
        UI.toast(`${entries.length} raport JPG diunduh dalam ZIP ✓`, 'success');
      } finally {
        if (zipAllBtn) { zipAllBtn.disabled = false; zipAllBtn.textContent = origText || '⬇ Unduh JPG (ZIP)'; }
        if (printAllBtn) printAllBtn.disabled = infos.length === 0;
      }
    }

    function openWaRaportModal(info) {
      const initialPhone = Store.waNomorWali(info.s.id) || '';
      const initialMsg = buildRaportWaText(info);
      const canBridge = Store.hasFeature('whatsapp') && Store.waReady();
      const fileSuffix = raportFileSuffix(state.model);
      UI.openModal({
        title: `Kirim Raport ke WhatsApp — ${info.s.nama}`,
        sub: `Wali: ${info.s.namaWali || '-'}`,
        bodyHTML: `
          ${UI.field('Nomor WhatsApp Wali (otomatis diformat 62...)', `<input class="clay-input" id="rp-wa-phone" value="${UI.esc(initialPhone)}" placeholder="Contoh: 081234567890">`)}
          ${UI.field('Isi Pesan Raport (bisa diedit sebelum dikirim)', `<textarea class="clay-textarea" id="rp-wa-msg" rows="11" style="font-size:12.5px;line-height:1.45">${UI.esc(initialMsg)}</textarea>`)}
          <div class="row center" style="gap:8px;flex-wrap:wrap;margin-top:6px">
            <button class="clay-btn sm secondary" type="button" id="rp-wa-dl-jpg">⬇ Unduh Raport JPG (TTD &amp; Cap)</button>
            <button class="clay-btn sm ghost" type="button" id="rp-wa-dl-pdf">Cetak / Simpan PDF (TTD &amp; Cap)</button>
          </div>
          <div class="muted" style="font-size:12px;margin-top:6px">Unduh Raport JPG/PDF bertanda tangan &amp; cap untuk dilampirkan di chat, lalu klik <b>Buka WhatsApp</b>${canBridge ? ' atau <b>Kirim via WA Bridge</b>' : ''}.</div>`,
        actions: [
          { label: 'Tutup', cls: 'ghost', onClick: (m, c) => c() },
          { label: 'Salin Teks', cls: 'ghost', onClick: async (m) => {
            const msg = m.querySelector('#rp-wa-msg').value;
            try { await navigator.clipboard.writeText(msg); UI.toast('Teks raport disalin ✓', 'success'); }
            catch (e) { UI.toast('Gagal menyalin, salin manual dari kotak pesan', 'error'); }
          } },
          ...(canBridge ? [{ label: 'Kirim via WA Bridge', cls: 'secondary', onClick: async (m, c) => {
            const phone = Store.waCleanPhone(m.querySelector('#rp-wa-phone').value);
            const msg = m.querySelector('#rp-wa-msg').value.trim();
            if (!phone) { UI.toast('Nomor WhatsApp wali belum diisi', 'error'); return; }
            if (!msg) { UI.toast('Pesan raport masih kosong', 'error'); return; }
            const ok = await Store.waSend(phone, msg);
            UI.toast(ok ? 'Raport masuk antrian kirim WA Bridge ✓' : 'Gagal mengirim lewat WA Bridge, coba lewat Buka WhatsApp', ok ? 'success' : 'error');
            if (ok) c();
          } }] : []),
          { label: 'Buka WhatsApp', cls: 'primary', onClick: (m) => {
            const phone = Store.waCleanPhone(m.querySelector('#rp-wa-phone').value);
            const msg = m.querySelector('#rp-wa-msg').value.trim();
            if (!phone) { UI.toast('Nomor WhatsApp wali belum diisi', 'error'); return; }
            if (!msg) { UI.toast('Pesan raport masih kosong', 'error'); return; }
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
          } }
        ]
      });
      const waModal = document.querySelector('#modal-root .modal:last-child') || document.getElementById('modal-root');
      const dlJpgBtn = waModal.querySelector('#rp-wa-dl-jpg');
      if (dlJpgBtn) dlJpgBtn.onclick = () => downloadRaportJpg(info);
      const dlPdfBtn = waModal.querySelector('#rp-wa-dl-pdf');
      if (dlPdfBtn) dlPdfBtn.onclick = () => printRaportSheets(buildRaportSheetHtml(info, state), `Raport_${info.s.nama.replace(/\s+/g, '_')}_${state.semester}${fileSuffix}`);
    }

    function openPreviewModal(info) {
      const sheet = buildRaportSheetHtml(info, state);
      const fileSuffix = raportFileSuffix(state.model);
      UI.openModal({
        title: `Pratinjau Raport — ${info.s.nama}`,
        sub: `${state.tahunAjaran} · Semester ${state.semester}`,
        cls: 'modal-lg',
        bodyHTML: `${previewStyle}<div class="rp-preview-card">${sheet}</div>`,
        actions: [
          { label: 'Tutup', cls: 'ghost', onClick: (m, c) => c() },
          { label: 'Unduh JPG', cls: 'ghost', onClick: () => downloadRaportJpg(info) },
          ...(!isWali ? [{ label: 'Kirim WA', cls: 'secondary', onClick: () => openWaRaportModal(info) }] : []),
          { label: 'Cetak / Simpan PDF', cls: 'primary', onClick: () => printRaportSheets(sheet, `Raport_${info.s.nama.replace(/\s+/g, '_')}_${state.semester}${fileSuffix}`) }
        ]
      });
    }

    function updateBulkButtons(count) {
      const isSingleHalaqah = !!(state.halaqahId || (opt.isUstadzScope && halaqahOpts.length === 1));
      const scopeText = isSingleHalaqah ? '1 Halaqah' : (state.ustadzId ? 'Ustadz Ini' : 'Semua');
      if (printAllBtn) {
        printAllBtn.disabled = count === 0;
        printAllBtn.textContent = `Cetak / PDF ${scopeText} (${count})`;
      }
      if (zipAllBtn) {
        zipAllBtn.disabled = count === 0;
        zipAllBtn.textContent = `⬇ Unduh JPG ZIP (${count})`;
      }
    }

    function paint() {
      const list = filteredSantri().map(s => buildRaportInfo(s, state));
      updateBulkButtons(list.length);
      if (isWali) {
        if (!list.length) {
          bodyEl.innerHTML = '<div class="empty">Data santri tidak tersedia.</div>';
          return;
        }
        const info = list[0];
        const sheet = buildRaportSheetHtml(info, state);
        bodyEl.innerHTML = `
          <div class="clay-card rp-preview-card">
            <div class="row center" style="justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap">
              <div class="section-title" style="margin:0">Kartu Raport Santri</div>
              <div class="row" style="gap:8px">
                <button class="clay-btn secondary" type="button" id="rp-wali-jpg">Unduh JPG (TTD &amp; Cap)</button>
                <button class="clay-btn primary" type="button" id="rp-wali-print">Cetak / Unduh PDF</button>
              </div>
            </div>
            ${sheet}
          </div>`;
        bodyEl.querySelector('#rp-wali-jpg').onclick = () => downloadRaportJpg(info);
        bodyEl.querySelector('#rp-wali-print').onclick = () => printRaportSheets(sheet, `Raport_${info.s.nama.replace(/\s+/g, '_')}_${state.semester}${raportFileSuffix(state.model)}`);
        return;
      }

      const rows = list.map((info, idx) => {
        const badges = [];
        if (info.tahsinList.length) badges.push(`<span class="badge blue sm">Tahsin ${info.tahsinList.length}x</span>`);
        if (info.ziyadahList.length || info.totalH) badges.push(`<span class="badge green sm">Hafalan ${info.totalH ? info.totalH.pages + ' hlm' : info.ziyadahList.length + 'x'}</span>`);
        if (info.mutqinList.length) badges.push(`<span class="badge warn sm">Mutqin ${info.mutqinList.length}x</span>`);
        if (info.kehadiran) badges.push(`<span class="badge gray sm">Hadir ${info.kehadiran.persen}%</span>`);
        return `<tr>
          <td class="center">${idx + 1}</td>
          <td><b>${UI.esc(info.s.nama)}</b><div class="muted" style="font-size:11.5px">${UI.esc(info.s.nis || '-')} · ${UI.esc(Store.educationLabel(info.s))}</div></td>
          <td>${UI.esc(Store.halaqahSummaryForSantri(info.s) || '-')}</td>
          <td><div class="row" style="gap:4px;flex-wrap:wrap">${badges.join('') || '<span class="muted">-</span>'}</div></td>
          <td class="center">${info.avgNilai ? `<b>${info.avgNilai}</b><div class="muted" style="font-size:11px">${UI.esc(info.predikat)}</div>` : '-'}</td>
          <td>${info.saved ? `<span class="badge green sm">${UI.esc(info.saved.sikap || 'Terisi')}</span><div class="muted" style="font-size:11px;margin-top:2px">${UI.esc((info.saved.catatan || '').slice(0, 45))}${(info.saved.catatan || '').length > 45 ? '…' : ''}</div>` : '<span class="badge gray sm">Belum diisi</span>'}</td>
          <td>
            <div class="row" style="gap:6px;flex-wrap:wrap">
              ${canEdit ? `<button class="clay-btn sm secondary" type="button" data-rp-edit="${info.s.id}">Input / Edit</button>` : ''}
              <button class="clay-btn sm ghost" type="button" data-rp-wa="${info.s.id}">Kirim WA</button>
              <button class="clay-btn sm primary" type="button" data-rp-view="${info.s.id}">Lihat &amp; Cetak</button>
            </div>
          </td>
        </tr>`;
      }).join('');

      bodyEl.innerHTML = `
        <div class="clay-card">
          <div class="row center" style="justify-content:space-between;margin-bottom:10px">
            <div class="section-title" style="margin:0">Daftar Raport Santri (${UI.esc(state.tahunAjaran)} · ${UI.esc(state.semester)})</div>
            <span class="muted" style="font-size:12.5px">${list.length} santri</span>
          </div>
          <div class="table-wrap"><table class="clay-table table-wide">
            <thead><tr><th class="center">No</th><th>Santri</th><th>Halaqah</th><th>Ringkasan Periode</th><th class="center">Nilai</th><th>Catatan Ustadz</th><th>Aksi</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="7"><div class="empty">Tidak ada santri ditemukan.</div></td></tr>'}</tbody>
          </table></div>
        </div>`;

      bodyEl.querySelectorAll('[data-rp-edit]').forEach(btn => {
        btn.onclick = () => {
          const info = list.find(x => x.s.id === btn.dataset.rpEdit);
          if (info) openEditModal(info);
        };
      });
      bodyEl.querySelectorAll('[data-rp-wa]').forEach(btn => {
        btn.onclick = () => {
          const info = list.find(x => x.s.id === btn.dataset.rpWa);
          if (info) openWaRaportModal(info);
        };
      });
      bodyEl.querySelectorAll('[data-rp-view]').forEach(btn => {
        btn.onclick = () => {
          const info = list.find(x => x.s.id === btn.dataset.rpView);
          if (info) openPreviewModal(info);
        };
      });
    }

    const onSemesterChange = () => {
      state.tahunAjaran = taEl.value;
      state.semester = semEl.value;
      const r = defaultRaportRange(state.tahunAjaran, state.semester);
      state.dari = r.dari; state.sampai = r.sampai;
      dariEl.value = r.dari; sampaiEl.value = r.sampai;
      paint();
    };
    taEl.onchange = onSemesterChange;
    semEl.onchange = onSemesterChange;
    dariEl.onchange = () => { state.dari = dariEl.value; paint(); };
    sampaiEl.onchange = () => { state.sampai = sampaiEl.value; paint(); };
    if (modelEl) modelEl.onchange = () => { state.model = normalizeRaportModel(modelEl.value); paint(); };
    if (ustEl) ustEl.onchange = () => {
      state.ustadzId = ustEl.value;
      const allowedHalaqahs = visibleHalaqahOpts();
      if (state.halaqahId && !allowedHalaqahs.some(h => h.id === state.halaqahId)) state.halaqahId = '';
      if (halEl) {
        halEl.innerHTML = `<option value="">Semua Halaqah</option>${UI.optionsFromList(allowedHalaqahs, 'id', 'nama', state.halaqahId)}`;
      }
      paint();
    };
    if (halEl) halEl.onchange = () => { state.halaqahId = halEl.value; paint(); };
    if (cariEl) bindSearchInput(cariEl, () => { state.cari = cariEl.value; paint(); });
    if (attEl) attEl.onchange = () => {
      const on = !!attEl.checked;
      state.includeAttendance = on;
      const curDb = Store.get();
      if (!curDb.settings || typeof curDb.settings !== 'object') curDb.settings = {};
      curDb.settings.raportSertakanKehadiran = on;
      Store.save();
      paint();
    };
    if (printAllBtn) printAllBtn.onclick = () => {
      const sheets = filteredSantri().map(s => buildRaportSheetHtml(buildRaportInfo(s, state), state)).join('');
      printRaportSheets(sheets, `Raport_${bulkScopeSlug()}_${safeFilename(state.tahunAjaran)}_${safeFilename(state.semester)}${raportFileSuffix(state.model)}`);
    };
    if (zipAllBtn) zipAllBtn.onclick = () => {
      const infos = filteredSantri().map(s => buildRaportInfo(s, state));
      downloadRaportZip(infos);
    };

    paint();
  }

  // Periode rekap setoran: rentang tanggal bebas. Nilai `week` (mingguan lama)
  // masih diterima supaya tautan atau pemanggilan sebelumnya tidak rusak.
  function depositPeriod(filters) {
    const f = filters || {};
    let dari = f.dari || '';
    let sampai = f.sampai || dari;
    if (!dari && f.week) {
      dari = mondayOf(f.week);
      sampai = Store.tambahHari(dari, 6);
    }
    if (!dari) {
      const today = Store.todayStr();
      dari = Store.tambahHari(today, -6);
      sampai = today;
    }
    if (sampai < dari) { const temp = dari; dari = sampai; sampai = temp; }
    // Periode dibatasi supaya tabel tidak melebar tanpa batas.
    const batas = Store.tambahHari(dari, 60);
    if (sampai > batas) sampai = batas;
    return { dari, sampai, days: Store.tanggalRange(dari, sampai) };
  }

  // Periode bebas (bukan lagi Senin-Jumat). Setiap tanggal di rentang menjadi
  // satu kolom, sehingga tabel ikut mengikuti tanggal yang dipilih.
  function depositGroups(filters) {
    const db = Store.get();
    const f = filters || {};
    const period = depositPeriod(f);
    const days = period.days.map(tanggal => {
      const date = new Date(tanggal + 'T12:00:00');
      return { tanggal, label: HARI_SINGKAT[date.getDay()] };
    });
    const setoran = new Map();
    Object.keys(JENIS_SETORAN).forEach(type => {
      (db[type] || []).forEach(record => {
        if (!record.santriId || !record.tanggal) return;
        const key = record.santriId + '|' + record.tanggal;
        const existing = setoran.get(key) || [];
        existing.push({ type, record });
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
      const enabledSet = new Set(Store.enabledPrograms());
      const rows = santri.map(s => {
        const programs = Store.programsForSantriHalaqah(s, h).filter(p => enabledSet.has(p));
        const relevantTypes = jenisSetoranUntukProgram(programs);
        const cells = days.map(day => {
          const items = (setoran.get(s.id + '|' + day.tanggal) || []).filter(item => relevantTypes.includes(item.type) || item.type === 'mutqin');
          if (items.length) {
            const isMaju = day.tanggal > today;
            return { status: 'submitted', types: items.map(it => it.type), records: items, isMaju };
          }
          if (day.tanggal > today) return { status: 'future', types: [], records: [] };
          const isWeekend = (new Date(day.tanggal + 'T12:00:00')).getDay() === 0 || (new Date(day.tanggal + 'T12:00:00')).getDay() === 6;
          const isLembagaLibur = Store.isLiburLembaga ? Store.isLiburLembaga(day.tanggal) : false;
          const santriDayAbsensi = (db.kehadiran || []).filter(k => k.santriId === s.id && k.tanggal === day.tanggal);
          const kLiburCount = santriDayAbsensi.filter(k => k.status === 'Libur').length;
          const kNonLiburCount = santriDayAbsensi.filter(k => k.status !== 'Libur').length;
          const halaqahAu = (db.absensiUstadz || []).filter(a => a.tanggal === day.tanggal && (a.halaqah === h.nama || a.halaqahId === h.id));
          const auLiburCount = halaqahAu.filter(a => a.status === 'Libur').length;
          const auNonLiburCount = halaqahAu.filter(a => a.status !== 'Libur').length;
          const fullLiburMin = Math.max(1, Store.sesiList().length - 1);
          const isFullDayLibur = isWeekend || isLembagaLibur || (auLiburCount >= fullLiburMin && auNonLiburCount === 0) || (kLiburCount >= fullLiburMin && kNonLiburCount === 0);
          const isDayLibur = isFullDayLibur;
          if (isDayLibur) return { status: 'libur', types: [] };
          const hadirCount = santriDayAbsensi.filter(k => k.status === 'Hadir').length;
          const partialLiburRec = santriDayAbsensi.find(k => k.status === 'Libur') || halaqahAu.find(a => a.status === 'Libur');
          const sakitRec = santriDayAbsensi.find(k => k.status === 'Sakit');
          const izinRec = santriDayAbsensi.find(k => k.status === 'Izin');
          if (sakitRec && hadirCount === 0) return { status: 'sakit', types: [], sesi: sakitRec.sesi, ket: sakitRec.keterangan || sakitRec.catatan || '' };
          if (izinRec && hadirCount === 0) return { status: 'izin', types: [], sesi: izinRec.sesi, ket: izinRec.keterangan || izinRec.catatan || '' };
          let partialTxt = '';
          if (sakitRec) partialTxt = 'Sakit: ' + sakitRec.sesi + (sakitRec.keterangan ? ' - ' + sakitRec.keterangan : '');
          else if (izinRec) partialTxt = 'Izin: ' + izinRec.sesi + (izinRec.keterangan ? ' - ' + izinRec.keterangan : '');
          else if (partialLiburRec) partialTxt = 'Libur: ' + partialLiburRec.sesi;
          return { status: 'missing', types: [], partialInfo: partialTxt, partialLiburSesi: partialLiburRec ? partialLiburRec.sesi : '' };
        });
        const absensi = Store.rekapKehadiranSantri(s.id, period.dari, period.sampai);
        return {
          s, programs, cells,
          missing: cells.filter(c => c.status === 'missing').length,
          setoran: cells.filter(c => c.status === 'submitted').length,
          hadir: absensi.total.Hadir,
          izin: absensi.total.Izin,
          sakit: absensi.total.Sakit,
          alfa: absensi.total.Alfa,
          libur: absensi.total.Libur,
          persen: absensi.total.persen ?? (absensi.total.slot ? Math.round((absensi.total.Hadir / absensi.total.slot) * 100) : 0)
        };
      });
      return { h, rows };
    });
    return { period, days, groups };
  }

  function renderRekapSetoranMingguan(filters) {
    const recap = depositGroups(filters);
    const hasPresensi = Store.hasFeature('presensi');
    const allowMakeup = !!(filters && filters.allowMakeup);
    const allowJpgDownload = !!(filters && filters.allowJpgDownload);
    const groups = recap.groups.map(group => {
      const body = group.rows.map((row, index) => {
        const canInput = allowMakeup && row.programs.length > 0;
        const cells = row.cells.map((cell, dayIndex) => {
          if (cell.status === 'future') {
            if (canInput) {
              const tanggal = recap.days[dayIndex].tanggal;
              return `<td class="center" title="Setoran Maju untuk ${UI.esc(UI.fmtDate(tanggal))}"><button class="clay-btn sm ghost" data-bayar-setoran data-santri-id="${UI.esc(row.s.id)}" data-tanggal="${UI.esc(tanggal)}" data-programs="${UI.esc(row.programs.join(','))}" style="padding:2px 5px;font-size:10px;color:var(--primary);border-color:var(--primary)" title="Klik untuk catat Setoran Maju (Bayar di Muka)">+ Maju</button></td>`;
            }
            return '<td class="center"><span class="badge gray">—</span></td>';
          }
          if (cell.status === 'submitted') {
            const shortInfo = (cell.records || []).map(r => formatSetoranShort(r.record, r.type)).join('\n') || cell.types.map(type => JENIS_SETORAN[type]).join(', ');
            const fullDetail = (cell.records || []).map(r => formatSetoranDetail(r.record, r.type)).join('\n\n') || shortInfo;
            const majuBadge = cell.isMaju ? ' <span style="font-size:9px;background:var(--primary);color:#fff;padding:1px 3px;border-radius:3px">Maju</span>' : '';
            const majuTitle = cell.isMaju ? ' [Setoran Maju/Di Muka]\n' : '';
            return `<td class="center" title="${UI.esc(majuTitle + shortInfo)}"><span class="badge green setoran-check-badge" title="${UI.esc(majuTitle + shortInfo)}" data-setoran-info="${UI.esc((cell.isMaju ? '⏩ [SETORAN MAJU / DI MUKA]\n\n' : '') + fullDetail)}" data-santri-nama="${UI.esc(row.s.nama)}" data-tanggal="${UI.esc(recap.days[dayIndex].tanggal)}" style="cursor:pointer;user-select:none;-webkit-user-select:none">✓${majuBadge}</span></td>`;
          }
          if (cell.status === 'libur') {
            return '<td class="center" title="Halaqah Libur"><span class="badge purple" style="font-size:10px;padding:2px 6px">Libur</span></td>';
          }
          if (cell.status === 'sakit') {
            const sesiTxt = cell.sesi ? ` (${cell.sesi})` : '';
            const ketTxt = cell.ket ? ` - ${cell.ket}` : '';
            if (canInput) {
              const tanggal = recap.days[dayIndex].tanggal;
              return `<td class="center" title="Absensi: Sakit${sesiTxt}${ketTxt}"><span class="badge blue" style="font-size:10px;padding:2px 5px;margin-right:2px">Sakit</span><button class="clay-btn sm secondary" data-bayar-setoran data-santri-id="${UI.esc(row.s.id)}" data-tanggal="${UI.esc(tanggal)}" data-programs="${UI.esc(row.programs.join(','))}" style="padding:2px 5px;font-size:10px" title="Klik untuk catat bayar setoran susulan">Bayar</button></td>`;
            }
            return `<td class="center" title="Absensi: Sakit${sesiTxt}${ketTxt}"><span class="badge blue" style="font-size:10px;padding:2px 6px">Sakit</span></td>`;
          }
          if (cell.status === 'izin') {
            const sesiTxt = cell.sesi ? ` (${cell.sesi})` : '';
            const ketTxt = cell.ket ? ` - ${cell.ket}` : '';
            if (canInput) {
              const tanggal = recap.days[dayIndex].tanggal;
              return `<td class="center" title="Absensi: Izin${sesiTxt}${ketTxt}"><span class="badge warn" style="font-size:10px;padding:2px 5px;margin-right:2px">Izin</span><button class="clay-btn sm secondary" data-bayar-setoran data-santri-id="${UI.esc(row.s.id)}" data-tanggal="${UI.esc(tanggal)}" data-programs="${UI.esc(row.programs.join(','))}" style="padding:2px 5px;font-size:10px" title="Klik untuk catat bayar setoran susulan">Bayar</button></td>`;
            }
            return `<td class="center" title="Absensi: Izin${sesiTxt}${ketTxt}"><span class="badge warn" style="font-size:10px;padding:2px 6px">Izin</span></td>`;
          }
          if (canInput) {
            const tanggal = recap.days[dayIndex].tanggal;
            const label = tanggal < Store.todayStr() ? 'Bayar' : 'Setor';
            const partialTxt = cell.partialInfo ? ` (${cell.partialInfo})` : (cell.partialLiburSesi ? ` (Sesi ${cell.partialLiburSesi} Libur)` : '');
            return `<td class="center" title="${partialTxt ? 'Belum setoran' + partialTxt : 'Belum setoran'}"><button class="clay-btn sm secondary" data-bayar-setoran data-santri-id="${UI.esc(row.s.id)}" data-tanggal="${UI.esc(tanggal)}" data-programs="${UI.esc(row.programs.join(','))}" style="padding:3px 7px;font-size:11px">${label}</button></td>`;
          }
          const partialTxt = cell.partialInfo ? ` (${cell.partialInfo})` : (cell.partialLiburSesi ? ` (Sesi ${cell.partialLiburSesi} Libur)` : '');
          return `<td class="center" title="Belum setoran${partialTxt}"><span class="badge danger">Belum</span></td>`;
        }).join('');
        return `<tr>
          <td class="center">${index + 1}</td>
          <td><b>${UI.esc(row.s.nama)}</b><div class="muted" style="font-size:12px">${UI.esc(row.s.nis || '-')}</div></td>
          <td>${UI.esc(Store.programSummaryForSantri(row.s) || '-')}</td>
          ${cells}
          <td class="center"><b>${row.setoran}</b></td>
          <td class="center"><b>${row.missing}</b></td>
          ${hasPresensi ? `<td class="center" style="font-size:12px" title="Hadir: ${row.hadir}, Izin: ${row.izin}, Sakit: ${row.sakit}, Libur: ${row.libur || 0}, Alfa: ${row.alfa}">${row.hadir}/${row.izin}/${row.sakit}/${row.libur || 0}/${row.alfa}</td><td class="center"><b>${row.persen}%</b></td>` : ''}
        </tr>`;
      }).join('');
      const colCount = (hasPresensi ? 7 : 5) + recap.days.length;
      return `<div class="clay-card mb">
        <div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:12px">
          <div><div class="section-title" style="margin:0">${UI.esc(group.h.nama)}</div><div class="muted" style="font-size:12px">Ustadz: ${UI.esc(Store.ustadzNamesForHalaqah(group.h).join(', ') || 'Belum ditetapkan')} · ${group.rows.length} santri aktif</div></div>
          <div class="row" style="gap:8px;align-items:center">
            ${allowJpgDownload ? `<button class="clay-btn sm secondary" type="button" data-download-rekap-jpg data-halaqah-id="${UI.esc(group.h.id)}">⬇ Unduh JPG</button>` : ''}
            <span class="badge blue">${UI.esc(group.h.level || '-')}</span>
          </div>
        </div>
        <div class="table-wrap"><table class="clay-table">
          <thead><tr><th class="center">No</th><th>Santri</th><th>Level</th>${recap.days.map(day => `<th class="center">${day.label}<br><span style="font-weight:400;font-size:11px">${day.tanggal.slice(8)}</span></th>`).join('')}<th class="center">Setor</th><th class="center">Belum</th>${hasPresensi ? '<th class="center" title="Hadir / Izin / Sakit / Libur / Alfa">Kehadiran<br><span style="font-weight:400;font-size:10px">H / I / S / L / A</span></th><th class="center">%</th>' : ''}</tr></thead>
          <tbody>${body || `<tr><td colspan="${colCount}"><div class="empty">Belum ada santri aktif di halaqah ini.</div></td></tr>`}</tbody>
        </table></div>
      </div>`;
    }).join('');
    const jumlahHari = recap.days.length;
    return `<div class="mb">
      <div class="muted" style="font-size:13px;margin:0 0 12px">Periode ${UI.esc(UI.fmtDate(recap.period.dari))} – ${UI.esc(UI.fmtDate(recap.period.sampai))} (${jumlahHari} hari). <span class="badge green">✓</span> sudah setoran; <span class="badge blue">Sakit</span> absen sakit; <span class="badge warn">Izin</span> izin; <span class="badge purple">Libur</span> libur; <span class="badge danger">Belum</span> belum setoran.${allowMakeup ? ' Klik <b>Bayar</b> untuk setoran tertinggal, atau <b>+ Maju</b> untuk setoran di muka (esok hari).' : ''} Setoran dihitung dari Tahsin, Ziyadah Bacaan, Ziyadah Hafalan, dan Mutqin.</div>
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
    const recap = depositGroups(filters);
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
    ctx.fillText('Rekap Setoran', padding, 116);
    ctx.fillStyle = '#166534';
    ctx.font = '700 25px Poppins, Arial, sans-serif';
    canvasText(ctx, group.h.nama, padding, 157, 900);
    ctx.fillStyle = '#4b5563';
    ctx.font = '500 18px Inter, Arial, sans-serif';
    const sampai = recap.days[recap.days.length - 1].tanggal;
    canvasText(ctx, `Periode ${UI.fmtDate(recap.period.dari)}–${UI.fmtDate(sampai)}`, padding, 190, 690);
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
          } else if (cell.status === 'libur') {
            ctx.fillStyle = '#f3e8ff';
            canvasRoundedRect(ctx, centerX - 24, y + 16, 48, 24, 6);
            ctx.fill();
            ctx.fillStyle = '#7e22ce';
            ctx.font = '600 13px Inter, Arial, sans-serif';
            ctx.fillText('Libur', centerX, y + 33);
          } else if (cell.status === 'sakit') {
            ctx.fillStyle = '#dbeafe';
            canvasRoundedRect(ctx, centerX - 24, y + 16, 48, 24, 6);
            ctx.fill();
            ctx.fillStyle = '#1d4ed8';
            ctx.font = '600 13px Inter, Arial, sans-serif';
            ctx.fillText('Sakit', centerX, y + 33);
          } else if (cell.status === 'izin') {
            ctx.fillStyle = '#fef3c7';
            canvasRoundedRect(ctx, centerX - 24, y + 16, 48, 24, 6);
            ctx.fill();
            ctx.fillStyle = '#854d0e';
            ctx.font = '600 13px Inter, Arial, sans-serif';
            ctx.fillText('Izin', centerX, y + 33);
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
    ctx.fillText('✓ Sudah setoran    •    Belum: belum setoran    •    Libur: diliburkan    •    — Tanggal mendatang', padding, footerY);
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
      anchor.download = `Rekap_Setoran_${safeFilename(group.h.nama)}_${recap.period.dari}_sd_${recap.period.sampai}.jpg`;
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
  const UPDATE_COMMIT_INDO_MAP = {
    'harden admin dashboard against null mysql rows and shared hosting exec restrictions': 'Peningkatan stabilitas dasbor admin untuk data MySQL kosong dan batasan server hosting',
    'add 3 raport models (indo, indo-arab, full arab), arabic data inputs, and bottom popup menu': 'Penambahan 3 model raport (Indonesia, Indonesia-Arab, Full Arab), input data Arab, dan menu bawah',
    'declare sesiaktif and recselfustadz before absenustadzcard in ustadz.dashboard': 'Perbaikan urutan tampilan kartu absensi ustadz pada dasbor ustadz',
    'lock repeated ustadz attendance per session and align juz 12-30 page boundaries to mushaf madinah': 'Penguncian absensi ulang ustadz per sesi dan penyesuaian batas halaman Juz 12–30 ke Mushaf Madinah',
    'repair empty superuser role truncated by legacy mysql enum': 'Perbaikan peran superuser kosong pada kolom ENUM MySQL lama',
    'widen legacy mysql users.role enum to varchar(32) so superuser can be seeded': 'Perluasan tipe kolom peran pengguna MySQL agar akun superuser dapat dibuat otomatis',
    'remove demo quick-login box from login page for production': 'Menghapus kotak login demo dari halaman masuk',
    'deduplicate legacy attendance rows during migration instead of aborting': 'Penanganan otomatis duplikasi data absensi lama saat migrasi database',
    'normalize empty/invalid date strings to null for mysql strict mode': 'Normalisasi tanggal kosong/tidak valid agar sesuai mode ketat MySQL',
    'add missing mysql columns and drop obsolete index before indexing in sqlite_to_mysql': 'Penambahan kolom MySQL yang belum ada saat migrasi data',
    'raport bulk halaqah, spp, monochrome notif icon, and sqlite to mysql migrator': 'Penambahan cetak raport per halaqah, modul SPP, ikon notifikasi, dan alat migrasi SQLite ke MySQL',
    'include murojaah in bootstrapdata and bump cache version': 'Penyertaan data murojaah saat memuat aplikasi dan pembaruan cache',
    'retain active tab on refresh and fix murojaah setoran persistence': 'Mempertahankan tab aktif saat halaman dimuat ulang dan perbaikan penyimpanan setoran murojaah'
  };

  function translateUpdateTextToIndo(raw) {
    let txt = String(raw || '').trim();
    txt = txt.replace(/^(feat|fix|refactor|perf|chore|docs|style)(\([^)]+\))?:\s*/i, '').trim();
    const mapped = UPDATE_COMMIT_INDO_MAP[txt.toLowerCase()];
    if (mapped) return mapped;
    // Terjemahkan kata/frasa Inggris umum ke bahasa Indonesia bila berasal dari log commit lama
    if (/\b(add|fix|update|remove|include|retain|harden|align|lock|repair|widen|normalize|drop|bump|dashboard|attendance|guardian|settings|report)\b/i.test(txt)) {
      const rules = [
        [/\badd\b/gi, 'Penambahan'], [/\bfix\b/gi, 'Perbaikan'], [/\bupdate\b/gi, 'Pembaruan'],
        [/\bremove\b/gi, 'Penghapusan'], [/\binclude\b/gi, 'Penyertaan'], [/\bretain\b/gi, 'Mempertahankan'],
        [/\bimprove\b/gi, 'Peningkatan'], [/\bharden\b/gi, 'Penguatan'], [/\bhide\b/gi, 'Sembunyikan'],
        [/\bshow\b/gi, 'Tampilkan'], [/\ballow\b/gi, 'Izinkan'], [/\boption\b/gi, 'opsi'],
        [/\band\b/gi, 'dan'], [/\bin\b/gi, 'pada'], [/\bfor\b/gi, 'untuk'], [/\bfrom\b/gi, 'dari'],
        [/\bto\b/gi, 'ke'], [/\bwith\b/gi, 'dengan'], [/\bwithout\b/gi, 'tanpa'], [/\bon\b/gi, 'saat'],
        [/\battendance\b/gi, 'kehadiran'], [/\breport\b/gi, 'laporan'], [/\bsettings\b/gi, 'pengaturan'],
        [/\bdashboard\b/gi, 'dasbor'], [/\bguardian\b/gi, 'wali'], [/\bstudent\b/gi, 'santri'],
        [/\bteacher\b/gi, 'ustadz'], [/\bcache version\b/gi, 'versi cache'], [/\bactive tab\b/gi, 'tab aktif'],
        [/\brefresh\b/gi, 'muat ulang'], [/\bpersistence\b/gi, 'penyimpanan'], [/\bempty\b/gi, 'kosong'],
        [/\blogin page\b/gi, 'halaman masuk'], [/\bbottom popup menu\b/gi, 'menu bawah']
      ];
      rules.forEach(([re, rep]) => { txt = txt.replace(re, rep); });
    }
    return txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : 'Pembaruan sistem aplikasi telah diterapkan.';
  }

  function formatNotifParts(n) {
    let raw = String((n && n.pesan) || '').trim();
    // Bersihkan karakter '?' atau emoji rusak akibat penyimpanan tabel utf8 lama
    raw = raw.replace(/^(?:[?\uFFFD\u26A0\uFE0F]+|\uD83D[\uDE80\uDCB3\uDCCB]|\s)+/g, '').trim();
    raw = raw.replace(/\bdisuspend otomatis\b/gi, 'dinonaktifkan sementara secara otomatis')
      .replace(/\bsebelum suspend\b/gi, 'sebelum penonaktifan')
      .replace(/\bsuspend\b/gi, 'penonaktifan');

    let category = 'Informasi';
    let tone = 'info';
    let icoName = 'bell';
    let version = (n && n.commitHash) ? String(n.commitHash) : '';

    const updMatch = raw.match(/^(?:Update Aplikasi|Update Baru|Pembaruan Aplikasi|Pembaruan Sistem)\s*(?:\((?:v\.?)?([a-z0-9]+)\))?\s*:\s*(.*)$/i);
    if (updMatch || (n && n.kategori === 'update') || (n && n.tipe === 'update')) {
      category = 'Pembaruan Aplikasi';
      tone = 'pembaruan';
      icoName = 'award';
      if (updMatch) {
        if (!version && updMatch[1]) version = updMatch[1];
        raw = translateUpdateTextToIndo(updMatch[2]);
      } else {
        raw = translateUpdateTextToIndo(raw);
      }
    } else if ((n && n.kategori === 'layanan_billing') || /^(?:Masa tenggang|Tagihan layanan)/i.test(raw)) {
      category = 'Tagihan & Layanan';
      tone = 'tagihan';
      icoName = 'settings';
    } else if ((n && n.kategori === 'absensi') || /^(?:Rekap (?:absensi|presensi)|Libur Lembaga)/i.test(raw)) {
      category = 'Kehadiran & Jadwal';
      tone = 'absensi';
      icoName = 'calendar';
      raw = raw.replace(/^Rekap absensi\b/i, 'Rekap presensi');
    } else if (/(?:Setoran|Tahsin|Mutqin|Murojaah|Murajaah|belum setoran)/i.test(raw)) {
      category = 'Setoran & Hafalan';
      tone = 'setoran';
      icoName = 'setoran';
    } else if (n && n.tipe === 'ustadz') {
      category = 'Info Ustadz';
      tone = 'info';
      icoName = 'teacher';
    } else if (n && n.tipe === 'wali') {
      category = 'Info Wali Santri';
      tone = 'setoran';
      icoName = 'users';
    } else if (n && n.tipe === 'admin') {
      category = 'Info Admin';
      tone = 'info';
      icoName = 'settings';
    }

    return {
      category,
      tone,
      icoName,
      version: version ? (version.startsWith('v.') ? version : 'v.' + version) : '',
      text: raw || 'Tidak ada detail informasi.'
    };
  }

  function renderNotifItemHtml(n) {
    const parts = formatNotifParts(n);
    const ts = n.tanggal || n.waktu || n.createdAt || '';
    const msgHtml = (n && n.html) ? n.pesan : UI.esc(parts.text);
    return `
      <div class="notif-item-card ${n && !n.read ? 'unread' : ''}">
        <div class="notif-item-main">
          <span class="notif-ico-wrap notif-tone-${parts.tone}">${icon(parts.icoName)}</span>
          <div class="notif-body">
            <div class="notif-meta">
              <span class="notif-cat notif-tone-${parts.tone}">${UI.esc(parts.category)}</span>
              ${parts.version ? `<span class="notif-ver">${UI.esc(parts.version)}</span>` : ''}
            </div>
            <div class="notif-text">${msgHtml}</div>
            ${ts ? `<div class="notif-time">${UI.fmtDateTime(ts)}</div>` : ''}
          </div>
        </div>
        ${n && !n.read ? '<span class="notif-badge-new">Baru</span>' : ''}
      </div>`;
  }

  function renderNotifikasi(userId) {
    const list = Store.notifFor(userId).slice().sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
    const perm = typeof PWA !== 'undefined' ? PWA.getNotificationPermission() : 'default';

    // Tandai notifikasi sebagai sudah dibaca
    setTimeout(() => {
      let updated = false;
      list.forEach(n => {
        if (!n.read) {
          n.read = true;
          updated = true;
        }
      });
      if (updated) Store.save();
    }, 1500);

    const pwaBanner = `
      <div class="clay-card pad-sm mb" style="background:#f0fdf4;border:1px solid #bbf7d0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="display:inline-flex;color:var(--text);padding:8px;background:var(--slate-100);border-radius:8px">${icon('bell')}</span>
          <div>
            <b>Notifikasi Perangkat (PWA &amp; Perangkat)</b>
            <div class="muted" style="font-size:12px" id="pwa-notif-status-text">
              ${perm === 'granted'
                ? 'Status: <span style="color:#16a34a;font-weight:600">Aktif</span> — Anda menerima notifikasi langsung di layar HP/Laptop.'
                : 'Status: <span style="color:#ca8a04;font-weight:600">Belum Aktif</span> — Izinkan notifikasi agar pembaruan setoran &amp; absensi muncul langsung.'}
            </div>
          </div>
        </div>
        <div class="row" style="gap:6px">
          ${perm === 'granted'
            ? '<button class="clay-btn sm ghost" id="btn-test-device-notif" style="color:#16a34a;border:1px solid #86efac">Kirim Tes Notifikasi</button>'
            : '<button class="clay-btn sm primary" id="btn-enable-device-notif">Aktifkan Notifikasi</button>'}
        </div>
      </div>
    `;

    if (!list.length) {
      return `
        ${pwaBanner}
        <div class="clay-card"><div class="empty">Belum ada notifikasi.</div></div>
      `;
    }

    return `
      ${pwaBanner}
      <div class="clay-card" id="notif-card">
        <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px">
          <div class="section-title" style="margin:0">Daftar Notifikasi (${list.length})</div>
          <button class="clay-btn sm ghost" id="clear-notif" style="color:var(--danger)">Hapus Semua</button>
        </div>
        <div class="notif-list">
          ${list.map(n => renderNotifItemHtml(n)).join('')}
        </div>
      </div>`;
  }

  // Delegated click handler for notification banner buttons
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'btn-enable-device-notif') {
      if (typeof PWA !== 'undefined') {
        PWA.requestNotificationPermission().then(() => {
          const session = Store.getSession();
          if (session) {
            const root = document.getElementById('view-content');
            if (root && root.querySelector('#pwa-notif-status-text')) {
              root.innerHTML = renderNotifikasi(session.userId);
            }
          }
        });
      }
    }
    if (e.target && e.target.id === 'btn-test-device-notif') {
      if (typeof PWA !== 'undefined') PWA.testNotification();
    }
  });

  return { shell, setHeader, setActions, bindSearchInput, gantiPassModal, statCard, barChart, progressCircle, renderRiwayat, renderPerHalaqahRiwayat, renderLaporan, renderLaporanMurojaah, renderRaportPage, loadLaporan, bindLaporanExport, exportLaporanExcel, htmlTableToSheet, downloadExcel, downloadXlsx, downloadTemplateExcel, bulanLabel, mondayOf, rekapSetoranRange, setRekapSetoranRange, renderRekapSetoranMingguan, bindRekapSetoranBayar, bindRekapSetoranJpgDownload, renderNotifikasi, formatNotifParts, renderNotifItemHtml, kirimRekapOtomatis, ICONS, icon, hafalanMapHTML };
})();

// Detail info saat centang setoran di-hover (desktop) atau di-tap/hold (HP)
if (typeof document !== 'undefined' && !document._setoranDetailBound) {
  document._setoranDetailBound = true;
  let holdTimer = null;
  let didHold = false;

  function openSetoranInfo(el) {
    const info = el.getAttribute('data-setoran-info');
    if (!info) return;
    const nama = el.getAttribute('data-santri-nama') || 'Santri';
    const tgl = el.getAttribute('data-tanggal') || '';
    UI.openModal({
      title: 'Detail Setoran · ' + nama,
      sub: tgl ? ('Tanggal: ' + UI.fmtDate(tgl)) : '',
      bodyHTML: `<div class="clay-card pad-sm" style="white-space:pre-line;line-height:1.7;font-size:14px;background:var(--bg)">${UI.esc(info)}</div>`,
      actions: [{ label: 'Tutup', cls: 'primary', onClick: (m, c) => c() }]
    });
  }

  document.addEventListener('touchstart', e => {
    const badge = e.target.closest('.setoran-check-badge');
    if (!badge) return;
    didHold = false;
    holdTimer = setTimeout(() => {
      didHold = true;
      openSetoranInfo(badge);
    }, 350);
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  });

  document.addEventListener('touchmove', () => {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  });

  document.addEventListener('click', e => {
    const badge = e.target.closest('.setoran-check-badge');
    if (!badge) return;
    if (didHold) { didHold = false; return; }
    openSetoranInfo(badge);
  });

  document.addEventListener('contextmenu', e => {
    if (e.target.closest('.setoran-check-badge')) {
      e.preventDefault();
    }
  });
}
