/**
 * gallery.js — Galerimiz bölümü.
 *
 * Supabase memories tablosundaki tüm anı fotoğraflarını
 * tek büyük kart + ok navigasyonu ile gösterir.
 * escapeHtml, escapeAttr, formatDate, storage, supabaseClient → utils.js
 */
const galleryModule = (function () {

  const STORAGE_KEY    = 'love_memories';
  const REALTIME_GRACE = 3000;

  let photos       = [];   // [{ url, title, date }]
  let currentIdx   = 0;
  let isTransition = false;
  let lbOpen       = false;
  let _lastSaveMs  = 0;

  /* DOM refs — render() sonrası güncellenir */
  let elImg, elTitle, elDate, elDots;
  let elLightbox, elLbImg;

  /* ── Veri yükleme ─────────────────────────────────── */

  async function loadPhotos() {
    var mems = await storage.get(STORAGE_KEY, []);
    photos = [];
    (mems || []).forEach(function (m) {
      var pics = m.photos || (m.photo ? [m.photo] : []);
      pics.forEach(function (url) {
        if (url) photos.push({ url: url, title: m.title || '', date: m.date || '' });
      });
    });
  }

  /* ── Render ───────────────────────────────────────── */

  function render() {
    var stage = document.getElementById('galleryStage');
    if (!stage) return;

    if (!photos.length) {
      stage.innerHTML = '<div class="gallery-empty">Henüz anı fotoğrafı yok 📸</div>';
      elImg = elTitle = elDate = elDots = null;
      return;
    }

    if (currentIdx >= photos.length) currentIdx = 0;
    var p = photos[currentIdx];

    var arrowHtml = photos.length > 1
      ? '<button class="gallery-arrow gallery-arrow-prev" id="glrPrev" type="button" aria-label="Önceki fotoğraf">&#10094;</button>' +
        '<button class="gallery-arrow gallery-arrow-next" id="glrNext" type="button" aria-label="Sonraki fotoğraf">&#10095;</button>'
      : '';

    stage.innerHTML =
      '<div class="gallery-card">' +
        '<img class="gallery-img" id="glrImg" src="' + escapeAttr(p.url) + '" alt="' + escapeAttr(p.title) + '" />' +
        '<div class="gallery-info-overlay">' +
          '<h3 class="gallery-item-title" id="glrTitle">' + escapeHtml(p.title) + '</h3>' +
          '<time class="gallery-item-date"  id="glrDate">' + (p.date ? formatDate(p.date) : '') + '</time>' +
        '</div>' +
        arrowHtml +
      '</div>' +
      '<div class="gallery-dots" id="glrDots"></div>';

    elImg   = document.getElementById('glrImg');
    elTitle = document.getElementById('glrTitle');
    elDate  = document.getElementById('glrDate');
    elDots  = document.getElementById('glrDots');

    elImg.addEventListener('click', openLightbox);

    var prevBtn = document.getElementById('glrPrev');
    var nextBtn = document.getElementById('glrNext');
    if (prevBtn) prevBtn.addEventListener('click', prevPhoto);
    if (nextBtn) nextBtn.addEventListener('click', nextPhoto);

    renderDots();
  }

  /* ── Dot indikatörler ─────────────────────────────── */

  function renderDots() {
    if (!elDots) return;
    var total = photos.length;
    if (total <= 1) { elDots.innerHTML = ''; return; }

    var MAX   = 10;
    var html  = '';

    if (total <= MAX) {
      for (var i = 0; i < total; i++) {
        html += '<button class="gallery-dot' + (i === currentIdx ? ' gallery-dot--active' : '') +
                '" data-idx="' + i + '" type="button" aria-label="Fotoğraf ' + (i + 1) + '"></button>';
      }
    } else {
      var half  = Math.floor(MAX / 2);
      var start = Math.max(0, Math.min(currentIdx - half, total - MAX));
      var end   = start + MAX - 1;

      if (start > 0) html += '<span class="gallery-ellipsis">…</span>';
      for (var j = start; j <= end; j++) {
        html += '<button class="gallery-dot' + (j === currentIdx ? ' gallery-dot--active' : '') +
                '" data-idx="' + j + '" type="button" aria-label="Fotoğraf ' + (j + 1) + '"></button>';
      }
      if (end < total - 1) html += '<span class="gallery-ellipsis">…</span>';
    }

    elDots.innerHTML = html;
    elDots.querySelectorAll('.gallery-dot').forEach(function (btn) {
      btn.addEventListener('click', function () {
        navigateTo(parseInt(btn.dataset.idx, 10));
      });
    });
  }

  /* ── Navigasyon ───────────────────────────────────── */

  function navigateTo(idx) {
    if (isTransition || !photos.length || idx === currentIdx) return;
    isTransition = true;

    if (!elImg) {
      currentIdx   = ((idx % photos.length) + photos.length) % photos.length;
      render();
      isTransition = false;
      return;
    }

    elImg.classList.add('gallery-img--fading');

    setTimeout(function () {
      currentIdx = ((idx % photos.length) + photos.length) % photos.length;
      var p = photos[currentIdx];
      elImg.src = p.url;
      elImg.alt = p.title;
      if (elTitle) elTitle.textContent = p.title;
      if (elDate)  elDate.textContent  = p.date ? formatDate(p.date) : '';
      elImg.classList.remove('gallery-img--fading');
      renderDots();
      isTransition = false;
    }, 250);
  }

  function prevPhoto() {
    if (photos.length) navigateTo((currentIdx - 1 + photos.length) % photos.length);
  }

  function nextPhoto() {
    if (photos.length) navigateTo((currentIdx + 1) % photos.length);
  }

  /* ── Lightbox ─────────────────────────────────────── */

  function buildLightbox() {
    var lb = document.createElement('div');
    lb.className = 'gallery-lightbox';
    lb.id        = 'galleryLightbox';
    lb.setAttribute('role',       'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Galeri tam ekran');
    lb.innerHTML =
      '<button class="gallery-lb-close" id="glrLbClose" type="button" aria-label="Kapat">&#10005;</button>' +
      '<img class="gallery-lb-img" id="glrLbImg" src="" alt="" />';

    document.body.appendChild(lb);

    elLightbox = lb;
    elLbImg    = document.getElementById('glrLbImg');

    document.getElementById('glrLbClose').addEventListener('click', closeLightbox);
    lb.addEventListener('click', function (e) {
      if (e.target === lb) closeLightbox();
    });
  }

  function openLightbox() {
    if (!photos.length || !elLightbox) return;
    var p = photos[currentIdx];
    elLbImg.src = p.url;
    elLbImg.alt = p.title;
    elLightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
    lbOpen = true;
  }

  function closeLightbox() {
    if (!elLightbox) return;
    elLightbox.classList.remove('open');
    document.body.style.overflow = '';
    lbOpen = false;
  }

  /* ── Klavye ───────────────────────────────────────── */

  function handleKeydown(e) {
    if (lbOpen) {
      if (e.key === 'Escape') closeLightbox();
      return;
    }

    /* Anılar lightbox açıkken galeri okları çalışmasın */
    var memLb = document.getElementById('lightboxOverlay');
    if (memLb && memLb.classList.contains('open')) return;

    if (e.key === 'ArrowLeft')  prevPhoto();
    if (e.key === 'ArrowRight') nextPhoto();
  }

  /* ── Realtime sync ────────────────────────────────── */

  function subscribeRealtime() {
    supabaseClient.channel('gallery-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memories' },
        async function () {
          if (Date.now() - _lastSaveMs < REALTIME_GRACE) return;
          await loadPhotos();
          if (currentIdx >= photos.length) currentIdx = 0;
          render();
        })
      .subscribe();
  }

  /* ── Init ─────────────────────────────────────────── */

  async function init() {
    if (!document.getElementById('galleryStage')) return;

    await loadPhotos();
    buildLightbox();
    render();
    subscribeRealtime();

    document.addEventListener('keydown', handleKeydown);
  }

  return { init: init };

})();
