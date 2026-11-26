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
  const FONT_SIZE_KEY = 'tahfidzku_quran_font_size_v1';
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch (e) { cache = {}; }

  let state = {
    surah: 1,
    mode: 'mushaf',
    trans: 'id',
    page: null,
    pages: [],
    loading: false,
    layout: 'web',
    fontSize: 32
  };
  try {
    const savedLayout = localStorage.getItem(LAYOUT_KEY);
    if (savedLayout === 'web' || savedLayout === 'full') state.layout = savedLayout;
    const savedSize = Number(localStorage.getItem(FONT_SIZE_KEY));
    if (savedSize && savedSize >= 20 && savedSize <= 50) state.fontSize = savedSize;
  } catch (e) {}

  function updateFontSize() {
    document.documentElement.style.setProperty('--q-font-size', state.fontSize + 'px');
    const val = document.getElementById('q-font-val');
    if (val) val.textContent = state.fontSize + 'px';
    const fullVal = document.getElementById('q-full-font-val');
    if (fullVal) fullVal.textContent = state.fontSize + 'px';
    try { localStorage.setItem(FONT_SIZE_KEY, state.fontSize); } catch (e) {}
  }

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
    updateFontSize();
    const options = SURAHS.map(s => `<option value="${s.n}" ${s.n === state.surah ? 'selected' : ''}>${s.n}. ${s.latin} (${s.arab})</option>`).join('');
    const pageOpts = state.pages.map(p => `<option value="${p}" ${p === state.page ? 'selected' : ''}>Halaman ${p}</option>`).join('');

    document.getElementById('view-content').innerHTML = `
      <div class="clay-card mb q-controls-card ${isFull ? 'hidden' : ''}">
        <!-- Baris 1: Navigasi Surat (Arrow Kiri + Dropdown Surat + Arrow Kanan) -->
        <div class="q-nav-bar">
          <button class="clay-btn ghost sm q-nav-btn" id="q-prev" title="Surat Sebelumnya" ${state.surah <= 1 ? 'disabled' : ''}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            <span class="q-btn-text">Surat Sblm</span>
          </button>
          <div style="flex:1;min-width:0">
            <select class="clay-select" id="q-surah" style="width:100%;font-weight:600;text-align:center">${options}</select>
          </div>
          <button class="clay-btn ghost sm q-nav-btn" id="q-next" title="Surat Berikutnya" ${state.surah >= 114 ? 'disabled' : ''}>
            <span class="q-btn-text">Surat Brkt</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>

        <!-- Baris 2: Navigasi Halaman Mushaf (Hanya aktif saat Mode Mushaf) -->
        <div class="q-page-bar ${state.mode === 'terjemah' ? 'hidden' : ''}" id="q-page-wrap">
          <button class="clay-btn ghost sm q-nav-btn" id="q-page-prev" title="Halaman Sebelumnya" ${!canGoPrevPage() ? 'disabled' : ''}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            <span>Hal Sblm</span>
          </button>
          <div style="flex:1;min-width:0;text-align:center">
            <select class="clay-select sm" id="q-page" style="width:100%;max-width:180px;margin:0 auto;font-weight:600">${pageOpts}</select>
          </div>
          <button class="clay-btn ghost sm q-nav-btn" id="q-page-next" title="Halaman Berikutnya" ${!canGoNextPage() ? 'disabled' : ''}>
            <span>Hal Brkt</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>

        <!-- Baris 3: Toolbar Pengaturan (Mode, Bahasa, Custom Font Size, Fullscreen) -->
        <div class="q-toolbar-row">
          <!-- Mode Toggle -->
          <div class="q-segmented">
            <button class="q-seg-btn ${state.mode === 'mushaf' ? 'active' : ''}" id="q-btn-mushaf" type="button">Mushaf</button>
            <button class="q-seg-btn ${state.mode === 'terjemah' ? 'active' : ''}" id="q-btn-terjemah" type="button">+ Terjemah</button>
          </div>

          <!-- Bahasa Terjemah (muncul jika mode terjemah) -->
          <div id="q-trans-wrap" class="${state.mode === 'mushaf' ? 'hidden' : ''}">
            <select class="clay-select sm" id="q-trans" style="font-size:12px;padding:4px 8px;font-weight:600">
              <option value="id" ${state.trans === 'id' ? 'selected' : ''}>Indonesia</option>
              <option value="en" ${state.trans === 'en' ? 'selected' : ''}>English</option>
            </select>
          </div>

          <!-- Custom Font Size Stepper (A- 32px A+) -->
          <div class="q-font-stepper" title="Sesuaikan ukuran huruf Al-Qur'an">
            <button class="q-stepper-btn" id="q-font-dec" type="button" aria-label="Perkecil huruf">A−</button>
            <span class="q-font-val" id="q-font-val">${state.fontSize}px</span>
            <button class="q-stepper-btn" id="q-font-inc" type="button" aria-label="Perbesar huruf">A+</button>
          </div>

          <!-- Tombol Fullscreen -->
          <div style="margin-left:auto">
            <button class="clay-btn ghost sm q-fullscreen-btn" id="q-btn-fullscreen" type="button" title="Mode Halaman Penuh">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
              <span>Penuh</span>
            </button>
          </div>
        </div>
      </div>

      ${isFull ? `<div class="q-full-toolbar">
        <button class="clay-btn ghost sm" id="q-full-web">✕ Tutup Penuh</button>
        <button class="clay-btn ghost sm" id="q-full-prev" ${canGoPrevPage() ? '' : 'disabled'}>← Hal</button>
        <div class="q-full-title"><b id="q-full-info">${UI.esc(meta.latin)} · ${meta.arab}</b><span id="q-full-page-info">Halaman ${state.page || '-'}</span></div>
        <div class="q-font-stepper sm" title="Sesuaikan ukuran huruf">
          <button class="q-stepper-btn" id="q-full-font-dec" type="button">A−</button>
          <span class="q-font-val" id="q-full-font-val">${state.fontSize}px</span>
          <button class="q-stepper-btn" id="q-full-font-inc" type="button">A+</button>
        </div>
        <button class="clay-btn primary sm" id="q-full-next" ${canGoNextPage() ? '' : 'disabled'}>Hal →</button>
      </div>` : ''}
      <div id="q-content"><div class="empty">Memuat...</div></div>`;

    document.getElementById('q-surah').onchange = (e) => { state.surah = Number(e.target.value); syncSurah(); loadAndRender(); };
    document.getElementById('q-prev').onclick = () => { if (state.surah > 1) { state.surah--; syncSurah(); loadAndRender(); } };
    document.getElementById('q-next').onclick = () => { if (state.surah < 114) { state.surah++; syncSurah(); loadAndRender(); } };

    const pagePrev = document.getElementById('q-page-prev');
    if (pagePrev) pagePrev.onclick = () => { if (state.pages.length) prevMushafPage(); };
    const pageNext = document.getElementById('q-page-next');
    if (pageNext) pageNext.onclick = () => { if (state.pages.length) nextMushafPage(); };
    const pageSel = document.getElementById('q-page');
    if (pageSel) pageSel.onchange = (e) => { state.page = Number(e.target.value); syncPage(); renderAyahs(); };

    const btnMushaf = document.getElementById('q-btn-mushaf');
    if (btnMushaf) btnMushaf.onclick = () => {
      if (state.mode === 'mushaf') return;
      state.mode = 'mushaf';
      if (!state.page || !state.pages.includes(state.page)) state.page = state.pages[0];
      render();
      renderAyahs();
    };

    const btnTerjemah = document.getElementById('q-btn-terjemah');
    if (btnTerjemah) btnTerjemah.onclick = () => {
      if (state.mode === 'terjemah') return;
      state.mode = 'terjemah';
      render();
      renderAyahs();
    };

    const transSel = document.getElementById('q-trans');
    if (transSel) transSel.onchange = (e) => { state.trans = e.target.value; renderAyahs(); };

    document.getElementById('q-font-dec').onclick = () => {
      state.fontSize = Math.max(20, state.fontSize - 2);
      updateFontSize();
    };
    document.getElementById('q-font-inc').onclick = () => {
      state.fontSize = Math.min(48, state.fontSize + 2);
      updateFontSize();
    };

    const btnFull = document.getElementById('q-btn-fullscreen');
    if (btnFull) btnFull.onclick = () => {
      state.layout = 'full';
      state.mode = 'mushaf';
      try { localStorage.setItem(LAYOUT_KEY, state.layout); } catch (err) {}
      render();
      renderAyahs();
    };

    const fullWeb = document.getElementById('q-full-web');
    if (fullWeb) fullWeb.onclick = () => {
      state.layout = 'web';
      try { localStorage.setItem(LAYOUT_KEY, state.layout); } catch (err) {}
      render();
      renderAyahs();
    };
    const fullPrev = document.getElementById('q-full-prev');
    if (fullPrev) fullPrev.onclick = () => { prevMushafPage(); };
    const fullNext = document.getElementById('q-full-next');
    if (fullNext) fullNext.onclick = () => { nextMushafPage(); };
    const fullDec = document.getElementById('q-full-font-dec');
    if (fullDec) fullDec.onclick = () => { state.fontSize = Math.max(20, state.fontSize - 2); updateFontSize(); };
    const fullInc = document.getElementById('q-full-font-inc');
    if (fullInc) fullInc.onclick = () => { state.fontSize = Math.min(48, state.fontSize + 2); updateFontSize(); };
  }

  function syncSurah() {
    const sel = document.getElementById('q-surah');
    if (sel) sel.value = state.surah;
    const prevBtn = document.getElementById('q-prev');
    if (prevBtn) prevBtn.disabled = state.surah <= 1;
    const nextBtn = document.getElementById('q-next');
    if (nextBtn) nextBtn.disabled = state.surah >= 114;
    const meta = getSurahMeta(state.surah);
    const fullInfo = document.getElementById('q-full-info');
    if (fullInfo) fullInfo.textContent = `${meta.latin} · ${meta.arab}`;
  }

  function syncPage() {
    const sel = document.getElementById('q-page');
    if (sel) sel.value = state.page;
    const prevBtn = document.getElementById('q-page-prev');
    if (prevBtn) prevBtn.disabled = !canGoPrevPage();
    const nextBtn = document.getElementById('q-page-next');
    if (nextBtn) nextBtn.disabled = !canGoNextPage();
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
      content.innerHTML = `<div class="empty">${UI.esc(e.message)}<br><button class="clay-btn primary mt" onclick="Quran.retry()">Coba Lagi</button></div>`;
    }
  }

  const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  function toArabicDigits(num) {
    return String(num).replace(/[0-9]/g, d => ARABIC_DIGITS[d]);
  }

  function renderAyahOrnament(num) {
    const arNum = toArabicDigits(num);
    return `<span class="q-ayah-ornament" title="Ayat ${num}" aria-label="Ayat ${num}">
      <svg class="q-ayah-ornament-svg" viewBox="0 0 38 38" aria-hidden="true">
        <circle cx="19" cy="19" r="16.5" fill="#fffdfa" stroke="#b69a4d" stroke-width="1.3"/>
        <circle cx="19" cy="19" r="14" fill="none" stroke="#d4c593" stroke-width="0.75" stroke-dasharray="1.2 1.2"/>
        <path d="M19 1 L20.2 3.4 L19 4.6 L17.8 3.4 Z M19 33.4 L20.2 34.6 L19 37 L17.8 34.6 Z M1 19 L3.4 17.8 L4.6 19 L3.4 20.2 Z M33.4 19 L34.6 17.8 L37 19 L34.6 20.2 Z" fill="#b69a4d"/>
        <circle cx="6.5" cy="6.5" r="1.1" fill="#b69a4d"/>
        <circle cx="31.5" cy="6.5" r="1.1" fill="#b69a4d"/>
        <circle cx="6.5" cy="31.5" r="1.1" fill="#b69a4d"/>
        <circle cx="31.5" cy="31.5" r="1.1" fill="#b69a4d"/>
      </svg>
      <span class="q-ayah-ornament-num">${arNum}</span>
    </span>`;
  }

  function renderAyahs(ayahs) {
    const content = document.getElementById('q-content');
    if (!content) return;
    if (!ayahs) ayahs = cache[state.surah] || [];
    const showTrans = state.mode === 'terjemah';
    const list = state.mode === 'mushaf' ? ayahs.filter(a => a.page === state.page) : ayahs;
    // Halaman penuh mengikuti aliran mushaf: ayat tidak dibuat sebagai
    // kartu/baris terpisah, tetapi menyambung dengan tanda nomor ayat berhias.
    const fullFlow = state.layout === 'full' && state.mode === 'mushaf';
    const html = fullFlow
      ? `<div class="q-full-flow" dir="rtl">${list.map(a => `<span class="q-full-ayah-text">${UI.esc(a.ar)}</span> ${renderAyahOrnament(a.n)}`).join('')}</div>`
      : list.map(a => `
      <div class="q-ayah ${state.mode === 'mushaf' ? 'mushaf' : ''}">
        <div class="q-body">
          <div class="q-arab" dir="rtl">${UI.esc(a.ar)} ${renderAyahOrnament(a.n)}</div>
          ${showTrans ? `<div class="q-trans"><span class="q-trans-num">${a.n}.</span> ${UI.esc(state.trans === 'id' ? a.id : a.en)}</div>` : ''}
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
        <div dir="rtl" style="font-family:Amiri,serif;font-size:24px;line-height:2.2;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.06)">${UI.esc(a.ar)} ${renderAyahOrnament(a.n)}</div>`).join('')}${suffix}`;
    } catch (e) {
      target.innerHTML = `<span class="muted">Bacaan belum dapat dimuat: ${UI.esc(e.message)}</span>`;
    }
  }

  function open() {
    if (state.layout === 'full') state.mode = 'mushaf';
    const session = Store.getSession();
    if (session) {
      let nav = [];
      if (session.role === 'admin' || session.role === 'pengawas') nav = Admin.nav('quran');
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
              <button class="menu-toggle" id="menu-toggle" type="button" aria-label="Buka menu navigasi" aria-controls="sidebar" aria-expanded="false"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
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
