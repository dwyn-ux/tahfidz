/* ============================================================
   Tahfidzku — Wali (Orang Tua) Views
   ============================================================ */
const Wali = (() => {

  function nav(active) {
    const items = [
      { view: 'wali_dashboard', label: 'Dashboard', icon: Shared.icon('dashboard'), active: active === 'wali_dashboard' },
      { view: 'wali_perkembangan', label: 'Perkembangan', icon: Shared.icon('laporan'), active: active === 'wali_perkembangan' },
      { view: 'wali_raport', feature: 'raport', label: 'Raport', icon: Shared.icon('award'), active: active === 'wali_raport' },
      { view: 'wali_absensi', feature: 'presensi', label: 'Absensi', icon: Shared.icon('calendar'), active: active === 'wali_absensi' },
      { view: 'wali_spp', feature: 'spp', label: 'SPP', icon: Shared.icon('award'), active: active === 'wali_spp' },
      { view: 'wali_catatan', label: 'Catatan', icon: Shared.icon('chat'), active: active === 'wali_catatan' },
      { view: 'wali_profil', label: 'Profil', icon: Shared.icon('user'), active: active === 'wali_profil' },
      { view: 'quran', feature: 'quran', label: 'Al-Qur\'an', icon: Shared.icon('quran'), active: active === 'quran' }
    ];
    return items.filter(it => !it.feature || Store.hasFeature(it.feature));
  }

  let activeSantriId = null;
  try { activeSantriId = localStorage.getItem('tahfidzku_active_santri'); } catch (_) {}

  function mySantri() {
    const db = Store.get();
    if (!db.santri || !db.santri.length) return null;
    if (activeSantriId) {
      const found = db.santri.find(s => s.id === activeSantriId);
      if (found) return found;
    }
    const session = Store.getSession();
    const w = Store.findWali(session ? session.refId : null);
    if (w && w.santriId) {
      const found = db.santri.find(s => s.id === w.santriId);
      if (found) {
        activeSantriId = found.id;
        return found;
      }
    }
    activeSantriId = db.santri[0].id;
    return db.santri[0];
  }

  function switchSantri(id) {
    activeSantriId = id;
    try { localStorage.setItem('tahfidzku_active_santri', id); } catch (_) {}
    const currentView = App.currentView ? App.currentView() : 'wali_dashboard';
    App.navigate(currentView, { replaceHistory: true });
  }

  function santriSwitcherHtml(activeSantri) {
    const db = Store.get();
    if (!db.santri || db.santri.length <= 1) return '';
    return `
      <div class="santri-switcher clay-card pad-sm mb" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:var(--slate-50);border:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:34px;height:34px;border-radius:8px;background:var(--primary-light);color:var(--primary);display:grid;place-items:center">
            ${Shared.icon('users')}
          </div>
          <div>
            <b style="font-size:13px;color:var(--text)">Pilih Santri / Anak:</b>
            <div class="muted" style="font-size:11.5px">${db.santri.length} anak terdaftar di akun wali ini</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${db.santri.map(s => `
            <button type="button" class="clay-btn sm ${s.id === activeSantri.id ? 'primary' : 'ghost'}" onclick="Wali.switchSantri('${UI.esc(s.id)}')">
              ${UI.esc(s.nama)}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  function ustadzNamesForSantri(santri) {
    if (!santri) return [];
    const db = Store.get();
    const names = Store.halaqahForSantri(santri)
      .flatMap(halaqah => Store.ustadzNamesForHalaqah(halaqah));
    if (names.length) return [...new Set(names)];
    // Bootstrap wali hanya mengirim ustadz pengampu anaknya, sehingga fallback
    // ini tetap aman sekalipun data halaqah belum tersedia dari server lama.
    return [...new Set(db.ustadz.map(u => u.nama).filter(Boolean))];
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
    const sesiList = Store.sesiList();
    const halaqahKehadiran = Store.kehadiranBulan(s.id, bulan).filter(k => !Store.isTalimSesi(k.sesi));
    const hadirPerSesi = sesiList.map(sesi => ({
      sesi,
      jam: Store.sesiRangeLabel(sesi),
      count: halaqahKehadiran.filter(k => k.status === 'Hadir' && k.sesi === sesi).length
    }));
    const totalHadir = halaqahKehadiran.filter(k => k.status === 'Hadir').length;
    const totalLibur = halaqahKehadiran.filter(k => k.status === 'Libur').length;
    const totalEfektif = Math.max(0, halaqahKehadiran.length - totalLibur);
    const pct = totalEfektif ? Math.round((totalHadir / totalEfektif) * 100) : 0;
    const lastCat = db.catatan.filter(c => c.santriId === s.id).sort((a, b) => b.tanggal.localeCompare(a.tanggal))[0];
    const ustadzNames = ustadzNamesForSantri(s);

    const hasPresensi = Store.hasFeature('presensi');
    const hasSpp = Store.hasFeature('spp');
    const sppNow = hasSpp ? Store.sppStatusSantri(s, bulan) : null;
    const sppBadgeCls = sppNow ? (sppNow.status === 'Lunas' ? 'green' : sppNow.status === 'Jatuh Tempo' ? 'danger' : sppNow.status === 'Bebas' ? 'gray' : 'warn') : '';
    document.getElementById('view-content').innerHTML = `
      ${santriSwitcherHtml(s)}
      <div class="grid cols-2">
        <div class="clay-card" style="display:flex;gap:18px;align-items:center">
          ${hasPresensi ? `<div class="progress-circle" style="--val:${pct}"><span>${pct}%</span></div>` : ''}
          <div>
            <h3>${UI.esc(s.nama)}</h3>
            <div class="muted">${UI.esc(Store.programSummaryForSantri(s))}</div>
            <div class="muted" style="font-size:12px">${UI.esc(Store.halaqahSummaryForSantri(s))}</div>
            <div class="muted">Ustadz: ${UI.esc(ustadzNames.join(', ') || '-')}</div>
          </div>
        </div>
        <div class="clay-card">
          <div class="section-title">Ringkasan</div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span>Total Hafalan</span><b>${h ? formatHafalan(h) : '-'}</b></div>
          ${hasPresensi ? `
            <div class="row" style="justify-content:space-between;padding:6px 0"><span>Kehadiran Bulan Ini</span><b>${totalHadir}/${totalEfektif} (${pct}%)${totalLibur ? ` <span class="muted" style="font-weight:normal;font-size:12px">(Libur: ${totalLibur})</span>` : ''}</b></div>
            ${hadirPerSesi.map(item => `<div class="row" style="justify-content:space-between;padding:6px 0;font-size:13px"><span>${UI.esc(item.sesi)}${item.jam ? ` <span class="muted" style="font-size:11px">(${UI.esc(item.jam)})</span>` : ''}</span><b>${item.count}</b></div>`).join('')}
          ` : ''}
          ${sppNow ? `<div class="row" style="justify-content:space-between;padding:6px 0"><span>SPP Bulan Ini</span><b>Rp ${Number(sppNow.nominal).toLocaleString('id-ID')} <span class="badge ${sppBadgeCls} sm">${UI.esc(sppNow.status)}</span></b></div>` : ''}
          <div class="row" style="justify-content:space-between;padding:6px 0"><span>Rata-rata Nilai</span><b>${Store.avgNilai(s.id) || '-'}</b></div>
        </div>
      </div>
      <div class="clay-card mt">
        <div class="section-title">Catatan Terakhir Ustadz</div>
        ${lastCat ? `<div>${UI.esc(lastCat.isi)}</div><div class="muted" style="font-size:12px;margin-top:6px">${UI.fmtDate(lastCat.tanggal)}</div>` : '<div class="empty">Belum ada catatan.</div>'}
      </div>
      ${Store.hasFeature('notifikasi') ? renderNotifWali(Store.getSession().userId) : ''}`;
  }

  function renderNotifWali(userId) {
    const list = Store.notifFor(userId);
    if (!list.length) return '';
    const items = list.slice(0, 10).map(n => `
      <div class="notif-item ${n.tipe === 'wali' ? 'notif-warn' : ''}" style="padding:8px 0;border-bottom:1px solid rgba(0,0,0,.06)">
        <div>${UI.esc(n.pesan)}</div>
        <div class="muted" style="font-size:11px;margin-top:2px">${UI.fmtDateTime(n.tanggal || n.waktu || n.createdAt || '')}</div>
      </div>`).join('');
    return `
      <div class="clay-card mt">
        <div class="section-title">Notifikasi</div>
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
    // Murojaah bebas — dihitung terpisah, tidak masuk total hafalan di atas.
    const muro = (db.murojaah || []).filter(m => m.santriId === s.id).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    const totalMuro = Store.totalMurojaahSantri(s.id);

    const tahsinRows = tahsin.map(t => `<tr><td>${UI.fmtDate(t.tanggal)}</td><td>Hal ${t.halAwal}-${t.halAkhir}</td><td>${t.nilai}</td><td class="muted">${UI.esc(t.catatan || '')}</td></tr>`).join('');
    const ziyRows = ziy.map(z => `<tr><td>${UI.fmtDate(z.tanggal)}</td><td>${getSurah(z.sAwal).latin}:${z.aAwal} → ${getSurah(z.sAkhir).latin}:${z.aAkhir}</td><td>${formatHafalan(computeHafalan(z.sAwal, z.aAwal, z.sAkhir, z.aAkhir))}</td><td>${z.nilai}</td></tr>`).join('');
    const mutRows = mut.map(m => `<tr><td>${UI.fmtDate(m.tanggal)}</td><td>${getSurah(m.sAwal).latin}:${m.aAwal} → ${getSurah(m.sAkhir).latin}:${m.aAkhir}</td><td>${m.totalHafalan} hlm</td><td>${m.nilai}</td></tr>`).join('');
    const muroRows = muro.map(m => `<tr><td>${UI.fmtDate(m.tanggal)}</td><td>${getSurah(m.sAwal).latin}:${m.aAwal} → ${getSurah(m.sAkhir).latin}:${m.aAkhir}</td><td>${formatHafalan(computeHafalan(m.sAwal, m.aAwal, m.sAkhir, m.aAkhir))}</td><td>${m.nilai === null || m.nilai === undefined || m.nilai === '' ? '-' : m.nilai}</td></tr>`).join('');

    // grafik perkembangan: halaman penuh yang sudah selesai sampai tiap tanggal
    const urutSetoran = [...ziy, ...mut].sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)));
    const chartData = urutSetoran.map((z, i) => ({
      label: UI.fmtDate(z.tanggal).split(' ')[0],
      value: cakupanHalaman(urutSetoran.slice(0, i + 1)).full.size
    }));

    const hasTahsin = Store.hasFeature('tahsin');
    const hasZiyadah = Store.hasFeature('ziyadah');
    const hasMutqin = Store.hasFeature('mutqin');
    const hasMurojaah = Store.hasFeature('murojaah');
    const showHafalan = hasZiyadah || hasMutqin;

    const tabs = [
      showHafalan ? { key: 'ringkasan', label: 'Grafik & Peta' } : null,
      hasTahsin ? { key: 'tahsin', label: `Tahsin (${tahsin.length})` } : null,
      hasZiyadah ? { key: 'ziyadah', label: `Ziyadah (${ziy.length})` } : null,
      hasMutqin ? { key: 'mutqin', label: `Mutqin (${mut.length})` } : null,
      hasMurojaah ? { key: 'murojaah', label: `Murojaah (${muro.length})` } : null,
    ].filter(Boolean);
    const defaultTab = tabs[0] ? tabs[0].key : 'empty';

    document.getElementById('view-content').innerHTML = `
      ${santriSwitcherHtml(s)}
      <div class="grid kpi mb">
        ${showHafalan ? Shared.statCard(Shared.icon('quran'), h ? h.pages + ' hlm' : '-', 'Total Hafalan', 'var(--primary)') : ''}
        ${hasTahsin ? Shared.statCard(Shared.icon('setoran'), tahsin.length, 'Setoran Tahsin', '#0d9488') : ''}
        ${hasZiyadah ? Shared.statCard(Shared.icon('setoran'), ziy.length, 'Setoran Ziyadah', 'var(--secondary)') : ''}
        ${hasMutqin ? Shared.statCard(Shared.icon('star'), mut.length, 'Murajaah Mutqin', '#ca8a04') : ''}
        ${hasMurojaah ? Shared.statCard(Shared.icon('riwayat'), totalMuro ? totalMuro.pages + ' hlm' : '-', 'Murojaah Bebas', '#7e22ce') : ''}
        ${Shared.statCard(Shared.icon('award'), Store.avgNilai(s.id) || '-', 'Rata² Nilai', '#16a34a')}
      </div>
      ${tabs.length ? `<div class="pill-tabs" id="wali-prog-tabs" style="margin-bottom:12px">
        ${tabs.map(t => `<button class="pill ${t.key === defaultTab ? 'active' : ''}" type="button" data-wp-tab="${t.key}">${t.label}</button>`).join('')}
      </div>` : '<div class="clay-card"><div class="empty">Belum ada program aktif.</div></div>'}
      ${showHafalan ? `<div data-wp-panel="ringkasan" ${defaultTab === 'ringkasan' ? '' : 'style="display:none"'}>
        <div class="clay-card mb">
          <div class="section-title">Grafik Perkembangan Hafalan</div>
          ${chartData.length ? Shared.barChart(chartData, Math.max(1, ...chartData.map(d => d.value))) : '<div class="empty">Belum ada data setoran.</div>'}
        </div>
        <div class="clay-card">
          <div class="section-title">Peta Hafalan</div>
          <div class="muted" style="font-size:12px;margin-bottom:8px">Abu-abu = belum disetor · Kuning = disetor sebagian · Hijau = selesai 1 halaman</div>
          <div style="overflow:auto;max-height:340px">${Shared.hafalanMapHTML(s.id)}</div>
        </div>
      </div>` : ''}
      ${hasTahsin ? `<div class="clay-card" data-wp-panel="tahsin" ${defaultTab === 'tahsin' ? '' : 'style="display:none"'}>
        <div class="section-title">Tahsin</div>
        <div class="table-wrap"><table class="clay-table"><thead><tr><th>Tanggal</th><th>Halaman</th><th>Nilai</th><th>Catatan</th></tr></thead><tbody>${tahsinRows || '<tr><td colspan="4"><div class="empty">Belum ada.</div></td></tr>'}</tbody></table></div>
      </div>` : ''}
      ${hasZiyadah ? `<div class="clay-card" data-wp-panel="ziyadah" ${defaultTab === 'ziyadah' ? '' : 'style="display:none"'}>
        <div class="section-title">Ziyadah</div>
        <div class="table-wrap"><table class="clay-table"><thead><tr><th>Tanggal</th><th>Setoran</th><th>Total</th><th>Nilai</th></tr></thead><tbody>${ziyRows || '<tr><td colspan="4"><div class="empty">Belum ada.</div></td></tr>'}</tbody></table></div>
      </div>` : ''}
      ${hasMutqin ? `<div class="clay-card" data-wp-panel="mutqin" ${defaultTab === 'mutqin' ? '' : 'style="display:none"'}>
        <div class="section-title">Mutqin</div>
        <div class="table-wrap"><table class="clay-table"><thead><tr><th>Tanggal</th><th>Murajaah</th><th>Total</th><th>Nilai</th></tr></thead><tbody>${mutRows || '<tr><td colspan="4"><div class="empty">Belum ada.</div></td></tr>'}</tbody></table></div>
      </div>` : ''}
      ${hasMurojaah ? `<div class="clay-card" data-wp-panel="murojaah" ${defaultTab === 'murojaah' ? '' : 'style="display:none"'}>
        <div class="section-title">Murojaah (Bebas)</div>
        <div class="muted" style="font-size:12px;margin-bottom:8px">${totalMuro ? `${muro.length} setoran · ${totalMuro.ayahs} ayat · <b>${totalMuro.pages} halaman penuh</b>` : 'Belum ada setoran murojaah.'} Angka ini tidak menambah Total Hafalan di atas.</div>
        <div class="table-wrap"><table class="clay-table"><thead><tr><th>Tanggal</th><th>Setoran</th><th>Capaian</th><th>Nilai</th></tr></thead><tbody>${muroRows || '<tr><td colspan="4"><div class="empty">Belum ada.</div></td></tr>'}</tbody></table></div>
      </div>` : ''}`;

    document.querySelectorAll('[data-wp-tab]').forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.wpTab;
        document.querySelectorAll('[data-wp-tab]').forEach(b => b.classList.toggle('active', b.dataset.wpTab === key));
        document.querySelectorAll('[data-wp-panel]').forEach(p => { p.style.display = p.dataset.wpPanel === key ? '' : 'none'; });
      };
    });
  }

  /* ---------------- Absensi (multi-sesi) ---------------- */
  function absensi() {
    Shared.shell('wali', nav('wali_absensi'), '');
    const s = mySantri();
    if (!s) { document.getElementById('view-content').innerHTML = '<div class="empty">Data anak tidak ditemukan.</div>'; return; }
    Shared.setHeader('Absensi', s.nama);
    const db = Store.get();
    const kehadiran = Store.dedupeKehadiran(db.kehadiran.filter(k => k.santriId === s.id)).sort((a, b) => b.tanggal.localeCompare(a.tanggal) || String(b.sesi).localeCompare(String(a.sesi)));
    const counts = { Hadir: 0, Izin: 0, Sakit: 0, Alfa: 0, Libur: 0 };
    kehadiran.forEach(k => { if (counts[k.status] !== undefined) counts[k.status]++; });
    const rows = kehadiran.slice(0, 30).map(k => {
      const cls = k.status === 'Hadir' ? 'green' : k.status === 'Izin' ? 'warn' : k.status === 'Sakit' ? 'blue' : k.status === 'Libur' ? 'purple' : 'danger';
      const ket = k.keterangan || k.catatan;
      const catatanText = ket ? `<div class="muted" style="font-size:11px;font-style:italic">(${UI.esc(ket)})</div>` : '';
      return `<tr><td>${UI.fmtDate(k.tanggal)}</td><td>${k.sesi ? '<span class="pill sm" style="font-size:11px;padding:2px 8px">' + UI.esc(k.sesi) + '</span>' : ''}</td><td><span class="badge ${cls}">${UI.esc(k.status)}</span>${catatanText}</td></tr>`;
    }).join('');
    document.getElementById('view-content').innerHTML = `
      ${santriSwitcherHtml(s)}
      <div class="grid kpi">
        ${Shared.statCard(Shared.icon('presensi'), counts.Hadir, 'Hadir', '#16a34a')}
        ${Shared.statCard(Shared.icon('setoran'), counts.Izin, 'Izin', '#ca8a04')}
        ${Shared.statCard(Shared.icon('users'), counts.Sakit, 'Sakit', 'var(--secondary)')}
        ${counts.Libur ? Shared.statCard(Shared.icon('calendar'), counts.Libur, 'Libur', '#7e22ce') : ''}
        ${Shared.statCard(Shared.icon('calendar'), counts.Alfa, 'Alfa', '#dc2626')}
      </div>
      <div class="clay-card mt">
        <div class="section-title">Riwayat Kehadiran</div>
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
      ${santriSwitcherHtml(s)}
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
    const ustadzNames = ustadzNamesForSantri(s);
    document.getElementById('view-content').innerHTML = `
      ${santriSwitcherHtml(s)}
      <div class="grid cols-2">
        <div class="clay-card">
          <div class="section-title">Data Santri</div>
          ${s ? `
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Nama</span><b>${UI.esc(s.nama)}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">NIS</span><b>${UI.esc(s.nis)}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">JK</span><b>${UI.esc(s.jk)}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Program Aktif</span><b>${UI.esc(Store.programSummaryForSantri(s))}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Tingkat &amp; Kelas</span><b>${UI.esc(Store.educationLabel(s))}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Halaqah</span><b>${UI.esc(Store.halaqahSummaryForSantri(s))}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Ustadz</span><b>${UI.esc(ustadzNames.join(', ') || '-')}</b></div>` : '<div class="empty">-</div>'}
        </div>
        <div class="clay-card">
          <div class="section-title">Data Wali</div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Nama Wali</span><b>${w ? UI.esc(w.nama) : '-'}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">No HP</span><b>${w ? UI.esc(w.noHp) : '-'}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Username Login</span><b>${w ? UI.esc((db.users.find(u => u.refId === w.id) || {}).username || '-') : '-'}</b></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Password</span><b>••••••••</b></div>
          <div class="row mt" style="gap:8px">
            <button class="clay-btn sm secondary" id="btn-edit-profil">Edit Profil</button>
            <button class="clay-btn sm ghost" id="btn-ganti-pass">Ganti Password</button>
          </div>
        </div>
      </div>`;

    document.getElementById('btn-edit-profil').onclick = () => editProfilModal(w);
    document.getElementById('btn-ganti-pass').onclick = () => Shared.gantiPassModal();
  }

  function editProfilModal(w) {
    const body = `
      ${UI.field('Nama Wali', `<input class="clay-input" id="p-nama" value="${w ? UI.esc(w.nama) : ''}">`)}
      ${UI.field('No HP', `<input class="clay-input" id="p-hp" value="${w ? UI.esc(w.noHp) : ''}">`)}`;
    UI.openModal({
      title: 'Edit Profil', bodyHTML: body,
      actions: [
        { label: 'Batal', cls: 'ghost', onClick: (m, c) => c() },
        { label: 'Simpan', cls: 'primary', onClick: async (m, c) => {
          const nama = m.querySelector('#p-nama').value.trim();
          const noHp = m.querySelector('#p-hp').value.trim();
          if (!nama) { UI.toast('Nama wajib diisi', 'error'); return; }
          const db = Store.get();
          const wali = Store.findWali(Store.getSession().refId);
          if (wali) {
            wali.nama = nama;
            wali.noHp = noHp;
          }
          await Store.save(); Store.log('Edit profil wali'); c(); UI.toast('Profil tersimpan', 'success'); profil();
        } }
      ]
    });
  }

  /* ---------------- SPP Santri ---------------- */
  function spp() {
    Shared.shell('wali', nav('wali_spp'), '');
    const s = mySantri();
    if (!s) { document.getElementById('view-content').innerHTML = '<div class="empty">Data anak tidak ditemukan.</div>'; return; }
    Shared.setHeader('Pembayaran SPP', s.nama);
    const db = Store.get();
    const bulanIni = Store.todayStr().slice(0, 7);
    const nowInfo = Store.sppStatusSantri(s, bulanIni);
    const badgeCls = nowInfo.status === 'Lunas' ? 'green' : nowInfo.status === 'Jatuh Tempo' ? 'danger' : nowInfo.status === 'Bebas' ? 'gray' : 'warn';
    const history = (db.pembayaranSpp || []).filter(p => p.santriId === s.id).sort((a, b) => String(b.bulan || '').localeCompare(String(a.bulan || '')));
    const rows = history.map(p => `<tr>
      <td><b>${UI.esc(Shared.bulanLabel(p.bulan || ''))}</b></td>
      <td>Rp ${Number(p.nominal || 0).toLocaleString('id-ID')}</td>
      <td>${UI.esc(UI.fmtDate(p.tanggalBayar || ''))}</td>
      <td>${UI.esc(p.metode || 'Tunai')}</td>
      <td><span class="badge green sm">Lunas</span></td>
      <td class="muted">${UI.esc(p.catatan || '-')}</td>
    </tr>`).join('');
    document.getElementById('view-content').innerHTML = `
      ${santriSwitcherHtml(s)}
      <div class="clay-card mb">
        <div class="row center" style="justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div>
            <div class="muted" style="font-size:12px">Tagihan Bulan ${UI.esc(Shared.bulanLabel(bulanIni))}</div>
            <div style="font-size:22px;font-weight:700;margin-top:2px">Rp ${Number(nowInfo.nominal).toLocaleString('id-ID')}</div>
            <div class="muted" style="font-size:12px;margin-top:4px">Jatuh tempo setiap tanggal <b>${nowInfo.dueDay}</b> (${UI.esc(UI.fmtDate(nowInfo.dueDate))})</div>
          </div>
          <span class="badge ${badgeCls}" style="font-size:13px;padding:6px 14px">${UI.esc(nowInfo.status)}</span>
        </div>
      </div>
      <div class="clay-card">
        <div class="section-title">Riwayat Pembayaran SPP</div>
        <div class="table-wrap"><table class="clay-table table-wide">
          <thead><tr><th>Bulan</th><th>Nominal</th><th>Tanggal Bayar</th><th>Metode</th><th>Status</th><th>Catatan</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6"><div class="empty">Belum ada riwayat pembayaran SPP.</div></td></tr>'}</tbody>
        </table></div>
      </div>`;
  }

  function raport() {
    const s = mySantri();
    Shared.shell('wali', nav('wali_raport'), '');
    if (!s) {
      Shared.setHeader('Raport Santri', '-');
      document.getElementById('view-content').innerHTML = '<div class="empty">Data santri tidak ditemukan.</div>';
      return;
    }
    Shared.setHeader('Raport Santri', s.nama);
    const root = document.getElementById('view-content');
    root.innerHTML = `${santriSwitcherHtml(s)}<div id="wali-raport-wrap"></div>`;
    Shared.renderRaportPage(document.getElementById('wali-raport-wrap'), {
      mode: 'wali',
      canEdit: false,
      santriList: [s]
    });
  }

  return { nav, dashboard, perkembangan, raport, absensi, catatan, profil, spp, switchSantri };
})();
