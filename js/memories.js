/**
 * memories.js — Yatay kayan anı kartları, anı ekleme/düzenleme modali,
 *               lightbox ve harita konum entegrasyonu.
 */
const memories = (function () {

  const STORAGE_KEY = 'love_memories';
  let cards      = [];
  let editingId  = null;

  /* Lightbox state */
  let lbPhotos = [];
  let lbIndex  = 0;

  /* Mini-map state (location in memory modal) */
  let miniMap           = null;
  let miniMapMarker     = null;
  let pendingLocationCoords = null;

  /* ── Persistence ─────────────────────────────────── */

  function loadCards() {
    try {
      const raw    = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      cards = parsed.map(c => ({
        id:         c.id,
        title:      c.title,
        date:       c.date,
        photos:     c.photos || (c.photo ? [c.photo] : []),
        locationId: c.locationId || null,
      }));
    } catch (_) {
      cards = [];
    }
  }

  function saveCards() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    } catch (_) {
      alert('Depolama alanı dolmak üzere. Bazı anıları silmeyi dene.');
    }
  }

  /* ── Helpers ─────────────────────────────────────── */

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function readFiles(files) {
    return Promise.all(
      Array.from(files).map(f => new Promise(resolve => {
        const reader = new FileReader();
        reader.onload  = ev => compressImage(ev.target.result).then(resolve);
        reader.onerror = ()  => resolve(null);
        reader.readAsDataURL(f);
      }))
    ).then(results => results.filter(Boolean));
  }

  /* ── Card element ────────────────────────────────── */

  function createCardEl(card) {
    const el = document.createElement('article');
    el.className  = 'memory-card';
    el.dataset.id = card.id;
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', card.title || 'Anı');

    const firstPhoto = card.photos.length ? card.photos[0] : '';
    const photoHtml  = firstPhoto
      ? `<img class="memory-card-photo" src="${firstPhoto}" alt="${escapeAttr(card.title)}" loading="lazy" />`
      : `<div class="memory-card-photo-placeholder" aria-hidden="true">📷</div>`;

    const countBadge = card.photos.length > 1
      ? `<span class="memory-photo-count">📷 ${card.photos.length}</span>`
      : '';

    const locBadge = card.locationId
      ? `<span class="memory-location-badge" title="Haritada konumu var">📍</span>`
      : '';

    el.innerHTML = `
      <div class="memory-card-img-wrap">
        ${photoHtml}
        ${countBadge}
        ${locBadge}
        <div class="memory-card-actions">
          <button class="memory-action-btn btn-edit-card"   title="Düzenle" type="button">✏️</button>
          <button class="memory-action-btn btn-delete-card" title="Sil"     type="button">🗑️</button>
        </div>
      </div>
      <div class="memory-card-body">
        <h3 class="memory-card-title">${escapeHtml(card.title)}</h3>
        <time class="memory-card-date" datetime="${card.date || ''}">${formatDate(card.date)}</time>
      </div>`;

    el.addEventListener('click', e => {
      if (e.target.closest('.memory-card-actions')) return;
      openLightbox(card);
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(card); }
    });

    el.querySelector('.btn-edit-card').addEventListener('click', e => {
      e.stopPropagation();
      openEditModal(card);
    });
    el.querySelector('.btn-delete-card').addEventListener('click', e => {
      e.stopPropagation();
      deleteCard(card.id);
    });

    return el;
  }

  /* ── Rendering ───────────────────────────────────── */

  function renderCards() {
    const track = document.getElementById('memoriesTrack');
    if (!track) return;
    track.innerHTML = '';
    if (!cards.length) {
      const empty = document.createElement('p');
      empty.className   = 'memories-empty';
      empty.textContent = 'Henüz anı yok — ilk anını ekle!';
      track.appendChild(empty);
      return;
    }
    const frag = document.createDocumentFragment();
    cards.forEach(c => frag.appendChild(createCardEl(c)));
    track.appendChild(frag);
  }

  /* ── Delete ──────────────────────────────────────── */

  function deleteCard(id) {
    if (!confirm('Bu anıyı silmek istediğine emin misin?')) return;
    removeLinkedLocation(id);
    cards = cards.filter(c => c.id !== id);
    saveCards();
    renderCards();
  }

  function deleteById(id) {
    removeLinkedLocation(id);
    cards = cards.filter(c => c.id !== id);
    saveCards();
    renderCards();
  }

  function removeLinkedLocation(cardId) {
    const card = cards.find(c => c.id === cardId);
    if (card && card.locationId && typeof mapModule !== 'undefined') {
      try { mapModule.deleteLocation(card.locationId); } catch (_) {}
    }
  }

  /* ── Lightbox ────────────────────────────────────── */

  function openLightbox(card) {
    lbPhotos = card.photos.slice();
    lbIndex  = 0;

    document.getElementById('lightboxTitle').textContent = card.title || '';
    document.getElementById('lightboxDate').textContent  = formatDate(card.date);

    updateLightboxPhoto();

    document.getElementById('lightboxOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('lightboxClose').focus();
  }

  function updateLightboxPhoto() {
    const img     = document.getElementById('lightboxImg');
    const prevBtn = document.getElementById('lightboxPrev');
    const nextBtn = document.getElementById('lightboxNext');
    const counter = document.getElementById('lightboxCounter');

    if (lbPhotos.length) {
      img.src           = lbPhotos[lbIndex];
      img.style.display = '';
    } else {
      img.src           = '';
      img.style.display = 'none';
    }

    const multi = lbPhotos.length > 1;
    prevBtn.style.display  = multi ? '' : 'none';
    nextBtn.style.display  = multi ? '' : 'none';
    counter.style.display  = multi ? '' : 'none';
    if (multi) counter.textContent = `${lbIndex + 1} / ${lbPhotos.length}`;
  }

  function lbPrev() {
    if (lbPhotos.length < 2) return;
    lbIndex = (lbIndex - 1 + lbPhotos.length) % lbPhotos.length;
    updateLightboxPhoto();
  }

  function lbNext() {
    if (lbPhotos.length < 2) return;
    lbIndex = (lbIndex + 1) % lbPhotos.length;
    updateLightboxPhoto();
  }

  function closeLightbox() {
    document.getElementById('lightboxOverlay').classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ── Mini-map (location in memory modal) ─────────── */

  function initMiniMap() {
    if (typeof L === 'undefined') return;
    if (miniMap) {
      setTimeout(() => miniMap.invalidateSize(), 80);
      return;
    }
    miniMap = L.map('memoryMiniMap', {
      center: [39.9334, 32.8597],
      zoom: 5
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(miniMap);

    miniMap.on('click', function (e) {
      pendingLocationCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (miniMapMarker) {
        miniMapMarker.setLatLng(e.latlng);
      } else {
        miniMapMarker = L.marker(e.latlng).addTo(miniMap);
      }
    });
  }

  function resetMiniMap() {
    if (miniMapMarker) {
      miniMapMarker.remove();
      miniMapMarker = null;
    }
    pendingLocationCoords = null;
  }

  /* ── Add / Edit modal ────────────────────────────── */

  let pendingPhoto    = null;
  let onSavedCallback = null;

  function openAddModal() {
    editingId       = null;
    pendingPhoto    = null;
    onSavedCallback = null;
    document.getElementById('modalTitle').textContent = 'Anı Ekle';
    document.getElementById('memoryForm').reset();
    hideLocationFields();
    document.getElementById('addMemoryModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('memoryTitle').focus();
  }

  function openWithData(title, onSaved) {
    editingId       = null;
    pendingPhoto    = null;
    onSavedCallback = onSaved || null;
    document.getElementById('modalTitle').textContent = 'Anı Ekle';
    document.getElementById('memoryForm').reset();
    hideLocationFields();
    document.getElementById('memoryTitle').value = title || '';
    document.getElementById('addMemoryModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('memoryTitle').focus();
  }

  function openEditModal(card) {
    editingId = card.id;
    document.getElementById('modalTitle').textContent   = 'Anıyı Düzenle';
    document.getElementById('memoryTitle').value = card.title || '';
    document.getElementById('memoryDate').value  = card.date  || '';
    document.getElementById('memoryPhoto').value = '';
    hideLocationFields();
    document.getElementById('addMemoryModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('memoryTitle').focus();
  }

  function closeAddModal() {
    document.getElementById('addMemoryModal').classList.remove('open');
    document.getElementById('memoryForm').reset();
    hideLocationFields();
    resetMiniMap();
    document.body.style.overflow = '';
    editingId       = null;
    pendingPhoto    = null;
    onSavedCallback = null;
  }

  function hideLocationFields() {
    const fields = document.getElementById('locationExtraFields');
    if (fields) fields.classList.remove('visible');
    const cb = document.getElementById('memoryAddLocation');
    if (cb) cb.checked = false;
  }

  function handleFormSubmit(e) {
    e.preventDefault();

    const title       = document.getElementById('memoryTitle').value.trim();
    const dateVal     = document.getElementById('memoryDate').value;
    const fileInput   = document.getElementById('memoryPhoto');
    const addLoc      = document.getElementById('memoryAddLocation').checked;
    const locName     = document.getElementById('memoryLocationName').value.trim();
    const locCoords   = pendingLocationCoords ? { ...pendingLocationCoords } : null;

    if (!title) { document.getElementById('memoryTitle').focus(); return; }

    const persist = (newPhotos) => {
      if (editingId !== null) {
        cards = cards.map(c => {
          if (c.id !== editingId) return c;
          return {
            ...c,
            title,
            date:   dateVal,
            photos: newPhotos.length ? [...c.photos, ...newPhotos] : c.photos,
          };
        });
        saveCards();
        renderCards();
        closeAddModal();
      } else {
        const newId  = Date.now();
        const newCard = { id: newId, title, date: dateVal, photos: newPhotos, locationId: null };
        cards.unshift(newCard);
        saveCards();
        renderCards();

        /* Add linked map location if requested */
        if (addLoc && locCoords && typeof mapModule !== 'undefined') {
          try {
            const locId = mapModule.addLocation({
              id:       Date.now() + 1,
              name:     locName || title,
              lat:      locCoords.lat,
              lng:      locCoords.lng,
              date:     dateVal,
              note:     '',
              memoryId: newId
            });
            cards = cards.map(c => c.id === newId ? { ...c, locationId: locId } : c);
            saveCards();
          } catch (_) {}
        }

        const cb = onSavedCallback;
        closeAddModal();
        if (cb) cb(newId);
      }
    };

    if (fileInput.files.length) {
      readFiles(fileInput.files).then(persist);
    } else if (pendingPhoto) {
      persist([pendingPhoto]);
    } else {
      persist([]);
    }
  }

  /* ── Init ────────────────────────────────────────── */

  function init() {
    if (!document.getElementById('btnAddMemory')) return;

    loadCards();
    renderCards();

    document.getElementById('btnAddMemory').addEventListener('click', openAddModal);
    document.getElementById('closeAddMemory').addEventListener('click', closeAddModal);
    document.getElementById('memoryForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
    document.getElementById('lightboxPrev').addEventListener('click', lbPrev);
    document.getElementById('lightboxNext').addEventListener('click', lbNext);

    /* Location checkbox */
    const locCheckbox = document.getElementById('memoryAddLocation');
    const locFields   = document.getElementById('locationExtraFields');
    if (locCheckbox && locFields) {
      locCheckbox.addEventListener('change', function () {
        if (this.checked) {
          locFields.classList.add('visible');
          setTimeout(initMiniMap, 60);
        } else {
          locFields.classList.remove('visible');
          resetMiniMap();
        }
      });
    }

    /* Overlay / keyboard */
    const lbOverlay  = document.getElementById('lightboxOverlay');
    const addOverlay = document.getElementById('addMemoryModal');
    lbOverlay.addEventListener('click',  e => { if (e.target === lbOverlay)  closeLightbox();  });
    addOverlay.addEventListener('click', e => { if (e.target === addOverlay) closeAddModal(); });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape')      { closeLightbox(); closeAddModal(); }
      if (e.key === 'ArrowLeft')   lbPrev();
      if (e.key === 'ArrowRight')  lbNext();
    });
  }

  /* Called by map.js after memory is saved for a location */
  function linkLocation(memoryId, locationId) {
    cards = cards.map(c => c.id === memoryId ? { ...c, locationId } : c);
    saveCards();
    renderCards();
  }

  return { init, openWithData, deleteById, linkLocation };

})();
