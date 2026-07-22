/* ============================================================
   Tahfidzku — Wali (Orang Tua) Views
   ============================================================ */
const Wali = (() => {

  function nav(active) {
    return [
      { view: 'wali_dashboard', label: 'Dashboard', active: active === 'wali_dashboard' },
      { view: 'wali_perkembangan', label: 'Perkembangan', active: active === 'wali_perkembangan' },
      { view: 'wali_absensi', label: 'Absensi', active: active === 'wali_absensi' },
      { view: 'wali_catatan', label: 'Catatan', active: active === 'wali_catatan' },
      { view: 'wali_profil', label: 'Profil', active: active === 'wali_profil' },
      { view: 'quran', label: 'Al-Qur\'an', active: active === 'quran' }
    ];
  }

  function mySantri() {
    const session = Store.getSession();
    const w = Store.findWali(session.refId);
    const db = Store.get();
    return w ? db.santri.find(s => s.id === w.santriId) : null;
  }

  /* ---------------- Dashboard ---------------- */
  function dashboard() {
    Store.checkSetoranTerlewat();
    Shared.shell('wali', nav('wali_dashboard'), '');
    const s = mySantri();
    if (!s) { document.getElementById('view-content').innerHTML = '<div class="empty">Data anak tidak ditemukan.</div>'; return; }
    Shared.setHeader('Dashboard Wali', s.nama);
    const db = Store.get();
    const h = Store.totalHafalanSantri(s.id);
    const bulan = Store.todayStr().slice(0, 7);
    const kehadiran = Store.kehadiranBulan(s.id, bulan);
    const hadirSubuh = kehadiran.filter(k => k.status === 'Hadir' && k.sesi === 'Subuh').length;
    const hadirMaghrib = kehadiran.filter(k => k.status === 'Hadir' && k.sesi === 'Maghrib').length;
    const hadirIsya = kehadiran.filter(k => k.status === 'Hadir' && k.sesi === 'Isya').length;
    const totalHadir = hadirSubuh + hadirMaghrib + hadirIsya;
    const pct = kehadiran.length ? Math.round((totalHadir / kehadiran.length) * 100) : 0;
    const lastCat = db.catatan.filter(c => c.santriId === s.id).sort((a, b) => b.tanggal.localeCompare(a.tanggal))[0];
    const ustadz = db.ustadz.find(u => u.halaqah === s.halaqah);

    document.getElementById('view-content').innerHTML = `
      <div class="grid cols-2">
        <div class="clay-card" style="display:flex;gap:18px;align-items:center">
          <div class="progress-circle" style="--val:${pct}"><span>${pct}%</span></div>
          <div>
            <h3>${UI.esc(s.nama)}</h3>
            <div class="muted">${UI.esc(s.level)} · ${UI.esc(s.halaqah)}</div>
            <div class="muted">Ustadz: ${ustadz ? UI.esc(ustadz.nama) : '-'}</div>
          </div>
        </div>
        <div class="clay-card">
          <div class="section-title">📊 Ringkasan</div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span>Total Hafalan</span><b>${h ? formatHafalan(h) : '-'}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span>Kehadiran Bulan Ini</span><b>${totalHadir}/${kehadiran.length || 0} (${pct}%)</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0;font-size:13px"><span>🌅 Subuh</span><b>${hadirSubuh}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0;font-size:13px"><span>🌇 Maghrib</span><b>${hadirMaghrib}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0;font-size:13px"><span>🌙 Isya</span><b>${hadirIsya}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span>Rata-rata Nilai</span><b>${Store.avgNilai(s.id) || '-'}</b></div>
        </div>
      </div>
      <div class="clay-card mt">
        <div class="section-title">📝 Catatan Terakhir Ustadz</div>
        ${lastCat ? `<div>${UI.esc(lastCat.isi)}</div><div class="muted" style="font-size:12px;margin-top:6px">${UI.fmtDate(lastCat.tanggal)}</div>` : '<div class="empty">Belum ada catatan.</div>'}
      </div>
      ${renderNotifWali(Store.getSession().userId)}`;
  }

  function renderNotifWali(userId) {
    const list = Store.notifFor(userId);
    if (!list.length) return '';
    const items = list.slice(0, 10).map(n => `
      <div class="notif-item ${n.tipe === 'wali' ? 'notif-warn' : ''}" style="padding:8px 0;border-bottom:1px solid rgba(0,0,0,.06)">
        <div>${UI.esc(n.pesan)}</div>
        <div class="muted" style="font-size:11px;margin-top:2px">${UI.fmtDateTime(n.waktu || n.createdAt || '')}</div>
      </div>`).join('');
    return `
      <div class="clay-card mt">
        <div class="section-title">🔔 Notifikasi</div>
        ${items}
      </div>`;
  }

  /* ---------------- Perkembangan ---------------- */
  function perkembangan() {
    Shared.shell('wali', nav('wali_perkembangan'), '');
    const s = mySantri();
    if (!s) { document.getElementById('view-content').innerHTML = '<div class="empty">Data anak tidak ditemukan.</div>'; return; }
    Shared.setHeader('Perkembangan Hafalan', s.nama);
    const db = Store.get();
    const h = Store.totalHafalanSantri(s.id);

    // Tahsin
    const tahsin = db.tahsin.filter(t => t.santriId === s.id).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    // Ziyadah
    const ziy = db.ziyadahHafalan.filter(z => z.santriId === s.id).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    // Mutqin
    const mut = db.mutqin.filter(m => m.santriId === s.id).sort((a, b) => b.tanggal.localeCompare(a.tanggal));

    const tahsinRows = tahsin.map(t => `<tr><td>${UI.fmtDate(t.tanggal)}</td><td>Hal ${t.halAwal}-${t.halAkhir}</td><td>${t.nilai}</td><td class="muted">${UI.esc(t.catatan || '')}</td></tr>`).join('');
    const ziyRows = ziy.map(z => `<tr><td>${UI.fmtDate(z.tanggal)}</td><td>${getSurah(z.sAwal).latin}:${z.aAwal} → ${getSurah(z.sAkhir).latin}:${z.aAkhir}</td><td>${formatHafalan(computeHafalan(z.sAwal, z.aAwal, z.sAkhir, z.aAkhir))}</td><td>${z.nilai}</td></tr>`).join('');
    const mutRows = mut.map(m => `<tr><td>${UI.fmtDate(m.tanggal)}</td><td>${getSurah(m.sAwal).latin}:${m.aAwal} → ${getSurah(m.sAkhir).latin}:${m.aAkhir}</td><td>${m.totalHafalan} hlm</td><td>${m.nilai}</td></tr>`).join('');

    // grafik perkembangan (akumulasi halaman per setoran)
    let acc = 0;
    const chartData = ziy.slice().reverse().map(z => { const hh = computeHafalan(z.sAwal, z.aAwal, z.sAkhir, z.aAkhir); acc += hh ? hh.pages : 0; return { label: UI.fmtDate(z.tanggal).split(' ')[0], value: acc }; });

    document.getElementById('view-content').innerHTML = `
      <div class="grid kpi">
        ${Shared.statCard('📖', h ? h.pages + ' hlm' : '-', 'Total Hafalan', '#16A34A')}
        ${Shared.statCard('📝', ziy.length, 'Setoran Ziyadah', '#3B82F6')}
        ${Shared.statCard('🏆', mut.length, 'Murajaah Mutqin', '#FACC15')}
        ${Shared.statCard('⭐', Store.avgNilai(s.id) || '-', 'Rata² Nilai', '#22C55E')}
      </div>
      <div class="clay-card mt">
        <div class="section-title">📈 Grafik Perkembangan Hafalan</div>
        ${chartData.length ? Shared.barChart(chartData, Math.max(1, ...chartData.map(d => d.value))) : '<div class="empty">Belum ada data setoran.</div>'}
      </div>
      <div class="clay-card mt">
        <div class="section-title">📖 Tahsin</div>
        <div class="table-wrap"><table class="clay-table"><thead><tr><th>Tanggal</th><th>Halaman</th><th>Nilai</th><th>Catatan</th></tr></thead><tbody>${tahsinRows || '<tr><td colspan="4"><div class="empty">Belum ada.</div></td></tr>'}</tbody></table></div>
      </div>
      <div class="clay-card mt">
        <div class="section-title">📝 Ziyadah</div>
        <div class="table-wrap"><table class="clay-table"><thead><tr><th>Tanggal</th><th>Setoran</th><th>Total</th><th>Nilai</th></tr></thead><tbody>${ziyRows || '<tr><td colspan="4"><div class="empty">Belum ada.</div></td></tr>'}</tbody></table></div>
      </div>
      <div class="clay-card mt">
        <div class="section-title">🏆 Mutqin</div>
        <div class="table-wrap"><table class="clay-table"><thead><tr><th>Tanggal</th><th>Murajaah</th><th>Total</th><th>Nilai</th></tr></thead><tbody>${mutRows || '<tr><td colspan="4"><div class="empty">Belum ada.</div></td></tr>'}</tbody></table></div>
      </div>`;
  }

  /* ---------------- Absensi (multi-sesi) ---------------- */
  function absensi() {
    Shared.shell('wali', nav('wali_absensi'), '');
    const s = mySantri();
    if (!s) { document.getElementById('view-content').innerHTML = '<div class="empty">Data anak tidak ditemukan.</div>'; return; }
    Shared.setHeader('Absensi', s.nama);
    const db = Store.get();
    const kehadiran = db.kehadiran.filter(k => k.santriId === s.id).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    const counts = { Hadir: 0, Izin: 0, Sakit: 0, Alfa: 0 };
    kehadiran.forEach(k => counts[k.status]++);
    const rows = kehadiran.slice(0, 30).map(k => `<tr><td>${UI.fmtDate(k.tanggal)}</td><td>${k.sesi ? '<span class="pill sm" style="font-size:11px;padding:2px 8px">' + k.sesi + '</span>' : ''}</td><td><span class="badge ${k.status === 'Hadir' ? 'green' : k.status === 'Izin' ? 'warn' : k.status === 'Sakit' ? 'blue' : 'danger'}">${k.status}</span></td></tr>`).join('');
    document.getElementById('view-content').innerHTML = `
      <div class="grid kpi">
        ${Shared.statCard('🟢', counts.Hadir, 'Hadir', '#22C55E')}
        ${Shared.statCard('🟡', counts.Izin, 'Izin', '#FACC15')}
        ${Shared.statCard('🔵', counts.Sakit, 'Sakit', '#3B82F6')}
        ${Shared.statCard('🔴', counts.Alfa, 'Alfa', '#EF4444')}
      </div>
      <div class="clay-card mt">
        <div class="section-title">📅 Riwayat Kehadiran</div>
        <div class="table-wrap"><table class="clay-table"><thead><tr><th>Tanggal</th><th>Sesi</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="3"><div class="empty">Belum ada.</div></td></tr>'}</tbody></table></div>
      </div>`;
  }

  /* ---------------- Catatan ---------------- */
  function catatan() {
    Shared.shell('wali', nav('wali_catatan'), '');
    const s = mySantri();
    if (!s) { document.getElementById('view-content').innerHTML = '<div class="empty">Data anak tidak ditemukan.</div>'; return; }
    Shared.setHeader('Catatan Ustadz', s.nama);
    const db = Store.get();
    const list = db.catatan.filter(c => c.santriId === s.id).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    document.getElementById('view-content').innerHTML = `
      <div class="clay-card">
        ${list.length ? list.map(c => `<div class="row center" style="justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee"><div>${UI.esc(c.isi)}</div><span class="muted" style="font-size:12px">${UI.fmtDate(c.tanggal)}</span></div>`).join('') : '<div class="empty">Belum ada catatan.</div>'}
      </div>`;
  }

  /* ---------------- Profil ---------------- */
  function profil() {
    Shared.shell('wali', nav('wali_profil'), '');
    const w = Store.findWali(Store.getSession().refId);
    const s = mySantri();
    Shared.setHeader('Profil', 'Data Wali & Santri');
    const db = Store.get();
    const ustadz = s ? db.ustadz.find(u => u.halaqah === s.halaqah) : null;
    document.getElementById('view-content').innerHTML = `
      <div class="grid cols-2">
        <div class="clay-card">
          <div class="section-title">👤 Data Santri</div>
          ${s ? `
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Nama</span><b>${UI.esc(s.nama)}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">NIS</span><b>${UI.esc(s.nis)}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">JK</span><b>${UI.esc(s.jk)}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Level</span><b>${UI.esc(s.level)}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Kelas</span><b>${UI.esc(s.kelas)}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Halaqah</span><b>${UI.esc(s.halaqah)}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Ustadz</span><b>${ustadz ? UI.esc(ustadz.nama) : '-'}</b></div>` : '<div class="empty">-</div>'}
        </div>
        <div class="clay-card">
          <div class="section-title">👪 Data Wali</div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Nama Wali</span><b>${w ? UI.esc(w.nama) : '-'}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">No HP</span><b>${w ? UI.esc(w.noHp) : '-'}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Username Login</span><b>${w ? UI.esc((db.users.find(u => u.refId === w.id) || {}).username || '-') : '-'}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Password</span><b>••••••••</b></div>
        </div>
      </div>`;
  }

  return { nav, dashboard, perkembangan, absensi, catatan, profil };
})();
