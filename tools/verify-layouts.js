/* verify-layouts.js — 1ページ 1/2/3/4/6 枠のレイアウトが破綻していないか検査する
 * 使い方: node tools/verify-layouts.js
 *
 * 見るのは「A4に収まるか」「枠からはみ出さないか」「改ページが枚数どおりか」の3点。
 * 手作業の正本と突き合わせるのは 6枠だけ（tools/verify.js の仕事）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const daicho = require(path.join(ROOT, 'js/daicho.js'));

// A4縦 841.89pt − 上余白0.35in(25.2) − 下余白0.3in(21.6) − フッター余裕
const PAGE_AVAIL_PT = 841.89 - 25.2 - 21.6;
const HEADER_PT = 26 + 6 + 20 + 20 + 10;   // 1ページ目のヘッダー5行

// 1x1 の赤いJPEG（内容は問わない。サイズだけ使う）
const TINY_JPEG_B64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

function unzipTo(xlsx, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  execSync(`unzip -o -q "${xlsx}" -d "${dir}"`);
}

function parse(dir) {
  const read = p => fs.readFileSync(path.join(dir, p), 'utf8');
  const sheet = read('xl/worksheets/sheet1.xml');
  const rows = {};
  for (const m of sheet.matchAll(/<row r="(\d+)"[^>]*? ht="([0-9.]+)"/g)) rows[+m[1]] = +m[2];
  const brks = [...sheet.matchAll(/<brk id="(\d+)"/g)].map(m => +m[1]);
  const merges = [...sheet.matchAll(/<mergeCell ref="([^"]+)"\/>/g)].map(m => m[1]);
  const colPx = {};
  for (const m of sheet.matchAll(/<col ([^/]*)\/>/g)) {
    const a = {};
    for (const kv of m[1].matchAll(/(\w+)="([^"]*)"/g)) a[kv[1]] = kv[2];
    for (let c = +a.min; c <= +a.max; c++) colPx[c] = (+a.width) * 7 + 5;
  }
  let anchors = [];
  try {
    const dr = read('xl/drawings/drawing1.xml');
    const pos = s => {
      const m = s.match(/<(?:xdr:)?col>(\d+)<\/(?:xdr:)?col><(?:xdr:)?colOff>(\d+)<\/(?:xdr:)?colOff><(?:xdr:)?row>(\d+)<\/(?:xdr:)?row><(?:xdr:)?rowOff>(\d+)<\/(?:xdr:)?rowOff>/);
      return { col: +m[1], colOff: +m[2] / 9525, row: +m[3], rowOff: +m[4] / 9525 };
    };
    for (const m of dr.matchAll(/<(?:xdr:)?(oneCellAnchor|twoCellAnchor)[^>]*>([\s\S]*?)<\/(?:xdr:)?\1>/g)) {
      const from = pos(m[2].match(/<(?:xdr:)?from>([\s\S]*?)<\/(?:xdr:)?from>/)[1]);
      const to = pos(m[2].match(/<(?:xdr:)?to>([\s\S]*?)<\/(?:xdr:)?to>/)[1]);
      // 絶対x(px)に直す
      const absX = p => {
        let x = 0;
        for (let c = 1; c <= p.col; c++) x += colPx[c] || 0;
        return x + p.colOff;
      };
      anchors.push({
        row: from.row, x0: absX(from), x1: absX(to),
        y0: from.rowOff, y1: to.rowOff,
        editAs: /editAs/.test(m[0])
      });
    }
  } catch (e) { /* 画像なし */ }
  return { rows, brks, merges, anchors, colPx, xml: sheet };
}

