/**
 * announcements.js — Duyurular yan paneli.
 *
 * Duyuruları localStorage'da saklar, okundu takibi yapar,
 * admin için ekleme/silme formu sunar.
 * Public API: announcements.init(), announcements.updateBadge()
 */
const announcements = (function () {

  const STORAGE_KEY    = 'announcements';
  const ADMIN_USERNAME = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.users && APP_CONFIG.users[0])
    ? APP_CONFIG.users[0].username
    : '';

  /* ── Veri ─────────────────────────────────────────── */

  function readAll() {
    return storage.get(STORAGE_KEY, []);
  }

  function saveAll(list) {
    storage.set(STORAGE_KEY, list);
  }

  function currentUsername() {
    const user = auth.getUser();
    return user ? user.username : null;
  }

  function isAdmin() {
    const u = currentUsername();
    if (!u || !ADMIN_USERNAME) return false;
    const normalize = s => s.toLowerCase()
      .replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/\s+/g, '');
    return normalize(u) === normalize(ADMIN_USERNAME);
  }

  function unreadCount() {
    const u = currentUsername();
    if (!u) return 0;
    return readAll().filter(a => !a.readBy.includes(u)).length;
  }

  function markAllRead() {
    const u = currentUsername();
    if (!u) return;
    const list = readAll();
    let changed = false;
    list.forEach(a => {
      if (!a.readBy.includes(u)) {
        a.readBy.push(u);
        changed = true;
      }
    });
    if (changed) saveAll(list);
  }

  function deleteById(id) {
    saveAll(readAll().filter(a => a.id !== id));
    render();
    updateBadge();
  }

  function addAnnouncement(title, body) {
    const u    = currentUsername();
    const list = readAll();
    list.unshift({
      id:     Date.now().toString(),
      title,
      body,
      date:   new Date().toISOString(),
      readBy: u ? [u] : [],
    });
    saveAll(list);
    render();
    updateBadge();
  }

  /* ── Badge ─────────────────────────────────────────── */

  function updateBadge() {
    const badge = document.getElementById('announcementsBadge');
    if (!badge) return;
    const count = unreadCount();
    if (count > 0) {
      badge.textContent = count;
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  /* ── Render ─────────────────────────────────────────── */

  function render() {
    const container = document.getElementById('announcementsContent');
    if (!container) return;
    container.innerHTML = '';

    const list  = readAll();
    const u     = currentUsername();
    const admin = isAdmin();

    const addSection = document.getElementById('announcementsAddSection');
    if (addSection) addSection.hidden = !admin;

    if (!list.length) {
      container.innerHTML = '<p class="announcements-empty">Henüz duyuru yok 🔔</p>';
      return;
    }

    const frag = document.createDocumentFragment();
    list.forEach(a => {
      const isUnread = u && !a.readBy.includes(u);
      const card     = document.createElement('div');
      card.className = 'announcements-card' + (isUnread ? ' announcements-card--unread' : '');
      card.dataset.id = a.id;

      const deleteBtnHtml = admin
        ? `<button class="announcements-card-delete" type="button" aria-label="Sil" data-id="${escapeAttr(a.id)}">🗑️</button>`
        : '';

      card.innerHTML = `
        <div class="announcements-card-header">
          <time class="announcements-card-date">${escapeHtml(formatDate(a.date.substring(0, 10)))}</time>
          ${deleteBtnHtml}
        </div>
        <h3 class="announcements-card-title">${escapeHtml(a.title)}</h3>
        <p class="announcements-card-body">${escapeHtml(a.body)}</p>`;

      if (admin) {
        card.querySelector('.announcements-card-delete').addEventListener('click', () => {
          if (!confirm('Bu duyuruyu silmek istediğine emin misin?')) return;
          deleteById(a.id);
        });
      }

      frag.appendChild(card);
    });

    container.appendChild(frag);
  }

  /* ── Aç / Kapat ─────────────────────────────────────── */

  function open() {
    const overlay = document.getElementById('announcementsOverlay');
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    markAllRead();
    updateBadge();
    render();
    const body = document.getElementById('announcementsBody');
    if (body) body.scrollTop = 0;
  }

  function close() {
    const overlay = document.getElementById('announcementsOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ── Init ─────────────────────────────────────────── */

  function init() {
    const openBtn  = document.getElementById('btnAnnouncements');
    const closeBtn = document.getElementById('btnCloseAnnouncements');

    if (openBtn)  openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);

    document.addEventListener('keydown', e => {
      const ov = document.getElementById('announcementsOverlay');
      if (e.key === 'Escape' && ov && ov.classList.contains('open')) close();
    });

    const addBtn     = document.getElementById('btnShowAddAnnouncement');
    const addForm    = document.getElementById('announcementsAddForm');
    const saveBtn    = document.getElementById('btnSaveAnnouncement');
    const titleInput = document.getElementById('announcementTitleInput');
    const bodyInput  = document.getElementById('announcementBodyInput');

    if (addBtn && addForm) {
      addBtn.addEventListener('click', () => {
        addForm.hidden = !addForm.hidden;
        if (!addForm.hidden && titleInput) titleInput.focus();
      });
    }

    if (saveBtn && titleInput && bodyInput) {
      saveBtn.addEventListener('click', () => {
        const t = titleInput.value.trim();
        const b = bodyInput.value.trim();
        if (!t) { titleInput.focus(); return; }
        addAnnouncement(t, b);
        titleInput.value = '';
        bodyInput.value  = '';
        if (addForm) addForm.hidden = true;
      });
    }

    updateBadge();
  }

  return { init, updateBadge };

})();
