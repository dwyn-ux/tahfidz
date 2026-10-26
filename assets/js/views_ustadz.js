/* ============================================================
   Tahfidzku — Ustadz Views
   ============================================================ */
const Ustadz = (() => {

  function nav(active) {
    return [
      { view: 'ustadz_dashboard', label: 'Dashboard', active: active === 'ustadz_dashboard' },
      { view: 'ustadz_absensi', label: 'Absensi', active: active === 'ustadz_absensi' },
      { view: 'ustadz_talim', label: 'Ta’lim Malam', active: active === 'ustadz_talim' },
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

  // Saat WA otomatis dimatikan, penyimpanan tidak perlu memunculkan toast
  // pengiriman apa pun. Ustadz cukup menerima konfirmasi "Tersimpan".
  function formatPesanSetoranWA({ santri, awal, hingga, jumlah, nilai, keterangan, tanggal }) {
    const d = Store.get();
    const lembaga = (d.settings && d.settings.namaLembaga ? d.settings.namaLembaga.trim().toUpperCase() : "PONDOK PESANTREN ASH-SHIDDIQ");
    const k = Store.kelasForSantri ? Store.kelasForSantri(santri) : (santri.kelas || '');
    const t = Store.tingkatForSantri ? Store.tingkatForSantri(santri) : (santri.tingkat || '');
    const kelas = (t && k) ? (t + ' - Kelas ' + k) : (k ? ('Kelas ' + k) : (t || '-'));

    const now = new Date();
    let tglStr;
    try {
      const tDate = tanggal ? new Date(tanggal + 'T12:00:00') : now;
      tglStr = tDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch (_) {
      tglStr = tanggal || Store.todayStr();
    }
    const jamStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':') + ' WIB';

    return `*INFORMASI CAPAIAN TAHFIDZ AL_QUR'AN SANTRI*
*${lembaga}*

Nama     : ${santri.nama || '-'}
Kelas     : ${kelas}
Tanggal  : ${tglStr}
Waktu     : ${jamStr}

*Laporan*
Awal             : ${awal || '-'}
Hingga           : ${hingga || '-'}
Jumlah Hafalan : ${jumlah || '-'}
Nilai : ${nilai !== undefined && nilai !== null && nilai !== '' ? nilai : '-'}
Keterangan      :  ${keterangan || '-'}

Demikian Laporan Tahfidz Al-Qur'an kami sampaikan semoga menjadi Investasi Akhirat Keluarga kelak. Amiin`;
  }

  function waReport(santriId, message) {
    try {
      const tr = Store.waAutoTriggerSettings();
      if (!tr.setoran) return Promise.resolve(false);
      if (!Store.waAutoEnabled()) return Promise.resolve(false);
      return Store.waSendWali(santriId, message).then(ok => {
        UI.toast(ok ? 'WA terkirim ke wali ✓' : 'WA gagal dikirim ke wali (cek Log WhatsApp di Admin)', ok ? 'success' : 'error');
      }).catch(err => {
        console.warn('waReport error:', err);
      });
    } catch (e) {
      console.warn('waReport catch:', e);
      return Promise.resolve(false);
    }
  }

  function myHalaqah() {
    if (_scope === 'all') return null; // admin: tidak terikat 1 halaqah
    const session = Store.getSession();
    const u = Store.findUstadz(session.refId);
    const h = Store.findHalaqahForUstadz(u);
    return h ? h.nama : (u ? u.halaqah : null);
  }
  function mySantri(program) {
    const db = Store.get();
    if (_scope === 'all') return db.santri; // admin: semua santri
    const h = myHalaqah();
    return h ? db.santri.filter(s => Store.santriHasHalaqah(s, h, program)) : [];
  }
  // ustadzId yang dicatat: ustadz session, atau ustadz halaqah santri (jika admin)
  function ustadzIdFor(santriId, program) {
    const session = Store.getSession();
    if (session && session.role === 'ustadz') return session.refId;
    const s = Store.findSantri(santriId);
    if (!s) return null;
    const h = Store.halaqahForSantriProgram(s, program || s.level);
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
    // Rekap memakai satu status per sesi walau beberapa ustadz sama-sama
    // mencatat halaqah yang sama.
    const hadirHariIni = Store.dedupeKehadiran(db.kehadiran.filter(k => k.tanggal === t && santri.some(x => x.id === k.santriId)));
    const sesiStats = SESI.map(s => {
      const records = hadirHariIni.filter(k => k.sesi === s);
      const h = records.filter(k => k.status === 'Hadir').length;
      const i = records.filter(k => k.status === 'Izin').length;
      const b = santri.length - records.length;
      return { s, h, i, b };
    });
    // Ustadz juga punya absensi sendiri; tampilkan ringkasannya di dashboard
    // supaya bisa absen tanpa membuka halaman absensi.
    const session = Store.getSession();
    const selfUstadz = (c.role === 'ustadz' && session) ? Store.findUstadz(session.refId) : null;
    const absenUstadzCard = selfUstadz ? `
      <div class="section-title mt">Absensi Ustadz Hari Ini</div>
      ${SESI.map(s => {
      const rec = Store.absensiUstadzOf(selfUstadz.id, t, s);
      return `<div class="row center" style="justify-content:space-between;padding:5px 0">
          <span style="font-size:13px">${UI.esc(s)}</span>
          ${rec ? `<span class="badge ${statusBadgeClass(rec.status)}">${UI.esc(rec.status)} ${UI.fmtDateTime(rec.waktu)}</span>` : '<span class="muted" style="font-size:12px">Belum absen</span>'}
        </div>`;
    }).join('')}
      <button class="clay-btn primary mt" id="btn-dashboard-absen-ustadz" style="width:100%;justify-content:center">Absen Ustadz</button>` : '';
    const bulanIni = Store.todayStr().slice(0, 7);
    const kehadiranBulan = santri.map(s => {
      const k = Store.kehadiranBulan(s.id, bulanIni);
      return {
        subuh: k.filter(k => k.sesi === 'Subuh' && k.status === 'Hadir').length,
        ashar: k.filter(k => k.sesi === 'Ashar' && k.status === 'Hadir').length,
        maghrib: k.filter(k => k.sesi === 'Maghrib' && k.status === 'Hadir').length,
        isya: k.filter(k => k.sesi === 'Isya' && k.status === 'Hadir').length
      };
    });
    const totalSubuh = kehadiranBulan.reduce((a, b) => a + b.subuh, 0);
    const totalAshar = kehadiranBulan.reduce((a, b) => a + b.ashar, 0);
    const totalMaghrib = kehadiranBulan.reduce((a, b) => a + b.maghrib, 0);
    const totalIsya = kehadiranBulan.reduce((a, b) => a + b.isya, 0);

    document.getElementById('view-content').innerHTML = `
      <div class="grid kpi">
        ${Shared.statCard(Shared.ICONS.users, santri.length, 'Santri Diampu', '#16A34A')}
        ${sesiStats.map(st => Shared.statCard(
          st.s === 'Subuh' || st.s === 'Ashar' ? Shared.ICONS.sun : st.s === 'Maghrib' ? Shared.ICONS.sunset : Shared.ICONS.moon,
          st.h + '/' + santri.length + ' Hadir', st.s, '#22C55E')).join('')}
      </div>
      <div class="grid kpi mt">
        ${Shared.statCard(Shared.ICONS.sun, totalSubuh, 'Kehadiran Subuh (Bulan Ini)', '#22C55E')}
        ${Shared.statCard(Shared.ICONS.sun, totalAshar, 'Kehadiran Ashar (Bulan Ini)', '#22C55E')}
        ${Shared.statCard(Shared.ICONS.sunset, totalMaghrib, 'Kehadiran Maghrib (Bulan Ini)', '#22C55E')}
        ${Shared.statCard(Shared.ICONS.moon, totalIsya, 'Kehadiran Isya (Bulan Ini)', '#22C55E')}
      </div>
      <div class="grid cols-2 mt">
        <div class="clay-card">
          <div class="section-title">Shortcut</div>
          <div class="row">
            <button class="clay-btn primary" data-go="ustadz_absensi">Absensi${selfUstadz ? ` · ${UI.esc(sesiSaatIni())}` : ''}</button>
            <button class="clay-btn secondary" data-go="ustadz_pembelajaran"> Pembelajaran</button>
            ${selfUstadz ? '<button class="clay-btn ghost" id="btn-dashboard-liburkan" style="color:#7e22ce;border:1px solid #d8b4fe">Liburkan Halaqah</button>' : ''}
          </div>
          ${selfUstadz ? `<div class="muted" style="font-size:12px;margin-top:6px">Tombol Absensi membuka sesi <b>${UI.esc(sesiSaatIni())}</b> sesuai jam sekarang. Sesi lain tetap bisa dipilih manual di halaman absensi.</div>` : ''}
          ${absenUstadzCard}
        </div>
        <div class="clay-card">
          <div class="section-title"> Daftar Santri</div>
          ${santri.map(s => {
            const h = Store.totalHafalanSantri(s.id);
            return `<div class="row center" style="justify-content:space-between;padding:6px 0"><span>${UI.esc(s.nama)} <span class="muted" style="font-size:12px">(${UI.esc(Store.programSummaryForSantri(s))})</span></span><span class="badge green">${h ? formatHafalan(h) : '-'}</span></div>`;
          }).join('') || '<div class="empty">Tidak ada santri.</div>'}
        </div>
      </div>`;
    document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => App.navigate(b.dataset.go));
    const btnAbsen = document.getElementById('btn-dashboard-absen-ustadz');
    if (btnAbsen) btnAbsen.onclick = () => dialogAbsenUstadz(selfUstadz, sesiSaatIni(), t, () => dashboard());
    const btnDashLibur = document.getElementById('btn-dashboard-liburkan');
    if (btnDashLibur) btnDashLibur.onclick = () => dialogLiburkanHalaqah(selfUstadz, myHalaqah(), sesiSaatIni(), t, () => dashboard());
  }

  /* ---------------- Absensi (multi-sesi) ---------------- */
  const SESI = ['Subuh', 'Ashar', 'Maghrib', 'Isya'];
  const STATUS_USTADZ = ['Hadir', 'Izin', 'Sakit', 'Libur'];

  // Batas ATAS tiap sesi: sesi tetap berlaku sampai menit ini (eksklusif).
  // Subuh berlaku sampai pukul 12.00, Ashar sampai 18.00, Maghrib sampai
  // 19.30, Isya sampai 20.00, dan setelah itu Ta'lim Malam. Dengan begitu
  // membuka absensi pukul 15.15 masuk sesi Ashar dan pukul 18.10 masuk sesi
  // Maghrib.
  const BATAS_SESI_OTOMATIS = [
    { batasMenit: 12 * 60, sesi: 'Subuh' },
    { batasMenit: 18 * 60, sesi: 'Ashar' },
    { batasMenit: 19 * 60 + 30, sesi: 'Maghrib' }
  ];
  const SESI_SETELAH_BATAS = 'Isya';

  // Sesi yang aktif menurut jam sekarang; halaman absensi tetap membuka sesi
  // ini walaupun catatannya sudah tersimpan, supaya koreksi siang hari mudah.
  // Sesi ini hanya pilihan awal — ustadz bebas memilih sesi lain.
  // Objek waktu diterima sebagai parameter agar batas jam bisa diuji langsung.
  function sesiSaatIni(now = new Date()) {
    // Objek waktu dari realm lain (mis. iframe) tidak selalu lolos
    // `instanceof Date`, jadi dicek dari metodenya.
    if (!now || typeof now.getHours !== 'function' || typeof now.getMinutes !== 'function') {
      now = new Date();
    }
    const menit = Number(now.getHours()) * 60 + Number(now.getMinutes());
    for (let i = 0; i < BATAS_SESI_OTOMATIS.length; i++) {
      if (menit < BATAS_SESI_OTOMATIS[i].batasMenit) return BATAS_SESI_OTOMATIS[i].sesi;
    }
    return SESI_SETELAH_BATAS;
  }

  // Dipakai layar lain (mis. penanda sesi otomatis di halaman absensi) tanpa
  // perlu ikut menyalin tabel batas jam di atas.
  function sesiUntukWaktu(now) {
    return sesiSaatIni(now);
  }

  function statusBadgeClass(status) {
    return status === 'Hadir' ? 'green' : status === 'Izin' ? 'warn' : status === 'Sakit' ? 'blue' : status === 'Libur' ? 'purple' : 'danger';
  }

  function paintStatusButton(btn, status) {
    btn.className = 'clay-btn sm ghost';
    btn.style = '';
    if (status === 'Hadir') btn.className = 'clay-btn sm primary';
    if (status === 'Izin') { btn.className = 'clay-btn sm'; btn.style = 'background:#FACC15;color:#000'; }
    if (status === 'Sakit') btn.className = 'clay-btn sm secondary';
    if (status === 'Alfa') btn.className = 'clay-btn sm danger';
    if (status === 'Libur') { btn.className = 'clay-btn sm'; btn.style = 'background:#a855f7;color:#fff'; }
  }

  /* Dialog absen ustadz sendiri. Dipakai dari dashboard dan dari halaman
     absensi; status tersimpan per (tanggal, sesi) sehingga koreksi memperbarui
     catatan yang sama. */
  function dialogAbsenUstadz(ustadz, sesi, tanggal, onDone) {
    if (!ustadz) return;
    const existing = Store.absensiUstadzOf(ustadz.id, tanggal, sesi);
    const picked = { status: (existing && existing.status) || 'Hadir' };
    const halaqah = Store.findHalaqahForUstadz(ustadz);
    const hNama = halaqah ? halaqah.nama : (ustadz.halaqah || 'Halaqah');

    const { modal } = UI.openModal({
      title: 'Absensi Ustadz',
      sub: ustadz.nama + ' - ' + UI.fmtDate(tanggal) + ' - Sesi ' + sesi,
      dismissable: false,
      bodyHTML: `
        <div class="muted" style="font-size:13px;margin-bottom:10px">Absen diri dulu sebelum mengabsen Santri. Pilih <b>Libur</b> bila ada kegiatan dan halaqah ditiadakan.</div>
        <div class="row" style="gap:6px;flex-wrap:wrap" id="au-status">
          ${STATUS_USTADZ.map(s => `<button type="button" class="clay-btn sm ghost" data-au-st="${UI.esc(s)}">${UI.esc(s)}</button>`).join('')}
        </div>
        <div id="au-libur-info" style="display:${picked.status === 'Libur' ? 'block' : 'none'};margin-top:10px;padding:8px 12px;background:#faf5ff;border-radius:var(--radius-md);border:1px solid #e9d5ff">
          <div style="font-size:12px;color:#7e22ce">
            <b>Mode Libur Halaqah:</b> Seluruh santri di <b>${UI.esc(hNama)}</b> akan otomatis dicatat sebagai <b>Libur</b> pada sesi ${UI.esc(sesi)} dan tidak terhitung Alfa.
          </div>
        </div>
        <div class="mt">
          ${UI.field('Catatan / Keterangan (opsional)', `<input class="clay-input" id="au-catatan" placeholder="${picked.status === 'Libur' ? 'Contoh: Ada kegiatan pesantren / Rihlah santri' : 'Contoh: diasuh ustadz pengganti'}" value="${UI.esc((existing && existing.catatan) || '')}">`)}
        </div>
        ${existing ? `<div class="muted" style="font-size:12px;margin-top:8px">Sudah absen (${UI.esc(existing.status)}) pukul ${UI.fmtDateTime(existing.waktu)}. Simpan lagi untuk mengoreksi.</div>` : ''}`,
      actions: [
        { label: 'Nanti Saja', cls: 'ghost', onClick: (m, c) => { c(); if (onDone) onDone(null); } },
        {
          label: 'Simpan & Lanjut', cls: 'primary',
          onClick: async (m, c) => {
            const input = m.querySelector('#au-catatan');
            const catatan = input ? input.value.trim() : '';
            let ok = false;
            if (picked.status === 'Libur') {
              ok = await Store.liburkanHalaqah(ustadz.id, [sesi], hNama, catatan || 'Ada kegiatan / Libur', tanggal);
              if (ok) UI.toast('Halaqah ' + hNama + ' diliburkan untuk sesi ' + sesi + ' ✓', 'success');
            } else {
              ok = await Store.simpanAbsensiUstadz(ustadz.id, sesi, picked.status, catatan, tanggal);
              if (ok) {
                Store.log('Absensi ustadz ' + picked.status + ' ' + sesi);
                UI.toast('Absensi ustadz ' + picked.status + ' tersimpan', 'success');
              }
            }
            if (!ok) return;
            c();
            if (onDone) onDone(picked.status);
          }
        }
      ]
    });
    modal.querySelectorAll('[data-au-st]').forEach(btn => {
      if (btn.dataset.auSt === picked.status) paintStatusButton(btn, picked.status);
      btn.onclick = () => {
        picked.status = btn.dataset.auSt;
        modal.querySelectorAll('[data-au-st]').forEach(b => paintStatusButton(b, b.dataset.auSt === picked.status ? picked.status : ''));
        const liburInfo = modal.querySelector('#au-libur-info');
        if (liburInfo) liburInfo.style.display = picked.status === 'Libur' ? 'block' : 'none';
        const input = modal.querySelector('#au-catatan');
        if (input && !input.value) {
          input.placeholder = picked.status === 'Libur' ? 'Contoh: Ada kegiatan pesantren / Rihlah santri' : 'Contoh: diasuh ustadz pengganti';
        }
      };
    });
  }

  /* Dialog khusus meliburkan halaqah. Ustadz bisa memilih hanya sesi ini atau semua sesi hari ini,
     lengkap dengan alasan kegiatan yang dicatat ke absensi ustadz dan seluruh santri di halaqah. */
  function dialogLiburkanHalaqah(ustadz, halaqahNama, initialSesi, tanggal, onDone) {
    if (!ustadz) return;
    const t = tanggal || Store.todayStr();
    const halaqah = halaqahNama ? Store.findHalaqahByName(halaqahNama) : Store.findHalaqahForUstadz(ustadz);
    const hNama = halaqah ? halaqah.nama : (ustadz.halaqah || halaqahNama || 'Halaqah');
    const existingAU = Store.absensiUstadzOf(ustadz.id, t, initialSesi);
    const existingCatatan = (existingAU && existingAU.catatan) || '';

    const { modal } = UI.openModal({
      title: 'Liburkan Halaqah',
      sub: `${hNama} — ${UI.fmtDate(t)}`,
      dismissable: false,
      bodyHTML: `
        <div style="font-size:13px;color:var(--text-soft);margin-bottom:12px">
          Gunakan menu ini jika ada kegiatan/acara dan halaqah ditiadakan. Absensi ustadz dan seluruh santri di halaqah ini akan otomatis dicatat <b>Libur</b> sehingga tidak terhitung sebagai Alfa.
        </div>
        <div style="margin-bottom:12px">
          ${UI.field('Tanggal Libur', `<input type="date" class="clay-input" id="libur-tanggal-input" value="${UI.esc(t)}" min="${UI.esc(Store.todayStr())}">`)}
          <div class="muted" style="font-size:11px;margin-top:4px">Bisa untuk hari ini atau diatur jauh hari ke depan (besok, minggu depan, dst).</div>
        </div>
        <div class="field-label">Pilih Sesi yang Diliburkan</div>
        <div class="row" style="gap:8px;margin-bottom:12px;flex-wrap:wrap">
          <label class="clay-card pad-sm" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:8px 12px;margin:0">
            <input type="radio" name="libur-scope" value="sesi" checked>
            <span>Hanya Sesi <b>${UI.esc(initialSesi)}</b></span>
          </label>
          <label class="clay-card pad-sm" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:8px 12px;margin:0">
            <input type="radio" name="libur-scope" value="hari">
            <span data-libur-hari-label>Semua Sesi Hari Ini (${SESI.length} Sesi)</span>
          </label>
          <label class="clay-card pad-sm" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:8px 12px;margin:0">
            <input type="radio" name="libur-scope" value="custom">
            <span>Pilih Sesi Tertentu</span>
          </label>
        </div>
        <div id="libur-sesi-custom" style="display:none;margin-bottom:12px;padding:8px 12px;background:var(--bg);border-radius:var(--radius-md)">
          <div class="muted" style="font-size:12px;margin-bottom:6px">Centang sesi yang diliburkan:</div>
          <div class="row" style="gap:10px;flex-wrap:wrap">
            ${SESI.map(s => `<label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer"><input type="checkbox" data-libur-sesi-check value="${UI.esc(s)}" ${s === initialSesi ? 'checked' : ''}> ${UI.esc(s)}</label>`).join('')}
          </div>
        </div>
        <div class="mt">
          <label class="field-label">Keterangan / Alasan Kegiatan</label>
          <input class="clay-input" id="libur-alasan" placeholder="Contoh: Ada kegiatan gotong royong / Rihlah santri / Libur bersama" value="${UI.esc(existingCatatan)}">
          <div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap">
            <span class="muted" style="font-size:11px;align-self:center">Contoh cepat:</span>
            ${['Kegiatan Lembaga', 'Kerja Bakti', 'Rihlah / Outing', 'Kajian Akbar', 'Ujian Sekolah', 'Libur Nasional'].map(tag =>
              `<button type="button" class="clay-btn sm ghost" data-tag-alasan="${UI.esc(tag)}" style="font-size:11px;padding:2px 8px">${UI.esc(tag)}</button>`
            ).join('')}
          </div>
        </div>
        <div class="clay-card pad-sm mt" style="background:#faf5ff;border:1px solid #e9d5ff">
          <div style="font-size:12px;color:#6b21a8">
            Santri yang terdaftar di <b>${UI.esc(hNama)}</b> akan otomatis mendapatkan status <b>Libur</b> pada sesi tersebut.
          </div>
        </div>`,
      actions: [
        { label: 'Batal', cls: 'ghost', onClick: (m, c) => c() },
        {
          label: 'Liburkan Halaqah', cls: 'primary',
          onClick: async (m, c) => {
            const alasan = (m.querySelector('#libur-alasan')?.value || '').trim() || 'Ada kegiatan / Libur';
            const tgl = m.querySelector('#libur-tanggal-input')?.value || t;
            const scope = m.querySelector('input[name="libur-scope"]:checked')?.value || 'sesi';
            let sesiList = [initialSesi];
            if (scope === 'hari') {
              sesiList = SESI.slice();
            } else if (scope === 'custom') {
              sesiList = [...m.querySelectorAll('[data-libur-sesi-check]:checked')].map(cb => cb.value);
              if (!sesiList.length) {
                UI.toast('Pilih minimal satu sesi', 'error');
                return;
              }
            }

            const ok = await Store.liburkanHalaqah(ustadz.id, sesiList, hNama, alasan, tgl);
            if (ok) {
              UI.toast(`Halaqah ${hNama} diliburkan ${UI.fmtDate(tgl)} (${sesiList.join(', ')}) ✓`, 'success');
              c();
              if (onDone) onDone(sesiList);
            }
          }
        }
      ]
    });

    modal.querySelectorAll('input[name="libur-scope"]').forEach(radio => {
      radio.onchange = () => {
        const customDiv = modal.querySelector('#libur-sesi-custom');
        if (customDiv) customDiv.style.display = radio.value === 'custom' ? 'block' : 'none';
      };
    });

    // Tanggal bisa berbeda dari hari ini; perbarui sub judul & label "Hari Ini"
    // agar pilihan sesi tetap jelas untuk tanggal terpilih.
    const tanggalInput = modal.querySelector('#libur-tanggal-input');
    if (tanggalInput) {
      tanggalInput.onchange = () => {
        const tgl = tanggalInput.value || t;
        const sub = modal.querySelector('.modal-sub');
        if (sub) sub.textContent = `${hNama} — ${UI.fmtDate(tgl)}`;
        const hariLabel = modal.querySelector('[data-libur-hari-label]');
        if (hariLabel) hariLabel.textContent = (tgl === Store.todayStr() ? 'Semua Sesi Hari Ini' : 'Semua Sesi Tanggal Terpilih') + ` (${SESI.length} Sesi)`;
      };
    }

    modal.querySelectorAll('[data-tag-alasan]').forEach(btn => {
      btn.onclick = () => {
        const input = modal.querySelector('#libur-alasan');
        if (input) {
          input.value = btn.dataset.tagAlasan;
          input.focus();
        }
      };
    });
  }

  /* Konfirmasi membatalkan status libur untuk membuka kembali sesi */
  function batalLiburConfirm(ustadz, halaqahNama, sesi, tanggal, onDone) {
    if (!ustadz) return;
    const t = tanggal || Store.todayStr();
    const hNama = halaqahNama || (ustadz.halaqah || 'Halaqah');
    UI.confirmDialog(
      'Batalkan Status Libur',
      `Status libur pada sesi <b>${UI.esc(sesi)}</b> (${UI.fmtDate(t)}) untuk halaqah <b>${UI.esc(hNama)}</b> akan dibatalkan sehingga sesi dapat diabsen secara normal kembali. Lanjutkan?`,
      async () => {
        const ok = await Store.batalkanLiburHalaqah(ustadz.id, [sesi], hNama, t);
        if (ok) {
          UI.toast(`Status libur sesi ${sesi} dibatalkan`, 'info');
          if (onDone) onDone();
        }
      }
    );
  }

  function absensi(initialSesi = '') {
    const c = ctx(); _scope = c.scope;
    const isTalimSession = (s) => (s === 'Ta’lim Malam' || s === "Ta'lim Malam");
    let isTalim = isTalimSession(initialSesi);
    // Tanpa sesi dari pemanggil: pilih sesi dari jam sekarang, sehingga tombol
    // Absensi di dashboard langsung membuka sesi yang sedang berjalan.
    // Sesi yang dipilih sistem ini hanya nilai awal — ustadz tetap bebas
    // mengklik sesi lain kapan saja.
    const sesiOtomatis = !SESI.includes(initialSesi);
    if (sesiOtomatis) initialSesi = sesiSaatIni();
    const navItems = (c.role === 'admin') ? Admin.nav(isTalim ? 'ustadz_talim' : 'ustadz_absensi') : nav(isTalim ? 'ustadz_talim' : 'ustadz_absensi');
    Shared.shell(c.role, navItems, '');
    Shared.setHeader(isTalim ? 'Absensi Ta’lim Malam' : 'Absensi', 'Absen ustadz sendiri, lalu pilih status untuk Santri yang diabsen');
    const db = Store.get();
    // Opsi "Semua Santri" memang harus memperlihatkan seluruh roster,
    // sedangkan opsi kedua membatasi ke halaqah ustadz yang sedang login.
    const allSantri = db.santri;
    const t = Store.todayStr();
    let sesiAktif = initialSesi;
    // Penanda "Otomatis" hanya berlaku pada sesi yang dipilih sistem dan
    // hilang begitu ustadz memilih sesi sendiri.
    let sesiOtomatisAktif = sesiOtomatis;
    const ownHalaqah = myHalaqah();
    // Prioritaskan roster halaqah ustadz; seluruh santri tetap bisa dipilih
    // secara sadar bila memang perlu mencatat absensi lintas halaqah.
    let halaqahFilter = ownHalaqah || '';
    let searchTerm = '';
    let editing = null;
    // Status yang belum disimpan harus tetap ada saat daftar dirender ulang
    // karena pencarian, perpindahan filter, atau perubahan ukuran layar.
    let pendingStatus = {};

    // Absensi dicatat atas nama ustadz yang sedang absen. Satu halaqah boleh
    // diampu lebih dari satu ustadz, sehingga catatan antar ustadz tidak
    // saling menimpa. Admin tidak punya identitas ustadz, jadi admin bypass.
    const session = Store.getSession();
    const selfUstadz = (c.role === 'ustadz' && session) ? Store.findUstadz(session.refId) : null;
    const ustadzId = selfUstadz ? selfUstadz.id : '';
    const selfRecord = () => (selfUstadz ? Store.absensiUstadzOf(selfUstadz.id, t, sesiAktif) : null);
    // Sebelum absen, halaman tetap tampil tetapi status Santri terkunci.
    const locked = () => !selfUstadz || !selfRecord();

    // Untuk sesi Ta'lim Malam: filter menggunakan kelas (tingkat|kelas) sesuai
    // penugasan ta'lim ustadz, bukan halaqah. Kalau tidak ada penugasan atau
    // bukan sesi ta'lim, fallback ke semua kelas (tanpa pilihan = semua santri).
    const talimAssignments = isTalim ? Store.talimAssignmentsForUstadz(selfUstadz) : [];
    const talimKelasKeys = isTalim
      ? [...new Set(talimAssignments.flatMap(a => a.kelasKeys))]
      : [];
    // Filter kelas mode Ta'lim bersifat multi pilih: satu absensi boleh
    // mencakup beberapa kelas sekaligus. Set kosong = seluruh santri,
    // setara dengan opsi "Semua Santri".
    // Nilai awal: kelas pertama yang ditugaskan (jika ada).
    let kelasFilters = new Set(isTalim && talimKelasKeys.length ? [talimKelasKeys[0]] : []);

    function rosterForFilter() {
      // Mode ta'lim: filter santri berdasarkan kelas (tingkat + kelas pendidikan)
      // yang sedang dicentang, bisa lebih dari satu kelas.
      if (isTalimSession(sesiAktif)) {
        if (!kelasFilters.size) return allSantri; // kosong = semua santri
        return allSantri.filter(s => kelasFilters.has(Store.talimClassKey(Store.tingkatForSantri(s), Store.kelasForSantri(s))));
      }
      // Mode normal: filter berdasarkan halaqah
      const halaqah = Store.findHalaqahByName(halaqahFilter);
      return halaqah ? allSantri.filter(s => Store.santriHasHalaqah(s, halaqah)) : allSantri;
    }

    function renderAbsensi() {
      // Pencarian nama tidak mengubah cakupan absensi yang akan disimpan.
      const roster = rosterForFilter();
      // Hanya catatan ustadz ini yang ditampilkan dan diedit, sehingga absensi
      // ustadz lain di halaqah yang sama tetap utuh.
      const sessionRecords = db.kehadiran.filter(k => k.tanggal === t && k.sesi === sesiAktif && (k.ustadzId || '') === ustadzId && roster.some(s => s.id === k.santriId));
      const hasSaved = sessionRecords.length > 0;
      const isLocked = locked();
      const isEditing = isLocked ? false : (editing === null ? !hasSaved : editing);
      // Semua baris roster tetap berada di DOM. Pencarian hanya menyembunyikan
      // baris yang tidak cocok agar kolom pencarian tidak kehilangan fokus.
      const santri = roster;
      const existing = {};
      sessionRecords.forEach(k => existing[k.santriId] = k.status);
      const self = selfRecord();
      const isLibur = self && self.status === 'Libur';

      const isTalimNow = isTalimSession(sesiAktif);
      let countHadir = 0, countIzin = 0, countSakit = 0, countAlfa = 0, countLibur = 0;
      santri.forEach(s => {
        const cur = pendingStatus[s.id] || existing[s.id] || '';
        if (cur === 'Hadir') countHadir++;
        else if (cur === 'Izin') countIzin++;
        else if (cur === 'Sakit') countSakit++;
        else if (cur === 'Libur') countLibur++;
        else countAlfa++;
      });

      const rows = santri.map(s => {
        const cur = pendingStatus[s.id] || existing[s.id] || '';
        let badgeHtml = '';
        if (cur) {
          badgeHtml = `<span class="badge ${statusBadgeClass(cur)}">${UI.esc(cur)}</span>`;
        } else if (isTalimNow) {
          badgeHtml = `<span class="badge danger" style="opacity:0.85;background:#fee2e2;color:#b91c1c;border:1px dashed #f87171" title="Otomatis tercatat Alfa jika tidak dicentang Hadir">Alfa (Otomatis)</span>`;
        } else {
          badgeHtml = `<span class="muted">Belum dipilih</span>`;
        }

        return `<tr data-id="${s.id}">
          <td><b>${UI.esc(s.nama)}</b></td>
          <td>
            <div class="row" style="gap:6px">
              <button class="clay-btn sm ${cur === 'Hadir' ? 'primary' : 'ghost'}" data-st="Hadir" ${isEditing ? '' : 'disabled'}> Hadir</button>
              <button class="clay-btn sm ${cur === 'Izin' ? '' : 'ghost'}" data-st="Izin" style="${cur === 'Izin' ? 'background:#FACC15;color:#000' : ''}" ${isEditing ? '' : 'disabled'}> Izin</button>
              <button class="clay-btn sm ${cur === 'Sakit' ? 'secondary' : 'ghost'}" data-st="Sakit" ${isEditing ? '' : 'disabled'}> Sakit</button>
              <button class="clay-btn sm ${cur === 'Alfa' ? 'danger' : 'ghost'}" data-st="Alfa" ${isEditing ? '' : 'disabled'}> Alfa</button>
              <button class="clay-btn sm ${cur === 'Libur' ? '' : 'ghost'}" data-st="Libur" style="${cur === 'Libur' ? 'background:#a855f7;color:#fff' : ''}" ${isEditing ? '' : 'disabled'}> Libur</button>
            </div>
          </td>
          <td>${badgeHtml}</td>
        </tr>`;
      }).join('');

      document.getElementById('view-content').innerHTML = `
        ${Store.isLiburLembaga(t) ? (() => {
          const info = Store.getLiburLembagaInfo(t);
          return `<div class="clay-card" style="margin-bottom:14px;border-left:4px solid #a855f7;background:#faf5ff">
            <div class="row center" style="gap:10px;flex-wrap:wrap">
              <span class="badge purple" style="font-size:13px">Libur Lembaga</span>
              <b>${UI.esc((info && info.keterangan) || 'Libur Lembaga')}</b>
              <span class="muted" style="font-size:12px">Seluruh halaqah tidak perlu diabsen hari ini.</span>
            </div>
          </div>`;
        })() : ''}
        ${selfUstadz ? (isLocked ? `
        <div class="clay-card" style="margin-bottom:14px;border-left:4px solid #F59E0B">
          <div class="row" style="justify-content:space-between;align-items:center;gap:10px">
            <div>
              <b>Anda belum absen pada sesi ${UI.esc(sesiAktif)}</b>
              <div class="muted" style="font-size:12px">Catat kehadiran ustadz lebih dulu, baru pilih status Santri. Bila ada kegiatan, Anda bisa meliburkan halaqah.</div>
            </div>
            <div class="row" style="gap:8px">
              <button class="clay-btn sm secondary" id="btn-banner-liburkan" style="background:#f3e8ff;color:#7e22ce;border:1px solid #d8b4fe">Liburkan Halaqah</button>
              <button class="clay-btn primary sm" id="btn-absen-ustadz">Absen Ustadz</button>
            </div>
          </div>
        </div>` : (isLibur ? `
        <div class="clay-card" style="margin-bottom:14px;border-left:4px solid #a855f7;background:#faf5ff">
          <div class="row" style="justify-content:space-between;align-items:center;gap:10px">
            <div>
              <div class="row center" style="gap:8px">
                <span class="badge purple" style="font-size:13px">Halaqah Diliburkan</span>
                <b>Sesi ${UI.esc(sesiAktif)} — ${UI.fmtDate(t)}</b>
              </div>
              <div class="muted" style="font-size:12px;margin-top:4px">
                Keterangan: <b>${UI.esc(self.catatan || 'Ada kegiatan / libur')}</b> · Dicatat oleh ${UI.esc(self.ustadz || selfUstadz.nama)} pukul ${UI.fmtDateTime(self.waktu)}
              </div>
            </div>
            <div class="row" style="gap:8px">
              <button class="clay-btn ghost sm" id="btn-ubah-libur">Ubah Keterangan</button>
              <button class="clay-btn danger sm ghost" id="btn-batal-libur">Batal Libur (Buka Sesi)</button>
            </div>
          </div>
        </div>` : `
        <div class="clay-card" style="margin-bottom:14px;border-left:4px solid #22C55E">
          <div class="row" style="justify-content:space-between;align-items:center;gap:10px">
            <div>
              <b>Absensi ustadz tersimpan</b>
              <div class="muted" style="font-size:12px">
                <span class="badge ${statusBadgeClass(self.status)}">${UI.esc(self.status)}</span>
                oleh ${UI.esc(self.ustadz || selfUstadz.nama)} pukul ${UI.fmtDateTime(self.waktu)}${self.catatan ? ' - ' + UI.esc(self.catatan) : ''}
              </div>
            </div>
            <div class="row" style="gap:8px">
              <button class="clay-btn sm ghost" id="btn-banner-liburkan" style="color:#7e22ce;border:1px solid #d8b4fe">Liburkan Sesi Ini</button>
              <button class="clay-btn ghost sm" id="btn-absen-ustadz">Ubah Absensi Ustadz</button>
            </div>
          </div>
        </div>`)) : `
        <div class="clay-card" style="margin-bottom:14px;border-left:4px solid #EF4444">
          <div class="row" style="justify-content:space-between;align-items:center;gap:10px">
            <div>
              <b>Akun ustadz tidak terhubung ke data ustadz</b>
              <div class="muted" style="font-size:12px">Hubungi admin untuk memperbaiki relasi akun (refId) ke data ustadz.</div>
            </div>
          </div>
        </div>`}
        <div class="clay-card">
          <div class="row" style="justify-content:space-between;align-items:center">
            <div class="section-title" style="margin:0">Absensi ${UI.fmtDate(t)}</div>
            <div class="row center" style="gap:8px">
              ${isLibur ? `
                <span class="badge purple">Status: Libur</span>
                <button class="clay-btn sm danger ghost" id="btn-card-batal-libur">Batal Libur</button>
              ` : `
                ${selfUstadz ? '<button class="clay-btn sm ghost" id="btn-card-liburkan" style="color:#7e22ce;border:1px solid #d8b4fe">Liburkan Halaqah</button>' : ''}
                ${hasSaved && !isEditing
                  ? '<span class="badge green">Sudah tersimpan</span><button class="clay-btn ghost" id="btn-edit"> Edit Absensi</button>'
                  : (isLocked ? '<span class="badge warn">Menunggu absensi ustadz</span>' : '<button class="clay-btn primary" id="btn-save"> Simpan Absensi</button>')}
              `}
            </div>
          </div>
          <div class="row mb" style="margin-top:12px;align-items:center">
            <span class="muted" style="font-size:13px">Sesi:</span>
            ${SESI.map(s => `<button class="pill ${s === sesiAktif ? 'active' : ''}" data-sesi="${s}">${s === 'Subuh' ? '' : s === 'Maghrib' ? '' : ''} ${s}${s === sesiAktif && sesiOtomatisAktif ? ' · Otomatis' : ''}</button>`).join('')}
            ${sesiOtomatisAktif ? `<span class="badge blue" title="Dipilih dari jam perangkat">Otomatis · ${UI.esc(sesiUntukWaktu())}</span>` : ''}
          </div>
          <div class="row mb" style="align-items:flex-end">
            ${isTalim ? `
            <div style="flex:1;min-width:220px">
              <label class="field-label">Kelas <span class="muted" style="font-weight:400">(boleh pilih lebih dari satu)</span></label>
              <div class="row" id="abs-kelas-checks" style="gap:8px"></div>
            </div>` : `
            <div style="flex:1;min-width:180px">
              <label class="field-label">Halaqah</label>
              <select class="clay-select" id="abs-halaqah"></select>
            </div>`}
            <div style="flex:2;min-width:180px">
              <label class="field-label">Cari Santri</label>
              <input class="clay-input" id="abs-search" type="search" placeholder="Nama atau NIS santri">
            </div>
          </div>
          ${isTalimNow ? `
          <div class="clay-card pad-sm" style="background:var(--bg);margin-top:12px;margin-bottom:12px">
            <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
              <div class="row center" style="gap:6px;flex-wrap:wrap;font-size:13px">
                <span class="muted">Ringkasan:</span>
                <span class="badge green">✓ ${countHadir} Hadir</span>
                <span class="badge" style="background:#FACC15;color:#000">${countIzin} Izin</span>
                <span class="badge secondary">${countSakit} Sakit</span>
                <span class="badge danger">${countAlfa} Alfa</span>
                <span class="muted" style="font-size:12px">(Total ${santri.length} Santri)</span>
              </div>
              <div class="row" style="gap:6px">
                <button class="clay-btn sm ghost" type="button" id="btn-talim-all-hadir" ${isEditing ? '' : 'disabled'}>✓ Centang Semua Hadir</button>
                <button class="clay-btn sm ghost" type="button" id="btn-talim-clear-hadir" ${isEditing ? '' : 'disabled'}>✕ Kosongkan Centang</button>
              </div>
            </div>
            <div class="muted" style="font-size:12px;margin-top:6px">
              💡 <b>Alur Ceklis Ta'lim:</b> Santri yang dicentang berstatus <b>Hadir</b>. Santri yang tidak dicentang otomatis disimpan sebagai <b>Alfa</b>.
            </div>
          </div>` : ''}
          <div class="table-wrap mt"><table class="clay-table">
            <thead><tr><th>Santri</th><th>Status</th><th>Keterangan</th></tr></thead>
            <tbody id="abs-body">${rows || `<tr><td colspan="3"><div class="empty">Santri tidak ditemukan.</div></td></tr>`}</tbody>
          </table></div>
        </div>`;

      // Mode ta'lim: opsi kelas sesuai penugasan ustadz dan boleh dicentang
      // lebih dari satu sekaligus. Mode normal: ustadz memilih antara
      // halaqahnya atau semua santri (tetap satu pilihan).
      if (isTalim) {
        const kelasBox = document.getElementById('abs-kelas-checks');
        const checkPill = (value, label, checked) => `
          <label class="pill ${checked ? 'active' : ''}" style="display:inline-flex;align-items:center;gap:6px;padding:7px 11px;cursor:pointer">
            <input type="checkbox" data-kelas-filter value="${UI.esc(value)}" ${checked ? 'checked' : ''} style="margin:0;accent-color:${checked ? '#fff' : 'var(--primary)'}"> ${UI.esc(label)}
          </label>`;
        kelasBox.innerHTML = talimKelasKeys.map(key => checkPill(key, Store.talimClassLabel(key), kelasFilters.has(key))).join('')
          + checkPill('', 'Semua Santri', !kelasFilters.size);
        kelasBox.querySelectorAll('[data-kelas-filter]').forEach(cb => {
          cb.onchange = () => {
            const key = cb.value;
            if (!key) {
              // "Semua Santri" mengosongkan pilihan. Melepas centangnya
              // mengembalikan pilihan ke kelas pertama agar daftar santri
              // tetap jelas, bukan diam-diam kembali ke seluruh santri.
              if (cb.checked) kelasFilters = new Set();
              else if (talimKelasKeys.length) kelasFilters = new Set([talimKelasKeys[0]]);
            } else if (cb.checked) {
              kelasFilters.add(key);
            } else {
              kelasFilters.delete(key);
            }
            // Status yang belum disimpan tidak dihapus saat kelas ditambah
            // atau dikurangi, sebab santri yang sama masih berada di daftar.
            renderAbsensi();
          };
        });
      } else {
        const halaqahSelect = document.getElementById('abs-halaqah');
        halaqahSelect.innerHTML = (ownHalaqah ? '<option value="' + UI.esc(ownHalaqah) + '">' + UI.esc(ownHalaqah) + '</option>' : '')
          + '<option value="">Semua Santri</option>';
        halaqahSelect.value = halaqahFilter;
        halaqahSelect.onchange = () => {
          halaqahFilter = halaqahSelect.value;
          pendingStatus = {}; editing = null;
          renderAbsensi();
        };
      }
      const searchInput = document.getElementById('abs-search');
      searchInput.value = searchTerm;

      document.querySelectorAll('[data-sesi]').forEach(b => b.onclick = () => {
        sesiAktif = b.dataset.sesi;
        // Klik manual berarti ustadz memilih sendiri, jadi penanda
        // "Otomatis" dilepas.
        sesiOtomatisAktif = false;
        editing = null;
        pendingStatus = {};
        renderAbsensi();
        // Sesi lain punya catatan ustadz sendiri, jadi sesi yang belum absen
        // tetap meminta absen.
        mintaAbsenUstadz();
      });
      const applySearch = () => {
        const term = searchTerm.toLowerCase();
        document.querySelectorAll('#abs-body tr[data-id]').forEach(tr => {
          const s = roster.find(item => item.id === tr.dataset.id);
          const matches = !term || ((s?.nama || '').toLowerCase().includes(term)) || String(s?.nis || '').toLowerCase().includes(term);
          tr.hidden = !matches;
        });
      };
      Shared.bindSearchInput(searchInput, () => { searchTerm = searchInput.value; applySearch(); });
      applySearch();

      const btnAllHadir = document.getElementById('btn-talim-all-hadir');
      if (btnAllHadir) {
        btnAllHadir.onclick = () => {
          if (!isEditing) return;
          roster.forEach(s => {
            if (pendingStatus[s.id] !== 'Izin' && pendingStatus[s.id] !== 'Sakit') {
              pendingStatus[s.id] = 'Hadir';
            }
          });
          renderAbsensi();
        };
      }
      const btnClearHadir = document.getElementById('btn-talim-clear-hadir');
      if (btnClearHadir) {
        btnClearHadir.onclick = () => {
          if (!isEditing) return;
          roster.forEach(s => {
            if (pendingStatus[s.id] === 'Hadir') {
              delete pendingStatus[s.id];
            }
          });
          renderAbsensi();
        };
      }

      document.querySelectorAll('#abs-body tr[data-id]').forEach(tr => {
        const id = tr.dataset.id;
        tr.querySelectorAll('button[data-st]').forEach(btn => {
          btn.onclick = () => {
            if (!isEditing) return;
            const targetSt = btn.dataset.st;
            if (isTalimNow && targetSt === 'Hadir' && (pendingStatus[id] === 'Hadir' || (!pendingStatus[id] && existing[id] === 'Hadir'))) {
              pendingStatus[id] = 'Alfa';
            } else {
              pendingStatus[id] = targetSt;
            }
            renderAbsensi();
          };
        });
      });

      const editButton = document.getElementById('btn-edit');
      if (editButton) editButton.onclick = () => {
        editing = true;
        renderAbsensi();
      };

      const absenUstadzButton = document.getElementById('btn-absen-ustadz');
      if (absenUstadzButton) absenUstadzButton.onclick = openDialog;

      const openLiburDialog = () => {
        if (!selfUstadz) return;
        dialogLiburkanHalaqah(selfUstadz, halaqahFilter || ownHalaqah, sesiAktif, t, () => {
          editing = null;
          pendingStatus = {};
          renderAbsensi();
        });
      };
      const bannerLibur = document.getElementById('btn-banner-liburkan');
      if (bannerLibur) bannerLibur.onclick = openLiburDialog;
      const cardLibur = document.getElementById('btn-card-liburkan');
      if (cardLibur) cardLibur.onclick = openLiburDialog;
      const ubahLibur = document.getElementById('btn-ubah-libur');
      if (ubahLibur) ubahLibur.onclick = openLiburDialog;

      const doBatalLibur = () => {
        if (!selfUstadz) return;
        batalLiburConfirm(selfUstadz, halaqahFilter || ownHalaqah, sesiAktif, t, () => {
          editing = null;
          pendingStatus = {};
          renderAbsensi();
        });
      };
      const batalLibur = document.getElementById('btn-batal-libur');
      if (batalLibur) batalLibur.onclick = doBatalLibur;
      const cardBatalLibur = document.getElementById('btn-card-batal-libur');
      if (cardBatalLibur) cardBatalLibur.onclick = doBatalLibur;

      const saveButton = document.getElementById('btn-save');
      if (saveButton) saveButton.onclick = async () => {
        const db = Store.get();
        const t = Store.todayStr();
        const allState = {};
        roster.forEach(s => {
          const previous = sessionRecords.find(k => k.santriId === s.id);
          let status = pendingStatus[s.id] || (previous ? previous.status : '');
          if (isTalimNow && !status) {
            status = 'Alfa';
          }
          if (status) allState[s.id] = status;
        });
        // Hanya baris milik ustadz ini yang diganti, supaya catatan ustadz
        // lain pada sesi yang sama tidak ikut terhapus.
        db.kehadiran = db.kehadiran.filter(k => !(k.tanggal === t && k.sesi === sesiAktif && (k.ustadzId || '') === ustadzId && roster.some(s => s.id === k.santriId)));
        Object.keys(allState).forEach(sid => {
          const sObj = Store.findSantri(sid);
          const hObj = sObj ? Store.findHalaqahByName(sObj.halaqah) : null;
          const previous = sessionRecords.find(k => k.santriId === sid);
          // Pertahankan ID catatan yang sama saat koreksi. Dengan demikian
          // dua perangkat yang mengoreksi sesi yang sama akan memperbarui
          // baris yang sama, bukan membuat salinan lalu saling menghapus.
          // `_created` hanya diisi saat baris pertama dibuat supaya rekap
          // selalu tahu catatan mana yang paling baru.
          db.kehadiran.push({
            id: previous ? previous.id : Store.uid('k'),
            santriId: sid,
            halaqahId: hObj ? hObj.id : (myHalaqah() || ''),
            ustadzId,
            tanggal: t,
            sesi: sesiAktif,
            status: allState[sid],
            _created: previous ? (previous._created || Date.now()) : Date.now()
          });
        });
        if (!await Store.save()) return;
        Store.log('Input absensi ' + sesiAktif);
        if (isTalimNow) {
          const stats = Object.values(allState);
          const h = stats.filter(x => x === 'Hadir').length;
          const i = stats.filter(x => x === 'Izin').length;
          const sk = stats.filter(x => x === 'Sakit').length;
          const a = stats.filter(x => x === 'Alfa').length;
          UI.toast(`Absensi ${sesiAktif} tersimpan: ${h} Hadir, ${i} Izin, ${sk} Sakit, ${a} Alfa`, 'success');
        } else {
          UI.toast('Absensi ' + sesiAktif + ' tersimpan', 'success');
        }
        editing = null;
        pendingStatus = {};
        renderAbsensi();
      };
    }

    // Popup hanya muncul kalau sesi ini belum absen. Kalau sudah absen,
    // statusnya tampil di banner hijau dan bisa dikoreksi lewat tombolnya.
    function openDialog() {
      if (!selfUstadz) return;
      dialogAbsenUstadz(selfUstadz, sesiAktif, t, () => renderAbsensi());
    }
    function mintaAbsenUstadz() {
      if (selfRecord()) return;
      openDialog();
    }

    renderAbsensi();
    mintaAbsenUstadz();
  }

  /* ---------------- Ta’lim Malam ---------------- */
  function talim() {
    const c = ctx(); _scope = c.scope;
    const navItems = (c.role === 'admin') ? Admin.nav('ustadz_talim') : nav('ustadz_talim');
    Shared.shell(c.role, navItems, '');
    Shared.setHeader('Ta’lim Malam', 'Jurnal kemajuan dan absensi santri');
    const db = Store.get();
    if (!db.jurnalTalim) db.jurnalTalim = [];
    const myUstadz = Store.findUstadz(Store.getSession()?.refId);
    const myHalaqahName = myHalaqah();
    const journals = db.jurnalTalim
      .filter(j => _scope === 'all' || j.ustadzId === myUstadz?.id || j.halaqah === myHalaqahName)
      .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
    const rows = journals.map(j => `<tr>
      <td>${UI.fmtDate(j.tanggal)}</td><td>${UI.esc(j.ustadz || '-')}</td>
      <td>${UI.esc(j.mapel || '-')}</td><td>${UI.esc(j.kelas ? Store.kelasLabel(j.tingkat, j.kelas) : '-')}</td>
      <td><b>${UI.esc(j.judulKitab)}</b></td><td>${UI.esc(j.bab)}</td>
      <td>${UI.esc(j.pembahasan)}</td><td>${UI.esc(j.halaman)}</td>
      <td><button class="clay-btn sm ghost" type="button" data-continue-talim="${UI.esc(j.id)}">Lanjutkan</button></td>
    </tr>`).join('');
    const allMapel = Store.talimMapel();
    const myAssignments = Store.talimAssignmentsForUstadz(myUstadz);
    const myMapelIds = new Set(myAssignments.map(a => a.mapel.id));
    const mapelWithKitab = allMapel.filter(m => m.kitabUrl || m.kitabNama);
    const kitabCardsHTML = mapelWithKitab.length ? mapelWithKitab.map(m => {
      const isMine = myMapelIds.has(m.id);
      const sizeStr = m.kitabSize ? ` · ${(m.kitabSize / (1024 * 1024)).toFixed(1)} MB` : '';
      return `
        <div class="clay-card pad-sm" style="flex:1 1 240px;max-width:340px;background:var(--bg)">
          <div class="row" style="justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-size:12px;color:var(--text-soft);font-weight:600">${UI.esc(m.nama)}${isMine ? ' · <span class="badge green" style="font-size:10px;padding:2px 5px">Diajar</span>' : ''}</div>
              <div style="font-weight:bold;margin-top:2px;font-size:14px">📖 ${UI.esc(m.kitabNama || m.nama)}</div>
              <div class="muted" style="font-size:11px;margin-top:2px">Format PDF${sizeStr}</div>
            </div>
            ${m.kitabUrl ? `<button class="clay-btn sm primary" type="button" data-buka-kitab="${UI.esc(m.id)}">📖 Baca</button>` : ''}
          </div>
        </div>`;
    }).join('') : '<div class="muted" style="font-size:13px">Belum ada file kitab yang diunggah oleh admin di menu Ta’lim.</div>';

    document.getElementById('view-content').innerHTML = `
      <div class="clay-card mb">
        <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
          <div>
            <div class="section-title" style="margin:0">📖 Kitab Pegangan Ta’lim</div>
            <div class="muted" style="font-size:12px;margin-top:2px">Akses dan baca materi kitab langsung dari web untuk mempermudah saat mengajar.</div>
          </div>
        </div>
        <div class="row" style="gap:10px;flex-wrap:wrap">${kitabCardsHTML}</div>
      </div>
      <div class="clay-card">
        <div class="row" style="justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div><div class="section-title" style="margin:0">Jurnal Kemajuan Ta’lim Malam</div><div class="muted" style="font-size:13px">Gunakan tombol Lanjutkan pada histori untuk memakai data jurnal sebelumnya.</div></div>
          <div class="row"><button class="clay-btn primary" id="btn-talim-add">+ Isi Jurnal</button></div>
        </div>
        <div class="table-wrap mt"><table class="clay-table"><thead><tr><th>Tanggal</th><th>Ustadz</th><th>Mapel</th><th>Tingkat & Kelas</th><th>Judul Kitab</th><th>Bab</th><th>Pembahasan</th><th>Halaman</th><th>Aksi</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="9"><div class="empty">Belum ada jurnal ta’lim malam.</div></td></tr>'}</tbody></table></div>
      </div>`;
    const btnTalimAbs = document.getElementById('btn-talim-absen'); if (btnTalimAbs) btnTalimAbs.onclick = () => UI.toast('Absensi Ta’lim tersendiri akan segera hadir', 'info');
    document.getElementById('btn-talim-add').onclick = () => talimForm();
    document.querySelectorAll('[data-continue-talim]').forEach(btn => {
      btn.onclick = () => {
        const journal = journals.find(j => j.id === btn.dataset.continueTalim);
        if (journal) talimForm(journal);
      };
    });
    document.querySelectorAll('[data-buka-kitab]').forEach(btn => {
      btn.onclick = () => {
        const item = Store.findTalimMapel(btn.dataset.bukaKitab);
        if (item && item.kitabUrl) {
          UI.openKitabViewer({
            title: item.kitabNama || item.nama,
            sub: 'Mapel: ' + item.nama,
            url: item.kitabUrl
          });
        }
      };
    });
  }

  function talimForm(sourceJournal = null) {
    const db = Store.get();
    const session = Store.getSession();
    const currentUstadz = Store.findUstadz(session?.refId);
    const isAdmin = session?.role === 'admin';
    const source = sourceJournal || {};
    // ID dibuat saat formulir dibuka, bukan setiap tombol Simpan ditekan.
    // Jadi jika sebuah klik terkirim ulang, server akan meng-upsert jurnal
    // yang sama alih-alih membuat baris Ta'lim baru.
    const journalId = Store.uid('jt');
    const copiedFrom = sourceJournal
      ? `<div class="badge blue" style="margin-bottom:12px">Data dilanjutkan dari jurnal ${UI.esc(UI.fmtDate(source.tanggal))}. Silakan sesuaikan materi atau halaman terbaru.</div>`
      : '';
    const malamDefaults = Store.talimMalamSettings();
    const defaultUstadzId = source.ustadzId || malamDefaults.ustadzIds[0] || '';
    const body = `
      ${copiedFrom}
      ${UI.field('Tanggal', `<input class="clay-input" id="f-talim-tgl" type="date" value="${Store.todayStr()}">`)}
      ${UI.field('Ustadz', isAdmin
        ? `<select class="clay-select" id="f-talim-ustadz"><option value="">- Pilih Ustadz -</option>${UI.optionsFromList(db.ustadz.map(u => ({ v: u.id, l: u.nama })), 'v', 'l', defaultUstadzId)}</select>`
        : `<input class="clay-input" value="${UI.esc(currentUstadz?.nama || 'Ustadz')}" disabled>`)}
      ${UI.field('Mapel', `<select class="clay-select" id="f-talim-mapel"></select>`)}
      ${UI.field('Tingkat & Kelas', `<select class="clay-select" id="f-talim-kelas"></select><div class="muted" id="f-talim-assignment-info" style="font-size:12px;margin-top:4px"></div>`)}
      ${UI.field('Judul Kitab', `
        <div class="row" style="gap:8px">
          <input class="clay-input" id="f-talim-kitab" placeholder="Contoh: Riyadhus Shalihin" value="${UI.esc(source.judulKitab || malamDefaults.judulKitab)}" style="flex:1">
          <button class="clay-btn sm secondary" type="button" id="btn-talim-buka-kitab-form" style="display:none;white-space:nowrap">📖 Buka Kitab</button>
        </div>`)}
      ${UI.field('Bab', `<input class="clay-input" id="f-talim-bab" placeholder="Contoh: Bab Keikhlasan" value="${UI.esc(source.bab || malamDefaults.bab)}">`)}
      ${UI.field('Pembahasan', `<textarea class="clay-textarea" id="f-talim-bahas" placeholder="Ringkasan materi yang dibahas">${UI.esc(source.pembahasan || '')}</textarea>`)}
      ${UI.field('Halaman', `<input class="clay-input" id="f-talim-halaman" placeholder="Contoh: 12–15" value="${UI.esc(source.halaman || '')}">`)}`;
    const modal = UI.openModal({
      title: sourceJournal ? 'Lanjutkan Jurnal Ta’lim Malam' : 'Isi Jurnal Ta’lim Malam', bodyHTML: body,
      actions: [
        { label: 'Batal', cls: 'ghost', onClick: (m, close) => close() },
        { label: 'Simpan', cls: 'primary', onClick: async (m, close) => {
          const ustadzId = isAdmin ? m.querySelector('#f-talim-ustadz').value : currentUstadz?.id;
          const ustadz = db.ustadz.find(u => u.id === ustadzId);
          const mapelId = m.querySelector('#f-talim-mapel').value;
          const kelasKey = m.querySelector('#f-talim-kelas').value;
          const judulKitab = m.querySelector('#f-talim-kitab').value.trim();
          const bab = m.querySelector('#f-talim-bab').value.trim();
          const pembahasan = m.querySelector('#f-talim-bahas').value.trim();
          const halaman = m.querySelector('#f-talim-halaman').value.trim();
          if (!ustadz) { UI.toast('Pilih ustadz', 'error'); return; }
          const assignment = Store.talimAssignmentsForUstadz(ustadz).find(item => item.mapel.id === mapelId);
          if (!assignment || !kelasKey || !assignment.kelasKeys.includes(kelasKey)) {
            UI.toast('Pilih mapel dan kelas sesuai penugasan Ta’lim', 'error'); return;
          }
          if (!judulKitab || !bab || !pembahasan || !halaman) { UI.toast('Lengkapi judul kitab, bab, pembahasan, dan halaman', 'error'); return; }
          if (!db.jurnalTalim) db.jurnalTalim = [];
          const halaqah = Store.findHalaqahForUstadz(ustadz);
          const mapel = Store.findTalimMapel(mapelId);
          const pendidikan = Store.talimClassFromKey(kelasKey);
          const journal = { id: journalId, tanggal: m.querySelector('#f-talim-tgl').value, ustadzId, ustadz: ustadz.nama, halaqah: halaqah?.nama || ustadz.halaqah || '', mapelId, mapel: mapel?.nama || '', tingkat: pendidikan.tingkat, kelas: pendidikan.kelas, judulKitab, bab, pembahasan, halaman };
          const existingIndex = db.jurnalTalim.findIndex(j => j.id === journalId);
          if (existingIndex === -1) {
            db.jurnalTalim.push(journal);
            Store.log('Isi jurnal Ta’lim Malam');
          } else {
            // Jika simpan sebelumnya gagal lalu dicoba ulang, perbarui entri
            // sementara yang sama tanpa menambah duplikat di memori.
            db.jurnalTalim[existingIndex] = journal;
          }
          if (!await Store.save()) return;
          close(); UI.toast('Jurnal Ta’lim Malam tersimpan', 'success'); talim();
        } }
      ]
    });
    const renderTalimChoices = () => {
      const teacherId = isAdmin ? modal.modal.querySelector('#f-talim-ustadz').value : currentUstadz?.id;
      const teacher = db.ustadz.find(u => u.id === teacherId);
      const assignments = Store.talimAssignmentsForUstadz(teacher);
      const mapelSelect = modal.modal.querySelector('#f-talim-mapel');
      const kelasSelect = modal.modal.querySelector('#f-talim-kelas');
      const info = modal.modal.querySelector('#f-talim-assignment-info');
      const priorMapel = mapelSelect.value || source.mapelId;
      const selectedMapel = assignments.some(item => item.mapel.id === priorMapel) ? priorMapel : assignments[0]?.mapel.id || '';
      mapelSelect.innerHTML = `<option value="">Pilih mapel</option>${UI.optionsFromList(assignments.map(item => ({ v: item.mapel.id, l: item.mapel.nama })), 'v', 'l', selectedMapel)}`;
      const selectedAssignment = assignments.find(item => item.mapel.id === mapelSelect.value);
      const priorKelas = kelasSelect.value || (source.tingkat && source.kelas ? Store.talimClassKey(source.tingkat, source.kelas) : '');
      const selectedKelas = selectedAssignment?.kelasKeys.includes(priorKelas) ? priorKelas : selectedAssignment?.kelasKeys[0] || '';
      kelasSelect.innerHTML = `<option value="">Pilih tingkat & kelas</option>${UI.optionsFromList((selectedAssignment?.kelasKeys || []).map(key => ({ v: key, l: Store.talimClassLabel(key) })), 'v', 'l', selectedKelas)}`;
      const disabled = !assignments.length;
      mapelSelect.disabled = disabled;
      kelasSelect.disabled = disabled;
      info.textContent = disabled
        ? 'Belum ada penugasan Ta’lim untuk ustadz ini. Minta admin mengatur mapel dan kelas di Settings → Ta’lim.'
        : 'Pilihan hanya menampilkan mapel dan kelas yang ditugaskan admin.';

      const currentMapelObj = Store.findTalimMapel(mapelSelect.value);
      const btnBukaKitab = modal.modal.querySelector('#btn-talim-buka-kitab-form');
      const kitabInput = modal.modal.querySelector('#f-talim-kitab');
      if (currentMapelObj && currentMapelObj.kitabUrl) {
        if (btnBukaKitab) {
          btnBukaKitab.style.display = 'inline-flex';
          btnBukaKitab.textContent = '📖 Buka Kitab (' + (currentMapelObj.kitabNama || currentMapelObj.nama) + ')';
          btnBukaKitab.onclick = () => {
            UI.openKitabViewer({
              title: currentMapelObj.kitabNama || currentMapelObj.nama,
              sub: 'Mapel: ' + currentMapelObj.nama,
              url: currentMapelObj.kitabUrl
            });
          };
        }
        if (!sourceJournal && currentMapelObj.kitabNama && (!kitabInput.value || kitabInput.value === malamDefaults.judulKitab)) {
          kitabInput.value = currentMapelObj.kitabNama;
        }
      } else if (btnBukaKitab) {
        btnBukaKitab.style.display = 'none';
      }
    };
    if (isAdmin) modal.modal.querySelector('#f-talim-ustadz').onchange = renderTalimChoices;
    modal.modal.querySelector('#f-talim-mapel').onchange = renderTalimChoices;
    renderTalimChoices();
  }

  /* ---------------- Pembelajaran ---------------- */
  function pembelajaran() {
    const c = ctx(); _scope = c.scope;
    const navItems = (c.role === 'admin') ? Admin.nav('ustadz_pembelajaran') : nav('ustadz_pembelajaran');
    Shared.shell(c.role, navItems, '');
    Shared.setHeader('Pembelajaran', 'Tahsin · Ziyadah · Mutqin · Umum');
    document.getElementById('view-content').innerHTML = `
      <div class="pill-tabs" id="tabs">
        <button class="pill active" data-tab="tahsin"> Tahsin</button>
        <button class="pill" data-tab="ziyadah"> Ziyadah</button>
        <button class="pill" data-tab="mutqin"> Mutqin</button>
        <button class="pill" data-tab="umum"> Umum</button>
      </div>
      <div id="tab-content"></div>`;
    const tabs = document.getElementById('tabs');
    const render = (tab) => {
      tabs.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p.dataset.tab === tab));
      if (tab === 'tahsin') renderTahsin();
      else if (tab === 'ziyadah') renderZiyadah();
      else if (tab === 'mutqin') renderMutqin();
      else renderUmum();
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
    const santri = mySantri('Tahsin').filter(s => Store.santriHasProgram(s, 'Tahsin'));
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
        if (el) { el.max = maxAyat; if (maxAyat > 0 && Number(el.value) > maxAyat) el.value = maxAyat; }
      });
    };
    surahInput.oninput = update;
  }

  function bindSetoranPreview(root, prefix) {
    const scope = root || document;
    const button = scope.querySelector('#' + prefix + '-open-quran');
    const fields = ['sa', 'aa', 'sk', 'ak'].map(name => scope.querySelector('#' + prefix + '-' + name));
    if (!button || fields.some(field => !field)) return () => {};
    const range = () => ({
      sAwal: parseInt(fields[0].value) || 0,
      aAwal: Number(fields[1].value) || 0,
      sAkhir: parseInt(fields[2].value) || 0,
      aAkhir: Number(fields[3].value) || 0
    });
    const validRange = ({ sAwal, aAwal, sAkhir, aAkhir }) => {
      const first = getSurah(sAwal), last = getSurah(sAkhir);
      return !!(first && last && aAwal >= 1 && aAwal <= first.ayahs && aAkhir >= 1 && aAkhir <= last.ayahs
        && sAwal <= sAkhir && (sAwal !== sAkhir || aAwal <= aAkhir));
    };
    const update = () => {
      button.hidden = !validRange(range());
    };
    fields.forEach(field => {
      field.addEventListener('input', update);
      field.addEventListener('change', update);
    });
    button.onclick = () => {
      const selected = range();
      if (!validRange(selected)) return;
      const first = getSurah(selected.sAwal);
      const last = getSurah(selected.sAkhir);
      const popup = UI.openModal({
        title: 'Al-Qur’an untuk Disimak',
        sub: first.latin + ':' + selected.aAwal + ' — ' + last.latin + ':' + selected.aAkhir,
        bodyHTML: '<div id="setoran-quran-popup" class="setoran-quran-popup"><span class="muted">Memuat bacaan Al-Qur’an…</span></div>',
        actions: [{ label: 'Tutup', cls: 'ghost', onClick: (m, close) => close() }]
      });
      Quran.previewRange(popup.modal.querySelector('#setoran-quran-popup'), selected.sAwal, selected.aAwal, selected.sAkhir, selected.aAkhir);
    };
    update();
    return update;
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
          db.tahsin.push({ id: Store.uid('ts'), santriId, ustadzId: ustadzIdFor(santriId, 'Tahsin'), tanggal: m.querySelector('#f-tgl').value, halAwal: +m.querySelector('#f-ha').value, halAkhir: +m.querySelector('#f-hk').value, nilai: +m.querySelector('#f-nilai').value, catatan: m.querySelector('#f-cat').value.trim() });
          const wUser = db.users.find(u => u.role === 'wali' && u.refId === s.waliId);
          if (wUser) Store.addNotif(wUser.id, 'wali', 'Nilai Tahsin baru: ' + s.nama);
          const haVal = +m.querySelector('#f-ha').value;
          const hkVal = +m.querySelector('#f-hk').value;
          const totalHlm = (hkVal >= haVal) ? (hkVal - haVal + 1) : 1;
          const nilaiVal = +m.querySelector('#f-nilai').value;
          const catVal = m.querySelector('#f-cat').value.trim();
          const tglVal = m.querySelector('#f-tgl').value;
          const msg = formatPesanSetoranWA({
            santri: s,
            awal: 'Halaman ' + haVal,
            hingga: 'Halaman ' + hkVal,
            jumlah: totalHlm + ' hlm',
            nilai: nilaiVal,
            keterangan: catVal || 'Tahsin',
            tanggal: tglVal
          });
          waReport(santriId, msg);
          if (!await Store.save()) return; Store.log('Input tahsin ' + s.nama); c(); UI.toast('Tersimpan', 'success'); renderTahsin();
        } }
      ]
    });
  }

  /* ----- Ziyadah (Bacaan + Hafalan) ----- */
  function renderZiyadah() {
    const db = Store.get();
    const santri = mySantri('Ziyadah').filter(s => Store.santriHasProgram(s, 'Ziyadah'));
    const t = Store.todayStr();
    const rows = santri.map(s => {
      const last = Store.lastZiyadah(s.id);
      const totalH = Store.totalHafalanSantri(s.id);
      const bacaanToday = db.ziyadahBacaan.some(z => z.santriId === s.id && z.tanggal === t);
      const hafalanToday = db.ziyadahHafalan.some(z => z.santriId === s.id && z.tanggal === t);
      let badge = '';
      if (hafalanToday) badge = ' <span class="badge green">Selesai ✓</span>';
      else if (bacaanToday) badge = ' <span class="badge" style="background:var(--blue,#2196F3)">Bacaan ✓</span>';
      return `<tr><td><b>${UI.esc(s.nama)}</b></td><td>${last ? getSurah(last.sAkhir).latin + ':' + last.aAkhir : '<span class="muted">-</span>'}</td><td>${totalH ? formatHafalan(totalH) : '-'}</td><td><button class="clay-btn sm primary" data-setoran="${s.id}">+ Setoran</button>${badge}</td></tr>`;
    }).join('');
    document.getElementById('tab-content').innerHTML = `
      <div class="clay-card">
        <div class="section-title"> Input Ziyadah</div>
        <div class="table-wrap"><table class="clay-table">
          <thead><tr><th>Santri</th><th>Lanjutan Terakhir</th><th>Total Hafalan</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4"><div class="empty">Tidak ada santri.</div></td></tr>'}</tbody>
        </table></div>
      </div>`;
    document.querySelectorAll('[data-setoran]').forEach(b => b.onclick = () => ziyadahForm(b.dataset.setoran));
  }

  function ziyadahForm(santriId) {
    const s = Store.findSantri(santriId);
    const db = Store.get();
    const t = Store.todayStr();
    const halaqah = Store.halaqahForSantriProgram(s, 'Ziyadah');
    const bacaanRequired = !!(halaqah && halaqah.setoranBacaan);
    const bacaanToday = db.ziyadahBacaan.filter(z => z.santriId === santriId && z.tanggal === t).sort((a, b) => (b._created||0)-(a._created||0))[0];
    const hafalanToday = db.ziyadahHafalan.some(z => z.santriId === santriId && z.tanggal === t);
    const skipBacaan = bacaanRequired && !!bacaanToday && !hafalanToday;
    const hafalanReady = !bacaanRequired || skipBacaan;

    // Ayat terakhir yang disetorkan menjadi patokan, bukan catatan dengan
    // tanggal terbesar: setoran tertinggal bisa diinput belakangan dengan
    // tanggal lama, jadi ayat yang sudah lewat tidak boleh diulang.
    const last = Store.lastZiyadah(santriId);
    let defSA = 2, defAA = 1, defSK = 2, defAK = 5;
    if (bacaanToday) {
      defSA = bacaanToday.sAwal; defAA = bacaanToday.aAwal;
      defSK = bacaanToday.sAkhir; defAK = bacaanToday.aAkhir;
    } else if (last) {
      const n = nextHafalanPosition(last.sAkhir, last.aAkhir, db.settings.juzOrder);
      if (n) { defSA = n.surah; defAA = n.ayah; defSK = n.surah; defAK = n.ayah + 4; }
    }
    const patokan = bacaanToday || last;
    const lanjutanLabel = patokan
      ? getSurah(patokan.sAkhir).latin + ':' + patokan.aAkhir + ' - ' + UI.fmtDate(patokan.tanggal)
      : '';
    function surahLabel(n) { const s = getSurah(n); return s ? s.n + '. ' + s.latin : n; }
    function riwayatSingkat() {
      const d = Store.get();
      const semua = [...d.ziyadahHafalan.filter(z => z.santriId === santriId), ...d.ziyadahBacaan.filter(z => z.santriId === santriId)]
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || ((b._created||0)-(a._created||0)))
        .slice(0, 3);
      if (!semua.length) return '<span class="muted">Belum ada setoran</span>';
      return semua.map(r => {
        const label = r.nilai !== undefined ? 'Hafalan' : 'Bacaan';
        const sA = getSurah(r.sAwal).latin;
        const sK = getSurah(r.sAkhir).latin;
        return `<div style="font-size:13px;padding:4px 0">${UI.fmtDate(r.tanggal)} — ${label}: ${sA}:${r.aAwal} → ${sK}:${r.aAkhir}</div>`;
      }).join('');
    }

    let hSlide = null;

    const bacaanLocked = skipBacaan ? 'opacity:0.5;border-left:3px solid var(--muted)' : 'border-left:3px solid var(--primary)';
    const bacaanDisabled = skipBacaan ? 'disabled' : '';
    const btnBacaanHide = skipBacaan ? 'style="display:none"' : '';
    const bacaanOkShow = skipBacaan ? 'style="display:inline"' : 'style="display:none"';
    const hafalanActive = hafalanReady ? 'opacity:1;border-left:3px solid var(--primary)' : 'opacity:0.5;border-left:3px solid var(--muted)';
    const hafalanDisabled = hafalanReady ? '' : 'disabled';
    const btnHafalanDisabled = hafalanReady ? '' : 'disabled';

    const body = `
      ${UI.field('Santri', `<input class="clay-input" value="${UI.esc(s.nama)}" disabled>`)}
      ${UI.field('Tanggal', `<input class="clay-input" value="${t}" disabled>`)}
      <hr style="border:none;border-top:1px solid var(--border,#ddd);margin:12px 0">
      <div id="sec-bacaan" class="clay-card pad-sm mb" style="display:${bacaanRequired ? 'block' : 'none'};background:var(--bg);${bacaanLocked}">
        <div class="section-title" style="font-size:14px;margin:0 0 8px 0">📖 Setoran Bacaan</div>
        <div class="row">
          <div style="flex:1">${UI.field('Awal Surat', `<input class="clay-input" id="b-sa" list="dl-surah" type="text" value="${surahLabel(defSA)}" autocomplete="off" ${bacaanDisabled}>`)}</div>
          <div style="flex:1">${UI.field('Awal Ayat', `<input class="clay-input" id="b-aa" type="number" min="1" max="${getSurah(defSA) ? getSurah(defSA).ayahs : 286}" value="${Math.min(defAA, getSurah(defSA) ? getSurah(defSA).ayahs : 286)}" ${bacaanDisabled}>`)}</div>
        </div>
        <div class="row">
          <div style="flex:1">${UI.field('Akhir Surat', `<input class="clay-input" id="b-sk" list="dl-surah" type="text" value="${surahLabel(defSK)}" autocomplete="off" ${bacaanDisabled}>`)}</div>
          <div style="flex:1">${UI.field('Akhir Ayat', `<input class="clay-input" id="b-ak" type="number" min="1" max="${getSurah(defSK) ? getSurah(defSK).ayahs : 286}" value="${Math.min(defAK, getSurah(defSK) ? getSurah(defSK).ayahs : 286)}" ${bacaanDisabled}>`)}</div>
        </div>
        <button class="clay-btn ghost sm setoran-quran-btn" id="b-open-quran" type="button" hidden>📖 Buka Al-Qur’an</button>
        <button class="clay-btn primary" id="btn-simpan-bacaan" style="margin-top:8px" ${btnBacaanHide}>💾 Simpan Bacaan</button>
        <span id="bacaan-ok" ${bacaanOkShow} style="margin-top:8px;color:var(--green)">✓ Bacaan tersimpan</span>
      </div>
      <div id="sec-hafalan" class="clay-card pad-sm mb" style="background:var(--bg);${hafalanActive}">
        <div class="section-title" style="font-size:14px;margin:0 0 8px 0">📝 Setoran Hafalan</div>
        <div class="muted" style="font-size:12px;margin-bottom:8px">${lanjutanLabel ? 'Dilanjutkan dari ' + UI.esc(lanjutanLabel) : 'Belum ada riwayat setoran'}</div>
        <div class="row">
          <div style="flex:1">${UI.field('Awal Surat', `<input class="clay-input" id="h-sa" list="dl-surah" type="text" value="${surahLabel(defSA)}" autocomplete="off" ${hafalanDisabled}>`)}</div>
          <div style="flex:1">${UI.field('Awal Ayat', `<input class="clay-input" id="h-aa" type="number" min="1" max="${getSurah(defSA) ? getSurah(defSA).ayahs : 286}" value="${Math.min(defAA, getSurah(defSA) ? getSurah(defSA).ayahs : 286)}" ${hafalanDisabled}>`)}</div>
        </div>
        <div class="row">
          <div style="flex:1">${UI.field('Akhir Surat', `<input class="clay-input" id="h-sk" list="dl-surah" type="text" value="${surahLabel(defSK)}" autocomplete="off" ${hafalanDisabled}>`)}</div>
          <div style="flex:1">${UI.field('Akhir Ayat', `<input class="clay-input" id="h-ak" type="number" min="1" max="${getSurah(defSK) ? getSurah(defSK).ayahs : 286}" value="${Math.min(defAK, getSurah(defSK) ? getSurah(defSK).ayahs : 286)}" ${hafalanDisabled}>`)}</div>
        </div>
        <button class="clay-btn ghost sm setoran-quran-btn" id="h-open-quran" type="button" hidden>📖 Buka Al-Qur’an</button>
        <div id="calc-preview" class="clay-card pad-sm mt" style="background:var(--bg);font-size:13px"></div>
        ${UI.field('Nilai', `<input class="clay-input" id="f-nilai" type="number" min="0" max="100" value="80" ${hafalanDisabled}>`)}
        ${UI.field('Catatan', `<textarea class="clay-textarea" id="f-cat" ${hafalanDisabled}></textarea>`)}
        <button class="clay-btn primary" id="btn-simpan-hafalan" style="margin-top:8px" ${btnHafalanDisabled}>💾 Simpan Hafalan</button>
      </div>
      <div class="clay-card pad-sm" style="background:var(--bg)"><b>Peta Hafalan</b> <span class="muted" style="font-size:11px">· abu-abu = belum disetor · kuning = disetor sebagian · hijau = selesai 1 halaman</span><div id="hafalan-map" style="margin-top:8px;overflow:auto;max-height:300px">${Shared.hafalanMapHTML(santriId)}</div></div>
      <div class="clay-card pad-sm" style="background:var(--bg);font-size:13px"><b> Riwayat 3 setoran terakhir:</b> <div id="riwayat-list">${riwayatSingkat()}</div></div>`;

    const modal = UI.openModal({
      title: 'Setoran Ziyadah',
      sub: s.nama,
      bodyHTML: body,
      actions: [
        { label: 'Tutup', cls: 'ghost', onClick: (m, c) => c() }
      ]
    });

    const refreshBacaanPreview = bacaanRequired ? bindSetoranPreview(modal.modal, 'b') : () => {};
    const refreshHafalanPreview = bindSetoranPreview(modal.modal, 'h');

    setTimeout(() => {
      bindAyatMax('b-sa', 'b-aa,b-ak');
      bindAyatMax('b-sk', 'b-aa,b-ak');
    }, 50);

    if (hafalanReady) {
      document.getElementById('sec-hafalan').style.opacity = '1';
      document.getElementById('sec-hafalan').style.borderLeftColor = 'var(--primary)';
      setTimeout(() => {
        bindAyatMax('h-sa', 'h-aa');
        bindAyatMax('h-sk', 'h-ak');
        const calc = () => {
          const hsa = parseInt(document.getElementById('h-sa').value) || 0;
          const hsk = parseInt(document.getElementById('h-sk').value) || 0;
          const haa = +document.getElementById('h-aa').value;
          const hak = +document.getElementById('h-ak').value;
          const hh = computeHafalan(hsa, haa, hsk, hak);
          document.getElementById('calc-preview').innerHTML = hh
            ? `<b> Auto Hitung:</b> ${hh.ayahs} ayat · ${hh.pages} halaman · Juz ${hh.juzStart}${hh.juzRange > 1 ? '-' + hh.juzEnd : ''}`
            : '<span class="muted">Range belum valid.</span>';
        };
        document.querySelectorAll('#h-sa,#h-aa,#h-sk,#h-ak').forEach(el => el.oninput = calc);
        calc();
        hSlide = setInterval(calc, 300);
      }, 50);
    }

    if (bacaanRequired) document.getElementById('btn-simpan-bacaan').onclick = async () => {
      const sa = document.getElementById('b-sa').value;
      const sk = document.getElementById('b-sk').value;
      const sA = sa ? parseInt(sa) : defSA;
      const sK = sk ? parseInt(sk) : defSK;
      if (!sA || !sK) { UI.toast('Pilih surat yang valid', 'error'); return; }
      const sAyah = getSurah(sA); const sKyah = getSurah(sK);
      const aaEl = document.getElementById('b-aa');
      const akEl = document.getElementById('b-ak');
      if (sAyah && +aaEl.value > sAyah.ayahs) { UI.toast('Awal ayat melebihi batas surat', 'error'); return; }
      if (sKyah && +akEl.value > sKyah.ayahs) { UI.toast('Akhir ayat melebihi batas surat', 'error'); return; }

      const d = Store.get();
      d.ziyadahBacaan.push({
        id: Store.uid('zb'), santriId, ustadzId: ustadzIdFor(santriId, 'Ziyadah'),
        tanggal: Store.todayStr(), sAwal: sA, aAwal: +aaEl.value,
        sAkhir: sK, aAkhir: +akEl.value, _created: Date.now()
      });
      if (!await Store.save()) return;
      Store.log('Setor ziyadah bacaan ' + s.nama);
      UI.toast('Setoran bacaan tersimpan', 'success');

      document.getElementById('sec-bacaan').style.opacity = '0.5';
      document.getElementById('sec-bacaan').style.borderLeftColor = 'var(--muted)';
      document.querySelectorAll('#sec-bacaan input').forEach(el => el.disabled = true);
      document.getElementById('btn-simpan-bacaan').style.display = 'none';
      document.getElementById('bacaan-ok').style.display = 'inline';

      document.getElementById('h-sa').value = surahLabel(sA);
      document.getElementById('h-sk').value = surahLabel(sK);
      document.getElementById('h-aa').value = aaEl.value;
      document.getElementById('h-ak').value = akEl.value;
      refreshHafalanPreview();

      document.getElementById('sec-hafalan').style.opacity = '1';
      document.getElementById('sec-hafalan').style.borderLeftColor = 'var(--primary)';
      document.querySelectorAll('#h-sa,#h-aa,#h-sk,#h-ak,#f-nilai,#f-cat').forEach(el => el.disabled = false);
      document.getElementById('btn-simpan-hafalan').disabled = false;

      bindAyatMax('h-sa', 'h-aa');
      bindAyatMax('h-sk', 'h-ak');

      const calc = () => {
        const hsa = parseInt(document.getElementById('h-sa').value) || 0;
        const hsk = parseInt(document.getElementById('h-sk').value) || 0;
        const haa = +document.getElementById('h-aa').value;
        const hak = +document.getElementById('h-ak').value;
        const hh = computeHafalan(hsa, haa, hsk, hak);
        document.getElementById('calc-preview').innerHTML = hh
          ? `<b> Auto Hitung:</b> ${hh.ayahs} ayat · ${hh.pages} halaman · Juz ${hh.juzStart}${hh.juzRange > 1 ? '-' + hh.juzEnd : ''}`
          : '<span class="muted">Range belum valid.</span>';
      };
      document.querySelectorAll('#h-sa,#h-aa,#h-sk,#h-ak').forEach(el => el.oninput = calc);
      calc();

      document.getElementById('riwayat-list').innerHTML = riwayatSingkat();
      hSlide = setInterval(calc, 300);
    };

    document.getElementById('btn-simpan-hafalan').onclick = async () => {
      const sa = document.getElementById('h-sa').value;
      const sk = document.getElementById('h-sk').value;
      const sA = sa ? parseInt(sa) : defSA;
      const sK = sk ? parseInt(sk) : defSK;
      const aA = +document.getElementById('h-aa').value;
      const aK = +document.getElementById('h-ak').value;
      const sAyh = getSurah(sA); const sKyh = getSurah(sK);
      if (sAyh && aA > sAyh.ayahs) { UI.toast('Awal ayat melebihi batas surat', 'error'); return; }
      if (sKyh && aK > sKyh.ayahs) { UI.toast('Akhir ayat melebihi batas surat', 'error'); return; }
      const h = computeHafalan(sA, aA, sK, aK);
      if (!h) { UI.toast('Range ayat tidak valid', 'error'); return; }

      const d = Store.get();
      d.ziyadahHafalan.push({
        id: Store.uid('zh'), santriId, ustadzId: ustadzIdFor(santriId, 'Ziyadah'),
        tanggal: Store.todayStr(), sAwal: sA, aAwal: aA,
        sAkhir: sK, aAkhir: aK, nilai: +document.getElementById('f-nilai').value,
        catatan: document.getElementById('f-cat').value.trim(), _created: Date.now()
      });
      const wUser = d.users.find(u => u.role === 'wali' && u.refId === s.waliId);
      if (wUser) Store.addNotif(wUser.id, 'wali', 'Setoran baru: ' + s.nama + ' (' + formatHafalan(h) + ')');
      const awalSurah = 'Surat ' + (getSurah(sA) ? getSurah(sA).latin : sA) + ' Ayat ' + aA;
      const hinggaSurah = 'Surat ' + (getSurah(sK) ? getSurah(sK).latin : sK) + ' Ayat ' + aK;
      const nilaiVal = +document.getElementById('f-nilai').value;
      const catVal = document.getElementById('f-cat').value.trim();
      const msg = formatPesanSetoranWA({
        santri: s,
        awal: awalSurah,
        hingga: hinggaSurah,
        jumlah: formatHafalan(h),
        nilai: nilaiVal,
        keterangan: catVal || '-',
        tanggal: Store.todayStr()
      });
      waReport(santriId, msg);
      if (!await Store.save()) return;
      Store.log('Setor ziyadah hafalan ' + s.nama);
      if (hSlide) clearInterval(hSlide);
      modal.close();
      UI.toast('Tersimpan · ' + formatHafalan(h), 'success');
      renderZiyadah();
    };
  }

  /* ----- Mutqin ----- */
  function renderMutqin() {
    const db = Store.get();
    const santri = mySantri('Mutqin').filter(s => Store.santriHasProgram(s, 'Mutqin'));
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
    function surahLabel(n) { const s = getSurah(n); return s ? s.n + '. ' + s.latin : n; }
    const body = `
      ${UI.field('Santri', `<input class="clay-input" value="${UI.esc(s.nama)}" disabled>`)}
      <div class="row">
        <div style="flex:1">${UI.field('Awal Surat', `<input class="clay-input" id="m-sa" list="dl-surah" type="text" value="${surahLabel(2)}" autocomplete="off">`)}</div>
        <div style="flex:1">${UI.field('Awal Ayat', `<input class="clay-input" id="m-aa" type="number" min="1" max="286" value="1">`)}</div>
      </div>
      <div class="row">
        <div style="flex:1">${UI.field('Akhir Surat', `<input class="clay-input" id="m-sk" list="dl-surah" type="text" value="${surahLabel(2)}" autocomplete="off">`)}</div>
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
          const sAInput = m.querySelector('#m-sa').value;
          const sKInput = m.querySelector('#m-sk').value;
          const sA = sAInput ? parseInt(sAInput) : 2;
          const sK = sKInput ? parseInt(sKInput) : 2;
          const sAyh = getSurah(sA); const sKyh = getSurah(sK);
          if (sAyh && +m.querySelector('#m-aa').value > sAyh.ayahs) { UI.toast('Awal ayat melebihi batas surat', 'error'); return; }
          if (sKyh && +m.querySelector('#m-ak').value > sKyh.ayahs) { UI.toast('Akhir ayat melebihi batas surat', 'error'); return; }
          db.mutqin.push({ id: Store.uid('m'), santriId, ustadzId: ustadzIdFor(santriId, 'Mutqin'), tanggal: Store.todayStr(), sAwal: sA, aAwal: +m.querySelector('#m-aa').value, sAkhir: sK, aAkhir: +m.querySelector('#m-ak').value, nilai: +m.querySelector('#f-nilai').value, catatan: m.querySelector('#f-cat').value.trim(), totalHafalan: +m.querySelector('#m-total').value, _created: Date.now() });
          const wUser = db.users.find(u => u.role === 'wali' && u.refId === s.waliId);
          if (wUser) Store.addNotif(wUser.id, 'wali', 'Murajaah Mutqin: ' + s.nama);
          const aaVal = +m.querySelector('#m-aa').value;
          const akVal = +m.querySelector('#m-ak').value;
          const totalVal = +m.querySelector('#m-total').value;
          const nilaiVal = +m.querySelector('#f-nilai').value;
          const catVal = m.querySelector('#f-cat').value.trim();
          const awalSurah = 'Surat ' + (getSurah(sA) ? getSurah(sA).latin : sA) + ' Ayat ' + aaVal;
          const hinggaSurah = 'Surat ' + (getSurah(sK) ? getSurah(sK).latin : sK) + ' Ayat ' + akVal;
          const msg = formatPesanSetoranWA({
            santri: s,
            awal: awalSurah,
            hingga: hinggaSurah,
            jumlah: totalVal + ' hlm',
            nilai: nilaiVal,
            keterangan: catVal ? ('Murajaah Mutqin - ' + catVal) : 'Murajaah Mutqin',
            tanggal: Store.todayStr()
          });
          waReport(santriId, msg);
          if (!await Store.save()) return; Store.log('Input mutqin ' + s.nama); c(); UI.toast('Tersimpan', 'success'); renderMutqin();
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
        <input class="clay-input" id="riwayat-search" type="search" placeholder="Ketik nama atau NIS santri..." autocomplete="off" />
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
          <b>${UI.esc(s.nama)}</b> <span class="muted">(${UI.esc(s.nis || '-')})</span> <span class="muted" style="font-size:12px">${UI.esc(Store.halaqahSummaryForSantri(s))}</span>
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
    
    const scheduleSearch = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(updateSantriList, 150);
    };
    Shared.bindSearchInput(searchInput, scheduleSearch);
    
    updateSantriList();
  }

  /* ---------------- Laporan ---------------- */
  function laporan() {
    const c = ctx(); _scope = c.scope;
    Shared.shell(c.role, nav('ustadz_laporan'), '');
    Shared.setHeader('Laporan Halaqah', 'Rekap setoran dan laporan santri yang Anda ampu');
    const range = Shared.rekapSetoranRange();
    document.getElementById('view-content').innerHTML = `
      <div class="clay-card mb">
        <div class="row">
          <div style="flex:1">${UI.field('Dari Tanggal', `<input type="date" class="clay-input" id="f-dari" value="${range.dari}">`)}</div>
          <div style="flex:1">${UI.field('Sampai Tanggal', `<input type="date" class="clay-input" id="f-sampai" value="${range.sampai}">`)}</div>
        </div>
        <div class="row mt">
          <button class="clay-btn ghost" data-ul-preset="week">7 Hari</button>
          <button class="clay-btn ghost" data-ul-preset="month">Bulan Ini</button>
          <button class="clay-btn ghost" data-ul-preset="lastmonth">Bulan Lalu</button>
        </div>
      </div>
      <div id="rekap-setoran"></div>
      <div id="lap"></div>`;
    const apply = () => {
      const dari = document.getElementById('f-dari').value;
      const sampai = document.getElementById('f-sampai').value;
      Shared.setRekapSetoranRange(dari, sampai);
      const ownHalaqah = myHalaqah();
      if (!ownHalaqah && _scope !== 'all') {
        document.getElementById('rekap-setoran').innerHTML = '<div class="empty">Anda belum ditugaskan ke halaqah. Hubungi admin untuk pengaturan halaqah.</div>';
        document.getElementById('lap').innerHTML = '';
        return;
      }
      document.getElementById('rekap-setoran').innerHTML = Shared.renderRekapSetoranMingguan({
        halaqah: ownHalaqah,
        dari,
        sampai,
        allowMakeup: true
      });
      Shared.bindRekapSetoranBayar(({ santriId, tanggal, programs }) => bayarSetoran(santriId, tanggal, programs));
      document.getElementById('lap').innerHTML = Shared.renderLaporan({ halaqah: ownHalaqah, dari, sampai, bulan: (dari || '').slice(0, 7) });
      Shared.bindLaporanExport();
    };
    document.querySelectorAll('[data-ul-preset]').forEach(button => button.onclick = () => {
      const today = Store.todayStr();
      const preset = button.dataset.ulPreset;
      let dari = today, sampai = today;
      if (preset === 'week') dari = Store.tambahHari(today, -6);
      if (preset === 'month') dari = today.slice(0, 8) + '01';
      if (preset === 'lastmonth') {
        const awal = new Date(today.slice(0, 8) + '01T12:00:00');
        awal.setMonth(awal.getMonth() - 1);
        const akhir = new Date(awal.getFullYear(), awal.getMonth() + 1, 0);
        dari = `${awal.getFullYear()}-${String(awal.getMonth() + 1).padStart(2, '0')}-01`;
        sampai = `${akhir.getFullYear()}-${String(akhir.getMonth() + 1).padStart(2, '0')}-${String(akhir.getDate()).padStart(2, '0')}`;
      }
      document.getElementById('f-dari').value = dari;
      document.getElementById('f-sampai').value = sampai;
      apply();
    });
    ['f-dari', 'f-sampai'].forEach(id => document.getElementById(id).onchange = apply);
    apply();
  }

  /* ---------------- Umum (Semua kelas) ---------------- */
  function renderUmum() {
    const db = Store.get();
    const allSantri = db.santri.filter(s => s.status === 'Aktif');
    document.getElementById('tab-content').innerHTML = `
      <div class="clay-card">
        <div class="row" style="justify-content:space-between">
          <div class="section-title" id="setoran-umum-title" style="margin:0">Setoran Umum (${allSantri.length} santri)</div>
          <input class="clay-input" id="cari-santri" type="search" placeholder="Cari nama santri..." style="max-width:260px" autocomplete="off" />
        </div>
        <div class="table-wrap mt"><table class="clay-table">
          <thead><tr><th>Santri</th><th>Tingkat & Kelas</th><th>Level</th><th>Total Hafalan</th><th>Nilai</th><th>Aksi</th></tr></thead>
          <tbody id="setoran-umum-body"></tbody>
        </table></div>
      </div>`;

    function renderRows(santri) {
      const body = document.getElementById('setoran-umum-body');
      const title = document.getElementById('setoran-umum-title');
      title.textContent = 'Setoran Umum (' + santri.length + ' santri)';
      if (!santri.length) {
        body.innerHTML = '<tr><td colspan="6"><div class="empty">Tidak ada santri.</div></td></tr>';
        return;
      }
      body.innerHTML = santri.map(s => {
        const totalH = Store.totalHafalanSantri(s.id);
        const avg = Store.avgNilai(s.id);
        const programs = Store.activeProgramsForSantri(s);
        const badges = programs.map(program => {
          const cls = program === 'Tahsin' ? 'blue' : program === 'Ziyadah' ? 'green' : 'warn';
          return `<span class="badge ${cls}" style="margin:0 3px 3px 0">${UI.esc(program)}</span>`;
        }).join('');
        const actions = programs.map(program => {
          const label = program === 'Ziyadah' ? '+ Setoran' : program === 'Mutqin' ? '+ Murajaah' : '+ Tahsin';
          const cls = program === 'Ziyadah' ? 'secondary' : program === 'Mutqin' ? 'success' : 'primary';
          return `<button class="clay-btn sm ${cls}" data-input="${s.id}" data-program="${UI.esc(program)}">${label}</button>`;
        }).join(' ');
        return `<tr>
          <td><b>${UI.esc(s.nama)}</b><div class="muted" style="font-size:12px">${UI.esc(s.nis)}</div></td>
          <td>${UI.esc(Store.educationLabel(s))}</td>
          <td>${badges || '<span class="muted">-</span>'}</td>
          <td>${totalH ? formatHafalan(totalH) : '<span class="muted">-</span>'}</td>
          <td>${avg ? '<b>' + avg + '</b>' : '<span class="muted">-</span>'}</td>
          <td>${actions}</td>
        </tr>`;
      }).join('');
      body.querySelectorAll('[data-input]').forEach(b => b.onclick = () => umumInput(b.dataset.input, b.dataset.program));
    }

    const input = document.getElementById('cari-santri');
    Shared.bindSearchInput(input, () => {
      const term = input.value.trim().toLowerCase();
      renderRows(allSantri.filter(s =>
        s.nama.toLowerCase().includes(term) ||
        (s.nis && s.nis.toString().toLowerCase().includes(term))
      ));
    });
    renderRows(allSantri);
  }

  function formatHafalan(h) {
    if (!h) return '-';
    return `${h.ayahs} ayat · ${h.pages} hlm`;
  }

  function bayarSetoran(santriId, tanggal, programs) {
    const santri = Store.findSantri(santriId);
    const activePrograms = [...new Set(programs || [])].filter(program => santri && Store.santriHasProgram(santri, program));
    if (!santri || !activePrograms.length) { UI.toast('Jenis setoran santri tidak ditemukan', 'error'); return; }
    const openInput = program => umumInput(santriId, program, tanggal, () => laporan());
    if (activePrograms.length === 1) { openInput(activePrograms[0]); return; }
    UI.openModal({
      title: 'Bayar Setoran Tertinggal',
      sub: santri.nama + ' · ' + UI.fmtDate(tanggal),
      bodyHTML: '<div class="muted">Pilih jenis setoran yang akan dicatat untuk tanggal tersebut.</div>',
      actions: [
        { label: 'Batal', cls: 'ghost', onClick: (m, c) => c() },
        ...activePrograms.map(program => ({
          label: program,
          cls: program === 'Ziyadah' ? 'secondary' : program === 'Mutqin' ? 'success' : 'primary',
          onClick: (m, c) => { c(); openInput(program); }
        }))
      ]
    });
  }

  function umumInput(santriId, selectedProgram, tanggalTarget, onSaved) {
    const s = Store.findSantri(santriId);
    if (!s) return;
    const level = selectedProgram || s.level;
    if (!Store.santriHasProgram(s, level)) { UI.toast('Program santri tidak aktif', 'error'); return; }
    const programHalaqah = Store.halaqahForSantriProgram(s, level);
    const tanggalSetoran = /^\d{4}-\d{2}-\d{2}$/.test(tanggalTarget || '') ? tanggalTarget : Store.todayStr();
    const isSusulan = tanggalSetoran !== Store.todayStr();
    const refreshSetoranView = () => typeof onSaved === 'function' ? onSaved() : renderUmum();
    let bacaanRequired = false;
    let skipBacaan = false;
    let hafalanReady = false;
    let defSA = 2, defAA = 1, defSK = 2, defAK = 5;
    let surahLabel = n => String(n);
    let lanjutanLabel = '';
    
    let body = `
      ${UI.field('Santri', `<input class="clay-input" value="${UI.esc(s.nama)}" disabled>`)}
      ${UI.field('Kelas', `<input class="clay-input" value="${UI.esc(Store.educationLabel(s))}" disabled>`)}
      ${UI.field('Halaqah', `<input class="clay-input" value="${UI.esc(programHalaqah ? programHalaqah.nama : '-') }" disabled>`)}
       ${UI.field('Tanggal', `<input class="clay-input" id="f-tgl" type="date" value="${tanggalSetoran}" ${isSusulan ? 'disabled' : ''}>${isSusulan ? '<div class="muted" style="font-size:12px;margin-top:4px">Tanggal dikunci karena ini pembayaran setoran tertinggal.</div>' : ''}`)}`;
    
    if (level === 'Tahsin') {
      body += `
        <div class="row">
          <div style="flex:1">${UI.field('Halaman Awal', `<input class="clay-input" id="f-ha" type="number" min="1" value="1">`)}</div>
          <div style="flex:1">${UI.field('Halaman Akhir', `<input class="clay-input" id="f-hk" type="number" min="1" value="2">`)}</div>
        </div>`;
    } else if (level === 'Ziyadah') {
      const t = tanggalSetoran;
      const db = Store.get();
      const halaqah = programHalaqah;
      bacaanRequired = !!(halaqah && halaqah.setoranBacaan);
      const bacaanToday = db.ziyadahBacaan.filter(z => z.santriId === santriId && z.tanggal === t).sort((a, b) => (b._created||0)-(a._created||0))[0];
      const hafalanToday = db.ziyadahHafalan.some(z => z.santriId === santriId && z.tanggal === t);
      skipBacaan = bacaanRequired && !!bacaanToday && !hafalanToday;
      hafalanReady = !bacaanRequired || skipBacaan;

      // Ayat terakhir yang disetorkan menjadi patokan, bukan catatan dengan
      // tanggal terbesar: setoran tertinggal bisa diinput belakangan dengan
      // tanggal lama, jadi ayat yang sudah lewat tidak boleh diulang.
      const last = Store.lastZiyadah(santriId);
      if (bacaanToday) {
        defSA = bacaanToday.sAwal; defAA = bacaanToday.aAwal;
        defSK = bacaanToday.sAkhir; defAK = bacaanToday.aAkhir;
      } else if (last) {
        const n = nextHafalanPosition(last.sAkhir, last.aAkhir, db.settings.juzOrder);
        if (n) { defSA = n.surah; defAA = n.ayah; defSK = n.surah; defAK = n.ayah + 4; }
      }
      const patokan = bacaanToday || last;
      lanjutanLabel = patokan
        ? getSurah(patokan.sAkhir).latin + ':' + patokan.aAkhir + ' - ' + UI.fmtDate(patokan.tanggal)
        : '';

      surahLabel = n => { const surah = getSurah(n); return surah ? surah.n + '. ' + surah.latin : n; };

      const bacaanLocked = skipBacaan ? 'opacity:0.5;border-left:3px solid var(--muted)' : 'border-left:3px solid var(--primary)';
      const bacaanDisabled = skipBacaan ? 'disabled' : '';
      const btnBacaanHide = skipBacaan ? 'style="display:none"' : '';
      const bacaanOkShow = skipBacaan ? 'style="display:inline"' : 'style="display:none"';
      const hafalanActive = hafalanReady ? 'opacity:1;border-left:3px solid var(--primary)' : 'opacity:0.5;border-left:3px solid var(--muted)';
      const hafalanDisabled = hafalanReady ? '' : 'disabled';
      const btnHafalanDisabled = hafalanReady ? '' : 'disabled';

      const bacaanSection = `
        <hr style="border:none;border-top:1px solid var(--border,#ddd);margin:12px 0">
        <div id="sec-bacaan" class="clay-card pad-sm mb" style="display:${bacaanRequired ? 'block' : 'none'};background:var(--bg);${bacaanLocked}">
          <div class="section-title" style="font-size:14px;margin:0 0 8px 0">📖 Setoran Bacaan</div>
          <div class="row">
            <div style="flex:1">${UI.field('Awal Surat', `<input class="clay-input" id="b-sa" list="dl-surah" type="text" value="${surahLabel(defSA)}" autocomplete="off" ${bacaanDisabled}>`)}</div>
            <div style="flex:1">${UI.field('Awal Ayat', `<input class="clay-input" id="b-aa" type="number" min="1" max="${getSurah(defSA) ? getSurah(defSA).ayahs : 286}" value="${Math.min(defAA, getSurah(defSA) ? getSurah(defSA).ayahs : 286)}" ${bacaanDisabled}>`)}</div>
          </div>
          <div class="row">
            <div style="flex:1">${UI.field('Akhir Surat', `<input class="clay-input" id="b-sk" list="dl-surah" type="text" value="${surahLabel(defSK)}" autocomplete="off" ${bacaanDisabled}>`)}</div>
            <div style="flex:1">${UI.field('Akhir Ayat', `<input class="clay-input" id="b-ak" type="number" min="1" max="${getSurah(defSK) ? getSurah(defSK).ayahs : 286}" value="${Math.min(defAK, getSurah(defSK) ? getSurah(defSK).ayahs : 286)}" ${bacaanDisabled}>`)}</div>
          </div>
          <button class="clay-btn ghost sm setoran-quran-btn" id="b-open-quran" type="button" hidden>📖 Buka Al-Qur’an</button>
          <button class="clay-btn primary" id="btn-simpan-bacaan" style="margin-top:8px" ${btnBacaanHide}>💾 Simpan Bacaan</button>
          <span id="bacaan-ok" ${bacaanOkShow} style="margin-top:8px;color:var(--green)">✓ Bacaan tersimpan</span>
        </div>`;

      const hafalanSection = `
        <div id="sec-hafalan" class="clay-card pad-sm mb" style="background:var(--bg);${hafalanActive}">
          <div class="section-title" style="font-size:14px;margin:0 0 8px 0">📝 Setoran Hafalan</div>
          <div class="muted" style="font-size:12px;margin-bottom:8px">${lanjutanLabel ? 'Dilanjutkan dari ' + UI.esc(lanjutanLabel) : 'Belum ada riwayat setoran'}</div>
          <div class="row">
            <div style="flex:1">${UI.field('Awal Surat', `<input class="clay-input" id="h-sa" list="dl-surah" type="text" value="${surahLabel(defSA)}" autocomplete="off" ${hafalanDisabled}>`)}</div>
            <div style="flex:1">${UI.field('Awal Ayat', `<input class="clay-input" id="h-aa" type="number" min="1" max="${getSurah(defSA) ? getSurah(defSA).ayahs : 286}" value="${Math.min(defAA, getSurah(defSA) ? getSurah(defSA).ayahs : 286)}" ${hafalanDisabled}>`)}</div>
          </div>
          <div class="row">
            <div style="flex:1">${UI.field('Akhir Surat', `<input class="clay-input" id="h-sk" list="dl-surah" type="text" value="${surahLabel(defSK)}" autocomplete="off" ${hafalanDisabled}>`)}</div>
            <div style="flex:1">${UI.field('Akhir Ayat', `<input class="clay-input" id="h-ak" type="number" min="1" max="${getSurah(defSK) ? getSurah(defSK).ayahs : 286}" value="${Math.min(defAK, getSurah(defSK) ? getSurah(defSK).ayahs : 286)}" ${hafalanDisabled}>`)}</div>
          </div>
          <button class="clay-btn ghost sm setoran-quran-btn" id="h-open-quran" type="button" hidden>📖 Buka Al-Qur’an</button>
          <div id="calc-preview" class="clay-card pad-sm mt" style="background:var(--bg);font-size:13px"></div>
          ${UI.field('Nilai', `<input class="clay-input" id="f-nilai" type="number" min="0" max="100" value="80" ${hafalanDisabled}>`)}
          ${UI.field('Catatan', `<textarea class="clay-textarea" id="f-cat" ${hafalanDisabled}></textarea>`)}
          <button class="clay-btn primary" id="btn-simpan-hafalan" style="margin-top:8px" ${btnHafalanDisabled}>💾 Simpan Hafalan</button>
        </div>`;

      body += bacaanSection + hafalanSection;
    } else if (level === 'Mutqin') {
      body += `
        <div class="row">
          <div style="flex:1">${UI.field('Awal Surat', `<input class="clay-input" id="f-sa" list="dl-surah" type="text" placeholder="1. Al-Fatihah" autocomplete="off">`)}</div>
          <div style="flex:1">${UI.field('Awal Ayat', `<input class="clay-input" id="f-aa" type="number" min="1" max="286" value="1">`)}</div>
        </div>
        <div class="row">
          <div style="flex:1">${UI.field('Akhir Surat', `<input class="clay-input" id="f-sk" list="dl-surah" type="text" placeholder="2. Al-Baqarah" autocomplete="off">`)}</div>
          <div style="flex:1">${UI.field('Akhir Ayat', `<input class="clay-input" id="f-ak" type="number" min="1" max="286" value="5">`)}</div>
        </div>
        ${UI.field('Total Hafalan Mutqin (hlm)', `<input class="clay-input" id="f-total" type="number" min="0" value="0">`)}`;
    }
    
    if (level !== 'Ziyadah') {
      body += `
        ${UI.field('Nilai', `<input class="clay-input" id="f-nilai" type="number" min="0" max="100" value="80">`)}
        ${UI.field('Catatan', `<textarea class="clay-textarea" id="f-cat"></textarea>`)}`;
    }

    const modal = UI.openModal({
      title: (isSusulan ? 'Bayar Setoran ' : 'Input ') + level + ' - ' + s.nama,
      sub: Store.educationLabel(s) + ' · ' + (programHalaqah ? programHalaqah.nama : '-') + (isSusulan ? ' · ' + UI.fmtDate(tanggalSetoran) : ''),
      bodyHTML: body,
      actions: level === 'Ziyadah'
        ? [{ label: 'Tutup', cls: 'ghost', onClick: (m, c) => c() }]
        : [
        { label: 'Batal', cls: 'ghost', onClick: (m, c) => c() },
        { label: 'Simpan', cls: 'primary', onClick: async (m, c) => {
          const d = Store.get();

          if (level === 'Tahsin') {
            const record = {
              id: Store.uid('ts'), santriId, ustadzId: ustadzIdFor(santriId, 'Tahsin'),
              tanggal: m.querySelector('#f-tgl').value,
              halAwal: +m.querySelector('#f-ha').value, halAkhir: +m.querySelector('#f-hk').value,
              nilai: +m.querySelector('#f-nilai').value, catatan: m.querySelector('#f-cat').value.trim()
            };
            d.tahsin.push(record);
          } else if (level === 'Mutqin') {
            const sA = parseInt(m.querySelector('#f-sa').value) || 2;
            const sK = parseInt(m.querySelector('#f-sk').value) || 2;
            const record = {
              id: Store.uid('m'), santriId, ustadzId: ustadzIdFor(santriId, 'Mutqin'),
              tanggal: m.querySelector('#f-tgl').value,
              sAwal: sA, aAwal: +m.querySelector('#f-aa').value,
              sAkhir: sK, aAkhir: +m.querySelector('#f-ak').value,
              nilai: +m.querySelector('#f-nilai').value, catatan: m.querySelector('#f-cat').value.trim(),
              totalHafalan: +m.querySelector('#f-total').value, _created: Date.now()
            };
            d.mutqin.push(record);
          } else {
            return;
          }

          const w = d.users.find(u => u.role === 'wali' && u.refId === s.waliId);
          if (w) Store.addNotif(w.id, 'wali', 'Setoran baru: ' + s.nama + ' (' + level + ')');
          let awalText = '-', hinggaText = '-', jmlText = '-', nilaiVal = 0, ketText = '-';
          if (level === 'Tahsin') {
            const ha = +m.querySelector('#f-ha').value;
            const hk = +m.querySelector('#f-hk').value;
            nilaiVal = +m.querySelector('#f-nilai').value;
            const cat = m.querySelector('#f-cat').value.trim();
            awalText = 'Halaman ' + ha;
            hinggaText = 'Halaman ' + hk;
            jmlText = ((hk >= ha) ? (hk - ha + 1) : 1) + ' hlm';
            ketText = cat || 'Tahsin';
          } else if (level === 'Mutqin') {
            const sA = parseInt(m.querySelector('#f-sa').value) || 2;
            const sK = parseInt(m.querySelector('#f-sk').value) || 2;
            const aA = +m.querySelector('#f-aa').value;
            const aK = +m.querySelector('#f-ak').value;
            const totalHlm = +m.querySelector('#f-total').value;
            nilaiVal = +m.querySelector('#f-nilai').value;
            const cat = m.querySelector('#f-cat').value.trim();
            awalText = 'Surat ' + (getSurah(sA) ? getSurah(sA).latin : sA) + ' Ayat ' + aA;
            hinggaText = 'Surat ' + (getSurah(sK) ? getSurah(sK).latin : sK) + ' Ayat ' + aK;
            jmlText = totalHlm + ' hlm';
            ketText = cat ? ('Murajaah Mutqin - ' + cat) : 'Murajaah Mutqin';
          }
          const msg = formatPesanSetoranWA({
            santri: s,
            awal: awalText,
            hingga: hinggaText,
            jumlah: jmlText,
            nilai: nilaiVal,
            keterangan: ketText,
            tanggal: m.querySelector('#f-tgl').value
          });
          waReport(santriId, msg);
          if (!await Store.save()) return;
          Store.log('Input umum: ' + s.nama + ' (' + level + ')');
          c();
          UI.toast('Setoran ' + level + ' tersimpan', 'success');
          refreshSetoranView();
        } }
      ]
    });

    if (level === 'Ziyadah') {
      const modalContent = modal.modal;
      const refreshBacaanPreview = bacaanRequired ? bindSetoranPreview(modalContent, 'b') : () => {};
      const refreshHafalanPreview = bindSetoranPreview(modalContent, 'h');
      const t = tanggalSetoran;
      const db = Store.get();
      let hSlide = null;

      setTimeout(() => {
        bindAyatMax('b-sa', 'b-aa,b-ak');
        bindAyatMax('b-sk', 'b-aa,b-ak');
      }, 50);

      if (hafalanReady) {
        modalContent.querySelector('#sec-hafalan').style.opacity = '1';
        modalContent.querySelector('#sec-hafalan').style.borderLeftColor = 'var(--primary)';
        setTimeout(() => {
          bindAyatMax('h-sa', 'h-aa');
          bindAyatMax('h-sk', 'h-ak');
          const calc = () => {
            const hsa = parseInt(document.getElementById('h-sa').value) || 0;
            const hsk = parseInt(document.getElementById('h-sk').value) || 0;
            const haa = +document.getElementById('h-aa').value;
            const hak = +document.getElementById('h-ak').value;
            const hh = computeHafalan(hsa, haa, hsk, hak);
            document.getElementById('calc-preview').innerHTML = hh
              ? `<b> Auto Hitung:</b> ${hh.ayahs} ayat · ${hh.pages} halaman · Juz ${hh.juzStart}${hh.juzRange > 1 ? '-' + hh.juzEnd : ''}`
              : '<span class="muted">Range belum valid.</span>';
          };
          document.querySelectorAll('#h-sa,#h-aa,#h-sk,#h-ak').forEach(el => el.oninput = calc);
          calc();
          hSlide = setInterval(calc, 300);
        }, 50);
      }

      if (bacaanRequired) modalContent.querySelector('#btn-simpan-bacaan').onclick = async () => {
        const sa = modalContent.querySelector('#b-sa').value;
        const sk = modalContent.querySelector('#b-sk').value;
        const sA = sa ? parseInt(sa) : defSA;
        const sK = sk ? parseInt(sk) : defSK;
        if (!sA || !sK) { UI.toast('Pilih surat yang valid', 'error'); return; }
        const sAyah = getSurah(sA); const sKyah = getSurah(sK);
        const aaEl = modalContent.querySelector('#b-aa');
        const akEl = modalContent.querySelector('#b-ak');
        if (sAyah && +aaEl.value > sAyah.ayahs) { UI.toast('Awal ayat melebihi batas surat', 'error'); return; }
        if (sKyah && +akEl.value > sKyah.ayahs) { UI.toast('Akhir ayat melebihi batas surat', 'error'); return; }

        const d = Store.get();
        d.ziyadahBacaan.push({
          id: Store.uid('zb'), santriId, ustadzId: ustadzIdFor(santriId, 'Ziyadah'),
          tanggal: tanggalSetoran, sAwal: sA, aAwal: +aaEl.value,
          sAkhir: sK, aAkhir: +akEl.value, _created: Date.now()
        });
        if (!await Store.save()) return;
        Store.log('Setor ziyadah bacaan ' + s.nama);
        UI.toast('Setoran bacaan tersimpan', 'success');

        modalContent.querySelector('#sec-bacaan').style.opacity = '0.5';
        modalContent.querySelector('#sec-bacaan').style.borderLeftColor = 'var(--muted)';
        modalContent.querySelectorAll('#sec-bacaan input').forEach(el => el.disabled = true);
        modalContent.querySelector('#btn-simpan-bacaan').style.display = 'none';
        modalContent.querySelector('#bacaan-ok').style.display = 'inline';

        modalContent.querySelector('#h-sa').value = surahLabel(sA);
        modalContent.querySelector('#h-sk').value = surahLabel(sK);
        modalContent.querySelector('#h-aa').value = aaEl.value;
        modalContent.querySelector('#h-ak').value = akEl.value;
        refreshHafalanPreview();

        modalContent.querySelector('#sec-hafalan').style.opacity = '1';
        modalContent.querySelector('#sec-hafalan').style.borderLeftColor = 'var(--primary)';
        modalContent.querySelectorAll('#h-sa,#h-aa,#h-sk,#h-ak,#f-nilai,#f-cat').forEach(el => el.disabled = false);
        modalContent.querySelector('#btn-simpan-hafalan').disabled = false;

        bindAyatMax('h-sa', 'h-aa');
        bindAyatMax('h-sk', 'h-ak');

        const calc = () => {
          const hsa = parseInt(document.getElementById('h-sa').value) || 0;
          const hsk = parseInt(document.getElementById('h-sk').value) || 0;
          const haa = +document.getElementById('h-aa').value;
          const hak = +document.getElementById('h-ak').value;
          const hh = computeHafalan(hsa, haa, hsk, hak);
          document.getElementById('calc-preview').innerHTML = hh
            ? `<b> Auto Hitung:</b> ${hh.ayahs} ayat · ${hh.pages} halaman · Juz ${hh.juzStart}${hh.juzRange > 1 ? '-' + hh.juzEnd : ''}`
            : '<span class="muted">Range belum valid.</span>';
        };
        document.querySelectorAll('#h-sa,#h-aa,#h-sk,#h-ak').forEach(el => el.oninput = calc);
        calc();
        hSlide = setInterval(calc, 300);
      };

      modalContent.querySelector('#btn-simpan-hafalan').onclick = async () => {
        const sa = modalContent.querySelector('#h-sa').value;
        const sk = modalContent.querySelector('#h-sk').value;
        const sA = sa ? parseInt(sa) : defSA;
        const sK = sk ? parseInt(sk) : defSK;
        const aA = +modalContent.querySelector('#h-aa').value;
        const aK = +modalContent.querySelector('#h-ak').value;
        const sAyh = getSurah(sA); const sKyh = getSurah(sK);
        if (sAyh && aA > sAyh.ayahs) { UI.toast('Awal ayat melebihi batas surat', 'error'); return; }
        if (sKyh && aK > sKyh.ayahs) { UI.toast('Akhir ayat melebihi batas surat', 'error'); return; }
        const h = computeHafalan(sA, aA, sK, aK);
        if (!h) { UI.toast('Range ayat tidak valid', 'error'); return; }

        const d = Store.get();
        d.ziyadahHafalan.push({
          id: Store.uid('zh'), santriId, ustadzId: ustadzIdFor(santriId, 'Ziyadah'),
          tanggal: tanggalSetoran, sAwal: sA, aAwal: aA,
          sAkhir: sK, aAkhir: aK, nilai: +modalContent.querySelector('#f-nilai').value,
          catatan: modalContent.querySelector('#f-cat').value.trim(), _created: Date.now()
        });
        const wUser = d.users.find(u => u.role === 'wali' && u.refId === s.waliId);
        if (wUser) Store.addNotif(wUser.id, 'wali', 'Setoran baru: ' + s.nama + ' (' + formatHafalan(h) + ')');
        const awalSurah = 'Surat ' + (getSurah(sA) ? getSurah(sA).latin : sA) + ' Ayat ' + aA;
        const hinggaSurah = 'Surat ' + (getSurah(sK) ? getSurah(sK).latin : sK) + ' Ayat ' + aK;
        const nilaiVal = +modalContent.querySelector('#f-nilai').value;
        const catVal = modalContent.querySelector('#f-cat').value.trim();
        const msg = formatPesanSetoranWA({
          santri: s,
          awal: awalSurah,
          hingga: hinggaSurah,
          jumlah: formatHafalan(h),
          nilai: nilaiVal,
          keterangan: catVal || '-',
          tanggal: tanggalSetoran
        });
        waReport(santriId, msg);
        if (!await Store.save()) return;
        Store.log('Setor ziyadah hafalan ' + s.nama);
        if (hSlide) clearInterval(hSlide);
        modal.close();
        UI.toast('Tersimpan · ' + formatHafalan(h), 'success');
        refreshSetoranView();
      };
    }
  }

  /* ---------------- Notifikasi ---------------- */
  function notif() {
    const c = ctx(); _scope = c.scope;
    Shared.shell(c.role, nav('ustadz_notif'), '');
    Shared.setHeader('Notifikasi', 'Pengingat untuk ustadz');
    const session = Store.getSession();
    document.getElementById('view-content').innerHTML = Shared.renderNotifikasi(session.userId);
    const clearBtn = document.getElementById('clear-notif');
    if (clearBtn) clearBtn.onclick = () => {
      if (confirm('Hapus semua notifikasi?')) {
        Store.clearNotifs(session.userId);
        document.getElementById('view-content').innerHTML = '<div class="empty">Notifikasi dikosongkan.</div>';
        UI.toast('Notifikasi dihapus', 'success');
      }
    };
  }

  return { nav, dashboard, absensi, talim, pembelajaran, riwayat, laporan, notif, sesiSaatIni };
})();
