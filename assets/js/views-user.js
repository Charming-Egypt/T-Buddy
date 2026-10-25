/* Travel Buddy — signed-in pages: auth, account, Buddy Board, payment result, voucher. */
(function () {
  'use strict';
  var D = TB.data, U = TB.ui, I = TB.i18n, esc = U.esc, icon = U.icon, V = TB.views;
  function t(k, v) { return I.t(k, v); }
  function L(o) { return I.L(o); }
  function safeNext(n) { return n && n.charAt(0) === '/' && n.charAt(1) !== '/' ? n : '/account'; }
  function needLogin(root, next) { TB.router.go('/auth?next=' + encodeURIComponent(next || location.pathname + location.search), { replace: true }); return false; }

  /* ================================================================ AUTH */
  V.auth = function (root, ctx) {
    TB.setMeta(t('meta_auth_title'), '');
    var mode = ctx.query.get('mode') === 'signup' ? 'signup' : 'login', next = safeNext(ctx.query.get('next'));
    if (TB.state.user) return TB.router.go(next, { replace: true });
    function draw() {
      var su = mode === 'signup';
      root.innerHTML = '<section class="auth"><div class="auth-side dark-scene"><div class="orb orb-1" aria-hidden="true"></div><div class="auth-side-in"><span class="logo-mark big">TB</span><p class="eyebrow">' + t('auth_side_eyebrow') + '</p><h2 class="serif">' + t('auth_side_title') + '</h2><p>' + t('auth_side_sub') + '</p>' +
        '<ul class="bullets">' + ['auth_b1', 'auth_b2', 'auth_b3'].map(function (k) { return '<li><span>' + icon('check') + '</span>' + t(k) + '</li>'; }).join('') + '</ul></div></div>' +
        '<div class="auth-main"><div class="auth-box"><h1 class="serif">' + t(su ? 'auth_signup_title' : 'auth_login_title') + '</h1><p class="muted">' + t(su ? 'auth_signup_sub' : 'auth_login_sub') + '</p>' +
        '<div class="seg full"><button type="button" data-m="login" class="' + (!su ? 'on' : '') + '">' + t('log_in') + '</button><button type="button" data-m="signup" class="' + (su ? 'on' : '') + '">' + t('sign_up') + '</button></div>' +
        '<form id="aForm" novalidate>' + (su ? '<label class="field"><span>' + t('full_name') + '</span><input name="name" autocomplete="name" required maxlength="60"></label>' : '') +
        '<label class="field"><span>' + t('email') + '</span><input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label>' +
        '<label class="field"><span>' + t('password') + '</span><input name="password" type="password" autocomplete="' + (su ? 'new-password' : 'current-password') + '" required minlength="8" placeholder="••••••••"></label>' +
        (su ? '<label class="check"><input type="checkbox" name="terms" required><span>' + t('agree_terms_a') + ' <a href="/terms" target="_blank">' + t('legal_terms_t') + '</a> ' + t('and') + ' <a href="/privacy" target="_blank">' + t('legal_privacy_t') + '</a></span></label>' : '<p class="right"><a href="#" id="forgot" class="link">' + t('forgot_password') + '</a></p>') +
        '<p class="err" id="aErr" hidden></p><button class="btn-white block big">' + t(su ? 'create_account' : 'log_in') + '</button></form>' +
        (TB.mode === 'demo' ? '<p class="notice">' + icon('flask') + ' ' + t('demo_auth_note') + '</p>' : '') + '</div></div></section>';
    }
    draw();
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-m]'); if (b) { mode = b.dataset.m; draw(); return; }
      if (e.target.id === 'forgot') {
        e.preventDefault();
        var m = U.modal({ title: t('reset_title'), html: '<p class="muted">' + t('reset_sub') + '</p><form id="rf"><label class="field"><span>' + t('email') + '</span><input name="email" type="email" required></label><button class="btn brand block">' + t('send_link') + '</button></form>' });
        U.$('#rf', m.el).addEventListener('submit', function (ev) { ev.preventDefault(); TB.api.resetPassword(new FormData(ev.target).get('email')).then(function () { m.close(); U.toast(t('reset_sent'), 'ok'); }).catch(function (er) { U.toast(U.errMsg(er), 'err'); }); });
      }
    });
    root.addEventListener('submit', function (e) {
      if (e.target.id !== 'aForm') return; e.preventDefault();
      var f = e.target, d = new FormData(f), err = U.$('#aErr', root), btn = U.$('button.btn-white', f), su = mode === 'signup';
      function bad(k) { err.hidden = false; err.textContent = t(k); }
      err.hidden = true;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.get('email') || '')) return bad('err_email');
      if ((d.get('password') || '').length < 8) return bad('err_weak_password');
      if (su && !(d.get('name') || '').trim()) return bad('err_name');
      if (su && !d.get('terms')) return bad('err_terms');
      U.btnBusy(btn, true);
      var p = su ? TB.api.signUp({ email: d.get('email'), password: d.get('password'), name: d.get('name').trim(), lang: I.lang }) : TB.api.signIn({ email: d.get('email'), password: d.get('password') });
      p.then(function (r) {
        if (r && r.needsConfirm) { U.btnBusy(btn, false); f.innerHTML = '<div class="notice ok">' + icon('envelope-circle-check') + ' ' + t('confirm_email_sent') + '</div>'; return; }
        return TB.refreshState().then(function () { U.toast(t(su ? 'welcome_new' : 'welcome_back'), 'ok'); TB.router.go(next, { replace: true }); });
      }).catch(function (er) { U.btnBusy(btn, false); err.hidden = false; err.textContent = U.errMsg(er); });
    });
  };

  /* ================================================================ ACCOUNT */
  function statusChip(s) { return '<span class="status ' + esc(s) + '">' + t('st_' + s) + '</span>'; }
  function memberId(u) { return 'TB-' + String(u.id).replace(/-/g, '').slice(0, 8).toUpperCase(); }

  V.account = function (root, ctx) {
    TB.setMeta(t('meta_account_title'), '');
    if (!TB.state.user) return needLogin(root);
    var tab = ctx.query.get('tab') || 'overview', u = TB.state.user, plan = TB.state.plan, sub = TB.state.sub;
    var tabs = [['overview', 'id-card', 'acc_overview'], ['bookings', 'ticket', 'acc_bookings'], ['help', 'headset', 'acc_help'], ['profile', 'gear', 'acc_profile']];
    root.innerHTML = '<section class="wrap page-head"><p class="eyebrow">' + t('nav_account') + '</p><h1 class="serif">' + t('hello_name', { n: esc((TB.state.profile && TB.state.profile.name) || u.name) }) + '</h1>' +
      '<div class="chips">' + tabs.map(function (x) { return '<button class="chip' + (tab === x[0] ? ' active' : '') + '" data-tab="' + x[0] + '">' + icon(x[1]) + ' ' + t(x[2]) + '</button>'; }).join('') + '</div></section><section class="wrap" id="accBody"></section>';
    var body = U.$('#accBody', root);
    function go(k) { tab = k; U.$$('.chip', root).forEach(function (c) { c.classList.toggle('active', c.dataset.tab === k); }); history.replaceState(null, '', '/account?tab=' + k); render(); }
    root.addEventListener('click', function (e) { var c = e.target.closest('.chip'); if (c) go(c.dataset.tab); });

    function render() {
      plan = TB.state.plan; sub = TB.state.sub;
      if (tab === 'overview') overview(); else if (tab === 'bookings') bookings(); else if (tab === 'help') help(); else profile();
    }

    function overview() {
      var active = plan.id !== 'explorer';
      var name = (TB.state.profile && TB.state.profile.name) || u.name;
      body.innerHTML = '<div class="duo"><div class="mcard plan-' + plan.id + '"><div class="mcard-top"><span class="logo-mark">TB</span><span class="mcard-plan">' + esc(L(plan.name)) + '</span></div>' +
        '<div class="mcard-mid"><div><small>' + t('member') + '</small><b>' + esc(name) + '</b></div><canvas id="mq" width="96" height="96" aria-label="QR"></canvas></div>' +
        '<div class="mcard-bot"><div><small>' + t('member_id') + '</small><b>' + memberId(u) + '</b></div><div><small>' + t(active ? 'valid_until_short' : 'status') + '</small><b>' + (active ? I.date(sub.ends_at, { day: 'numeric', month: 'short', year: 'numeric' }) : t('free')) + '</b></div></div></div>' +
        '<div class="card pad"><h3 class="serif">' + t('your_plan') + '</h3><p><b>' + esc(L(plan.name)) + '</b> ' + (active ? statusChip('active') : '') + '</p>' +
        (active ? '<p class="muted">' + t('plan_until', { d: I.date(sub.ends_at) }) + '</p>' : '<p class="muted">' + t('plan_free_note') + '</p>') +
        (sub && sub.credits_left > 0 && active ? '<p class="credit-pill">' + icon('ticket') + ' ' + t('credits_left', { n: sub.credits_left }) + '</p>' : '') +
        '<ul class="ticks">' + (plan.discount ? '<li>' + icon('check') + '<span>' + t('pf_discount', { n: plan.discount }) + '</span></li>' : '') + '<li>' + icon('check') + '<span>' + t('pf_support_' + plan.support) + '</span></li></ul>' +
        '<div class="row gap wrap-r">' + (active ? '<button class="btn brand" data-plan="' + plan.id + '" data-period="' + sub.period + '">' + t('renew_plan') + '</button>' : '') + '<a class="btn ' + (active ? 'light' : 'brand') + '" href="/plans" data-link>' + t(active ? 'change_plan' : 'upgrade') + '</a></div></div></div>' +
        '<h3 class="serif" style="margin-top:30px">' + t('upcoming') + '</h3><div id="upc"><div class="skeleton" style="height:80px"></div></div>';
      U.qr(U.$('#mq', body), memberId(u), 96);
      TB.api.listBookings().then(function (list) {
        var today = U.today(), up = list.filter(function (b) { return b.status === 'confirmed' && b.date >= today; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 3);
        U.$('#upc', body).innerHTML = up.length ? up.map(function (b) { return bookingRow(b); }).join('') : '<div class="empty small">' + icon('calendar') + '<p>' + t('no_upcoming') + '</p><a class="btn brand" href="/services" data-link>' + t('browse_services') + '</a></div>';
      }).catch(function () { U.$('#upc', body).innerHTML = '<p class="muted">' + t('err_generic') + '</p>'; });
    }
    body.addEventListener('click', function (e) { var b = e.target.closest('[data-plan]'); if (b) V._planClick(b.dataset.plan, b.dataset.period); });

    function bookingRow(b, extra) {
      var s = D.serviceById(b.service_id), c = s && D.catById(s.cat);
      return '<div class="brow"><div class="brow-ico" style="--c1:' + (c ? c.c1 : '#444') + ';--c2:' + (c ? c.c2 : '#222') + '">' + icon(s ? s.icon : 'ticket') + '</div><div class="brow-main"><b>' + esc(s ? L(s.title) : b.service_id) + '</b><span class="muted small">' + I.date(b.date) + (s && s.unit === 'person' ? ' · ' + t('n_people', { n: b.pax }) : '') + ' · ' + esc(b.code) + '</span></div><div class="brow-end">' + statusChip(b.status) + '<a class="btn light sm" href="/voucher/' + esc(b.code) + '" data-link>' + t('voucher') + '</a>' + (extra || '') + '</div></div>';
    }
    function bookings() {
      body.innerHTML = '<div id="bl"><div class="skeleton" style="height:90px"></div></div>';
      TB.api.listBookings().then(function (list) {
        var box = U.$('#bl', body);
        if (!list.length) { box.innerHTML = '<div class="empty">' + icon('ticket') + '<p>' + t('no_bookings') + '</p><a class="btn brand" href="/services" data-link>' + t('browse_services') + '</a></div>'; return; }
        box.innerHTML = list.map(function (b) {
          var can = b.status === 'confirmed' && new Date(b.date + 'T00:00:00') - Date.now() >= 24 * 3600 * 1000;
          return bookingRow(b, can ? '<button class="btn ghost sm" data-cancel="' + esc(b.code) + '">' + t('cancel_booking') + '</button>' : '');
        }).join('');
      }).catch(function () { U.$('#bl', body).innerHTML = '<p class="muted">' + t('err_generic') + '</p>'; });
    }
    body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cancel]'); if (!b) return;
      U.confirm({ title: t('cancel_booking'), text: t('cancel_confirm'), yes: t('cancel_booking'), no: t('keep'), danger: true }).then(function (ok) {
        if (ok) TB.api.requestCancel(b.dataset.cancel).then(function () { U.toast(t('cancel_requested'), 'ok'); bookings(); }).catch(function (er) { U.toast(U.errMsg(er), 'err'); });
      });
    });

    function help() {
      var wa = TB.config.whatsapp, locked = plan.concierge === 0;
      body.innerHTML = '<div class="duo"><div class="card pad"><h3 class="serif">' + t('concierge_title') + '</h3><p class="muted">' + t('concierge_sub') + '</p>' +
        (locked ? '<div class="notice">' + icon('lock') + ' ' + t('concierge_locked') + '</div><a class="btn brand" href="/plans" data-link>' + t('see_plans') + '</a>' :
          '<p class="credit-pill" id="cq"></p><form id="cf"><label class="field"><span>' + t('subject') + '</span><input name="subject" required maxlength="120" placeholder="' + esc(t('concierge_ph')) + '"></label><label class="field"><span>' + t('message') + '</span><textarea name="message" rows="5" required maxlength="2000"></textarea></label><label class="field"><span>' + t('reply_to') + '</span><input name="contact" required maxlength="120" value="' + esc((TB.state.profile && (TB.state.profile.whatsapp || TB.state.profile.phone)) || '') + '" placeholder="' + esc(t('reply_ph')) + '"></label><button class="btn brand">' + t('send_request') + '</button></form>') + '</div>' +
        '<div class="card pad"><h3 class="serif">' + t('support_title') + '</h3><p class="muted">' + t('pf_support_' + plan.support) + '</p>' + (wa ? '<a class="btn light" target="_blank" rel="noopener" href="https://wa.me/' + esc(wa) + '?text=' + encodeURIComponent('Travel Buddy ' + memberId(u)) + '">' + icon('comments') + ' WhatsApp</a>' : '') +
        '<p class="muted small" style="margin-top:14px">' + t('emergency_note') + '</p><a class="btn ghost" href="/toolkit" data-link>' + icon('truck-medical') + ' ' + t('emergency_title') + '</a></div></div>';
      if (!locked) {
        TB.api.conciergeUsage().then(function (n) { U.$('#cq', body).textContent = plan.concierge < 0 ? t('unlimited') : t('requests_used', { n: n, m: plan.concierge }); });
        U.$('#cf', body).addEventListener('submit', function (e) {
          e.preventDefault(); var d = new FormData(e.target), b = U.$('button', e.target); U.btnBusy(b, true);
          TB.api.createRequest({ type: 'concierge', subject: d.get('subject'), message: d.get('message'), contact: d.get('contact') }).then(function () { e.target.reset(); U.toast(t('sent_ok'), 'ok'); help(); }).catch(function (er) { U.toast(U.errMsg(er), 'err'); }).then(function () { U.btnBusy(b, false); });
        });
      }
    }

    function profile() {
      var p = TB.state.profile || {};
      body.innerHTML = '<div class="duo"><form class="card pad" id="pf"><h3 class="serif">' + t('acc_profile') + '</h3><label class="field"><span>' + t('full_name') + '</span><input name="name" value="' + esc(p.name || u.name) + '" maxlength="60"></label>' +
        '<label class="field"><span>' + t('email') + '</span><input value="' + esc(u.email) + '" disabled></label><label class="field"><span>' + t('phone') + '</span><input name="phone" value="' + esc(p.phone || '') + '" maxlength="30"></label>' +
        '<label class="field"><span>WhatsApp</span><input name="whatsapp" value="' + esc(p.whatsapp || '') + '" maxlength="30"></label><label class="field"><span>' + t('country') + '</span><input name="country" value="' + esc(p.country || '') + '" maxlength="40"></label><button class="btn brand">' + t('save') + '</button></form>' +
        '<div><form class="card pad" id="pw"><h3 class="serif">' + t('change_password') + '</h3><label class="field"><span>' + t('new_password') + '</span><input name="pw" type="password" minlength="8" autocomplete="new-password" required></label><button class="btn light">' + t('update') + '</button></form>' +
        '<div class="card pad" style="margin-top:18px"><button class="btn ghost" id="so">' + icon('right-from-bracket') + ' ' + t('sign_out') + '</button>' + (TB.mode === 'demo' ? ' <button class="btn danger sm" id="wipe">' + t('reset_demo') + '</button>' : '') + '</div></div></div>';
      U.$('#pf', body).addEventListener('submit', function (e) {
        e.preventDefault(); var d = new FormData(e.target), b = U.$('button', e.target); U.btnBusy(b, true);
        TB.api.updateProfile({ name: d.get('name'), phone: d.get('phone'), whatsapp: d.get('whatsapp'), country: d.get('country') }).then(function () { return TB.refreshState(); }).then(function () { U.toast(t('saved'), 'ok'); }).catch(function (er) { U.toast(U.errMsg(er), 'err'); }).then(function () { U.btnBusy(b, false); });
      });
      U.$('#pw', body).addEventListener('submit', function (e) { e.preventDefault(); TB.api.updatePassword(new FormData(e.target).get('pw')).then(function () { e.target.reset(); U.toast(t('saved'), 'ok'); }).catch(function (er) { U.toast(U.errMsg(er), 'err'); }); });
      U.$('#so', body).addEventListener('click', function () { TB.api.signOut().then(function () { return TB.refreshState(); }).then(function () { TB.router.go('/'); }); });
      var w = U.$('#wipe', body); if (w) w.addEventListener('click', function () { U.confirm({ title: t('reset_demo'), text: t('reset_demo_q'), danger: true }).then(function (ok) { if (ok) { localStorage.removeItem('tb_demo_v1'); location.href = '/'; } }); });
    }
    render();
  };

  /* ================================================================ BUDDY BOARD */
  V.buddies = function (root) {
    TB.setMeta(t('meta_buddies_title'), t('meta_buddies_desc'));
    var plan = TB.state.plan, allowed = !!TB.state.user && plan.board >= 1;
    var safety = '<div class="notice safety">' + icon('shield-halved') + '<div><b>' + t('safety_title') + '</b><ul><li>' + t('safety1') + '</li><li>' + t('safety2') + '</li><li>' + t('safety3') + '</li></ul></div></div>';
    if (!allowed) {
      root.innerHTML = '<section class="wrap page-head narrow center"><p class="eyebrow">' + t('nav_buddies') + '</p><h1 class="serif">' + t('buddies_title_a') + ' <em>' + t('buddies_title_b') + '</em></h1><p class="lead">' + t('buddies_lead') + '</p>' +
        '<div class="steps tight">' + [['pen-to-square', 'bb1'], ['hand', 'bb2'], ['people-arrows', 'bb3']].map(function (s, i) { return '<div class="step"><span class="step-n serif">' + (i + 1) + '</span>' + icon(s[0]) + '<h3 class="serif">' + t(s[1] + '_t') + '</h3><p class="muted">' + t(s[1] + '_d') + '</p></div>'; }).join('') + '</div>' + safety +
        '<div class="locked card pad">' + icon('lock') + '<h3 class="serif">' + t('buddies_locked_t') + '</h3><p class="muted">' + t('buddies_locked_d') + '</p><a class="btn brand" href="' + (TB.state.user ? '/plans' : '/auth?mode=signup&next=/buddies') + '" data-link>' + t(TB.state.user ? 'unlock_buddy' : 'join_free') + '</a></div></section>';
      return;
    }
    root.innerHTML = '<section class="wrap page-head"><div class="row between wrap-r"><div><p class="eyebrow">' + t('nav_buddies') + '</p><h1 class="serif">' + t('buddies_board_title') + '</h1><p class="muted">' + t('buddies_board_sub') + '</p></div><button class="btn brand" id="newPost">' + icon('plus') + ' ' + t('new_post') + '</button></div>' + safety +
      '<div class="filters"><label class="search-input">' + icon('magnifying-glass') + '<input id="bq" type="search" placeholder="' + esc(t('search_placeholder')) + '"></label><label class="check"><input type="checkbox" id="bmine"><span>' + t('only_mine') + '</span></label></div></section>' +
      '<section class="wrap"><div class="grid" id="bgrid"><div class="skeleton" style="height:150px"></div></div></section>';
    var posts = [];
    function actLabel(a) { var c = D.catById(a); return c ? L(c.name) : a; }
    function draw() {
      var q = U.$('#bq', root).value.trim().toLowerCase(), mine = U.$('#bmine', root).checked;
      var list = posts.filter(function (p) { return (!mine || p.mine) && (!q || (p.title + ' ' + p.note + ' ' + actLabel(p.activity)).toLowerCase().indexOf(q) >= 0); });
      U.$('#bgrid', root).innerHTML = list.length ? list.map(function (p) {
        return '<article class="card pad post"><div class="row between"><span class="badge alt">' + icon('route') + ' ' + esc(actLabel(p.activity) || t('anything')) + '</span>' + (p.mine ? '<span class="status active">' + t('your_post') + '</span>' : '') + '</div>' +
          '<h3 class="serif">' + esc(p.title) + '</h3><p class="muted small">' + icon('calendar-days') + ' ' + I.date(p.date_from, { day: 'numeric', month: 'short' }) + (p.date_to && p.date_to !== p.date_from ? ' → ' + I.date(p.date_to, { day: 'numeric', month: 'short' }) : '') + (p.languages ? ' · ' + icon('language') + ' ' + esc(p.languages) : '') + '</p>' +
          (p.note ? '<p>' + esc(p.note) + '</p>' : '') + '<div class="row between wrap-r"><span class="muted small">' + esc(p.author_name || '') + '</span><div class="row gap">' +
          (p.mine ? '<button class="btn light sm" data-replies="' + p.id + '">' + t('view_replies') + '</button><button class="btn ghost sm" data-close-post="' + p.id + '">' + t('close_post') + '</button>' : (p.responded ? '<span class="muted small">' + icon('check') + ' ' + t('replied') + '</span>' : '<button class="btn brand sm" data-join="' + p.id + '">' + t('im_in') + '</button>') + '<button class="icon-btn sm" data-report="' + p.id + '" aria-label="' + esc(t('report')) + '" title="' + esc(t('report')) + '">' + icon('flag') + '</button>') + '</div></div></article>';
      }).join('') : '<div class="empty">' + icon('people-group') + '<p>' + t('board_empty') + '</p></div>';
    }
    function load() { TB.api.boardList().then(function (l) { posts = l; draw(); }).catch(function (er) { U.$('#bgrid', root).innerHTML = '<p class="muted">' + esc(U.errMsg(er)) + '</p>'; }); }
    U.$('#bq', root).addEventListener('input', draw); U.$('#bmine', root).addEventListener('change', draw);
    U.$('#newPost', root).addEventListener('click', function () {
      var m = U.modal({ title: t('new_post'), html: '<form id="npf"><label class="field"><span>' + t('post_title') + '</span><input name="title" required maxlength="90" placeholder="' + esc(t('post_title_ph')) + '"></label>' +
        '<label class="field"><span>' + t('category') + '</span><select name="activity"><option value="">' + t('anything') + '</option>' + D.categories.map(function (c) { return '<option value="' + c.id + '">' + esc(L(c.name)) + '</option>'; }).join('') + '</select></label>' +
        '<div class="two"><label class="field"><span>' + t('from') + '</span><input type="date" name="date_from" required min="' + U.today() + '" value="' + U.tomorrow() + '"></label><label class="field"><span>' + t('to') + '</span><input type="date" name="date_to" min="' + U.today() + '"></label></div>' +
        '<label class="field"><span>' + t('languages') + '</span><input name="languages" maxlength="60" placeholder="English, Русский"></label>' +
        '<label class="field"><span>' + t('note') + '</span><textarea name="note" rows="3" maxlength="600" placeholder="' + esc(t('note_ph')) + '"></textarea></label><p class="muted small">' + t('post_privacy') + '</p><button class="btn brand block">' + t('publish') + '</button></form>' });
      U.$('#npf', m.el).addEventListener('submit', function (e) {
        e.preventDefault(); var d = new FormData(e.target), b = U.$('button', e.target); U.btnBusy(b, true);
        TB.api.boardCreate({ title: d.get('title'), activity: d.get('activity'), date_from: d.get('date_from'), date_to: d.get('date_to') || d.get('date_from'), languages: d.get('languages'), note: d.get('note') }).then(function () { m.close(); U.toast(t('published'), 'ok'); load(); }).catch(function (er) { U.btnBusy(b, false); U.toast(U.errMsg(er), 'err'); });
      });
    });
    root.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-join]'))) {
        var m = U.modal({ title: t('im_in'), html: '<form id="rf"><label class="field"><span>' + t('message') + '</span><textarea name="message" rows="3" required maxlength="500" placeholder="' + esc(t('reply_msg_ph')) + '"></textarea></label><label class="field"><span>' + t('your_contact') + '</span><input name="contact" required maxlength="120" placeholder="' + esc(t('reply_ph')) + '"></label><p class="muted small">' + t('contact_shared_note') + '</p><button class="btn brand block">' + t('send') + '</button></form>' }), id = b.dataset.join;
        U.$('#rf', m.el).addEventListener('submit', function (ev) { ev.preventDefault(); var d = new FormData(ev.target); TB.api.boardRespond(id, { message: d.get('message'), contact: d.get('contact') }).then(function () { m.close(); U.toast(t('sent_ok'), 'ok'); load(); }).catch(function (er) { U.toast(U.errMsg(er), 'err'); }); });
      } else if ((b = e.target.closest('[data-replies]'))) {
        var m2 = U.modal({ title: t('view_replies'), html: '<div class="skeleton" style="height:80px"></div>' });
        TB.api.boardResponses(b.dataset.replies).then(function (rs) {
          m2.body.innerHTML = rs.length ? rs.map(function (r) { return '<div class="reply"><b>' + esc(r.author_name || '') + '</b><p>' + esc(r.message) + '</p><div class="row between"><span class="muted small">' + icon('address-book') + ' ' + esc(r.contact) + '</span><button class="btn light sm" data-copy="' + esc(r.contact) + '">' + t('copy') + '</button></div></div>'; }).join('') : '<p class="muted">' + t('no_replies') + '</p>';
          m2.body.addEventListener('click', function (ev) { var c = ev.target.closest('[data-copy]'); if (c) U.copy(c.dataset.copy); });
        });
      } else if ((b = e.target.closest('[data-close-post]'))) {
        U.confirm({ title: t('close_post'), text: t('close_post_q'), yes: t('close_post') }).then(function (ok) { if (ok) TB.api.boardClose(b.dataset.closePost).then(load); });
      } else if ((b = e.target.closest('[data-report]'))) {
        var id2 = b.dataset.report, m3 = U.modal({ title: t('report'), html: '<form id="rpf"><label class="field"><span>' + t('report_reason') + '</span><textarea name="r" rows="3" required maxlength="300"></textarea></label><button class="btn danger block">' + t('report') + '</button></form>' });
        U.$('#rpf', m3.el).addEventListener('submit', function (ev) { ev.preventDefault(); TB.api.boardReport(id2, new FormData(ev.target).get('r')).then(function () { m3.close(); U.toast(t('report_thanks'), 'ok'); }).catch(function (er) { U.toast(U.errMsg(er), 'err'); }); });
      }
    });
    load();
  };

  /* ================================================================ PAYMENT RESULT */
  V.paymentResult = function (root, ctx) {
    TB.setMeta(t('pay_result_title'), '');
    if (!TB.state.user) return needLogin(root);
    var id = ctx.query.get('order'), tries = 0;
    root.innerHTML = '<section class="wrap page-head narrow center" id="pr"><div class="spinner big"></div><h1 class="serif">' + t('pay_checking') + '</h1><p class="muted">' + t('pay_checking_sub') + '</p></section>';
    function done(o) {
      var box = U.$('#pr', root); if (!box) return;
      if (o.status === 'paid') {
        TB.refreshState().then(function () {
          var isBooking = o.kind === 'booking' && o.booking_code;
          box.innerHTML = '<div class="big-ok">' + icon('circle-check') + '</div><h1 class="serif">' + t('pay_ok_title') + '</h1><p class="muted">' + t(isBooking ? 'pay_ok_booking' : 'pay_ok_plan') + '</p>' +
            (TB.mode === 'demo' ? '<p class="notice">' + icon('flask') + ' ' + t('demo_paid_note') + '</p>' : '') +
            '<div class="row gap center-r">' + (isBooking ? '<a class="btn brand" href="/voucher/' + esc(o.booking_code) + '" data-link>' + icon('ticket') + ' ' + t('view_voucher') + '</a>' : '<a class="btn brand" href="/account" data-link>' + icon('id-card') + ' ' + t('view_membership') + '</a>') + '<a class="btn light" href="/services" data-link>' + t('browse_services') + '</a></div>';
        });
      } else {
        box.innerHTML = '<div class="big-ok bad">' + icon('circle-xmark') + '</div><h1 class="serif">' + t('pay_fail_title') + '</h1><p class="muted">' + t(o.status === 'pending' ? 'pay_pending' : 'pay_fail_sub') + '</p><div class="row gap center-r"><a class="btn brand" href="/services" data-link>' + t('try_again') + '</a><a class="btn light" href="/contact" data-link>' + t('nav_contact') + '</a></div>';
      }
    }
    function poll() {
      if (!U.$('#pr', root) || !root.isConnected) return;
      TB.api.getOrder(id).then(function (o) {
        if (o && o.status !== 'pending') return done(o);
        if (++tries > 25) return done({ status: 'pending' });
        setTimeout(poll, 2000);
      }).catch(function () { if (++tries > 25) done({ status: 'failed' }); else setTimeout(poll, 2500); });
    }
    if (!id) return done({ status: 'failed' });
    poll();
  };

  /* ================================================================ VOUCHER */
  V.voucher = function (root, ctx) {
    TB.setMeta(t('voucher') + ' — Travel Buddy', '');
    if (!TB.state.user) return needLogin(root);
    root.innerHTML = '<section class="wrap page-head narrow"><div class="skeleton" style="height:300px"></div></section>';
    TB.api.getBooking(ctx.params.code).then(function (b) {
      if (!b) return V.notfound(root);
      var s = D.serviceById(b.service_id), c = s && D.catById(s.cat), wa = TB.config.whatsapp;
      root.innerHTML = '<section class="wrap page-head narrow"><div class="voucher card" id="vch"><div class="vch-top" style="--c1:' + (c ? c.c1 : '#334') + ';--c2:' + (c ? c.c2 : '#112') + '"><div><span class="logo-mark">TB</span><small>Travel Buddy · Sharm El-Sheikh</small></div>' + statusChip(b.status) + '</div>' +
        '<div class="vch-body"><div><p class="eyebrow">' + t('voucher') + '</p><h1 class="serif">' + esc(s ? L(s.title) : b.service_id) + '</h1>' +
        '<dl class="dl"><dt>' + t('date') + '</dt><dd>' + I.date(b.date) + '</dd>' + (s && s.unit === 'person' ? '<dt>' + t('people') + '</dt><dd>' + b.pax + '</dd>' : '') +
        (b.hotel ? '<dt>' + t(s && s.needs === 'flight' ? 'flight_no' : 'hotel_name') + '</dt><dd>' + esc(b.hotel) + '</dd>' : '') + '<dt>' + t('phone_whatsapp') + '</dt><dd>' + esc(b.phone) + '</dd>' +
        (b.notes ? '<dt>' + t('notes') + '</dt><dd>' + esc(b.notes) + '</dd>' : '') + '<dt>' + t('total') + '</dt><dd>' + (b.via === 'credit' ? t('transfer_credit') : I.usd(b.total_usd)) + '</dd></dl></div>' +
        '<div class="vch-qr"><canvas id="vq" width="150" height="150"></canvas><b class="code">' + esc(b.code) + '</b><small class="muted">' + t('show_code') + '</small></div></div>' +
        '<div class="vch-foot muted small">' + t('voucher_note') + '</div></div>' +
        '<div class="row gap noprint"><button class="btn brand" id="prt">' + icon('print') + ' ' + t('print') + '</button>' + (wa ? '<a class="btn light" target="_blank" rel="noopener" href="https://wa.me/' + esc(wa) + '?text=' + encodeURIComponent(b.code) + '">' + icon('comments') + ' WhatsApp</a>' : '') + '<a class="btn ghost" href="/account?tab=bookings" data-link>' + t('acc_bookings') + '</a></div></section>';
      U.qr(U.$('#vq', root), b.code, 150);
      U.$('#prt', root).addEventListener('click', function () { window.print(); });
    }).catch(function () { V.notfound(root); });
  };
})();
