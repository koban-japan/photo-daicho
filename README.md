# 写真台帳ジェネレーター

**▶ アプリを開く：https://koban-japan.github.io/photo-daicho/**（GitHub Pages・push で自動更新）

現場写真を放り込むと、**写真台帳（Excel）**が出てくるツール。
太陽光発電所の保守点検（O&M）向け。

**写真の原本は端末から出ない。** AIの判定に送るのは縮小版だけで、サーバーには保存しない。

## 使い方（開発）

ビルド工程はない。`index.html` をブラウザで開けば動く。

```
index.html
css/style.css
js/
  config.js   調整値（APIの接続先・無料枠）
  daicho.js   ★本体。ExcelJS で v3 レイアウトを組む
  photos.js   HEIC変換・縮小・コンタクトシート生成（全部ブラウザ）
  ai.js       Worker への問い合わせ
  ui.js       画面
  main.js     起動
vendor/       exceljs / heic2any（同梱。通信しない）
worker/       Cloudflare Workers（Claude API への中継だけ）
```

## AI機能を動かす

```bash
cd worker
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler deploy
```
デプロイされたURLを `js/config.js` の `DAICHO_API` に入れる。空のままなら手で選ぶモードで動く。

## 仕様

レイアウトの正本は Obsidian Vault の `40-projects/What Spot/写真台帳の作り方.md`。

- A4縦・1ページ6枠（2列×3段）
- ヘッダー（現場名／作業種別／作業日／天候）は**1ページ目だけ**
- 各枠は5行：写真(158pt) → 番号①(17pt・右寄せ) → 記入欄3行(15pt)
- フォントは全セル `ＭＳ Ｐゴシック`
- **色を使わない。** 黒の細罫線のみ
- 写真の上に題名を置かない。「備考」ラベルを付けない。撮影時刻を自動で書かない
- フッターに `&P / &N`

## AI は案を出すだけ

選別も記入欄の文言も、**最後に決めるのは人間**。
画面でチェックを外せる／文言を書き換えられる状態を必ず保つこと。
間違った台帳がオーナーに届くのが最悪の事故なので、ここは崩さない。
