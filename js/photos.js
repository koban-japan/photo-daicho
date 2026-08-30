/* photos.js — 写真の読み込み・HEIC変換・縮小・コンタクトシート生成
 * 重い処理はすべてブラウザ側で行う（サーバーに原本を送らないため）
 */
(function (root) {
  'use strict';
  var APP = root.APP = root.APP || {};

  var PREVIEW_MAX = 520;   // 選別用プレビューの長辺
  var EMBED_MAX   = 1200;  // 台帳に貼る画像の長辺
  var EMBED_Q     = 0.78;  // 台帳に貼る画像の JPEG 品質
  var SHEET_COLS  = 5;     // コンタクトシートの列
  var SHEET_ROWS  = 4;     // コンタクトシートの行（＝1枚に20コマ）
  var CELL        = 280;   // コンタクトシート1コマの1辺(px)
  var LABEL_H     = 22;

  function isHeic(file) {
    var n = (file.name || '').toLowerCase();
    return /\.(heic|heif)$/.test(n) || file.type === 'image/heic' || file.type === 'image/heif';
  }

  function loadBitmap(blob) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); res(img); };
      img.onerror = function (e) { URL.revokeObjectURL(url); rej(e); };
      img.src = url;
    });
  }

  function fit(w, h, max) {
    var s = Math.min(1, max / Math.max(w, h));
    return { w: Math.round(w * s), h: Math.round(h * s) };
  }

  function drawToJpeg(img, max, q) {
    var d = fit(img.naturalWidth || img.width, img.naturalHeight || img.height, max);
    var cv = document.createElement('canvas');
    cv.width = d.w; cv.height = d.h;
    cv.getContext('2d').drawImage(img, 0, 0, d.w, d.h);
    return { dataUrl: cv.toDataURL('image/jpeg', q), w: d.w, h: d.h };
  }

  /** File[] → [{name, prevDataUrl, prevW, prevH, embedDataUrl, embedW, embedH}] */
  function ingest(files, onProgress) {
    var out = [];
    var list = Array.prototype.slice.call(files).sort(function (a, b) {
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
    var i = 0;
    function step() {
      if (i >= list.length) return Promise.resolve(out);
      var f = list[i];
      var p = isHeic(f)
        ? root.heic2any({ blob: f, toType: 'image/jpeg', quality: 0.9 })
        : Promise.resolve(f);
      return p.then(loadBitmap).then(function (img) {
        var prev = drawToJpeg(img, PREVIEW_MAX, 0.7);
        var emb = drawToJpeg(img, EMBED_MAX, EMBED_Q);
        out.push({
          name: f.name,
          prevDataUrl: prev.dataUrl, prevW: prev.w, prevH: prev.h,
          embedDataUrl: emb.dataUrl, embedW: emb.w, embedH: emb.h,
          use: false, notes: ['', '', '']
        });
      }).catch(function (e) {
        console.warn('読み込めなかった:', f.name, e);
      }).then(function () {
        i++;
        if (onProgress) onProgress(i, list.length);
        return step();
      });
    }
    return step();
  }

  /**
   * 選別用のコンタクトシートを作る。20コマで1枚。
   * 1枚 = 1400x1208px 程度 → Claude の画像トークンは約2,000。
   * 134枚を1枚ずつ送るより20倍安い。
   */
  function loadImg(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = rej;
      im.src = src;
    });
  }

  function contactSheets(photos) {
    var per = SHEET_COLS * SHEET_ROWS;
    var jobs = [];
    for (var s = 0; s * per < photos.length; s++) jobs.push(s);

    return jobs.reduce(function (chain, s) {
      return chain.then(function (acc) {
        var chunk = photos.slice(s * per, (s + 1) * per);
        var rows = Math.ceil(chunk.length / SHEET_COLS);
        var cv = document.createElement('canvas');
        cv.width = SHEET_COLS * CELL;
        cv.height = rows * (CELL + LABEL_H);
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.fillStyle = '#000'; ctx.font = '16px sans-serif'; ctx.textBaseline = 'top';

        return Promise.all(chunk.map(function (p) { return loadImg(p.prevDataUrl); }))
          .then(function (imgs) {
            imgs.forEach(function (img, k) {
              var cx = (k % SHEET_COLS) * CELL;
              var cy = Math.floor(k / SHEET_COLS) * (CELL + LABEL_H);
              var d = fit(chunk[k].prevW, chunk[k].prevH, CELL - 8);
              ctx.drawImage(img, cx + (CELL - d.w) / 2, cy + (CELL - d.h) / 2, d.w, d.h);
              ctx.fillText('#' + (s * per + k + 1), cx + 6, cy + CELL + 3);
            });
            acc.push({
              dataUrl: cv.toDataURL('image/jpeg', 0.75),
              from: s * per + 1, to: s * per + chunk.length
            });
            return acc;
          });
      });
    }, Promise.resolve([]));
  }

  APP.photos = { ingest: ingest, contactSheets: contactSheets, PREVIEW_MAX: PREVIEW_MAX, EMBED_MAX: EMBED_MAX };
})(typeof self !== 'undefined' ? self : this);
