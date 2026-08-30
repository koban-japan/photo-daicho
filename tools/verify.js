/* verify.js — 受け入れ条件 A1〜A9 の自動チェック
 * 滑川19枚（OneDrive の sel）で台帳を生成し、手作業の正本と突き合わせる。
 * 使い方:  node tools/verify.js
 * 前提:    npm i exceljs 済み／OneDrive の What Spot が同期済み
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SEL = 'C:/Users/81805/OneDrive/What Spot/GS滑川発電所/202608_除草作業/写真/_受信/sel';
const REF = 'C:/Users/81805/OneDrive/What Spot/GS滑川発電所/202608_除草作業/【202608】【GS滑川発電所】　除草作業　写真台帳.xlsx';

const daicho = require(path.join(ROOT, 'js/daicho.js'));

function jpegSize(buf) {
  for (let i = 2; i < buf.length - 9;) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC)
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}
function unzipTo(xlsx, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  execSync(`unzip -o -q "${xlsx}" -d "${dir}"`);
}
const dec = s => s.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&');

// ---- xlsx の中身を正規化して取り出す ----
function parse(dir) {
  const read = p => fs.readFileSync(path.join(dir, p), 'utf8');
  const sheet = read('xl/worksheets/sheet1.xml');
  const styles = read('xl/styles.xml');
  let shared = [];
  try {
    shared = [...read('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)]
      .map(m => dec(m[1].replace(/<[^>]+>/g, '')));
  } catch (e) { /* inlineStr のみのブックには無い */ }

  const cols = {};
  for (const m of sheet.matchAll(/<col ([^/]*)\/>/g)) {
    const a = {};
    for (const kv of m[1].matchAll(/(\w+)="([^"]*)"/g)) a[kv[1]] = kv[2];
    for (let c = +a.min; c <= +a.max; c++) cols[c] = (+a.width).toFixed(2);
  }
  const rows = {};
  for (const m of sheet.matchAll(/<row r="(\d+)"[^>]*? ht="([0-9.]+)"/g)) rows[m[1]] = (+m[2]).toFixed(0);
  const brks = [...sheet.matchAll(/<brk id="(\d+)"/g)].map(m => +m[1]);
  const merges = [...sheet.matchAll(/<mergeCell ref="([^"]+)"\/>/g)].map(m => m[1]).sort();
  const cells = {};
  // 空セルは <c .../> と自己閉じになるので、値つきセルと分けてマッチさせる
  for (const m of sheet.matchAll(/<c r="([A-K]\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    if (m[3] === undefined) continue;
    const t = (m[2].match(/t="(\w+)"/) || [])[1];
    let v = dec(m[3].replace(/<[^>]+>/g, ''));
    if (t === 's') v = shared[+v];
    if (v) cells[m[1]] = v;
  }
  const footer = dec((sheet.match(/<oddFooter>[^<]*<\/oddFooter>/) || [''])[0]);
  const margins = (sheet.match(/<pageMargins[^/]*\/>/) || [''])[0];
  const fonts = [...styles.matchAll(/<font>([\s\S]*?)<\/font>/g)].map(m => m[1]);
  const fills = (styles.match(/patternType="solid"/g) || []).length;
  let anchors = [];
  try {
    const dr = read('xl/drawings/drawing1.xml');
    // oneCellAnchor（from+ext）と twoCellAnchor（from+to）の両方を、
    // フレーム起点からの px に正規化して比較する（アンカー表現の差を吸収）
    const pos = s => {
      const m = s.match(/<(?:xdr:)?col>(\d+)<\/(?:xdr:)?col><(?:xdr:)?colOff>(\d+)<\/(?:xdr:)?colOff><(?:xdr:)?row>(\d+)<\/(?:xdr:)?row><(?:xdr:)?rowOff>(\d+)<\/(?:xdr:)?rowOff>/);
      const col = +m[1], base = col < 6 ? 1 : 6;
      return { frame: col < 6 ? 'L' : 'R', row: +m[3], x: (col - base) * 78.5 + m[2] / 9525, y: +m[4] / 9525 };
    };
    for (const m of dr.matchAll(/<(?:xdr:)?(oneCellAnchor|twoCellAnchor)[^>]*>([\s\S]*?)<\/(?:xdr:)?\1>/g)) {
      const from = pos(m[2].match(/<(?:xdr:)?from>([\s\S]*?)<\/(?:xdr:)?from>/)[1]);
      let w, h;
      const ext = m[2].match(/<(?:xdr:)?ext cx="(\d+)" cy="(\d+)"/);
      if (ext) { w = +ext[1] / 9525; h = +ext[2] / 9525; }
      else {
        const to = pos(m[2].match(/<(?:xdr:)?to>([\s\S]*?)<\/(?:xdr:)?to>/)[1]);
        w = to.x - from.x; h = to.y - from.y;
      }
      anchors.push({ frame: from.frame, row: from.row, x: +from.x.toFixed(1), y: +from.y.toFixed(1), w: +w.toFixed(1), h: +h.toFixed(1) });
    }
  } catch (e) { /* 画像なし */ }
  return { cols, rows, brks, merges, cells, footer, margins, fonts, fills, anchors };
}

