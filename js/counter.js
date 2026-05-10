/**
 * counter.js — İlişki süresi sayacı.
 *
 * Belirli bir başlangıç tarihinden bu yana geçen
 * gün / saat / dakika / saniyeyi her saniye günceller.
 */
const counter = (function () {

  /* ── Sabitler ─────────────────────────────────────── */
  const START_DATE      = new Date('2024-08-15T02:35:00');
  const SECS_PER_DAY   = 86400;
  const SECS_PER_HOUR  = 3600;
  const SECS_PER_MIN   = 60;
  const MS_PER_SEC     = 1000;
  const TICK_DURATION  = 150;   // animasyon süresi (ms)
  const UPDATE_INTERVAL = 1000; // güncelleme sıklığı (ms)

  let intervalId = null;

  /* ── Yardımcılar ─────────────────────────────────── */

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function calcElapsed() {
    const totalMs      = Math.max(0, Date.now() - START_DATE.getTime());
    const totalSeconds = Math.floor(totalMs / MS_PER_SEC);
    return {
      days:    Math.floor(totalSeconds / SECS_PER_DAY),
      hours:   Math.floor((totalSeconds % SECS_PER_DAY)  / SECS_PER_HOUR),
      minutes: Math.floor((totalSeconds % SECS_PER_HOUR) / SECS_PER_MIN),
      seconds: totalSeconds % SECS_PER_MIN,
    };
  }

  /* Saniye değiştiğinde kısa bir büyüme animasyonu tetikler */
  function flashTick(el) {
    el.classList.remove('tick');
    void el.offsetWidth; // reflow zorla — animasyonu sıfırla
    el.classList.add('tick');
    setTimeout(() => el.classList.remove('tick'), TICK_DURATION);
  }

  /* ── DOM güncelleme ──────────────────────────────── */

  function updateDisplay() {
    const { days, hours, minutes, seconds } = calcElapsed();
    document.getElementById('valueDays').textContent    = days;
    document.getElementById('valueHours').textContent   = pad(hours);
    document.getElementById('valueMinutes').textContent = pad(minutes);

    const secEl = document.getElementById('valueSeconds');
    secEl.textContent = pad(seconds);
    flashTick(secEl);
  }

  /* ── Init ────────────────────────────────────────── */

  function init() {
    updateDisplay();
    intervalId = setInterval(updateDisplay, UPDATE_INTERVAL);
  }

  return { init };

})();
