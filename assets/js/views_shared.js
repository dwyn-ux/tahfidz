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

  function renderLaporanRows(rows) {
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
        <td class="center" style="font-size:12px" title="${UI.esc('Hadir ' + titleParts)}">${numParts}</td>
        <td class="center">${r.hadir}/${r.totalK} (${r.pct}%)</td>
      </tr>`;
    }).join('');
  }

  function applyLaporanTableSort(container) {
    const rows = sortLaporanRows(_laporanBaseRows);
    const tbody = container.querySelector('#laporan-table tbody');
    if (!tbody) return;
    tbody.innerHTML = renderLaporanRows(rows) || '<tr><td colspan="13"><div class="empty">Tidak ada data yang cocok.</div></td></tr>';
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
    const rows = sortLaporanRows(_laporanBaseRows);
    const bulan = _laporanFilters.bulan || Store.todayStr().slice(0, 7);
    const periode = (_laporanFilters.dari && _laporanFilters.sampai)
      ? UI.fmtDate(_laporanFilters.dari) + ' – ' + UI.fmtDate(_laporanFilters.sampai)
      : bulanLabel(bulan);
    const body = renderLaporanRows(rows);
    return `<div class="clay-card">
      <div class="section-title">Laporan Santri — ${UI.esc(periode)}</div>
      ${laporanMobileSortControls()}
      <div class="table-wrap">
        <table class="clay-table" id="laporan-table">
          <thead><tr>
            <th class="center">No</th>${laporanSortHeader('Santri', 'nama')}<th>NIS</th>${laporanSortHeader('Tingkat &amp; Kelas', 'kelas')}${laporanSortHeader('Halaqah', 'halaqah')}<th>Level</th>
            <th class="center">JK</th><th class="center">Setoran Awal</th><th class="center">Setoran Akhir</th>
            <th class="center">Total Hafalan</th><th class="center">Rata Nilai</th>
            <th class="center" title="${UI.esc('Rincian Sesi Hadir: ' + Store.sesiList().join(' · '))}">Hadir per Sesi<br><span style="font-weight:400;font-size:10px">${UI.esc(Store.sesiList().map(s => s.slice(0, 3)).join(' · '))}</span></th>
            <th class="center">Kehadiran (${UI.esc(periode)})</th>
          </tr></thead>
          <tbody>${body || `<tr><td colspan="13"><div class="empty">Tidak ada data.</div></td></tr>`}</tbody>
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
      ${sesiList.map(sesi => `<td class="center">${(r.hadirPerSesi && r.hadirPerSesi[sesi]) || 0}</td>`).join('')}
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
  <div class="title">LAPORAN TAHFIDZ</div>
  <div class="sub">${UI.esc(db.settings.namaLembaga)}</div>
  <div class="sub">Periode: ${UI.esc(periode)}</div>
  <table>
    <thead><tr>
      <th class="center">No</th><th>Santri</th><th>NIS</th><th>Tingkat &amp; Kelas</th><th>Halaqah</th><th>Level</th><th class="center">JK</th>
      <th class="center">Setoran Awal</th><th class="center">Setoran Akhir</th>
      <th class="center">Total Hafalan</th><th class="center">Rata Nilai</th>
      ${sesiList.map(sesi => `<th class="center">${UI.esc(sesi)}</th>`).join('')}
      <th class="center">Total Hadir</th><th class="center">Total Kehadiran</th><th class="center">%</th><th>Status</th>
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
  function raportPredikat(nilai) {
    if (!nilai || nilai <= 0) return '-';
    if (nilai >= 90) return 'A (Mumtaz)';
    if (nilai >= 80) return 'B (Jayyid Jiddan)';
    if (nilai >= 70) return 'C (Jayyid)';
    return 'D (Maqbul)';
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
    const today = Store.todayStr();
    const absSampai = (sampai && sampai > today) ? today : sampai;
    const kehadiran = Store.hasFeature('presensi') ? Store.rekapKehadiranSantri(s.id, dari, absSampai).total : null;
    const talimAbsen = (Store.hasFeature('talim') && Store.hasFeature('presensi'))
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
      const halPart = (halAwal || halAkhir)
        ? `Hal ${halAwal && halAkhir && halAwal !== halAkhir ? `${String(halAwal).split(/[–-]/)[0].trim()}–${String(halAkhir).split(/[–-]/).pop().trim()}` : (halAkhir || halAwal)}`
        : '';
      const defaultCapaian = [
        babSpan,
        list.length ? `${list.length}x kajian${halPart ? ' · ' + halPart : ''}` : ''
      ].filter(Boolean).join(' · ') || 'Belum ada jurnal materi';
      const capaian = (savedEntry && typeof savedEntry === 'object' && savedEntry.capaian)
        ? savedEntry.capaian
        : defaultCapaian;
      const rawNilai = (savedEntry && typeof savedEntry === 'object') ? savedEntry.nilai : savedEntry;
      const numNilai = Number(rawNilai);
      const nilai = (rawNilai !== '' && rawNilai !== null && rawNilai !== undefined && Number.isFinite(numNilai) && numNilai > 0)
        ? Math.round(numNilai)
        : 0;
      return { key, mapel: mapelName, kitab: kitabName, count: list.length, defaultCapaian, capaian, nilai };
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
      rekomendasi: saved ? (saved.rekomendasi || '') : '',
      ustadzLabel: ustadzList.join(', ') || '-',
      ustadzTtd,
      pimpinanTtd,
      capLembaga
    };
  }

  function buildRaportSheetHtml(info, state) {
    const db = Store.get();
    const cfg = db.settings || {};
    const s = info.s;
    const logoUrl = UI.safeUrl(cfg.logo);
    const rows = [];

    if (Store.hasFeature('tahsin') && (Store.santriHasProgram(s, 'Tahsin') || info.tahsinList.length)) {
      const first = info.tahsinList[0];
      const last = info.tahsinList[info.tahsinList.length - 1];
      const capaian = info.tahsinList.length
        ? `${info.tahsinList.length}x setoran · Hal ${first.halAwal} → ${last.halAkhir}`
        : 'Belum ada setoran pada periode ini';
      rows.push(`<tr><td><b>Tahsin / Bacaan</b></td><td>${UI.esc(capaian)}</td><td class="center">${info.tahsinAvg || '-'}</td><td class="center">${UI.esc(raportPredikat(info.tahsinAvg))}</td></tr>`);
    }
    if (Store.hasFeature('ziyadah') && (Store.santriHasProgram(s, 'Ziyadah') || info.ziyadahList.length)) {
      const first = info.ziyadahList[0];
      const last = info.ziyadahList[info.ziyadahList.length - 1];
      const periodRange = info.ziyadahList.length
        ? `${info.ziyadahList.length}x setoran (${formatSetoranLabel(first)} → ${formatSetoranLabel(last)})`
        : 'Belum ada setoran pada periode ini';
      const kumulatif = info.totalH ? `Total Hafalan: <b>${info.totalH.pages} halaman penuh</b>${info.juzLabel ? ' (' + UI.esc(info.juzLabel) + ')' : ''}` : 'Total Hafalan: -';
      rows.push(`<tr><td><b>Ziyadah (Tahfidz)</b></td><td>${UI.esc(periodRange)}<div class="rp-sub">${kumulatif}</div></td><td class="center">${info.ziyadahAvg || '-'}</td><td class="center">${UI.esc(raportPredikat(info.ziyadahAvg))}</td></tr>`);
    }
    if (Store.hasFeature('mutqin') && (Store.santriHasProgram(s, 'Mutqin') || info.mutqinList.length)) {
      const last = info.mutqinList[info.mutqinList.length - 1];
      const capaian = info.mutqinList.length
        ? `${info.mutqinList.length}x ujian · ${info.mutqinPages ? info.mutqinPages + ' hlm · ' : ''}${formatSetoranLabel(last)}`
        : 'Belum ada setoran pada periode ini';
      rows.push(`<tr><td><b>Program Mutqin</b></td><td>${UI.esc(capaian)}</td><td class="center">${info.mutqinAvg || '-'}</td><td class="center">${UI.esc(raportPredikat(info.mutqinAvg))}</td></tr>`);
    }
    if (Store.hasFeature('murojaah') && info.murojaahStats) {
      const ms = info.murojaahStats;
      const capaian = ms.setoran
        ? `${ms.setoran}x pengulangan · ${ms.pages} halaman penuh (${ms.ayahs} ayat)`
        : 'Belum ada catatan murojaah pada periode ini';
      const mAvg = ms.nilaiRata || 0;
      rows.push(`<tr><td><b>Murojaah</b></td><td>${UI.esc(capaian)}</td><td class="center">${mAvg || '-'}</td><td class="center">${UI.esc(raportPredikat(mAvg))}</td></tr>`);
    }
    if (Store.hasFeature('talim')) {
      if (info.kajianItems.length) {
        info.kajianItems.forEach(k => {
          const kitabHtml = k.kitab ? `<div class="rp-sub">Kitab: <i>${UI.esc(k.kitab)}</i></div>` : '';
          const kajianTitle = /^kajian\b/i.test(k.mapel) ? k.mapel : `Kajian ${k.mapel}`;
          rows.push(`<tr><td><b>${UI.esc(kajianTitle)}</b></td><td>${UI.esc(k.capaian)}${kitabHtml}</td><td class="center">${k.nilai || '-'}</td><td class="center">${UI.esc(raportPredikat(k.nilai))}</td></tr>`);
        });
      } else {
        rows.push(`<tr><td><b>Kajian</b></td><td>Belum ada jurnal kajian pada periode ini</td><td class="center">-</td><td class="center">-</td></tr>`);
      }
    }

    const kotaTtd = (cfg.kota || '').trim();
    const tglTtd = (kotaTtd ? kotaTtd + ', ' : '') + UI.fmtDate(Store.todayStr());
    const jabPimpinan = cfg.jabatanPimpinan || 'Mudir / Kepala Lembaga';
    const namaPimpinan = (cfg.namaPimpinan || '').trim() || '( ________________________ )';

    return `
      <section class="raport-sheet">
        <div class="rp-header">
          ${logoUrl ? `<img class="rp-logo" src="${UI.esc(logoUrl)}" alt="Logo">` : ''}
          <div>
            <div class="rp-inst">${UI.esc(cfg.namaLembaga || 'Lembaga Tahfidz')}</div>
            <div class="rp-addr">${UI.esc(cfg.alamat || '')}</div>
            <div class="rp-title">RAPORT HASIL BELAJAR TAHFIDZ AL-QUR’AN</div>
          </div>
        </div>
        <table class="rp-meta">
          <tr>
            <td><b>Nama Santri</b></td><td>: ${UI.esc(s.nama)}</td>
            <td><b>Tahun Ajaran</b></td><td>: ${UI.esc(state.tahunAjaran)}</td>
          </tr>
          <tr>
            <td><b>NIS / JK</b></td><td>: ${UI.esc(s.nis || '-')} / ${UI.esc(s.jk || '-')}</td>
            <td><b>Semester</b></td><td>: ${UI.esc(state.semester)}</td>
          </tr>
          <tr>
            <td><b>Tingkat &amp; Kelas</b></td><td>: ${UI.esc(Store.educationLabel(s))}</td>
            <td><b>Periode Penilaian</b></td><td>: ${UI.esc(UI.fmtDate(state.dari))} – ${UI.esc(UI.fmtDate(state.sampai))}</td>
          </tr>
          <tr>
            <td><b>Halaqah / Program</b></td><td>: ${UI.esc(Store.halaqahSummaryForSantri(s) || '-')}</td>
            <td><b>Pembimbing</b></td><td>: ${UI.esc(info.ustadzLabel)}</td>
          </tr>
        </table>

        <div class="rp-sec">A. Capaian Pembelajaran &amp; Hafalan</div>
        <table class="rp-table">
          <thead><tr><th>Program / Bidang</th><th>Capaian Periode Ini</th><th class="center" style="width:72px">Nilai</th><th class="center" style="width:130px">Predikat</th></tr></thead>
          <tbody>
            ${rows.join('') || '<tr><td colspan="4" class="center">Belum ada modul program pembelajaran yang aktif.</td></tr>'}
            <tr class="rp-summary">
              <td colspan="2"><b>Rata-rata Nilai Akhir Periode</b></td>
              <td class="center"><b>${info.avgNilai || '-'}</b></td>
              <td class="center"><b>${UI.esc(info.predikat)}</b></td>
            </tr>
          </tbody>
        </table>

        ${info.kehadiran ? (() => {
          const ka = info.talimAbsen && info.talimAbsen.slot > 0 ? info.talimAbsen : null;
          return `
        <div class="rp-sec">B. Rekapitulasi Kehadiran</div>
        <table class="rp-table rp-att">
          <thead><tr>${ka ? '<th>Kegiatan</th>' : ''}<th class="center">Hadir</th><th class="center">Izin</th><th class="center">Sakit</th><th class="center">Libur</th><th class="center">Alfa</th><th class="center">Persentase</th></tr></thead>
          <tbody>
            <tr>
              ${ka ? '<td><b>Halaqah (Al-Qur’an)</b></td>' : ''}
              <td class="center">${info.kehadiran.Hadir}</td>
              <td class="center">${info.kehadiran.Izin}</td>
              <td class="center">${info.kehadiran.Sakit}</td>
              <td class="center">${info.kehadiran.Libur}</td>
              <td class="center">${info.kehadiran.Alfa}</td>
              <td class="center"><b>${info.kehadiran.persen}%</b></td>
            </tr>
            ${ka ? `<tr>
              <td><b>Kajian</b></td>
              <td class="center">${ka.Hadir}</td>
              <td class="center">${ka.Izin}</td>
              <td class="center">${ka.Sakit}</td>
              <td class="center">${ka.Libur}</td>
              <td class="center">${ka.Alfa}</td>
              <td class="center"><b>${ka.persen}%</b></td>
            </tr>` : ''}
          </tbody>
        </table>`;
        })() : ''}

        <div class="rp-closing">
          <div class="rp-sec">${info.kehadiran ? 'C' : 'B'}. Akhlaq, Catatan Pembimbing &amp; Rekomendasi</div>
          <table class="rp-table">
            <tbody>
              <tr><td style="width:170px"><b>Akhlaq &amp; Kedisiplinan</b></td><td>${UI.esc(info.sikap)}</td></tr>
              <tr><td><b>Catatan Ustadz</b></td><td style="white-space:pre-line">${UI.esc(info.catatan || '-')}</td></tr>
              <tr><td><b>Rekomendasi</b></td><td>${UI.esc(info.rekomendasi || '-')}</td></tr>
            </tbody>
          </table>

          <div class="rp-signs">
            <div class="rp-sign">
              <div>Mengetahui,</div>
              <div>Orang Tua / Wali Santri</div>
              <div class="rp-sign-space"></div>
              <div class="rp-sign-name">${UI.esc(s.namaWali || '( .............................. )')}</div>
            </div>
            <div class="rp-sign">
              <div>&nbsp;</div>
              <div>Ustadz Pembimbing</div>
              <div class="rp-sign-space">${info.ustadzTtd ? `<img class="rp-sign-img" src="${UI.esc(info.ustadzTtd)}" alt="TTD Ustadz">` : ''}</div>
              <div class="rp-sign-name">${UI.esc(info.ustadzLabel !== '-' ? info.ustadzLabel : '( .............................. )')}</div>
            </div>
            <div class="rp-sign">
              <div>${UI.esc(tglTtd)}</div>
              <div>${UI.esc(jabPimpinan)}</div>
              <div class="rp-sign-space">
                ${info.capLembaga ? `<img class="rp-cap-img" src="${UI.esc(info.capLembaga)}" alt="Cap Lembaga">` : ''}
                ${info.pimpinanTtd ? `<img class="rp-sign-img" src="${UI.esc(info.pimpinanTtd)}" alt="TTD Pimpinan">` : ''}
              </div>
              <div class="rp-sign-name">${UI.esc(namaPimpinan)}</div>
            </div>
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
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          * { box-sizing: border-box; }
          body { margin: 0; background: #fff; color: #000; font: 9.5pt Arial, sans-serif; line-height: 1.32; }
          .raport-sheet { page-break-after: always; break-after: page; color: #000; }
          .raport-sheet:last-child { page-break-after: auto; break-after: auto; }
          .rp-header { display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 9px; }
          .rp-logo { width: 46px; height: 46px; object-fit: contain; }
          .rp-inst { font-size: 12.5pt; font-weight: 700; text-transform: uppercase; color: #000; }
          .rp-addr { font-size: 8pt; color: #000; }
          .rp-title { font-size: 10.5pt; font-weight: 700; margin-top: 2px; letter-spacing: 0.3px; color: #000; }
          .rp-meta { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 9pt; color: #000; }
          .rp-meta td { padding: 2px 4px; vertical-align: top; color: #000; }
          .rp-sec { font-size: 9.5pt; font-weight: 700; margin: 8px 0 4px; color: #000; page-break-after: avoid; break-after: avoid; }
          .rp-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; color: #000; }
          .rp-table tr { page-break-inside: avoid; break-inside: avoid; }
          .rp-table th, .rp-table td { border: 1px solid #000; padding: 4px 6px; font-size: 8.8pt; vertical-align: top; color: #000; background: #fff; }
          .rp-table th { background: #fff; font-weight: 700; text-align: left; }
          .rp-table th.center, .rp-table td.center { text-align: center; }
          .rp-sub { font-size: 8pt; color: #000; margin-top: 1.5px; }
          .rp-summary td { background: #fff; font-weight: 700; }
          .rp-closing { page-break-inside: avoid; break-inside: avoid; }
          .rp-signs { display: flex; justify-content: space-between; gap: 14px; margin-top: 14px; page-break-inside: avoid; break-inside: avoid; color: #000; }
          .rp-sign { flex: 1; text-align: center; font-size: 8.8pt; color: #000; }
          .rp-sign-space { position: relative; height: 52px; display: flex; align-items: center; justify-content: center; margin: 2px 0; }
          .rp-sign-img { max-height: 48px; max-width: 135px; object-fit: contain; position: relative; z-index: 2; }
          .rp-cap-img { position: absolute; left: 50%; top: 50%; transform: translate(-72%, -52%) rotate(-6deg); max-height: 62px; max-width: 90px; object-fit: contain; opacity: 0.85; z-index: 1; pointer-events: none; }
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
    let printed = false;
    const triggerPrint = () => {
      if (printed || w.closed) return;
      printed = true;
      w.focus();
      w.print();
      UI.toast('Pilih "Simpan sebagai PDF" pada dialog cetak untuk mengunduh PDF', 'info');
    };
    Promise.race([imgsReady, new Promise(res => setTimeout(res, 1500))]).then(() => setTimeout(triggerPrint, 80));
  }

  function renderRaportPage(container, options) {
    if (!container) return;
    const db = Store.get();
    const cfg = db.settings || {};
    const opt = options || {};
    const isWali = opt.mode === 'wali';
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
      ustadzId: opt.isUstadzScope ? '' : (opt.ustadzId || ''),
      halaqahId: opt.halaqahId || '',
      cari: ''
    };

    const previewStyle = `
      <style>
        .rp-preview-card .raport-sheet { background:#fff; color:#000; padding:4px; }
        .rp-preview-card .rp-header { display:flex; align-items:center; gap:12px; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:12px; color:#000; }
        .rp-preview-card .rp-logo { width:48px; height:48px; object-fit:contain; border-radius:6px; }
        .rp-preview-card .rp-inst { font-size:15px; font-weight:700; text-transform:uppercase; color:#000; }
        .rp-preview-card .rp-addr { font-size:12px; color:#000; }
        .rp-preview-card .rp-title { font-size:13.5px; font-weight:700; margin-top:2px; color:#000; }
        .rp-preview-card .rp-meta { width:100%; border-collapse:collapse; font-size:13px; margin-bottom:12px; color:#000; }
        .rp-preview-card .rp-meta td { padding:3px 6px; vertical-align:top; color:#000; }
        .rp-preview-card .rp-sec { font-size:13.5px; font-weight:700; margin:12px 0 6px; color:#000; }
        .rp-preview-card .rp-table { width:100%; border-collapse:collapse; margin-bottom:8px; font-size:13px; color:#000; }
        .rp-preview-card .rp-table th, .rp-preview-card .rp-table td { border:1px solid #000; padding:6px 8px; vertical-align:top; color:#000; background:#fff; }
        .rp-preview-card .rp-table th { background:#fff; font-weight:700; text-align:left; }
        .rp-preview-card .rp-table th.center, .rp-preview-card .rp-table td.center { text-align:center; }
        .rp-preview-card .rp-sub { font-size:12px; color:#000; margin-top:2px; }
        .rp-preview-card .rp-summary td { background:#fff; font-weight:700; }
        .rp-preview-card .rp-signs { display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:16px; margin-top:20px; text-align:center; font-size:12.5px; color:#000; }
        .rp-preview-card .rp-sign-space { position:relative; height:58px; display:flex; align-items:center; justify-content:center; margin:2px 0; }
        .rp-preview-card .rp-sign-img { max-height:54px; max-width:140px; object-fit:contain; position:relative; z-index:2; }
        .rp-preview-card .rp-cap-img { position:absolute; left:50%; top:50%; transform:translate(-72%, -52%) rotate(-6deg); max-height:66px; max-width:94px; object-fit:contain; opacity:0.85; z-index:1; pointer-events:none; }
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
          ${(!isWali && !opt.isUstadzScope) ? `<div style="flex:1;min-width:150px">${UI.field('Ustadz Pengampu', `<select class="clay-select" id="rp-ust"><option value="">Semua Ustadz</option>${UI.optionsFromList(ustadzOpts, 'id', 'nama', state.ustadzId)}</select>`)}</div>` : ''}
          ${!isWali ? `<div style="flex:1;min-width:150px">${UI.field('Halaqah', `<select class="clay-select" id="rp-hal"><option value="">${opt.isUstadzScope ? 'Semua Halaqah Saya' : 'Semua Halaqah'}</option>${UI.optionsFromList(visibleHalaqahOpts(), 'id', 'nama', state.halaqahId)}</select>`)}</div>` : ''}
        </div>
        ${!isWali ? `<div class="row center" style="justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:8px">
          <div style="flex:1;min-width:220px"><input class="clay-input" id="rp-cari" type="search" placeholder="Cari nama atau NIS santri..." autocomplete="off"></div>
          <div class="row" style="gap:8px;flex-wrap:wrap">
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
    const ustEl = container.querySelector('#rp-ust');
    const halEl = container.querySelector('#rp-hal');
    const cariEl = container.querySelector('#rp-cari');
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
          ${UI.field('Catatan Ustadz / Pembimbing', `<textarea class="clay-textarea" id="rp-f-cat" rows="4" placeholder="Contoh: Hafalan lancar, pertahankan murojaah rutin di rumah.">${UI.esc(cur ? cur.catatan : info.catatan)}</textarea>`)}
          ${UI.field('Rekomendasi / Keterangan', `<input class="clay-input" id="rp-f-rek" value="${UI.esc(cur ? cur.rekomendasi : '')}" placeholder="Contoh: Lanjutkan ke juz berikutnya">`)}
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
              const valInp = m.querySelector(`[data-kajian-nilai="${idx}"]`);
              if (!capInp && !valInp) return;
              const rawVal = valInp ? valInp.value.trim() : '';
              const numVal = rawVal === '' ? 0 : Math.max(0, Math.min(100, Math.round(Number(rawVal) || 0)));
              const capTxt = capInp ? capInp.value.trim() : k.capaian;
              nilaiKajian[k.key] = {
                mapel: k.mapel,
                kitab: k.kitab || '',
                capaian: capTxt || k.defaultCapaian,
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
              rekomendasi: m.querySelector('#rp-f-rek').value.trim(),
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
      const s = info.s;
      const cfg = (Store.get().settings) || {};
      const lines = [
        `*RAPORT HASIL BELAJAR TAHFIDZ AL-QUR'AN*`,
        `*${cfg.namaLembaga || 'Lembaga Tahfidz'}*`,
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
      const [logoImg, ustTtdImg, pimTtdImg, capImg] = await Promise.all([
        loadCanvasImage(cfg.logo),
        loadCanvasImage(info.ustadzTtd),
        loadCanvasImage(info.pimpinanTtd),
        loadCanvasImage(info.capLembaga)
      ]);
      const W = 1240, pad = 74, innerW = W - pad * 2;
      const tmp = document.createElement('canvas');
      const ctx0 = tmp.getContext('2d');

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

      ctx0.font = '400 18px Arial, sans-serif';
      const metaRowsRaw = [
        ['Nama Santri', s.nama, 'Tahun Ajaran', state.tahunAjaran],
        ['NIS / JK', `${s.nis || '-'} / ${s.jk || '-'}`, 'Semester', state.semester],
        ['Tingkat & Kelas', Store.educationLabel(s), 'Periode Penilaian', `${UI.fmtDate(state.dari)} – ${UI.fmtDate(state.sampai)}`],
        ['Halaqah / Program', Store.halaqahSummaryForSantri(s) || '-', 'Pembimbing', info.ustadzLabel]
      ];
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
      const attRowsCount = info.kehadiran ? (info.talimAbsen && info.talimAbsen.slot > 0 ? 2 : 1) : 0;
      const hCatEst = Math.max(46, catLines.length * 24 + 18);
      const hRekEst = Math.max(46, rekLines.length * 24 + 18);
      const colW = innerW / 3;
      const namaPimpinanEst = (cfg.namaPimpinan || '').trim() || '( ________________________ )';
      ctx0.font = '700 18px Arial, sans-serif';
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

      // Kop
      let y = 64;
      let textX = pad;
      if (logoImg) {
        ctx.drawImage(logoImg, pad, y, 86, 86);
        textX = pad + 106;
      }
      ctx.font = '700 26px Arial, sans-serif';
      canvasText(ctx, String(cfg.namaLembaga || 'Lembaga Tahfidz').toUpperCase(), textX, y + 26, W - pad - textX);
      ctx.font = '400 17px Arial, sans-serif';
      canvasText(ctx, cfg.alamat || '', textX, y + 52, W - pad - textX);
      ctx.font = '700 21px Arial, sans-serif';
      canvasText(ctx, 'RAPORT HASIL BELAJAR TAHFIDZ AL-QUR’AN', textX, y + 82, W - pad - textX);
      y += 104;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
      ctx.lineWidth = 1;
      y += 28;

      // Meta 2 columns (auto-wrapped so Halaqah / Program & Pembimbing never truncate)
      calcMeta.forEach(mr => {
        ctx.font = '700 18px Arial, sans-serif';
        ctx.fillText(mr.lLabel, pad, y);
        ctx.fillText(mr.rLabel, pad + 560, y);
        ctx.font = '400 18px Arial, sans-serif';
        mr.lLines.forEach((ln, li) => ctx.fillText(ln, pad + 165, y + li * 24));
        mr.rLines.forEach((ln, li) => ctx.fillText(ln, pad + 725, y + li * 24));
        y += mr.rowH;
      });

      const drawCell = (x, cy, cw, ch, bold = false) => {
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(x, cy, cw, ch);
        ctx.fillStyle = '#000000';
        ctx.font = bold ? '700 18px Arial, sans-serif' : '400 18px Arial, sans-serif';
      };

      // Bagian A
      y += 18;
      ctx.font = '700 20px Arial, sans-serif';
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
      drawCell(pad + wA[0] + wA[1], y, wA[2], 42, true); ctx.textAlign = 'center'; ctx.fillText(String(info.avgNilai || '-'), pad + wA[0] + wA[1] + wA[2] / 2, y + 27);
      drawCell(pad + wA[0] + wA[1] + wA[2], y, wA[3], 42, true); canvasText(ctx, info.predikat, pad + wA[0] + wA[1] + wA[2] + wA[3] / 2, y + 27, wA[3] - 12);
      ctx.textAlign = 'left';
      y += 42;

      // Bagian B
      if (info.kehadiran) {
        const hasKajianAtt = info.talimAbsen && info.talimAbsen.slot > 0;
        y += 30;
        ctx.font = '700 20px Arial, sans-serif';
        ctx.fillText('B. Rekapitulasi Kehadiran', pad, y);
        y += 14;
        const wK = hasKajianAtt ? 250 : 0;
        const wCell = (innerW - wK) / 6;
        if (hasKajianAtt) { drawCell(pad, y, wK, 38, true); ctx.fillText('Kegiatan', pad + 10, y + 25); }
        ['Hadir', 'Izin', 'Sakit', 'Libur', 'Alfa', 'Persentase'].forEach((hLabel, idx) => {
          const cx = pad + wK + idx * wCell;
          drawCell(cx, y, wCell, 38, true);
          ctx.textAlign = 'center'; ctx.fillText(hLabel, cx + wCell / 2, y + 25); ctx.textAlign = 'left';
        });
        y += 38;
        const drawAttRow = (label, att) => {
          if (hasKajianAtt) { drawCell(pad, y, wK, 38, true); ctx.fillText(label, pad + 10, y + 25); }
          [att.Hadir, att.Izin, att.Sakit, att.Libur, att.Alfa, att.persen + '%'].forEach((val, idx) => {
            const cx = pad + wK + idx * wCell;
            drawCell(cx, y, wCell, 38, idx === 5);
            ctx.textAlign = 'center'; ctx.fillText(String(val), cx + wCell / 2, y + 25); ctx.textAlign = 'left';
          });
          y += 38;
        };
        drawAttRow('Halaqah (Al-Qur’an)', info.kehadiran);
        if (hasKajianAtt) drawAttRow('Kajian', info.talimAbsen);
      }

      // Bagian C
      y += 30;
      ctx.font = '700 20px Arial, sans-serif';
      ctx.fillText(`${info.kehadiran ? 'C' : 'B'}. Akhlaq, Catatan Pembimbing & Rekomendasi`, pad, y);
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

      // Tanda tangan + Cap Lembaga
      y += 48;
      const kotaTtd = (cfg.kota || '').trim();
      const tglTtd = (kotaTtd ? kotaTtd + ', ' : '') + UI.fmtDate(Store.todayStr());
      const jabPimpinan = cfg.jabatanPimpinan || 'Mudir / Kepala Lembaga';
      const namaPimpinan = (cfg.namaPimpinan || '').trim() || '( ________________________ )';
      const signCols = [
        { top: 'Mengetahui,', role: 'Orang Tua / Wali Santri', name: s.namaWali || '( .............................. )', ttd: null, cap: null },
        { top: '', role: 'Ustadz Pembimbing', name: info.ustadzLabel !== '-' ? info.ustadzLabel : '( .............................. )', ttd: ustTtdImg, cap: null },
        { top: tglTtd, role: jabPimpinan, name: namaPimpinan, ttd: pimTtdImg, cap: capImg }
      ];
      signCols.forEach((sc, idx) => {
        const cx = pad + colW * idx + colW / 2;
        ctx.textAlign = 'center';
        ctx.font = '400 18px Arial, sans-serif';
        if (sc.top) ctx.fillText(sc.top, cx, y);
        ctx.fillText(sc.role, cx, y + 24);
        if (sc.cap) {
          ctx.save();
          ctx.globalAlpha = 0.85;
          ctx.translate(cx - 46, y + 74);
          ctx.rotate(-0.1);
          const cr = Math.min(120 / Math.max(1, sc.cap.naturalWidth || 120), 100 / Math.max(1, sc.cap.naturalHeight || 100), 1);
          const cw = (sc.cap.naturalWidth || 100) * cr, ch = (sc.cap.naturalHeight || 100) * cr;
          ctx.drawImage(sc.cap, -cw / 2, -ch / 2, cw, ch);
          ctx.restore();
        }
        if (sc.ttd) {
          const tr = Math.min(200 / Math.max(1, sc.ttd.naturalWidth || 200), 76 / Math.max(1, sc.ttd.naturalHeight || 76), 1);
          const tw = (sc.ttd.naturalWidth || 160) * tr, th = (sc.ttd.naturalHeight || 70) * tr;
          ctx.drawImage(sc.ttd, cx - tw / 2, y + 74 - th / 2, tw, th);
        }
        ctx.font = '700 18px Arial, sans-serif';
        const nameLines = wrapCanvasLines(ctx, sc.name, colW - 24);
        nameLines.forEach((ln, li) => {
          const ly = y + 132 + li * 22;
          ctx.fillText(ln, cx, ly);
          const lw = Math.min(colW - 24, ctx.measureText(ln).width);
          ctx.beginPath(); ctx.moveTo(cx - lw / 2, ly + 4); ctx.lineTo(cx + lw / 2, ly + 4); ctx.stroke();
        });
      });
      ctx.textAlign = 'left';

      return { canvas, linkName: `Raport_${safeFilename(s.nama)}_${safeFilename(state.semester)}.jpg` };
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
          const base = `${prefix}_${safeFilename(infos[i].s.nama)}_${safeFilename(state.semester)}`;
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
        const zipName = `Raport_${bulkScopeSlug()}_${safeFilename(state.tahunAjaran)}_${safeFilename(state.semester)}.zip`;
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
      if (dlPdfBtn) dlPdfBtn.onclick = () => printRaportSheets(buildRaportSheetHtml(info, state), `Raport_${info.s.nama.replace(/\s+/g, '_')}_${state.semester}`);
    }

    function openPreviewModal(info) {
      const sheet = buildRaportSheetHtml(info, state);
      UI.openModal({
        title: `Pratinjau Raport — ${info.s.nama}`,
        sub: `${state.tahunAjaran} · Semester ${state.semester}`,
        cls: 'modal-lg',
        bodyHTML: `${previewStyle}<div class="rp-preview-card">${sheet}</div>`,
        actions: [
          { label: 'Tutup', cls: 'ghost', onClick: (m, c) => c() },
          { label: 'Unduh JPG', cls: 'ghost', onClick: () => downloadRaportJpg(info) },
          ...(!isWali ? [{ label: 'Kirim WA', cls: 'secondary', onClick: () => openWaRaportModal(info) }] : []),
          { label: 'Cetak / Simpan PDF', cls: 'primary', onClick: () => printRaportSheets(sheet, `Raport_${info.s.nama.replace(/\s+/g, '_')}_${state.semester}`) }
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
        bodyEl.querySelector('#rp-wali-print').onclick = () => printRaportSheets(sheet, `Raport_${info.s.nama.replace(/\s+/g, '_')}_${state.semester}`);
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
    if (printAllBtn) printAllBtn.onclick = () => {
      const sheets = filteredSantri().map(s => buildRaportSheetHtml(buildRaportInfo(s, state), state)).join('');
      printRaportSheets(sheets, `Raport_${bulkScopeSlug()}_${safeFilename(state.tahunAjaran)}_${safeFilename(state.semester)}`);
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
  function renderNotifikasi(userId) {
    const list = Store.notifFor(userId).slice().sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
    const notifIconMap = { wali: icon('users'), ustadz: icon('teacher'), admin: icon('settings'), pengawas: icon('monitor'), update: icon('award') };
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
            <b>Notifikasi Perangkat (PWA &amp; Device)</b>
            <div class="muted" style="font-size:12px" id="pwa-notif-status-text">
              ${perm === 'granted'
                ? 'Status: <span style="color:#16a34a;font-weight:600">Aktif</span> — Anda menerima notifikasi langsung di layar HP/Laptop.'
                : 'Status: <span style="color:#ca8a04;font-weight:600">Belum Aktif</span> — Izinkan notifikasi agar update setoran &amp; absensi muncul langsung.'}
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
        <div class="empty">Belum ada notifikasi.</div>
      `;
    }

    return `
      ${pwaBanner}
      <div class="clay-card" id="notif-card">
        <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px">
          <div class="section-title" style="margin:0">Notifikasi</div>
          <button class="clay-btn sm ghost" id="clear-notif" style="color:var(--danger)">Hapus Semua</button>
        </div>
        ${list.map(n =>
        `<div class="row center" style="justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee">
          <div class="row center" style="gap:10px"><span style="display:inline-flex;color:var(--text-soft);padding:6px;background:var(--bg-subtle);border-radius:6px">${(notifIconMap[n.tipe] || icon('bell'))}</span>
          <div><div>${n.html ? n.pesan : UI.esc(n.pesan)}</div><div class="muted" style="font-size:12px">${UI.fmtDateTime(n.tanggal)}</div></div></div>
          ${n.read ? '' : '<span class="badge blue">Baru</span>'}
        </div>`).join('')}
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

  return { shell, setHeader, setActions, bindSearchInput, gantiPassModal, statCard, barChart, progressCircle, renderRiwayat, renderPerHalaqahRiwayat, renderLaporan, renderLaporanMurojaah, renderRaportPage, loadLaporan, bindLaporanExport, exportLaporanExcel, htmlTableToSheet, downloadExcel, downloadXlsx, downloadTemplateExcel, bulanLabel, mondayOf, rekapSetoranRange, setRekapSetoranRange, renderRekapSetoranMingguan, bindRekapSetoranBayar, bindRekapSetoranJpgDownload, renderNotifikasi, kirimRekapOtomatis, ICONS, icon, hafalanMapHTML };
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
