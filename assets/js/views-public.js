/* Travel Buddy — public pages: home, services, service detail, plans, toolkit, static pages. */
(function () {
  'use strict';
  var D = TB.data, U = TB.ui, I = TB.i18n, esc = U.esc, icon = U.icon;
  function t(k, v) { return I.t(k, v); }
  function L(o) { return I.L(o); }
  var V = TB.views = TB.views || {};

  /* ---------- shared bits ---------- */
  function dur(h) {
    if (!h) return '';
    if (h >= 24) return t('per_day_short');
    if (h < 1) return t('minutes', { n: Math.round(h * 60) });
    return t('hours', { n: I.num(h) });
  }
  function head(eyebrow, title, sub, extra) {
    return '<div class="sec-head"><div>' + (eyebrow ? '<p class="eyebrow">' + esc(eyebrow) + '</p>' : '') + '<h2 class="serif">' + title + '</h2>' + (sub ? '<p class="muted">' + esc(sub) + '</p>' : '') + '</div>' + (extra || '') + '</div>';
  }
  function priceBlock(s) {
    var pct = TB.state.plan.discount, unit = L(D.unitLabel[s.unit]);
    if (pct > 0) {
      return '<div class="price"><b>' + I.money(D.memberPrice(s.price, pct)) + '</b><del>' + I.money(s.price) + '</del><small>' + esc(unit) + '</small></div>';
    }
    return '<div class="price"><b>' + I.money(s.price) + '</b><small>' + esc(unit) + '</small></div>';
  }
  function svcCard(s) {
    var c = D.catById(s.cat), pct = TB.state.plan.discount;
    var chip = (pct === 0 && s.price > 0) ? '<span class="member-chip" title="' + esc(t('member_price_hint')) + '">' + icon('tag') + ' ' + I.money(D.memberPrice(s.price, D.planById('buddy').discount)) + '</span>' : '';
    return '<a class="svc-card" href="/services/' + s.id + '" data-link style="--c1:' + c.c1 + ';--c2:' + c.c2 + '">' +
      '<div class="svc-visual">' + icon(s.icon) + '<span class="badge">' + esc(L(c.name)) + '</span>' + (s.group ? '<span class="badge alt">' + icon('user-group') + ' ' + esc(t('group_trip')) + '</span>' : '') + '</div>' +
      '<div class="svc-body"><h3 class="serif">' + esc(L(s.title)) + '</h3><p class="muted clamp2">' + esc(L(s.desc)) + '</p>' +
      '<div class="svc-meta">' + (s.hrs ? '<span>' + icon('clock') + ' ' + esc(dur(s.hrs)) + '</span>' : '') + (s.cap ? '<span>' + icon('users') + ' ≤ ' + I.num(s.cap) + '</span>' : '') + '</div>' +
      '<div class="svc-foot">' + priceBlock(s) + chip + '</div></div></a>';
  }
  function planFeatures(p) {
    var f = [];
    f.push(p.discount ? t('pf_discount', { n: p.discount }) : t('pf_standard_prices'));
    f.push(t('pf_toolkit'));
    f.push(t('pf_support_' + p.support));
    if (p.board) f.push(t('pf_board'));
    if (p.concierge) f.push(p.concierge < 0 ? t('pf_concierge_unl') : t('pf_concierge_n', { n: p.concierge }));
    if (p.credits) f.push(t('pf_credits', { n: p.credits }));
    f.push(t('pf_card'));
    return f;
  }
  function planCard(p, period, opts) {
    opts = opts || {};
    var price = D.planPrice(p, period), cur = TB.state.plan.id === p.id && TB.state.sub && TB.state.sub.status === 'active';
    var per = !price ? t('free') : '<b>' + I.money(price) + '</b><small>/' + t(period === 'year' ? 'year' : 'month') + '</small>';
    var perMonth = (period === 'year' && price) ? '<p class="muted small">' + t('per_month_equiv', { p: I.money(price / 12) }) + '</p>' : '';
    return '<article class="plan-card' + (p.popular ? ' popular' : '') + (cur ? ' current' : '') + '">' +
      (p.popular ? '<span class="ribbon">' + t('most_popular') + '</span>' : '') +
      '<div class="plan-ico">' + icon(p.icon) + '</div><h3 class="serif">' + esc(L(p.name)) + '</h3><p class="muted plan-tag">' + esc(L(p.tag)) + '</p>' +
      '<div class="plan-price">' + per + '</div>' + perMonth +
      '<ul class="ticks">' + planFeatures(p).map(function (x) { return '<li>' + icon('check') + '<span>' + esc(x) + '</span></li>'; }).join('') + '</ul>' +
      '<button class="btn ' + (p.popular ? 'brand' : 'light') + ' block" data-plan="' + p.id + '" data-period="' + period + '">' + (cur ? t('renew_plan') : (p.month ? t('choose_plan') : t('start_free'))) + '</button></article>';
  }

  /* ---------- live weather (free Open-Meteo API, no key) ---------- */
  var WX = { 0: ['sun', 'wx_clear'], 1: ['cloud-sun', 'wx_clear'], 2: ['cloud-sun', 'wx_cloudy'], 3: ['cloud', 'wx_cloudy'], 45: ['smog', 'wx_fog'], 48: ['smog', 'wx_fog'], 51: ['cloud-rain', 'wx_rain'], 61: ['cloud-rain', 'wx_rain'], 80: ['cloud-showers-heavy', 'wx_rain'], 95: ['cloud-bolt', 'wx_storm'] };
  function wxInfo(code) { var ks = Object.keys(WX).map(Number).sort(function (a, b) { return a - b; }), k = 0; ks.forEach(function (x) { if (code >= x) k = x; }); return WX[k]; }
  function weather(el) {
    el.innerHTML = '<div class="skeleton" style="height:120px"></div>';
    var u = 'https://api.open-meteo.com/v1/forecast?latitude=27.9158&longitude=34.33&current=temperature_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,uv_index_max&timezone=Africa%2FCairo&forecast_days=1';
    var m = 'https://marine-api.open-meteo.com/v1/marine?latitude=27.85&longitude=34.4&current=sea_surface_temperature&timezone=Africa%2FCairo';
    Promise.all([fetch(u).then(function (r) { return r.json(); }), fetch(m).then(function (r) { return r.json(); }).catch(function () { return null; })]).then(function (res) {
      var w = res[0], sea = res[1], c = w.current, d = w.daily, wi = wxInfo(c.weather_code);
      var st = sea && sea.current && sea.current.sea_surface_temperature;
      el.innerHTML = '<div class="wx"><div class="wx-main">' + icon(wi[0]) + '<div><b>' + Math.round(c.temperature_2m) + '°C</b><span class="muted">' + esc(t(wi[1])) + '</span></div></div>' +
        '<div class="wx-grid"><div><small>' + t('wx_range') + '</small><b>' + Math.round(d.temperature_2m_min[0]) + '° / ' + Math.round(d.temperature_2m_max[0]) + '°</b></div>' +
        '<div><small>' + t('wx_wind') + '</small><b>' + Math.round(c.wind_speed_10m) + ' km/h</b></div>' +
        '<div><small>' + t('wx_uv') + '</small><b>' + (d.uv_index_max[0] != null ? Math.round(d.uv_index_max[0]) : '–') + '</b></div>' +
        (st ? '<div><small>' + t('wx_sea') + '</small><b>' + Math.round(st) + '°C</b></div>' : '') + '</div></div>';
    }).catch(function () { el.innerHTML = '<p class="muted small">' + t('wx_offline') + '</p>'; });
  }
  V.weather = weather;

  /* ================================================================ HOME */
  V.home = function (root) {
    TB.setMeta(t('meta_home_title'), t('meta_home_desc'));
    var tops = D.services.filter(function (s) { return s.top; });
    var sel = 'trips', pax = 2;
    var cats = D.categories.map(function (c) {
      var n = D.services.filter(function (s) { return s.cat === c.id; }).length;
      return '<a class="cat-tile" href="/services?cat=' + c.id + '" data-link style="--c1:' + c.c1 + ';--c2:' + c.c2 + '">' + icon(c.icon) + '<b>' + esc(L(c.name)) + '</b><small>' + t('n_services', { n: n }) + '</small></a>';
    }).join('');
    var feat = D.serviceById('ras-mohammed');
    root.innerHTML =
      '<section class="hero dark-scene" id="hero">' +
      '<img class="hero-bg-img" src="https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1600&q=80" alt="" onerror="this.remove()">' +
      '<div class="stars" aria-hidden="true"></div><div class="orb orb-1" aria-hidden="true"></div><div class="orb orb-2" aria-hidden="true"></div><div class="hero-overlay"></div>' +
      '<div class="side-text" aria-hidden="true"><span class="side-line"></span><span>' + t('hero_side') + '</span></div>' +
      '<div class="wrap hero-in">' +
      '<p class="eyebrow">' + t('hero_eyebrow') + '</p>' +
      '<h1 class="serif hero-title">' + t('hero_title_a') + '<br><em>' + t('hero_title_b') + '</em></h1>' +
      '<p class="hero-sub">' + t('hero_sub') + '</p>' +
      '<div class="hero-cta"><a class="btn-dark" href="/services" data-link><span>' + t('hero_cta') + '</span><i class="fa-solid fa-arrow-right rtl-flip" aria-hidden="true"></i></a>' +
      '<a class="btn-ghost-play" href="/plans" data-link><span class="play">' + icon('crown') + '</span><span>' + t('hero_cta2') + '</span></a></div>' +
      '<div class="search" id="search"><div class="search-tabs" role="tablist">' +
      '<button type="button" role="tab" class="search-tab active" data-tab="trips">' + icon('umbrella-beach') + '<span>' + t('tab_trips') + '</span></button>' +
      '<button type="button" role="tab" class="search-tab" data-tab="diving">' + icon('water') + '<span>' + t('tab_diving') + '</span></button>' +
      '<button type="button" role="tab" class="search-tab" data-tab="transfers">' + icon('van-shuttle') + '<span>' + t('tab_transfers') + '</span></button></div>' +
      '<div class="search-card"><div class="cells">' +
      '<label class="cell"><span class="lbl">' + t('date') + '</span><input type="date" id="sDate" min="' + U.tomorrow() + '" value="' + U.tomorrow() + '"></label>' +
      '<label class="cell" id="sCatCell"><span class="lbl">' + t('category') + '</span><select id="sCat"><option value="">' + t('all_categories') + '</option><option value="sea">' + esc(L(D.catById('sea').name)) + '</option><option value="desert">' + esc(L(D.catById('desert').name)) + '</option></select></label>' +
      '<div class="cell pax"><span class="lbl">' + t('people') + '</span><span class="stepper"><button type="button" data-pax="-1" aria-label="−">−</button><b id="sPax">2</b><button type="button" data-pax="1" aria-label="+">+</button></span></div>' +
      '</div><button type="button" class="btn-white block" id="sGo">' + icon('magnifying-glass') + '<span>' + t('search_btn') + '</span></button></div></div>' +
      '<div class="hero-cards">' +
      '<a class="glass-card" href="/services/' + feat.id + '" data-link><span class="eyebrow">' + t('featured') + '</span><h3 class="serif">' + esc(L(feat.title)) + '</h3><span class="muted">' + I.money(feat.price) + ' · ' + esc(L(D.unitLabel[feat.unit])) + '</span></a>' +
      '<div class="glass-card stats"><div><b class="serif">' + D.services.length + '</b><small>' + t('stat_services') + '</small></div><div><b class="serif">' + D.categories.length + '</b><small>' + t('stat_categories') + '</small></div><div><b class="serif">4</b><small>' + t('stat_languages') + '</small></div><p class="muted">' + t('hero_quote') + '</p></div>' +
      '<a class="glass-card" href="/plans" data-link><span class="eyebrow">' + t('membership') + '</span><h3 class="serif">' + t('hero_member_title') + '</h3><span class="muted">' + t('from_price', { p: I.money(D.planById('buddy').month) + '/' + t('month') }) + '</span></a></div>' +
      '</div></section>' +

      '<section class="wrap sec">' + head(t('sec_everything_eyebrow'), t('sec_everything_title'), t('sec_everything_sub')) + '<div class="cat-grid">' + cats + '</div></section>' +
      '<section class="wrap sec">' + head(t('sec_top_eyebrow'), t('sec_top_title'), '', '<a class="link" href="/services" data-link>' + t('see_all') + ' ' + icon('arrow-right', 'rtl-flip') + '</a>') + '<div class="scroller">' + tops.map(svcCard).join('') + '</div></section>' +

      '<section class="wrap sec"><div class="band">' + head(t('sec_plans_eyebrow'), t('sec_plans_title'), t('sec_plans_sub')) +
      '<div class="plan-grid">' + D.plans.map(function (p) { return planCard(p, 'month'); }).join('') + '</div><p class="center muted small" style="margin-top:14px">' + t('no_lock_in') + '</p></div></section>' +

      '<section class="wrap sec">' + head(t('sec_how_eyebrow'), t('sec_how_title')) + '<div class="steps">' +
      [['user-plus', 'how1'], ['bag-shopping', 'how2'], ['sun', 'how3']].map(function (s, i) { return '<div class="step"><span class="step-n serif">' + (i + 1) + '</span>' + icon(s[0]) + '<h3 class="serif">' + t(s[1] + '_t') + '</h3><p class="muted">' + t(s[1] + '_d') + '</p></div>'; }).join('') + '</div></section>' +

      '<section class="wrap sec duo"><div class="card pad"><p class="eyebrow">' + t('toolkit') + '</p><h3 class="serif">' + t('wx_title') + '</h3><div id="homeWx"></div><a class="link" href="/toolkit" data-link>' + t('open_toolkit') + ' ' + icon('arrow-right', 'rtl-flip') + '</a></div>' +
      '<div class="card pad buddies-teaser"><p class="eyebrow">' + t('nav_buddies') + '</p><h3 class="serif">' + t('buddies_teaser_t') + '</h3><p class="muted">' + t('buddies_teaser_d') + '</p><a class="btn brand" href="/buddies" data-link>' + t('buddies_cta') + '</a></div></section>' +

      '<section class="wrap sec"><div class="cta-band"><h2 class="serif">' + t('final_cta_t') + '</h2><p>' + t('final_cta_d') + '</p><a class="btn-white" href="/auth?mode=signup" data-link>' + t('join_free') + '</a></div></section>';

    weather(U.$('#homeWx', root));
    // search card
    function tab(name) {
      sel = name; U.$$('.search-tab', root).forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
      U.$('#sCatCell', root).style.display = name === 'trips' ? '' : 'none';
    }
    root.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('.search-tab'))) tab(b.dataset.tab);
      else if ((b = e.target.closest('[data-pax]'))) { pax = Math.max(1, Math.min(20, pax + +b.dataset.pax)); U.$('#sPax', root).textContent = pax; }
      else if (e.target.closest('#sGo')) {
        var q = new URLSearchParams(); var cat = sel === 'trips' ? U.$('#sCat', root).value : sel;
        if (cat) q.set('cat', cat); q.set('date', U.$('#sDate', root).value); q.set('pax', pax);
        TB.router.go('/services?' + q.toString());
      } else if ((b = e.target.closest('[data-plan]'))) V._planClick(b.dataset.plan, b.dataset.period);
    });
  };

  /* ================================================================ SERVICES LIST */
  V.services = function (root, ctx) {
    TB.setMeta(t('meta_services_title'), t('meta_services_desc'));
    var q = ctx.query, cat = q.get('cat') || '', text = q.get('q') || '', onlyGroup = q.get('group') === '1', sort = q.get('sort') || 'popular';
    root.innerHTML = '<section class="wrap page-head"><p class="eyebrow">' + t('nav_services') + '</p><h1 class="serif">' + t('services_title') + '</h1><p class="muted">' + t('services_sub') + '</p>' +
      '<div class="filters"><label class="search-input">' + icon('magnifying-glass') + '<input id="fq" type="search" placeholder="' + esc(t('search_placeholder')) + '" value="' + esc(text) + '"></label>' +
      '<select id="fsort" aria-label="' + esc(t('sort')) + '"><option value="popular">' + t('sort_popular') + '</option><option value="low">' + t('sort_low') + '</option><option value="high">' + t('sort_high') + '</option></select>' +
      '<label class="check"><input type="checkbox" id="fgroup"' + (onlyGroup ? ' checked' : '') + '><span>' + t('only_group') + '</span></label></div>' +
      '<div class="chips" id="fchips"><button class="chip' + (!cat ? ' active' : '') + '" data-cat="">' + t('all_categories') + '</button>' +
      D.categories.map(function (c) { return '<button class="chip' + (cat === c.id ? ' active' : '') + '" data-cat="' + c.id + '">' + icon(c.icon) + ' ' + esc(L(c.name)) + '</button>'; }).join('') + '</div></section>' +
      '<section class="wrap"><p class="muted small" id="fcount"></p><div class="grid" id="fgrid"></div></section>';
    U.$('#fsort', root).value = sort;
    function draw() {
      var tq = U.$('#fq', root).value.trim().toLowerCase(), g = U.$('#fgroup', root).checked, so = U.$('#fsort', root).value;
      var list = D.services.filter(function (s) {
        return (!cat || s.cat === cat) && (!g || s.group) && (!tq || (L(s.title) + ' ' + L(s.desc)).toLowerCase().indexOf(tq) >= 0);
      });
      if (so === 'low') list.sort(function (a, b) { return a.price - b.price; });
      else if (so === 'high') list.sort(function (a, b) { return b.price - a.price; });
      else list.sort(function (a, b) { return (b.top ? 1 : 0) - (a.top ? 1 : 0); });
      U.$('#fcount', root).textContent = t('n_results', { n: list.length });
      U.$('#fgrid', root).innerHTML = list.length ? list.map(svcCard).join('') : '<div class="empty">' + icon('face-meh') + '<p>' + t('no_results') + '</p></div>';
      var qq = new URLSearchParams(); if (cat) qq.set('cat', cat); if (tq) qq.set('q', tq); if (g) qq.set('group', '1'); if (so !== 'popular') qq.set('sort', so);
      var d = q.get('date'), p = q.get('pax'); if (d) qq.set('date', d); if (p) qq.set('pax', p);
      history.replaceState(null, '', '/services' + (qq.toString() ? '?' + qq : ''));
    }
    U.$('#fq', root).addEventListener('input', draw); U.$('#fsort', root).addEventListener('change', draw); U.$('#fgroup', root).addEventListener('change', draw);
    U.$('#fchips', root).addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (!b) return; cat = b.dataset.cat; U.$$('.chip', root).forEach(function (x) { x.classList.toggle('active', x === b); }); draw(); });
    draw();
  };

  /* ================================================================ SERVICE DETAIL */
  V.service = function (root, ctx) {
    var s = D.serviceById(ctx.params.id);
    if (!s) return V.notfound(root);
    var c = D.catById(s.cat);
    TB.setMeta(L(s.title) + ' — Travel Buddy', L(s.desc));
    var draftKey = 'tb_draft_' + s.id, draft = {};
    try { draft = JSON.parse(sessionStorage.getItem(draftKey) || '{}'); } catch (e) { draft = {}; }
    var qd = ctx.query.get('date'), qp = +ctx.query.get('pax');
    var st = { date: draft.date || (qd && qd >= U.tomorrow() ? qd : ''), pax: draft.pax || (qp > 0 ? qp : 2), hotel: draft.hotel || '', phone: draft.phone || '', notes: draft.notes || '', credit: false, left: null };
    if (!st.date) { st.date = U.tomorrow(); if (s.days) { for (var i = 0; i < 8 && s.days.indexOf(new Date(st.date + 'T12:00:00').getDay()) < 0; i++) st.date = U.plusDays(st.date, 1); } }
    var weekdays = s.days ? s.days.map(function (d) { var x = new Date(2024, 0, 7 + d, 12); return new Intl.DateTimeFormat(I.LANGS[I.lang].loc, { weekday: 'long' }).format(x); }) : null;
    var related = D.services.filter(function (x) { return x.cat === s.cat && x.id !== s.id; }).slice(0, 3);

    root.innerHTML = '<section class="wrap detail"><nav class="crumbs"><a href="/services" data-link>' + t('nav_services') + '</a> ' + icon('chevron-right', 'rtl-flip') + ' <a href="/services?cat=' + c.id + '" data-link>' + esc(L(c.name)) + '</a></nav>' +
      '<div class="detail-grid"><div>' +
      '<div class="detail-visual" style="--c1:' + c.c1 + ';--c2:' + c.c2 + '">' + icon(s.icon) + '<span class="badge">' + esc(L(c.name)) + '</span></div>' +
      '<h1 class="serif">' + esc(L(s.title)) + '</h1><p class="lead">' + esc(L(s.desc)) + '</p>' +
      '<div class="facts">' + (s.hrs ? '<div>' + icon('clock') + '<small>' + t('duration') + '</small><b>' + esc(dur(s.hrs)) + '</b></div>' : '') +
      '<div>' + icon(s.group ? 'user-group' : 'user-lock') + '<small>' + t('format') + '</small><b>' + (s.group ? t('group_trip') : t('private_service')) + '</b></div>' +
      (s.cap ? '<div>' + icon('users') + '<small>' + t('group_size') + '</small><b>≤ ' + I.num(s.cap) + '</b></div>' : '') +
      '<div>' + icon('tag') + '<small>' + t('price_unit') + '</small><b>' + esc(L(D.unitLabel[s.unit])) + '</b></div></div>' +
      (s.inc.length ? '<h3 class="serif">' + t('included') + '</h3><ul class="ticks cols">' + s.inc.map(function (k) { return '<li>' + icon('check') + '<span>' + esc(L(D.inc[k])) + '</span></li>'; }).join('') + '</ul>' : '') +
      '<h3 class="serif">' + t('good_to_know') + '</h3><ul class="ticks"><li>' + icon('circle-info') + '<span>' + t('free_cancel_24') + '</span></li>' +
      (s.days ? '<li>' + icon('calendar-days') + '<span>' + t('runs_on', { d: weekdays.join(', ') }) + '</span></li>' : '') +
      (s.cat === 'diving' ? '<li>' + icon('heart-pulse') + '<span>' + t('dive_medical') + '</span></li>' : '') +
      '<li>' + icon('language') + '<span>' + t('guides_languages') + '</span></li></ul></div>' +

      '<aside class="book card pad" id="bookBox"><h3 class="serif">' + t('book_this') + '</h3>' +
      '<label class="field"><span>' + t('date') + '</span><input type="date" id="bDate" min="' + U.tomorrow() + '" value="' + st.date + '"></label><p class="err small" id="bDateErr" hidden></p><p class="muted small" id="bSeats"></p>' +
      (s.unit === 'person' ? '<div class="field"><span>' + t('people') + '</span><span class="stepper big"><button type="button" data-pax="-1" aria-label="−">−</button><b id="bPax">' + st.pax + '</b><button type="button" data-pax="1" aria-label="+">+</button></span></div>' : '') +
      (s.needs !== 'none' ? '<label class="field"><span>' + t(s.needs === 'flight' ? 'flight_no' : 'hotel_name') + '</span><input id="bHotel" maxlength="80" value="' + esc(st.hotel) + '" placeholder="' + esc(t(s.needs === 'flight' ? 'flight_ph' : 'hotel_ph')) + '"></label>' : '<label class="field"><span>' + t('delivery_to') + '</span><input id="bHotel" maxlength="80" value="' + esc(st.hotel) + '" placeholder="' + esc(t('delivery_ph')) + '"></label>') +
      '<label class="field"><span>' + t('phone_whatsapp') + '</span><input id="bPhone" type="tel" maxlength="30" value="' + esc(st.phone) + '" placeholder="+44 7…"></label>' +
      '<label class="field"><span>' + t('notes') + ' <i class="muted">(' + t('optional') + ')</i></span><textarea id="bNotes" rows="2" maxlength="400">' + esc(st.notes) + '</textarea></label>' +
      '<div id="bCredit"></div><div class="totals" id="bTotals"></div>' +
      '<button class="btn brand block" id="bGo">' + t('book_pay') + '</button><p class="muted small center">' + icon('lock') + ' ' + t('secure_pay') + '</p></aside></div>' +
      (related.length ? '<h3 class="serif" style="margin-top:40px">' + t('you_may_like') + '</h3><div class="grid">' + related.map(svcCard).join('') + '</div>' : '') + '</section>';

    function persist() { try { sessionStorage.setItem(draftKey, JSON.stringify({ date: st.date, pax: st.pax, hotel: st.hotel, phone: st.phone, notes: st.notes })); } catch (e) { /* ignore */ } }
    function canCredit() { var sub = TB.state.sub; return s.cat === 'transfers' && s.unit === 'vehicle' && TB.state.plan.id !== 'explorer' && sub && sub.credits_left > 0; }
    function dateOk() {
      var ok = st.date >= U.tomorrow(), msg = '';
      if (!ok) msg = t('err_date_past');
      else if (s.days && s.days.indexOf(new Date(st.date + 'T12:00:00').getDay()) < 0) { ok = false; msg = t('err_date_day', { d: weekdays.join(', ') }); }
      else if (st.left !== null && st.left < (s.unit === 'person' ? st.pax : 1)) { ok = false; msg = st.left === 0 ? t('err_sold_out') : t('err_few_seats', { n: st.left }); }
      var el = U.$('#bDateErr', root); el.hidden = ok; el.textContent = msg; return ok;
    }
    function totals() {
      var bt = D.bookingTotal(s, st.pax, TB.state.plan.id), h = '';
      h += '<div class="trow"><span>' + (s.unit === 'person' ? I.num(st.pax) + ' × ' + I.money(s.price) : I.money(s.price)) + '</span><b>' + I.money(bt.base) + '</b></div>';
      if (st.credit) h += '<div class="trow ok"><span>' + t('transfer_credit') + '</span><b>−' + I.money(bt.base) + '</b></div>';
      else if (bt.pct) h += '<div class="trow ok"><span>' + t('member_discount', { n: bt.pct }) + '</span><b>−' + I.money(bt.base - bt.total) + '</b></div>';
      var total = st.credit ? 0 : bt.total;
      h += '<div class="trow total"><span>' + t('total') + '</span><b>' + I.money(total) + '</b></div>';
      if (!bt.pct && !st.credit && s.price > 0) h += '<a class="upsell" href="/plans" data-link>' + icon('crown') + ' ' + t('upsell_save', { p: I.money(bt.base - D.memberPrice(bt.base, D.planById('buddy').discount)) }) + '</a>';
      if (I.cur !== 'USD') h += '<p class="muted small">' + t('approx_note') + '</p>';
      U.$('#bTotals', root).innerHTML = h;
      U.$('#bCredit', root).innerHTML = canCredit() ? '<label class="check credit"><input type="checkbox" id="bUseCredit"' + (st.credit ? ' checked' : '') + '><span>' + t('use_credit', { n: TB.state.sub.credits_left }) + '</span></label>' : '';
      U.$('#bGo', root).textContent = st.credit ? t('book_credit') : t('book_pay');
    }
    function seats() {
      if (!s.cap) { st.left = null; U.$('#bSeats', root).textContent = ''; dateOk(); return; }
      TB.api.seatsLeft(s.id, st.date).then(function (n) {
        st.left = n; U.$('#bSeats', root).innerHTML = icon('chair') + ' ' + (n === 0 ? t('err_sold_out') : t('seats_left', { n: n })); dateOk();
        if (s.unit === 'person' && n !== null && st.pax > n && n > 0) { st.pax = n; U.$('#bPax', root).textContent = n; totals(); }
      }).catch(function () { st.left = null; });
    }
    function bind(sel, key) { var el = U.$(sel, root); if (el) el.addEventListener('input', function () { st[key] = el.value; persist(); if (key === 'date') { seats(); dateOk(); } }); }
    bind('#bDate', 'date'); bind('#bHotel', 'hotel'); bind('#bPhone', 'phone'); bind('#bNotes', 'notes');
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pax]');
      if (b) { var max = st.left !== null ? Math.max(1, st.left) : 20; st.pax = Math.max(1, Math.min(max, st.pax + +b.dataset.pax)); U.$('#bPax', root).textContent = st.pax; persist(); totals(); dateOk(); }
    });
    root.addEventListener('change', function (e) { if (e.target.id === 'bUseCredit') { st.credit = e.target.checked; totals(); } });
    U.$('#bGo', root).addEventListener('click', function (e) {
      if (!dateOk()) return U.toast(U.$('#bDateErr', root).textContent || t('err_date_past'), 'err');
      if (!st.hotel.trim() && s.needs !== 'none') return U.toast(t(s.needs === 'flight' ? 'err_flight' : 'err_hotel'), 'err');
      if (st.phone.replace(/\D/g, '').length < 6) return U.toast(t('err_phone'), 'err');
      persist();
      if (!TB.state.user) { U.toast(t('sign_in_to_book')); return TB.router.go('/auth?mode=signup&next=' + encodeURIComponent(location.pathname)); }
      var payload = { kind: 'booking', service: s.id, date: st.date, pax: s.unit === 'person' ? st.pax : 1, hotel: st.hotel.trim(), phone: st.phone.trim(), notes: st.notes.trim(), lang: I.lang };
      var bt = D.bookingTotal(s, payload.pax, TB.state.plan.id);
      if (st.credit) {
        U.btnBusy(e.currentTarget, true);
        return TB.api.bookWithCredit(payload).then(function (r) { try { sessionStorage.removeItem(draftKey); } catch (x) { /* ignore */ } TB.refreshState().then(function () { TB.router.go('/voucher/' + r.code); }); })
          .catch(function (err) { U.toast(U.errMsg(err), 'err'); }).then(function () { U.btnBusy(e.currentTarget, false); });
      }
      V._summary({ title: L(s.title), lines: [[L(s.title) + (s.unit === 'person' ? ' × ' + payload.pax : ''), I.money(bt.base)], bt.pct ? [t('member_discount', { n: bt.pct }), '−' + I.money(bt.base - bt.total)] : null], meta: I.date(st.date), total: bt.total, payload: payload, draftKey: draftKey });
    });
    seats(); totals(); dateOk();
  };

  /* ---------- order summary / pay modal (used by bookings and plans) ---------- */
  V._summary = function (o) {
    var m = U.modal({
      title: t('order_summary'),
      html: '<div class="sum"><h4>' + esc(o.title) + '</h4>' + (o.meta ? '<p class="muted">' + esc(o.meta) + '</p>' : '') + o.lines.filter(Boolean).map(function (l) { return '<div class="trow"><span>' + esc(l[0]) + '</span><b>' + esc(l[1]) + '</b></div>'; }).join('') + '<div class="trow total"><span>' + t('total') + '</span><b>' + I.money(o.total) + '</b></div></div>' +
        (TB.mode === 'demo' ? '<p class="notice">' + icon('flask') + ' ' + t('demo_pay_note') + '</p>' : '<p class="muted small">' + esc(TB.config.payNote || t('pay_note')) + '</p>') +
        '<button class="btn brand block" id="payGo">' + icon('lock') + ' ' + t('pay_now', { p: I.money(o.total) }) + '</button>'
    });
    U.$('#payGo', m.el).addEventListener('click', function (e) {
      var b = e.currentTarget; U.btnBusy(b, true);
      TB.api.checkout(o.payload).then(function (r) {
        if (o.draftKey) try { sessionStorage.removeItem(o.draftKey); } catch (x) { /* ignore */ }
        m.close(); TB.router.go('/payment/result?order=' + encodeURIComponent(r.orderId) + (r.demo ? '&demo=1' : ''));
      }).catch(function (err) { U.btnBusy(b, false); U.toast(U.errMsg(err), 'err'); });
    });
  };

  /* ================================================================ PLANS */
  V._planClick = function (id, period) {
    var p = D.planById(id);
    if (!p.month) return TB.router.go(TB.state.user ? '/account' : '/auth?mode=signup');
    if (!TB.state.user) return TB.router.go('/auth?mode=signup&next=' + encodeURIComponent('/plans?plan=' + id + '&period=' + period));
    var cur = TB.state.sub && TB.state.sub.status === 'active' && new Date(TB.state.sub.ends_at) > new Date() ? TB.state.sub : null;
    var price = D.planPrice(p, period), months = period === 'year' ? 12 : 1;
    var ends = new Date(cur && cur.plan === p.id ? cur.ends_at : Date.now()); ends.setMonth(ends.getMonth() + months);
    var replace = cur && cur.plan !== p.id;
    V._summary({
      title: L(p.name) + ' — ' + t(period === 'year' ? 'yearly' : 'monthly'),
      meta: t('valid_until', { d: I.date(ends) }) + (replace ? ' · ' + t('plan_replace_warn') : ''),
      lines: [[L(p.name) + ' (' + t(period === 'year' ? 'year' : 'month') + ')', I.money(price)]], total: price,
      payload: { kind: 'subscription', plan: p.id, period: period, lang: I.lang }
    });
  };
  V.plans = function (root, ctx) {
    TB.setMeta(t('meta_plans_title'), t('meta_plans_desc'));
    var period = ctx.query.get('period') === 'year' ? 'year' : 'month';
    var rows = [
      ['row_discount', function (p) { return p.discount ? p.discount + '%' : '—'; }],
      ['row_support', function (p) { return t('pf_support_' + p.support); }],
      ['row_board', function (p) { return p.board ? '✓' : '—'; }],
      ['row_concierge', function (p) { return p.concierge === 0 ? '—' : p.concierge < 0 ? t('unlimited') : t('n_per_month', { n: p.concierge }); }],
      ['row_credits', function (p) { return p.credits ? t('n_per_month', { n: p.credits }) : '—'; }],
      ['row_card', function () { return '✓'; }],
      ['row_toolkit', function () { return '✓'; }]
    ];
    root.innerHTML = '<section class="wrap page-head center"><p class="eyebrow">' + t('membership') + '</p><h1 class="serif">' + t('plans_title_a') + ' <em>' + t('plans_title_b') + '</em></h1><p class="muted">' + t('plans_sub') + '</p>' +
      '<div class="seg" id="seg"><button data-p="month" class="' + (period === 'month' ? 'on' : '') + '">' + t('monthly') + '</button><button data-p="year" class="' + (period === 'year' ? 'on' : '') + '">' + t('yearly') + ' <span class="save">' + t('two_months_free') + '</span></button></div></section>' +
      '<section class="wrap"><div class="plan-grid" id="planGrid"></div><p class="center muted small" style="margin-top:14px">' + t('no_lock_in') + '</p></section>' +
      '<section class="wrap sec">' + head('', t('compare_title')) + '<div class="table-wrap"><table class="cmp"><thead><tr><th></th>' + D.plans.map(function (p) { return '<th>' + esc(L(p.name)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><th>' + t(r[0]) + '</th>' + D.plans.map(function (p) { return '<td>' + esc(r[1](p)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></section>' +
      '<section class="wrap sec narrow">' + head('', t('faq_title')) + [1, 2, 3, 4, 5].map(function (n) { return '<details class="faq"><summary>' + t('faq' + n + '_q') + '</summary><p class="muted">' + t('faq' + n + '_a') + '</p></details>'; }).join('') + '</section>';
    function draw() { U.$('#planGrid', root).innerHTML = D.plans.map(function (p) { return planCard(p, period); }).join(''); U.$$('#seg button', root).forEach(function (b) { b.classList.toggle('on', b.dataset.p === period); }); }
    draw();
    root.addEventListener('click', function (e) {
      var b = e.target.closest('#seg button'); if (b) { period = b.dataset.p; draw(); return; }
      b = e.target.closest('[data-plan]'); if (b) V._planClick(b.dataset.plan, b.dataset.period);
    });
    var want = ctx.query.get('plan');
    if (want && TB.state.user && D.planById(want).month) { history.replaceState(null, '', '/plans'); V._planClick(want, period); }
  };

  /* ================================================================ TOOLKIT */
  V.toolkit = function (root, ctx) {
    TB.setMeta(t('meta_toolkit_title'), t('meta_toolkit_desc'));
    var tab = ctx.query.get('tab') || 'now';
    var tabs = [['now', 'compass', 'tk_now'], ['money', 'coins', 'tk_money'], ['talk', 'language', 'tk_talk'], ['tips', 'lightbulb', 'tk_tips']];
    root.innerHTML = '<section class="wrap page-head"><p class="eyebrow">' + t('toolkit') + '</p><h1 class="serif">' + t('toolkit_title') + '</h1><p class="muted">' + t('toolkit_sub') + '</p>' +
      '<div class="chips">' + tabs.map(function (x) { return '<button class="chip' + (tab === x[0] ? ' active' : '') + '" data-tab="' + x[0] + '">' + icon(x[1]) + ' ' + t(x[2]) + '</button>'; }).join('') + '</div></section><section class="wrap" id="tkBody"></section>';
    var body = U.$('#tkBody', root);
    function show(k) {
      tab = k; U.$$('.chip', root).forEach(function (c) { c.classList.toggle('active', c.dataset.tab === k); }); history.replaceState(null, '', '/toolkit?tab=' + k);
      if (k === 'now') {
        body.innerHTML = '<div class="duo"><div class="card pad"><h3 class="serif">' + t('wx_title') + '</h3><div id="tkWx"></div><p class="muted small">' + t('wx_source') + '</p></div>' +
          '<div class="card pad"><h3 class="serif">' + t('emergency_title') + '</h3><div class="sos">' + D.emergency.map(function (x) { return '<a class="sos-btn" href="tel:' + x.n + '">' + icon(x.icon) + '<b>' + x.n + '</b><span>' + esc(L(x.t)) + '</span></a>'; }).join('') + '</div><p class="muted small">' + t('emergency_note') + '</p></div></div>' +
          '<div class="card pad" style="margin-top:18px"><h3 class="serif">' + t('reef_title') + '</h3><p class="muted">' + t('reef_text') + '</p></div>';
        weather(U.$('#tkWx', body));
      } else if (k === 'money') {
        var opts = I.CURRENCIES.map(function (c) { return '<option>' + c + '</option>'; }).join('');
        body.innerHTML = '<div class="card pad narrow"><h3 class="serif">' + t('converter') + '</h3><div class="conv"><input id="cvA" type="number" inputmode="decimal" value="100" min="0"><select id="cvF">' + opts + '</select><span class="swap">' + icon('arrow-right-arrow-left') + '</span><input id="cvB" readonly><select id="cvT">' + opts + '</select></div><p class="muted small" id="cvNote"></p></div>' +
          '<div class="card pad narrow" style="margin-top:18px"><h3 class="serif">' + t('tipping_title') + '</h3><p class="muted">' + t('tipping_text') + '</p></div>';
        var a = U.$('#cvA', body), f = U.$('#cvF', body), tt = U.$('#cvT', body), bb = U.$('#cvB', body);
        f.value = 'USD'; tt.value = 'EGP';
        var calc = function () { var r = I.rates, v = (+a.value || 0) / r[f.value] * r[tt.value]; bb.value = new Intl.NumberFormat(I.LANGS[I.lang].loc, { maximumFractionDigits: 2 }).format(v); U.$('#cvNote', body).textContent = t('rates_note'); };
        [a, f, tt].forEach(function (el) { el.addEventListener('input', calc); }); calc();
      } else if (k === 'talk') {
        body.innerHTML = '<p class="muted">' + t('talk_sub') + '</p><div class="phrases">' + D.phrases.map(function (p) {
          return '<div class="phrase"><div><b>' + esc(L(p.t)) + '</b><span class="tr">' + esc(p.tr) + '</span></div><span class="ar" lang="ar" dir="rtl">' + esc(p.ar) + '</span></div>'; }).join('') + '</div>';
      } else {
        body.innerHTML = '<div class="tips">' + D.tips.map(function (x) { return '<div class="tip">' + icon(x.icon) + '<p>' + esc(L(x.t)) + '</p></div>'; }).join('') + '</div>';
      }
    }
    root.addEventListener('click', function (e) { var c = e.target.closest('.chip'); if (c) show(c.dataset.tab); });
    show(tab);
  };

  /* ================================================================ STATIC PAGES */
  V.about = function (root) {
    TB.setMeta(t('meta_about_title'), t('meta_about_desc'));
    root.innerHTML = '<section class="wrap page-head narrow"><p class="eyebrow">' + t('nav_about') + '</p><h1 class="serif">' + t('about_title') + '</h1><p class="lead">' + t('about_lead') + '</p>' +
      [1, 2, 3].map(function (n) { return '<h3 class="serif">' + t('about_h' + n) + '</h3><p class="muted">' + t('about_p' + n) + '</p>'; }).join('') +
      '<p><a class="btn brand" href="/plans" data-link>' + t('see_plans') + '</a></p></section>';
  };
  V.contact = function (root) {
    TB.setMeta(t('meta_contact_title'), t('meta_contact_desc'));
    var wa = TB.config.whatsapp, em = TB.config.supportEmail;
    root.innerHTML = '<section class="wrap page-head narrow"><p class="eyebrow">' + t('nav_contact') + '</p><h1 class="serif">' + t('contact_title') + '</h1><p class="muted">' + t('contact_sub') + '</p>' +
      '<div class="contact-ways">' + (wa ? '<a class="card pad way" href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener">' + icon('comments') + '<b>WhatsApp</b><span class="muted">+' + esc(wa) + '</span></a>' : '') +
      (em ? '<a class="card pad way" href="mailto:' + esc(em) + '">' + icon('envelope') + '<b>' + t('email') + '</b><span class="muted">' + esc(em) + '</span></a>' : '') + '</div>' +
      '<form class="card pad" id="cForm"><h3 class="serif">' + t('send_message') + '</h3>' +
      '<label class="field"><span>' + t('subject') + '</span><input name="subject" required maxlength="120"></label>' +
      '<label class="field"><span>' + t('message') + '</span><textarea name="message" rows="5" required maxlength="2000"></textarea></label>' +
      '<label class="field"><span>' + t('reply_to') + '</span><input name="contact" required maxlength="120" placeholder="' + esc(t('reply_ph')) + '"></label>' +
      '<button class="btn brand">' + t('send') + '</button><p class="muted small" id="cNote"></p></form></section>';
    var f = U.$('#cForm', root);
    if (!TB.state.user) U.$('#cNote', root).textContent = t('contact_login_note');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!TB.state.user) return TB.router.go('/auth?next=/contact');
      var d = new FormData(f), b = U.$('button', f); U.btnBusy(b, true);
      TB.api.createRequest({ type: 'contact', subject: d.get('subject'), message: d.get('message'), contact: d.get('contact') })
        .then(function () { f.reset(); U.toast(t('sent_ok'), 'ok'); }).catch(function (err) { U.toast(U.errMsg(err), 'err'); }).then(function () { U.btnBusy(b, false); });
    });
  };
  V.legal = function (root, ctx) {
    var k = ctx.page; // terms | privacy | refunds
    TB.setMeta(t('legal_' + k + '_t') + ' — Travel Buddy', t('legal_' + k + '_t'));
    var n = { terms: 8, privacy: 7, refunds: 6 }[k], h = '';
    for (var i = 1; i <= n; i++) h += '<h3 class="serif">' + t('legal_' + k + '_h' + i) + '</h3><p class="muted">' + t('legal_' + k + '_p' + i) + '</p>';
    root.innerHTML = '<section class="wrap page-head narrow legal"><p class="eyebrow">' + t('legal') + '</p><h1 class="serif">' + t('legal_' + k + '_t') + '</h1><p class="muted small">' + t('legal_updated') + '</p>' + h + '</section>';
  };
  V.notfound = function (root) {
    TB.setMeta(t('nf_title') + ' — Travel Buddy', '');
    root.innerHTML = '<section class="wrap page-head center"><p class="eyebrow">404</p><h1 class="serif">' + t('nf_title') + '</h1><p class="muted">' + t('nf_sub') + '</p><a class="btn brand" href="/" data-link>' + t('nav_home') + '</a></section>';
  };
})();
