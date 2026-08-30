(function (root) {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    if (!root.ExcelJS) { alert('vendor/exceljs.min.js が読み込めていません'); return; }
    root.APP.ui.init();
  });
})(typeof self !== 'undefined' ? self : this);
