/**
 * bucket.js — "Birlikte Yapacaklarımız" listesi.
 *
 * escapeHtml, storage → utils.js'deki global yardımcılar.
 */
const bucket = (function () {

  const STORAGE_KEY = 'love_bucket';
  let items           = [];
  let editingId       = null;
  let pendingDoneId   = null;
  let pendingUncheckId = null;

  /* ── Persistence ─────────────────────────────────── */

  function load() {
    items = storage.get(STORAGE_KEY, []);
  }

  function save() {
    if (!storage.set(STORAGE_KEY, items)) {
      alert('Depolama alanı dolmak üzere.');
    }
  }

  /* ── Dosya okuma ─────────────────────────────────── */

  function readFile(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload  = ev => compressImage(ev.target.result).then(resolve);
      reader.onerror = ()  => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  /* ── Kart elementi ───────────────────────────────── */

  function createCardEl(item) {
    const el = document.createElement('article');
    el.className  = 'bucket-card' + (item.done ? ' done' : '');
    el.dataset.id = item.id;

    const photoHtml = item.photo
      ? `<img class="bucket-card-photo" src="${item.photo}" alt="${escapeHtml(item.title)}" loading="lazy" />`
      : `<div class="bucket-card-photo-placeholder" aria-hidden="true">🌟</div>`;

    const addedByHtml = item.addedBy
      ? `<span class="card-added-by">by *${escapeHtml(item.addedBy)}</span>`
      : '';

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
        <div class="bucket-card-text">
          <span class="bucket-card-title">${escapeHtml(item.title)}</span>
          ${addedByHtml}
        </div>
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
    if (!isDone) {
      const item = items.find(it => it.id === id);
      if (item && item.linkedMemoryId) {
        pendingUncheckId = id;
        render(); // işaretlenmiş görünümü koru
        openUncheckModal();
        return;
      }
    }

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

  /* Form gönderildiğinde fotoğraf varsa sıkıştırır,
     kayıt sırasında butonu devre dışı bırakır. */
  function handleFormSubmit(e) {
    e.preventDefault();
    const title     = document.getElementById('bucketTitle').value.trim();
    const fileInput = document.getElementById('bucketPhoto');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    if (!title) { document.getElementById('bucketTitle').focus(); return; }

    const persist = (photoDataUrl) => {
      if (editingId !== null) {
        items = items.map(it => {
          if (it.id !== editingId) return it;
          return { ...it, title, photo: photoDataUrl !== null ? photoDataUrl : it.photo };
        });
      } else {
        const currentUser = (typeof auth !== 'undefined') ? auth.getUser() : null;
        items.unshift({ id: Date.now(), title, photo: photoDataUrl, done: false, addedBy: currentUser ? currentUser.username : '' });
      }
      save();
      render();
      setButtonLoading(submitBtn, false);
      closeAddModal();
    };

    if (fileInput.files.length) {
      setButtonLoading(submitBtn, true);
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
    const id = pendingDoneId;
    closeConfirmModal();
    if (id === null) return;
    const item = items.find(it => it.id === id);
    if (item) {
      memories.openWithData(item.title, (newMemoryId) => {
        items = items.map(it =>
          it.id === id ? { ...it, linkedMemoryId: newMemoryId } : it
        );
        save();
      });
    }
  }

  /* ── Uncheck warning modal ───────────────────────── */

  function openUncheckModal() {
    document.getElementById('bucketUncheckModal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeUncheckModal() {
    document.getElementById('bucketUncheckModal').classList.remove('open');
    document.body.style.overflow = '';
    pendingUncheckId = null;
  }

  function handleUncheckConfirm() {
    const id = pendingUncheckId;
    closeUncheckModal();
    if (id === null) return;
    const item = items.find(it => it.id === id);
    if (item && item.linkedMemoryId) {
      memories.deleteById(item.linkedMemoryId);
    }
    items = items.map(it =>
      it.id === id ? { ...it, done: false, linkedMemoryId: null } : it
    );
    save();
    render();
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
    document.getElementById('bucketUncheckYes').addEventListener('click', handleUncheckConfirm);
    document.getElementById('bucketUncheckNo').addEventListener('click', closeUncheckModal);

    const addOverlay     = document.getElementById('addBucketModal');
    const confirmOverlay = document.getElementById('bucketConfirmModal');
    const uncheckOverlay = document.getElementById('bucketUncheckModal');
    addOverlay.addEventListener('click',     e => { if (e.target === addOverlay)     closeAddModal(); });
    confirmOverlay.addEventListener('click', e => { if (e.target === confirmOverlay) closeConfirmModal(); });
    uncheckOverlay.addEventListener('click', e => { if (e.target === uncheckOverlay) closeUncheckModal(); });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeAddModal();
        closeConfirmModal();
        closeUncheckModal();
      }
    });
  }

  return { init };

})();
