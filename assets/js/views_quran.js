/* ============================================================
   Tahfidzku — Al-Qur'an Reader (Mushaf + Terjemah)
   Mode: Mushaf (Arabic Uthmani) + Terjemah Indonesia / English
   Data dari api.alquran.cloud (cache di memory + localStorage)
   ============================================================ */
const Quran = (() => {

  const API = 'https://api.alquran.cloud/v1/surah';
  const EDITION = 'quran-uthmani,id.indonesian,en.sahih';
  const CACHE_KEY = 'tahfidzku_quran_cache_v2';
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch (e) { cache = {}; }

  let state = { surah: 1, mode: 'mushaf', trans: 'id', page: null, pages: [], loading: false };

  function getSurahMeta(n) { return SURAHS.find(s => s.n === Number(n)); }

  async function fetchSurah(n) {
    if (cache[n]) return cache[n];
    const res = await fetch(`${API}/${n}/editions/${EDITION}`);
    if (!res.ok) throw new Error('Gagal memuat surat');
    const json = await res.json();
    if (json.code !== 200) throw new Error('Data tidak tersedia');
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
    cache[n] = out;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
    return out;
  }

  function render() {
    const meta = getSurahMeta(state.surah);
    const options = SURAHS.map(s => `<option value="${s.n}" ${s.n === state.surah ? 'selected' : ''}>${s.n}. ${s.latin} (${s.arab})</option>`).join('');
    const pageOpts = state.pages.map(p => `<option value="${p}" ${p === state.page ? 'selected' : ''}>Halaman ${p}</option>`).join('');
    const lastPage = state.pages.length ? state.pages[state.pages.length - 1] : '-';
    document.getElementById('view-content').innerHTML = `
      <div class="clay-card mb">
        <div class="row" style="align-items:flex-end">
          <div style="flex:2">${UI.field('Surat', `<select class="clay-select" id="q-surah">${options}</select>`)}</div>
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
      <div id="q-content"><div class="empty">Memuat...</div></div>`;

    document.getElementById('q-surah').onchange = (e) => { state.surah = Number(e.target.value); loadAndRender(); };
    document.getElementById('q-mode').onchange = (e) => {
      state.mode = e.target.value;
      document.getElementById('q-trans-wrap').classList.toggle('hidden', state.mode === 'mushaf');
      document.getElementById('q-page-wrap').classList.toggle('hidden', state.mode === 'terjemah');
      if (state.mode === 'mushaf' && (!state.page || !state.pages.includes(state.page))) state.page = state.pages[0];
      renderAyahs();
    };
    const transSel = document.getElementById('q-trans');
    if (transSel) transSel.onchange = (e) => { state.trans = e.target.value; renderAyahs(); };
    const pageSel = document.getElementById('q-page');
    if (pageSel) pageSel.onchange = (e) => { state.page = Number(e.target.value); renderAyahs(); };
    document.getElementById('q-page-prev').onclick = () => { if (state.pages.length && state.page > state.pages[0]) { state.page--; syncPage(); renderAyahs(); } };
    document.getElementById('q-page-next').onclick = () => { if (state.pages.length && state.page < state.pages[state.pages.length - 1]) { state.page++; syncPage(); renderAyahs(); } };
    document.getElementById('q-prev').onclick = () => { if (state.surah > 1) { state.surah--; syncSurah(); loadAndRender(); } };
    document.getElementById('q-next').onclick = () => { if (state.surah < 114) { state.surah++; syncSurah(); loadAndRender(); } };
  }

  function syncSurah() {
    const sel = document.getElementById('q-surah');
    if (sel) sel.value = state.surah;
    const meta = getSurahMeta(state.surah);
    const info = document.getElementById('q-info');
    if (info) info.textContent = `${meta.latin} · ${meta.arab}`;
  }

  function syncPage() {
    const sel = document.getElementById('q-page');
    if (sel) sel.value = state.page;
    const info = document.getElementById('q-page-info');
    if (info) info.textContent = `Halaman ${state.page} / ${state.pages.length ? state.pages[state.pages.length - 1] : '-'}`;
  }

  async function loadAndRender() {
    const content = document.getElementById('q-content');
    if (!content) return;
    content.innerHTML = '<div class="empty">Memuat...</div>';
    try {
      const ayahs = await fetchSurah(state.surah);
      state.pages = [...new Set(ayahs.map(a => a.page))].sort((a, b) => a - b);
      if (!state.page || !state.pages.includes(state.page)) state.page = state.pages[0];
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
    const html = list.map(a => `
      <div class="q-ayah ${state.mode === 'mushaf' ? 'mushaf' : ''}">
        <div class="q-num">${a.n}</div>
        <div class="q-body">
          <div class="q-arab" dir="rtl">${UI.esc(a.ar)}</div>
          ${showTrans ? `<div class="q-trans">${UI.esc(state.trans === 'id' ? a.id : a.en)}</div>` : ''}
        </div>
      </div>`).join('');
    const pageBadge = state.mode === 'mushaf' ? `<div class="q-page-badge"> Halaman Mushaf ${state.page}</div>` : '';
    content.innerHTML = `<div class="clay-card q-reader">${pageBadge}${html}</div>`;
  }

  function open() {
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
              <h1 id="page-title">Al-Qur'an</h1>
              <div class="sub" id="page-sub">Baca mushaf & terjemah</div>
            </div>
            <div class="actions" id="topbar-actions"></div>
          </div>
          <div id="view-content"></div>
        </main>
      </div>`;
    document.getElementById('btn-back-login').onclick = () => { Auth.renderLogin(); };
  }

  function retry() { loadAndRender(); }

  function openWithSurah(surahNum) {
    state.surah = surahNum;
    open();
  }

  return { open, retry, openWithSurah };
})();
