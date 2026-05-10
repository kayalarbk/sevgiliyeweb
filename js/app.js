/**
 * app.js — Application entry point.
 *
 * Waits for DOMContentLoaded, then:
 *   1. Restores a previously saved background image from localStorage.
 *   2. Wires up the background-image file-upload control.
 *   3. Calls init() on every feature module.
 *
 * All modules (counter, player, memories, quotes) must be loaded before
 * this file in index.html.
 */
(function () {

  const BG_KEY = 'love_bg';

  /** Sets the <body> background-image to the given data URL. */
  function applyBg(dataUrl) {
    document.body.style.backgroundImage = 'url(' + dataUrl + ')';
  }

  /**
   * Reads the selected image file via FileReader, applies it as the
   * background, and caches it in localStorage for future page loads.
   */
  function handleBgUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (ev) {
      // Compress background to max 1920px to save localStorage space
      compressImage(ev.target.result, 1920, 0.80).then(function (dataUrl) {
        applyBg(dataUrl);
        try {
          localStorage.setItem(BG_KEY, dataUrl);
        } catch (_) {
          // Quota exceeded — still apply visually this session
        }
      });
    };
    reader.readAsDataURL(file);

    e.target.value = '';
  }

  /* ── Floating hearts ────────────────────────────── */

  const HEART_GLYPHS = ['♥', '❤', '♡', '💕', '💗'];

  /**
   * Creates a single heart element, positions it at a random horizontal
   * spot near the bottom, and removes it automatically after animation ends.
   */
  function spawnHeart() {
    const heart = document.createElement('span');
    heart.className   = 'floating-heart';
    heart.textContent = HEART_GLYPHS[Math.floor(Math.random() * HEART_GLYPHS.length)];
    heart.setAttribute('aria-hidden', 'true');

    // Randomise per-element CSS custom properties used by the keyframe
    const dur      = (3.5 + Math.random() * 4).toFixed(2) + 's';
    const rotEnd   = (Math.random() * 40 - 20).toFixed(1) + 'deg';
    const scaleEnd = (0.25 + Math.random() * 0.6).toFixed(2);
    const size     = (0.8 + Math.random() * 1.4).toFixed(2) + 'rem';

    heart.style.setProperty('--fh-dur',       dur);
    heart.style.setProperty('--fh-rot-end',   rotEnd);
    heart.style.setProperty('--fh-scale-end', scaleEnd);
    heart.style.fontSize   = size;
    heart.style.left       = (4 + Math.random() * 92) + 'vw';
    heart.style.bottom     = '108px';   // sit just above the player bar

    document.body.appendChild(heart);
    heart.addEventListener('animationend', () => heart.remove(), { once: true });
  }

  /**
   * Starts the ambient heart particle system.
   * Spawns an initial burst of 4 hearts (staggered), then one every ~2.8 s.
   */
  function startFloatingHearts() {
    for (let i = 0; i < 4; i++) {
      setTimeout(spawnHeart, i * 700);
    }
    setInterval(spawnHeart, 2800);
  }

  /* ── Bootstrap ───────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', function () {

    // Restore background saved from a previous session
    const savedBg = localStorage.getItem(BG_KEY);
    if (savedBg) applyBg(savedBg);

    // Wire background upload input
    const bgInput = document.getElementById('bgUpload');
    if (bgInput) bgInput.addEventListener('change', handleBgUpload);

    // Initialise feature modules
    counter.init();
    player.init();
    bucket.init();
    memories.init();
    quotes.init();

    // Start ambient floating hearts
    startFloatingHearts();

    // Active nav link highlight on scroll
    const sections  = [
      document.getElementById('counterSection'),
      document.getElementById('memoriesSection'),
      document.getElementById('bucketSection'),
    ];
    const navLinks  = document.querySelectorAll('.nav-link');
    const navHeight = 56;

    function updateActiveLink() {
      const scrollY = window.scrollY + navHeight + 16;
      let active = sections[0];
      sections.forEach(sec => {
        if (sec && sec.offsetTop <= scrollY) active = sec;
      });
      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + (active && active.id));
      });
    }

    window.addEventListener('scroll', updateActiveLink, { passive: true });
    updateActiveLink();

  });

})();
