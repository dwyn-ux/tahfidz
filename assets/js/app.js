/* ============================================================
   Tahfidzku — App Router
   ============================================================ */
const App = (() => {
  const routes = {
    // Admin
    admin_dashboard: () => Admin.dashboard(),
    admin_santri: () => Admin.santri(),
    admin_ustadz: () => Admin.ustadz(),
    admin_halaqah: () => Admin.halaqah(),
    admin_master: () => Admin.master(),
    admin_absensi_ustadz: () => Admin.absensiUstadz(),
    admin_riwayat: () => Admin.riwayat(),
    admin_laporan: () => Admin.laporan(),
    admin_rekap_setoran: () => Admin.rekapSetoran(),
    admin_notif: () => Admin.notif(),
    admin_settings: () => Admin.settings(),
    // Ustadz
    ustadz_dashboard: () => Ustadz.dashboard(),
    ustadz_absensi: () => Ustadz.absensi(),
    ustadz_talim: () => Ustadz.talim(),
    ustadz_talim_absensi: () => Ustadz.absensi('Ta’lim Malam'),
    ustadz_pembelajaran: () => Ustadz.pembelajaran(),
    ustadz_riwayat: () => Ustadz.riwayat(),
    ustadz_laporan: () => Ustadz.laporan(),
    ustadz_notif: () => Ustadz.notif(),
    // Wali
    wali_dashboard: () => Wali.dashboard(),
    wali_perkembangan: () => Wali.perkembangan(),
    wali_absensi: () => Wali.absensi(),
    wali_catatan: () => Wali.catatan(),
    wali_profil: () => Wali.profil(),
    // Al-Qur'an reader (shared, no login required)
    quran: () => Quran.open()
  };

  const defaultRoute = {
    admin: 'admin_dashboard',
    ustadz: 'ustadz_dashboard',
    wali: 'wali_dashboard'
  };

  let current = null;
  let tableObserverStarted = false;

  // Tables remain semantic on desktop and become labeled cards on small screens.
  // Labels are inferred from their table headers, so all existing views benefit.
  function enhanceTables(root = document) {
    root.querySelectorAll('.clay-table').forEach(table => {
      const labels = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
      table.querySelectorAll('tbody tr').forEach(row => {
        [...row.children].forEach((cell, index) => {
          if (cell.tagName === 'TD') cell.dataset.label = labels[index] || '';
        });
      });
    });
  }

  function startTableEnhancer() {
    if (tableObserverStarted) return;
    const root = document.getElementById('app');
    if (!root) return;
    tableObserverStarted = true;
    new MutationObserver(() => enhanceTables(root)).observe(root, { childList: true, subtree: true });
  }

  function historyUrl(view) {
    return window.location.pathname + window.location.search + '#' + view;
  }

  function navigate(view, options = {}) {
    if (!routes[view]) view = defaultRoute[Store.getSession().role] || 'admin_dashboard';
    // Setiap perpindahan menu dicatat agar tombol Back perangkat kembali ke
    // halaman sebelumnya di aplikasi, bukan langsung keluar dari web.
    if (!options.fromHistory && current !== view) {
      window.history.pushState({ tahfidzView: view }, '', historyUrl(view));
    }
    if (view !== 'quran') document.body.classList.remove('q-reading-fullscreen');
    current = view;
    try {
      routes[view]();
      enhanceTables(document.getElementById('app'));
    } catch (e) {
      console.error('Render error:', e);
      UI.toast('Terjadi kesalahan pada halaman', 'error');
    }
    // close mobile sidebar
    const sb = document.getElementById('sidebar'); const sc = document.getElementById('scrim');
    if (sb) sb.classList.remove('open'); if (sc) sc.classList.remove('show');
    document.body.classList.remove('nav-open');
  }

  async function start() {
    startTableEnhancer();
    const session = Store.getSession();
    if (!session) { Auth.renderLogin(); return; }
    const role = session.role;
    if (!defaultRoute[role]) { Auth.renderLogin(); return; }
    try {
      await Store.load();
    } catch (e) {
      // token invalid or server unreachable -> back to login
      Auth.renderLogin();
      return;
    }
    setFavicon();
    const hashView = window.location.hash.slice(1);
    const initialView = routes[hashView] ? hashView : defaultRoute[role];
    // Halaman pertama adalah akar riwayat aplikasi, bukan entri tambahan.
    window.history.replaceState({ tahfidzView: initialView }, '', historyUrl(initialView));
    navigate(initialView, { fromHistory: true });
  }

  window.addEventListener('popstate', event => {
    const session = Store.getSession();
    if (!session) return;
    const view = event.state?.tahfidzView || window.location.hash.slice(1) || defaultRoute[session.role];
    // Menutup modal tidak perlu merender ulang menu yang sama.
    if (view !== current) navigate(view, { fromHistory: true });
  });

  return { start, navigate };
})();

function setFavicon(dataUrl) {
  const link = document.getElementById('favicon');
  if (!link) return;
  if (dataUrl) { link.href = dataUrl; return; }
  const db = Store.get();
  const logo = db.settings && db.settings.logo;
  if (logo) link.href = logo;
}

// Init datalist & boot
function initDatalist() {
  const dl = document.getElementById('dl-surah');
  if (dl) dl.innerHTML = SURAHS.map(s => `<option value="${s.n}. ${s.latin}">${s.n}. ${s.latin} (${s.arab})</option>`).join('');
}
window.addEventListener('DOMContentLoaded', () => { initDatalist(); App.start(); });
