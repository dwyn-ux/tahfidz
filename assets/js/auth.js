/* ============================================================
   Tahfidzku — Auth (Login)
   ============================================================ */
const Auth = (() => {
  function renderLogin(initialError = '') {
    document.body.classList.remove('q-reading-fullscreen');
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="auth-wrap">
        <div class="clay-card auth-card">
          <div style="text-align:center;margin-bottom:20px">
            <div class="brand" style="justify-content:center;margin-bottom:6px">
              <span class="logo" style="width:42px;height:42px;border-radius:10px;background:var(--primary);color:#fff;display:inline-grid;place-items:center;">${Shared.icon('quran')}</span>
              <span style="font-size:24px;font-weight:700;color:var(--text);letter-spacing:-0.5px">Tahfidzku</span>
            </div>
            <div class="tagline" style="color:var(--text-soft);font-size:13.5px;margin:0">Sistem Informasi Pembelajaran Tahfidz Al-Qur'an</div>
          </div>

          <div style="background:var(--bg-subtle);border:1px solid var(--border);border-radius:var(--radius-md);padding:10px 12px;margin-bottom:18px">
            <div style="font-size:11.5px;font-weight:600;color:var(--text-soft);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Akses Cepat Demo:</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" class="clay-btn sm ghost" style="padding:4px 9px;font-size:11.5px;border-radius:5px" onclick="document.getElementById('login-user').value='admin';document.getElementById('login-pass').value='admin123'">Admin</button>
              <button type="button" class="clay-btn sm ghost" style="padding:4px 9px;font-size:11.5px;border-radius:5px" onclick="document.getElementById('login-user').value='ustadz1';document.getElementById('login-pass').value='12345678'">Ustadz</button>
              <button type="button" class="clay-btn sm ghost" style="padding:4px 9px;font-size:11.5px;border-radius:5px" onclick="document.getElementById('login-user').value='0812111111';document.getElementById('login-pass').value='12345678'">Wali</button>
            </div>
          </div>

          <form id="login-form">
            <label class="field-label" style="font-size:12.5px;font-weight:600">Username / No. HP</label>
            <input class="clay-input" id="login-user" placeholder="Contoh: admin / ustadz1 / 0812xxxx" required autocomplete="username" />
            <label class="field-label" style="font-size:12.5px;font-weight:600;margin-top:12px">Password</label>
            <input class="clay-input" id="login-pass" type="password" placeholder="••••••••" required autocomplete="current-password" />
            <div id="login-error" style="display:${initialError ? 'block' : 'none'};margin-top:12px;padding:10px 12px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:13px">${initialError ? UI.esc(initialError) : ''}</div>
            <button class="clay-btn primary" style="width:100%;margin-top:20px;justify-content:center;padding:11px;font-size:14px;font-weight:600" type="submit">Masuk ke Aplikasi</button>
          </form>

          <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:8px">
            <button class="clay-btn ghost sm" id="open-quran" style="width:100%;justify-content:center;font-size:13px">Buka Mushaf Al-Qur'an (Tanpa Login)</button>
            <button class="clay-btn primary sm pwa-install-btn" id="btn-login-install" style="width:100%;justify-content:center;display:none;background:var(--primary);color:#fff">Install Aplikasi Tahfidzku</button>
          </div>
          <div class="muted" style="font-size:11.5px;margin-top:14px;text-align:center">
            Peran akun dikenali secara otomatis berdasarkan data lembaga.
          </div>
        </div>
      </div>`;

    app.querySelector('#login-form').onsubmit = async (e) => {
      e.preventDefault();
      const u = app.querySelector('#login-user').value.trim();
      const p = app.querySelector('#login-pass').value;
      const errBox = app.querySelector('#login-error');
      errBox.style.display = 'none';
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Memverifikasi...';
      const res = await Store.login(u, p);
      btn.disabled = false; btn.textContent = 'Masuk ke Aplikasi';
      if (!res.ok) {
        errBox.textContent = res.msg;
        errBox.style.display = 'block';
        UI.toast(res.msg, 'error');
        return;
      }
      try {
        await Store.load();
      } catch (err) {
        const msg = 'Gagal memuat data: ' + (err.message || '');
        errBox.textContent = msg;
        errBox.style.display = 'block';
        UI.toast(msg, 'error');
        return;
      }
      UI.toast('Login berhasil', 'success');
      App.start({ dataLoaded: true });
    };

    const qBtn = app.querySelector('#open-quran');
    if (qBtn) qBtn.onclick = () => { App.navigate('quran'); };

    const pwaInstallBtn = app.querySelector('#btn-login-install');
    if (pwaInstallBtn) pwaInstallBtn.onclick = () => PWA.promptInstall();
    if (typeof PWA !== 'undefined' && PWA.renderInstallButtons) PWA.renderInstallButtons();
  }

  return { renderLogin };
})();
