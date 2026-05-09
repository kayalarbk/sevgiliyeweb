/**
 * quotes.js — Hourly romantic quote widget.
 *
 * Contains 24 quotes (one per hour of the day). The widget initialises to
 * the quote corresponding to the current hour, advances automatically at the
 * top of each subsequent hour, and also exposes a manual "next" button.
 * Quote changes use a CSS fade-out / swap / fade-in transition.
 *
 * Public API:  quotes.init()
 */
const quotes = (function () {

  /* ── Quote library (24 entries, index 0–23 maps to hours 0–23) ── */
  const QUOTES = [
    "Every love story is beautiful, but ours is my favorite.",           // 00:xx
    "You are my today and all of my tomorrows.",                         // 01:xx
    "In all the world, there is no heart for me like yours.",            // 02:xx
    "I love you not only for what you are, but for what I am with you.", // 03:xx
    "You are the finest, loveliest person I have ever known.",           // 04:xx
    "Whatever our souls are made of, yours and mine are the same.",      // 05:xx
    "I would rather spend one lifetime with you than face all the ages of this world alone.", // 06:xx
    "You are my sun, my moon, and all my stars.",                        // 07:xx
    "To love and be loved is to feel the sun from both sides.",          // 08:xx
    "The best thing to hold onto in life is each other.",                // 09:xx
    "I saw that you were perfect, and so I loved you. Then I saw that you were not perfect, and I loved you even more.", // 10:xx
    "You are every reason, every hope, and every dream I've ever had.",  // 11:xx
    "I carry your heart with me. I carry it in my heart.",               // 12:xx
    "If I know what love is, it is because of you.",                     // 13:xx
    "You are the answer to every prayer I've offered.",                  // 14:xx
    "Love is composed of a single soul inhabiting two bodies.",          // 15:xx
    "You are my paradise and I would happily get stranded on you for a lifetime.", // 16:xx
    "A hundred hearts would be too few to carry all my love for you.",   // 17:xx
    "I am yours. Don't give myself back to me.",                         // 18:xx
    "You stole my heart, but I'll let you keep it.",                     // 19:xx
    "Every moment spent with you is worth a thousand words.",            // 20:xx
    "My heart is, and always will be, yours.",                           // 21:xx
    "You make me want to be a better person.",                           // 22:xx
    "In your smile I see something more beautiful than the stars.",      // 23:xx
  ];

  /* ── State ───────────────────────────────────────── */

  let currentIdx  = new Date().getHours();  // boot on the current hour's quote
  let fadeTimeout = null;

  /* ── Rendering ───────────────────────────────────── */

  /**
   * Displays the quote at `idx` with a fade-out → swap → fade-in transition.
   * Normalises the index so callers don't need to worry about bounds.
   */
  function showQuote(idx) {
    const el = document.getElementById('quoteText');
    if (!el) return;

    const normalised = ((idx % QUOTES.length) + QUOTES.length) % QUOTES.length;
    currentIdx = normalised;

    clearTimeout(fadeTimeout);

    // Trigger CSS fade-out (opacity → 0 over --transition-slow)
    el.classList.add('fade-out');

    // After the fade-out completes, swap the text and fade back in
    fadeTimeout = setTimeout(() => {
      el.textContent = '“' + QUOTES[currentIdx] + '”';  // curly quotes
      el.classList.remove('fade-out');
    }, 600);
  }

  /* ── Manual navigation ───────────────────────────── */

  /** Advances to the next quote when the user presses the arrow button. */
  function nextQuote() {
    showQuote(currentIdx + 1);
  }

  /* ── Hourly scheduler ────────────────────────────── */

  /**
   * Calculates milliseconds until the top of the next hour, then schedules
   * an automatic quote update. Recursively calls itself to stay in sync
   * with the clock for the lifetime of the page.
   */
  function scheduleHourlyChange() {
    const now          = new Date();
    const msToNextHour =
      (59 - now.getMinutes()) * 60_000 +
      (60 - now.getSeconds()) * 1_000  -
      now.getMilliseconds();

    setTimeout(() => {
      showQuote(new Date().getHours());
      scheduleHourlyChange();
    }, msToNextHour);
  }

  /* ── Public init ─────────────────────────────────── */

  /**
   * Renders the current-hour quote immediately (no fade on first load)
   * and wires up the manual next-quote button and hourly scheduler.
   * Must be called after the DOM is ready.
   */
  function init() {
    const btn = document.getElementById('btnNextQuote');
    if (!btn) return;

    btn.addEventListener('click', nextQuote);

    // Show initial quote instantly, without transition
    const el = document.getElementById('quoteText');
    if (el) {
      el.textContent = '”' + QUOTES[currentIdx] + '”';
    }

    // Toggle widget visibility
    const toggleBtn = document.getElementById('btnToggleQuotes');
    const widget    = document.getElementById('quotesWidget');
    if (toggleBtn && widget) {
      toggleBtn.addEventListener('click', () => {
        widget.classList.toggle('quotes-hidden');
      });
    }

    scheduleHourlyChange();
  }

  return { init };

})();
