/**
 * announcements.js — Duyurular yan paneli.
 *
 * Özellikler:
 *   • Başlık + mesaj
 *   • Öncelik: normal / important / urgent (renkli badge + border)
 *   • Emoji seçici (❤️ 🎉 📍 🎂 💕 🌹)
 *   • Otomatik tarih/saat damgası
 *   • Okundu/okunmadı takibi
 *   • Tarayıcı push notification (Notification API)
 *   • Supabase Realtime senkronizasyon
 *
 * Public API: announcements.init(), announcements.updateBadge()
 */
const announcements = (function () {

  const STORAGE_KEY    = 'announcements';
  const ADMIN_USERNAME = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.users && APP_CONFIG.users[0])
    ? APP_CONFIG.users[0].username
    : '';

  const PRIORITY_LABELS = { normal: '', important: 'Önemli', urgent: 'Acil' };

  /* Realtime çift-render koruması */
  let _lastSaveMs = 0;
  const REALTIME_GRACE = 3000;

  /* Diğer cihazdan gelen yeni bildirimleri tespit etmek için bilinen ID seti */
  let _knownIds = new Set();

  /* Form durumu (emoji seçimi) */
  let _selectedEmoji = '';

  /* ── Kullanıcı yardımcıları ────────────────────────── */

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

  /* ── Veri ─────────────────────────────────────────── */

  async function readAll() {
    return storage.get(STORAGE_KEY, []);
  }

  async function saveAll(list) {
    _lastSaveMs = Date.now();
    await storage.set(STORAGE_KEY, list);
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
    _knownIds.delete(id);
    await saveAll(list.filter(a => a.id !== id));
    await render();
    updateBadge();
  }

  async function addAnnouncement(title, body, emoji, priority) {
    const u    = currentUsername();
    const list = await readAll();
    const newItem = {
      id:       Date.now().toString(),
      title,
      body,
      emoji:    emoji    || '',
      priority: priority || 'normal',
      date:     new Date().toISOString(),
      readBy:   u ? [u] : [],
    };
    _knownIds.add(newItem.id); /* kendimizdeki kaydı bilinen olarak işaretle */
    list.unshift(newItem);
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

  /* ── Push Notification ────────────────────────────── */

  function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function sendPushNotification(item) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const prefix = item.emoji ? item.emoji + ' ' : '';
    const title  = prefix + (item.title || 'Yeni Duyuru');
    const body   = item.body || '';
    try {
      new Notification(title, {
        body,
        tag:    'love-app-' + item.id,
        silent: false,
        icon:   "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>❤️</text></svg>",
      });
    } catch (_) {}
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
      const isUnread   = u && !a.readBy.includes(u);
      const priority   = a.priority || 'normal';
      const emoji      = a.emoji || '';

      const card = document.createElement('div');
      card.className =
        'announcements-card' +
        (isUnread ? ' announcements-card--unread' : '') +
        (' ann-priority-' + priority);
      card.dataset.id = a.id;

      const priorityLabel = PRIORITY_LABELS[priority];
      const priorityBadge = priorityLabel
        ? `<span class="ann-priority-badge ann-priority-badge--${priority}">${priorityLabel}</span>`
        : '';

      const deleteBtnHtml = admin
        ? `<button class="announcements-card-delete" type="button" aria-label="Sil" data-id="${escapeAttr(a.id)}">🗑️</button>`
        : '';

      const emojiHtml = emoji
        ? `<span class="ann-title-emoji" aria-hidden="true">${escapeHtml(emoji)}</span>`
        : '';

      const dateStr = a.date
        ? formatDate(a.date.substring(0, 10)) +
          ' ' + new Date(a.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        : '';

      card.innerHTML = `
        <div class="announcements-card-header">
          <time class="announcements-card-date">${escapeHtml(dateStr)}</time>
          <div class="ann-card-header-right">
            ${priorityBadge}
            ${deleteBtnHtml}
          </div>
        </div>
        <h3 class="announcements-card-title">${emojiHtml}${escapeHtml(a.title)}</h3>
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
    requestNotificationPermission();
    await markAllRead();
    updateBadge();
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

  /* ── Emoji picker yardımcıları ───────────────────────── */

  function initEmojiPicker() {
    const picker = document.getElementById('annEmojiPicker');
    if (!picker) return;
    _selectedEmoji = '';

    picker.querySelectorAll('.ann-emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.dataset.emoji;
        if (_selectedEmoji === emoji) {
          /* Aynıya tekrar tıklamak seçimi kaldırır */
          _selectedEmoji = '';
          btn.classList.remove('ann-emoji-btn--selected');
        } else {
          _selectedEmoji = emoji;
          picker.querySelectorAll('.ann-emoji-btn').forEach(b => b.classList.remove('ann-emoji-btn--selected'));
          btn.classList.add('ann-emoji-btn--selected');
        }
      });
    });
  }

  function resetAddForm() {
    const titleInput = document.getElementById('announcementTitleInput');
    const bodyInput  = document.getElementById('announcementBodyInput');
    if (titleInput) titleInput.value = '';
    if (bodyInput)  bodyInput.value  = '';

    /* Emoji seçimini sıfırla */
    _selectedEmoji = '';
    const picker = document.getElementById('annEmojiPicker');
    if (picker) picker.querySelectorAll('.ann-emoji-btn').forEach(b => b.classList.remove('ann-emoji-btn--selected'));

    /* Önceliği "normal" a döndür */
    const normalRadio = document.querySelector('input[name="annPriority"][value="normal"]');
    if (normalRadio) normalRadio.checked = true;
  }

  /* ── Realtime ─────────────────────────────────────── */

  function subscribeRealtime() {
    supabaseClient.channel('announcements-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' },
        async () => {
          const isFromOther = Date.now() - _lastSaveMs >= REALTIME_GRACE;
          if (!isFromOther) return;

          const list = await readAll();

          /* Yeni gelen öğeler için push notification gönder */
          const newItems = list.filter(a => !_knownIds.has(a.id));
          newItems.forEach(a => sendPushNotification(a));
          list.forEach(a => _knownIds.add(a.id));

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

    /* ── Admin ekleme formu ── */
    const addBtn     = document.getElementById('btnShowAddAnnouncement');
    const addForm    = document.getElementById('announcementsAddForm');
    const saveBtn    = document.getElementById('btnSaveAnnouncement');
    const titleInput = document.getElementById('announcementTitleInput');
    const bodyInput  = document.getElementById('announcementBodyInput');

    initEmojiPicker();

    if (addBtn && addForm) {
      addBtn.addEventListener('click', () => {
        const opening = addForm.hidden;
        addForm.hidden = !opening;
        if (opening) {
          resetAddForm();
          requestNotificationPermission();
          if (titleInput) titleInput.focus();
        }
      });
    }

    if (saveBtn && titleInput && bodyInput) {
      saveBtn.addEventListener('click', async () => {
        const t = titleInput.value.trim();
        const b = bodyInput.value.trim();
        if (!t) { titleInput.focus(); return; }

        const priority = (document.querySelector('input[name="annPriority"]:checked') || {}).value || 'normal';
        const emoji    = _selectedEmoji;

        saveBtn.disabled = true;
        saveBtn.textContent = 'Kaydediliyor…';

        await addAnnouncement(t, b, emoji, priority);

        saveBtn.disabled = false;
        saveBtn.textContent = 'Kaydet';
        resetAddForm();
        if (addForm) addForm.hidden = true;
      });
    }

    /* Bilinen ID'leri yükle (push notification dedup için) */
    const list = await readAll();
    list.forEach(a => _knownIds.add(a.id));

    subscribeRealtime();
    updateBadge();
  }

  return { init, updateBadge };

})();
