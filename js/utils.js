/**
 * utils.js — Ortak yardımcılar + Supabase storage katmanı.
 *
 * Tüm modüller bu dosyadaki global fonksiyonları kullanır.
 * utils.js her zaman ilk script olarak yüklenir.
 */

/* ─────────────────────────────────────────────────────
   Supabase istemci
───────────────────────────────────────────────────── */
const SUPABASE_URL      = 'https://noqulroxrvnqcdasglng.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcXVscm94cnZucWNkYXNnbG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NDYxNDMsImV4cCI6MjA5NTEyMjE0M30.UDXdN-oebRSoD70iVBW0rhaeuD5XGI8ZbxevhJ5DWzk';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Hangi storage anahtarının hangi tabloya gittiği.
   Listede olmayan anahtarlar app_settings tablosuna gider. */
const _KEY_TABLE = {
  'love_memories': 'memories',
  'love_bucket':   'bucket',
  'announcements': 'announcements',
};

/* Session anahtarı her zaman localStorage'da kalır (auth sync gereksinimi). */
const _SESSION_KEY = 'love_session';

/* ─────────────────────────────────────────────────────
   Görsel sıkıştırma
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
   Supabase Storage — fotoğraf yükleme
   data URL alır, Storage'a upload eder, public URL döner.
   filename verilirse sabit isimle upsert yapar (ör. arkaplan).
───────────────────────────────────────────────────── */
async function uploadPhoto(dataUrl, filename) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
  try {
    const res  = await fetch(dataUrl);
    const blob = await res.blob();
    const ext  = blob.type === 'image/png' ? 'png' : 'jpg';
    const name = filename || (Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext);
    const upsertMode = !!filename;

    const { error } = await supabaseClient.storage
      .from('photos')
      .upload(name, blob, { contentType: blob.type, upsert: upsertMode });

    if (error) {
      console.error('uploadPhoto hatası:', error);
      return dataUrl;
    }

    const { data } = supabaseClient.storage.from('photos').getPublicUrl(name);
    return data.publicUrl;
  } catch (e) {
    console.error('uploadPhoto başarısız:', e);
    return dataUrl;
  }
}

/* ─────────────────────────────────────────────────────
   XSS koruması
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
   Async Supabase storage sarmalayıcı
   Tüm modüller storage.get/set/getRaw/setRaw kullanır.
───────────────────────────────────────────────────── */
const storage = {

  /** JSON obje/dizi okuma */
  async get(key, fallback) {
    if (key === _SESSION_KEY) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : (fallback !== undefined ? fallback : null);
      } catch (_) { return fallback !== undefined ? fallback : null; }
    }

    const table = _KEY_TABLE[key];
    if (table) {
      const { data, error } = await supabaseClient
        .from(table).select('data').eq('id', key).maybeSingle();
      if (error) { console.error('storage.get hatası:', key, error); return fallback; }
      return (data && data.data !== undefined && data.data !== null) ? data.data : fallback;
    }

    /* app_settings — value sütunu text, JSON olabilir */
    const { data, error } = await supabaseClient
      .from('app_settings').select('value').eq('key', key).maybeSingle();
    if (error) { console.error('storage.get(app_settings) hatası:', key, error); return fallback; }
    if (!data || data.value === null) return fallback;
    try { return JSON.parse(data.value); } catch (_) { return data.value; }
  },

  /** JSON obje/dizi yazma */
  async set(key, value) {
    if (key === _SESSION_KEY) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (_) { return false; }
    }

    const table = _KEY_TABLE[key];
    if (table) {
      const { error } = await supabaseClient.from(table)
        .upsert({ id: key, data: value, updated_at: new Date().toISOString() });
      if (error) { console.error('storage.set hatası:', key, error); return false; }
      return true;
    }

    const { error } = await supabaseClient.from('app_settings')
      .upsert({ key, value: JSON.stringify(value) });
    if (error) { console.error('storage.set(app_settings) hatası:', key, error); return false; }
    return true;
  },

  /** Ham string okuma (ör. arkaplan URL) */
  async getRaw(key) {
    if (key === _SESSION_KEY) {
      try { return localStorage.getItem(key); } catch (_) { return null; }
    }
    const { data, error } = await supabaseClient
      .from('app_settings').select('value').eq('key', key).maybeSingle();
    if (error) { console.error('storage.getRaw hatası:', key, error); return null; }
    return data ? data.value : null;
  },

  /** Ham string yazma */
  async setRaw(key, value) {
    if (key === _SESSION_KEY) {
      try { localStorage.setItem(key, value); return true; } catch (_) { return false; }
    }
    const { error } = await supabaseClient.from('app_settings')
      .upsert({ key, value });
    if (error) { console.error('storage.setRaw hatası:', key, error); return false; }
    return true;
  },

  /** Yalnızca session key için localStorage silme */
  remove(key) {
    if (key === _SESSION_KEY) {
      try { localStorage.removeItem(key); } catch (_) {}
    }
  }
};

/* ─────────────────────────────────────────────────────
   localStorage → Supabase tek seferlik veri göçü
   Uygulama ilk açıldığında localStorage'daki eski veriyi
   Supabase'e taşır. Sonraki açılışlarda hızla atlanır.
───────────────────────────────────────────────────── */
async function migrateFromLocalStorage() {
  const DONE = 'sb_migrated_v1';
  if (localStorage.getItem(DONE)) return;

  async function migrateArray(lsKey, sbKey, photoField) {
    const raw = localStorage.getItem(lsKey);
    if (!raw) return;

    /* Supabase'de zaten veri varsa dokunma */
    const existing = await storage.get(sbKey, null);
    if (existing !== null && Array.isArray(existing) && existing.length > 0) return;

    try {
      let arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;

      if (photoField === 'photos') {
        arr = await Promise.all(arr.map(async item => {
          const photos = await Promise.all((item.photos || []).map(p =>
            (p && p.startsWith('data:')) ? uploadPhoto(p) : Promise.resolve(p)
          ));
          return { ...item, photos };
        }));
      } else if (photoField === 'photo') {
        arr = await Promise.all(arr.map(async item => {
          if (item.photo && item.photo.startsWith('data:')) {
            return { ...item, photo: await uploadPhoto(item.photo) };
          }
          return item;
        }));
      } else if (photoField === 'photoUrl') {
        arr = await Promise.all(arr.map(async item => {
          if (item.photoUrl && item.photoUrl.startsWith('data:')) {
            return { ...item, photoUrl: await uploadPhoto(item.photoUrl) };
          }
          return item;
        }));
      }

      await storage.set(sbKey, arr);
    } catch (e) { console.warn('Göç hatası:', lsKey, e); }
  }

  await migrateArray('love_memories',      'love_memories',      'photos');
  await migrateArray('love_bucket',        'love_bucket',        'photo');
  await migrateArray('announcements',      'announcements',      null);
  await migrateArray('love_map_locations', 'love_map_locations', 'photoUrl');

  /* Ham string ayarları */
  for (const key of ['love_bg', 'love_theme']) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    const existing = await storage.getRaw(key);
    if (existing) continue;
    if (key === 'love_bg' && raw.startsWith('data:')) {
      const url = await uploadPhoto(raw, 'bg/background.jpg');
      await storage.setRaw(key, url);
    } else {
      await storage.setRaw(key, raw);
    }
  }

  localStorage.setItem(DONE, '1');
  console.info('localStorage → Supabase göçü tamamlandı.');
}

/* ─────────────────────────────────────────────────────
   Buton yükleme durumu
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
