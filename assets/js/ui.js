/* Travel Buddy — small UI helpers: escaping, toast, modal, confirm, QR, clipboard. */
(function () {
  'use strict';
  var t = function (k, v) { return TB.t(k, v); };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function icon(name, cls) { return '<i class="fa-solid fa-' + esc(name) + (cls ? ' ' + cls : '') + '" aria-hidden="true"></i>'; }

  var toastBox;
  function toast(msg, type) {
    if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'toasts'; toastBox.setAttribute('role', 'status'); toastBox.setAttribute('aria-live', 'polite'); document.body.appendChild(toastBox); }
    var el = document.createElement('div'); el.className = 'toast ' + (type || ''); el.textContent = msg; toastBox.appendChild(el);
    setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 300); }, 3800);
  }
  /** Turn a thrown API error into a friendly translated message. */
  function errMsg(e) { var c = e && (e.code || e.message); return c && TB.i18n.has(c) ? t(c) : t('err_generic'); }

  var openModals = [];
  function modal(o) {
    var last = document.activeElement;
    var back = document.createElement('div'); back.className = 'modal-back';
    back.innerHTML = '<div class="modal' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title || '') + '">' +
      '<div class="modal-head"><h3 class="serif">' + esc(o.title || '') + '</h3><button type="button" class="icon-btn" data-close aria-label="' + esc(t('close')) + '">' + icon('xmark') + '</button></div>' +
      '<div class="modal-body">' + (o.html || '') + '</div></div>';
    document.body.appendChild(back); document.body.classList.add('no-scroll');
    var api = { el: back.querySelector('.modal'), body: back.querySelector('.modal-body'), close: close };
    function close() {
      if (!back.parentNode) return; back.remove(); openModals.splice(openModals.indexOf(api), 1);
      if (!openModals.length) document.body.classList.remove('no-scroll');
      if (last && last.focus) try { last.focus(); } catch (e) { /* ignore */ }
      if (o.onClose) o.onClose();
    }
    back.addEventListener('mousedown', function (e) { if (e.target === back) close(); });
    back.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close(); });
    openModals.push(api);
    var f = back.querySelector('input,select,textarea,button:not([data-close])'); if (f) setTimeout(function () { try { f.focus(); } catch (e) { /* ignore */ } }, 30);
    return api;
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openModals.length) openModals[openModals.length - 1].close(); });

  function confirmBox(o) {
    return new Promise(function (resolve) {
      var done = false;
      var m = modal({ title: o.title, html: '<p class="muted">' + esc(o.text || '') + '</p><div class="row end gap"><button class="btn ghost" data-no>' + esc(o.no || t('cancel')) + '</button><button class="btn ' + (o.danger ? 'danger' : 'brand') + '" data-yes>' + esc(o.yes || t('confirm')) + '</button></div>', onClose: function () { if (!done) resolve(false); } });
      m.el.querySelector('[data-no]').onclick = function () { done = true; m.close(); resolve(false); };
      m.el.querySelector('[data-yes]').onclick = function () { done = true; m.close(); resolve(true); };
    });
  }

  var qrLoading = null;
  function loadQr() {
    if (window.QRious) return Promise.resolve();
    if (qrLoading) return qrLoading;
    qrLoading = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
    return qrLoading;
  }
  /** Draw a QR code into <canvas>; if the library is unreachable, show the text instead. */
  function qr(canvas, text, size) {
    return loadQr().then(function () { new window.QRious({ element: canvas, value: text, size: size || 160, level: 'M', background: '#fff', foreground: '#111' }); })
      .catch(function () { var s = document.createElement('div'); s.className = 'qr-fallback'; s.textContent = text; canvas.replaceWith(s); });
  }
  function copy(text) {
    var p = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text) : Promise.reject();
    return p.then(function () { toast(t('copied')); }, function () { toast(text); });
  }
  function tomorrow() { var d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function plusDays(s, n) { var d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function btnBusy(b, on) { if (!b) return; b.disabled = !!on; b.classList.toggle('busy', !!on); }

  TB.ui = { esc: esc, $: $, $$: $$, icon: icon, toast: toast, errMsg: errMsg, modal: modal, confirm: confirmBox, qr: qr, copy: copy, tomorrow: tomorrow, today: todayStr, plusDays: plusDays, btnBusy: btnBusy };
})();
