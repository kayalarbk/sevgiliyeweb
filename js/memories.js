/**
 * memories.js — Photo memory card gallery.
 *
 * Cards are persisted in localStorage as JSON objects. Images are stored as
 * base64 data URLs via the FileReader API (no server required).
 *
 * ⚠ localStorage has a ~5 MB limit per origin. Large photos will approach
 *   this quickly; the module alerts the user when the quota is exceeded.
 *
 * Public API:  memories.init()
 */
const memories = (function () {

  const STORAGE_KEY = 'love_memories';

  /* ── State ───────────────────────────────────────── */
  let cards = [];  // [{ id, title, date, photo: base64|'' }]

  /* ── Persistence ─────────────────────────────────── */

  /** Loads the cards array from localStorage (gracefully handles corrupt data). */
  function loadCards() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      cards = raw ? JSON.parse(raw) : [];
    } catch (_) {
      cards = [];
    }
  }

  /** Serialises the cards array and writes it to localStorage. */
  function saveCards() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    } catch (_) {
      // Quota exceeded — notify rather than silently fail
      alert('Storage is almost full. Try deleting some memories to free space.');
    }
  }

  /* ── Formatting ──────────────────────────────────── */

  /**
   * Converts a "yyyy-mm-dd" string to a locale-formatted display date.
   * Returns an empty string for missing/invalid input.
   */
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  /* ── DOM construction ────────────────────────────── */

  /**
   * Creates and returns a fully-formed <article> card element for a memory.
   * Clicking or pressing Enter/Space opens the lightbox.
   */
  function createCardEl(card) {
    const el = document.createElement('article');
    el.className  = 'memory-card';
    el.dataset.id = card.id;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', card.title || 'Memory');

    const photoHtml = card.photo
      ? `<img class="memory-card-photo" src="${card.photo}" alt="${escapeAttr(card.title)}" loading="lazy" />`
      : `<div class="memory-card-photo-placeholder" aria-hidden="true">📷</div>`;

    el.innerHTML = `
      ${photoHtml}
      <div class="memory-card-body">
        <h3 class="memory-card-title">${escapeHtml(card.title)}</h3>
        <time class="memory-card-date" datetime="${card.date || ''}">${formatDate(card.date)}</time>
      </div>`;

    el.addEventListener('click', () => openLightbox(card));
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(card);
      }
    });

    return el;
  }

  /** Minimal HTML entity escaping for user-supplied strings rendered as text. */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Escaping for strings placed inside HTML attribute values. */
  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ── Rendering ───────────────────────────────────── */

  /** Rebuilds the entire card track from the current `cards` array. */
  function renderCards() {
    const track = document.getElementById('memoriesTrack');
    if (!track) return;

    track.innerHTML = '';

    if (!cards.length) {
      const empty = document.createElement('p');
      empty.className   = 'memories-empty';
      empty.textContent = 'No memories yet — add your first one!';
      track.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    cards.forEach(card => fragment.appendChild(createCardEl(card)));
    track.appendChild(fragment);
  }

  /* ── Lightbox ────────────────────────────────────── */

  /** Populates and opens the fullscreen lightbox for the given card. */
  function openLightbox(card) {
    const overlay = document.getElementById('lightboxOverlay');
    const img     = document.getElementById('lightboxImg');

    img.src           = card.photo || '';
    img.alt           = card.title || '';
    img.style.display = card.photo ? '' : 'none';

    document.getElementById('lightboxTitle').textContent = card.title || '';
    document.getElementById('lightboxDate').textContent  = formatDate(card.date);

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('lightboxClose').focus();
  }

  /** Closes the lightbox and restores body scrolling. */
  function closeLightbox() {
    document.getElementById('lightboxOverlay').classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ── Add-memory modal ────────────────────────────── */

  /** Opens the add-memory form modal. */
  function openAddModal() {
    document.getElementById('addMemoryModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('memoryTitle').focus();
  }

  /** Closes the add-memory modal and resets the form to a blank state. */
  function closeAddModal() {
    document.getElementById('addMemoryModal').classList.remove('open');
    document.getElementById('memoryForm').reset();
    document.body.style.overflow = '';
  }

  /**
   * Handles form submission.
   * If a photo file was selected it is read asynchronously via FileReader;
   * otherwise the card is saved immediately with an empty photo string.
   */
  function handleFormSubmit(e) {
    e.preventDefault();

    const title    = document.getElementById('memoryTitle').value.trim();
    const dateVal  = document.getElementById('memoryDate').value;
    const fileInput = document.getElementById('memoryPhoto');
    const file     = fileInput.files[0];

    if (!title) {
      document.getElementById('memoryTitle').focus();
      return;
    }

    const persist = (photoBase64) => {
      cards.unshift({ id: Date.now(), title, date: dateVal, photo: photoBase64 });
      saveCards();
      renderCards();
      closeAddModal();
    };

    if (file) {
      const reader = new FileReader();
      reader.onload  = ev => persist(ev.target.result);
      reader.onerror = ()  => persist('');   // fallback: save without photo
      reader.readAsDataURL(file);
    } else {
      persist('');
    }
  }

  /* ── Public init ─────────────────────────────────── */

  /**
   * Loads persisted cards, renders the track, and wires all event listeners.
   * Must be called after the DOM is ready.
   */
  function init() {
    const btnAdd     = document.getElementById('btnAddMemory');
    const closeAdd   = document.getElementById('closeAddMemory');
    const form       = document.getElementById('memoryForm');
    const lbClose    = document.getElementById('lightboxClose');
    const lbOverlay  = document.getElementById('lightboxOverlay');
    const addOverlay = document.getElementById('addMemoryModal');

    if (!btnAdd) return;

    loadCards();
    renderCards();

    btnAdd.addEventListener('click', openAddModal);
    closeAdd.addEventListener('click', closeAddModal);
    form.addEventListener('submit', handleFormSubmit);
    lbClose.addEventListener('click', closeLightbox);

    // Close on backdrop click
    lbOverlay.addEventListener('click',  e => { if (e.target === lbOverlay)  closeLightbox(); });
    addOverlay.addEventListener('click', e => { if (e.target === addOverlay) closeAddModal(); });

    // Close on Escape key
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      closeLightbox();
      closeAddModal();
    });
  }

  return { init };

})();
