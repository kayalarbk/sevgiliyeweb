/**
 * auth.js — Basit oturum yönetimi.
 *
 * İki hardcode kullanıcı; session localStorage'da saklanır.
 * Public API: auth.init(), auth.getUser()
 */
const auth = (function () {

  const SESSION_KEY = 'love_session';

  const USERS = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.users) ? APP_CONFIG.users : [];

  /* ── Session ──────────────────────────────────────── */

  function getUser() {
    return storage.get(SESSION_KEY, null);
  }

  function saveSession(user) {
    storage.set(SESSION_KEY, { username: user.username });
  }

  function clearSession() {
    storage.remove(SESSION_KEY);
  }

  /* ── UI ───────────────────────────────────────────── */

  function showLogin() {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.classList.add('visible');
    document.body.classList.add('auth-locked');
  }

  function hideLogin() {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.classList.remove('visible');
    document.body.classList.remove('auth-locked');
  }

  function updateNavUser(user) {
    const el = document.getElementById('navUsername');
    if (!el) return;
    el.textContent = user ? user.username.split(' ')[0] : '';
  }

  /* ── Handlers ─────────────────────────────────────── */

  function handleSubmit(e) {
    e.preventDefault();

    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    const errorEl       = document.getElementById('loginError');
    const card          = document.getElementById('loginCard');

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    const normalize = s => s.toLowerCase()
      .replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u')
      .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
      .replace(/\s+/g,'');
    const match = USERS.find(u =>
      normalize(u.username) === normalize(username) && u.password === password
    );

    if (!match) {
      if (!username) {
        errorEl.textContent = 'Lütfen kullanıcı adı ve şifrenizi girin.';
      } else if (!password) {
        errorEl.textContent = 'Şifre alanı boş bırakılamaz.';
      } else {
        errorEl.textContent = 'Kullanıcı adı veya şifre hatalı. Tekrar dene.';
      }
      errorEl.hidden = false;
      passwordInput.value = '';
      passwordInput.focus();

      if (card) {
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
      }
      return;
    }

    saveSession(match);
    updateNavUser(match);
    errorEl.hidden = true;
    hideLogin();
  }

  function logout() {
    clearSession();
    updateNavUser(null);
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    const errorEl       = document.getElementById('loginError');
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (errorEl)       errorEl.hidden = true;
    showLogin();
    setTimeout(() => {
      const el = document.getElementById('loginUsername');
      if (el) el.focus();
    }, 100);
  }

  /* ── Init ─────────────────────────────────────────── */

  function init() {
    const user = getUser();

    if (user) {
      hideLogin();
      updateNavUser(user);
    } else {
      showLogin();
    }

    const form      = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('btnLogout');
    const eyeBtn    = document.getElementById('togglePassword');
    const passInput = document.getElementById('loginPassword');
    const eyeIcon   = document.getElementById('eyeIcon');

    if (form)      form.addEventListener('submit', handleSubmit);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (eyeBtn) {
      eyeBtn.addEventListener('click', () => {
        const visible = passInput.type === 'text';
        passInput.type = visible ? 'password' : 'text';
        eyeIcon.innerHTML = visible
          ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
          : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
      });
    }
  }

  return { init, getUser };

})();
