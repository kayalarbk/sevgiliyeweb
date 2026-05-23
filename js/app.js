/**
 * app.js — Uygulama başlangıç noktası.
 *
 * DOMContentLoaded sonrası:
 *   1. localStorage → Supabase tek seferlik veri göçünü çalıştırır.
 *   2. Kimlik doğrulamayı başlatır.
 *   3. Kaydedilmiş arkaplan fotoğrafını geri yükler.
 *   4. Gece/Gündüz tema değiştiriciyi başlatır.
 *   5. Her özellik modülünü init() ile başlatır.
 *   6. Kayan kalp parçacıklarını başlatır.
 *   7. Aktif nav linkini scroll'a göre günceller.
 */
(function () {

  const BG_KEY              = 'love_bg';
  const THEME_KEY           = 'love_theme';
  const BG_COMPRESS_PX      = 1920;
  const BG_COMPRESS_QUALITY = 0.80;
  const NAV_HEIGHT          = 56;
  const NAV_SCROLL_OFFSET   = 16;
  const HEART_BURST_COUNT   = 4;
  const HEART_BURST_DELAY_MS = 700;
  const HEART_INTERVAL_MS   = 2800;

  /* ── Arkaplan ──────────────────────────────────────── */

  function applyBg(url) {
    const bgEl = document.getElementById('bgPhoto');
    if (bgEl) bgEl.style.backgroundImage = 'url(' + url + ')';
  }

  function handleBgUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (ev) {
      const dataUrl = await compressImage(ev.target.result, BG_COMPRESS_PX, BG_COMPRESS_QUALITY);
      applyBg(dataUrl); /* Anında göster */
      const url = await uploadPhoto(dataUrl, 'bg/background.jpg');
      await storage.setRaw(BG_KEY, url);
      if (url !== dataUrl) applyBg(url);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  /* ── Gece / Gündüz modu ────────────────────────────── */

  function applyTheme(theme) {
    const btn = document.getElementById('themeToggle');
    if (theme === 'day') {
      document.body.classList.add('day-mode');
      if (btn) btn.textContent = '☀️';
    } else {
      document.body.classList.remove('day-mode');
      if (btn) btn.textContent = '🌙';
    }
  }

  async function toggleTheme() {
    const isDay    = document.body.classList.contains('day-mode');
    const newTheme = isDay ? 'night' : 'day';
    await storage.setRaw(THEME_KEY, newTheme);
    applyTheme(newTheme);
  }

  /* ── Kayan kalpler ─────────────────────────────────── */

  const HEART_GLYPHS = ['♥', '❤', '♡', '💕', '💗'];

  function spawnHeart() {
    const heart = document.createElement('span');
    heart.className   = 'floating-heart';
    heart.textContent = HEART_GLYPHS[Math.floor(Math.random() * HEART_GLYPHS.length)];
    heart.setAttribute('aria-hidden', 'true');

    const dur      = (3.5 + Math.random() * 4).toFixed(2) + 's';
    const rotEnd   = (Math.random() * 40 - 20).toFixed(1) + 'deg';
    const scaleEnd = (0.25 + Math.random() * 0.6).toFixed(2);
    const size     = (0.8 + Math.random() * 1.4).toFixed(2) + 'rem';

    heart.style.setProperty('--fh-dur',       dur);
    heart.style.setProperty('--fh-rot-end',   rotEnd);
    heart.style.setProperty('--fh-scale-end', scaleEnd);
    heart.style.fontSize = size;
    heart.style.left     = (4 + Math.random() * 92) + 'vw';
    heart.style.bottom   = '108px';

    document.body.appendChild(heart);
    heart.addEventListener('animationend', () => heart.remove(), { once: true });
  }

  function startFloatingHearts() {
    for (let i = 0; i < HEART_BURST_COUNT; i++) {
      setTimeout(spawnHeart, i * HEART_BURST_DELAY_MS);
    }
    setInterval(spawnHeart, HEART_INTERVAL_MS);
  }

  /* ── Bootstrap ─────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', async function () {

    /* Kimlik doğrulama (sync — localStorage tabanlı) */
    auth.init();

    /* localStorage → Supabase tek seferlik veri göçü */
    await migrateFromLocalStorage();

    /* Arkaplan */
    const savedBg = await storage.getRaw(BG_KEY);
    if (savedBg) applyBg(savedBg);

    const bgInput = document.getElementById('bgUpload');
    if (bgInput) bgInput.addEventListener('change', handleBgUpload);

    /* Tema */
    const savedTheme = (await storage.getRaw(THEME_KEY)) || 'night';
    applyTheme(savedTheme);
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    /* Modüller — async init, fire-and-forget (kendi içlerinde hata yönetirler) */
    counter.init();
    player.init();
    bucket.init();
    memories.init();
    timeline.init();
    announcements.init();
    quotes.init();
    mapModule.init();

    /* Kayan kalpler */
    startFloatingHearts();

    /* Aktif nav link */
    const sections = [
      document.getElementById('counterSection'),
      document.getElementById('memoriesSection'),
      document.getElementById('bucketSection'),
      document.getElementById('mapSection'),
    ].filter(Boolean);

    const navLinks = document.querySelectorAll('.nav-link');

    function updateActiveLink() {
      const scrollY = window.scrollY + NAV_HEIGHT + NAV_SCROLL_OFFSET;
      let active = sections[0];
      sections.forEach(sec => {
        if (sec && sec.offsetTop <= scrollY) active = sec;
      });
      navLinks.forEach(link => {
        link.classList.toggle(
          'active',
          link.getAttribute('href') === '#' + (active && active.id)
        );
      });
    }

    window.addEventListener('scroll', updateActiveLink, { passive: true });
    updateActiveLink();

  });

})();
