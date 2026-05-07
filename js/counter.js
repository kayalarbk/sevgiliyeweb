/**
 * counter.js — Relationship anniversary countdown timer.
 *
 * Calculates days / hours / minutes / seconds elapsed since a user-defined
 * start date and updates the DOM every second. The chosen date is persisted
 * in localStorage so it survives page reloads.
 *
 * Public API:  counter.init()
 */
const counter = (function () {

  const STORAGE_KEY = 'love_start_date';
  let   intervalId  = null;

  /* ── Helpers ─────────────────────────────────────── */

  /** Pads a number to at least 2 characters with leading zeros. */
  function pad(n) {
    return String(n).padStart(2, '0');
  }

  /**
   * Computes the elapsed time between `startDate` and right now.
   * Returns an object with integer { days, hours, minutes, seconds }.
   */
  function calcElapsed(startDate) {
    const totalMs      = Math.max(0, Date.now() - startDate.getTime());
    const totalSeconds = Math.floor(totalMs / 1000);

    return {
      days:    Math.floor(totalSeconds / 86400),
      hours:   Math.floor((totalSeconds % 86400) / 3600),
      minutes: Math.floor((totalSeconds % 3600)  / 60),
      seconds: totalSeconds % 60,
    };
  }

  /**
   * Applies a quick CSS scale-up to an element then removes the class,
   * giving each "tick" a subtle heartbeat visual cue.
   */
  function flashTick(el) {
    el.classList.remove('tick');
    void el.offsetWidth;            // force reflow so the class removal registers
    el.classList.add('tick');
    setTimeout(() => el.classList.remove('tick'), 150);
  }

  /* ── DOM update ──────────────────────────────────── */

  /** Writes the current elapsed values to all four counter DOM nodes. */
  function updateDisplay(startDate) {
    const { days, hours, minutes, seconds } = calcElapsed(startDate);

    document.getElementById('valueDays').textContent    = days;
    document.getElementById('valueHours').textContent   = pad(hours);
    document.getElementById('valueMinutes').textContent = pad(minutes);

    const secEl = document.getElementById('valueSeconds');
    secEl.textContent = pad(seconds);
    flashTick(secEl);
  }

  /* ── Timer control ───────────────────────────────── */

  /** Clears any running interval and starts a new 1-second tick loop. */
  function startCounting(startDate) {
    clearInterval(intervalId);
    updateDisplay(startDate);
    intervalId = setInterval(() => updateDisplay(startDate), 1000);
  }

  /* ── Event handlers ──────────────────────────────── */

  // Default start datetime — shown when the user has never set a date.
  const DEFAULT_DATETIME = '2024-08-15T02:35';

  /**
   * Called when the user changes the datetime-local picker.
   * Validates, persists to localStorage, and restarts the timer.
   */
  function handleDateChange(e) {
    const value = e.target.value;
    if (!value) return;

    // datetime-local gives "YYYY-MM-DDTHH:MM" — parse as local time directly
    const date = new Date(value);
    if (isNaN(date.getTime())) return;

    localStorage.setItem(STORAGE_KEY, value);
    startCounting(date);
  }

  /* ── Public init ─────────────────────────────────── */

  /**
   * Wires up the datetime picker and restores any previously saved value.
   * Falls back to DEFAULT_DATETIME if nothing is in localStorage yet.
   * Must be called after the DOM is ready.
   */
  function init() {
    const input = document.getElementById('startDate');
    if (!input) return;

    input.addEventListener('change', handleDateChange);

    const saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_DATETIME;

    // Persist the default so a future reload still finds it
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, DEFAULT_DATETIME);
    }

    input.value = saved;
    startCounting(new Date(saved));
  }

  return { init };

})();
