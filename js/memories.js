/**
 * memories.js — Anı kartları, modal, lightbox, mini-harita.
 *
 * escapeHtml, escapeAttr, formatDate, storage, setButtonLoading,
 * uploadPhoto, supabaseClient → utils.js'deki global yardımcılar.
 */
const memories = (function () {

  const STORAGE_KEY = 'love_memories';
  const HOME_LIMIT  = 15;

  let cards      = [];
  let editingId  = null;

  /* Realtime çift-render koruması */
  let _lastSaveMs = 0;
  const REALTIME_GRACE = 3000;

  /* Lightbox durumu */
  let lbPhotos = [];
  let lbIndex  = 0;

  /* Mini-harita durumu */
  let miniMap               = null;
  let miniMapMarker         = null;
  let pendingLocationCoords = null;

  /* Tüm Anılar modal durumu */
  let _allMemoriesOpen = false;

  /* ── Persistence ─────────────────────────────────── */

  async function loadCards() {
    const parsed = await storage.get(STORAGE_KEY, []);
    cards = parsed.map(c => ({
      id:         c.id,
      title:      c.title,
      date:       c.date,
      photos:     c.photos || (c.photo ? [c.photo] : []),
      locationId: c.locationId || null,
      addedBy:    c.addedBy   || '',
    }));
  }

  async function saveCards() {
    _lastSaveMs = Date.now();
    const ok = await storage.set(STORAGE_KEY, cards);
    if (!ok) showToast('Kayıt başarısız. Lütfen tekrar dene.', 'error');
    return ok;
  }

  /* ── Dosya okuma + Storage upload ─────────────────── */

  async function readAndUploadFiles(files) {
    const dataUrls = await Promise.all(
      Array.from(files).map(f => new Promise(resolve => {
        const reader = new FileReader();
        reader.onload  = ev => compressImage(ev.target.result).then(resolve);
        reader.onerror = ()  => resolve(null);
        reader.readAsDataURL(f);
      }))
    );
    return Promise.all(
      dataUrls.filter(Boolean).map(url => uploadPhoto(url))
    );
  }

  /* ── Kart elementi ───────────────────────────────── */

  function createCardEl(card) {
    const el = document.createElement('article');
    el.className  = 'memory-card';
    el.dataset.id = card.id;
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', card.title || 'Anı');

    const firstPhoto = card.photos.length ? card.photos[0] : '';
    const photoHtml  = firstPhoto
      ? `<img class="memory-card-photo" src="${firstPhoto}"
               alt="${escapeAttr(card.title)}" loading="lazy" />`
      : `<div class="memory-card-photo-placeholder" aria-hidden="true">📷</div>`;

    const countBadge = card.photos.length > 1
      ? `<span class="memory-photo-count">📷 ${card.photos.length}</span>`
      : '';

    const locBadge = card.locationId
      ? `<span class="memory-location-badge" title="Haritada konumu var">📍</span>`
      : '';

    const addedByHtml = card.addedBy
      ? `<span class="card-added-by">by *${escapeHtml(card.addedBy)}</span>`
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
        ${addedByHtml}
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
    const grid = document.getElementById('memoriesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const footer = document.getElementById('memoriesFooter');

    if (!cards.length) {
      const empty = document.createElement('p');
      empty.className   = 'memories-empty';
      empty.textContent = 'Henüz anı yok — ilk anını ekle!';
      grid.appendChild(empty);
      if (footer) footer.hidden = true;
      return;
    }

    const preview = cards.slice(0, HOME_LIMIT);
    const frag = document.createDocumentFragment();
    preview.forEach(c => frag.appendChild(createCardEl(c)));
    grid.appendChild(frag);

    if (footer) footer.hidden = cards.length <= HOME_LIMIT;

    if (_allMemoriesOpen) renderAllMemoriesGrid();
  }

  function renderAllMemoriesGrid() {
    const grid = document.getElementById('allMemoriesGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const frag = document.createDocumentFragment();
    cards.forEach(c => frag.appendChild(createCardEl(c)));
    grid.appendChild(frag);
  }

  /* ── Delete ──────────────────────────────────────── */

  async function deleteCard(id) {
    if (!confirm('Bu anıyı silmek istediğine emin misin?')) return;
    await deleteById(id);
    showToast('Anı silindi.', 'info');
  }

  async function deleteById(id) {
    removeLinkedLocation(id);
    cards = cards.filter(c => c.id !== id);
    await saveCards();
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
    prevBtn.style.display = multi ? '' : 'none';
    nextBtn.style.display = multi ? '' : 'none';
    counter.style.display = multi ? '' : 'none';
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

  /* ── Tüm Anılar Modal ────────────────────────────── */

  function openAllMemoriesModal() {
    _allMemoriesOpen = true;
    renderAllMemoriesGrid();
    document.getElementById('allMemoriesModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('closeAllMemories').focus();
  }

  function closeAllMemoriesModal() {
    _allMemoriesOpen = false;
    document.getElementById('allMemoriesModal').classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ── Mini-harita ─────────────────────────────────── */

  function initMiniMap() {
    if (typeof L === 'undefined') return;

    const container = document.getElementById('memoryMiniMap');
    if (!container) return;

    if (miniMap) {
      setTimeout(() => miniMap.invalidateSize(), 80);
      return;
    }

    miniMap = L.map('memoryMiniMap', { center: [39.9334, 32.8597], zoom: 5 });
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

  /* ── Modal yardımcıları ──────────────────────────── */

  function hideLocationFields() {
    const fields = document.getElementById('locationExtraFields');
    if (fields) fields.classList.remove('visible');
    const cb = document.getElementById('memoryAddLocation');
    if (cb) cb.checked = false;
  }

  function resetModal() {
    document.getElementById('memoryForm').reset();
    hideLocationFields();
    resetMiniMap();
    document.body.style.overflow = '';
  }

  /* ── Add / Edit modal ────────────────────────────── */

  let pendingPhoto    = null;
  let onSavedCallback = null;

  function openAddModal() {
    editingId       = null;
    pendingPhoto    = null;
    onSavedCallback = null;
    document.getElementById('modalTitle').textContent = 'Anı Ekle';
    resetModal();
    document.getElementById('addMemoryModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('memoryTitle').focus();
  }

  function openWithData(title, onSaved) {
    editingId       = null;
    pendingPhoto    = null;
    onSavedCallback = onSaved || null;
    document.getElementById('modalTitle').textContent = 'Anı Ekle';
    resetModal();
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
    resetModal();
    editingId       = null;
    pendingPhoto    = null;
    onSavedCallback = null;
  }

  /* ── Form gönderimi ──────────────────────────────── */

  async function persistNewCard(title, dateVal, newPhotos, addLoc, locName, locCoords) {
    const newId      = Date.now();
    const currentUser = (typeof auth !== 'undefined') ? auth.getUser() : null;
    const newCard = { id: newId, title, date: dateVal, photos: newPhotos, locationId: null, addedBy: currentUser ? currentUser.username : '' };
    cards.unshift(newCard);
    await saveCards();
    renderCards();

    if (addLoc && locCoords && typeof mapModule !== 'undefined') {
      try {
        const locId = await mapModule.addLocation({
          id:       Date.now() + 1,
          name:     locName || title,
          lat:      locCoords.lat,
          lng:      locCoords.lng,
          date:     dateVal,
          note:     '',
          memoryId: newId
        });
        cards = cards.map(c => c.id === newId ? { ...c, locationId: locId } : c);
        await saveCards();
      } catch (_) {}
    }

    return newId;
  }

  async function persistEditCard(title, dateVal, newPhotos) {
    cards = cards.map(c => {
      if (c.id !== editingId) return c;
      return {
        ...c,
        title,
        date:   dateVal,
        photos: newPhotos.length ? [...c.photos, ...newPhotos] : c.photos,
      };
    });
    await saveCards();
    renderCards();
  }

  function handleFormSubmit(e) {
    e.preventDefault();

    const title     = document.getElementById('memoryTitle').value.trim();
    const dateVal   = document.getElementById('memoryDate').value;
    const fileInput = document.getElementById('memoryPhoto');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    const addLoc    = document.getElementById('memoryAddLocation').checked;
    const locName   = document.getElementById('memoryLocationName').value.trim();
    const locCoords = pendingLocationCoords ? { ...pendingLocationCoords } : null;

    if (!title) { document.getElementById('memoryTitle').focus(); return; }

    const done = async (newPhotos) => {
      if (editingId !== null) {
        await persistEditCard(title, dateVal, newPhotos);
        setButtonLoading(submitBtn, false);
        closeAddModal();
        showToast('Anı güncellendi ♥', 'success');
      } else {
        const newId = await persistNewCard(title, dateVal, newPhotos, addLoc, locName, locCoords);
        const cb    = onSavedCallback;
        setButtonLoading(submitBtn, false);
        closeAddModal();
        showToast('Anı eklendi ♥', 'success');
        if (cb) cb(newId);
      }
    };

    setButtonLoading(submitBtn, true);

    if (fileInput.files.length) {
      readAndUploadFiles(fileInput.files).then(done);
    } else if (pendingPhoto) {
      done([pendingPhoto]);
    } else {
      done([]);
    }
  }

  /* ── Harita bağlantısı ───────────────────────────── */

  async function linkLocation(memoryId, locationId) {
    cards = cards.map(c => c.id === memoryId ? { ...c, locationId } : c);
    await saveCards();
    renderCards();
  }

  /* ── Realtime ────────────────────────────────────── */

  function subscribeRealtime() {
    supabaseClient.channel('memories-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memories' },
        async () => {
          if (Date.now() - _lastSaveMs < REALTIME_GRACE) return;
          await loadCards();
          renderCards();
        })
      .subscribe();
  }

  /* ── Init ────────────────────────────────────────── */

  async function init() {
    if (!document.getElementById('btnAddMemory')) return;

    await loadCards();
    renderCards();
    subscribeRealtime();

    document.getElementById('btnAddMemory').addEventListener('click', openAddModal);
    document.getElementById('closeAddMemory').addEventListener('click', closeAddModal);
    document.getElementById('memoryForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
    document.getElementById('lightboxPrev').addEventListener('click', lbPrev);
    document.getElementById('lightboxNext').addEventListener('click', lbNext);

    document.getElementById('btnAllMemories').addEventListener('click', openAllMemoriesModal);
    document.getElementById('closeAllMemories').addEventListener('click', closeAllMemoriesModal);

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

    const lbOverlay      = document.getElementById('lightboxOverlay');
    const addOverlay     = document.getElementById('addMemoryModal');
    const allMemOverlay  = document.getElementById('allMemoriesModal');

    lbOverlay.addEventListener('click',     e => { if (e.target === lbOverlay)     closeLightbox();        });
    addOverlay.addEventListener('click',    e => { if (e.target === addOverlay)    closeAddModal();        });
    allMemOverlay.addEventListener('click', e => { if (e.target === allMemOverlay) closeAllMemoriesModal(); });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape')     { closeLightbox(); closeAddModal(); closeAllMemoriesModal(); }
      if (e.key === 'ArrowLeft')  lbPrev();
      if (e.key === 'ArrowRight') lbNext();
    });
  }

  function openEditById(id) {
    const card = cards.find(c => c.id === id);
    if (card) openEditModal(card);
  }

  function getCards() { return cards; }

  return { init, openWithData, deleteById, linkLocation, openEditById, getCards };

})();
