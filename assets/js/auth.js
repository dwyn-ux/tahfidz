/* ============================================================
   Tahfidzku — Auth (Login)
   ============================================================ */
const Auth = (() => {
  let selectedRole = 'admin';

  function renderLogin() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="auth-wrap">
        <div class="clay-card auth-card">
          <div class="brand"><span class="logo"></span> Tahfidzku</div>
          <div class="tagline">Manajemen Pembelajaran Tahfidz Al-Qur'an</div>
          <form id="login-form">
            <label class="field-label">Username</label>
            <input class="clay-input" id="login-user" placeholder="admin / ustadz1 / 0812111111" />
            <label class="field-label">Password</label>
            <input class="clay-input" id="login-pass" type="password" placeholder="••••••••" />
            <div id="login-error" style="display:none;margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(220,38,38,.1);color:var(--danger);font-size:13px"></div>
            <div class="auth-roles" id="role-pick">
              <div class="role ${selectedRole === 'admin' ? 'active' : ''}" data-r="admin"> Admin</div>
              <div class="role ${selectedRole === 'ustadz' ? 'active' : ''}" data-r="ustadz"> Ustadz</div>
              <div class="role ${selectedRole === 'wali' ? 'active' : ''}" data-r="wali"> Wali</div>
            </div>
            <button class="clay-btn primary" style="width:100%;margin-top:18px;justify-content:center" type="submit">Masuk</button>
          </form>
          <div class="muted" style="font-size:12px;margin-top:14px;text-align:center">
            Hubungi admin untuk mendapatkan akun.
          </div>
          <button class="clay-btn ghost" id="open-quran" style="width:100%;margin-top:14px;justify-content:center"> Baca Al-Qur'an (Mushaf & Terjemah)</button>
        </div>
      </div>`;

    app.querySelectorAll('#role-pick .role').forEach(r => {
      r.onclick = () => {
        selectedRole = r.dataset.r;
        app.querySelectorAll('#role-pick .role').forEach(x => x.classList.remove('active'));
        r.classList.add('active');
      };
    });

    app.querySelector('#login-form').onsubmit = async (e) => {
      e.preventDefault();
      const u = app.querySelector('#login-user').value.trim();
      const p = app.querySelector('#login-pass').value;
      const errBox = app.querySelector('#login-error');
      errBox.style.display = 'none';
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Memproses...';
      const res = await Store.login(u, p);
      btn.disabled = false; btn.textContent = 'Masuk';
      if (!res.ok) {
        errBox.textContent = '❌ ' + res.msg;
        errBox.style.display = 'block';
        UI.toast(res.msg, 'error');
        return;
      }
      if (res.user.role !== selectedRole) {
        const msg = 'Peran tidak sesuai. Pilih peran ' + (res.user.role === 'admin' ? 'Admin' : res.user.role === 'ustadz' ? 'Ustadz' : 'Wali') + ' untuk akun ini.';
        errBox.textContent = '❌ ' + msg;
        errBox.style.display = 'block';
        UI.toast(msg, 'error');
        Store.clearSession();
        return;
      }
      try {
        await Store.load();
      } catch (err) {
        const msg = 'Gagal memuat data: ' + (err.message || '');
        errBox.textContent = '❌ ' + msg;
        errBox.style.display = 'block';
        UI.toast(msg, 'error');
        return;
      }
      UI.toast('Login berhasil', 'success');
      App.start();
    };

    const qBtn = app.querySelector('#open-quran');
    if (qBtn) qBtn.onclick = () => { App.navigate('quran'); };
  }

  return { renderLogin };
})();
