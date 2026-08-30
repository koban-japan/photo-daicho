/* ui.js — 画面の描画とイベント */
(function (root) {
  'use strict';
  var APP = root.APP = root.APP || {};
  var $ = function (id) { return document.getElementById(id); };

  var state = { photos: [], busy: false };

  function header() {
    return {
      site: $('f-site').value.trim(),
      work: $('f-work').value.trim(),
      date: $('f-date').value.trim(),
      weather: $('f-weather').value.trim(),
      want: $('f-want').value.trim()
    };
  }

  function used() { return state.photos.filter(function (p) { return p.use; }); }

  function say(id, msg, isErr) {
    var el = $(id);
    el.textContent = msg || '';
    el.className = 'status' + (isErr ? ' err' : '');
  }

  function render() {
    var list = $('list');
    list.innerHTML = '';
    var n = 0;
    state.photos.forEach(function (p, i) {
      if (p.use) n++;
      var row = document.createElement('div');
      row.className = 'row' + (p.use ? '' : ' off');

      var cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = p.use;
      cb.onchange = function () { p.use = cb.checked; render(); };

      var im = document.createElement('img');
      im.src = p.prevDataUrl; im.alt = p.name;

      var meta = document.createElement('div');
      meta.className = 'meta';
      var head = document.createElement('div');
      head.innerHTML = '<span class="no">' + (p.use ? (APP.daicho.MARU.charAt(n - 1) || n) : '—') +
                       '</span><span class="fn">' + p.name + '</span>';
      var notes = document.createElement('div');
      notes.className = 'notes';
      [0, 1, 2].forEach(function (k) {
        var inp = document.createElement('input');
        inp.value = p.notes[k] || '';
        inp.placeholder = k === 0 ? '記入欄 1行目（例：監視カメラ付近）' : '記入欄 ' + (k + 1) + '行目';
        inp.oninput = function () { p.notes[k] = inp.value; };
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

      row.appendChild(cb); row.appendChild(im); row.appendChild(meta); row.appendChild(mv);
      list.appendChild(row);
    });

    $('btn-build').disabled = state.busy || n === 0;
    $('btn-ai').disabled = state.busy || state.photos.length === 0 || !root.DAICHO_API;
    if (!root.DAICHO_API && state.photos.length) {
      say('ai-status', 'AIの接続先が未設定です（js/config.js の DAICHO_API）。手で選んでください。');
    }
  }

  function swap(a, b) {
    if (b < 0 || b >= state.photos.length) return;
    var t = state.photos[a]; state.photos[a] = state.photos[b]; state.photos[b] = t;
    render();
  }

  function onFiles(e) {
    var files = e.target.files;
    if (!files || !files.length) return;
    state.busy = true; render();
    say('ingest-status', '読み込み中… 0 / ' + files.length);
    APP.photos.ingest(files, function (done, total) {
      say('ingest-status', '読み込み中… ' + done + ' / ' + total);
    }).then(function (photos) {
      state.photos = photos;
      state.busy = false;
      say('ingest-status', photos.length + ' 枚を読み込みました。使うものにチェックを入れてください。');
      render();
    }).catch(function (err) {
      state.busy = false;
      say('ingest-status', '読み込みに失敗しました：' + err.message, true);
      render();
    });
  }

  function onAI() {
    var ctx = header();
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
        render();
      });
    }).catch(function (err) {
      state.busy = false;
      say('ai-status', 'AIの呼び出しに失敗しました：' + err.message, true);
      render();
    });
  }

  function onBuild() {
    var u = used();
    var limit = root.DAICHO_FREE_LIMIT || 0;
    if (limit && u.length > limit) {
      say('build-status', '無料で出せるのは ' + limit + ' 枚までです（いまは ' + u.length + ' 枚）。', true);
      return;
    }
    state.busy = true; render();
    say('build-status', '作っています…');
    APP.daicho.build({
      header: header(),
      slots: u.map(function (p) {
        return {
          imageBase64: p.embedDataUrl.split(',')[1],
          ext: 'jpeg', w: p.embedW, h: p.embedH,
          notes: p.notes
        };
      })
    }).then(function (buf) {
      var h = header();
      var name = '【' + (h.date || '') + '】【' + (h.site || '現場') + '】　' + (h.work || '') + '　写真台帳.xlsx';
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

  APP.ui = {
    init: function () {
      $('f-files').addEventListener('change', onFiles);
      $('btn-ai').addEventListener('click', onAI);
      $('btn-build').addEventListener('click', onBuild);
      render();
    },
    state: state
  };
})(typeof self !== 'undefined' ? self : this);
