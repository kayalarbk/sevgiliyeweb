/**
 * map.js — "Bize Özel Haritamız" section
 *
 * Manages an interactive Leaflet map where the couple can pin locations.
 * Locations are persisted in Supabase (app_settings key: love_map_locations).
 *
 * Public API: mapModule.init()
 *             mapModule.addLocation(data)  → id
 *             mapModule.deleteLocation(id)
 */
const mapModule = (function () {

  const STORAGE_KEY        = 'love_map_locations';
  const DEFAULT_CENTER     = [39.9334, 32.8597];
  const DEFAULT_ZOOM       = 6;
  const MAX_ZOOM           = 19;
  const FIT_PADDING        = [40, 40];
  const FIT_MAX_ZOOM       = 12;
  const MIN_VIEW_ZOOM      = 10;
  const MARKER_SIZE        = 28;
  const MARKER_ANCHOR      = 14;
  const POPUP_ANCHOR_Y     = -32;
  const POPUP_MAX_WIDTH    = 270;
  const POPUP_MIN_WIDTH    = 200;
  const PHOTO_COMPRESS_PX  = 1200;
  const PHOTO_COMPRESS_Q   = 0.80;
  const COORDS_DECIMALS    = 4;

  let locations      = [];
  let map            = null;
  let leafletMarkers = {};
  let isPickingMode  = false;
  let pendingLatlng  = null;
  let lastAddedLoc   = null;

  /* Realtime çift-render koruması */
  let _lastSaveMs = 0;
  const REALTIME_GRACE = 3000;

  /* ── Persistence ─────────────────────────────────── */

  async function load() {
    locations = await storage.get(STORAGE_KEY, []);
  }

  async function save() {
    _lastSaveMs = Date.now();
    const ok = await storage.set(STORAGE_KEY, locations);
    if (!ok) showToast('Konum kaydedilemedi.', 'error');
    return ok;
  }

  /* ── Heart icon ──────────────────────────────────── */

  function heartIcon() {
    return L.divIcon({
      className:   '',
      html:        '<div class="map-heart-marker">❤</div>',
      iconSize:    [MARKER_SIZE, MARKER_SIZE],
      iconAnchor:  [MARKER_ANCHOR, MARKER_SIZE],
      popupAnchor: [0, POPUP_ANCHOR_Y]
    });
  }

  /* ── Popup HTML ──────────────────────────────────── */

  function buildPopup(loc) {
    let html = '<div class="map-popup">';
    if (loc.photoUrl) {
      html += `<img class="map-popup-photo" src="${escapeHtml(loc.photoUrl)}"
                    alt="${escapeAttr(loc.name)}" loading="lazy" />`;
    }
    html += '<div class="map-popup-body">';
    html += `<h4 class="map-popup-name">${escapeHtml(loc.name)}</h4>`;
    if (loc.date) {
      html += `<p class="map-popup-date">${escapeHtml(formatDate(loc.date))}</p>`;
    }
    if (loc.note) {
      html += `<p class="map-popup-note">${escapeHtml(loc.note)}</p>`;
    }
    html += `<div class="map-popup-actions">
               <button class="map-popup-delete" data-id="${loc.id}">🗑 Sil</button>
             </div>`;
    html += '</div></div>';
    return html;
  }

  /* ── Marker management ───────────────────────────── */

  function addMarkerToMap(loc) {
    if (!map) return;
    const marker = L.marker([loc.lat, loc.lng], { icon: heartIcon() })
      .addTo(map)
      .bindPopup(buildPopup(loc), { maxWidth: POPUP_MAX_WIDTH, minWidth: POPUP_MIN_WIDTH });

    marker.on('popupopen', function () {
      const btn = document.querySelector(`.map-popup-delete[data-id="${loc.id}"]`);
      if (btn) btn.addEventListener('click', () => deleteLocation(loc.id));
    });

    leafletMarkers[loc.id] = marker;
  }

  function renderMarkers() {
    Object.values(leafletMarkers).forEach(m => { if (map) map.removeLayer(m); });
    leafletMarkers = {};
    locations.forEach(loc => addMarkerToMap(loc));
  }

  /* ── Map initialisation ──────────────────────────── */

  function initMap() {
    const el = document.getElementById('mainLeafletMap');
    if (!el || !window.L) return;

    map = L.map('mainLeafletMap', {
      center: DEFAULT_CENTER,
      zoom:   DEFAULT_ZOOM,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: MAX_ZOOM
    }).addTo(map);

    map.on('click', function (e) {
      if (!isPickingMode) return;
      pendingLatlng = e.latlng;
      exitPickingMode();
      openMarkerModal();
    });

    renderMarkers();

    if (locations.length > 0) {
      const bounds = locations.map(l => [l.lat, l.lng]);
      try { map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM }); } catch (_) {}
    }
  }

  /* ── Picking mode ────────────────────────────────── */

  function enterPickingMode() {
    isPickingMode = true;
    const hint  = document.getElementById('mapPickHint');
    const mapEl = document.getElementById('mainLeafletMap');
    if (hint)  hint.classList.add('active');
    if (mapEl) mapEl.classList.add('picking');
    document.getElementById('mapSection').scrollIntoView({ behavior: 'smooth' });
  }

  function exitPickingMode() {
    isPickingMode = false;
    const hint  = document.getElementById('mapPickHint');
    const mapEl = document.getElementById('mainLeafletMap');
    if (hint)  hint.classList.remove('active');
    if (mapEl) mapEl.classList.remove('picking');
  }

  /* ── Marker modal ────────────────────────────────── */

  function openMarkerModal() {
    document.getElementById('markerForm').reset();
    updateCoordsHint();
    document.getElementById('addMarkerModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('markerName').focus();
  }

  function closeMarkerModal() {
    document.getElementById('addMarkerModal').classList.remove('open');
    document.body.style.overflow = '';
    pendingLatlng = null;
    updateCoordsHint();
  }

  function updateCoordsHint() {
    const hint = document.getElementById('markerCoordsHint');
    if (!hint) return;
    if (pendingLatlng) {
      hint.textContent =
        `📍 Konum seçildi: ${pendingLatlng.lat.toFixed(COORDS_DECIMALS)}, ${pendingLatlng.lng.toFixed(COORDS_DECIMALS)}`;
      hint.classList.add('selected');
    } else {
      hint.textContent = 'Henüz konum seçilmedi';
      hint.classList.remove('selected');
    }
  }

  function handleMarkerSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('markerName').value.trim();
    if (!name) { document.getElementById('markerName').focus(); return; }
    if (!pendingLatlng) {
      showToast('Lütfen önce haritada bir konum seçin.', 'info');
      return;
    }

    const fileInput = document.getElementById('markerPhoto');
    const date      = document.getElementById('markerDate').value;
    const note      = document.getElementById('markerNote').value.trim();
    const latlng    = { ...pendingLatlng };
    const submitBtn = e.target.querySelector('button[type="submit"]');

    const persist = async (photoUrl) => {
      const loc = {
        id:       Date.now(),
        name,
        lat:      latlng.lat,
        lng:      latlng.lng,
        date,
        photoUrl: photoUrl || '',
        note,
        memoryId: null
      };
      lastAddedLoc = loc;
      await addLocationInternal(loc);
      setButtonLoading(submitBtn, false);
      closeMarkerModal();
      showToast('Konum eklendi 📍', 'success');
      openMapMemoryConfirm();
    };

    if (fileInput && fileInput.files.length) {
      setButtonLoading(submitBtn, true);
      const reader = new FileReader();
      reader.onload = ev => {
        compressImage(ev.target.result, PHOTO_COMPRESS_PX, PHOTO_COMPRESS_Q)
          .then(dataUrl => uploadPhoto(dataUrl))
          .then(persist);
      };
      reader.readAsDataURL(fileInput.files[0]);
    } else {
      persist('');
    }
  }

  /* ── Map → Memory confirm modal ──────────────────── */

  function openMapMemoryConfirm() {
    document.getElementById('mapMemoryConfirmModal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeMapMemoryConfirm() {
    document.getElementById('mapMemoryConfirmModal').classList.remove('open');
    document.body.style.overflow = '';
  }

  async function handleMapMemoryConfirmYes() {
    const loc = lastAddedLoc;
    lastAddedLoc = null;
    closeMapMemoryConfirm();
    if (!loc) return;

    memories.openWithData(loc.name, async function (newMemoryId) {
      await memories.linkLocation(newMemoryId, loc.id);
      locations = locations.map(l =>
        l.id === loc.id ? { ...l, memoryId: newMemoryId } : l
      );
      await save();
    });
  }

  function handleMapMemoryConfirmNo() {
    lastAddedLoc = null;
    closeMapMemoryConfirm();
  }

  /* ── Location CRUD ───────────────────────────────── */

  async function addLocationInternal(loc) {
    locations.push(loc);
    await save();
    addMarkerToMap(loc);
  }

  async function addLocation(data) {
    const id  = data.id || Date.now();
    const loc = { ...data, id };
    await addLocationInternal(loc);
    if (map) map.setView([loc.lat, loc.lng], Math.max(map.getZoom(), MIN_VIEW_ZOOM));
    return id;
  }

  async function deleteLocation(id) {
    locations = locations.filter(l => l.id !== id);
    await save();
    if (leafletMarkers[id] && map) {
      map.closePopup();
      map.removeLayer(leafletMarkers[id]);
      delete leafletMarkers[id];
    }
  }

  /* ── Realtime ────────────────────────────────────── */

  function subscribeRealtime() {
    supabaseClient.channel('map-locations-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'app_settings',
        filter: 'key=eq.' + STORAGE_KEY
      }, async () => {
        if (Date.now() - _lastSaveMs < REALTIME_GRACE) return;
        await load();
        renderMarkers();
      })
      .subscribe();
  }

  /* ── Init ────────────────────────────────────────── */

  async function init() {
    if (!document.getElementById('mainLeafletMap')) return;

    await load();
    initMap();
    subscribeRealtime();

    document.getElementById('btnAddMarker').addEventListener('click', () => {
      if (isPickingMode) { exitPickingMode(); return; }
      enterPickingMode();
    });

    document.getElementById('closeMarkerModal').addEventListener('click', closeMarkerModal);
    document.getElementById('markerForm').addEventListener('submit', handleMarkerSubmit);
    document.getElementById('mapMemoryConfirmYes').addEventListener('click', handleMapMemoryConfirmYes);
    document.getElementById('mapMemoryConfirmNo').addEventListener('click', handleMapMemoryConfirmNo);

    const markerOverlay  = document.getElementById('addMarkerModal');
    const confirmOverlay = document.getElementById('mapMemoryConfirmModal');
    markerOverlay.addEventListener('click',  e => { if (e.target === markerOverlay)  closeMarkerModal(); });
    confirmOverlay.addEventListener('click', e => { if (e.target === confirmOverlay) handleMapMemoryConfirmNo(); });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        exitPickingMode();
        closeMarkerModal();
        closeMapMemoryConfirm();
      }
    });
  }

  return { init, addLocation, deleteLocation };

})();
