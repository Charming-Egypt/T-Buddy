/* Travel Buddy — app shell: state, router, header / footer / bottom bar, settings, boot. */
(function () {
  'use strict';
  var D = TB.data, U = TB.ui, I = TB.i18n, esc = U.esc, icon = U.icon;
  function t(k, v) { return I.t(k, v); }

  /* ---------- state ---------- */
  TB.state = { user: null, profile: null, sub: null, plan: D.planById('explorer') };
  TB.refreshState = function () {
    return TB.api.session().then(function (u) {
      TB.state.user = u;
      if (!u) { TB.state.profile = null; TB.state.sub = null; TB.state.plan = D.planById('explorer'); return; }
      return Promise.all([TB.api.getProfile().catch(function () { return null; }), TB.api.getSubscription().catch(function () { return null; })]).then(function (r) {
        TB.state.profile = r[0]; TB.state.sub = r[1]; TB.state.plan = TB.api.effectivePlan(r[1]);
      });
    }).then(function () { chrome(); });
  };

  /* ---------- meta ---------- */
  function metaTag(sel, attr, val) {
    var el = document.querySelector(sel); if (!el) { el = document.createElement('meta'); var m = sel.match(/\[(\w+)="([^"]+)"\]/); el.setAttribute(m[1], m[2]); document.head.appendChild(el); }
    el.setAttribute(attr, val);
  }
  TB.setMeta = function (title, desc) {
    document.title = title; if (desc) metaTag('meta[name="description"]', 'content', desc);
    metaTag('meta[property="og:title"]', 'content', title); if (desc) metaTag('meta[property="og:description"]', 'content', desc);
    var base = (TB.config.siteUrl || location.origin).replace(/\/$/, ''), link = document.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = base + location.pathname;
  };

  /* ---------- routes ---------- */
  var routes = [
    [/^\/$/, 'home', 'home'], [/^\/services\/?$/, 'services', 'services'], [/^\/services\/([\w-]+)\/?$/, 'service', 'services', ['id']],
    [/^\/plans\/?$/, 'plans', 'plans'], [/^\/buddies\/?$/, 'buddies', 'buddies'], [/^\/toolkit\/?$/, 'toolkit', 'toolkit'],
    [/^\/account\/?$/, 'account', 'account'], [/^\/auth\/?$/, 'auth', 'account'], [/^\/payment\/result\/?$/, 'paymentResult', 'account'],
    [/^\/voucher\/([\w-]+)\/?$/, 'voucher', 'account', ['code']], [/^\/about\/?$/, 'about', 'about'], [/^\/contact\/?$/, 'contact', 'contact'],
    [/^\/(terms|privacy|refunds)\/?$/, 'legal', '', ['page']]
  ];
  var main, navKey = '';
  function match(path) {
    for (var i = 0; i < routes.length; i++) {
      var m = routes[i][0].exec(path); if (!m) continue;
      var params = {}; (routes[i][3] || []).forEach(function (k, j) { params[k] = decodeURIComponent(m[j + 1]); });
      return { view: routes[i][1], nav: routes[i][2], params: params };
    }
    return { view: 'notfound', nav: '', params: {} };
  }
  var token = 0;
  function render() {
    var my = ++token, path = location.pathname.replace(/\/index\.html$/, '/') || '/', r = match(path);
    var el = document.createElement('div'); el.className = 'view'; main.replaceChildren(el);
    navKey = r.nav; markNav();
    var ctx = { params: r.params, query: new URLSearchParams(location.search), page: r.params.page };
    try { TB.views[r.view](el, ctx); } catch (e) { console.error(e); el.innerHTML = '<section class="wrap page-head center"><h1 class="serif">' + t('err_generic') + '</h1></section>'; }
    if (my === token) { window.scrollTo(0, 0); document.body.classList.toggle('is-home', r.view === 'home'); }
  }
  TB.router = {
    go: function (url, o) {
      if (/^https?:/.test(url)) { location.href = url; return; }
      if (o && o.replace) history.replaceState(null, '', url); else history.pushState(null, '', url);
      render();
    },
    render: render
  };
  window.addEventListener('popstate', render);
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-link]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    var href = a.getAttribute('href'); if (!href || href.charAt(0) !== '/') return;
    e.preventDefault(); TB.router.go(href);
  });

  /* ---------- chrome ---------- */
  var NAV = [['home', '/', 'nav_home', 'house'], ['services', '/services', 'nav_services', 'umbrella-beach'], ['plans', '/plans', 'nav_plans', 'crown'], ['buddies', '/buddies', 'nav_buddies', 'user-group'], ['toolkit', '/toolkit', 'nav_toolkit', 'toolbox']];
  function markNav() {
    U.$$('[data-nav]').forEach(function (a) { a.classList.toggle('active', a.dataset.nav === navKey); if (a.dataset.nav === navKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  function chrome() {
    var u = TB.state.user, name = u ? ((TB.state.profile && TB.state.profile.name) || u.name || u.email) : '', init = name ? name.trim().charAt(0).toUpperCase() : '';
    var banner = (TB.mode === 'demo' && !sessionStorage.getItem('tb_hide_demo')) ? '<div class="demo-bar">' + icon('flask') + '<span>' + t('demo_banner') + '</span><button type="button" data-hide-demo aria-label="' + esc(t('close')) + '">' + icon('xmark') + '</button></div>' : '';
    U.$('#chrome-top').innerHTML = banner + '<header class="site-header"><div class="wrap hdr">' +
      '<a class="logo" href="/" data-link aria-label="Travel Buddy"><span class="logo-mark">TB</span><span class="logo-text">Travel Buddy</span></a>' +
      '<nav class="pill-nav" aria-label="Main">' + NAV.map(function (n) { return '<a href="' + n[1] + '" data-link data-nav="' + n[0] + '">' + t(n[2]) + '</a>'; }).join('') + '</nav>' +
      '<div class="hdr-actions"><button type="button" class="icon-btn" data-settings aria-label="' + esc(t('settings')) + '" title="' + esc(t('settings')) + '">' + icon('globe') + '</button>' +
      (u ? '<a class="avatar" href="/account" data-link data-nav="account" aria-label="' + esc(t('nav_account')) + '">' + esc(init) + '</a>' : '<a class="login-link" href="/auth" data-link>' + t('log_in') + '</a><a class="btn-white sm cta-join" href="/auth?mode=signup" data-link>' + t('join_free') + '</a>') +
      '</div></div></header>';
    U.$('#chrome-bottom').innerHTML =
      '<footer class="site-footer"><div class="wrap foot-grid"><div class="foot-brand"><a class="logo" href="/" data-link><span class="logo-mark">TB</span><span class="logo-text">Travel Buddy</span></a><p class="muted">' + t('footer_blurb') + '</p></div>' +
      '<div><h4>' + t('footer_explore') + '</h4>' + D.categories.slice(0, 5).map(function (c) { return '<a href="/services?cat=' + c.id + '" data-link>' + esc(I.L(c.name)) + '</a>'; }).join('') + '</div>' +
      '<div><h4>' + t('footer_company') + '</h4><a href="/about" data-link>' + t('nav_about') + '</a><a href="/plans" data-link>' + t('nav_plans') + '</a><a href="/toolkit" data-link>' + t('nav_toolkit') + '</a><a href="/contact" data-link>' + t('nav_contact') + '</a></div>' +
      '<div><h4>' + t('legal') + '</h4><a href="/terms" data-link>' + t('legal_terms_t') + '</a><a href="/privacy" data-link>' + t('legal_privacy_t') + '</a><a href="/refunds" data-link>' + t('legal_refunds_t') + '</a></div></div>' +
      '<div class="wrap foot-bot"><span class="muted small">© ' + new Date().getFullYear() + ' Travel Buddy · ' + t('footer_made') + '</span><button type="button" class="link" data-settings>' + icon('globe') + ' ' + I.LANGS[I.lang].name + ' · ' + I.cur + '</button></div></footer>' +
      '<nav class="bottom-nav" aria-label="Main"><a href="/" data-link data-nav="home" aria-label="' + esc(t('nav_home')) + '">' + icon('house') + '<span>' + t('nav_home') + '</span></a>' +
      '<a href="/services" data-link data-nav="services" aria-label="' + esc(t('nav_services')) + '">' + icon('umbrella-beach') + '<span>' + t('nav_services') + '</span></a>' +
      '<a href="/plans" data-link data-nav="plans" class="center-btn" aria-label="' + esc(t('nav_plans')) + '"><span class="center-ico">' + icon('crown') + '</span></a>' +
      '<a href="/buddies" data-link data-nav="buddies" aria-label="' + esc(t('nav_buddies')) + '">' + icon('user-group') + '<span>' + t('nav_buddies') + '</span></a>' +
      '<a href="' + (u ? '/account' : '/auth') + '" data-link data-nav="account" aria-label="' + esc(t('nav_account')) + '">' + icon('user') + '<span>' + t(u ? 'nav_account' : 'log_in') + '</span></a></nav>';
    markNav();
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-hide-demo]')) { try { sessionStorage.setItem('tb_hide_demo', '1'); } catch (x) { /* ignore */ } chrome(); return; }
    if (e.target.closest('[data-settings]')) openSettings();
  });

  /* ---------- theme ---------- */
  function theme() { var s = null; try { s = localStorage.getItem('tb_theme'); } catch (e) { /* ignore */ } return s === 'light' ? 'light' : 'dark'; }
  function setTheme(v) { try { localStorage.setItem('tb_theme', v); } catch (e) { /* ignore */ } document.documentElement.setAttribute('data-theme', v); var m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = v === 'light' ? '#ffffff' : '#0a0a0a'; }
  setTheme(theme());

  function openSettings() {
    var m = U.modal({
      title: t('settings'),
      html: '<h4 class="mini">' + t('language') + '</h4><div class="chips">' + Object.keys(I.LANGS).map(function (k) { return '<button class="chip' + (k === I.lang ? ' active' : '') + '" data-lang="' + k + '">' + I.LANGS[k].name + '</button>'; }).join('') + '</div>' +
        '<h4 class="mini">' + t('currency') + '</h4><div class="chips">' + I.CURRENCIES.map(function (c) { return '<button class="chip' + (c === I.cur ? ' active' : '') + '" data-cur="' + c + '">' + c + '</button>'; }).join('') + '</div><p class="muted small">' + t('currency_note') + '</p>' +
        '<h4 class="mini">' + t('theme') + '</h4><div class="chips"><button class="chip' + (theme() === 'dark' ? ' active' : '') + '" data-theme-set="dark">' + icon('moon') + ' ' + t('dark') + '</button><button class="chip' + (theme() === 'light' ? ' active' : '') + '" data-theme-set="light">' + icon('sun') + ' ' + t('light') + '</button></div>'
    });
    m.el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-lang]'))) { I.setLang(b.dataset.lang); m.close(); chrome(); render(); }
      else if ((b = e.target.closest('[data-cur]'))) { I.setCur(b.dataset.cur); m.close(); chrome(); render(); }
      else if ((b = e.target.closest('[data-theme-set]'))) { setTheme(b.dataset.themeSet); U.$$('[data-theme-set]', m.el).forEach(function (x) { x.classList.toggle('active', x === b); }); }
    });
  }

  /* ---------- hero decoration ---------- */
  function stars() {
    document.addEventListener('DOMContentLoaded', function () { });
  }
  var mo = new MutationObserver(function () {
    var s = U.$('.stars:empty'); if (!s) return;
    var h = ''; for (var i = 0; i < 46; i++) h += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;top:' + (Math.random() * 100).toFixed(1) + '%;animation-delay:' + (Math.random() * 3).toFixed(1) + 's"></i>';
    s.innerHTML = h;
  });

  /* ---------- boot ---------- */
  function boot() {
    main = document.getElementById('main'); stars();
    mo.observe(main, { childList: true, subtree: true });
    I.apply(); I.refreshRates();
    TB.api.onChange(function () { /* state refreshes are explicit; nothing to do */ });
    TB.refreshState().catch(function (e) { console.error(e); }).then(function () {
      render();
      if (TB.api.recoveryPending()) {
        var m = U.modal({ title: t('set_new_password'), html: '<form id="npw"><label class="field"><span>' + t('new_password') + '</span><input name="pw" type="password" minlength="8" required autocomplete="new-password"></label><button class="btn brand block">' + t('update') + '</button></form>' });
        U.$('#npw', m.el).addEventListener('submit', function (e) { e.preventDefault(); TB.api.updatePassword(new FormData(e.target).get('pw')).then(function () { m.close(); U.toast(t('saved'), 'ok'); }).catch(function (er) { U.toast(U.errMsg(er), 'err'); }); });
      }
    });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('/sw.js').catch(function () { });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
