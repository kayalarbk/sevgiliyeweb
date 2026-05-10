/**
 * utils.js — Tüm modüllerin kullandığı ortak yardımcılar.
 *
 * Buraya eklenen fonksiyonlar global scope'ta tanımlıdır;
 * utils.js HTML'de her zaman ilk script olarak yüklenir.
 */

/* ─────────────────────────────────────────────────────
   Görsel sıkıştırma
   Bir data-URL görselini maxPx × maxPx sınırına indirir
   ve JPEG'e dönüştürür (varsayılan %75 kalite).
───────────────────────────────────────────────────── */
function compressImage(dataUrl, maxPx, quality) {
  maxPx   = maxPx   || 1200;
  quality = quality || 0.75;

  return new Promise(function (resolve) {
    var img = new Image();

    img.onload = function () {
      var w = img.width;
      var h = img.height;

      if (w > maxPx || h > maxPx) {
        if (w >= h) { h = Math.round(h * maxPx / w); w = maxPx; }
        else        { w = Math.round(w * maxPx / h); h = maxPx; }
      }

      var canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    img.onerror = function () { resolve(dataUrl); };
    img.src = dataUrl;
  });
}

/* ─────────────────────────────────────────────────────
   XSS koruması — kullanıcı metnini güvenli hale getir
───────────────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str || '')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─────────────────────────────────────────────────────
   Tarih biçimlendirme (Türkçe)
───────────────────────────────────────────────────── */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('tr-TR', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

/* ─────────────────────────────────────────────────────
   Güvenli localStorage sarmalayıcı
   Tüm modüller try/catch yazmak yerine bunu kullanır.
───────────────────────────────────────────────────── */
const storage = {
  /* JSON obje/dizi okuma */
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  },

  /* JSON obje/dizi yazma; başarı durumunu döner */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  },

  /* Ham string okuma (örn. data URL) */
  getRaw(key) {
    try { return localStorage.getItem(key); }
    catch (_) { return null; }
  },

  /* Ham string yazma */
  setRaw(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (_) { return false; }
  },

  remove(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  }
};

/* ─────────────────────────────────────────────────────
   Buton yükleme durumu
   Async işlem sırasında butonu devre dışı bırakır,
   tamamlanınca eski haline döndürür.
───────────────────────────────────────────────────── */
function setButtonLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.origText = btn.textContent;
    btn.textContent      = 'Kaydediliyor…';
    btn.disabled         = true;
    btn.classList.add('btn-loading');
  } else {
    btn.textContent = btn.dataset.origText || btn.textContent;
    btn.disabled    = false;
    btn.classList.remove('btn-loading');
    delete btn.dataset.origText;
  }
}

/* ─────────────────────────────────────────────────────
   URL doğrulama
───────────────────────────────────────────────────── */
function isValidUrl(str) {
  if (!str) return false;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'data:';
  } catch (_) {
    return false;
  }
}
