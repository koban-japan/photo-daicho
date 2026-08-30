/* Cloudflare Workers — Claude API への中継だけを担当する。
 * ここだけが ANTHROPIC_API_KEY を持つ。ブラウザには絶対に出さない。
 *   npx wrangler secret put ANTHROPIC_API_KEY
 *   npx wrangler deploy
 */
const MODEL = 'claude-haiku-4-5';        // 選別・キャプションはこれで足りる
const API = 'https://api.anthropic.com/v1/messages';

const SELECT_PROMPT = `あなたは太陽光発電所の保守点検（O&M）の報告書づくりを手伝う。
渡されたコンタクトシートは現場写真の一覧で、各コマの左下に通し番号（#1, #2 ...）がある。

写真台帳に載せる写真を選び、載せる順番を決めなさい。基準:
- 作業前 → 作業後 の順に並べる。同じアングルの前後があれば必ず対で入れる
- 全景と近景を両方入れる
- 異常（土砂崩れ・架台の傾き・パネル割れ・ハチの巣・倒木）は必ず入れる
- ぶれている/暗い/同じ構図の重複は落とす
- 指定がなければ 20 枚前後に絞る

JSON だけを返しなさい。説明文は書かない。
{"picks":[{"n":1,"reason":"作業前 全景"}],"order":[1,5,9]}`;

const CAPTION_PROMPT = `太陽光発電所の写真台帳の記入欄1行目に入れる短い名前を書きなさい。

- 10〜25文字程度。体言止めか、事実を述べる短文
- 例: 「監視カメラ付近」「除草剤」「スズメバチの巣」「崩落斜面とパネルアレイの位置関係」
      「倒木がパネルアレイに倒れ込んでいる」「接続箱内　ブレーカーを遮断し、発電を停止した」
- 撮影時刻は書かない。「備考」などのラベルも付けない
- ただの作業前・作業後の写真は空文字にする（並び順で分かるため）

JSON だけを返しなさい。{"notes":{"1":"","5":"監視カメラ付近"}}`;

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

async function callClaude(env, system, content) {
  const r = await fetch(API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content }]
    })
  });
  if (!r.ok) throw new Error('anthropic ' + r.status + ' ' + (await r.text()).slice(0, 300));
  const data = await r.json();
  const text = (data.content || []).map(b => b.text || '').join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('JSONが返らなかった: ' + text.slice(0, 200));
  return { result: JSON.parse(m[0]), usage: data.usage };
}

const img = b64 => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } });

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

    try {
      const body = await request.json();
      const ctx = body.context || {};
      const head = `現場名: ${ctx.site || '不明'} / 作業種別: ${ctx.work || '不明'} / 作業日: ${ctx.date || '不明'} / 天候: ${ctx.weather || '不明'}`;

      if (body.task === 'select') {
        const content = [{ type: 'text', text: head + (ctx.want ? `\n要望: ${ctx.want}` : '') }];
        for (const s of body.sheets || []) {
          content.push({ type: 'text', text: `#${s.from}〜#${s.to}` });
          content.push(img(s.image));
        }
        const { result, usage } = await callClaude(env, SELECT_PROMPT, content);
        return json({ ...result, usage });
      }

      if (body.task === 'caption') {
        const content = [{ type: 'text', text: head }];
        for (const p of body.photos || []) {
          content.push({ type: 'text', text: `#${p.n}` });
          content.push(img(p.image));
        }
        const { result, usage } = await callClaude(env, CAPTION_PROMPT, content);
        return json({ ...result, usage });
      }

      return json({ error: 'task は select か caption' }, 400);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500);
    }
  }
};
