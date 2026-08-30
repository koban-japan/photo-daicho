/* ai.js — AI選別・記入欄の文案。Cloudflare Workers 経由で Claude API を呼ぶ。
 * ⚠️ APIキーは絶対にここに書かない。Worker 側だけが持つ。
 * ⚠️ AI は「案を出す」までで、確定は人間。返り値はすべて画面で編集できる前提。
 */
(function (root) {
  'use strict';
  var APP = root.APP = root.APP || {};

  var ENDPOINT = (root.DAICHO_API || '') + '/api/suggest';

  function post(body) {
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('API ' + r.status + ': ' + t); });
      return r.json();
    });
  }

  /**
   * 選別：コンタクトシートを渡し、使う写真の番号と並び順の案をもらう。
   * @returns Promise<{picks:[{n, reason, note}], order:[n]}>
   */
  function select(sheets, ctx) {
    return post({
      task: 'select',
      context: ctx,                       // {site, work, date, weather, want}
      sheets: sheets.map(function (s) {
        return { from: s.from, to: s.to, image: s.dataUrl.split(',')[1] };
      })
    });
  }

  /**
   * 記入欄の文案：選んだ写真を個別に渡し、1行目に入れる短い名前をもらう。
   * @returns Promise<{notes:{[n]: string}}>
   */
  function caption(picked, ctx) {
    return post({
      task: 'caption',
      context: ctx,
      photos: picked.map(function (p) {
        return { n: p.n, image: p.prevDataUrl.split(',')[1] };
      })
    });
  }

  APP.ai = { select: select, caption: caption, endpoint: function () { return ENDPOINT; } };
})(typeof self !== 'undefined' ? self : this);
