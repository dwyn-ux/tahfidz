/* ============================================================
   Tahfidzku — Data Store (API-backed, PHP + MySQL)
   Frontend keeps an in-memory `db` hydrated from the server.
   Mutations update memory immediately; Store.save() persists
   the whole db to the server (fire-and-forget). The public API
   matches the old localStorage version so views need no change.
   ============================================================ */
const API_BASE = 'api/index.php';
const TOKEN_KEY = 'tahfidzku_token_v1';

const Store = (() => {
  let db = defaultDB();
  let busy = false;

  function defaultDB() {
    return {
      settings: {
        namaLembaga: 'Rumah Tahfidz Al-Hikmah', alamat: 'Jl. Pendidikan No. 10, Jakarta',
        tahunAjaran: '2025/2026', semester: 'Ganjil',
        standarPenilaian: 'A (90-100), B (80-89), C (70-79), D (<70)',
        jamBelajar: '07:00 - 09:00', tema: 'Claymorphism',
        defaultPasswordFormat: '12345678', logo: '', setoranMulti: false,
        juzOrder: [30,29,28,27,26,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],
        notifActive: true, notifMaxPerDay: 3, notifWali: true, notifUstadz: true
      },
      users: [], santri: [], wali: [], ustadz: [], halaqah: [],
      kelas: ['TK Al-Qur\'an', 'SD', 'SMP', 'SMA'],
      levelTahfidz: ['Tahsin', 'Ziyadah', 'Mutqin'],
      kehadiran: [], tahsin: [], ziyadahBacaan: [], ziyadahHafalan: [], mutqin: [], catatan: [],
      tahunAjaran: ['2024/2025', '2025/2026', '2026/2027'], semester: ['Ganjil', 'Genap'],
      notifikasi: [], logAktivitas: [], setoranNotif: []
    };
  }

  /* ---------- fetch helper ---------- */
  async function api(action, opts = {}) {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(API_BASE + '?action=' + action, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      const msg = (data && data.error) ? data.error : ('HTTP ' + res.status);
      throw new Error(msg);
    }
    return data;
  }

  /* ---------- Session (JWT token) ---------- */
  function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }
  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function getSession() {
    const t = getToken();
    if (!t) return null;
    const parts = t.split('.');
    if (parts.length !== 2) return null;
    try {
      const p = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
      if (!p.exp || p.exp < Math.floor(Date.now() / 1000)) return null;
      return { userId: p.uid, role: p.role, refId: p.refId };
    } catch (e) { return null; }
  }
  function clearSession() { setToken(null); }

  /* ---------- Auth ---------- */
  async function login(username, password) {
    try {
      const data = await api('login', { method: 'POST', body: { username, password } });
      setToken(data.token);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, msg: e.message || 'Login gagal.' };
    }
  }
  function logout() { clearSession(); }

  /* ---------- Bootstrap (load all data) ---------- */
  async function load() {
    try {
      const data = await api('bootstrap');
      db = Object.assign(defaultDB(), data.db);
      return db;
    } catch (e) {
      if (String(e.message).includes('Unauthorized') || String(e.message).includes('401')) {
        clearSession();
      }
      throw e;
    }
  }

  function get() { return db; }
  function save() {
    if (busy) return Promise.resolve();
    busy = true;
    return api('save', { method: 'POST', body: db })
      .catch(err => { console.warn('save failed', err); if (UI && UI.toast) UI.toast('Gagal menyimpan ke server', 'error'); })
      .finally(() => { busy = false; });
  }

  function reset() {
    return api('reset', { method: 'POST' }).then(() => load());
  }

  function uid(prefix) { return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }
  function nowISO() { return new Date().toISOString(); }
  function todayStr() { return new Date().toISOString().slice(0, 10); }

  function log(aksi) {
    const s = getSession();
    db.logAktivitas.unshift({ id: uid('log'), userId: s ? s.userId : null, aksi, tanggal: nowISO() });
    if (db.logAktivitas.length > 200) db.logAktivitas.length = 200;
    save();
  }

  function recalcHalaqah() {
    db.halaqah.forEach(h => { h.jumlahSantri = db.santri.filter(s => s.halaqah === h.nama).length; });
  }

  /* ---------- Helpers (operate on in-memory db) ---------- */
  function findSantri(id) { return db.santri.find(s => s.id === id); }
  function findWali(id) { return db.wali.find(w => w.id === id); }
  function findUstadz(id) { return db.ustadz.find(u => u.id === id); }
  function findUstadzByName(name) { return db.ustadz.find(u => u.nama === name); }
  function findHalaqahByName(name) { return db.halaqah.find(h => h.nama === name); }

  function search(q) {
    const s = q.toLowerCase().trim();
    if (!s || s.length < 1) return { santri: [], wali: [], ustadz: [], halaqah: [], users: [], surah: [] };
    return {
      santri: db.santri.filter(x => (x.nama + ' ' + x.nis).toLowerCase().includes(s)),
      wali: db.wali.filter(x => x.nama.toLowerCase().includes(s)),
      ustadz: db.ustadz.filter(x => x.nama.toLowerCase().includes(s)),
      halaqah: db.halaqah.filter(x => x.nama.toLowerCase().includes(s)),
      users: db.users.filter(x => x.username.toLowerCase().includes(s)),
      surah: SURAHS.filter(x => x.latin.toLowerCase().includes(s) || x.arab.toLowerCase().includes(s)).slice(0, 10)
    };
  }

  function lastZiyadah(santriId) {
    const haf = db.ziyadahHafalan.filter(z => z.santriId === santriId);
    const bac = db.ziyadahBacaan.filter(z => z.santriId === santriId);
    const all = [...haf, ...bac].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || (b.id > a.id ? 1 : -1));
    return all[0] || null;
  }

  function totalHafalanSantri(santriId) {
    let ayahs = 0, pages = 0, juzMin = 30, juzMax = 1;
    const add = (rec) => {
      const h = computeHafalan(rec.sAwal, rec.aAwal, rec.sAkhir, rec.aAkhir);
      if (h) { ayahs += h.ayahs; pages += h.pages; juzMin = Math.min(juzMin, h.juzStart); juzMax = Math.max(juzMax, h.juzEnd); }
    };
    db.ziyadahHafalan.filter(z => z.santriId === santriId).forEach(add);
    db.mutqin.filter(m => m.santriId === santriId).forEach(add);
    if (ayahs === 0) return null;
    return { ayahs, pages, juzStart: juzMin, juzEnd: juzMax, juzRange: juzMax - juzMin + 1 };
  }

  function avgNilai(santriId) {
    const vals = [];
    db.tahsin.filter(t => t.santriId === santriId).forEach(t => vals.push(t.nilai));
    db.ziyadahHafalan.filter(z => z.santriId === santriId).forEach(z => vals.push(z.nilai));
    db.mutqin.filter(m => m.santriId === santriId).forEach(m => vals.push(m.nilai));
    if (!vals.length) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  function kehadiranBulan(santriId, bulan) {
    return db.kehadiran.filter(k => k.santriId === santriId && k.tanggal.startsWith(bulan));
  }

  function addNotif(userId, tipe, pesan) {
    db.notifikasi.unshift({ id: uid('n'), userId, tipe, pesan, tanggal: nowISO(), read: false });
    save();
  }
  function notifFor(userId) { return db.notifikasi.filter(n => n.userId === userId); }

  /* ---------- Cek setoran terlewat ----------
     Aturan: tiap santri wajib setoran 1x per hari kerja (Senin-Jumat).
     Jika pada hari berikutnya santri belum setoran di hari kerja tsb,
     notifikasi dikirim ke akun wali (ortu) & ustadz pengampu halaqah.
     Agar tidak duplikat, pasangan (santriId|tanggal) disimpan di db.setoranNotif. */
  function isHariKerja(d) { const h = d.getDay(); return h >= 1 && h <= 5; } // 1=Sen, 5=Jum

  function checkSetoranTerlewat() {
    if (!db.settings.notifActive) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (!db.setoranNotif) db.setoranNotif = [];
    const sudah = (sid, tgl) => db.setoranNotif.some(x => x.santriId === sid && x.tanggal === tgl);
    const tandai = (sid, tgl) => { if (!sudah(sid, tgl)) db.setoranNotif.push({ santriId: sid, tanggal: tgl }); };
    const maxNotif = db.settings.notifMaxPerDay || 3;
    let notifCount = 0;

    db.santri.filter(s => s.status === 'Aktif').forEach(s => {
      const kemarin = new Date(today); kemarin.setDate(kemarin.getDate() - 1);
      const mulai = new Date(kemarin); mulai.setDate(mulai.getDate() - 6);
      const cek = new Date(mulai);
      while (cek <= kemarin) {
        if (isHariKerja(cek)) {
          const tgl = cek.toISOString().slice(0, 10);
          if (!sudah(s.id, tgl) && notifCount < maxNotif) {
            const adaSetoran = db.ziyadahHafalan.some(z => z.santriId === s.id && z.tanggal === tgl)
              || db.ziyadahBacaan.some(z => z.santriId === s.id && z.tanggal === tgl)
              || db.tahsin.some(z => z.santriId === s.id && z.tanggal === tgl);
            if (!adaSetoran) {
              const wUser = db.settings.notifWali && db.users.find(u => u.role === 'wali' && u.refId === s.waliId);
              const hObj = Store.findHalaqahByName(s.halaqah);
              const uObj = hObj ? Store.findUstadzByName(hObj.ustadz) : null;
              const uUser = db.settings.notifUstadz && uObj ? db.users.find(u => u.role === 'ustadz' && u.refId === uObj.id) : null;
              const tglTxt = UI.fmtDate(tgl);
              const pesan = ' ' + s.nama + ' belum setoran pada ' + tglTxt + '. Mohon dampingi anak untuk setoran.';
              const pesanU = s.nama + ' belum setoran pada ' + tglTxt + '.';
              if (wUser && !db.notifikasi.some(n => n.userId === wUser.id && n.pesan === pesan)) { addNotif(wUser.id, 'wali', pesan); notifCount++; }
              if (uUser && !db.notifikasi.some(n => n.userId === uUser.id && n.pesan === pesanU)) { addNotif(uUser.id, 'ustadz', pesanU); notifCount++; }
              tandai(s.id, tgl);
            }
          }
        }
        cek.setDate(cek.getDate() + 1);
      }
    });
    save();
  }

  return {
    load, save, get, reset, uid, log, nowISO, todayStr,
    setToken, getToken, setSession: () => {}, getSession, clearSession, login, logout,
    recalcHalaqah, findSantri, findWali, findUstadz, findUstadzByName, findHalaqahByName, search,
    lastZiyadah, totalHafalanSantri, avgNilai, kehadiranBulan, addNotif, notifFor, checkSetoranTerlewat
  };
})();
