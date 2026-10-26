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
    const v = String(s == null ? '' : s).trim();
    if (!v) return '';
    return /^(https?:|data:image\/|\/|\.\/|\.\.\/|uploads\/)/i.test(v) ? v : '';
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
    const modal = el(`<div class="modal ${opts.cls || ''}"></div>`);
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

  function openKitabViewer(opts) {
    const rawUrl = opts.url || '';
    let finalUrl = safeUrl(rawUrl);
    if (!finalUrl && rawUrl && !rawUrl.includes(':')) {
      finalUrl = rawUrl;
    }
    const title = opts.title || 'Kitab';
    const sub = opts.sub || '';

    // Popup Fullscreen (layar penuh) dengan tombol ✕ di pojok kanan atas
    const overlay = el(`
      <div class="kitab-fullscreen-overlay" role="dialog" aria-modal="true" style="position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,0.88);backdrop-filter:blur(6px);display:flex;flex-direction:column;animation:fadeIn .2s ease">
        <div class="kitab-fullscreen-header" style="background:var(--card);padding:10px 18px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);box-shadow:0 3px 12px rgba(0,0,0,0.08);flex-shrink:0;gap:12px">
          <div class="row center" style="gap:10px;min-width:0;flex:1">
            <span style="font-size:24px;flex-shrink:0">📖</span>
            <div style="min-width:0">
              <div style="font-weight:700;font-size:16px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title)}</div>
              ${sub ? `<div class="muted" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(sub)}</div>` : ''}
            </div>
          </div>
          <div class="row center" style="gap:10px;flex-shrink:0">
            <a href="${esc(finalUrl)}" target="_blank" rel="noopener noreferrer" class="clay-btn sm ghost" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-size:13px">
              ⤢ Tab Baru
            </a>
            <button class="clay-btn sm ghost btn-kitab-close" type="button" aria-label="Tutup Kitab" style="font-size:20px;font-weight:bold;width:38px;height:38px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:var(--text);border:1px solid var(--border);background:var(--bg);cursor:pointer" title="Tutup Kitab (Esc)">
              ✕
            </button>
          </div>
        </div>
        <div class="kitab-fullscreen-body" style="flex:1;width:100%;height:100%;position:relative;background:#323639;overflow:hidden">
          <object data="${esc(finalUrl)}#toolbar=1&navpanes=1" type="application/pdf" style="width:100%;height:100%;border:none;display:block">
            <iframe src="${esc(finalUrl)}" style="width:100%;height:100%;border:none;display:block" title="${esc(title)}">
              <div style="padding:40px 20px;text-align:center;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%">
                <div style="font-size:40px;margin-bottom:12px">📖</div>
                <div style="font-size:18px;font-weight:600;margin-bottom:8px">Pembaca PDF Digital</div>
                <div style="font-size:14px;color:#cbd5e1;max-width:420px;margin-bottom:20px;line-height:1.6">
                  Perangkat Anda memerlukan penampil PDF langsung atau dapat dibuka di tab baru.
                </div>
                <a href="${esc(finalUrl)}" target="_blank" class="clay-btn primary" style="text-decoration:none;font-size:15px;padding:12px 24px">
                  Buka File Kitab PDF ↗
                </a>
              </div>
            </iframe>
          </object>
        </div>
      </div>`);

    document.body.appendChild(overlay);

    const modalId = 'kitab_' + Date.now();
    window.history.pushState(Object.assign({}, window.history.state || {}, { tahfidzModal: modalId }), '', window.location.href);

    let closed = false;
    function closeViewer(fromHistory = false) {
      if (closed) return;
      closed = true;
      window.removeEventListener('keydown', onKeyDown);
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity .18s ease';
      setTimeout(() => overlay.remove(), 180);
      const index = modalStack.findIndex(item => item.id === modalId);
      if (index !== -1) modalStack.splice(index, 1);
      if (!fromHistory && window.history.state?.tahfidzModal === modalId) {
        ignoreNextModalPop = true;
        window.history.back();
      }
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') closeViewer();
    }
    window.addEventListener('keydown', onKeyDown);

    overlay.querySelector('.btn-kitab-close').onclick = () => closeViewer();
    modalStack.push({ id: modalId, close: () => closeViewer(true) });

    return { close: closeViewer };
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

  return { el, esc, safeUrl, fmtDate, fmtDateTime, toast, openModal, confirmDialog, openKitabViewer, field, optionsFromList, surahOptions };
})();
