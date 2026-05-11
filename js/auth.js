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

    const normalize = s => s.toLowerCase().replace(/\s+/g, '');
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
    if (form)      form.addEventListener('submit', handleSubmit);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
  }

  return { init, getUser };

})();
