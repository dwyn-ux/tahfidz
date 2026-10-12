/* ============================================================
   Tahfidzku — UI helpers (modal, toast, format)
   ============================================================ */
const UI = (() => {
  const modalStack = [];
  let ignoreNextModalPop = false;

  // Hardware/browser Back closes the top-most form first. Without this,
  // Android can leave the app while an input modal is still open.
  window.addEventListener('popstate', () => {
    if (ignoreNextModalPop) { ignoreNextModalPop = false; return; }
    const top = modalStack[modalStack.length - 1];
    if (top) top.close(true);
  });

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function safeUrl(s) {
    const v = String(s == null ? '' : s);
    if (!v) return '';
    return /^(https?:|data:image\/|\/|\.\/|\.\.\/)/i.test(v) ? v : '';
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
      // Handler simpan biasanya asynchronous. Tanpa pengunci, beberapa tap
      // sebelum respons server selesai menjalankan handler yang sama berulang
      // kali dan dapat membuat data ganda.
      let actionPending = false;
      btn.onclick = () => {
        if (actionPending || !a.onClick) return;
        let result;
        try {
          result = a.onClick(modal, close);
        } catch (err) {
          console.error('Modal action failed:', err);
          toast('Terjadi kesalahan. Silakan coba lagi.', 'error');
          return;
        }
        if (!result || typeof result.then !== 'function') return;

        actionPending = true;
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        Promise.resolve(result).catch(err => {
          console.error('Modal action failed:', err);
          toast('Terjadi kesalahan. Silakan coba lagi.', 'error');
        }).finally(() => {
          actionPending = false;
          // Modal mungkin telah ditutup setelah penyimpanan berhasil.
          if (btn.isConnected) {
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
          }
        });
      };
      actions.appendChild(btn);
    });
    overlay.appendChild(modal);
    overlay.onclick = (e) => { if (e.target === overlay && opts.dismissable !== false) close(); };
    root.appendChild(overlay);
    const modalId = 'modal_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    window.history.pushState(Object.assign({}, window.history.state || {}, { tahfidzModal: modalId }), '', window.location.href);
    let closed = false;
    function close(fromHistory = false) {
      if (closed) return;
      closed = true;
      overlay.remove();
      const index = modalStack.findIndex(item => item.id === modalId);
      if (index !== -1) modalStack.splice(index, 1);
      if (!fromHistory && window.history.state?.tahfidzModal === modalId) {
        ignoreNextModalPop = true;
        window.history.back();
      }
    }
    modalStack.push({ id: modalId, close });
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

  return { el, esc, safeUrl, fmtDate, fmtDateTime, toast, openModal, confirmDialog, field, optionsFromList, surahOptions };
})();
