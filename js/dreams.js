/**
 * dreams.js — Hayallerimiz listesi.
 *
 * escapeHtml, storage, supabaseClient, spawnConfetti → utils.js
 * showToast → toast.js
 * tabs.updateBadge → tabs.js
 * auth.getUser     → auth.js
 */
const dreams = (function () {

  const STORAGE_KEY  = 'love_dreams';
  let items          = [];
  let editingId      = null;
  let activeFilter   = 'all';
  let _lastSaveMs    = 0;
  const REALTIME_GRACE = 3000;

  const STATUS_LABELS = {
    hayal:       'Hayal',
    planlandi:   'Planlandı',
    devam:       'Devam Ediyor',
    tamamlandi:  'Tamamlandı',
  };

  /* ── Persistence ─────────────────────────────────── */

  async function load() {
    items = await storage.get(STORAGE_KEY, []);
  }

  async function save() {
    _lastSaveMs = Date.now();
    const ok = await storage.set(STORAGE_KEY, items);
    if (!ok) showToast('Kayıt başarısız. Lütfen tekrar dene.', 'error');
    return ok;
  }

  /* ── Filtre ──────────────────────────────────────── */

  function getFiltered() {
    if (activeFilter === 'all') return items;
    return items.filter(it => it.status === activeFilter);
  }

  /* ── Kart elementi ───────────────────────────────── */

  function createCardEl(item) {
    const el = document.createElement('article');
    el.className  = `dream-card status-${item.status}`;
    el.dataset.id = item.id;

    const catClass   = item.category === 'Beceri' ? 'beceri' : 'egitim';
    const statusLabel = STATUS_LABELS[item.status] || item.status;
    const progress    = item.progress || 0;

    const descHtml = item.description
      ? `<p class="dream-card-desc">${escapeHtml(item.description)}</p>`
      : '';

    const addedByHtml = item.addedBy
      ? `<span class="dream-added-by">by *${escapeHtml(item.addedBy)}</span>`
      : '';

    el.innerHTML = `
      <div class="dream-card-header">
        <span class="dream-cat-badge ${catClass}">${item.category}</span>
        <span class="dream-status-badge ${item.status}">${statusLabel}</span>
        <div class="dream-card-actions">
          <button class="dream-action-btn btn-edit-dream"   title="Düzenle" type="button">✏️</button>
          <button class="dream-action-btn btn-delete-dream" title="Sil"     type="button">🗑️</button>
        </div>
      </div>
      <h3 class="dream-card-title">${escapeHtml(item.title)}</h3>
      ${descHtml}
      <div class="dream-progress-section">
        <div class="dream-progress-track">
          <div class="dream-progress-fill" style="width:${progress}%"></div>
        </div>
        <span class="dream-progress-pct">${progress}%</span>
      </div>
      ${addedByHtml}`;

    el.querySelector('.btn-edit-dream').addEventListener('click', e => {
      e.stopPropagation();
      openEditModal(item);
    });
    el.querySelector('.btn-delete-dream').addEventListener('click', e => {
      e.stopPropagation();
      deleteItem(item.id);
    });

    return el;
  }

  /* ── Render ──────────────────────────────────────── */

  function render() {
    const grid = document.getElementById('dreamsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = getFiltered();

    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className   = 'dreams-empty';
      empty.textContent = activeFilter === 'all'
        ? 'Henüz hayal yok — + Ekle butonuyla ilk hayalini ekle!'
        : 'Bu filtreyle eşleşen hayal yok.';
      grid.appendChild(empty);
    } else {
      const frag = document.createDocumentFragment();
      filtered.forEach(item => frag.appendChild(createCardEl(item)));
      grid.appendChild(frag);
    }

    refreshBadge();
  }

  function refreshBadge() {
    const done = items.filter(it => it.status === 'tamamlandi').length;
    if (typeof tabs !== 'undefined') tabs.updateBadge('dreams', done, items.length);
  }

  /* ── Delete ──────────────────────────────────────── */

  async function deleteItem(id) {
    if (!confirm('Bu hayali silmek istiyor musun?')) return;
    items = items.filter(it => it.id !== id);
    const ok = await save();
    render();
    if (ok) showToast('Hayal silindi.', 'info');
  }

  /* ── Add / Edit modal ────────────────────────────── */

  function openAddModal() {
    editingId = null;
    document.getElementById('dreamModalTitle').textContent = 'Hayal Ekle';
    document.getElementById('dreamForm').reset();
    document.getElementById('dreamProgressLabel').textContent = '0%';
    document.getElementById('addDreamModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('dreamTitle').focus();
  }

  function openEditModal(item) {
    editingId = item.id;
    document.getElementById('dreamModalTitle').textContent = 'Hayali Düzenle';
    document.getElementById('dreamTitle').value   = item.title       || '';
    document.getElementById('dreamDesc').value    = item.description || '';
    document.getElementById('dreamStatus').value  = item.status      || 'hayal';
    document.getElementById('dreamProgress').value = item.progress   || 0;
    document.getElementById('dreamProgressLabel').textContent = (item.progress || 0) + '%';

    const catInput = document.querySelector(`input[name="dreamCategory"][value="${item.category}"]`);
    if (catInput) catInput.checked = true;

    document.getElementById('addDreamModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('dreamTitle').focus();
  }

  function closeModal() {
    document.getElementById('addDreamModal').classList.remove('open');
    document.body.style.overflow = '';
    editingId = null;
  }

  /* ── Form gönderimi ──────────────────────────────── */

  function handleFormSubmit(e) {
    e.preventDefault();

    const title = document.getElementById('dreamTitle').value.trim();
    if (!title) { document.getElementById('dreamTitle').focus(); return; }

    const catChecked  = document.querySelector('input[name="dreamCategory"]:checked');
    const category    = catChecked ? catChecked.value : 'Beceri';
    const description = document.getElementById('dreamDesc').value.trim();
    const status      = document.getElementById('dreamStatus').value;
    const progress    = parseInt(document.getElementById('dreamProgress').value) || 0;
    const currentUser = (typeof auth !== 'undefined') ? auth.getUser() : null;

    let prevStatus = '';

    if (editingId !== null) {
      const prev = items.find(it => it.id === editingId);
      prevStatus = prev ? prev.status : '';
      items = items.map(it => {
        if (it.id !== editingId) return it;
        return { ...it, title, category, description, status, progress };
      });
    } else {
      items.unshift({
        id:          Date.now(),
        title,
        category,
        description,
        status,
        progress,
        addedBy:     currentUser ? currentUser.username : '',
      });
    }

    const shouldConfetti = status === 'tamamlandi' && prevStatus !== 'tamamlandi';
    const isEdit         = editingId !== null;

    save().then(ok => {
      render();
      closeModal();
      if (ok) showToast(isEdit ? 'Hayal güncellendi ♥' : 'Hayal eklendi ♥', 'success');
      if (shouldConfetti) spawnConfetti();
    });
  }

  /* ── Realtime ────────────────────────────────────── */

  function subscribeRealtime() {
    supabaseClient.channel('dreams-realtime')
      .on('postgres_changes', {
          event: '*', schema: 'public', table: 'app_settings',
          filter: 'key=eq.love_dreams'
        },
        async () => {
          if (Date.now() - _lastSaveMs < REALTIME_GRACE) return;
          await load();
          render();
        })
      .subscribe();
  }

  /* ── Init ────────────────────────────────────────── */

  async function init() {
    if (!document.getElementById('dreamsGrid')) return;

    await load();
    render();
    subscribeRealtime();

    document.getElementById('btnAddDream').addEventListener('click', openAddModal);
    document.getElementById('closeDreamModal').addEventListener('click', closeModal);
    document.getElementById('dreamForm').addEventListener('submit', handleFormSubmit);

    document.getElementById('dreamProgress').addEventListener('input', e => {
      document.getElementById('dreamProgressLabel').textContent = e.target.value + '%';
    });

    document.getElementById('dreamStatus').addEventListener('change', e => {
      if (e.target.value === 'tamamlandi') {
        document.getElementById('dreamProgress').value = 100;
        document.getElementById('dreamProgressLabel').textContent = '100%';
      }
    });

    document.querySelectorAll('#dreamsFilters .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#dreamsFilters .filter-btn')
          .forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        render();
      });
    });

    const overlay = document.getElementById('addDreamModal');
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });
  }

  return { init };

})();
