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
    const t = el(`<div class="toast ${type}">${type === 'success' ? '✅' : type === 'error' ? '⛔' : 'ℹ️'} <span>${esc(msg)}</span></div>`);
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

  return { el, esc, fmtDate, fmtDateTime, toast, openModal, confirmDialog, field, optionsFromList, surahOptions };
})();
