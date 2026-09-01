/* templates.js — 業種別テンプレート
 *
 * 「業界を選ぶのではなくテンプレートを増やす」（2026-08-30 方針転換）。
 * 器は共通で、変わるのは次の5つだけ：
 *   perPage    1ページの枠数
 *   fields     ヘッダー4項目のラベルと例
 *   noteHints  記入欄の見出し
 *   checklist  撮影項目（撮り忘れ防止。記入欄1行目の候補にもなる）
 *   pair       前後対比モード（前→後の順に並べ替えるボタンを出す）
 *
 * ⚠️ checklist の中身は「実務でそう決まっている」ことの写しであって、AIの創作ではない。
 *    根拠のない項目を足さないこと。各テンプレの source: に出典を書く。
 *    調査結果の正本は docs/guidelines/ にある。
 *
 * ⚠️ どのテンプレートも「公的様式そのものの再現」ではない。
 *    『その様式で提出できます』とは言わないこと（docs/guidelines/README.md 参照）。
 */
(function (root) {
  'use strict';
  var APP = root.APP = root.APP || {};

  var T = [
    {
      id: 'general',
      name: '汎用（6枚／ページ）',
      desc: '決まった様式が無いとき。写真6枚・記入欄3行の標準形。',
      perPage: 6, pair: false,
      title: '写 真 台 帳',
      fields: [
        { key: 'site',    label: '現 場 名', ph: '○○発電所' },
        { key: 'work',    label: '作業種別', ph: '除草作業' },
        { key: 'date',    label: '作 業 日', ph: '2026年8月24日' },
        { key: 'weather', label: '天　　候', ph: '晴れ' }
      ],
      noteHints: ['記入欄 1行目', '記入欄 2行目', '記入欄 3行目'],
      checklist: [],
      source: 'Vault / 40-projects/What Spot/写真台帳の作り方.md（v3）'
    },

    {
      id: 'solar-om',
      name: '太陽光O&M（除草・点検）',
      desc: '太陽光発電所の除草・点検。作業前→作業後の順に並べ、異常と使用薬剤を末尾に置く。',
      perPage: 6, pair: false,
      title: '写 真 台 帳',
      fields: [
        { key: 'site',    label: '現 場 名', ph: 'GS滑川発電所（グランデソーレー滑川）' },
        { key: 'work',    label: '作業種別', ph: '除草・除草剤散布作業' },
        { key: 'date',    label: '作 業 日', ph: '2026年8月24日（月）' },
        { key: 'weather', label: '天　　候', ph: '晴れ' }
      ],
      noteHints: ['短い名前（例：監視カメラ付近）', '', ''],
      checklist: [
        { title: '作業前', note: '①〜⑥。全景と近景の両方', blank: true },
        { title: '作業後', note: '⑦〜⑯。作業前と同じアングルで', blank: true },
        { label: '監視カメラ付近', title: '監視カメラ付近' },
        { label: '除草剤', title: '除草剤', note: '薬剤の袋と散粒器が写るもの' },
        { label: 'パワコン周辺', title: 'パワコン周辺の刈草処理', note: '2025年5月の逐条解説改正。PCS周囲に枯れ草を残すと技術基準に触れうる' },
        { label: '防草シート', title: '防草シートの状態', note: '劣化・破れ。定期的な点検・交換が求められている' },
        { label: 'フェンスの蔓性植物', title: 'フェンスの蔓性植物', note: '事業評価ガイドの評価項目' },
        { label: 'スズメバチの巣', title: '特記事項', note: 'ハチの巣・倒木・パネル割れなど' },
        { label: 'スズメバチの巣の位置', title: '航空写真', note: '位置を示すもの' }
      ],
      source: 'Vault / 写真台帳の作り方.md ＋ docs/guidelines/太陽光OM.md・除草・造園.md'
    },

    {
      id: 'weeding',
      name: '除草・草刈り（自治体・河川維持）',
      desc: '自治体の除草業務。同一箇所・同一アングルの前後対比が全ての仕様書で要求されている。1ページ2〜3枚。',
      perPage: 2, pair: true,
      title: '作 業 写 真',
      fields: [
        { key: 'site',    label: '業 務 名', ph: '○○川 河川維持業務' },
        { key: 'work',    label: '作業内容', ph: '除草・集草・処分' },
        { key: 'date',    label: '作 業 日', ph: '2026年8月24日' },
        { key: 'weather', label: '受 注 者', ph: '○○（受注者名）' }
      ],
      noteHints: ['箇所名・測点（例：No.3 起点より）', '作業区分（前／中／後）', ''],
      checklist: [
        { label: '着手前 全景', title: '着手前（全景）', note: '起点から終点を望む方向。遠景が入るアングル' },
        { label: '作業中 除草', title: '作業中（除草）', note: '機械の種類が分かること' },
        { label: '作業中 集草', title: '作業中（集草）' },
        { label: '作業中 積込み', title: '作業中（積込み）' },
        { label: '作業中 運搬', title: '作業中（運搬）', note: 'シート被覆等の飛散防止措置' },
        { label: '作業中 安全管理', title: '作業中（安全管理）', note: 'バリケード・標識。交通誘導員は全員が写るよう' },
        { label: '作業後 全景', title: '作業後（全景）', note: '着手前と同一地点・同一アングル' },
        { label: '刈り幅・延長', title: '出来形（刈り幅・延長）', note: 'ポール・箱尺を当てて寸法が読めるよう。2枚以上' },
        { label: '刈取り高さ', title: '刈取り高さ', note: '地上5cm程度など仕様値を満たすことが分かる' },
        { label: '草丈', title: '草丈（作業前の平均高さ）', note: '単価区分の根拠になる' },
        { label: '積載状況', title: '処分（積載状況）', note: '1路線1車以上' },
        { label: '処分場搬入', title: '処分場搬入状況' },
        { label: '飛石飛散防止', title: '飛石飛散防止対策状況' },
        { label: '薬剤の希釈状況', title: '薬剤の希釈状況', note: '除草剤を使う場合。看板の設置状況も' }
      ],
      source: 'docs/guidelines/除草・造園.md（自治体の特記仕様書24件）'
    },

    {
      id: 'painting',
      name: '塗装工事',
      desc: '営繕工事写真撮影要領の撮影対象表に準拠。塗り回数が分かるよう同一箇所を定点で撮る。1ページ3枚。',
      perPage: 3, pair: false,
      title: '工 事 写 真',
      fields: [
        { key: 'site',    label: '工 事 名', ph: '○○ビル 外壁塗装工事' },
        { key: 'work',    label: '工事種目', ph: '外壁塗装' },
        { key: 'date',    label: '撮影時期', ph: '2026年8月24日' },
        { key: 'weather', label: '受 注 者', ph: '○○（受注者名）' }
      ],
      noteHints: ['撮影部位（面）', '施工状況（工程名）', '規格・表示マーク（塗料名）'],
      checklist: [
        { label: '塗料の表示マーク', title: '材料：塗料の表示マーク', note: '可使期間の分かる表示。搬入時' },
        { label: '入荷数量', title: '材料：入荷数量', note: '搬入時' },
        { label: '残数量・使用済み容器', title: '材料：残数量及び使用済み容器', note: '施工後' },
        { label: '使用量確認状況', title: '材料：使用量確認状況', note: '施工後' },
        { label: '素地ごしらえ', title: '工法：素地ごしらえの施工状況' },
        { label: '錆止め塗料塗り', title: '工法：錆止め塗料塗りの施工状況' },
        { label: '見え隠れ部分', title: '工法：見え隠れ部分の施工状況' },
        { label: '下塗り', title: '工法：下塗り', note: '塗り回数が分かるよう同一箇所で' },
        { label: '中塗り', title: '工法：中塗り', note: '同一箇所・定点' },
        { label: '上塗り', title: '工法：上塗り', note: '同一箇所・定点' },
        { title: '着工前／完成', note: '改修は着工前の状況が必要。自治体要領は同一アングルを原則化', blank: true },
        { title: '足場・養生', note: '指定仮設の状況は完了時', blank: true }
      ],
      source: 'docs/guidelines/塗装.md（営繕工事写真撮影要領 令和5年版）'
    },

    {
      id: 'asbestos',
      name: '石綿（アスベスト）除去',
      desc: '石綿則35条の2で写真記録が法的義務・3年保存。撮影場所と撮影日時を必ず書くこと。',
      perPage: 2, pair: true,
      title: '石綿除去作業 記録写真',
      fields: [
        { key: 'site',    label: '工 事 名', ph: '○○ビル 石綿除去工事' },
        { key: 'work',    label: '作業場所', ph: '3階 機械室' },
        { key: 'date',    label: '撮影日時', ph: '2026年8月24日 10:30' },
        { key: 'weather', label: '事 業 者', ph: '○○（事業者名）' }
      ],
      noteHints: ['撮影場所（部屋・階）', '撮影日時', '項目名'],
      checklist: [
        { label: '掲示板 遠景', title: '掲示板（遠景）', note: '見やすい位置に設置されていることが分かる' },
        { label: '掲示板 近景', title: '掲示板（近景）', note: '記載内容が法定事項を満たすことが読める' },
        { label: '立入禁止表示', title: '立入禁止の表示' },
        { label: '喫煙・飲食禁止の表示', title: '喫煙・飲食禁止の表示' },
        { label: '石綿作業場の掲示', title: '石綿作業場である旨等の4点掲示' },
        { label: '隔離の状況', title: '隔離・養生の実施状況' },
        { label: 'セキュリティゾーン', title: '前室・洗身室・更衣室の設置状況' },
        { label: '集じん・排気装置', title: '集じん・排気装置の設置状況' },
        { label: '負圧の点検結果', title: '前室の負圧・排気口の漏えい点検結果' },
        { label: '湿潤化', title: '湿潤化の状況', note: '薬液名・散布状況。作業場所ごと' },
        { label: '除去前', title: '石綿含有建材の除去（除去前）', note: '作業場所ごと' },
        { label: '除去作業中', title: '石綿含有建材の除去（作業中）' },
        { label: '除去後', title: '石綿含有建材の除去（除去後）' },
        { label: '保護具の使用状況', title: '呼吸用保護具等の使用状況' },
        { label: '梱包・保管状況', title: '除去した石綿の梱包・保管・表示' },
        { label: '取り残しの確認', title: '取り残しがないことの確認＋確認者の資格' },
        { label: '飛散防止処理剤', title: '粉じん飛散防止処理剤の散布状況', note: '薬液名' },
        { label: '仕上清掃後', title: '作業場内の仕上清掃後の状況' }
      ],
      source: 'docs/guidelines/石綿除去.md（基発1028第1号／環境省・厚労省マニュアル4.15）'
    },

    {
      id: 'subsidy',
      name: '補助金リフォーム（自治体向け）',
      desc: '工事前・工事中・工事後を同一画角で。撮り忘れると補助金が出ない。⚠️ 国の3事業は台帳形式を原則禁止（1枚ずつアップロード）。これは自治体申請向け。',
      perPage: 2, pair: true,
      title: '工 事 写 真',
      fields: [
        { key: 'site',    label: '施 主 名', ph: '○○ 様邸' },
        { key: 'work',    label: '工事内容', ph: '内窓設置' },
        { key: 'date',    label: '工 事 日', ph: '2026年8月24日' },
        { key: 'weather', label: '施 工 者', ph: '○○（施工者名）' }
      ],
      noteHints: ['工事箇所（例：1階 south 洋室）', '工程（工事前／工事中／工事後）', '型番'],
      checklist: [
        { label: '工事前', title: '工事【前】', note: '補助対象の箇所すべて。1箇所につき1枚。撮り忘れは回復不能' },
        { label: '着工', title: '着工写真', note: '不可逆的な変化が確認できること' },
        { label: '工事中', title: '工事【中】', note: '断熱材は工事後に撮れない。敷設中の撮影が必須' },
        { label: '工事後', title: '工事【後】', note: '工事前と同じ画角・角度' },
        { label: '建物全景', title: '建物の外観全景', note: '自治体は原則4方向を求める例あり' },
        { label: '型番', title: '型番の拡大', note: '給湯器は銘板ラベル（型番・製品番号・製造年月）' },
        { title: '遮蔽物を外す', note: 'カーテン・家具・雨戸で開口部が隠れた写真は不可', blank: true },
        { title: '基準物を入れる', note: '外壁が変わる工事は、変化しない基準物を一緒に写す', blank: true }
      ],
      source: 'docs/guidelines/補助金リフォーム.md（窓リノベ／給湯省エネ／みらいエコ 2026 の手引き）'
    },

    {
      id: 'kenchiku12',
      name: '建築基準法12条 定期報告',
      desc: '「要是正」の項目だけを撮る。1ページ2枚が様式の既定。⚠️ 公式の別添2様式そのものではなく、記入欄の見出しを合わせた簡易版。',
      perPage: 2, pair: false,
      title: '関 係 写 真',
      fields: [
        { key: 'site',    label: '建 物 名', ph: '○○ビル' },
        { key: 'work',    label: '報告種別', ph: '特定建築物定期調査' },
        { key: 'date',    label: '調 査 日', ph: '2026年8月24日' },
        { key: 'weather', label: '調 査 者', ph: '○○（調査者名）' }
      ],
      noteHints: ['部位・番号（例：4(34)）', '調査項目', '特記事項（場所＋指摘内容）'],
      checklist: [
        { title: '要是正の項目のみ', note: '「要是正」かつ「既存不適格」でない項目。要是正がゼロなら様式ごと省略可', blank: true },
        { title: '外観の状況が分かること', note: '様式の注意⑤「当該部位の外観の状況が確認できるように」', blank: true },
        { title: '場所を特記事項に書く', note: '記入例は「（6階 西側外壁）鉄筋の錆により…」の形', blank: true },
        { title: '図面に撮影位置を明記', note: '別添1様式（調査結果図）側の作業。防火設備は明文で義務', blank: true },
        { title: '昇降機は結果によらず必須', note: '主索・鎖・ブレーキパッドの摩損状況は「指摘なし」でも撮る', blank: true }
      ],
      source: 'docs/guidelines/12条点検.md（平20国交告282号ほか・国交省の様式ファイル本体）'
    },

    {
      id: 'disaster',
      name: '災害・保険請求',
      desc: '片付ける前に撮る。建物の周囲4面が基本。1ページ4枚。',
      perPage: 4, pair: false,
      title: '被 害 状 況 写 真',
      fields: [
        { key: 'site',    label: '所 在 地', ph: '○○市○○ 1-2-3' },
        { key: 'work',    label: '災害の種類', ph: '令和8年8月豪雨' },
        { key: 'date',    label: '撮 影 日', ph: '2026年8月24日' },
        { key: 'weather', label: '撮 影 者', ph: '○○（撮影者名）' }
      ],
      noteHints: ['撮影箇所', '被害の内容', ''],
      checklist: [
        { label: '全景 北面', title: '建物の全景（周囲4面）', note: '可能な限り4方向から' },
        { label: '浸水深 遠景', title: '浸水の深さ（遠景）', note: 'メジャー等をあてて全体を写す' },
        { label: '浸水深 近景', title: '浸水の深さ（近景）', note: '目盛りが読み取れること' },
        { label: '部屋ごとの全景', title: '被災した部屋ごとの全景' },
        { label: '見切り範囲', title: '被害箇所を含む見切り範囲', note: '面積割合が分かるよう' },
        { label: '被害箇所のクローズアップ', title: '被害箇所のクローズアップ' },
        { label: '表札', title: '表札・屋号', note: '保険請求では求められる（罹災証明では不要）' },
        { label: '家財', title: '家財の被害', note: 'メーカー名・型番・数量が分かるよう' },
        { label: '応急処置 前', title: '応急処置の前' },
        { label: '応急処置 後', title: '応急処置の後' }
      ],
      source: 'docs/guidelines/災害・保険請求.md（内閣府 事務連絡 令和2年7月5日／三井住友海上FAQ）'
    }
  ];

  function byId(id) {
    for (var i = 0; i < T.length; i++) if (T[i].id === id) return T[i];
    return T[0];
  }

  APP.templates = { list: T, byId: byId };
})(typeof self !== 'undefined' ? self : this);
