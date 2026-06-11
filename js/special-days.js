/**
 * special-days.js — Yaklaşan özel günler geri sayımı.
 *
 * Üç kart gösterir:
 *   💞 Sıradaki aylık yıldönümü (her ayın 15'i)
 *   💍 Sıradaki yıl dönümü (15 Ağustos)
 *   🎈 Sıradaki 100'lük gün kilometre taşı (700. gün, 800. gün…)
 *
 * Özel günün kendisinde kart "Bugün!" durumuna geçer ve konfeti patlar.
 * Gece yarısında otomatik yenilenir.
 *
 * spawnConfetti → utils.js'deki global yardımcı.
 * Public API: specialDays.init()
 */
const specialDays = (function () {

  const START_YEAR  = 2024;
  const START_MONTH = 7;   // Ağustos (0 tabanlı)
  const START_DAY   = 15;
  const MS_PER_DAY  = 86400000;
  const MILESTONE_STEP = 100;

  function atMidnight(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function startDate() {
    return new Date(START_YEAR, START_MONTH, START_DAY);
  }

  function daysUntil(target, today) {
    return Math.round((atMidnight(target) - today) / MS_PER_DAY);
  }

  /* ── Özel gün hesaplamaları ──────────────────────── */

  function nextMonthsary(today) {
    let d = new Date(today.getFullYear(), today.getMonth(), START_DAY);
    if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, START_DAY);

    let months = (d.getFullYear() - START_YEAR) * 12 + (d.getMonth() - START_MONTH);

    /* Yıl dönümüyle çakışırsa (12'nin katı) bir sonraki aya geç —
       o gün zaten yıl dönümü kartıyla kutlanıyor */
    if (months % 12 === 0) {
      d = new Date(d.getFullYear(), d.getMonth() + 1, START_DAY);
      months += 1;
    }

    return { emoji: '💞', title: months + '. Ay Dönümümüz', date: d };
  }

  function nextAnniversary(today) {
    let d = new Date(today.getFullYear(), START_MONTH, START_DAY);
    if (d < today) d = new Date(today.getFullYear() + 1, START_MONTH, START_DAY);
    const years = d.getFullYear() - START_YEAR;
    return { emoji: '💍', title: years + '. Yıl Dönümümüz', date: d };
  }

  function nextMilestone(today) {
    const daysSince = Math.round((today - startDate()) / MS_PER_DAY);
    const target = (daysSince > 0 && daysSince % MILESTONE_STEP === 0)
      ? daysSince
      : Math.ceil((daysSince + 1) / MILESTONE_STEP) * MILESTONE_STEP;
    const d = new Date(startDate().getTime() + target * MS_PER_DAY);
    return { emoji: '🎈', title: target + '. Günümüz', date: d };
  }

  /* ── Render ──────────────────────────────────────── */

  function formatTr(d) {
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function createCardEl(item, today) {
    const left    = daysUntil(item.date, today);
    const isToday = left === 0;

    const el = document.createElement('div');
    el.className = 'sd-card' + (isToday ? ' sd-card--today' : '');

    const countHtml = isToday
      ? '<span class="sd-count sd-count--today">Bugün! 🎉</span>'
      : '<span class="sd-count"><strong>' + left + '</strong><small>gün kaldı</small></span>';

    el.innerHTML =
      '<span class="sd-emoji" aria-hidden="true">' + item.emoji + '</span>' +
      '<div class="sd-info">' +
        '<span class="sd-title">' + item.title + '</span>' +
        '<span class="sd-date">' + formatTr(item.date) + '</span>' +
      '</div>' +
      countHtml;

    return el;
  }

  function render() {
    const wrap = document.getElementById('specialDays');
    if (!wrap) return;
    wrap.innerHTML = '';

    const today = atMidnight(new Date());
    const items = [nextMonthsary(today), nextAnniversary(today), nextMilestone(today)]
      .sort(function (a, b) { return a.date - b.date; });

    const frag = document.createDocumentFragment();

    const heading = document.createElement('p');
    heading.className   = 'sd-heading';
    heading.textContent = 'Yaklaşan Özel Günlerimiz';
    frag.appendChild(heading);

    const row = document.createElement('div');
    row.className = 'sd-row';
    items.forEach(function (item) { row.appendChild(createCardEl(item, today)); });
    frag.appendChild(row);

    wrap.appendChild(frag);

    /* Bugün özel günse kutla (sayfa açılışında bir kez) */
    if (items.some(function (it) { return daysUntil(it.date, today) === 0; })) {
      setTimeout(function () {
        if (typeof spawnConfetti === 'function') spawnConfetti();
      }, 900);
    }
  }

  /* ── Gece yarısı yenileme ────────────────────────── */

  function scheduleMidnightRefresh() {
    const now      = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    setTimeout(function () {
      render();
      scheduleMidnightRefresh();
    }, midnight - now);
  }

  /* ── Init ────────────────────────────────────────── */

  function init() {
    if (!document.getElementById('specialDays')) return;
    render();
    scheduleMidnightRefresh();
  }

  return { init };

})();
