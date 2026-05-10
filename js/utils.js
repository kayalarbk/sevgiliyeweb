/**
 * utils.js — Shared helpers.
 *
 * compressImage: Resizes a data-URL image to at most maxPx on its longest
 * side and re-encodes as JPEG at the given quality (0–1).
 * Typical result: a 4 MB phone photo → ~150–300 KB.
 */
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

    img.onerror = function () { resolve(dataUrl); }; // fallback: keep original
    img.src = dataUrl;
  });
}
