/* templates.js — 業種別テンプレート
 *
 * 「業界を選ぶのではなくテンプレートを増やす」（2026-08-30 方針転換）。
 * 器は共通で、変わるのは次の5つだけ：
 *   perPage    1ページの枠数
 *   title      表題
 *   fields     ヘッダー4項目のラベルと例
 *   checklist  撮影項目（撮り忘れ防止。記入欄1行目の候補にもなる）
 *   pair       前後対比モード（2枚1組で左右に並べる）
 *
 * ⚠️ checklist の中身は「実務でそう決まっている」ことの写しであって、AIの創作ではない。
 *    根拠のない項目を足さないこと。各テンプレの source: に出典を書く。
 *    調査結果の正本は docs/guidelines/ にある。
 */
(function (root) {
  'use strict';
  var APP = root.APP = root.APP || {};

  var T = [
    {
      id: 'general',
      name: '汎用（6枚／ページ）',
      desc: '決まった様式が無いとき。写真6枚・記入欄3行の標準形。',
      perPage: 6,
      pair: false,
      title: '写 真 台 帳',
      fields: [
        { key: 'site',    label: '現 場 名', ph: '○○発電所' },
        { key: 'work',    label: '作業種別', ph: '除草作業' },
        { key: 'date',    label: '作 業 日', ph: '2026年8月24日' },
        { key: 'weather', label: '天　　候', ph: '晴れ' }
      ],
      noteHints: ['記入欄 1行目', '記入欄 2行目', '記入欄 3行目'],
      checklist: [],
      source: 'Obsidian Vault / 40-projects/What Spot/写真台帳の作り方.md（v3）'
    },
    {
      id: 'solar-om',
      name: '太陽光O&M（除草・点検）',
      desc: '太陽光発電所の除草・点検。作業前→作業後の順に並べ、異常と使用薬剤を末尾に置く。',
      perPage: 6,
      pair: false,
      title: '写 真 台 帳',
      fields: [
        { key: 'site',    label: '現 場 名', ph: 'GS滑川発電所（グランデソーレー滑川）' },
        { key: 'work',    label: '作業種別', ph: '除草・除草剤散布作業' },
        { key: 'date',    label: '作 業 日', ph: '2026年8月24日（月）' },
        { key: 'weather', label: '天　　候', ph: '晴れ' }
      ],
      noteHints: ['短い名前（例：監視カメラ付近）', '', ''],
      checklist: [
        { label: '', title: '作業前', note: '①〜⑥。全景と近景の両方', blank: true },
        { label: '', title: '作業後', note: '⑦〜⑯。作業前と同じアングルで', blank: true },
        { label: '監視カメラ付近', title: '監視カメラ付近' },
        { label: '除草剤', title: '除草剤', note: '薬剤の袋と散粒器が写るもの' },
        { label: 'スズメバチの巣', title: '特記事項', note: 'ハチの巣・倒木・パネル割れなど' },
        { label: 'スズメバチの巣の位置', title: '航空写真', note: '位置を示すもの' }
      ],
      source: 'Obsidian Vault / 40-projects/What Spot/写真台帳の作り方.md「写真の並べ方（2026-08 GS滑川の実例）」'
    }
  ];

  function byId(id) {
    for (var i = 0; i < T.length; i++) if (T[i].id === id) return T[i];
    return T[0];
  }

  APP.templates = { list: T, byId: byId };
})(typeof self !== 'undefined' ? self : this);
