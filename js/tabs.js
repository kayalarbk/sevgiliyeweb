/**
 * tabs.js — "Birlikte Yaşayacaklarımız" sekme sistemi.
 *
 * Aktif sekmeyi Supabase app_settings'e kaydeder.
 * Bucket badge'ini MutationObserver ile otomatik günceller.
 * Watchlist ve Dreams kendi init()lerinde tabs.updateBadge() çağırır.
 *
 * storage → utils.js
 */
const tabs = (function () {

  const ACTIVE_TAB_KEY = 'love_active_tab';

  const TABS = [
    { id: 'bucket',    btnId: 'tabBtnBucket',    badgeId: 'tabBadgeBucket',    panelId: 'panelBucket'    },
    { id: 'watchlist', btnId: 'tabBtnWatchlist',  badgeId: 'tabBadgeWatchlist', panelId: 'panelWatchlist' },
    { id: 'dreams',    btnId: 'tabBtnDreams',     badgeId: 'tabBadgeDreams',    panelId: 'panelDreams'    },
  ];

  /* ── Badge güncelleme ────────────────────────────── */

  function updateBadge(tabId, done, total) {
    const tab = TABS.find(t => t.id === tabId);
    if (!tab) return;
    const el = document.getElementById(tab.badgeId);
    if (el) el.textContent = done + '/' + total;
  }

  /* ── Sekme aktivasyonu ───────────────────────────── */

  function activateTab(tabId, persist) {
    TABS.forEach(t => {
      const btn   = document.getElementById(t.btnId);
      const panel = document.getElementById(t.panelId);
      const isActive = t.id === tabId;

      if (btn) {
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive);
      }
      if (panel) panel.classList.toggle('active', isActive);
    });

    if (persist !== false) {
      storage.setRaw(ACTIVE_TAB_KEY, tabId);
    }
  }

  /* ── Bucket badge — MutationObserver ile ─────────── */

  function observeBucketBadge() {
    const grid = document.getElementById('bucketGrid');
    if (!grid) return;

    function recount() {
      const total = grid.querySelectorAll('.bucket-card').length;
      const done  = grid.querySelectorAll('.bucket-card.done').length;
      updateBadge('bucket', done, total);
    }

    const obs = new MutationObserver(recount);
    obs.observe(grid, { childList: true, subtree: false });
    recount();
  }

  /* ── Init ────────────────────────────────────────── */

  async function init() {
    if (!document.getElementById('tabBtnBucket')) return;

    TABS.forEach(t => {
      const btn = document.getElementById(t.btnId);
      if (btn) btn.addEventListener('click', () => activateTab(t.id));
    });

    const saved = await storage.getRaw(ACTIVE_TAB_KEY);
    const activeId = (saved && TABS.some(t => t.id === saved)) ? saved : 'bucket';
    activateTab(activeId, false);

    observeBucketBadge();
  }

  return { init, updateBadge };

})();
