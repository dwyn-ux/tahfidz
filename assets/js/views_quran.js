/* ============================================================
   Tahfidzku — Al-Qur'an Reader (Mushaf + Terjemah)
   Mode: Mushaf (Arabic Uthmani) + Terjemah Indonesia / English
   Data dari api.alquran.cloud (cache di memory + localStorage)
   ============================================================ */
const Quran = (() => {

  const API = 'https://api.alquran.cloud/v1/surah';
  const EDITION = 'quran-uthmani,id.indonesian,en.sahih';
  const CACHE_KEY = 'tahfidzku_quran_cache_v3';
  const LAYOUT_KEY = 'tahfidzku_quran_layout_v1';
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch (e) { cache = {}; }

  let state = { surah: 1, mode: 'mushaf', trans: 'id', page: null, pages: [], loading: false, layout: 'web' };
  try {
    const savedLayout = localStorage.getItem(LAYOUT_KEY);
    if (savedLayout === 'web' || savedLayout === 'full') state.layout = savedLayout;
  } catch (e) {}

  function getSurahMeta(n) { return SURAHS.find(s => s.n === Number(n)); }

  function canGoNextPage() {
    return state.page < state.pages[state.pages.length - 1] || state.surah < 114;
  }

  function canGoPrevPage() {
    return state.page > state.pages[0] || state.surah > 1;
  }

  function nextMushafPage() {
    if (state.page < state.pages[state.pages.length - 1]) {
      state.page++;
      syncPage();
      renderAyahs();
      return;
    }
    if (state.surah < 114) {
      state.surah++;
      state.page = null;
      loadAndRender();
    }
  }

  function prevMushafPage() {
    if (state.page > state.pages[0]) {
      state.page--;
      syncPage();
      renderAyahs();
      return;
    }
    if (state.surah > 1) {
      state.surah--;
      state.page = null;
      loadAndRender(true);
    }
  }

  function saveCacheSafe(n, out) {
    cache[n] = out;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      // Jika kuota localStorage browser penuh, bersihkan cache lama dan simpan surat ini saja
      try {
        const miniCache = {};
        miniCache[n] = out;
        localStorage.setItem(CACHE_KEY, JSON.stringify(miniCache));
      } catch (_) {}
    }
  }

  async function fetchSurah(n) {
    if (cache[n] && Array.isArray(cache[n]) && cache[n].length > 0) return cache[n];

    // Sumber 1: api.quran.gading.dev (Sangat cepat, lengkap dengan nomor halaman Mushaf Madani standar)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(`https://api.quran.gading.dev/surah/${n}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const json = await res.json();
        if (json.code === 200 && json.data && Array.isArray(json.data.verses)) {
          const sMeta = getSurahMeta(n);
          const out = json.data.verses.map(v => ({
            n: v.number.inSurah,
            page: v.meta ? v.meta.page : (sMeta ? sMeta.page : 1),
            ar: v.text.arab,
            id: v.translation ? v.translation.id : '',
            en: v.translation ? v.translation.en : ''
          }));
          saveCacheSafe(n, out);
          return out;
        }
      }
    } catch (e) {
      console.warn('Sumber 1 (Gading Quran API) gagal, mencoba sumber cadangan...', e);
    }

    // Sumber 2: equran.id (CDN lokal Indonesia Kemenag, sangat cepat dan stabil)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(`https://equran.id/api/v2/surat/${n}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const json = await res.json();
        if (json.code === 200 && json.data && Array.isArray(json.data.ayat)) {
          const sMeta = getSurahMeta(n);
          const startPage = sMeta ? sMeta.page : 1;
          const nextMeta = getSurahMeta(n + 1);
          const endPage = nextMeta ? (nextMeta.page > startPage ? nextMeta.page - 1 : startPage) : 604;
          const totalAyat = json.data.jumlahAyat || json.data.ayat.length;
          const spanPages = Math.max(1, endPage - startPage + 1);

          const out = json.data.ayat.map((a, i) => {
            const pageOffset = Math.min(spanPages - 1, Math.floor((i / totalAyat) * spanPages));
            return {
              n: a.nomorAyat,
              page: startPage + pageOffset,
              ar: a.teksArab,
              id: a.teksIndonesia || '',
              en: a.teksLatin || ''
            };
          });
          saveCacheSafe(n, out);
          return out;
        }
      }
    } catch (e) {
      console.warn('Sumber 2 (EQuran API) gagal, mencoba sumber ketiga...', e);
    }

    // Sumber 3: api.alquran.cloud (Cadangan global)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${API}/${n}/editions/${EDITION}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const json = await res.json();
        if (json.code === 200 && json.data) {
          const ar = json.data[0].ayahs;
          const id = json.data[1].ayahs;
          const en = json.data[2].ayahs;
          const out = ar.map((a, i) => ({
            n: a.numberInSurah,
            page: a.page,
            ar: a.text,
            id: id[i] ? id[i].text : '',
            en: en[i] ? en[i].text : ''
          }));
          saveCacheSafe(n, out);
          return out;
        }
      }
    } catch (e) {
      console.warn('Sumber 3 (Alquran Cloud) gagal...', e);
    }

    throw new Error('Gagal memuat surat. Silakan periksa koneksi internet Anda lalu coba lagi.');
  }

  function render() {
    const meta = getSurahMeta(state.surah);
    const isFull = state.layout === 'full';
    document.body.classList.toggle('q-reading-fullscreen', isFull);
    const options = SURAHS.map(s => `<option value="${s.n}" ${s.n === state.surah ? 'selected' : ''}>${s.n}. ${s.latin} (${s.arab})</option>`).join('');
    const pageOpts = state.pages.map(p => `<option value="${p}" ${p === state.page ? 'selected' : ''}>Halaman ${p}</option>`).join('');
    const lastPage = state.pages.length ? state.pages[state.pages.length - 1] : '-';
    document.getElementById('view-content').innerHTML = `
      <div class="clay-card mb q-controls-card ${isFull ? 'hidden' : ''}">
        <div class="row" style="align-items:flex-end">
          <div style="flex:2">${UI.field('Surat', `<select class="clay-select" id="q-surah">${options}</select>`)}</div>
          <div style="flex:1">${UI.field('Tampilan', `<select class="clay-select" id="q-layout">
            <option value="web" ${state.layout === 'web' ? 'selected' : ''}>Mode Web</option>
            <option value="full" ${state.layout === 'full' ? 'selected' : ''}>Halaman Penuh</option>
          </select>`)}</div>
          <div style="flex:1">${UI.field('Mode', `<select class="clay-select" id="q-mode">
            <option value="mushaf" ${state.mode === 'mushaf' ? 'selected' : ''}> Mushaf</option>
            <option value="terjemah" ${state.mode === 'terjemah' ? 'selected' : ''}>🌐 + Terjemah</option>
          </select>`)}</div>
          <div style="flex:1" id="q-trans-wrap" class="${state.mode === 'mushaf' ? 'hidden' : ''}">${UI.field('Bahasa', `<select class="clay-select" id="q-trans">
            <option value="id" ${state.trans === 'id' ? 'selected' : ''}>🇮🇩 Indonesia</option>
            <option value="en" ${state.trans === 'en' ? 'selected' : ''}>🇬🇧 English</option>
          </select>`)}</div>
        </div>
        <div class="row mt ${state.mode === 'terjemah' ? 'hidden' : ''}" id="q-page-wrap" style="justify-content:space-between;align-items:center">
          <button class="clay-btn ghost" id="q-page-prev">← Halaman Sebelumnya</button>
          <div style="flex:1;text-align:center">
            <div class="muted" id="q-page-info">Halaman ${state.page || '-'} / ${lastPage}</div>
            <select class="clay-select" id="q-page" style="max-width:170px;margin:6px auto 0;display:block">${pageOpts}</select>
          </div>
          <button class="clay-btn ghost" id="q-page-next">Halaman Berikutnya →</button>
        </div>
        <div class="row mt" style="justify-content:space-between;align-items:center">
          <button class="clay-btn ghost" id="q-prev">← Surat Sebelumnya</button>
          <div class="muted" id="q-info" style="text-align:center;flex:1">${UI.esc(meta.latin)} · ${meta.arab}</div>
          <button class="clay-btn ghost" id="q-next">Surat Berikutnya →</button>
        </div>
      </div>
      ${isFull ? `<div class="q-full-toolbar">
        <button class="clay-btn ghost sm" id="q-full-web">☰ Mode Web</button>
        <button class="clay-btn ghost sm" id="q-full-prev" ${canGoPrevPage() ? '' : 'disabled'}>←</button>
        <div class="q-full-title"><b id="q-full-info">${UI.esc(meta.latin)} · ${meta.arab}</b><span id="q-full-page-info">Halaman ${state.page || '-'}</span></div>
        <button class="clay-btn primary sm" id="q-full-next" ${canGoNextPage() ? '' : 'disabled'}>→</button>
      </div>` : ''}
      <div id="q-content"><div class="empty">Memuat...</div></div>`;

    document.getElementById('q-surah').onchange = (e) => { state.surah = Number(e.target.value); loadAndRender(); };
    document.getElementById('q-mode').onchange = (e) => {
      state.mode = e.target.value;
      document.getElementById('q-trans-wrap').classList.toggle('hidden', state.mode === 'mushaf');
      document.getElementById('q-page-wrap').classList.toggle('hidden', state.mode === 'terjemah');
      if (state.mode === 'mushaf' && (!state.page || !state.pages.includes(state.page))) state.page = state.pages[0];
      renderAyahs();
    };
    document.getElementById('q-layout').onchange = (e) => {
      state.layout = e.target.value;
      if (state.layout === 'full') state.mode = 'mushaf';
      try { localStorage.setItem(LAYOUT_KEY, state.layout); } catch (err) {}
      render();
      renderAyahs();
    };
    const transSel = document.getElementById('q-trans');
    if (transSel) transSel.onchange = (e) => { state.trans = e.target.value; renderAyahs(); };
    const pageSel = document.getElementById('q-page');
    if (pageSel) pageSel.onchange = (e) => { state.page = Number(e.target.value); renderAyahs(); };
    document.getElementById('q-page-prev').onclick = () => { if (state.pages.length) prevMushafPage(); };
    document.getElementById('q-page-next').onclick = () => { if (state.pages.length) nextMushafPage(); };
    document.getElementById('q-prev').onclick = () => { if (state.surah > 1) { state.surah--; syncSurah(); loadAndRender(); } };
    document.getElementById('q-next').onclick = () => { if (state.surah < 114) { state.surah++; syncSurah(); loadAndRender(); } };
    const fullWeb = document.getElementById('q-full-web');
    if (fullWeb) fullWeb.onclick = () => {
      state.layout = 'web';
      try { localStorage.setItem(LAYOUT_KEY, state.layout); } catch (err) {}
      render();
      renderAyahs();
    };
    const fullPrev = document.getElementById('q-full-prev');
    if (fullPrev) fullPrev.onclick = () => {
      prevMushafPage();
    };
    const fullNext = document.getElementById('q-full-next');
    if (fullNext) fullNext.onclick = () => {
      nextMushafPage();
    };
  }

  function syncSurah() {
    const sel = document.getElementById('q-surah');
    if (sel) sel.value = state.surah;
    const meta = getSurahMeta(state.surah);
    const info = document.getElementById('q-info');
    if (info) info.textContent = `${meta.latin} · ${meta.arab}`;
    const fullInfo = document.getElementById('q-full-info');
    if (fullInfo) fullInfo.textContent = `${meta.latin} · ${meta.arab}`;
  }

  function syncPage() {
    const sel = document.getElementById('q-page');
    if (sel) sel.value = state.page;
    const info = document.getElementById('q-page-info');
    if (info) info.textContent = `Halaman ${state.page} / ${state.pages.length ? state.pages[state.pages.length - 1] : '-'}`;
    const fullInfo = document.getElementById('q-full-page-info');
    if (fullInfo) fullInfo.textContent = `Halaman ${state.page}`;
  }

  async function loadAndRender(preferLastPage = false) {
    const content = document.getElementById('q-content');
    if (!content) return;
    content.innerHTML = '<div class="empty">Memuat...</div>';
    try {
      const ayahs = await fetchSurah(state.surah);
      state.pages = [...new Set(ayahs.map(a => a.page))].sort((a, b) => a - b);
      if (!state.page || !state.pages.includes(state.page)) {
        state.page = preferLastPage ? state.pages[state.pages.length - 1] : state.pages[0];
      }
      render();
      renderAyahs(ayahs);
    } catch (e) {
      content.innerHTML = `<div class="empty">⚠️ ${UI.esc(e.message)}<br><button class="clay-btn primary mt" onclick="Quran.retry()">Coba Lagi</button></div>`;
    }
  }

  function renderAyahs(ayahs) {
    const content = document.getElementById('q-content');
    if (!content) return;
    if (!ayahs) ayahs = cache[state.surah] || [];
    const showTrans = state.mode === 'terjemah';
    const list = state.mode === 'mushaf' ? ayahs.filter(a => a.page === state.page) : ayahs;
    // Halaman penuh mengikuti aliran mushaf: ayat tidak dibuat sebagai
    // kartu/baris terpisah, tetapi menyambung dengan tanda nomor ayat.
    const fullFlow = state.layout === 'full' && state.mode === 'mushaf';
    const html = fullFlow
      ? `<div class="q-full-flow" dir="rtl">${list.map(a => `<span class="q-full-ayah-text">${UI.esc(a.ar)}</span><span class="q-full-ayah-marker" aria-label="Ayat ${a.n}">${a.n}</span>`).join('')}</div>`
      : list.map(a => `
      <div class="q-ayah ${state.mode === 'mushaf' ? 'mushaf' : ''}">
        <div class="q-num">${a.n}</div>
        <div class="q-body">
          <div class="q-arab" dir="rtl">${UI.esc(a.ar)}</div>
          ${showTrans ? `<div class="q-trans">${UI.esc(state.trans === 'id' ? a.id : a.en)}</div>` : ''}
        </div>
      </div>`).join('');
    const pageBadge = state.mode === 'mushaf' ? `<div class="q-page-badge"> Halaman Mushaf ${state.page}</div>` : '';
    const hasNextPage = state.mode === 'mushaf' && canGoNextPage();
    const bottomPager = state.mode === 'mushaf' ? `
      <div class="clay-card mt" style="display:flex;justify-content:flex-end">
        <button class="clay-btn primary" id="q-page-next-bottom" ${hasNextPage ? '' : 'disabled'}>Halaman Berikutnya →</button>
      </div>` : '';
    content.innerHTML = `<div class="clay-card q-reader ${state.layout === 'full' ? 'q-full-page' : ''}">${pageBadge}${html}</div>${bottomPager}`;
    const nextBottom = document.getElementById('q-page-next-bottom');
    if (nextBottom) nextBottom.onclick = () => {
      if (!hasNextPage) return;
      nextMushafPage();
      document.getElementById('q-content').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }

  // Dipakai pada form setoran agar ustadz dapat menyimak teks ayat yang
  // dibaca tanpa meninggalkan proses input.
  async function previewRange(target, sAwal, aAwal, sAkhir, aAkhir) {
    if (!target) return;
    const startSurah = Number(sAwal), endSurah = Number(sAkhir);
    const startAyah = Number(aAwal), endAyah = Number(aAkhir);
    if (!getSurahMeta(startSurah) || !getSurahMeta(endSurah) || !startAyah || !endAyah || startSurah > endSurah || (startSurah === endSurah && startAyah > endAyah)) {
      target.innerHTML = '<span class="muted">Pilih rentang ayat yang valid untuk menampilkan bacaan.</span>';
      return;
    }
    target.innerHTML = '<span class="muted">Memuat bacaan Al-Qur’an…</span>';
    try {
      const selected = [];
      for (let surah = startSurah; surah <= endSurah; surah++) {
        const ayahs = await fetchSurah(surah);
        const first = surah === startSurah ? startAyah : 1;
        const last = surah === endSurah ? endAyah : ayahs.length;
        selected.push(...ayahs.filter(a => a.n >= first && a.n <= last));
        if (selected.length > 100) break;
      }
      if (!selected.length) throw new Error('Ayat tidak ditemukan');
      const capped = selected.slice(0, 100);
      const suffix = selected.length > capped.length ? '<div class="muted" style="margin-top:8px">Tampilan dibatasi 100 ayat.</div>' : '';
      target.innerHTML = `<div style="font-size:12px;font-weight:600;margin-bottom:8px">Bacaan untuk disimak</div>${capped.map(a => `
        <div dir="rtl" style="font-family:Amiri,serif;font-size:24px;line-height:1.9;padding:6px 0;border-bottom:1px solid rgba(0,0,0,.06)">${UI.esc(a.ar)} <span class="muted" dir="ltr" style="font-family:Inter,sans-serif;font-size:11px">(${a.n})</span></div>`).join('')}${suffix}`;
    } catch (e) {
      target.innerHTML = `<span class="muted">Bacaan belum dapat dimuat: ${UI.esc(e.message)}</span>`;
    }
  }

  function open() {
    if (state.layout === 'full') state.mode = 'mushaf';
    const session = Store.getSession();
    if (session) {
      let nav = [];
      if (session.role === 'admin') nav = Admin.nav('quran');
      else if (session.role === 'ustadz') nav = Ustadz.nav('quran');
      else if (session.role === 'wali') nav = Wali.nav('quran');
      Shared.shell(session.role, nav, '');
      Shared.setHeader('Al-Qur\'an', 'Baca mushaf & terjemah');
    } else {
      renderPublicShell();
    }
    render();
    loadAndRender();
  }

  function renderPublicShell() {
    const nav = `<button class="nav-item active" data-view="quran"><span class="ico"></span> Al-Qur'an</button>`;
    document.getElementById('app').innerHTML = `
      <div class="app-shell">
        <div class="scrim" id="scrim"></div>
        <aside class="sidebar" id="sidebar">
          <div class="brand"><span class="logo"></span> Tahfidzku</div>
          ${nav}
          <div class="spacer"></div>
          <div class="user-box">
            <b>Pengunjung</b>
            <span class="muted">TAMU</span>
            <button class="clay-btn ghost sm" id="btn-back-login" style="width:100%;margin-top:10px;justify-content:center">← Ke Halaman Login</button>
          </div>
        </aside>
        <main class="main">
          <div class="topbar">
            <div>
              <button class="menu-toggle" id="menu-toggle" type="button" aria-label="Buka menu navigasi" aria-controls="sidebar" aria-expanded="false">☰</button>
              <h1 id="page-title">Al-Qur'an</h1>
              <div class="sub" id="page-sub">Baca mushaf & terjemah</div>
            </div>
            <div class="actions" id="topbar-actions"></div>
          </div>
          <div id="view-content"></div>
        </main>
      </div>`;
    const sidebar = document.getElementById('sidebar');
    const scrim = document.getElementById('scrim');
    const menuToggle = document.getElementById('menu-toggle');
    const closeMenu = () => {
      sidebar.classList.remove('open');
      scrim.classList.remove('show');
      document.body.classList.remove('nav-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    };
    menuToggle.onclick = () => {
      const isOpen = sidebar.classList.toggle('open');
      scrim.classList.toggle('show', isOpen);
      document.body.classList.toggle('nav-open', isOpen);
      menuToggle.setAttribute('aria-expanded', String(isOpen));
    };
    scrim.onclick = closeMenu;
    document.onkeydown = (e) => { if (e.key === 'Escape') closeMenu(); };
    window.onresize = () => { if (window.innerWidth > 860) closeMenu(); };
    document.getElementById('btn-back-login').onclick = () => { Auth.renderLogin(); };
  }

  function retry() { loadAndRender(); }

  function openWithSurah(surahNum) {
    state.surah = surahNum;
    open();
  }

  return { open, retry, openWithSurah, previewRange };
})();
