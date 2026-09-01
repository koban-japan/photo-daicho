/* ui.js — 画面の描画とイベント */
(function (root) {
  'use strict';
  var APP = root.APP = root.APP || {};
  var $ = function (id) { return document.getElementById(id); };

  var state = { photos: [], busy: false, dragIdx: -1, tpl: null, manual: {} };

  /* ---------- ヘッダー項目（テンプレートで差し替わる） ---------- */

  function fieldValues() {
    var out = {};
    (state.tpl.fields || []).forEach(function (f) {
      var el = $('f-' + f.key);
      out[f.key] = el ? el.value.trim() : '';
    });
    return out;
  }

  // Excel に渡す形。ラベルはテンプレートのもの
  function buildFields() {
    var v = fieldValues();
    return (state.tpl.fields || []).map(function (f) {
      return { label: f.label, value: v[f.key] || '' };
    });
  }

  // AI（Worker）に渡す形。位置で site/work/date/weather に写す
  function aiContext() {
    var f = buildFields();
    return {
      site: f[0] ? f[0].value : '',
      work: f[1] ? f[1].value : '',
      date: f[2] ? f[2].value : '',
      weather: f[3] ? f[3].value : '',
      want: $('f-want').value.trim()
    };
  }

  function used() { return state.photos.filter(function (p) { return p.use; }); }

  function say(id, msg, isErr) {
    var el = $(id);
    el.textContent = msg || '';
    el.className = 'status' + (isErr ? ' err' : '');
  }

  function progress(done, total) {
    var w = $('bar-wrap');
    if (done >= total) { w.hidden = true; return; }
    w.hidden = false;
    $('bar').style.width = Math.round(done / total * 100) + '%';
  }

  /* ---------- テンプレート ---------- */

  function applyTemplate(id) {
    var t = APP.templates.byId(id);
    state.tpl = t;
    $('tpl-desc').textContent = t.desc || '';

    // ヘッダー項目を作り直す（入力済みの値は同じ key なら引き継ぐ）
    var keep = {};
    var box = $('fields');
    Array.prototype.forEach.call(box.querySelectorAll('input'), function (el) {
      keep[el.id.replace(/^f-/, '')] = el.value;
    });
    box.innerHTML = '';
    (t.fields || []).forEach(function (f) {
      var lab = document.createElement('label');
      lab.textContent = f.label.replace(/\s|　/g, '');
      var inp = document.createElement('input');
      inp.id = 'f-' + f.key;
      inp.placeholder = f.ph || '';
      if (keep[f.key]) inp.value = keep[f.key];
      lab.appendChild(inp);
      box.appendChild(lab);
    });

    if (t.perPage) $('f-perpage').value = String(t.perPage);
    $('btn-pair').hidden = !t.pair;
    state.manual = {};
    renderChecklist();
    render();
  }

  /* ---------- 撮影項目チェックリスト ---------- */

  function assignedLabels() {
    var s = {};
    used().forEach(function (p) { if (p.notes[0]) s[p.notes[0]] = true; });
    return s;
  }

  function renderChecklist() {
    var t = state.tpl;
    var items = (t && t.checklist) || [];
    var sec = $('sec-checklist');
    var ul = $('checklist');
    ul.innerHTML = '';
    if (!items.length) { sec.hidden = true; return; }
    sec.hidden = false;

    var done = assignedLabels();
    items.forEach(function (it, i) {
      var li = document.createElement('li');
      var ok = it.blank ? !!state.manual[i] : !!done[it.label];
      li.className = ok ? 'done' : '';

      var mark = document.createElement('span');
      mark.className = 'mark';
      mark.textContent = ok ? '✓' : '○';
      if (it.blank) {
        mark.classList.add('clickable');
        mark.title = 'クリックで撮影済みにする';
        mark.onclick = function () { state.manual[i] = !state.manual[i]; renderChecklist(); };
      }

      var body = document.createElement('span');
      body.className = 'ck-body';
      body.innerHTML = '<b>' + esc(it.title || it.label) + '</b>' +
        (it.note ? '<span class="ck-note">' + esc(it.note) + '</span>' : '');

      li.appendChild(mark); li.appendChild(body);
      ul.appendChild(li);
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- 写真一覧 ---------- */

  function render() {
    var list = $('list');
    list.innerHTML = '';
    var n = 0;
    var labels = ((state.tpl && state.tpl.checklist) || [])
      .filter(function (it) { return it.label; })
      .map(function (it) { return it.label; });
    var hints = (state.tpl && state.tpl.noteHints) || ['記入欄 1行目', '記入欄 2行目', '記入欄 3行目'];

    state.photos.forEach(function (p, i) {
      if (p.use) n++;
      var row = document.createElement('div');
      row.className = 'row' + (p.use ? '' : ' off');

      var grip = document.createElement('span');
      grip.className = 'grip';
      grip.textContent = '≡';
      grip.title = 'ドラッグで並べ替え';
      grip.draggable = true;
      grip.ondragstart = function (e) {
        state.dragIdx = i;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(i)); // Firefox はこれが無いと始まらない
        e.dataTransfer.setDragImage(row, 20, 20);
      };
      grip.ondragend = function () { state.dragIdx = -1; render(); };
      row.ondragover = function (e) {
        if (state.dragIdx < 0) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        row.classList.add('drop-target');
      };
      row.ondragleave = function () { row.classList.remove('drop-target'); };
      row.ondrop = function (e) {
        if (state.dragIdx < 0) return;
        e.preventDefault();
        var from = state.dragIdx;
        state.dragIdx = -1;
        if (from === i) { render(); return; }
        var moved = state.photos.splice(from, 1)[0];
        state.photos.splice(i, 0, moved);
        render();
      };

      var cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = p.use;
      cb.onchange = function () { p.use = cb.checked; render(); renderChecklist(); };

      // 前後対比のテンプレートでは、1枚ずつ「前／後」を切り替えられるようにする
      var ph = null;
      if (state.tpl && state.tpl.pair) {
        ph = document.createElement('button');
        ph.className = 'phase p' + (p.phase === '前' ? 'b' : p.phase === '後' ? 'a' : 'n');
        ph.textContent = p.phase || '—';
        ph.title = 'クリックで 前 → 後 → 未設定';
        ph.onclick = function () {
          p.phase = p.phase === '前' ? '後' : p.phase === '後' ? '' : '前';
          render();
        };
      }

      var im = document.createElement('img');
      im.src = p.prevDataUrl; im.alt = p.name;
      im.title = 'クリックで拡大';
      im.onclick = function () { zoom(p); };

      var meta = document.createElement('div');
      meta.className = 'meta';
      var head = document.createElement('div');
      head.innerHTML = '<span class="no">' + (p.use ? (APP.daicho.MARU.charAt(n - 1) || n) : '—') +
        '</span><span class="fn">' + esc(p.name) + '</span>';

      // テンプレートに撮影項目があれば、記入欄1行目をワンタップで入れられるようにする
      if (labels.length) {
        var sel = document.createElement('select');
        sel.className = 'pick';
        var o0 = document.createElement('option');
        o0.value = ''; o0.textContent = '項目を選ぶ…';
        sel.appendChild(o0);
        labels.forEach(function (L) {
          var o = document.createElement('option');
          o.value = L; o.textContent = L;
          if (p.notes[0] === L) o.selected = true;
          sel.appendChild(o);
        });
        sel.onchange = function () { p.notes[0] = sel.value; render(); renderChecklist(); };
        head.appendChild(sel);
      }

      var notes = document.createElement('div');
      notes.className = 'notes';
      [0, 1, 2].forEach(function (k) {
        var inp = document.createElement('input');
        inp.value = p.notes[k] || '';
        inp.placeholder = hints[k] || '記入欄 ' + (k + 1) + '行目';
        inp.oninput = function () { p.notes[k] = inp.value; };
        inp.onchange = function () { renderChecklist(); };
        notes.appendChild(inp);
      });
      meta.appendChild(head); meta.appendChild(notes);

      var mv = document.createElement('div');
      mv.className = 'move';
      var up = document.createElement('button'); up.textContent = '▲';
      up.onclick = function () { swap(i, i - 1); };
      var dn = document.createElement('button'); dn.textContent = '▼';
      dn.onclick = function () { swap(i, i + 1); };
      mv.appendChild(up); mv.appendChild(dn);

      row.appendChild(grip); row.appendChild(cb);
      if (ph) row.appendChild(ph);
      row.appendChild(im); row.appendChild(meta); row.appendChild(mv);
      list.appendChild(row);
    });

    var per = +$('f-perpage').value || 6;
    $('count').textContent = state.photos.length
      ? '選択中 ' + n + ' 枚 / 読み込み ' + state.photos.length + ' 枚（' +
        Math.ceil(n / per) + 'ページ）'
      : '';
    $('btn-build').disabled = state.busy || n === 0;
    $('btn-ai').disabled = state.busy || state.photos.length === 0 || !root.DAICHO_API;
    if (!root.DAICHO_API && state.photos.length) {
      say('ai-status', 'AIの接続先が未設定です（js/config.js の DAICHO_API）。手で選んでください。');
    }
  }

  function zoom(p) {
    var ov = document.createElement('div');
    ov.className = 'overlay';
    var im = document.createElement('img');
    im.src = p.prevDataUrl;
    ov.appendChild(im);
    ov.onclick = function () { document.body.removeChild(ov); };
    document.body.appendChild(ov);
  }

  function swap(a, b) {
    if (b < 0 || b >= state.photos.length) return;
    var t = state.photos[a]; state.photos[a] = state.photos[b]; state.photos[b] = t;
    render();
  }

  /* ---------- 前後対比：前・後・前・後… の順に並べ替える ----------
   * 2列のレイアウトでは、この順に並べると「左が前・右が後」で横に揃う。
   * 自治体の除草業務仕様書が「同一箇所で施工前・施工後を対比させて添付」を求めるのに対応する。
   * ⚠️ 組にできなかったものは捨てずに末尾へ回す。数が合わないことを画面で伝える。 */
  function pairUp() {
    var before = [], after = [], other = [];
    state.photos.forEach(function (p) {
      if (p.phase === '前') before.push(p);
      else if (p.phase === '後') after.push(p);
      else other.push(p);
    });
    var out = [], n = Math.min(before.length, after.length);
    for (var i = 0; i < n; i++) { out.push(before[i], after[i]); }
    var leftover = before.slice(n).concat(after.slice(n));
    state.photos = out.concat(leftover, other);

    var msg = n + ' 組を「前→後」の順に並べました。';
    if (leftover.length) msg += ' 相手がいない写真が ' + leftover.length + ' 枚あります（末尾に置きました）。';
    if (other.length) msg += ' 前後の指定がない写真が ' + other.length + ' 枚あります。';
    say('ingest-status', msg, leftover.length > 0);
    render();
  }

  /* ---------- 読み込み ---------- */

  // 追加読み込み：既存の写真・チェック・記入欄は消さない（要件§7）
  function addFiles(files) {
    if (!files || !files.length || state.busy) return;
    var imgs = Array.prototype.filter.call(files, function (f) {
      return /^image\//.test(f.type) || /\.(heic|heif|jpe?g|png)$/i.test(f.name || '');
    });
    if (!imgs.length) { say('ingest-status', '画像ファイルが見つかりませんでした。', true); return; }
    state.busy = true; render();
    say('ingest-status', '読み込み中… 0 / ' + imgs.length);
    progress(0, imgs.length);
    APP.photos.ingest(imgs, function (done, total) {
      say('ingest-status', '読み込み中… ' + done + ' / ' + total);
      progress(done, total);
    }).then(function (res) {
      state.photos = state.photos.concat(res.photos);
      state.busy = false;
      progress(1, 1);
      var msg = res.photos.length + ' 枚を追加しました（合計 ' + state.photos.length + ' 枚）。使うものにチェックを入れてください。';
      if (res.failed.length) msg += ' 読めませんでした：' + res.failed.join('、');
      say('ingest-status', msg, res.failed.length > 0);
      render();
    }).catch(function (err) {
      state.busy = false;
      progress(1, 1);
      say('ingest-status', '読み込みに失敗しました：' + err.message, true);
      render();
    });
  }

  function onFiles(e) {
    addFiles(e.target.files);
    e.target.value = '';   // 同じファイルをもう一度選び直せるようにする
  }

  /* ---------- AI ---------- */

  function onAI() {
    var ctx = aiContext();
    state.busy = true; render();
    say('ai-status', 'コンタクトシートを作っています…');
    APP.photos.contactSheets(state.photos).then(function (sheets) {
      say('ai-status', 'AIが選別しています…（シート ' + sheets.length + ' 枚）');
      return APP.ai.select(sheets, ctx);
    }).then(function (res) {
      var order = res.order && res.order.length ? res.order : (res.picks || []).map(function (p) { return p.n; });
      // order は「#番号」＝読み込み順。その順に並べ替え、選ばれなかったものは後ろへ回す
      var picked = [];
      order.forEach(function (n) {
        var p = state.photos[n - 1];
        if (p && picked.indexOf(p) === -1) { p.use = true; picked.push(p); }
      });
      var rest = state.photos.filter(function (p) { return picked.indexOf(p) === -1; });
      rest.forEach(function (p) { p.use = false; });
      state.photos = picked.concat(rest);
      render();
      say('ai-status', '選別できました（' + picked.length + '枚）。記入欄の文案を作っています…');
      return APP.ai.caption(picked.map(function (p, i) {
        return { n: i + 1, prevDataUrl: p.prevDataUrl };
      }), ctx).then(function (cres) {
        var notes = cres.notes || {};
        picked.forEach(function (p, i) {
          var v = notes[String(i + 1)];
          if (v) p.notes[0] = v;
        });
        state.busy = false;
        say('ai-status', 'できました。中身を必ず自分の目で確認してください。');
        render(); renderChecklist();
      });
    }).catch(function (err) {
      state.busy = false;
      say('ai-status', 'AIの呼び出しに失敗しました：' + err.message, true);
      render();
    });
  }

  /* ---------- 出力 ---------- */

  function onBuild() {
    var u = used();
    var limit = root.DAICHO_FREE_LIMIT || 0;
    if (limit && u.length > limit) {
      say('build-status', '無料で出せるのは ' + limit + ' 枚までです（いまは ' + u.length + ' 枚）。', true);
      return;
    }
    state.busy = true; render();
    say('build-status', '作っています…');
    var f = buildFields();
    APP.daicho.build({
      fields: f,
      title: state.tpl.title,
      perPage: +$('f-perpage').value || 6,
      slots: u.map(function (p) {
        return {
          imageBase64: p.embedDataUrl.split(',')[1],
          ext: 'jpeg', w: p.embedW, h: p.embedH,
          notes: p.notes
        };
      })
    }).then(function (buf) {
      // ファイル名の日付は YYYYMM（実物の台帳と同じ）。「2026年8月24日（月）」→「202608」
      var dateVal = f[2] ? f[2].value : '';
      var m = dateVal.match(/(\d{4})[年\/\-.](\d{1,2})/);
      var tag = m ? m[1] + ('0' + m[2]).slice(-2) : dateVal;
      var name = '【' + tag + '】【' + ((f[0] && f[0].value) || '現場') + '】　' +
                 ((f[1] && f[1].value) || '') + '　写真台帳.xlsx';
      var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name.replace(/[\\/:*?"<>|]/g, '_');
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      state.busy = false;
      say('build-status', 'ダウンロードしました。');
      render();
    }).catch(function (err) {
      state.busy = false;
      say('build-status', '生成に失敗しました：' + err.message, true);
      render();
    });
  }

  /* ---------- 起動 ---------- */

  APP.ui = {
    init: function () {
      // テンプレートの選択肢
      var sel = $('f-template');
      APP.templates.list.forEach(function (t) {
        var o = document.createElement('option');
        o.value = t.id; o.textContent = t.name;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () { applyTemplate(sel.value); });
      applyTemplate(APP.templates.list[0].id);

      $('f-files').addEventListener('change', onFiles);
      $('btn-ai').addEventListener('click', onAI);
      $('btn-build').addEventListener('click', onBuild);
      $('f-perpage').addEventListener('change', render);

      $('btn-all').addEventListener('click', function () {
        state.photos.forEach(function (p) { p.use = true; }); render(); renderChecklist();
      });
      $('btn-none').addEventListener('click', function () {
        state.photos.forEach(function (p) { p.use = false; }); render(); renderChecklist();
      });
      $('btn-purge').addEventListener('click', function () {
        var before = state.photos.length;
        state.photos = state.photos.filter(function (p) { return p.use; });
        say('ingest-status', (before - state.photos.length) + ' 枚を一覧から外しました。');
        render();
      });
      $('btn-byname').addEventListener('click', function () {
        state.photos.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
        render();
      });
      $('btn-pair').addEventListener('click', pairUp);

      // ページのどこに落としても追加できるようにする（見た目のハイライトは投入口だけ）
      var dz = $('dropzone');
      document.addEventListener('dragover', function (e) {
        if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') !== -1) {
          e.preventDefault();
          dz.classList.add('over');
        }
      });
      document.addEventListener('dragleave', function (e) {
        if (!e.relatedTarget) dz.classList.remove('over');
      });
      document.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
          e.preventDefault();
          dz.classList.remove('over');
          addFiles(e.dataTransfer.files);
        }
      });

      // 誤リロード・誤タブ閉じで入力が全部消えるのを防ぐ
      window.addEventListener('beforeunload', function (e) {
        if (state.photos.length) { e.preventDefault(); e.returnValue = ''; }
      });

      render();
    },
    state: state,
    applyTemplate: applyTemplate
  };
})(typeof self !== 'undefined' ? self : this);
