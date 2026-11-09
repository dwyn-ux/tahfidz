/* ============================================================
   Tahfidzku — PWA & Device Notifications Manager
   ============================================================ */

const PWA = (() => {
  let swRegistration = null;
  let deferredPrompt = null;
  const NOTIF_STORAGE_KEY = 'tahfidzku_sent_device_notifs';

  function getSentNotifIds() {
    try {
      return new Set(JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || '[]'));
    } catch (e) {
      return new Set();
    }
  }

  function markNotifSent(id) {
    if (!id) return;
    try {
      const set = getSentNotifIds();
      set.add(String(id));
      const arr = Array.from(set).slice(-100); // keep last 100
      localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {}
  }

  // Register Service Worker
  async function initServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.log('[PWA] Service Worker tidak didukung di browser ini.');
      return null;
    }

    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      swRegistration = reg;

      // Handle updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            if (typeof UI !== 'undefined' && UI.toast) {
              UI.toast('Pembaruan baru tersedia. Memuat ulang aplikasi...', 'info');
            }
            setTimeout(() => {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
              window.location.reload();
            }, 1200);
          }
        });
      });

      console.log('[PWA] Service Worker terdaftar dengan scope:', reg.scope);
      return reg;
    } catch (err) {
      console.warn('[PWA] Gagal mendaftarkan Service Worker:', err);
      return null;
    }
  }

  // Check if app is installed / running in standalone mode
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://');
  }

  // Check iOS device
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  // Handle PWA installation
  function initInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      renderInstallButtons();
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast('🎉 Tahfidzku berhasil diinstall sebagai aplikasi!', 'success');
      }
      renderInstallButtons();
    });
  }

  async function promptInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        deferredPrompt = null;
      }
      renderInstallButtons();
    } else if (isIOS()) {
      showIOSInstallModal();
    } else {
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast('Aplikasi sudah terinstall atau gunakan menu browser (Tambahkan ke Layar Utama)', 'info');
      }
    }
  }

  function showIOSInstallModal() {
    if (typeof UI !== 'undefined' && UI.openModal) {
      UI.openModal({
        title: '📲 Pasang Aplikasi di iPhone / iPad',
        bodyHTML: `
          <div style="font-size:14px;line-height:1.6">
            <p>Untuk menginstall <b>Tahfidzku</b> di perangkat Apple (iOS / iPadOS):</p>
            <ol style="padding-left:20px;margin:12px 0">
              <li style="margin-bottom:8px">Ketuk tombol <b>Bagikan (Share)</b> <span style="font-size:18px">⎋</span> di bilah bawah browser Safari.</li>
              <li style="margin-bottom:8px">Gulir ke bawah dan pilih <b>Tambahkan ke Layar Utama (Add to Home Screen)</b> <span style="font-size:18px">➕</span>.</li>
              <li>Ketuk <b>Tambah (Add)</b> di pojok kanan atas.</li>
            </ol>
            <p class="muted" style="font-size:12px">Setelah terpasang, ikon Tahfidzku akan muncul di layar utama seperti aplikasi bawaan.</p>
          </div>
        `,
        actions: [{ label: 'Mengerti', role: 'primary' }]
      });
    }
  }

  function renderInstallButtons() {
    const installBtns = document.querySelectorAll('.pwa-install-btn');
    const shouldShow = (!isStandalone() && (deferredPrompt || isIOS()));
    installBtns.forEach(btn => {
      btn.style.display = shouldShow ? 'inline-flex' : 'none';
    });
  }

  /* ---------- Notification API ---------- */
  function isNotificationSupported() {
    return ('Notification' in window);
  }

  function getNotificationPermission() {
    if (!isNotificationSupported()) return 'unsupported';
    return Notification.permission; // 'default', 'granted', 'denied'
  }

  async function requestNotificationPermission() {
    if (!isNotificationSupported()) {
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast('Browser ini belum mendukung notifikasi sistem', 'warn');
      }
      return 'unsupported';
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        if (typeof UI !== 'undefined' && UI.toast) {
          UI.toast('Notifikasi aktif! Anda akan menerima update penting.', 'success');
        }
        sendNotification('Tahfidzku Aktif', {
          body: 'Notifikasi sistem berhasil diaktifkan. Anda akan menerima update setoran dan absensi.',
          tag: 'tahfidzku-welcome'
        });
      } else if (permission === 'denied') {
        if (typeof UI !== 'undefined' && UI.toast) {
          UI.toast('Izin notifikasi ditolak. Anda dapat mengubahnya di pengaturan browser.', 'warn');
        }
      }
      return permission;
    } catch (err) {
      console.warn('[PWA] Error meminta izin notifikasi:', err);
      return Notification.permission;
    }
  }

  async function sendNotification(title, options = {}) {
    if (!isNotificationSupported() || Notification.permission !== 'granted') {
      return false;
    }

    const payload = Object.assign({
      body: '',
      icon: 'assets/icons/icon-192.png',
      badge: 'assets/icons/icon-192.png',
      vibrate: [150, 80, 150],
      tag: 'tahfidzku-' + Date.now(),
      data: options.url || './index.html'
    }, options);

    // Try through active Service Worker registration
    if (swRegistration && swRegistration.showNotification) {
      try {
        await swRegistration.showNotification(title, payload);
        return true;
      } catch (e) {
        console.warn('[PWA] SW showNotification error, falling back:', e);
      }
    }

    // Try via Controller PostMessage
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          payload: { title, ...payload }
        });
        return true;
      } catch (e) {}
    }

    // Fallback to standard Window Notification
    try {
      new Notification(title, payload);
      return true;
    } catch (e) {
      console.warn('[PWA] Standard Notification error:', e);
      return false;
    }
  }

  function testNotification() {
    if (!isNotificationSupported()) {
      UI.toast('Perangkat/browser Anda tidak mendukung Web Notification API', 'error');
      return;
    }

    if (Notification.permission === 'default') {
      requestNotificationPermission().then(perm => {
        if (perm === 'granted') {
          sendNotification('Tes Notifikasi Tahfidzku', {
            body: 'Selamat! Notifikasi berhasil terhubung ke perangkat/HP Anda.',
            tag: 'test-notif'
          });
        }
      });
      return;
    }

    if (Notification.permission === 'denied') {
      UI.confirmDialog(
        'Izin Notifikasi Diblokir',
        'Notifikasi saat ini diblokir di pengaturan browser Anda. Untuk mengaktifkannya, buka ikon kunci/setelan di sebelah alamat web browser lalu izinkan Notifikasi.',
        () => {}
      );
      return;
    }

    sendNotification('Tes Notifikasi Tahfidzku', {
      body: 'Berhasil! Perangkat Anda siap menerima notifikasi absensi dan setoran Tahfidzku.',
      tag: 'test-notif-' + Date.now()
    });
    UI.toast('Notifikasi uji coba telah dikirim ke perangkat Anda', 'success');
  }

  // Sync unread in-app notifications to device notifications
  function syncAppNotifications() {
    if (getNotificationPermission() !== 'granted') return;
    if (typeof Store === 'undefined') return;

    const session = Store.getSession();
    if (!session || !session.userId) return;

    const notifs = Store.notifFor(session.userId);
    if (!notifs || !notifs.length) return;

    const sentIds = getSentNotifIds();
    // Check recent unread notifications
    const unread = notifs.filter(n => !n.read && !sentIds.has(String(n.id)));

    unread.slice(0, 3).forEach(n => {
      markNotifSent(n.id);
      sendNotification('Tahfidzku', {
        body: n.pesan || 'Ada aktivitas terbaru di Tahfidzku',
        tag: 'notif-' + n.id,
        data: './index.html#admin_notif'
      });
    });
  }

  // Periodic background check
  let pollInterval = null;
  function startNotificationWatcher() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => {
      try {
        syncAppNotifications();
      } catch (e) {}
    }, 45000); // check every 45s
  }

  // Bootstrapping PWA
  function init() {
    initServiceWorker();
    initInstallPrompt();
    startNotificationWatcher();

    // Re-check install buttons when DOM is loaded or mutated
    window.addEventListener('DOMContentLoaded', () => {
      renderInstallButtons();
    });
  }

  return {
    init,
    isStandalone,
    isIOS,
    promptInstall,
    renderInstallButtons,
    isNotificationSupported,
    getNotificationPermission,
    requestNotificationPermission,
    sendNotification,
    testNotification,
    syncAppNotifications
  };
})();

// Auto-initialize PWA
PWA.init();
