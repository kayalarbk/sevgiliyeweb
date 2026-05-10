const bucket = (function () {

  const STORAGE_KEY = 'love_bucket';
  let items     = [];
  let editingId = null;
  let pendingDoneId = null;  // item awaiting memory-confirm

  /* ── Persistence ─────────────────────────────────── */

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      items = raw ? JSON.parse(raw) : [];
    } catch (_) {
      items = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (_) {
      alert('Depolama alanı dolmak üzere.');
    }
  }

  /* ── Helpers ─────────────────────────────────────── */

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function readFile(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload  = ev => resolve(ev.target.result);
      reader.onerror = ()  => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  /* ── Card element ────────────────────────────────── */

  function createCardEl(item) {
    const el = document.createElement('article');
    el.className  = 'bucket-card' + (item.done ? ' done' : '');
    el.dataset.id = item.id;

    const photoHtml = item.photo
      ? `<img class="bucket-card-photo" src="${item.photo}" alt="${escapeHtml(item.title)}" loading="lazy" />`
      : `<div class="bucket-card-photo-placeholder" aria-hidden="true">🌟</div>`;

    el.innerHTML = `
      <div class="bucket-card-img-wrap">
        ${photoHtml}
        <div class="bucket-done-overlay" aria-hidden="true">✓</div>
        <div class="bucket-card-actions">
          <button class="bucket-action-btn btn-edit-bucket"   title="Düzenle" type="button">✏️</button>
          <button class="bucket-action-btn btn-delete-bucket" title="Sil"     type="button">🗑️</button>
        </div>
      </div>
      <div class="bucket-card-body">
        <input class="bucket-checkbox" type="checkbox" aria-label="Tamamlandı" ${item.done ? 'checked' : ''} />
        <span class="bucket-card-title">${escapeHtml(item.title)}</span>
      </div>`;

    el.querySelector('.bucket-checkbox').addEventListener('change', e => {
      toggleDone(item.id, e.target.checked);
    });

    el.querySelector('.btn-edit-bucket').addEventListener('click', e => {
      e.stopPropagation();
      openEditModal(item);
    });

    el.querySelector('.btn-delete-bucket').addEventListener('click', e => {
      e.stopPropagation();
      deleteItem(item.id);
    });

    return el;
  }

  /* ── Render ──────────────────────────────────────── */

  function render() {
    const grid = document.getElementById('bucketGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!items.length) {
      const empty = document.createElement('p');
      empty.className   = 'bucket-empty';
      empty.textContent = 'Henüz plan yok — birlikte yapacaklarınızı ekleyin!';
      grid.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    items.forEach(item => frag.appendChild(createCardEl(item)));
    grid.appendChild(frag);
  }

  /* ── Toggle done ─────────────────────────────────── */

  function toggleDone(id, isDone) {
    items = items.map(it => it.id === id ? { ...it, done: isDone } : it);
    save();
    render();

    if (isDone) {
      pendingDoneId = id;
      openConfirmModal();
    }
  }

  /* ── Delete ──────────────────────────────────────── */

  function deleteItem(id) {
    if (!confirm('Bu planı silmek istiyor musun?')) return;
    items = items.filter(it => it.id !== id);
    save();
    render();
  }

  /* ── Add / Edit modal ────────────────────────────── */

  function openAddModal() {
    editingId = null;
    document.getElementById('bucketModalTitle').textContent = 'Plan Ekle';
    document.getElementById('bucketForm').reset();
    document.getElementById('addBucketModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('bucketTitle').focus();
  }

  function openEditModal(item) {
    editingId = item.id;
    document.getElementById('bucketModalTitle').textContent = 'Planı Düzenle';
    document.getElementById('bucketTitle').value = item.title || '';
    document.getElementById('bucketPhoto').value = '';
    document.getElementById('addBucketModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('bucketTitle').focus();
  }

  function closeAddModal() {
    document.getElementById('addBucketModal').classList.remove('open');
    document.getElementById('bucketForm').reset();
    document.body.style.overflow = '';
    editingId = null;
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('bucketTitle').value.trim();
    if (!title) { document.getElementById('bucketTitle').focus(); return; }

    const fileInput = document.getElementById('bucketPhoto');

    const persist = (photoDataUrl) => {
      if (editingId !== null) {
        items = items.map(it => {
          if (it.id !== editingId) return it;
          return { ...it, title, photo: photoDataUrl !== null ? photoDataUrl : it.photo };
        });
      } else {
        items.unshift({ id: Date.now(), title, photo: photoDataUrl, done: false });
      }
      save();
      render();
      closeAddModal();
    };

    if (fileInput.files.length) {
      readFile(fileInput.files[0]).then(persist);
    } else {
      persist(editingId !== null ? null : null);
    }
  }

  /* ── Confirm → Memory modal ──────────────────────── */

  function openConfirmModal() {
    document.getElementById('bucketConfirmModal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeConfirmModal() {
    document.getElementById('bucketConfirmModal').classList.remove('open');
    document.body.style.overflow = '';
    pendingDoneId = null;
  }

  function handleConfirmYes() {
    closeConfirmModal();
    if (pendingDoneId === null) return;
    const item = items.find(it => it.id === pendingDoneId);
    if (item) memories.openWithData(item.title, item.photo);
    pendingDoneId = null;
  }

  /* ── Init ────────────────────────────────────────── */

  function init() {
    if (!document.getElementById('bucketGrid')) return;

    load();
    render();

    document.getElementById('btnAddBucket').addEventListener('click', openAddModal);
    document.getElementById('closeBucketModal').addEventListener('click', closeAddModal);
    document.getElementById('bucketForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('bucketConfirmYes').addEventListener('click', handleConfirmYes);
    document.getElementById('bucketConfirmNo').addEventListener('click', closeConfirmModal);

    const addOverlay     = document.getElementById('addBucketModal');
    const confirmOverlay = document.getElementById('bucketConfirmModal');
    addOverlay.addEventListener('click',     e => { if (e.target === addOverlay)     closeAddModal(); });
    confirmOverlay.addEventListener('click', e => { if (e.target === confirmOverlay) closeConfirmModal(); });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeAddModal();
        closeConfirmModal();
      }
    });
  }

  return { init };

})();
