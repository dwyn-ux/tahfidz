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
    admin_riwayat: () => Admin.riwayat(),
    admin_laporan: () => Admin.laporan(),
    admin_notif: () => Admin.notif(),
    admin_settings: () => Admin.settings(),
    // Ustadz
    ustadz_dashboard: () => Ustadz.dashboard(),
    ustadz_absensi: () => Ustadz.absensi(),
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

  function navigate(view) {
    if (!routes[view]) view = defaultRoute[Store.getSession().role] || 'admin_dashboard';
    current = view;
    try {
      routes[view]();
    } catch (e) {
      console.error('Render error:', e);
      UI.toast('Terjadi kesalahan pada halaman', 'error');
    }
    // close mobile sidebar
    const sb = document.getElementById('sidebar'); const sc = document.getElementById('scrim');
    if (sb) sb.classList.remove('open'); if (sc) sc.classList.remove('show');
  }

  async function start() {
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
    navigate(defaultRoute[role]);
  }

  return { start, navigate };
})();

// Init datalist & boot
function initDatalist() {
  const dl = document.getElementById('dl-surah');
  if (dl) dl.innerHTML = SURAHS.map(s => `<option value="${s.n}. ${UI.esc(s.latin)}">${s.n}. ${UI.esc(s.latin)} (${s.arab})</option>`).join('');
}
window.addEventListener('DOMContentLoaded', () => { initDatalist(); App.start(); });
