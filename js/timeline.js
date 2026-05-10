/**
 * timeline.js — Anıların kronolojik zaman tüneli görünümü.
 *
 * Anıları localStorage'dan okur, tarihe göre sıralar,
 * yıllara göre gruplandırır ve tam ekran timeline olarak gösterir.
 * Public API: timeline.init(), timeline.refresh()
 */
const timeline = (function () {

  const STORAGE_KEY = 'love_memories';

  /* ── Veri ─────────────────────────────────────────── */

  function readCards() {
    const parsed = storage.get(STORAGE_KEY, []);
    return parsed.map(c => ({
      id:         c.id,
      title:      c.title      || '',
      date:       c.date       || '',
      photos:     c.photos || (c.photo ? [c.photo] : []),
      locationId: c.locationId || null,
      addedBy:    c.addedBy    || '',
    }));
  }

  function groupByYear(cards) {
    const dated   = cards.filter(c => c.date).sort((a, b) => a.date.localeCompare(b.date));
    const undated = cards.filter(c => !c.date);

    const groups = new Map();
    dated.forEach(c => {
      const year = c.date.substring(0, 4);
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year).push(c);
    });

    if (undated.length) groups.set('Tarihsiz', undated);
    return groups;
  }

  /* ── Render ───────────────────────────────────────── */

  function render() {
    const container = document.getElementById('timelineContent');
    if (!container) return;
    container.innerHTML = '';

    const cards  = readCards();
    const groups = groupByYear(cards);

    if (!cards.length) {
      container.innerHTML = `
        <div class="tl-empty">
          <span class="tl-empty-icon">🕰️</span>
          <p>Henüz anı yok — anılarını ekleyince burada kronolojik sırayla görünecek ♥</p>
        </div>`;
      return;
    }

    const frag = document.createDocumentFragment();

    groups.forEach((yearCards, year) => {
      const yearEl = document.createElement('div');
      yearEl.className = 'tl-year-divider';
      yearEl.innerHTML = `<span class="tl-year-label">${escapeHtml(String(year))}</span>`;
      frag.appendChild(yearEl);

      yearCards.forEach((card, idx) => {
        frag.appendChild(createItem(card, idx === yearCards.length - 1));
      });
    });

    container.appendChild(frag);
    animateItems(container);
  }

  function createItem(card, isLastInGroup) {
    const item = document.createElement('div');
    item.className = 'tl-item';
    item.dataset.id = card.id;

    const photo = card.photos.length ? card.photos[0] : null;

    const photoHtml = photo
      ? `<img class="tl-photo" src="${photo}" alt="${escapeAttr(card.title)}" loading="lazy" />`
      : '';

    const locBadge = card.locationId
      ? `<span class="tl-badge">📍 Konumlu</span>`
      : '';

    const addedByBadge = card.addedBy
      ? `<span class="tl-badge tl-badge-author">by *${escapeHtml(card.addedBy)}</span>`
      : '';

    const badgesHtml = (locBadge || addedByBadge)
      ? `<div class="tl-badges">${locBadge}${addedByBadge}</div>`
      : '';

    item.innerHTML = `
      <div class="tl-dot-wrap">
        <div class="tl-dot" aria-hidden="true">♥</div>
        <div class="tl-line${isLastInGroup ? ' tl-line-hidden' : ''}"></div>
      </div>
      <div class="tl-card">
        ${photoHtml}
        <div class="tl-card-body">
          <time class="tl-date">${escapeHtml(formatDate(card.date) || 'Tarih yok')}</time>
          <h3 class="tl-title">${escapeHtml(card.title)}</h3>
          ${badgesHtml}
          <div class="tl-actions">
            <button class="tl-btn tl-btn-edit"   type="button">✏️ Düzenle</button>
            <button class="tl-btn tl-btn-delete" type="button">🗑️ Sil</button>
          </div>
        </div>
      </div>`;

    item.querySelector('.tl-btn-edit').addEventListener('click', () => {
      close();
      if (typeof memories !== 'undefined') memories.openEditById(card.id);
    });

    item.querySelector('.tl-btn-delete').addEventListener('click', () => {
      if (!confirm('Bu anıyı silmek istediğine emin misin?')) return;
      if (typeof memories !== 'undefined') memories.deleteById(card.id);
      render();
    });

    return item;
  }

  /* ── Scroll animasyonu ────────────────────────────── */

  function animateItems(container) {
    const items = container.querySelectorAll('.tl-item');

    if (!window.IntersectionObserver) {
      items.forEach(el => el.classList.add('tl-visible'));
      return;
    }

    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('tl-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });

    items.forEach(el => obs.observe(el));
  }

  /* ── Aç / Kapat ───────────────────────────────────── */

  function open() {
    const overlay = document.getElementById('timelineOverlay');
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    render();
    const body = document.getElementById('timelineBody');
    if (body) body.scrollTop = 0;
  }

  function close() {
    const overlay = document.getElementById('timelineOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ── Init ─────────────────────────────────────────── */

  function init() {
    const openBtn  = document.getElementById('btnTimeline');
    const closeBtn = document.getElementById('btnCloseTimeline');
    const overlay  = document.getElementById('timelineOverlay');

    if (openBtn)  openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (overlay)  overlay.addEventListener('click', e => {
      if (e.target === overlay) close();
    });

    document.addEventListener('keydown', e => {
      const ov = document.getElementById('timelineOverlay');
      if (e.key === 'Escape' && ov && ov.classList.contains('open')) close();
    });
  }

  return { init, refresh: render };

})();
