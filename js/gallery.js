/**
 * gallery.js — Galerimiz bölümü.
 *
 * Supabase memories tablosundaki tüm anı fotoğraflarını
 * 3D coverflow karuseli ile gösterir: sol (önceki) / orta (aktif) / sağ (sonraki).
 * Yan kartlara tıklamak gezinir, orta karta tıklamak lightbox açar.
 * escapeHtml, escapeAttr, formatDate, storage, supabaseClient → utils.js
 */
const galleryModule = (function () {

  const STORAGE_KEY    = 'love_memories';
  const REALTIME_GRACE = 3000;
  const TRANS_MS       = 550;  /* gallery.css .gallery-stack-card transition süresiyle eşit */
  const SWIPE_MIN      = 60;   /* px — bu eşiği aşan sürükleme sayfa değiştirir */

  const POS_CLASSES = [
    'gallery-stack-card--left',
    'gallery-stack-card--center',
    'gallery-stack-card--right'
  ];

  const ALL_POS_CLASSES = POS_CLASSES.concat([
    'gallery-stack-card--exit-left',
    'gallery-stack-card--exit-right'
  ]);

  let photos       = [];   // [{ url, title, date }]
  let currentIdx   = 0;
  let isTransition = false;
  let lbOpen       = false;
  let _lastSaveMs  = 0;

  /* Coverflow durumu — stackOrder = [sol, orta, sağ]; spareCard sahne dışında bekler */
  let stackOrder = [];     // [{ el, img, titleEl, dateEl }]
  let spareCard  = null;
  let elDots     = null;
  let elLightbox, elLbImg;

  /* Sürükleme durumu */
  let dragX0      = null;
  let dragDX      = 0;
  let justDragged = false;

  /* ── Veri yükleme ─────────────────────────────────── */

  async function loadPhotos() {
    var mems = await storage.get(STORAGE_KEY, []);
    photos = [];
    (mems || []).forEach(function (m) {
      var pics = m.photos || (m.photo ? [m.photo] : []);
      pics.forEach(function (url) {
        if (url) photos.push({
          url:         url,
          title:       m.title       || '',
          date:        m.date        || '',
          description: m.description || '',
          addedBy:     m.addedBy     || '',
          photoCount:  pics.length
        });
      });
    });
  }

  /* ── Render ───────────────────────────────────────── */

  function cardHtml() {
    return '<div class="gallery-card gallery-stack-card">' +
        '<div class="gallery-flip-content">' +
          /* Arka yüz — hover'da görünen: anı detayları */
          '<div class="gallery-flip-back">' +
            '<div class="gallery-flip-back-glow"></div>' +
            '<div class="gallery-flip-back-inner">' +
              '<div class="gallery-flip-circles">' +
                '<div class="gallery-flip-circle gallery-flip-circle--bottom"></div>' +
                '<div class="gallery-flip-circle gallery-flip-circle--right"></div>' +
              '</div>' +
              '<div class="gallery-back-content">' +
                '<h3 class="gallery-item-title"></h3>' +
                '<time class="gallery-item-date"></time>' +
                '<p class="gallery-item-description"></p>' +
                '<div class="gallery-back-meta">' +
                  '<span class="gallery-item-addedby"></span>' +
                  '<span class="gallery-item-photocount"></span>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          /* Ön yüz — varsayılan görünen: fotoğraf */
          '<div class="gallery-flip-front">' +
            '<img class="gallery-img" src="" alt="" draggable="false" />' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function setCardPhoto(card, idx) {
    var p = photos[idx];
    if (!p) return;
    card.img.src             = p.url;
    card.img.alt             = p.title;
    card.titleEl.textContent = p.title;
    card.dateEl.textContent  = p.date ? formatDate(p.date) : '';
    if (card.descEl)       card.descEl.textContent       = p.description || '';
    if (card.addedByEl)    card.addedByEl.textContent    = p.addedBy ? '📸 ' + p.addedBy : '';
    if (card.photoCountEl) card.photoCountEl.textContent = p.photoCount > 1 ? p.photoCount + ' fotoğraf' : '';
  }

  function setPosClass(card, cls) {
    ALL_POS_CLASSES.forEach(function (c) { card.el.classList.remove(c); });
    card.el.classList.add(cls);
  }

  /* Kartı animasyonsuz ışınlar (geçiş kapalı → sınıf → reflow → geçiş açık) */
  function teleport(card, cls) {
    card.el.classList.add('gallery-stack-card--instant');
    setPosClass(card, cls);
    void card.el.offsetWidth;
    card.el.classList.remove('gallery-stack-card--instant');
  }

  function applyPositions() {
    if (stackOrder.length === 1) {
      setPosClass(stackOrder[0], 'gallery-stack-card--center');
      return;
    }
    stackOrder.forEach(function (card, pos) {
      setPosClass(card, POS_CLASSES[pos]);
    });
  }

  function handleCardClick(card) {
    if (justDragged || isTransition) return;
    if (stackOrder.length === 1) {
      if (stackOrder[0] === card) openLightbox();
      return;
    }
    var pos = stackOrder.indexOf(card);
    if (pos === 0)      prevPhoto();
    else if (pos === 1) openLightbox();
    else if (pos === 2) nextPhoto();
    /* pos === -1 → sahne dışındaki yedek kart, yok say */
  }

  function render() {
    var stage = document.getElementById('galleryStage');
    if (!stage) return;

    if (!photos.length) {
      stage.innerHTML = '<div class="gallery-empty">Henüz anı fotoğrafı yok 📸</div>';
      stackOrder = [];
      spareCard  = null;
      elDots     = null;
      return;
    }

    if (currentIdx >= photos.length) currentIdx = 0;

    var total = photos.length;
    /* 3 görünür kart + 1 sahne dışı yedek; tek fotoğrafta sadece orta kart */
    var count = total > 1 ? 4 : 1;
    var cardsHtml = '';
    for (var i = 0; i < count; i++) cardsHtml += cardHtml();

    stage.innerHTML =
      '<div class="gallery-stack-wrapper" id="glrStack">' + cardsHtml + '</div>' +
      '<div class="gallery-dots" id="glrDots"></div>';

    var wrapper = document.getElementById('glrStack');
    elDots = document.getElementById('glrDots');

    stackOrder = [];
    spareCard  = null;

    wrapper.querySelectorAll('.gallery-stack-card').forEach(function (el, pos) {
      var card = {
        el:           el,
        img:          el.querySelector('.gallery-img'),
        titleEl:      el.querySelector('.gallery-item-title'),
        dateEl:       el.querySelector('.gallery-item-date'),
        descEl:       el.querySelector('.gallery-item-description'),
        addedByEl:    el.querySelector('.gallery-item-addedby'),
        photoCountEl: el.querySelector('.gallery-item-photocount')
      };

      if (pos < 3) {
        /* pos 0 → sol (idx-1), pos 1 → orta (idx), pos 2 → sağ (idx+1) */
        setCardPhoto(card, (currentIdx + pos - 1 + total) % total);
        stackOrder.push(card);
      } else {
        setCardPhoto(card, (currentIdx + 2) % total);
        setPosClass(card, 'gallery-stack-card--exit-right');
        spareCard = card;
      }

      el.addEventListener('click', function () { handleCardClick(card); });
    });

    applyPositions();
    bindSwipe(wrapper);
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

  /* İleri: sol kart sola uçar, yedek kart yeni fotoğrafla sağdan girer */
  function stepNext() {
    if (isTransition || photos.length < 2) return;
    isTransition = true;

    var total  = photos.length;
    currentIdx = (currentIdx + 1) % total;

    /* Yedek kartı sağ dışına ışınla, yeni sağ fotoğrafı ver */
    var entering = spareCard;
    setCardPhoto(entering, (currentIdx + 1) % total);
    teleport(entering, 'gallery-stack-card--exit-right');

    var exiting = stackOrder.shift();    /* eski sol */
    stackOrder.push(entering);
    spareCard = exiting;

    setPosClass(exiting, 'gallery-stack-card--exit-left');
    applyPositions();
    renderDots();

    setTimeout(function () { isTransition = false; }, TRANS_MS);
  }

  /* Geri: sağ kart sağa uçar, yedek kart yeni fotoğrafla soldan girer */
  function stepPrev() {
    if (isTransition || photos.length < 2) return;
    isTransition = true;

    var total  = photos.length;
    currentIdx = (currentIdx - 1 + total) % total;

    /* Yedek kartı sol dışına ışınla, yeni sol fotoğrafı ver */
    var entering = spareCard;
    setCardPhoto(entering, (currentIdx - 1 + total) % total);
    teleport(entering, 'gallery-stack-card--exit-left');

    var exiting = stackOrder.pop();      /* eski sağ */
    stackOrder.unshift(entering);
    spareCard = exiting;

    setPosClass(exiting, 'gallery-stack-card--exit-right');
    applyPositions();
    renderDots();

    setTimeout(function () { isTransition = false; }, TRANS_MS);
  }

  /* Dot tıklaması: komşu indekse adım, uzak indekse fade ile sıçrama */
  function navigateTo(idx) {
    if (isTransition || !photos.length) return;
    var total = photos.length;
    idx = ((idx % total) + total) % total;
    if (idx === currentIdx) return;

    if (idx === (currentIdx + 1) % total)         return stepNext();
    if (idx === (currentIdx - 1 + total) % total) return stepPrev();

    isTransition = true;
    currentIdx   = idx;

    stackOrder.forEach(function (c) { c.img.classList.add('gallery-img--fading'); });
    setTimeout(function () {
      stackOrder.forEach(function (c, pos) {
        setCardPhoto(c, (currentIdx + pos - 1 + total) % total);
        c.img.classList.remove('gallery-img--fading');
      });
      renderDots();
      isTransition = false;
    }, 250);
  }

  function prevPhoto() { stepPrev(); }
  function nextPhoto() { stepNext(); }

  /* ── Sürükleme / swipe ────────────────────────────── */

  function bindSwipe(wrapper) {
    if (photos.length < 2) return;

    wrapper.addEventListener('pointerdown', function (e) {
      if (isTransition) return;
      dragX0 = e.clientX;
      dragDX = 0;
      try { wrapper.setPointerCapture(e.pointerId); } catch (err) {}
    });

    wrapper.addEventListener('pointermove', function (e) {
      if (dragX0 === null) return;
      dragDX = e.clientX - dragX0;
      if (Math.abs(dragDX) > 6) {
        var center = stackOrder[1];
        center.el.classList.add('gallery-stack-card--dragging');
        center.el.style.transform =
          'translateX(' + (dragDX * 0.85) + 'px) rotateY(' + (-dragDX * 0.04) + 'deg)';
      }
    });

    function endDrag() {
      if (dragX0 === null) return;
      var dx = dragDX;
      dragX0 = null;
      dragDX = 0;

      var center = stackOrder[1];
      center.el.classList.remove('gallery-stack-card--dragging');
      center.el.style.transform = '';

      if (Math.abs(dx) > 6) {
        /* Sürükleme sonrası click yan kart navigasyonunu / lightbox'ı tetiklemesin */
        justDragged = true;
        setTimeout(function () { justDragged = false; }, 0);
      }

      if (dx <= -SWIPE_MIN)     nextPhoto();
      else if (dx >= SWIPE_MIN) prevPhoto();
    }

    wrapper.addEventListener('pointerup',     endDrag);
    wrapper.addEventListener('pointercancel', endDrag);
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
