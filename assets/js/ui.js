/* ============================================================
   Tahfidzku — UI helpers (modal, toast, format)
   ============================================================ */
const UI = (() => {
  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso.length <= 10 ? iso : iso);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtDateTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function toast(msg, type = 'success') {
    const root = document.getElementById('toast-root');
    const t = el(`<div class="toast ${type}">${type === 'success' ? '' : type === 'error' ? '' : ''} <span>${esc(msg)}</span></div>`);
    root.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(40px)'; setTimeout(() => t.remove(), 250); }, 2800);
  }

  /* Modal: openModal({title, sub, bodyHTML, actions:[{label,cls,onClick}]}) */
  function openModal(opts) {
    const root = document.getElementById('modal-root');
    const overlay = el(`<div class="modal-overlay"></div>`);
    const modal = el(`<div class="modal"></div>`);
    modal.innerHTML = `
      <h3>${esc(opts.title || '')}</h3>
      ${opts.sub ? `<div class="modal-sub">${esc(opts.sub)}</div>` : ''}
      <div class="modal-body">${opts.bodyHTML || ''}</div>
      <div class="modal-actions"></div>`;
    const actions = modal.querySelector('.modal-actions');
    (opts.actions || []).forEach(a => {
      const btn = el(`<button class="clay-btn ${a.cls || ''}">${esc(a.label)}</button>`);
      btn.onclick = () => a.onClick && a.onClick(modal, close);
      actions.appendChild(btn);
    });
    overlay.appendChild(modal);
    overlay.onclick = (e) => { if (e.target === overlay && opts.dismissable !== false) close(); };
    root.appendChild(overlay);
    function close() { overlay.remove(); }
    return { modal, close };
  }

  function confirmDialog(title, msg, onYes) {
    openModal({
      title, sub: msg,
      actions: [
        { label: 'Batal', cls: 'ghost', onClick: (m, c) => c() },
        { label: 'Ya, Lanjut', cls: 'danger', onClick: (m, c) => { c(); onYes && onYes(); } }
      ]
    });
  }

  /* Simple form field builder */
  function field(label, inputHTML) {
    return `<label class="field-label">${esc(label)}</label>${inputHTML}`;
  }

  function optionsFromList(list, valField, labelField, selected) {
    return list.map(it => `<option value="${esc(it[valField])}" ${it[valField] == selected ? 'selected' : ''}>${esc(it[labelField])}</option>`).join('');
  }

  function surahOptions(selected) {
    return SURAHS.map(s => `<option value="${s.n}" ${Number(s.n) === Number(selected) ? 'selected' : ''}>${s.n}. ${esc(s.latin)}</option>`).join('');
  }

  function surahDatalistId() { return 'dl-surah'; }

  function surahDatalistHTML() {
    return `<datalist id="dl-surah">${SURAHS.map(s => `<option value="${s.n}. ${s.latin}">${s.n}. ${s.latin} (${s.arab})</option>`).join('')}</datalist>`;
  }

  /* Search bar — real-time, cross-entity */
  let searchTimer = null;

  function renderSearch() {
    const wrap = document.getElementById('search-wrap');
    if (!wrap) return;
    const session = Store.getSession();
    if (!session) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = `
      <div class="search-box" id="search-box">
        <input class="search-input" id="search-input" type="text" placeholder="🔍 Cari santri/ustadz/wali..." autocomplete="off" />
        <div class="search-drop" id="search-drop" style="display:none"></div>
      </div>`;
    const input = document.getElementById('search-input');
    const drop = document.getElementById('search-drop');
    input.oninput = () => {
      clearTimeout(searchTimer);
      const v = input.value.trim();
      if (v.length < 1) { drop.style.display = 'none'; return; }
      searchTimer = setTimeout(() => {
        const r = Store.search(v);
        let html = '';
        const total = r.santri.length + r.ustadz.length + r.wali.length + r.halaqah.length + r.surah.length;
        if (!total) { html = '<div class="search-empty">Tidak ditemukan</div>'; }
        else {
          if (r.surah.length) html += r.surah.map(x => `<div class="search-item" data-type="surah" data-id="${x.n}"> <b>${x.n}. ${esc(x.latin)}</b> <span class="muted">${x.arab}</span></div>`).join('');
          if (r.santri.length) html += r.santri.map(x => `<div class="search-item" data-type="santri" data-id="${esc(x.id)}"> Santri: <b>${esc(x.nama)}</b> <span class="muted">${esc(x.nis)}</span></div>`).join('');
          if (r.ustadz.length) html += r.ustadz.map(x => `<div class="search-item" data-type="ustadz" data-id="${esc(x.id)}"> Ustadz: <b>${esc(x.nama)}</b></div>`).join('');
          if (r.wali.length) html += r.wali.map(x => `<div class="search-item" data-type="wali" data-id="${esc(x.id)}"> Wali: <b>${esc(x.nama)}</b></div>`).join('');
          if (r.halaqah.length) html += r.halaqah.map(x => `<div class="search-item" data-type="halaqah" data-id="${esc(x.id)}"> Halaqah: <b>${esc(x.nama)}</b></div>`).join('');
        }
        drop.innerHTML = html; drop.style.display = 'block';
        drop.querySelectorAll('.search-item').forEach(el => el.onclick = () => {
          const type = el.dataset.type;
          const id = el.dataset.id;
          const role = (session || {}).role || '';
          if (type === 'surah') {
            const q = window.Quran;
            if (q && typeof q.openWithSurah === 'function') q.openWithSurah(Number(id));
            else App.navigate('quran');
          } else {
            const views = { admin: { santri: 'admin_santri', ustadz: 'admin_ustadz', halaqah: 'admin_halaqah' }, ustadz: { santri: 'ustadz_riwayat' } };
            const target = (views[role] && views[role][type]) || null;
            if (target) App.navigate(target);
          }
          input.value = ''; drop.style.display = 'none';
        });
      }, 150);
    };
    input.onblur = () => setTimeout(() => { drop.style.display = 'none'; }, 200);
    input.onfocus = () => { if (input.value.trim()) drop.style.display = 'block'; };
  }

  return { el, esc, fmtDate, fmtDateTime, toast, openModal, confirmDialog, field, optionsFromList, surahOptions, renderSearch };
})();
