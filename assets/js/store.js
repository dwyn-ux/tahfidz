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
  // Setiap nomor kelas punya dua rombongan (A dan B), jadi "Kelas 7A" dan
  // "Kelas 7B". Nilai ini hanya dipakai sebagai daftar awal; admin dapat
  // menambah/menghapusnya lewat Settings → Kelas & Tingkat.
  const DEFAULT_KELAS_PER_TINGKAT = {
    TPQ: ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B'],
    SD: ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B'],
    SMP: ['7A', '7B', '8A', '8B', '9A', '9B'],
    SMA: ['10A', '10B', '11A', '11B', '12A', '12B']
  };
  // Salinan dalam: daftar kelas bisa diubah admin lewat Settings, jadi jangan
  // sampai array bawaan ikut berubah karena berbagi referensi.
  function defaultKelasPerTingkat() {
    const result = {};
    Object.keys(DEFAULT_KELAS_PER_TINGKAT).forEach(name => {
      result[name] = DEFAULT_KELAS_PER_TINGKAT[name].slice();
    });
    return result;
  }
  // "10A" harus urut sebelum "1B", jadi pengurutan membandingkan bagian angka
  // dulu lalu huruf. Perbandingan string biasa akan salah ("10" < "1B").
  function naturalKelasSort(a, b) {
    const split = v => String(v).match(/^(\d*)(.*)$/).slice(1);
    const [numA, restA] = split(a);
    const [numB, restB] = split(b);
    const diff = (Number(numA) || 0) - (Number(numB) || 0);
    if (diff) return diff;
    return restA.localeCompare(restB, 'id');
  }
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
        tingkat: DEFAULT_TINGKAT.slice(), kelasPerTingkat: defaultKelasPerTingkat(), talimMapel: [],
        talimMalam: { ustadzIds: [], judulKitab: '', bab: '' },
        juzOrder: [30,29,28,27,26,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25],
        notifActive: true, notifMaxPerDay: 3, notifWali: true, notifUstadz: true,
        notifAbsensiWali: true, notifAbsensiPeriode: 'harian',
        waBridgeUrl: '', waBridgeKey: '', waAuto: false, liburLembaga: [],
        waAutoTrigger: { setoran: true, harian: false, mingguan: false, bulanan: false },
        waAutoJam: '07:00'
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
      // Log WA hanya bertambah, tidak pernah dihapus dari sisi browser:
      // server juga menulis baris log (mis. saat cron mengirim rekap), dan
      // pemotongan 100 baris di browser akan ikut menghapus baris itu.
      const remove = type === 'logWa' ? [] : Object.keys(oldRows).filter(id => !newRows[id]);
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

  // Log WA versi server (terbaru). Log juga ditulis server saat cron atau
  // rekap terjadwal berjalan, jadi panel Log WhatsApp perlu mengambilnya
  // langsung dari server, bukan dari salinan di browser.
  function waLogServer() {
    return api('wa&op=log').then(r => (r && r.data) || null).catch(() => null);
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

  // Nomor WhatsApp wali. Record wali diutamakan karena wali bisa
  // memperbarui nomornya sendiri lewat halaman Profil; field noHpWali pada
  // Santri hanya dipakai sebagai cadangan untuk data lama.
  function waNomorWali(santriId) {
    const s = db.santri.find(x => x.id === santriId);
    if (!s) return '';
    const wali = (db.wali || []).find(w => w.id === s.waliId)
      || (db.wali || []).find(w => w.santriId === s.id);
    if (wali && wali.noHp && String(wali.noHp).trim()) return String(wali.noHp).trim();
    return s.noHpWali ? String(s.noHpWali).trim() : '';
  }

  // Kirim laporan ke no. WA wali dari santri (auto jika waAuto aktif). Fire-and-forget.
  function waSendWali(santriId, message) {
    const s = db.santri.find(x => x.id === santriId);
    if (!s) { waLog({ to: null, status: 'skipped', detail: 'Santri tidak ditemukan', message }); return Promise.resolve(false); }
    if (!waAutoEnabled()) { waLog({ to: null, status: 'skipped', detail: 'WhatsApp Otomatis nonaktif', message }); return Promise.resolve(false); }
    const nomor = waNomorWali(santriId);
    if (!nomor) { waLog({ to: null, status: 'skipped', detail: 'Santri tanpa no. HP wali', message }); return Promise.resolve(false); }
    return waSend(nomor, message);
  }
  /* ---------- Pemicu WA otomatis (setoran / harian / mingguan / bulanan) ---------- */

  // Setelan bisa berisi nilai teks dari backup lama ("false" bersifat truthy),
  // jadi setiap pemicu dinormalkan ke boolean.
  function waAutoTriggerSettings() {
    const raw = (db.settings && db.settings.waAutoTrigger) || {};
    const aktif = key => raw[key] === true || raw[key] === 1 || raw[key] === '1' || raw[key] === 'true';
    // Tanpa setelan tersimpan, perilaku lama (hanya setoran) tetap dipakai agar
    // instalasi yang belum membuka Settings tidak berubah diam-diam.
    const kosong = !raw || typeof raw !== 'object' || !Object.keys(raw).length;
    return {
      setoran: kosong ? true : aktif('setoran'),
      harian: aktif('harian'),
      mingguan: aktif('mingguan'),
      bulanan: aktif('bulanan')
    };
  }

  // "HH:MM" dari Settings; dianggap 07:00 bila tidak valid.
  function waAutoHour() {
    const value = String((db.settings && db.settings.waAutoJam) || '07:00');
    const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!m) return { jam: 7, menit: 0 };
    const jam = Math.min(23, Math.max(0, parseInt(m[1], 10)));
    const menit = Math.min(59, Math.max(0, parseInt(m[2], 10)));
    return { jam, menit };
  }

  // Pemicu berjadwal (harian/mingguan/bulanan) dijalankan di server supaya
  // bisa dipanggil cron dan penanda "sudah terkirim"-nya tersimpan di
  // database. Lihat api/wa_service.php.
  function waAutoReminder() {
    return api('wa_auto_reminder', { method: 'POST', body: {} }).catch(e => {
      console.warn('WA reminder gagal', e);
      return { ok: false, terkirim: 0, detail: (e && e.message) || 'Gagal' };
    });
  }

  function waQueueStatus() {
    return api('wa&op=queue').then(r => (r && r.data) || { pending: 0, sending: false }).catch(() => ({ pending: 0, sending: false }));
  }

  function waStopQueue() {
    return api('wa&op=stop');
  }

  function waPreviewTest(payload) {
    return api('wa_preview_test', { method: 'POST', body: payload || {} }).catch(e => ({
      ok: false,
      detail: (e && e.message) || 'Gagal memuat pratinjau'
    }));
  }

  function waSendTestRecap(payload) {
    return api('wa_send_test_recap', { method: 'POST', body: payload || {} }).catch(e => ({
      ok: false,
      terkirim: 0,
      detail: (e && e.message) || 'Gagal mengirim pesan uji coba'
    }));
  }

  // Satu pesan rekap absensi untuk satu santri pada rentang tanggal tertentu.
  // Dipakai untuk pratinjau di aplikasi; pesan yang benar-benar dikirim
  // disusun di server agar sama persis dengan yang dilihat wali.
  function waAbsensiMessage(santri, dari, sampai, judul) {
    const rec = rekapKehadiranSantri(santri.id, dari, sampai);
    const t = rec.total;
    const bagian = ['Hadir ' + t.Hadir, 'Izin ' + t.Izin, 'Sakit ' + t.Sakit];
    if (t.Libur) bagian.push('Libur ' + t.Libur);
    bagian.push('Alfa ' + t.Alfa);
    const lembaga = (db.settings && db.settings.namaLembaga) || '';
    const format = d => {
      try { return d.split('-').reverse().join('/'); } catch(e) { return d; }
    };
    return '📋 ' + judul + ' ' + santri.nama + ' (' +
      format(dari) + (dari === sampai ? '' : ' - ' + format(sampai)) + '): ' +
      bagian.join(', ') + '.' + (lembaga ? ' — ' + lembaga : '');
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
      settings.kelasPerTingkat = defaultKelasPerTingkat();
    } else {
      settings.tingkat.forEach(name => {
        const values = settings.kelasPerTingkat[name];
        settings.kelasPerTingkat[name] = (Array.isArray(values) && values.length ? values : (DEFAULT_KELAS_PER_TINGKAT[name] || []))
          .map(String).map(v => v.trim()).filter(Boolean);
      });
    }
    if (!Array.isArray(settings.talimMapel)) settings.talimMapel = [];
    settings.talimMapel = settings.talimMapel.filter(item => item && item.id && item.nama)
      .map(item => ({
        id: item.id,
        nama: String(item.nama),
        kitabNama: item.kitabNama ? String(item.kitabNama) : '',
        kitabUrl: item.kitabUrl ? String(item.kitabUrl) : '',
        kitabSize: Number(item.kitabSize) || 0
      }));
    if (!settings.talimMalam || typeof settings.talimMalam !== 'object' || Array.isArray(settings.talimMalam)) settings.talimMalam = {};
    settings.talimMalam.ustadzIds = Array.isArray(settings.talimMalam.ustadzIds) ? settings.talimMalam.ustadzIds.filter(Boolean) : [];
    settings.talimMalam.judulKitab = String(settings.talimMalam.judulKitab || '');
    settings.talimMalam.bab = String(settings.talimMalam.bab || '');
    if (!Array.isArray(settings.liburLembaga)) settings.liburLembaga = [];
    settings.liburLembaga = settings.liburLembaga.filter(item => item && item.tanggal);
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
      // Daftar bisa berada di luar urutan natural setelah admin menambah kelas
      // baru lewat Settings, jadi selalu diurutkan saat dibaca.
      kelasPerTingkat[name] = values.map(String).filter(Boolean).sort(naturalKelasSort);
    });
    return { tingkat, kelasPerTingkat };
  }

  function tingkatOptions() { return educationSettings().tingkat; }
  function kelasOptions(tingkat) { return educationSettings().kelasPerTingkat[tingkat] || []; }

  /* ---------------- CRUD tingkat & kelas (Settings) ----------------
     Nilai disimpan apa adanya di settings; normalisasi hanya ditegakkan di
     educationSettings() supaya perubahan admin langsung terlihat tanpa perlu
     memuat ulang. */

  function tingkatAda(nama) {
    const target = String(nama || '').trim();
    return !!target && tingkatOptions().includes(target);
  }

  function simpanTingkat(nama) {
    const value = String(nama || '').trim();
    if (!value) return { ok: false, msg: 'Nama tingkat wajib diisi.' };
    if (tingkatAda(value)) return { ok: false, msg: 'Tingkat "' + value + '" sudah ada.' };
    normalizeSettings();
    db.settings.tingkat.push(value);
    db.settings.kelasPerTingkat[value] = [];
    save();
    return { ok: true };
  }
  function hapusTingkat(nama) {
    normalizeSettings();
    db.settings.tingkat = db.settings.tingkat.filter(item => item !== nama);
    delete db.settings.kelasPerTingkat[nama];
    save();
    return { ok: true };
  }
  function simpanKelas(tingkat, kelas) {
    const t = String(tingkat || '').trim();
    const value = String(kelas || '').trim();
    if (!t) return { ok: false, msg: 'Pilih tingkat lebih dulu.' };
    if (!value) return { ok: false, msg: 'Nama kelas wajib diisi.' };
    normalizeSettings();
    const list = Array.isArray(db.settings.kelasPerTingkat[t]) ? db.settings.kelasPerTingkat[t] : [];
    if (list.map(String).some(item => item.toLowerCase() === value.toLowerCase())) {
      return { ok: false, msg: 'Kelas "' + value + '" sudah ada di ' + t + '.' };
    }
    list.push(value);
    db.settings.kelasPerTingkat[t] = list;
    save();
    return { ok: true };
  }
  function hapusKelas(tingkat, kelas) {
    normalizeSettings();
    const list = Array.isArray(db.settings.kelasPerTingkat[tingkat]) ? db.settings.kelasPerTingkat[tingkat] : [];
    db.settings.kelasPerTingkat[tingkat] = list.filter(item => item !== kelas);
    save();
    return { ok: true };
  }

  // Semua kunci kelas yang pernah dipakai penugasan Ta'lim, supaya Settings
  // bisa memperingatkan sebelum kelas dihapus dan assignment jadi yatim.
  function talimAssignmentsKelasKeys() {
    const keys = [];
    db.ustadz.forEach(ustadz => {
      (Array.isArray(ustadz.talimMengajar) ? ustadz.talimMengajar : []).forEach(item => {
        (Array.isArray(item.kelasKeys) ? item.kelasKeys : []).forEach(key => keys.push(key));
      });
    });
    return keys;
  }
  function kelasDipakaiDiTalim(tingkat, kelas) {
    return talimAssignmentsKelasKeys().includes(talimClassKey(tingkat, kelas));
  }
  function jumlahSantriKelas(tingkat, kelas) {
    return db.santri.filter(s =>
      tingkatForSantri(s) === tingkat && kelasForSantri(s) === kelas).length;
  }

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

  async function uploadKitab(file) {
    const token = localStorage.getItem(TOKEN_KEY);
    const fd = new FormData();
    fd.append('file', file);
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(API_BASE + '?action=upload_kitab', {
      method: 'POST',
      headers,
      body: fd
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    if (!res.ok) {
      const msg = (data && data.error) ? data.error : ('Gagal upload (HTTP ' + res.status + ')');
      throw new Error(msg);
    }
    return data;
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

  function kehadiranRentang(santriId, dari, sampai) {
    return dedupeKehadiran(db.kehadiran.filter(k => k.santriId === santriId && padaRentang(k.tanggal, dari, sampai)));
  }

  // Laporan memakai rentang tanggal (bukan bulan tetap), jadi tiga helper
  // berikut menyaring catatan apa pun yang jatuh di antara dari–sampai.
  function padaRentang(tanggal, dari, sampai) {
    return !!tanggal && tanggal >= dari && tanggal <= sampai;
  }

  // Setoran hafalan pertama & terakhir dalam periode (urut waktu, bukan urutan
  // input), supaya "Setoran Awal/Akhir" di laporan sesuai bacaan sang santri.
  function setoranRentang(santriId, dari, sampai) {
    const records = [
      ...db.ziyadahHafalan.filter(z => z.santriId === santriId && padaRentang(z.tanggal, dari, sampai)),
      ...db.mutqin.filter(m => m.santriId === santriId && padaRentang(m.tanggal, dari, sampai))
    ].sort(lastSetoran);
    if (!records.length) return null;
    return { awal: records[records.length - 1], akhir: records[0], jumlah: records.length };
  }

  // Tampilan juz hafalan yang mengantisipasi urutan 30→29→…→26→1→2→…→25.
  // Jika rentang melintasi batas 30→1 (mis. juz 26-30 dan 1-4), tampilkan
  // sebagai "Juz 26–30 dan 1–4", bukan "Juz 1–30".
  function juzHafalanDisplay(santriId) {
    const records = [
      ...db.ziyadahHafalan.filter(z => z.santriId === santriId),
      ...db.mutqin.filter(m => m.santriId === santriId)
    ];
    if (!records.length) return null;
    const ranges = records.map(r => {
      const h = computeHafalan(r.sAwal, r.aAwal, r.sAkhir, r.aAkhir);
      return h ? [h.juzStart, h.juzEnd] : null;
    }).filter(Boolean);
    if (!ranges.length) return null;
    const juzOrder = [30, 29, 28, 27, 26, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
    ranges.sort((a, b) => juzOrder.indexOf(a[0]) - juzOrder.indexOf(b[0]));
    const merged = [];
    ranges.forEach(r => {
      const last = merged[merged.length - 1];
      const crossesBoundary = last && last[1] === 30 && r[0] === 1;
      if (last && !crossesBoundary && r[0] <= last[1] + 1) {
        last[1] = Math.max(last[1], r[1]);
      } else {
        merged.push([r[0], r[1]]);
      }
    });
    return merged.map(([s, e]) => {
      if (s === e) return 'Juz ' + s;
      if (s >= 26 && e <= 25) return 'Juz ' + s + '–30 dan 1–' + e;
      return 'Juz ' + s + '–' + e;
    }).join(', ');
  }

  function avgNilaiRentang(santriId, dari, sampai) {
    const vals = [];
    db.tahsin.filter(t => t.santriId === santriId && padaRentang(t.tanggal, dari, sampai)).forEach(t => vals.push(t.nilai));
    db.ziyadahHafalan.filter(z => z.santriId === santriId && padaRentang(z.tanggal, dari, sampai)).forEach(z => vals.push(z.nilai));
    db.mutqin.filter(m => m.santriId === santriId && padaRentang(m.tanggal, dari, sampai)).forEach(m => vals.push(m.nilai));
    if (!vals.length) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  /* ---------- Absensi ustadz ----------
     Satu halaqah boleh diampu lebih dari satu ustadz, sehingga absensi ustadz
     dan absensi santrinya disimpan terpisah dan tidak saling menimpa. */
  function absensiUstadzOf(ustadzId, tanggal, sesi) {
    const rec = absensiUstadzRow(ustadzId, tanggal, sesi);
    if (!rec) return null;
    // Buang record yang tidak konsisten: id cocok tapi nama tidak (data
    // tertukar/tertinggal dari versi lama). Tanpa ini banner "tersimpan"
    // milik ustadz lain bisa muncul saat ustadz ini belum absen.
    const u = findUstadz(ustadzId);
    if (u && rec.ustadz && rec.ustadz !== u.nama) return null;
    return rec;
  }

  // Baris mentah per (ustadz, tanggal, sesi) tanpa cek nama. Dipakai saat
  // menyimpan supaya baris rusak yang sama persis ditimpa (memperbaiki
  // unique index) alih-alih membuat baris kedua yang ditolak database.
  function absensiUstadzRow(ustadzId, tanggal, sesi) {
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
    // Pakai baris mentah: record lama yang tidak konsisten akan dikoreksi di
    // tempat, bukan menggandakan baris (unique index akan menolaknya).
    const existing = absensiUstadzRow(ustadzId, t, sesi);
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

  // Meliburkan halaqah untuk satu atau beberapa sesi karena ada kegiatan / acara.
  // Ustadz dicatat Libur di absensiUstadz, dan semua santri aktif di halaqah ini
  // dicatat Libur di kehadiran santri agar tidak dihitung Alfa.
  async function liburkanHalaqah(ustadzId, sesiList, halaqahNama, catatan, tanggal) {
    const t = tanggal || todayStr();
    const ustadz = findUstadz(ustadzId);
    if (!ustadz) return false;
    const sesiArr = (Array.isArray(sesiList) ? sesiList : [sesiList]).filter(Boolean);
    if (!sesiArr.length) return false;

    const halaqah = halaqahNama ? findHalaqahByName(halaqahNama) : findHalaqahForUstadz(ustadz);
    const halaqahId = halaqah ? halaqah.id : '';
    const hNama = halaqah ? halaqah.nama : (ustadz.halaqah || halaqahNama || '');
    const alasan = catatan || 'Ada kegiatan / Libur';

    // Santri di halaqah ini
    const santriList = db.santri.filter(s =>
      s.status !== 'Nonaktif' && (halaqah ? santriHasHalaqah(s, halaqah) : (!hNama || santriHasHalaqah(s, hNama)))
    );

    sesiArr.forEach(sesi => {
      // 1. Catat absensi ustadz status Libur
      const existingAU = absensiUstadzRow(ustadzId, t, sesi);
      const auRecord = {
        id: existingAU ? existingAU.id : uid('au'),
        ustadzId,
        ustadz: ustadz.nama || '',
        halaqahId,
        halaqah: hNama,
        tanggal: t,
        sesi,
        status: 'Libur',
        waktu: nowISO(),
        catatan: alasan
      };
      db.absensiUstadz = db.absensiUstadz.filter(a => a.id !== auRecord.id);
      db.absensiUstadz.push(auRecord);

      // 2. Catat kehadiran seluruh santri di halaqah ini sebagai 'Libur'
      santriList.forEach(s => {
        const existingK = db.kehadiran.find(k =>
          k.santriId === s.id && k.tanggal === t && k.sesi === sesi && (k.ustadzId || '') === ustadzId
        );
        const kRecord = {
          id: existingK ? existingK.id : uid('k'),
          santriId: s.id,
          halaqahId: halaqahId || (existingK ? existingK.halaqahId : ''),
          ustadzId,
          tanggal: t,
          sesi,
          status: 'Libur',
          _created: existingK ? (existingK._created || Date.now()) : Date.now()
        };
        db.kehadiran = db.kehadiran.filter(k => k.id !== kRecord.id);
        db.kehadiran.push(kRecord);
      });
    });

    log('Meliburkan halaqah ' + (hNama || ustadz.nama) + ' (' + sesiArr.join(', ') + '): ' + alasan);
    return save();
  }

  // Batalkan status libur untuk satu atau beberapa sesi agar halaqah dapat diabsen kembali.
  async function batalkanLiburHalaqah(ustadzId, sesiList, halaqahNama, tanggal) {
    const t = tanggal || todayStr();
    const ustadz = findUstadz(ustadzId);
    if (!ustadz) return false;
    const sesiArr = (Array.isArray(sesiList) ? sesiList : [sesiList]).filter(Boolean);
    if (!sesiArr.length) return false;

    const halaqah = halaqahNama ? findHalaqahByName(halaqahNama) : findHalaqahForUstadz(ustadz);
    const hNama = halaqah ? halaqah.nama : (ustadz.halaqah || halaqahNama || '');
    const santriList = db.santri.filter(s =>
      halaqah ? santriHasHalaqah(s, halaqah) : (!hNama || santriHasHalaqah(s, hNama))
    );

    sesiArr.forEach(sesi => {
      // Hapus absensi ustadz status Libur
      db.absensiUstadz = db.absensiUstadz.filter(a =>
        !(a.ustadzId === ustadzId && a.tanggal === t && a.sesi === sesi && a.status === 'Libur')
      );

      // Hapus absensi santri status Libur untuk ustadz ini
      db.kehadiran = db.kehadiran.filter(k =>
        !(k.tanggal === t && k.sesi === sesi && (k.ustadzId || '') === ustadzId && santriList.some(s => s.id === k.santriId) && k.status === 'Libur')
      );
    });

    log('Membatalkan libur halaqah ' + (hNama || ustadz.nama) + ' (' + sesiArr.join(', ') + ')');
    return save();
  }

  // ─── Libur Lembaga ────────────────────────────────────────────────────────
  function getLiburLembaga() {
    normalizeSettings();
    return (db.settings.liburLembaga || []).slice().sort((a, b) =>
      String(a.tanggal).localeCompare(String(b.tanggal))
    );
  }

  function isLiburLembaga(tanggal) {
    const t = tanggal || todayStr();
    return (db.settings.liburLembaga || []).some(item => item.tanggal === t);
  }

  function getLiburLembagaInfo(tanggal) {
    const t = tanggal || todayStr();
    return (db.settings.liburLembaga || []).find(item => item.tanggal === t) || null;
  }

  async function tambahLiburLembaga(tanggal, keterangan, sesiList) {
    if (!tanggal) return false;
    normalizeSettings();
    if (!db.settings.liburLembaga) db.settings.liburLembaga = [];
    db.settings.liburLembaga = db.settings.liburLembaga.filter(item => item.tanggal !== tanggal);
    db.settings.liburLembaga.push({
      tanggal,
      keterangan: keterangan || 'Libur Lembaga',
      sesi: Array.isArray(sesiList) && sesiList.length ? sesiList : 'semua'
    });
    log('Tambah libur lembaga ' + tanggal + ': ' + (keterangan || 'Libur Lembaga'));
    return save();
  }

  async function hapusLiburLembaga(tanggal) {
    if (!tanggal) return false;
    normalizeSettings();
    if (!db.settings.liburLembaga) db.settings.liburLembaga = [];
    db.settings.liburLembaga = db.settings.liburLembaga.filter(item => item.tanggal !== tanggal);
    log('Hapus libur lembaga ' + tanggal);
    return save();
  }

  async function terapkanLiburLembaga(tanggal) {
    const t = tanggal || todayStr();
    const info = getLiburLembagaInfo(t);
    const SESI_ALL = ['Subuh', 'Ashar', 'Maghrib', 'Isya'];
    const sesiArr = (info && info.sesi !== 'semua' && Array.isArray(info.sesi)) ? info.sesi : SESI_ALL;
    const alasan = (info && info.keterangan) ? info.keterangan : 'Libur Lembaga';

    for (const halaqah of db.halaqah) {
      const ustadzIds = ustadzIdsForHalaqah(halaqah);
      const uid_h = ustadzIds[0];
      if (!uid_h) continue;
      await liburkanHalaqah(uid_h, sesiArr, halaqah.nama, alasan, t);
    }

    // Beri tahu seluruh ustadz agar mereka tidak mengabsen sendiri.
    if (db.settings.notifActive) {
      db.ustadz.forEach(u => {
        const user = db.users.find(x => x.role === 'ustadz' && x.refId === u.id);
        if (!user) return;
        const pesan = '🗓️ Libur Lembaga ' + todayLocal(new Date(t + 'T00:00:00')) + ': ' + alasan +
          ' (sesi: ' + sesiArr.join(', ') + '). Halaqah tidak perlu diabsen.';
        if (!db.notifikasi.some(n => n.userId === user.id && n.pesan === pesan)) {
          addNotif(user.id, 'ustadz', pesan);
        }
      });
    }

    log('Terapkan libur lembaga ' + t + ': ' + alasan);
    return save();
  }

  function halaqahLiburInfo(halaqahRef, tanggal, sesi, ustadzId) {
    const t = tanggal || todayStr();
    const h = resolveHalaqah(halaqahRef);
    const hName = h ? h.nama : String(halaqahRef || '');
    const uIds = h ? ustadzIdsForHalaqah(h) : (ustadzId ? [ustadzId] : []);

    const au = db.absensiUstadz.find(a =>
      a.tanggal === t && a.sesi === sesi && a.status === 'Libur' &&
      ((uIds.length && uIds.includes(a.ustadzId)) || (hName && a.halaqah === hName) || (ustadzId && a.ustadzId === ustadzId))
    );
    if (au) return { isLibur: true, catatan: au.catatan || 'Ada kegiatan / Libur', ustadz: au.ustadz || '', record: au };
    return null;
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

  /* ---------- Rekap kehadiran (totalan per periode) ----------
     Alfa dihitung dari slot yang tidak punya catatan sama sekali, bukan dari
     status "Alfa": absensi ustadz hanya punya Hadir/Izin/Sakit, dan catatan
     absensi bisa kosong ketika ustadz belum mencatat. Dengan begitu angka alfa
     selalu konsisten dengan "total hari x sesi - jumlah catatan". */
  const SESI_REKAP = ['Subuh', 'Ashar', 'Maghrib', 'Isya'];

  // Daftar tanggal inklusif. String YYYY-MM-DD bisa dibandingkan leksikografis
  // sama dengan urutan kronologis.
  function tanggalRange(dari, sampai) {
    if (!dari || !sampai || sampai < dari) return [];
    const list = [];
    let cursor = dari;
    while (cursor <= sampai && list.length <= 366) {
      list.push(cursor);
      const next = new Date(cursor + 'T12:00:00');
      next.setDate(next.getDate() + 1);
      cursor = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
    }
    return list;
  }

  function tambahHari(iso, jumlah) {
    const date = new Date(iso + 'T12:00:00');
    date.setDate(date.getDate() + jumlah);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function kosongkanAngka(status) {
    return { Hadir: 0, Izin: 0, Sakit: 0, Libur: 0, Alfa: 0, ...status };
  }

  // Rekap kehadiran satu orang. `slotPerHari` = sesi mana saja yang dihitung,
  // supaya sesi yang tidak dipakai tidak ikut menambah slot alfa.
  function rekapKehadiranOrang(records, days, slotPerHari, sesiList) {
    const total = kosongkanAngka();
    sesiList.forEach(sesi => { total[sesi] = 0; });
    const perSesi = {};
    sesiList.forEach(sesi => { perSesi[sesi] = kosongkanAngka(); });

    const daysSet = new Set(days);
    (records || []).forEach(r => {
      if (!daysSet.has(r.tanggal)) return;
      const sesi = r.sesi || 'Subuh';
      if (!sesiList.includes(sesi)) return;
      perSesi[sesi][r.status] = (perSesi[sesi][r.status] || 0) + 1;
      total[r.status] = (total[r.status] || 0) + 1;
      total[sesi] += 1;
    });

    // Sisa slot kosong dihitung sebagai Alfa supaya total selalu konsisten:
    // Libur dihitung sebagai tercatat sehingga tidak menjadi Alfa.
    sesiList.forEach(sesi => {
      const slot = days.length * (slotPerHari.includes(sesi) ? 1 : 0);
      const tercatat = (perSesi[sesi].Hadir || 0) + (perSesi[sesi].Izin || 0) + (perSesi[sesi].Sakit || 0) + (perSesi[sesi].Libur || 0);
      perSesi[sesi].Alfa = Math.max(0, slot - tercatat);
      total.Alfa += perSesi[sesi].Alfa;
    });
    total.slot = days.length * slotPerHari.length;
    total.slotEfektif = Math.max(0, total.slot - (total.Libur || 0));
    total.persen = total.slotEfektif > 0 ? Math.round((total.Hadir / total.slotEfektif) * 100) : (total.Hadir ? 100 : 0);
    return { total, perSesi };
  }

  // Rekap kehadiran Santri per periode. Kehadiran dihitung satu status per sesi
  // (paling baru), supaya koreksi absensi tidak terhitung dua kali.
  function rekapKehadiranSantri(santriId, dari, sampai, sesiList) {
    const list = sesiList || SESI_REKAP; const allDays = tanggalRange(dari, sampai); const records = dedupeKehadiran(db.kehadiran.filter(k => k.santriId === santriId && allDays.includes(k.tanggal))); const recDates = new Set(records.map(r => r.tanggal)); const days = allDays.filter(tgl => { const d = new Date(tgl + 'T12:00:00').getDay(); return (d >= 1 && d <= 5) || recDates.has(tgl); }); return rekapKehadiranOrang(records, days, list, list);
  }
  function _oldRekapKehadiranSantri(santriId, dari, sampai, sesiList) {
    const list = sesiList || SESI_REKAP;
    const days = tanggalRange(dari, sampai);
    const records = dedupeKehadiran(
      db.kehadiran.filter(k => k.santriId === santriId && days.includes(k.tanggal)));
    return rekapKehadiranOrang(records, days, list, list);
  }

  // Rekap kehadiran Ustadz per periode. Alfa = sesi yang tanpa catatan absensi.
  function rekapKehadiranUstadz(ustadzId, dari, sampai, sesiList) {
    const list = sesiList || SESI_REKAP; const allDays = tanggalRange(dari, sampai); const records = dedupeAbsensiUstadz(db.absensiUstadz.filter(a => a.ustadzId === ustadzId && allDays.includes(a.tanggal))); const recDates = new Set(records.map(r => r.tanggal)); const days = allDays.filter(tgl => { const d = new Date(tgl + 'T12:00:00').getDay(); return (d >= 1 && d <= 5) || recDates.has(tgl); }); return rekapKehadiranOrang(records, days, list, list);
  }
  function _oldRekapKehadiranUstadz(ustadzId, dari, sampai, sesiList) {
    const list = sesiList || SESI_REKAP;
    const days = tanggalRange(dari, sampai);
    const records = dedupeAbsensiUstadz(
      db.absensiUstadz.filter(a => a.ustadzId === ustadzId && days.includes(a.tanggal)));
    return rekapKehadiranOrang(records, days, list, list);
  }

  // Absensi ustadz juga bisa terekam ganda bila ada koreksi cepat; ambil yang
  // paling baru seperti pada kehadiran santri.
  function dedupeAbsensiUstadz(records) {
    const latest = {};
    (records || []).forEach(a => {
      const key = [a.ustadzId, a.tanggal, a.sesi || 'Subuh'].join('|');
      const prev = latest[key];
      if (!prev || (a._created || 0) >= (prev._created || 0)) latest[key] = a;
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
        // Tanggal libur lembaga tidak dihitung sebagai hari setoran.
        if (isHariKerja(cek) && !isLiburLembaga(todayLocal(cek))) {
          const tgl = todayLocal(cek);
          if (!sudah(s.id, tgl) && notifCount < maxNotif) {
            const adaSetoran = db.ziyadahHafalan.some(z => z.santriId === s.id && z.tanggal === tgl)
              || db.ziyadahBacaan.some(z => z.santriId === s.id && z.tanggal === tgl)
              || db.tahsin.some(z => z.santriId === s.id && z.tanggal === tgl);
            const isAbsenSakitIzin = (db.kehadiran || []).some(k => k.santriId === s.id && k.tanggal === tgl && (k.status === 'Sakit' || k.status === 'Izin' || k.status === 'Libur'));
            if (!adaSetoran && !isAbsenSakitIzin) {
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
    santri: () => (db.santri || []),
    getSettings: () => (db.settings || {}),
    setToken, getToken, setSession: () => {}, getSession, clearSession, login, logout, changePassword,
    recalcHalaqah, findSantri, findWali, findUstadz, findUstadzByName, findHalaqahById, findHalaqahByName, ustadzIdsForHalaqah, ustadzNamesForHalaqah, halaqahHasUstadz, findHalaqahForUstadz,
    activeProgramsForSantri, halaqahForSantriProgram, halaqahForSantri, santriHasProgram, santriHasHalaqah, programsForSantriHalaqah, configureSantriPrograms, programSummaryForSantri, halaqahSummaryForSantri,
    tingkatOptions, kelasOptions, tingkatForSantri, kelasForSantri, normalizeSantriEducation, kelasLabel, educationLabel,
    simpanTingkat, hapusTingkat, simpanKelas, hapusKelas, tingkatAda, kelasDipakaiDiTalim, jumlahSantriKelas, naturalKelasSort,
    uploadKitab, talimMapel, findTalimMapel, talimClassKey, talimClassFromKey, talimClassLabel, talimAssignmentsForUstadz, talimMalamSettings, search,
    waSend, waLog, waReady, waAutoEnabled, waSendWali, waNomorWali, waStatus, waQrDataUrl, waLogServer,
    waAutoTriggerSettings, waAutoHour, waAutoReminder, waQueueStatus, waStopQueue, waPreviewTest, waSendTestRecap, waAbsensiMessage,
    lastZiyadah, lastHafalan, totalHafalanSantri, avgNilai, kehadiranBulan, kehadiranRentang, dedupeKehadiran,
    setoranRentang, avgNilaiRentang, padaRentang, juzHafalanDisplay,
    absensiUstadzOf, absensiUstadzRow, absensiUstadzTanggal, absensiUstadzBulan, simpanAbsensiUstadz,
    liburkanHalaqah, batalkanLiburHalaqah, halaqahLiburInfo, getLiburLembaga, isLiburLembaga, getLiburLembagaInfo, tambahLiburLembaga, hapusLiburLembaga, terapkanLiburLembaga,
    rekapKehadiranSantri, rekapKehadiranUstadz, tanggalRange, tambahHari, SESI_REKAP,
    addNotif, notifFor, clearNotifs, checkSetoranTerlewat
  };
})();
