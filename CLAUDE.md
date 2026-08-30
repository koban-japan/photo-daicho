# photo-daicho — Claude への指示

> **作業を始める前に `docs/要件定義.md` を読むこと。** 何を作るか・受け入れ条件・エラー時の挙動はそちらが正本。
> 本ファイルは**技術的にやってはいけないこと**を持つ。

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
写真      158pt   B:E をマージ
画像①    17pt   右寄せ・indent 1・太字（「①」だけでなく「画像①」と書く）
記入欄1   15pt   ← ラベルなし・空欄。左寄せ・indentなし
記入欄2   15pt
記入欄3   15pt
（すき間） 10pt
```

正本Excel（【202608】GS滑川）の解析で確定した値（2026-08-30）：
- **フォントは全セル10pt**（タイトル「写 真 台 帳」だけ16pt太字）。9ptにしない
- ヘッダーのラベルは**字間つき**：`現 場 名`・`作業種別`・`作 業 日`・`天　　候`
- タイトル行の高さ **26pt**
- 余白 left/right **0.3**・top **0.35**・bottom **0.3**・header/footer **0.15**、`fitToWidth=1`
- **2ページ目以降は先頭に10ptのすき間行が1本入る**（改ページは行23/42/61型。等間隔ではない）
- フッターは `&C&"ＭＳ Ｐゴシック,Regular"&9 &P / &N`

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

**tl+ext（oneCellAnchor）は使わない。tl+br の twoCellAnchor にする。**
ExcelJS は oneCellAnchor に `editAs` 属性を必ず書き込むが、`editAs` は仕様上 twoCellAnchor 専用。
このため **Excel が開くときに「修復」して画像を全部削除する**（exceljs#2777。2026-08-30 に実害）。
`tools/verify.js` に回帰チェックあり（「oneCellAnchor に editAs なし」）。

## AI は案を出すだけ

選別も記入欄の文言も、**最後に決めるのは人間**。
チェックを外せる／文言を書き換えられる状態を絶対に壊さないこと。
間違った台帳が発電所オーナーに届くのが最悪の事故。

## 検証のやり方

ブラウザなしで確認できる。`js/daicho.js` は Node からも読める（UMD）。

```bash
npm i exceljs
node tools/verify.js
```

`tools/verify.js` が滑川19枚（OneDrive の sel）で台帳を生成し、**手作業の正本と15項目を自動で突き合わせる**（列幅・行高・改ページ・セル値・フォント・余白・フッター・画像アンカー）。全OKになるまで直す。
手で見るなら unzip して `xl/drawings/drawing1.xml`（アンカー位置）、`xl/worksheets/sheet1.xml`（列幅・改ページ）、`xl/styles.xml`（フォント・塗り）。

**`js/photos.js` と `js/ui.js` は Node では検証できない**（canvas / DOM が要る）。ブラウザで目視するしかない。

## コミット

メールは GitHub の noreply を使う：`111101640+koban-japan@users.noreply.github.com`
