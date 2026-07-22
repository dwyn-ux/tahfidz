/* ============================================================
   Tahfidzku — Shared Views (shell, dashboard helpers, riwayat,
   laporan, notifikasi)
   ============================================================ */
const Shared = (() => {

  function shell(role, navItems, contentHTML) {
    const session = Store.getSession();
    const db = Store.get();
    let userName = 'Pengguna';
    if (role === 'admin') userName = 'Administrator';
    else if (role === 'ustadz') { const u = Store.findUstadz(session.refId); userName = u ? u.nama : 'Ustadz'; }
    else if (role === 'wali') { const w = Store.findWali(session.refId); userName = w ? w.nama : 'Wali'; }

    const nav = navItems.map(n => `
      <button class="nav-item ${n.active ? 'active' : ''}" data-view="${n.view}">
        ${n.label}
      </button>`).join('');

    document.getElementById('app').innerHTML = `
      <div class="app-shell">
        <div class="scrim" id="scrim"></div>
        <aside class="sidebar" id="sidebar">
          <div class="brand"><span class="logo"></span> Tahfidzku</div>
          ${nav}
          <div class="spacer"></div>
          <div class="user-box">
            <b>${UI.esc(userName)}</b>
            <span class="muted">${role.toUpperCase()}</span>
            <button class="clay-btn ghost sm" id="btn-logout" style="width:100%;margin-top:10px;justify-content:center">Keluar</button>
          </div>
        </aside>
        <main class="main">
          <div class="topbar">
            <div>
              <button class="menu-toggle" id="menu-toggle">☰</button>
              <h1 id="page-title">Dashboard</h1>
              <div class="sub" id="page-sub">${UI.esc(db.settings.namaLembaga)}</div>
            </div>
            <div class="actions" id="topbar-actions">
              <div id="search-wrap"></div>
            </div>
          </div>
          <div id="view-content">${contentHTML}</div>
        </main>
      </div>`;

    document.getElementById('btn-logout').onclick = () => {
      Store.logout(); UI.toast('Berhasil keluar', 'info'); Auth.renderLogin();
    };
    document.getElementById('menu-toggle').onclick = () => {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('scrim').classList.toggle('show');
    };
    document.getElementById('scrim').onclick = () => {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('scrim').classList.remove('show');
    };
    document.querySelectorAll('.nav-item').forEach(b => {
      b.onclick = () => { App.navigate(b.dataset.view); };
    });
    UI.renderSearch();
  }

  function setHeader(title, sub) {
    const t = document.getElementById('page-title'); const s = document.getElementById('page-sub');
    if (t) t.textContent = title; if (s && sub) s.textContent = sub;
  }
  function setActions(html) {
    const a = document.getElementById('topbar-actions');
    if (a) a.innerHTML = html;
  }

  /* KPI stat card */
  function statCard(icon, num, label, color) {
    return `<div class="stat">
      <div class="icon" style="background:${color}22;color:${color}">${icon}</div>
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

  /* ---------- Riwayat Santri (shared) ---------- */
  function renderRiwayat(santriId) {
    const db = Store.get();
    const s = Store.findSantri(santriId);
    if (!s) return `<div class="empty">Santri tidak ditemukan.</div>`;
    const items = [];
    db.tahsin.filter(t => t.santriId === santriId).forEach(t => items.push({ t: t.tanggal, html: `<b>Tahsin</b> — Hal ${t.halAwal}-${t.halAkhir} · Nilai <b>${t.nilai}</b><div class="muted">${UI.esc(t.catatan || '')}</div>` }));
    db.ziyadahBacaan.filter(z => z.santriId === santriId).forEach(z => items.push({ t: z.tanggal, html: `<b>Ziyadah Bacaan</b> — ${getSurah(z.sAwal).latin}:${z.aAwal} → ${getSurah(z.sAkhir).latin}:${z.aAkhir}` }));
    db.ziyadahHafalan.filter(z => z.santriId === santriId).forEach(z => {
      const h = computeHafalan(z.sAwal, z.aAwal, z.sAkhir, z.aAkhir);
      items.push({ t: z.tanggal, html: `<b>Ziyadah Hafalan</b> — ${getSurah(z.sAwal).latin}:${z.aAwal} → ${getSurah(z.sAkhir).latin}:${z.aAkhir} · <b>${formatHafalan(h)}</b> · Nilai ${z.nilai}<div class="muted">${UI.esc(z.catatan || '')}</div>` });
    });
    db.mutqin.filter(m => m.santriId === santriId).forEach(m => {
      const h = computeHafalan(m.sAwal, m.aAwal, m.sAkhir, m.aAkhir);
      items.push({ t: m.tanggal, html: `<b>Mutqin (Murajaah)</b> — ${getSurah(m.sAwal).latin}:${m.aAwal} → ${getSurah(m.sAkhir).latin}:${m.aAkhir} · <b>${formatHafalan(h)}</b> · Nilai ${m.nilai}<div class="muted">${UI.esc(m.catatan || '')}</div>` });
    });
    db.kehadiran.filter(k => k.santriId === santriId).forEach(k => items.push({ t: k.tanggal, html: `Kehadiran ${k.sesi || ''}: <span class="badge ${k.status === 'Hadir' ? 'green' : k.status === 'Izin' ? 'warn' : k.status === 'Sakit' ? 'blue' : 'danger'}">${k.status}</span>` }));
    db.catatan.filter(c => c.santriId === santriId).forEach(c => items.push({ t: c.tanggal, html: `<b>Catatan Ustadz:</b> ${UI.esc(c.isi)}` }));

    items.sort((a, b) => b.t.localeCompare(a.t));
    if (!items.length) return `<div class="empty">Belum ada riwayat untuk ${UI.esc(s.nama)}.</div>`;
    return `<div class="timeline">${items.map(i =>
      `<div class="item"><div class="t">${UI.fmtDate(i.t)}</div><div class="d">${i.html}</div></div>`).join('')}</div>`;
  }

  function renderPerHalaqahRiwayat(santriId, periode) {
    const db = Store.get();
    const s = Store.findSantri(santriId);
    if (!s) return `<div class="empty">Santri tidak ditemukan.</div>`;
    
    const santri = db.santri.filter(st => st.halaqah === s.halaqah);
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
      const kehadiran = db.kehadiran.filter(k => k.santriId === st.id);
      const tahsin = db.tahsin.filter(t => t.santriId === st.id);
      const ziyadahHafalan = db.ziyadahHafalan.filter(z => z.santriId === st.id);
      const ziyadahBacaan = db.ziyadahBacaan.filter(z => z.santriId === st.id);
      const mutqin = db.mutqin.filter(m => m.santriId === st.id);
      
      kehadiran.filter(filterFunc).forEach(k => {
        if (!periodeKehadiran[k.tanggal]) periodeKehadiran[k.tanggal] = {};
        periodeKehadiran[k.tanggal][st.id] = k;
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
              ${santri.map(st => `<th class="center">${st.nama}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${tanggalList.map(tanggal => {
              let cols = `<td class="center" style="font-weight:600;white-space:nowrap">${UI.fmtDate(new Date(tanggal))}</td>`;
              santri.forEach(st => {
                const k = periodeKehadiran[tanggal] ? periodeKehadiran[tanggal][st.id] : null;
                const s = periodeSetoran[tanggal] ? periodeSetoran[tanggal][st.id] : null;
                let status = k ? k.status : '-';
                let badge = k ? (k.status === 'Hadir' ? 'green' : k.status === 'Izin' ? 'warn' : k.status === 'Sakit' ? 'blue' : 'danger') : 'gray';
                let info = s ? (s.tipe || '') : '-';
                cols += `<td style="padding:4px 6px">
                  <span class="badge ${badge}" style="font-size:10px;padding:1px 5px">${status}</span>
                  ${info !== '-' ? `<div class="muted" style="font-size:10px;line-height:1.2">${info}</div>` : ''}
                </td>`;
              });
              return `<tr>${cols}</tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
    
    return table;
  }

  /* ---------- Laporan (shared, role-aware) ---------- */
  let _laporanFilters = {};

  const BULAN_ID = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  function bulanLabel(bulan) {
    if (!bulan) return '-';
    const parts = String(bulan).split('-');
    if (parts.length < 2) return bulan;
    return (BULAN_ID[Number(parts[1])] || parts[1]) + ' ' + parts[0];
  }

  function buildLaporanRows(filters) {
    const db = Store.get();
    const f = filters || {};
    let santri = db.santri.slice();
    if (f.halaqah) santri = santri.filter(s => s.halaqah === f.halaqah);
    if (f.level) santri = santri.filter(s => s.level === f.level);
    if (f.kelas) santri = santri.filter(s => s.kelas === f.kelas);
    if (f.status) santri = santri.filter(s => s.status === f.status);
    const bulan = f.bulan || Store.todayStr().slice(0, 7);
    return santri.map((s, i) => {
      const h = Store.totalHafalanSantri(s.id);
      const kehadiran = Store.kehadiranBulan(s.id, bulan);
      const hadirSubuh = kehadiran.filter(k => k.status === 'Hadir' && k.sesi === 'Subuh').length;
      const hadirMaghrib = kehadiran.filter(k => k.status === 'Hadir' && k.sesi === 'Maghrib').length;
      const hadirIsya = kehadiran.filter(k => k.status === 'Hadir' && k.sesi === 'Isya').length;
      const totalHadir = hadirSubuh + hadirMaghrib + hadirIsya;
      const totalK = kehadiran.length;
      const pct = totalK ? Math.round((totalHadir / totalK) * 100) : 0;
      return { no: i + 1, s, hafalan: h, nilai: Store.avgNilai(s.id), hadirSubuh, hadirMaghrib, hadirIsya, hadir: totalHadir, totalK, pct };
    });
  }

  function renderLaporan(filters) {
    _laporanFilters = filters || {};
    const rows = buildLaporanRows(_laporanFilters);
    const bulan = _laporanFilters.bulan || Store.todayStr().slice(0, 7);
    const body = rows.map(r => `<tr>
      <td class="center">${r.no}</td>
      <td><b>${UI.esc(r.s.nama)}</b></td>
      <td>${UI.esc(r.s.nis)}</td>
      <td>${UI.esc(r.s.halaqah)}</td>
      <td>${UI.esc(r.s.level)}</td>
      <td class="center">${UI.esc(r.s.jk || '-')}</td>
      <td class="center">${r.hafalan ? r.hafalan.pages + ' hlm' : '-'}</td>
      <td class="center">${r.hafalan ? (r.hafalan.juzRange === 1 ? 'Juz ' + r.hafalan.juzStart : r.hafalan.juzStart + '–' + r.hafalan.juzEnd) : '-'}</td>
      <td class="center">${r.nilai ? r.nilai : '-'}</td>
      <td class="center" style="font-size:12px">${r.hadirSubuh} ${r.hadirMaghrib} ${r.hadirIsya}</td>
      <td class="center">${r.hadir}/${r.totalK} (${r.pct}%)</td>
      <td><span class="badge ${r.s.status === 'Aktif' ? 'green' : 'gray'}">${UI.esc(r.s.status)}</span></td>
    </tr>`).join('');
    return `<div class="clay-card">
      <div class="section-title"> Laporan Santri — ${UI.esc(bulanLabel(bulan))}</div>
      <div class="table-wrap">
        <table class="clay-table" id="laporan-table">
          <thead><tr><th class="center">No</th><th>Santri</th><th>NIS</th><th>Halaqah</th><th>Level</th><th class="center">JK</th><th class="center">Total Hafalan</th><th class="center">Juz</th><th class="center">Rata² Nilai</th><th class="center">Per Sesi</th><th class="center">Kehadiran (${UI.esc(bulanLabel(bulan))})</th><th>Status</th></tr></thead>
          <tbody>${body || `<tr><td colspan="12"><div class="empty">Tidak ada data.</div></td></tr>`}</tbody>
        </table>
      </div>
      <div class="row mt">
        <button class="clay-btn secondary" id="export-excel">Export Excel</button>
        <button class="clay-btn" id="export-pdf"> Print / PDF</button>
      </div>
    </div>`;
  }

  function bindLaporanExport() {
    const ex = document.getElementById('export-excel');
    const pdf = document.getElementById('export-pdf');
    if (ex) ex.onclick = () => exportLaporanExcel(_laporanFilters);
    if (pdf) pdf.onclick = () => window.print();
  }

  function downloadExcel(filename, html) {
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

  /* Export laporan sebagai file Excel (.xls) — 1 baris per santri, siap jadi laporan bulanan */
  function exportLaporanExcel(filters) {
    const db = Store.get();
    const f = filters || {};
    const bulan = f.bulan || Store.todayStr().slice(0, 7);
    const rows = buildLaporanRows(f);
    if (!rows.length) { UI.toast('Tidak ada data untuk diekspor', 'error'); return; }
    const rowsHtml = rows.map(r => `<tr>
      <td class="center">${r.no}</td>
      <td>${UI.esc(r.s.nama)}</td>
      <td>${UI.esc(r.s.nis)}</td>
      <td>${UI.esc(r.s.halaqah)}</td>
      <td>${UI.esc(r.s.level)}</td>
      <td class="center">${UI.esc(r.s.jk || '-')}</td>
      <td class="center">${r.hafalan ? r.hafalan.pages : 0}</td>
      <td class="center">${r.hafalan ? (r.hafalan.juzRange === 1 ? r.hafalan.juzStart : r.hafalan.juzStart + '-' + r.hafalan.juzEnd) : '-'}</td>
      <td class="center">${r.nilai || 0}</td>
      <td class="center">${r.hadirSubuh}</td>
      <td class="center">${r.hadirMaghrib}</td>
      <td class="center">${r.hadirIsya}</td>
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
  <div class="title">LAPORAN BULANAN TAHFIDZ</div>
  <div class="sub">${UI.esc(db.settings.namaLembaga)}</div>
  <div class="sub">Periode: ${UI.esc(bulanLabel(bulan))}</div>
  <table>
    <thead><tr>
      <th class="center">No</th><th>Nama Santri</th><th>NIS</th><th>Halaqah</th><th>Level</th><th class="center">JK</th>
      <th class="center">Total Hafalan (hlm)</th><th class="center">Juz</th><th class="center">Rata² Nilai</th>
      <th class="center">Subuh</th><th class="center">Maghrib</th><th class="center">Isya</th>
      <th class="center">Total Hadir</th><th class="center">Total Kehadiran</th><th class="center">%</th><th>Status</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body></html>`;
    downloadExcel('Laporan_Tahfidz_' + bulan, html);
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

  /* ---------- Notifikasi (shared) ---------- */
  function renderNotifikasi(userId) {
    const list = Store.notifFor(userId);
    if (!list.length) return `<div class="empty">Belum ada notifikasi.</div>`;
    const icon = { wali: '', ustadz: '', admin: '' };
    return `<div class="clay-card">${list.map(n =>
      `<div class="row center" style="justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee">
        <div class="row center" style="gap:10px"><span style="font-size:20px">${icon[n.tipe] || ''}</span>
        <div><div>${UI.esc(n.pesan)}</div><div class="muted" style="font-size:12px">${UI.fmtDateTime(n.tanggal)}</div></div></div>
        ${n.read ? '' : '<span class="badge blue">Baru</span>'}
      </div>`).join('')}</div>`;
  }

  return { shell, setHeader, setActions, statCard, barChart, progressCircle, renderRiwayat, renderPerHalaqahRiwayat, renderLaporan, bindLaporanExport, exportLaporanExcel, downloadTemplateExcel, bulanLabel, renderNotifikasi };
})();
