/**
 * watchlist.js — İzleyeceklerimiz listesi.
 *
 * escapeHtml, storage, supabaseClient → utils.js
 * tabs.updateBadge → tabs.js
 * auth.getUser        → auth.js
 */
const watchlist = (function () {

  const STORAGE_KEY   = 'love_watchlist';
  let items           = [];
  let editingId       = null;
  let activeFilter    = 'all';
  let _selectedRating = 0;
  let _lastSaveMs     = 0;
  const REALTIME_GRACE = 3000;

  /* ── Persistence ─────────────────────────────────── */

  async function load() {
    items = await storage.get(STORAGE_KEY, []);
  }

  async function save() {
    _lastSaveMs = Date.now();
    const ok = await storage.set(STORAGE_KEY, items);
    if (!ok) alert('Kayıt başarısız. Lütfen tekrar dene.');
  }

  /* ── Filtre ──────────────────────────────────────── */

  function getFiltered() {
    if (activeFilter === 'watched') return items.filter(it => it.watched);
    if (activeFilter === 'pending') return items.filter(it => !it.watched);
    return items;
  }

  /* ── Kart elementi ───────────────────────────────── */

  function createCardEl(item) {
    const el = document.createElement('article');
    el.className  = 'wl-card' + (item.watched ? ' watched' : '');
    el.dataset.id = item.id;

    const typeClass = item.type === 'Film' ? 'film' : 'dizi';
    const icon      = item.type === 'Film' ? '🎬'  : '📺';

    const starsHtml = (item.watched && item.rating)
      ? '<div class="wl-stars">' +
          [1,2,3,4,5].map(i =>
            `<span class="wl-star${i <= item.rating ? ' filled' : ''}">★</span>`
          ).join('') +
        '</div>'
      : '';

    const addedByHtml = item.addedBy
      ? `<span class="wl-added-by">by *${escapeHtml(item.addedBy)}</span>`
      : '';

    el.innerHTML = `
      <div class="wl-card-top">
        <span class="wl-type-badge ${typeClass}">${item.type}</span>
        <div class="wl-done-overlay" aria-hidden="true">✅</div>
        <div class="wl-card-actions">
          <button class="wl-action-btn btn-edit-wl"   title="Düzenle" type="button">✏️</button>
          <button class="wl-action-btn btn-delete-wl" title="Sil"     type="button">🗑️</button>
        </div>
        ${icon}
      </div>
      <div class="wl-card-body">
        <div class="wl-card-title-row">
          <input class="wl-checkbox" type="checkbox" aria-label="İzlendi"
                 ${item.watched ? 'checked' : ''} />
          <span class="wl-card-title">${escapeHtml(item.title)}</span>
        </div>
        ${starsHtml}
        ${addedByHtml}
      </div>`;

    el.querySelector('.wl-checkbox').addEventListener('change', e => {
      toggleWatched(item.id, e.target.checked);
    });
    el.querySelector('.btn-edit-wl').addEventListener('click', e => {
      e.stopPropagation();
      openEditModal(item);
    });
    el.querySelector('.btn-delete-wl').addEventListener('click', e => {
      e.stopPropagation();
      deleteItem(item.id);
    });

    return el;
  }

  /* ── Render ──────────────────────────────────────── */

  function render() {
    const grid = document.getElementById('watchlistGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = getFiltered();

    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className   = 'watchlist-empty';
      empty.textContent = activeFilter === 'all'
        ? 'Henüz içerik yok — + Ekle butonuyla başla!'
        : 'Bu filtreyle eşleşen içerik yok.';
      grid.appendChild(empty);
    } else {
      const frag = document.createDocumentFragment();
      filtered.forEach(item => frag.appendChild(createCardEl(item)));
      grid.appendChild(frag);
    }

    refreshBadge();
  }

  function refreshBadge() {
    const watched = items.filter(it => it.watched).length;
    if (typeof tabs !== 'undefined') tabs.updateBadge('watchlist', watched, items.length);
  }

  /* ── Toggle watched ──────────────────────────────── */

  async function toggleWatched(id, isWatched) {
    items = items.map(it => it.id === id ? { ...it, watched: isWatched } : it);
    await save();
    render();
  }

  /* ── Delete ──────────────────────────────────────── */

  async function deleteItem(id) {
    if (!confirm('Bu içeriği silmek istiyor musun?')) return;
    items = items.filter(it => it.id !== id);
    await save();
    render();
  }

  /* ── Star picker ─────────────────────────────────── */

  function initStarPicker() {
    const stars = document.querySelectorAll('#wlStarPicker .star-opt');
    stars.forEach(star => {
      const val = parseInt(star.dataset.value);

      star.addEventListener('click', () => {
        _selectedRating = val;
        document.getElementById('wlRatingValue').value = val;
        applyStarHighlight(val);
      });
      star.addEventListener('mouseover', () => hoverStars(val));
      star.addEventListener('mouseout',  () => hoverStars(0));
    });
  }

  function hoverStars(upTo) {
    document.querySelectorAll('#wlStarPicker .star-opt').forEach(s => {
      s.classList.toggle('hovered', upTo > 0 && parseInt(s.dataset.value) <= upTo);
    });
  }

  function applyStarHighlight(val) {
    document.querySelectorAll('#wlStarPicker .star-opt').forEach(s => {
      s.classList.toggle('selected', parseInt(s.dataset.value) <= val);
    });
  }

  function resetStarPicker() {
    _selectedRating = 0;
    const hidden = document.getElementById('wlRatingValue');
    if (hidden) hidden.value = '';
    document.querySelectorAll('#wlStarPicker .star-opt').forEach(s => {
      s.classList.remove('selected', 'hovered');
    });
  }

  /* ── Add / Edit modal ────────────────────────────── */

  function showRatingField() {
    document.getElementById('wlRatingField').classList.add('visible');
  }

  function hideRatingField() {
    document.getElementById('wlRatingField').classList.remove('visible');
  }

  function openAddModal() {
    editingId = null;
    document.getElementById('wlModalTitle').textContent = 'Film / Dizi Ekle';
    document.getElementById('wlForm').reset();
    hideRatingField();
    resetStarPicker();
    document.getElementById('addWatchlistModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('wlTitle').focus();
  }

  function openEditModal(item) {
    editingId = item.id;
    document.getElementById('wlModalTitle').textContent = 'Düzenle';
    document.getElementById('wlTitle').value = item.title || '';

    const typeInput = document.querySelector(`input[name="wlType"][value="${item.type}"]`);
    if (typeInput) typeInput.checked = true;

    document.getElementById('wlWatched').checked = !!item.watched;

    resetStarPicker();
    if (item.watched && item.rating) {
      _selectedRating = item.rating;
      document.getElementById('wlRatingValue').value = item.rating;
      applyStarHighlight(item.rating);
      showRatingField();
    } else {
      hideRatingField();
    }

    document.getElementById('addWatchlistModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('wlTitle').focus();
  }

  function closeModal() {
    document.getElementById('addWatchlistModal').classList.remove('open');
    document.body.style.overflow = '';
    editingId = null;
  }

  /* ── Form gönderimi ──────────────────────────────── */

  function handleFormSubmit(e) {
    e.preventDefault();

    const title = document.getElementById('wlTitle').value.trim();
    if (!title) { document.getElementById('wlTitle').focus(); return; }

    const typeChecked = document.querySelector('input[name="wlType"]:checked');
    const type        = typeChecked ? typeChecked.value : 'Film';
    const watched     = document.getElementById('wlWatched').checked;
    const rating      = (watched && _selectedRating > 0) ? _selectedRating : null;
    const currentUser = (typeof auth !== 'undefined') ? auth.getUser() : null;

    if (editingId !== null) {
      items = items.map(it => {
        if (it.id !== editingId) return it;
        return { ...it, title, type, watched, rating };
      });
    } else {
      items.unshift({
        id:       Date.now(),
        title,
        type,
        watched,
        rating,
        addedBy:  currentUser ? currentUser.username : '',
      });
    }

    save().then(() => {
      render();
      closeModal();
    });
  }

  /* ── Realtime ────────────────────────────────────── */

  function subscribeRealtime() {
    supabaseClient.channel('watchlist-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watchlist' },
        async () => {
          if (Date.now() - _lastSaveMs < REALTIME_GRACE) return;
          await load();
          render();
        })
      .subscribe();
  }

  /* ── Init ────────────────────────────────────────── */

  async function init() {
    if (!document.getElementById('watchlistGrid')) return;

    await load();
    render();
    subscribeRealtime();
    initStarPicker();

    document.getElementById('btnAddWatchlist').addEventListener('click', openAddModal);
    document.getElementById('closeWatchlistModal').addEventListener('click', closeModal);
    document.getElementById('wlForm').addEventListener('submit', handleFormSubmit);

    document.getElementById('wlWatched').addEventListener('change', e => {
      if (e.target.checked) showRatingField();
      else { hideRatingField(); resetStarPicker(); }
    });

    document.querySelectorAll('#watchlistFilters .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#watchlistFilters .filter-btn')
          .forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        render();
      });
    });

    const overlay = document.getElementById('addWatchlistModal');
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });
  }

  return { init };

})();