async function main() {
  // ---- 生成 ----
  const files = fs.readdirSync(SEL).filter(f => /\.jpe?g$/i.test(f)).sort();
  const slots = files.map(f => {
    const buf = fs.readFileSync(path.join(SEL, f));
    const sz = jpegSize(buf);
    return { imageBase64: buf.toString('base64'), ext: 'jpeg', w: sz.w, h: sz.h, notes: ['', '', ''] };
  });
  slots[16].notes[0] = '監視カメラ付近';
  slots[17].notes[0] = '除草剤';
  slots[18].notes[0] = 'スズメバチの巣';

  const buf = await daicho.build({
    header: {
      site: 'GS滑川発電所（グランデソーレー滑川）',
      work: '除草・除草剤散布作業',
      date: '2026年8月24日（月）',
      weather: '晴れ'
    },
    slots
  });

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'daicho-verify-'));
  const out = path.join(tmp, 'gen.xlsx');
  fs.writeFileSync(out, Buffer.from(buf));
  unzipTo(out, path.join(tmp, 'gen_x'));
  unzipTo(REF, path.join(tmp, 'ref_x'));
  const ref = parse(path.join(tmp, 'ref_x'));
  const gen = parse(path.join(tmp, 'gen_x'));

  // ---- 判定 ----
  let pass = 0, fail = 0;
  const check = (name, r, g) => {
    const ok = JSON.stringify(r) === JSON.stringify(g);
    ok ? pass++ : fail++;
    console.log((ok ? '  OK  ' : '  NG  ') + name);
    if (!ok) {
      console.log('      ref:', JSON.stringify(r).slice(0, 400));
      console.log('      gen:', JSON.stringify(g).slice(0, 400));
    }
  };

  console.log('--- A1 構造（列・行・改ページ） ---');
  check('列幅', ref.cols, gen.cols);
  check('行高', ref.rows, gen.rows);
  check('A9: 改ページ＝4ページ構成', ref.brks, gen.brks);

  console.log('--- A3/A4/A5 セルの値 ---');
  const diffs = [];
  for (const k of new Set([...Object.keys(ref.cells), ...Object.keys(gen.cells)])) {
    if ((ref.cells[k] || '') !== (gen.cells[k] || ''))
      diffs.push(k + ': ref=' + (ref.cells[k] || '(なし)') + ' gen=' + (gen.cells[k] || '(なし)'));
  }
  // 正本だけ20枚目（画像⑳＝スズメバチの巣の位置）がある
  check('セル値（正本のみの20枚目以外、完全一致）', [], diffs.filter(d => !/^G6[45]/.test(d)));
  console.log('      想定内の差分:', JSON.stringify(diffs.filter(d => /^G6[45]/.test(d))));
  check('マージ数（19枚＝正本20枚−5）', ref.merges.length, gen.merges.length + 5);

  console.log('--- A7/A8 色とフォント ---');
  check('塗りつぶしゼロ', 0, gen.fills);
  check('フォント名は ＭＳ Ｐゴシック（既定Calibriを除く）', true,
    gen.fonts.every(f => /ＭＳ Ｐゴシック|Calibri/.test(f)));
  check('サイズ構成 16太字・10・10太字', true,
    gen.fonts.some(f => /<b\/>/.test(f) && /val="16"/.test(f)) &&
    gen.fonts.some(f => !/<b\/>/.test(f) && /val="10"/.test(f)) &&
    gen.fonts.some(f => /<b\/>/.test(f) && /val="10"/.test(f)));

  console.log('--- A6 印刷設定 ---');
  check('余白', ref.margins, gen.margins);
  check('フッター（&P / &N）', ref.footer, gen.footer);

  console.log('--- A2 画像 ---');
  check('画像数 = 19', 19, gen.anchors.length);
  check('画像の段・左右が正本と一致', ref.anchors.slice(0, 19).map(a => a.frame + a.row), gen.anchors.map(a => a.frame + a.row));
  // oneCellAnchor に editAs があると Excel が修復して画像を全部消す（exceljs#2777）
  const genDr = fs.readFileSync(path.join(tmp, 'gen_x', 'xl/drawings/drawing1.xml'), 'utf8');
  check('oneCellAnchor に editAs なし', 0, (genDr.match(/oneCellAnchor editAs/g) || []).length);
  const FR_W = 78.5 * 4, FR_H = 210.7;
  check('はみ出しゼロ', [], gen.anchors.filter(a => a.x < 0 || a.y < 0 || a.x + a.w > FR_W + 1 || a.y + a.h > FR_H + 1));
  check('枠内で中央（±1px）', [], gen.anchors.filter(a =>
    Math.abs(a.x - (FR_W - a.w) / 2) > 1 || Math.abs(a.y - (FR_H - a.h) / 2) > 1));
  check('表示サイズが正本と一致（高さ202.7px）', [...new Set(ref.anchors.slice(0, 19).map(a => a.h))], [...new Set(gen.anchors.map(a => a.h))]);

  console.log('\n結果: OK=' + pass + ' NG=' + fail + (fail ? '  ← 要修正' : '  ✓ 全項目一致'));
  console.log('生成物: ' + out);
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
