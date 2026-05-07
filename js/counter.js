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

  const START_DATE = new Date('2024-08-15T02:35:00');
  let   intervalId = null;

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function calcElapsed() {
    const totalMs      = Math.max(0, Date.now() - START_DATE.getTime());
    const totalSeconds = Math.floor(totalMs / 1000);
    return {
      days:    Math.floor(totalSeconds / 86400),
      hours:   Math.floor((totalSeconds % 86400) / 3600),
      minutes: Math.floor((totalSeconds % 3600)  / 60),
      seconds: totalSeconds % 60,
    };
  }

  function flashTick(el) {
    el.classList.remove('tick');
    void el.offsetWidth;
    el.classList.add('tick');
    setTimeout(() => el.classList.remove('tick'), 150);
  }

  function updateDisplay() {
    const { days, hours, minutes, seconds } = calcElapsed();
    document.getElementById('valueDays').textContent    = days;
    document.getElementById('valueHours').textContent   = pad(hours);
    document.getElementById('valueMinutes').textContent = pad(minutes);
    const secEl = document.getElementById('valueSeconds');
    secEl.textContent = pad(seconds);
    flashTick(secEl);
  }

  function init() {
    updateDisplay();
    intervalId = setInterval(updateDisplay, 1000);
  }

  return { init };

})();
