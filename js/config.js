/* config.js — 調整値だけを置く */
(function (root) {
  // Cloudflare Workers のURL。空ならAI機能は無効（手で選ぶモード）。
  root.DAICHO_API = '';
  // 無料で使える枚数の上限。超えたら課金へ誘導する。
  root.DAICHO_FREE_LIMIT = 10;
})(typeof self !== 'undefined' ? self : this);
