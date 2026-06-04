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
  const BG_COMPRESS_PX      = 1920;
  const BG_COMPRESS_QUALITY = 0.80;
  const NAV_HEIGHT          = 56;
  const NAV_SCROLL_OFFSET   = 16;
  const HEART_BURST_COUNT   = 4;
  const HEART_BURST_DELAY_MS = 700;
  const HEART_INTERVAL_MS   = 2800;

  /* ── Arkaplan ──────────────────────────────────────── */

  let _bgUploading = false;

  function applyBg(url) {
    const bgEl = document.getElementById('bgPhoto');
    if (!bgEl || !url) return;
    /* Supabase CDN önbelleğini atla — sabit dosya adı her yüklemede cache'den gelir */
    const src = url.startsWith('https://')
      ? url.split('?')[0] + '?t=' + Date.now()
      : url;
    bgEl.style.backgroundImage = 'url(' + src + ')';
  }

  function setBgLoading(loading) {
    const label = document.querySelector('.bg-upload-label');
    if (!label) return;
    label.style.opacity       = loading ? '0.45' : '';
    label.style.pointerEvents = loading ? 'none'  : '';
  }

  function handleBgUpload(e) {
    if (_bgUploading) return;
    const file = e.target.files[0];
    e.target.value = ''; /* Aynı dosya tekrar seçilebilsin */
    if (!file || !file.type.startsWith('image/')) return;

    _bgUploading = true;
    setBgLoading(true);

    const reader = new FileReader();

    reader.onload = async function (ev) {
      try {
        const dataUrl = await compressImage(ev.target.result, BG_COMPRESS_PX, BG_COMPRESS_QUALITY);
        applyBg(dataUrl); /* Sıkıştırılmış görsel anında göster */

        /* 10 saniyelik timeout: aşılırsa dataUrl'i fallback olarak kullan */
        const url = await Promise.race([
          uploadPhoto(dataUrl, 'bg/background.jpg'),
          new Promise(resolve => setTimeout(() => resolve(dataUrl), 10000))
        ]);

        try { await storage.setRaw(BG_KEY, url); } catch (_) {}

        if (url !== dataUrl) applyBg(url);
      } catch (err) {
        console.error('Arka plan güncellenemedi:', err);
      } finally {
        _bgUploading = false;
        setBgLoading(false);
      }
    };

    reader.onerror = function () {
      console.error('Dosya okunamadı');
      _bgUploading = false;
      setBgLoading(false);
    };

    reader.readAsDataURL(file);
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

    /* Modüller — async init, fire-and-forget (kendi içlerinde hata yönetirler) */
    counter.init();
    player.init();
    tabs.init();
    bucket.init();
    memories.init();
    timeline.init();
    announcements.init();
    quotes.init();
    mapModule.init();
    watchlist.init();
    dreams.init();
    galleryModule.init();

    /* Kayan kalpler */
    startFloatingHearts();

    /* Aktif nav link */
    const sections = [
      document.getElementById('counterSection'),
      document.getElementById('memoriesSection'),
      document.getElementById('bucketSection'),
      document.getElementById('mapSection'),
      document.getElementById('gallerySection'),
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
