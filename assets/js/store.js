/* ============================================================
   Tahfidzku — Data Store (API-backed, PHP + MySQL)
   Frontend keeps an in-memory `db` hydrated from the server.
   Mutations update memory immediately; Store.save() persists only
   the changed records to the server. The public API matches the
   old localStorage version so views need no change.
   ============================================================ */
const API_BASE = 'api/index.php';
const TOKEN_KEY = 'tahfidzku_token_v1';

const Store = (() => {
  const DEFAULT_TINGKAT = ['TPQ', 'SD', 'SMP', 'SMA'];
  const DEFAULT_KELAS_PER_TINGKAT = {
    TPQ: ['1', '2', '3', '4', '5', '6'],
    SD: ['1', '2', '3', '4', '5', '6'],
    SMP: ['7', '8', '9'],
    SMA: ['10', '11', '12']
  };
  let db = defaultDB();
  let saveChain = Promise.resolve();
  // Salinan data terakhir yang dimuat/disimpan. Ini dipakai agar browser
  // hanya mengirim perubahan, bukan menimpa seluruh database dengan cache
  // yang mungkin sudah tertinggal dari perangkat lain.
  let persisted = null;
  const recordTypes = ['santri', 'wali', 'ustadz', 'halaqah', 'kehadiran', 'absensiUstadz', 'jurnalTalim', 'tahsin', 'ziyadahBacaan', 'ziyadahHafalan', 'mutqin', 'catatan', 'notifikasi', 'logAktivitas', 'logWa'];

  function defaultDB() {
    return {
      settings: {
        namaLembaga: 'Rumah Tahfidz Al-Hikmah', alamat: 'Jl. Pendidikan No. 10, Jakarta',
        tahunAjaran: '2025/2026', semester: 'Ganjil',
        standarPenilaian: 'A (90-100), B (80-89), C (70-79), D (<70)',
        jamBelajar: '07:00 - 09:00', tema: 'Claymorphism',
        defaultPasswordFormat: '12345678', logo: '', setoranMulti: false,
        tingkat: DEFAULT_TINGKAT.slice(), kelasPerTingkat: Object.assign({}, DEFAULT_KELAS_PER_TINGKAT), talimMapel: [],
        talimMalam: { ustadzIds: [], judulKitab: '', bab: '' },
        juzOrder: [30,29,28,27,26,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],
        notifActive: true, notifMaxPerDay: 3, notifWali: true, notifUstadz: true,
        notifAbsensiWali: true, notifAbsensiPeriode: 'harian',
        waBridgeUrl: '', waBridgeKey: '', waAuto: false
      },
      users: [], santri: [], wali: [], ustadz: [], halaqah: [],
      tingkat: DEFAULT_TINGKAT.slice(), kelas: [],
      levelTahfidz: ['Tahsin', 'Ziyadah', 'Mutqin'],
      kehadiran: [], absensiUstadz: [], jurnalTalim: [], tahsin: [], ziyadahBacaan: [], ziyadahHafalan: [], mutqin: [], catatan: [],
      tahunAjaran: ['2024/2025', '2025/2026', '2026/2027'], semester: ['Ganjil', 'Genap'],
      notifikasi: [], logAktivitas: [], logWa: [], setoranNotif: []
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
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    if (!res.ok) {
      const msg = (data && data.error) ? data.error : ('HTTP ' + res.status + (text ? ' — ' + text.slice(0, 150) : ''));
      throw new Error(msg);
    }
    if (!data) {
      throw new Error('Respons server tidak valid (bukan JSON): ' + (text.slice(0, 150) || '(kosong)'));
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
  function logout() {
    clearSession();
    // Hilangkan hash menu dari sesi sebelumnya agar akun berikutnya tidak
    // mewarisi tautan seperti #admin_rekap_setoran saat login.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  async function changePassword(oldPass, newPass) {
    try {
      await api('password', { method: 'POST', body: { old: oldPass, new: newPass } });
      // Do NOT store plaintext password in memory — just mark as changed
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: e.message || 'Gagal ganti password.' };
    }
  }

  /* ---------- Bootstrap (load all data) ---------- */
  async function load() {
    try {
      const data = await api('bootstrap');
      db = Object.assign(defaultDB(), data.db);
      // Pengaturan dari server bisa berasal dari versi lama yang belum memiliki
      // daftar tingkat/kelas atau daftar mapel Ta’lim. Lengkapi agar tab
      // Pengaturan dan filter laporan selalu punya pilihan yang valid.
      normalizeSettings();
      // Data lama hanya memiliki satu `level` dan `halaqah`. Normalisasi ini
      // menjadikannya satu program aktif, tanpa mengubah arti data lamanya.
      // Data baru dapat menyimpan beberapa program sekaligus, misalnya Tahsin
      // dan Ziyadah, masing-masing dengan halaqah yang berbeda.
      db.santri = (db.santri || []).map(santri => normalizeSantriEducation(normalizeSantriPrograms(santri)));
      // Data absensi dari versi awal belum memiliki sesi. Anggap sebagai
      // Subuh supaya tetap muncul di rekap, lalu semua input baru memakai
      // sesi yang eksplisit.
      db.kehadiran = (db.kehadiran || []).map(k => k.sesi ? k : Object.assign({}, k, { sesi: 'Subuh' }));
      db.absensiUstadz = db.absensiUstadz || [];
      db.jurnalTalim = db.jurnalTalim || [];
      persisted = snapshot(db);
      return db;
    } catch (e) {
      if (String(e.message).includes('Unauthorized') || String(e.message).includes('401')) {
        clearSession();
      }
      throw e;
    }
  }

  function get() { return db; }

  function snapshot(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sameValue(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function recordsById(records) {
    return (records || []).reduce((map, record) => {
      if (record && record.id) map[record.id] = record;
      return map;
    }, {});
  }

  // Bentuk payload perubahan (upsert/hapus) terhadap snapshot terakhir.
  // Baris yang tidak disentuh tidak pernah dikirim, sehingga simpan dari
  // perangkat/sesi lain tidak dapat menghapus data baru secara tidak sengaja.
  function changesSincePersisted() {
    const before = persisted || defaultDB();
    const records = {};
    recordTypes.forEach(type => {
      const oldRows = recordsById(before[type]);
      const newRows = recordsById(db[type]);
      const upsert = Object.keys(newRows)
        .filter(id => !oldRows[id] || !sameValue(oldRows[id], newRows[id]))
        .map(id => newRows[id]);
      const remove = Object.keys(oldRows).filter(id => !newRows[id]);
      if (upsert.length || remove.length) records[type] = { upsert, remove };
    });

    const changes = { records };
    if (!sameValue(before.settings, db.settings)) changes.settings = db.settings;

    const oldUsers = recordsById(before.users);
    const newUsers = recordsById(db.users);
    const upsertUsers = Object.keys(newUsers)
      .filter(id => !oldUsers[id] || !sameValue(oldUsers[id], newUsers[id]))
      .map(id => newUsers[id]);
    const removeUsers = Object.keys(oldUsers).filter(id => !newUsers[id]);
    if (upsertUsers.length || removeUsers.length) changes.users = { upsert: upsertUsers, remove: removeUsers };

    return Object.keys(records).length || changes.settings || changes.users ? changes : null;
  }

  // Setiap percobaan pengiriman dicatat ke db.logWa (queued/skipped/error).
  function waLog(entry) {
    if (!db.logWa) db.logWa = [];
    db.logWa.unshift(Object.assign({ id: uid('wa'), tanggal: nowISO(), message: entry.message ? String(entry.message).slice(0, 150) : '' }, entry));
    if (db.logWa.length > 100) db.logWa.length = 100;
    save();
  }

  // Kirim pesan WhatsApp lewat API, bukan langsung ke bridge. Kredensial bridge
  // hanya dipegang server sehingga ustadz (dan wali) tidak pernah melihat kunci,
  // dan mereka tetap bisa mengirim laporan ke wali.
  function waSend(to, message) {
    if (!to) { waLog({ to: null, status: 'skipped', detail: 'Nomor tujuan kosong' }); return Promise.resolve(false); }
    if (!message) { waLog({ to, status: 'skipped', detail: 'Pesan kosong' }); return Promise.resolve(false); }
    return api('wa&op=send', { method: 'POST', body: { to, message } }).then(r => {
      const detail = (r && r.detail) || 'Pesan masuk antrian bridge.';
      waLog({ to, status: r && r.ok ? 'queued' : 'error', detail, message });
      return !!(r && r.ok);
    }).catch(e => {
      waLog({ to, status: 'error', detail: 'Gagal: ' + (e && e.message || e), message });
      return false;
    });
  }

  // Status koneksi bridge untuk ditampilkan di Settings (khusus admin).
  function waStatus() {
    return api('wa&op=status').then(r => (r && r.data) || null);
  }

  // QR pairing juga lewat API (endpoint itu butuh Authorization header), lalu
  // dikembalikan sebagai object URL supaya bisa dipakai sebagai <img src>.
  function waQrDataUrl() {
    const token = getToken();
    return fetch(API_BASE + '?action=wa&op=qr', {
      headers: token ? { Authorization: 'Bearer ' + token } : {}
    }).then(async r => {
      if (!r.ok) {
        let msg = 'HTTP ' + r.status;
        try { const d = await r.json(); msg = d.error || msg; } catch (e) { /* biarkan msg default */ }
        throw new Error(msg);
      }
      return URL.createObjectURL(await r.blob());
    });
  }

  function waReady() { return !!(db.settings && db.settings.waBridgeUrl); }

  // Pengaturan dari backup/versi lama kadang tersimpan sebagai string, misalnya
  // "false". Jangan perlakukan nilai teks tersebut sebagai aktif karena bersifat
  // truthy di JavaScript.
  function waAutoEnabled() {
    const value = db.settings && db.settings.waAuto;
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  // Kirim laporan ke no. WA wali dari santri (auto jika waAuto aktif). Fire-and-forget.
  function waSendWali(santriId, message) {
    const s = db.santri.find(x => x.id === santriId);
    if (!s) { waLog({ to: null, status: 'skipped', detail: 'Santri tidak ditemukan', message }); return Promise.resolve(false); }
    if (!waAutoEnabled()) { waLog({ to: s.noHpWali, status: 'skipped', detail: 'WhatsApp Otomatis nonaktif', message }); return Promise.resolve(false); }
    if (!s.noHpWali) { waLog({ to: null, status: 'skipped', detail: 'Santri tanpa no. HP wali', message }); return Promise.resolve(false); }
    return waSend(s.noHpWali, message);
  }
  function save() {
    const changes = changesSincePersisted();
    if (!changes) return Promise.resolve(true);
    // Ambil snapshot agar perubahan cepat berurutan dikirim satu per satu.
    const savedSnapshot = snapshot(db);
    const payload = { changes: snapshot(changes) };
    // Password plaintext hanya perlu ada pada payload sekali; jangan biarkan
    // tersisa di memori aplikasi setelah permintaan dibuat.
    (db.users || []).forEach(user => { if (Object.prototype.hasOwnProperty.call(user, 'password')) delete user.password; });
    (savedSnapshot.users || []).forEach(user => { if (Object.prototype.hasOwnProperty.call(user, 'password')) delete user.password; });
    const request = saveChain.catch(() => undefined).then(() =>
      api('save', { method: 'POST', body: payload }).then(() => {
        persisted = savedSnapshot;
        return true;
      })
    );
    // Rantai berikutnya tetap dapat berjalan setelah satu kegagalan.
    saveChain = request.catch(() => undefined);
    return request.catch(err => {
      console.warn('save failed', err);
      if (UI && UI.toast) UI.toast('Gagal menyimpan ke server. Coba simpan lagi.', 'error');
      return false;
    });
  }

  function reset() {
    return api('reset', { method: 'POST' }).then(() => load());
  }

  function uid(prefix) { return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9); }
  function nowISO() { return new Date().toISOString(); }
  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function log(aksi) {
    const s = getSession();
    db.logAktivitas.unshift({ id: uid('log'), userId: s ? s.userId : null, aksi, tanggal: nowISO() });
    if (db.logAktivitas.length > 200) db.logAktivitas.length = 200;
    save();
  }

  function recalcHalaqah() {
    db.halaqah.forEach(h => { h.jumlahSantri = db.santri.filter(s => santriHasHalaqah(s, h)).length; });
  }

  /* ---------- Helpers (operate on in-memory db) ---------- */
  function findSantri(id) { return db.santri.find(s => s.id === id); }
  function findWali(id) { return db.wali.find(w => w.id === id); }
  function findUstadz(id) { return db.ustadz.find(u => u.id === id); }
  function findUstadzByName(name) { return db.ustadz.find(u => u.nama === name); }
  function findHalaqahById(id) { return db.halaqah.find(h => h.id === id); }
  function findHalaqahByName(name) { return db.halaqah.find(h => h.nama === name); }

  function availablePrograms() {
    return (db.levelTahfidz || ['Tahsin', 'Ziyadah', 'Mutqin']).filter(Boolean);
  }

  function normalizeProgramList(programs, fallback) {
    const available = availablePrograms();
    const requested = Array.isArray(programs) ? programs : [];
    const clean = [...new Set(requested.filter(program => available.includes(program)))];
    return clean.length ? clean : (available.includes(fallback) ? [fallback] : []);
  }

  function resolveHalaqah(reference) {
    if (!reference) return null;
    return findHalaqahById(reference) || findHalaqahByName(reference) || null;
  }

  // Bentuk data baru:
  // programAktif: ['Tahsin', 'Ziyadah']
  // halaqahProgram: { Tahsin: '<id halaqah>', Ziyadah: '<id halaqah>' }
  // Program menentukan jenis setoran, sedangkan halaqah menentukan kelompok
  // belajar. Keduanya sengaja tidak harus memiliki level yang sama; misalnya
  // setoran Ziyadah dapat ditempatkan di halaqah berlevel Mutqin.
  // Kolom `level` dan `halaqah` tetap dipertahankan sebagai program utama
  // supaya laporan dan data dari versi sebelumnya tetap kompatibel.
  function normalizeSantriPrograms(santri) {
    if (!santri) return santri;
    const programs = normalizeProgramList(santri.programAktif, santri.level);
    const assignments = (santri.halaqahProgram && typeof santri.halaqahProgram === 'object' && !Array.isArray(santri.halaqahProgram))
      ? Object.assign({}, santri.halaqahProgram) : {};
    const primary = programs.includes(santri.level) ? santri.level : (programs[0] || santri.level || 'Tahsin');
    if (!assignments[primary] && santri.halaqah) {
      const legacyHalaqah = findHalaqahByName(santri.halaqah);
      assignments[primary] = legacyHalaqah ? legacyHalaqah.id : santri.halaqah;
    }
    santri.programAktif = programs.length ? programs : [primary];
    santri.halaqahProgram = assignments;
    santri.level = primary;
    return santri;
  }

  function activeProgramsForSantri(santri) {
    if (!santri) return [];
    return normalizeProgramList(santri.programAktif, santri.level);
  }

  function halaqahForSantriProgram(santri, program) {
    if (!santri || !program) return null;
    const assignments = santri.halaqahProgram && typeof santri.halaqahProgram === 'object' ? santri.halaqahProgram : {};
    const assigned = resolveHalaqah(assignments[program]);
    if (assigned) return assigned;
    return santri.level === program ? findHalaqahByName(santri.halaqah) : null;
  }

  function halaqahForSantri(santri) {
    if (!santri) return [];
    const seen = new Set();
    return activeProgramsForSantri(santri)
      .map(program => halaqahForSantriProgram(santri, program))
      .filter(halaqah => {
        if (!halaqah || seen.has(halaqah.id)) return false;
        seen.add(halaqah.id);
        return true;
      });
  }

  function santriHasProgram(santri, program) {
    return activeProgramsForSantri(santri).includes(program);
  }

  function santriHasHalaqah(santri, halaqah, program) {
    if (!santri || !halaqah) return false;
    const target = typeof halaqah === 'string' ? (findHalaqahById(halaqah) || findHalaqahByName(halaqah)) : halaqah;
    if (!target) return false;
    if (program) {
      const assigned = halaqahForSantriProgram(santri, program);
      return !!assigned && assigned.id === target.id;
    }
    return halaqahForSantri(santri).some(item => item.id === target.id)
      || santri.halaqah === target.nama;
  }

  function programsForSantriHalaqah(santri, halaqah) {
    if (!santri || !halaqah) return [];
    const target = typeof halaqah === 'string' ? (findHalaqahById(halaqah) || findHalaqahByName(halaqah)) : halaqah;
    if (!target) return [];
    return activeProgramsForSantri(santri)
      .filter(program => santriHasHalaqah(santri, target, program));
  }

  function configureSantriPrograms(santri, programs, halaqahProgram, primaryProgram) {
    if (!santri) return;
    const active = normalizeProgramList(programs, primaryProgram || santri.level);
    const assignments = {};
    active.forEach(program => {
      const halaqah = resolveHalaqah(halaqahProgram && halaqahProgram[program]);
      if (halaqah) assignments[program] = halaqah.id;
    });
    const primary = active.includes(primaryProgram) ? primaryProgram : active[0];
    const primaryHalaqah = halaqahForProgramAssignment(assignments, primary);
    santri.programAktif = active;
    santri.halaqahProgram = assignments;
    santri.level = primary;
    santri.halaqah = primaryHalaqah ? primaryHalaqah.nama : '';
  }

  function halaqahForProgramAssignment(assignments, program) {
    return program ? resolveHalaqah(assignments[program]) : null;
  }

  function programSummaryForSantri(santri, separator) {
    return activeProgramsForSantri(santri).join(separator || ' · ');
  }

  function halaqahSummaryForSantri(santri, separator) {
    const joiner = separator || ' · ';
    return activeProgramsForSantri(santri).map(program => {
      const halaqah = halaqahForSantriProgram(santri, program);
      return halaqah ? program + ': ' + halaqah.nama : program + ': -';
    }).join(joiner);
  }

  // Halaqah lama menyimpan satu `ustadzId`/`ustadz`. Data baru boleh
  // menyimpan beberapa pengampu tanpa memaksa data lama dimigrasikan ulang.
  function ustadzIdsForHalaqah(halaqah) {
    if (!halaqah) return [];
    const ids = Array.isArray(halaqah.ustadzIds) ? halaqah.ustadzIds.slice() : [];
    if (halaqah.ustadzId) ids.unshift(halaqah.ustadzId);
    if (!ids.length && halaqah.ustadz) {
      const legacy = findUstadzByName(halaqah.ustadz);
      if (legacy) ids.push(legacy.id);
    }
    return [...new Set(ids)].filter(id => !!findUstadz(id));
  }

  function ustadzNamesForHalaqah(halaqah) {
    const byId = ustadzIdsForHalaqah(halaqah).map(id => findUstadz(id)?.nama).filter(Boolean);
    if (byId.length) return byId;
    const stored = Array.isArray(halaqah?.ustadzNames) ? halaqah.ustadzNames.filter(Boolean) : [];
    if (stored.length) return [...new Set(stored)];
    return halaqah?.ustadz ? [halaqah.ustadz] : [];
  }

  function halaqahHasUstadz(halaqah, ustadz) {
    if (!halaqah || !ustadz) return false;
    return ustadzIdsForHalaqah(halaqah).includes(ustadz.id)
      || halaqah.ustadzId === ustadz.id
      || halaqah.ustadz === ustadz.nama;
  }

  function findHalaqahForUstadz(ustadz) {
    if (!ustadz) return null;
    return db.halaqah.find(h => halaqahHasUstadz(h, ustadz))
      || db.halaqah.find(h => h.nama === ustadz.halaqah)
      || null;
  }

  function normalizeSettings() {
    const settings = db.settings || (db.settings = {});
    if (!Array.isArray(settings.tingkat) || !settings.tingkat.filter(Boolean).length) {
      settings.tingkat = DEFAULT_TINGKAT.slice();
    } else {
      settings.tingkat = settings.tingkat.filter(Boolean);
    }
    if (!settings.kelasPerTingkat || typeof settings.kelasPerTingkat !== 'object' || Array.isArray(settings.kelasPerTingkat)) {
      settings.kelasPerTingkat = Object.assign({}, DEFAULT_KELAS_PER_TINGKAT);
    } else {
      settings.tingkat.forEach(name => {
        const values = settings.kelasPerTingkat[name];
        settings.kelasPerTingkat[name] = (Array.isArray(values) && values.length ? values : (DEFAULT_KELAS_PER_TINGKAT[name] || []))
          .map(String).filter(Boolean);
      });
    }
    if (!Array.isArray(settings.talimMapel)) settings.talimMapel = [];
    settings.talimMapel = settings.talimMapel.filter(item => item && item.id && item.nama)
      .map(item => ({ id: item.id, nama: String(item.nama) }));
    if (!settings.talimMalam || typeof settings.talimMalam !== 'object' || Array.isArray(settings.talimMalam)) settings.talimMalam = {};
    settings.talimMalam.ustadzIds = Array.isArray(settings.talimMalam.ustadzIds) ? settings.talimMalam.ustadzIds.filter(Boolean) : [];
    settings.talimMalam.judulKitab = String(settings.talimMalam.judulKitab || '');
    settings.talimMalam.bab = String(settings.talimMalam.bab || '');
    return settings;
  }

  // Pengaturan Ta'lim Malam: ustadz pengampu + materi default untuk jurnal.
  function talimMalamSettings() {
    normalizeSettings();
    const value = db.settings.talimMalam;
    return {
      ustadzIds: value.ustadzIds.filter(id => db.ustadz.some(u => u.id === id)),
      judulKitab: value.judulKitab,
      bab: value.bab
    };
  }

  function educationSettings() {
    const settings = db.settings || {};
    const tingkat = Array.isArray(settings.tingkat) && settings.tingkat.length
      ? settings.tingkat.filter(Boolean)
      : DEFAULT_TINGKAT.slice();
    const source = settings.kelasPerTingkat && typeof settings.kelasPerTingkat === 'object'
      ? settings.kelasPerTingkat : DEFAULT_KELAS_PER_TINGKAT;
    const kelasPerTingkat = {};
    tingkat.forEach(name => {
      const values = Array.isArray(source[name]) && source[name].length ? source[name] : (DEFAULT_KELAS_PER_TINGKAT[name] || []);
      kelasPerTingkat[name] = values.map(String).filter(Boolean);
    });
    return { tingkat, kelasPerTingkat };
  }

  function tingkatOptions() { return educationSettings().tingkat; }
  function kelasOptions(tingkat) { return educationSettings().kelasPerTingkat[tingkat] || []; }

  function tingkatForSantri(santri) {
    if (!santri) return '';
    const available = tingkatOptions();
    if (available.includes(santri.tingkat)) return santri.tingkat;
    const legacy = String(santri.kelas || '').trim();
    if (legacy === 'TK Al-Qur\'an' || legacy === 'TK Alquran' || legacy === 'TKQ') return 'TPQ';
    return available.includes(legacy) ? legacy : '';
  }

  function kelasForSantri(santri) {
    if (!santri) return '';
    const stored = String(santri.kelas || '').trim();
    const legacyTingkat = tingkatOptions().includes(stored) || ['TK Al-Qur\'an', 'TK Alquran', 'TKQ'].includes(stored);
    return legacyTingkat ? '' : stored;
  }

  function normalizeSantriEducation(santri) {
    if (!santri) return santri;
    const tingkat = tingkatForSantri(santri);
    if (tingkat) santri.tingkat = tingkat;
    santri.kelas = kelasForSantri(santri);
    return santri;
  }

  function kelasLabel(tingkat, kelas) {
    return kelas ? `${tingkat || '-'} · Kelas ${kelas}` : `${tingkat || '-'} · Kelas belum diisi`;
  }

  function educationLabel(santri) {
    return kelasLabel(tingkatForSantri(santri), kelasForSantri(santri));
  }

  function talimMapel() {
    return Array.isArray(db.settings?.talimMapel) ? db.settings.talimMapel.filter(mapel => mapel && mapel.id && mapel.nama) : [];
  }

  function findTalimMapel(id) { return talimMapel().find(mapel => mapel.id === id) || null; }
  function talimClassKey(tingkat, kelas) { return `${tingkat || ''}|${kelas || ''}`; }

  function talimClassFromKey(key) {
    const [tingkat, kelas] = String(key || '').split('|');
    return { tingkat: tingkat || '', kelas: kelas || '' };
  }

  function talimClassLabel(key) {
    const item = talimClassFromKey(key);
    return kelasLabel(item.tingkat, item.kelas);
  }

  function talimAssignmentsForUstadz(ustadz) {
    const assignments = Array.isArray(ustadz?.talimMengajar) ? ustadz.talimMengajar : [];
    return assignments.map(assignment => {
      const mapel = findTalimMapel(assignment.mapelId);
      const kelasKeys = Array.isArray(assignment.kelasKeys) ? assignment.kelasKeys.filter(Boolean) : [];
      return mapel ? { mapel, kelasKeys } : null;
    }).filter(Boolean);
  }

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

  /* Setoran bisa diinput dengan tanggal lama (bayar setoran tertinggal),
     sehingga tanggal terbesar belum tentu ayat terakhir. Patokan melanjutkan
     setoran adalah catatan yang paling baru DIINPUT, supaya ayat yang sudah
     disetor tidak terulang walaupun tanggalnya lebih lama. */
  function lastSetoran(a, b) {
    const byInput = (b._created || 0) - (a._created || 0);
    if (byInput !== 0) return byInput;
    return String(b.tanggal || '').localeCompare(String(a.tanggal || ''));
  }

  function lastZiyadah(santriId) {
    const all = [
      ...db.ziyadahHafalan.filter(z => z.santriId === santriId),
      ...db.ziyadahBacaan.filter(z => z.santriId === santriId),
    ].sort(lastSetoran);
    return all[0] || null;
  }

  function lastHafalan(santriId) {
    const haf = db.ziyadahHafalan.filter(z => z.santriId === santriId).sort(lastSetoran);
    return haf[0] || null;
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
    return dedupeKehadiran(db.kehadiran.filter(k => k.santriId === santriId && k.tanggal.startsWith(bulan)));
  }

  /* ---------- Absensi ustadz ----------
     Satu halaqah boleh diampu lebih dari satu ustadz, sehingga absensi ustadz
     dan absensi santrinya disimpan terpisah dan tidak saling menimpa. */
  function absensiUstadzOf(ustadzId, tanggal, sesi) {
    if (!ustadzId) return null;
    return db.absensiUstadz.find(a => a.ustadzId === ustadzId && a.tanggal === tanggal && a.sesi === sesi) || null;
  }

  function absensiUstadzTanggal(ustadzId, tanggal) {
    if (!ustadzId) return [];
    return db.absensiUstadz.filter(a => a.ustadzId === ustadzId && a.tanggal === tanggal);
  }

  function absensiUstadzBulan(ustadzId, bulan) {
    if (!ustadzId) return [];
    return db.absensiUstadz.filter(a => a.ustadzId === ustadzId && String(a.tanggal || '').startsWith(bulan));
  }

  /** Catat/koreksi absensi ustadz untuk satu sesi. Satu ustadz hanya punya
   * satu catatan per (tanggal, sesi) sehingga koreksi memperbarui baris yang
   * sama, bukan membuat baris baru. */
  async function simpanAbsensiUstadz(ustadzId, sesi, status, catatan, tanggal) {
    const ustadz = findUstadz(ustadzId);
    if (!ustadz || !status) return false;
    const t = tanggal || todayStr();
    const existing = absensiUstadzOf(ustadzId, t, sesi);
    const halaqah = findHalaqahForUstadz(ustadz);
    const record = {
      id: existing ? existing.id : uid('au'),
      ustadzId,
      ustadz: ustadz.nama || '',
      halaqahId: halaqah ? halaqah.id : '',
      halaqah: halaqah ? halaqah.nama : (ustadz.halaqah || ''),
      tanggal: t,
      sesi,
      status,
      waktu: existing ? (existing.waktu || nowISO()) : nowISO(),
      catatan: catatan === undefined ? (existing ? (existing.catatan || '') : '') : catatan
    };
    db.absensiUstadz = db.absensiUstadz.filter(a => a.id !== record.id);
    db.absensiUstadz.push(record);
    return save();
  }

  /* ---------- Rekap absensi ---------- */
  // Satu halaqah boleh diampu lebih dari satu ustadz sehingga satu sesi dapat
  // memuat lebih dari satu catatan untuk Santri yang sama. Rekap tetap memakai
  // satu status per sesi: catatan paling baru yang dihitung, sehingga koreksi
  // terakhir tampil sekali dan angka rekap tidak pernah dobel.
  function dedupeKehadiran(records) {
    const latest = {};
    (records || []).forEach(k => {
      const key = [k.santriId, k.tanggal, k.sesi || 'Subuh'].join('|');
      const prev = latest[key];
      if (!prev || (k._created || 0) >= (prev._created || 0)) latest[key] = k;
    });
    return Object.keys(latest).sort().map(key => latest[key]);
  }

  function addNotif(userId, tipe, pesan) {
    db.notifikasi.unshift({ id: uid('n'), userId, tipe, pesan, tanggal: nowISO(), read: false });
    save();
  }
  function notifFor(userId) { return db.notifikasi.filter(n => n.userId === userId); }
  function clearNotifs(userId) {
    db.notifikasi = db.notifikasi.filter(n => n.userId !== userId);
    save();
  }

  /* ---------- Cek setoran terlewat ----------
     Aturan: tiap santri wajib setoran 1x per hari kerja (Senin-Jumat).
     Jika pada hari berikutnya santri belum setoran di hari kerja tsb,
     notifikasi dikirim ke akun wali (ortu) & ustadz pengampu halaqah.
     Agar tidak duplikat, pasangan (santriId|tanggal) disimpan di db.setoranNotif. */
  function isHariKerja(d) { const h = d.getDay(); return h >= 1 && h <= 5; } // 1=Sen, 5=Jum

  function todayLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function checkSetoranTerlewat() {
    if (!db.settings.notifActive) return;
    const today = todayStr();
    if (!db.setoranNotif) db.setoranNotif = [];
    const sudah = (sid, tgl) => db.setoranNotif.some(x => x.santriId === sid && x.tanggal === tgl);
    const tandai = (sid, tgl) => { if (!sudah(sid, tgl)) db.setoranNotif.push({ santriId: sid, tanggal: tgl }); };
    const maxNotif = db.settings.notifMaxPerDay || 3;
    let notifCount = 0;

    db.santri.filter(s => s.status === 'Aktif').forEach(s => {
      const kemarin = new Date(); kemarin.setDate(kemarin.getDate() - 1);
      const mulai = new Date(kemarin); mulai.setDate(mulai.getDate() - 6);
      const cek = new Date(mulai);
      while (cek <= kemarin) {
        if (isHariKerja(cek)) {
          const tgl = todayLocal(cek);
          if (!sudah(s.id, tgl) && notifCount < maxNotif) {
            const adaSetoran = db.ziyadahHafalan.some(z => z.santriId === s.id && z.tanggal === tgl)
              || db.ziyadahBacaan.some(z => z.santriId === s.id && z.tanggal === tgl)
              || db.tahsin.some(z => z.santriId === s.id && z.tanggal === tgl);
            if (!adaSetoran) {
              const wUser = db.settings.notifWali && db.users.find(u => u.role === 'wali' && u.refId === s.waliId);
              const halaqahSantri = halaqahForSantri(s);
              const ustadzPengampu = db.ustadz.filter(u => halaqahSantri.some(h => halaqahHasUstadz(h, u)));
              const uUsers = db.settings.notifUstadz
                ? ustadzPengampu.map(u => db.users.find(user => user.role === 'ustadz' && user.refId === u.id)).filter(Boolean)
                : [];
              const tglTxt = UI.fmtDate(tgl);
              const pesan = '⚠️ ' + s.nama + ' belum setoran pada ' + tglTxt + '. Mohon dampingi anak untuk setoran.';
              const pesanU = s.nama + ' belum setoran pada ' + tglTxt + '.';
              if (wUser && !db.notifikasi.some(n => n.userId === wUser.id && n.pesan === pesan)) { addNotif(wUser.id, 'wali', pesan); notifCount++; }
              uUsers.forEach(uUser => {
                if (notifCount < maxNotif && !db.notifikasi.some(n => n.userId === uUser.id && n.pesan === pesanU)) {
                  addNotif(uUser.id, 'ustadz', pesanU); notifCount++;
                }
              });
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
    setToken, getToken, setSession: () => {}, getSession, clearSession, login, logout, changePassword,
    recalcHalaqah, findSantri, findWali, findUstadz, findUstadzByName, findHalaqahById, findHalaqahByName, ustadzIdsForHalaqah, ustadzNamesForHalaqah, halaqahHasUstadz, findHalaqahForUstadz,
    activeProgramsForSantri, halaqahForSantriProgram, halaqahForSantri, santriHasProgram, santriHasHalaqah, programsForSantriHalaqah, configureSantriPrograms, programSummaryForSantri, halaqahSummaryForSantri,
    tingkatOptions, kelasOptions, tingkatForSantri, kelasForSantri, normalizeSantriEducation, kelasLabel, educationLabel,
    talimMapel, findTalimMapel, talimClassKey, talimClassFromKey, talimClassLabel, talimAssignmentsForUstadz, talimMalamSettings, search,
    waSend, waLog, waReady, waAutoEnabled, waSendWali, waStatus, waQrDataUrl,
    lastZiyadah, lastHafalan, totalHafalanSantri, avgNilai, kehadiranBulan, dedupeKehadiran,
    absensiUstadzOf, absensiUstadzTanggal, absensiUstadzBulan, simpanAbsensiUstadz,
    addNotif, notifFor, clearNotifs, checkSetoranTerlewat
  };
})();
