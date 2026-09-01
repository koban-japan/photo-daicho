/* daicho.js — 写真台帳を ExcelJS で組む
 * 仕様の正本: Obsidian Vault / 40-projects/What Spot/写真台帳の作り方.md
 * daicho.py v3 の移植。ブラウザ・Node の両方で動く。
 *
 * ⚠️ 既定（1ページ6枠）の出力は v3 と1バイトも変えないこと。
 *    tools/verify.js が手作業の正本と突き合わせている。
 */
(function (root, factory) {
  var ExcelJS = (typeof require === 'function') ? require('exceljs') : root.ExcelJS;
  var mod = factory(ExcelJS);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else { root.APP = root.APP || {}; root.APP.daicho = mod; }
})(typeof self !== 'undefined' ? self : this, function (ExcelJS) {
  'use strict';

  // ---- 調整値（daicho.py v3 と同じ） ----
  var JP   = 'ＭＳ Ｐゴシック';
  var NOH  = 17;    // 番号行の高さ(pt)
  var NH   = 15;    // 記入欄1行の高さ(pt)
  var GAP  = 10;    // 段と段のすき間(pt)
  var COLW = 10.5;  // 写真列の幅(文字)
  var PAD  = 4;     // 写真と枠のすき間(px)。正本は画像高202.67px＝枠158pt−8px
  var EMU  = 9525;  // 1px = 9525 EMU

  var MARU = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟㊱㊲㊳㊴㊵';

  var THIN  = { style: 'thin', color: { argb: 'FF000000' } };
  var BOX   = { top: THIN, left: THIN, bottom: THIN, right: THIN };

  function colPx(w) { return w * 7 + 5; }          // Excelの列幅 → px
  function ptToPx(pt) { return pt * 96 / 72; }

  // 列の構成は固定：A(0.9) B–E(10.5) F(1.4) G–J(10.5) K(0.9)
  var COL_W = [0.9, COLW, COLW, COLW, COLW, 1.4, COLW, COLW, COLW, COLW, 0.9];
  var COL_PX = COL_W.map(colPx);

  /**
   * 1ページあたりの枠数ごとのレイアウト。
   * ph（写真行の高さpt）は A4縦の印刷可能高さに収まる範囲で決めてある。
   *   1ページ目の使える高さ ≒ 708pt（A4 841.89pt − 余白 − ヘッダー5行82pt）
   *   1段の高さ ＝ ph + 番号17 + 記入欄15×3 + すき間10 ＝ ph + 72
   * 6枠：3段 × (158+72) = 690pt ≦ 708 … v3。ここは絶対に変えない
   */
  var LAYOUTS = {
    6: { cols: 2, rows: 3, ph: 158 },  // 既定（v3）
    4: { cols: 2, rows: 2, ph: 270 },
    3: { cols: 1, rows: 3, ph: 158 },  // 公共工事の標準（着手前・施工状況・完了）
    2: { cols: 2, rows: 1, ph: 270 },  // 前後対比を横に並べる
    1: { cols: 1, rows: 1, ph: 360 }
  };

  function layoutOf(perPage) {
    return LAYOUTS[perPage] || LAYOUTS[6];
  }

  // 枠の開始列（1始まり）。2列なら B(2) と G(7)、1列なら B(2) のみ
  function blockStartCol(idxInTier, cols) {
    return (cols === 1 || idxInTier === 0) ? 2 : 7;
  }
  // 枠の終了列。2列なら +3（B–E / G–J）、1列なら J(10)
  function blockEndCol(c0, cols) {
    return cols === 1 ? 10 : c0 + 3;
  }

  function frameWidthPx(c0, c1) {
    var w = 0;
    for (var i = c0 - 1; i <= c1 - 1; i++) w += COL_PX[i];
    return w;
  }

  /** 枠の左端(c0)から px だけ右の位置を、列インデックス＋オフセットEMU で返す */
  function anchorAt(c0, px) {
    var i = c0 - 1;
    while (i < COL_PX.length - 1 && px >= COL_PX[i] - 1e-9) { px -= COL_PX[i]; i++; }
    return { col: i, off: Math.round(px * EMU) };
  }

  function setFont(cell, opts) {
    opts = opts || {};
    cell.font = { name: JP, size: opts.size || 10, bold: !!opts.bold, color: { argb: 'FF000000' } };
  }

  function colLetter(n) {
    var s = '';
    while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = ((n - m) / 26) | 0; }
    return s;
  }

  /**
   * @param {Object} o
   *   o.header    {site, work, date, weather}   ← 既定の4項目
   *   o.fields    [{label, value} ×4]           ← ラベルを差し替えたいとき（テンプレ用）。header より優先
   *   o.title     表題。既定 '写 真 台 帳'
   *   o.perPage   1ページの枠数（1/2/3/4/6）。既定 6
   *   o.noteLines 記入欄の行数。既定 3
   *   o.slots     [{ imageBase64, ext, w, h, notes:[] }]  画像なしなら imageBase64 を省く
   * @returns Promise<ArrayBuffer|Buffer>
   */
  function build(o) {
    o = o || {};
    var header = o.header || {};
    var slots = o.slots || [];
    var lay = layoutOf(o.perPage || 6);
    var noteLines = o.noteLines || 3;
    var perTier = lay.cols;
    var PH = lay.ph;

    var wb = new ExcelJS.Workbook();
    var ws = wb.addWorksheet('写真台帳', {
      pageSetup: {
        paperSize: 9,             // A4
        orientation: 'portrait',
        fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        margins: { left: 0.3, right: 0.3, top: 0.35, bottom: 0.3, header: 0.15, footer: 0.15 }
      }
    });

    // 列幅
    for (var ci = 0; ci < COL_W.length; ci++) ws.getColumn(ci + 1).width = COL_W[ci];

    // ---- ヘッダー（1ページ目だけ） ----
    ws.mergeCells('B1:J1');
    var t = ws.getCell('B1');
    t.value = o.title || '写 真 台 帳';
    setFont(t, { size: 16, bold: true });
    t.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 26;
    ws.getRow(2).height = 6;

    function field(row, labelCell, label, valMerge, value) {
      var lc = ws.getCell(labelCell);
      lc.value = label; setFont(lc);
      lc.alignment = { horizontal: 'center', vertical: 'middle' };
      lc.border = BOX;
      ws.mergeCells(valMerge);
      var vc = ws.getCell(valMerge.split(':')[0]);
      vc.value = value || '';
      setFont(vc);
      vc.alignment = { horizontal: 'left', vertical: 'middle' };
      vc.border = BOX;
      ws.getRow(row).height = 20;
    }
    var f = o.fields || [
      { label: '現 場 名', value: header.site },
      { label: '作業種別', value: header.work },
      { label: '作 業 日', value: header.date },
      { label: '天　　候', value: header.weather }
    ];
    field(3, 'B3', f[0] && f[0].label, 'C3:E3', f[0] && f[0].value);
    field(3, 'G3', f[1] && f[1].label, 'H3:J3', f[1] && f[1].value);
    field(4, 'B4', f[2] && f[2].label, 'C4:E4', f[2] && f[2].value);
    field(4, 'G4', f[3] && f[3].label, 'H4:J4', f[3] && f[3].value);
    ws.getRow(5).height = GAP;

    // ---- 写真ブロック ----
    var HEADER_ROWS = 5;
    var TIER_ROWS = noteLines + 3;   // 写真 / 番号 / 記入欄×n / すき間

    var tiers = Math.ceil(slots.length / perTier);

    for (var tier = 0; tier < tiers; tier++) {
      // 2ページ目以降は先頭に10ptのすき間行が1本入る（正本の構造）
      var top = HEADER_ROWS + tier * TIER_ROWS + Math.floor(tier / lay.rows) + 1;
      if (tier % lay.rows === 0 && tier > 0) ws.getRow(top - 1).height = GAP;
      ws.getRow(top).height = PH;
      ws.getRow(top + 1).height = NOH;
      for (var nl = 0; nl < noteLines; nl++) ws.getRow(top + 2 + nl).height = NH;
      ws.getRow(top + 2 + noteLines).height = GAP;

      for (var k = 0; k < perTier; k++) {
        var idx = tier * perTier + k;
        if (idx >= slots.length) break;
        var c0 = blockStartCol(k, lay.cols);
        var c1 = blockEndCol(c0, lay.cols);
        drawBlock(ws, wb, top, c0, c1, idx, slots[idx] || {}, noteLines, PH);
      }

      // ページの最終段のあとに改ページ
      if ((tier + 1) % lay.rows === 0 && tier + 1 < tiers) {
        ws.getRow(top + 2 + noteLines).addPageBreak();
      }
    }

    // フッター（ページ番号）
    ws.headerFooter = { oddFooter: '&C&"' + JP + ',Regular"&9 &P / &N' };

    return wb.xlsx.writeBuffer();
  }

  function drawBlock(ws, wb, top, c0, c1, idx, slot, noteLines, PH) {
    var L = colLetter(c0), R = colLetter(c1);

    // 写真セル
    ws.mergeCells(L + top + ':' + R + top);
    ws.getCell(L + top).border = BOX;

    // 番号セル（「画像①」・太字・写真の下・右寄せ）
    ws.mergeCells(L + (top + 1) + ':' + R + (top + 1));
    var nc = ws.getCell(L + (top + 1));
    nc.value = '画像' + (MARU.charAt(idx) || String(idx + 1));
    nc.font = { name: JP, size: 10, bold: true, color: { argb: 'FF000000' } };
    nc.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
    nc.border = BOX;

    // 記入欄（ラベルなし・空欄）
    var notes = slot.notes || [];
    for (var i = 0; i < noteLines; i++) {
      var r = top + 2 + i;
      ws.mergeCells(L + r + ':' + R + r);
      var cell = ws.getCell(L + r);
      cell.value = notes[i] || '';
      cell.font = { name: JP, size: 10, color: { argb: 'FF000000' } };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.border = BOX;
    }

    // 画像を枠内に中央配置（縦横比を保つ）
    if (slot.imageBase64 && slot.w && slot.h) {
      var frameW = frameWidthPx(c0, c1);
      var frameH = ptToPx(PH);
      var availW = frameW - PAD * 2;
      var availH = frameH - PAD * 2;
      var s = Math.min(availW / slot.w, availH / slot.h);
      var dw = slot.w * s, dh = slot.h * s;
      var offX = (frameW - dw) / 2;
      var offY = (frameH - dh) / 2;

      // EMU で直接指定する（tl の小数はライブラリ側の換算に依存して当てにならない）
      // tl+ext（oneCellAnchor）は使わない：ExcelJS が editAs を必ず書き込み、
      // その editAs は仕様上 twoCellAnchor 専用のため Excel が「修復」して画像を全部消す（exceljs#2777）。
      var a0 = anchorAt(c0, offX), a1 = anchorAt(c0, offX + dw);
      var id = wb.addImage({ base64: slot.imageBase64, extension: slot.ext || 'jpeg' });
      ws.addImage(id, {
        tl: { nativeCol: a0.col, nativeColOff: a0.off, nativeRow: (top - 1), nativeRowOff: Math.round(offY * EMU) },
        br: { nativeCol: a1.col, nativeColOff: a1.off, nativeRow: (top - 1), nativeRowOff: Math.round((offY + dh) * EMU) },
        editAs: 'oneCell'
      });
    }
  }

  return { build: build, MARU: MARU, JP: JP, LAYOUTS: LAYOUTS };
});