async function run(perPage, n) {
  const slots = [];
  for (let i = 0; i < n; i++) {
    // 横長・縦長を交互に入れて、どちらでもはみ出さないか見る
    const landscape = i % 2 === 0;
    slots.push({
      imageBase64: TINY_JPEG_B64, ext: 'jpeg',
      w: landscape ? 1200 : 900, h: landscape ? 900 : 1200,
      notes: ['テスト', '', '']
    });
  }
  const buf = await daicho.build({
    header: { site: 'レイアウト検査', work: '検査', date: '2026-09-01', weather: '晴れ' },
    perPage, slots
  });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'daicho-lay-'));
  const out = path.join(tmp, `p${perPage}.xlsx`);
  fs.writeFileSync(out, Buffer.from(buf));
  unzipTo(out, path.join(tmp, 'x'));
  return { p: parse(path.join(tmp, 'x')), out };
}

let pass = 0, fail = 0;
function check(name, ok, detail) {
  ok ? pass++ : fail++;
  console.log((ok ? '  OK  ' : '  NG  ') + name + (ok ? '' : '\n      ' + detail));
}

async function main() {
  const L = daicho.LAYOUTS;
  for (const perPage of [1, 2, 3, 4, 6]) {
    const lay = L[perPage];
    const n = perPage * 2 + 1;           // 2ページ強ぶん入れる
    const { p } = await run(perPage, n);
    console.log(`--- 1ページ${perPage}枠（${lay.cols}列×${lay.rows}段・写真${lay.ph}pt・${n}枚） ---`);

    // 1) A4に収まるか（1ページ目＝ヘッダー＋rows段）
    const tierPt = lay.ph + 17 + 15 * 3 + 10;
    const page1 = HEADER_PT + tierPt * lay.rows;
    check('1ページ目がA4に収まる', page1 <= PAGE_AVAIL_PT,
      `必要 ${page1.toFixed(1)}pt > 使える ${PAGE_AVAIL_PT.toFixed(1)}pt`);

    // 2) 画像数
    check('画像数が枚数と一致', p.anchors.length === n, `${p.anchors.length} ≠ ${n}`);

    // 3) 改ページ数（n枚 → 必要ページ数−1）
    const pages = Math.ceil(n / perPage);
    check('改ページ数が正しい', p.brks.length === pages - 1,
      `brk ${p.brks.length} ≠ ${pages - 1}（${pages}ページのはず）`);

    // 4) 枠からのはみ出し（横）
    const frameLeft = { 1: 78.5 * 0 + 5.3, 2: 5.3 };  // 参考値。実際は下で列幅から出す
    const frameW = perPage === 3 || perPage === 1
      ? (78.5 * 4 + 14.8 + 78.5 * 4)   // B–J
      : 78.5 * 4;                       // B–E / G–J
    const over = p.anchors.filter(a => (a.x1 - a.x0) > frameW + 1);
    check('画像幅が枠幅を超えない', over.length === 0, JSON.stringify(over.slice(0, 2)));

    // 5) はみ出し（縦）
    const frameH = lay.ph * 96 / 72;
    const overY = p.anchors.filter(a => a.y1 > frameH + 1 || a.y0 < -1);
    check('画像高が枠高を超えない', overY.length === 0, JSON.stringify(overY.slice(0, 2)));

    // 6) 縦横比が保たれている（横長は 4:3、縦長は 3:4）
    const badRatio = p.anchors.filter((a, i) => {
      const want = i % 2 === 0 ? 4 / 3 : 3 / 4;
      const got = (a.x1 - a.x0) / (a.y1 - a.y0);
      return Math.abs(got - want) > 0.02;
    });
    check('縦横比が保たれている', badRatio.length === 0, JSON.stringify(badRatio.slice(0, 2)));

    // 7) editAs は twoCellAnchor 側にしか付かない（exceljs#2777 の回帰防止）
    check('oneCellAnchor に editAs なし', !/oneCellAnchor editAs/.test(p.xml), '');
  }
  console.log('\n結果: OK=' + pass + ' NG=' + fail + (fail ? '  ← 要修正' : '  ✓ 全レイアウト健全'));
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
