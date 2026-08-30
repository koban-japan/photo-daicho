# photo-daicho — Claude への指示

太陽光発電所の**写真台帳（Excel）**を作るツール。写真を選ばせ、記入欄の文案を出させ、Excelにして落とす。

## 壊してはいけない前提

- **ビルド工程を作らない。** `index.html` をダブルクリックで動くこと
- **ES Modules を使わない。** `file://` で開けなくなる。即時関数 ＋ `window.APP` に集約
- **実行時に外部へ通信しない**（AI機能を除く）。ライブラリは `vendor/` に同梱済み
- **`vendor/` は触らない**（exceljs.min.js / heic2any.min.js）
- **APIキーをフロントに置かない。** `worker/` だけが持つ

## ファイルの役割

| | |
|---|---|
| `js/config.js` | 調整値だけ。`DAICHO_API`（Workerのurl）・`DAICHO_FREE_LIMIT` |
| `js/daicho.js` | **本体。** ExcelJS で台帳レイアウトを組む。仕様は下の「レイアウト」 |
| `js/photos.js` | HEIC変換・縮小・コンタクトシート生成。全部ブラウザ内 |
| `js/ai.js` | Worker への問い合わせ |
| `js/ui.js` | 画面 |
| `worker/index.js` | Cloudflare Workers。Claude API への中継だけ |

## レイアウト（変更するときは必ずここを読む）

A4縦・1ページ6枠（2列×3段）。列は A(0.9) / **B–E(10.5)＝左の枠** / F(1.4) / **G–J(10.5)＝右の枠** / K(0.9)。

各枠は5行：
```
写真     158pt   B:E をマージ
番号①    17pt   右寄せ・indent 1
記入欄1   15pt   ← ラベルなし・空欄
記入欄2   15pt
記入欄3   15pt
（すき間） 10pt
```

**やらないこと（すべて実務での指示）**
- 写真の上に題名を置かない。見出しバーを作らない
- 「備考」というラベルを付けない。罫線だけの空欄3行にする
- 撮影時刻を自動で書き込まない
- **色を使わない。** 黒の細罫線のみ
- **ヘッダー（現場名/作業種別/作業日/天候）は1ページ目だけ。** 印刷タイトル行は使わない
- **絵文字を入れない**（PDF化で NotoColorEmoji が埋め込まれる）
- フォントは全セル `ＭＳ Ｐゴシック`

## 画像の貼り方（重要）

**ExcelJS の `tl: {col: 1.31}` のような小数指定は使わない。** 内部の換算が列幅を反映せず、位置がずれる。
必ず `nativeCol` / `nativeColOff` / `nativeRow` / `nativeRowOff` で **EMU を直接指定**する。**1px = 9525 EMU**。
列幅10.5 = 78.5px、写真枠 = 78.5×4 = 314px 幅 / 158pt = 210.67px 高。

## AI は案を出すだけ

選別も記入欄の文言も、**最後に決めるのは人間**。
チェックを外せる／文言を書き換えられる状態を絶対に壊さないこと。
間違った台帳が発電所オーナーに届くのが最悪の事故。

## 検証のやり方

ブラウザなしで確認できる。`js/daicho.js` は Node からも読める（UMD）。

```bash
npm i exceljs
node -e "require('./js/daicho.js').build({header:{site:'テスト'},slots:[...] }).then(b=>require('fs').writeFileSync('/tmp/o.xlsx',Buffer.from(b)))"
```
出力は unzip して `xl/drawings/drawing1.xml`（アンカー位置）、`xl/worksheets/sheet1.xml`（列幅・改ページ）、`xl/styles.xml`（フォント・塗り）を見る。

**`js/photos.js` と `js/ui.js` は Node では検証できない**（canvas / DOM が要る）。ブラウザで目視するしかない。

## コミット

メールは GitHub の noreply を使う：`111101640+koban-japan@users.noreply.github.com`
