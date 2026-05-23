/**
 * announcements.js — Duyurular yan paneli.
 *
 * Duyuruları Supabase'de saklar, okundu takibi yapar,
 * admin için ekleme/silme formu sunar.
 * Public API: announcements.init(), announcements.updateBadge()
 */
const announcements = (function () {

  const STORAGE_KEY    = 'announcements';
  const ADMIN_USERNAME = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.users && APP_CONFIG.users[0])
    ? APP_CONFIG.users[0].username
    : '';

  /* Realtime çift-render koruması */
  let _lastSaveMs = 0;
  const REALTIME_GRACE = 3000;

  /* ── Veri ─────────────────────────────────────────── */

  async function readAll() {
    return storage.get(STORAGE_KEY, []);
  }

  async function saveAll(list) {
    _lastSaveMs = Date.now();
    await storage.set(STORAGE_KEY, list);
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

  async function unreadCount() {
    const u = currentUsername();
    if (!u) return 0;
    const list = await readAll();
    return list.filter(a => !a.readBy.includes(u)).length;
  }

  async function markAllRead() {
    const u = currentUsername();
    if (!u) return;
    const list = await readAll();
    let changed = false;
    list.forEach(a => {
      if (!a.readBy.includes(u)) { a.readBy.push(u); changed = true; }
    });
    if (changed) await saveAll(list);
  }

  async function deleteById(id) {
    const list = await readAll();
    await saveAll(list.filter(a => a.id !== id));
    await render();
    updateBadge();
  }

  async function addAnnouncement(title, body) {
    const u    = currentUsername();
    const list = await readAll();
    list.unshift({
      id:     Date.now().toString(),
      title,
      body,
      date:   new Date().toISOString(),
      readBy: u ? [u] : [],
    });
    await saveAll(list);
    await render();
    updateBadge();
  }

  /* ── Badge ─────────────────────────────────────────── */

  async function updateBadge() {
    const badge = document.getElementById('announcementsBadge');
    if (!badge) return;
    const count = await unreadCount();
    if (count > 0) {
      badge.textContent = count;
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  /* ── Render ─────────────────────────────────────────── */

  async function render() {
    const container = document.getElementById('announcementsContent');
    if (!container) return;
    container.innerHTML = '';

    const list  = await readAll();
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
        card.querySelector('.announcements-card-delete').addEventListener('click', async () => {
          if (!confirm('Bu duyuruyu silmek istediğine emin misin?')) return;
          await deleteById(a.id);
        });
      }

      frag.appendChild(card);
    });

    container.appendChild(frag);
  }

  /* ── Aç / Kapat ─────────────────────────────────────── */

  async function open() {
    const overlay = document.getElementById('announcementsOverlay');
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    await markAllRead();
    updateBadge(); /* fire and forget */
    await render();
    const body = document.getElementById('announcementsBody');
    if (body) body.scrollTop = 0;
  }

  function close() {
    const overlay = document.getElementById('announcementsOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ── Realtime ─────────────────────────────────────── */

  function subscribeRealtime() {
    supabaseClient.channel('announcements-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' },
        async () => {
          if (Date.now() - _lastSaveMs < REALTIME_GRACE) return;
          updateBadge();
          const overlay = document.getElementById('announcementsOverlay');
          if (overlay && overlay.classList.contains('open')) await render();
        })
      .subscribe();
  }

  /* ── Init ─────────────────────────────────────────── */

  async function init() {
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
      saveBtn.addEventListener('click', async () => {
        const t = titleInput.value.trim();
        const b = bodyInput.value.trim();
        if (!t) { titleInput.focus(); return; }
        await addAnnouncement(t, b);
        titleInput.value = '';
        bodyInput.value  = '';
        if (addForm) addForm.hidden = true;
      });
    }

    subscribeRealtime();
    updateBadge(); /* fire and forget */
  }

  return { init, updateBadge };

})();
