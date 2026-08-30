/* daicho.js — 写真台帳（v3レイアウト）を ExcelJS で組む
 * 仕様の正本: Obsidian Vault / 40-projects/What Spot/写真台帳の作り方.md
 * daicho.py v3 の移植。ブラウザ・Node の両方で動く。
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
  var PH   = 158;   // 写真行の高さ(pt)
  var NOH  = 17;    // 番号行
  var NH   = 15;    // 記入欄1行
  var GAP  = 10;    // 段と段のすき間
  var COLW = 10.5;  // 写真列の幅(文字)
  var PAD  = 4;     // 写真と枠のすき間(px)。正本は画像高202.67px＝枠158pt−8px
  var EMU  = 9525;  // 1px = 9525 EMU
  var PER_ROW  = 2; // 1段あたりの枠数
  var ROWS_PER_PAGE = 3; // 1ページあたりの段数

  var MARU = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟㊱㊲㊳㊴㊵';

  var THIN  = { style: 'thin', color: { argb: 'FF000000' } };
  var BOX   = { top: THIN, left: THIN, bottom: THIN, right: THIN };

  function colPx(w) { return w * 7 + 5; }          // Excelの列幅 → px
  function ptToPx(pt) { return pt * 96 / 72; }

  var CELLW = colPx(COLW);                          // 78.5px
  var FRAMEW = CELLW * 4;                           // 写真枠の幅 314px
  var FRAMEH = ptToPx(PH);                          // 写真枠の高さ 210.67px

  // 左の枠は B..E(2..5)、右の枠は G..J(7..10)
  function blockStartCol(i) { return (i % PER_ROW === 0) ? 2 : 7; }

  function setFont(cell, opts) {
    opts = opts || {};
    cell.font = { name: JP, size: opts.size || 10, bold: !!opts.bold, color: { argb: 'FF000000' } };
  }

  /**
   * @param {Object} o
   *   o.header  {site, work, date, weather}
   *   o.slots   [{ imageBase64, ext, w, h, notes:[3] }]  画像なしなら imageBase64 を省く
   * @returns Promise<ArrayBuffer|Buffer>
   */
  function build(o) {
    o = o || {};
    var header = o.header || {};
    var slots = o.slots || [];

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
    ws.getColumn(1).width = 0.9;
    for (var c = 2; c <= 5; c++) ws.getColumn(c).width = COLW;
    ws.getColumn(6).width = 1.4;
    for (var c2 = 7; c2 <= 10; c2++) ws.getColumn(c2).width = COLW;
    ws.getColumn(11).width = 0.9;

    // ---- ヘッダー（1ページ目だけ） ----
    ws.mergeCells('B1:J1');
    var t = ws.getCell('B1');
    t.value = '写 真 台 帳';
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
    field(3, 'B3', '現 場 名', 'C3:E3', header.site);
    field(3, 'G3', '作業種別', 'H3:J3', header.work);
    field(4, 'B4', '作 業 日', 'C4:E4', header.date);
    field(4, 'G4', '天　　候', 'H4:J4', header.weather);
    ws.getRow(5).height = GAP;

    // ---- 写真ブロック ----
    var HEADER_ROWS = 5;
    var BLOCK_ROWS = 5;          // 写真 / 番号 / 記入欄×3
    var TIER_ROWS = BLOCK_ROWS + 1; // + すき間行

    var tiers = Math.ceil(slots.length / PER_ROW);
    var promises = [];

    for (var tier = 0; tier < tiers; tier++) {
      // 2ページ目以降は先頭に10ptのすき間行が1本入る（正本の構造）
      var top = HEADER_ROWS + tier * TIER_ROWS + Math.floor(tier / ROWS_PER_PAGE) + 1; // 写真行(1始まり)
      if (tier % ROWS_PER_PAGE === 0 && tier > 0) ws.getRow(top - 1).height = GAP;
      ws.getRow(top).height = PH;
      ws.getRow(top + 1).height = NOH;
      ws.getRow(top + 2).height = NH;
      ws.getRow(top + 3).height = NH;
      ws.getRow(top + 4).height = NH;
      ws.getRow(top + 5).height = GAP;

      for (var k = 0; k < PER_ROW; k++) {
        var idx = tier * PER_ROW + k;
        if (idx >= slots.length) break;
        var slot = slots[idx] || {};
        var c0 = blockStartCol(idx);
        var c1 = c0 + 3;
        drawBlock(ws, wb, top, c0, c1, idx, slot, promises);
      }

      // 3段ごとに改ページ
      if ((tier + 1) % ROWS_PER_PAGE === 0 && tier + 1 < tiers) {
        ws.getRow(top + 5).addPageBreak();
      }
    }

    // フッター（ページ番号）
    ws.headerFooter = { oddFooter: '&C&"' + JP + ',Regular"&9 &P / &N' };

    return wb.xlsx.writeBuffer();
  }

  function colLetter(n) {
    var s = '';
    while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = ((n - m) / 26) | 0; }
    return s;
  }

  function drawBlock(ws, wb, top, c0, c1, idx, slot, promises) {
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

    // 記入欄3行（ラベルなし・空欄）
    var notes = slot.notes || [];
    for (var i = 0; i < 3; i++) {
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
      var availW = FRAMEW - PAD * 2;
      var availH = FRAMEH - PAD * 2;
      var s = Math.min(availW / slot.w, availH / slot.h);
      var dw = slot.w * s, dh = slot.h * s;
      var offX = (FRAMEW - dw) / 2;
      var offY = (FRAMEH - dh) / 2;

      // EMU で直接指定する（tl の小数はライブラリ側の換算に依存して当てにならない）
      // tl+ext（oneCellAnchor）は使わない：ExcelJS が editAs を必ず書き込み、
      // その editAs は仕様上 twoCellAnchor 専用のため Excel が「修復」して画像を全部消す（exceljs#2777）。
      // tl+br の twoCellAnchor なら editAs="oneCell" が正当。位置とサイズはEMUで厳密に同じ。
      function anchorX(px) {
        var n = Math.floor(px / CELLW + 1e-9);
        return { col: (c0 - 1) + n, off: Math.round((px - n * CELLW) * EMU) };
      }
      var a0 = anchorX(offX), a1 = anchorX(offX + dw);
      var id = wb.addImage({ base64: slot.imageBase64, extension: slot.ext || 'jpeg' });
      ws.addImage(id, {
        tl: { nativeCol: a0.col, nativeColOff: a0.off, nativeRow: (top - 1), nativeRowOff: Math.round(offY * EMU) },
        br: { nativeCol: a1.col, nativeColOff: a1.off, nativeRow: (top - 1), nativeRowOff: Math.round((offY + dh) * EMU) },
        editAs: 'oneCell'
      });
    }
  }

  return { build: build, MARU: MARU, JP: JP };
});
