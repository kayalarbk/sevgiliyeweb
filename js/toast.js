/**
 * toast.js — Hafif bildirim (toast) sistemi.
 *
 * alert() yerine tema uyumlu, kendiliğinden kaybolan bildirimler.
 * Public API: showToast(message, type, durationMs)
 *   type: 'success' | 'error' | 'info' (varsayılan 'info')
 */
function showToast(message, type, durationMs) {
  type       = type || 'info';
  durationMs = durationMs || 3200;

  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id        = 'toastContainer';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  const ICONS = { success: '✓', error: '✕', info: '♥' };

  const toast = document.createElement('div');
  toast.className = 'toast toast--' + type;
  toast.setAttribute('role', 'status');
  toast.innerHTML =
    '<span class="toast-icon" aria-hidden="true">' + (ICONS[type] || ICONS.info) + '</span>' +
    '<span class="toast-message"></span>';
  toast.querySelector('.toast-message').textContent = message;

  container.appendChild(toast);

  /* En fazla 4 toast üst üste — en eskisini at */
  while (container.children.length > 4) container.firstElementChild.remove();

  requestAnimationFrame(function () {
    toast.classList.add('toast--visible');
  });

  setTimeout(function () {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', function () { toast.remove(); }, { once: true });
    setTimeout(function () { toast.remove(); }, 700); /* transitionend güvencesi */
  }, durationMs);
}
