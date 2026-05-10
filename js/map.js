/**
 * map.js — "Bize Özel Haritamız" section
 *
 * Manages an interactive Leaflet map where the couple can pin
 * locations they've visited or want to visit together.
 * Locations are persisted in localStorage.
 *
 * Public API: mapModule.init()
 *             mapModule.addLocation(data)  → id
 *             mapModule.deleteLocation(id)
 */
const mapModule = (function () {

  const STORAGE_KEY = 'love_map_locations';
  let locations = [];
  let map = null;
  let leafletMarkers = {};   // id → L.Marker
  let isPickingMode = false;
  let pendingLatlng  = null;
  let lastAddedLoc   = null; // location waiting for memory-confirm answer

  /* ── Persistence ─────────────────────────────────── */

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      locations = raw ? JSON.parse(raw) : [];
    } catch (_) {
      locations = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
    } catch (_) {
      alert('Depolama alanı dolmak üzere.');
    }
  }

  /* ── Helpers ─────────────────────────────────────── */

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  /* ── Heart icon ───────────────────────────────────── */

  function heartIcon() {
    return L.divIcon({
      className: '',
      html: '<div class="map-heart-marker">❤</div>',
      iconSize:   [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -32]
    });
  }

  /* ── Popup HTML ───────────────────────────────────── */

  function buildPopup(loc) {
    let html = '<div class="map-popup">';
    if (loc.photoUrl) {
      html += `<img class="map-popup-photo" src="${escHtml(loc.photoUrl)}"
                    alt="${escHtml(loc.name)}" loading="lazy" />`;
    }
    html += `<div class="map-popup-body">`;
    html += `<h4 class="map-popup-name">${escHtml(loc.name)}</h4>`;
    if (loc.date) {
      html += `<p class="map-popup-date">${escHtml(fmtDate(loc.date))}</p>`;
    }
    if (loc.note) {
      html += `<p class="map-popup-note">${escHtml(loc.note)}</p>`;
    }
    html += `<div class="map-popup-actions">
               <button class="map-popup-delete" data-id="${loc.id}">🗑 Sil</button>
             </div>`;
    html += '</div></div>';
    return html;
  }

  /* ── Marker management ────────────────────────────── */

  function addMarkerToMap(loc) {
    if (!map) return;
    const marker = L.marker([loc.lat, loc.lng], { icon: heartIcon() })
      .addTo(map)
      .bindPopup(buildPopup(loc), { maxWidth: 270, minWidth: 200 });

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

  /* ── Map initialisation ───────────────────────────── */

  function initMap() {
    const el = document.getElementById('mainLeafletMap');
    if (!el || !window.L) return;

    map = L.map('mainLeafletMap', {
      center: [39.9334, 32.8597],
      zoom: 6,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
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
      try { map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 }); } catch (_) {}
    }
  }

  /* ── Picking mode ─────────────────────────────────── */

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

  /* ── Marker modal ─────────────────────────────────── */

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
        `📍 Konum seçildi: ${pendingLatlng.lat.toFixed(4)}, ${pendingLatlng.lng.toFixed(4)}`;
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
      alert('Lütfen önce haritada bir konum seçin (+ Konum Ekle butonuna tıklayın).');
      return;
    }

    const fileInput = document.getElementById('markerPhoto');
    const date      = document.getElementById('markerDate').value;
    const note      = document.getElementById('markerNote').value.trim();
    const latlng    = { ...pendingLatlng };

    const persist = (photoDataUrl) => {
      const loc = {
        id:       Date.now(),
        name,
        lat:      latlng.lat,
        lng:      latlng.lng,
        date,
        photoUrl: photoDataUrl || '',
        note,
        memoryId: null
      };
      lastAddedLoc = loc;
      addLocationInternal(loc);
      closeMarkerModal();
      openMapMemoryConfirm();
    };

    if (fileInput && fileInput.files.length) {
      const reader = new FileReader();
      reader.onload = ev => {
        compressImage(ev.target.result, 1200, 0.80).then(persist);
      };
      reader.readAsDataURL(fileInput.files[0]);
    } else {
      persist('');
    }
  }

  /* ── Map → Memory confirm modal ───────────────────── */

  function openMapMemoryConfirm() {
    document.getElementById('mapMemoryConfirmModal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeMapMemoryConfirm() {
    document.getElementById('mapMemoryConfirmModal').classList.remove('open');
    document.body.style.overflow = '';
  }

  function handleMapMemoryConfirmYes() {
    const loc = lastAddedLoc;
    lastAddedLoc = null;
    closeMapMemoryConfirm();
    if (!loc) return;

    memories.openWithData(loc.name, function (newMemoryId) {
      // Link memory → location (update locationId on memory card)
      memories.linkLocation(newMemoryId, loc.id);
      // Link location → memory
      locations = locations.map(l =>
        l.id === loc.id ? { ...l, memoryId: newMemoryId } : l
      );
      save();
    });
  }

  function handleMapMemoryConfirmNo() {
    lastAddedLoc = null;
    closeMapMemoryConfirm();
  }

  /* ── Location CRUD ────────────────────────────────── */

  function addLocationInternal(loc) {
    locations.push(loc);
    save();
    addMarkerToMap(loc);
  }

  function addLocation(data) {
    const id  = data.id || Date.now();
    const loc = { ...data, id };
    addLocationInternal(loc);
    if (map) map.setView([loc.lat, loc.lng], Math.max(map.getZoom(), 10));
    return id;
  }

  function deleteLocation(id) {
    locations = locations.filter(l => l.id !== id);
    save();
    if (leafletMarkers[id] && map) {
      map.closePopup();
      map.removeLayer(leafletMarkers[id]);
      delete leafletMarkers[id];
    }
  }

  /* ── Init ────────────────────────────────────────── */

  function init() {
    if (!document.getElementById('mainLeafletMap')) return;

    load();
    initMap();

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
