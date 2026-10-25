/* Travel Buddy — data layer.
   Two interchangeable back-ends with the same interface:
     • live  → Supabase (auth + Postgres with RLS) and the payments Worker (Kashier)   [when config has the keys]
     • demo  → everything in this browser's localStorage, payments are simulated        [default, zero setup]
   The UI never knows which one it talks to. */
(function () {
  'use strict';
  var cfg = TB.config, D = TB.data;
  var live = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  var listeners = [];
  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }
  function fail(code, extra) { var e = new Error(code); e.code = code; if (extra) e.extra = extra; return e; }
  function now() { return new Date().toISOString(); }
  function addMonths(d, n) { var x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
  function ymd(d) { return new Date(d).toISOString().slice(0, 10); }
  function uid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36); }
  function code() { var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = ''; for (var i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)]; return 'TB-' + s; }

  /** The plan whose perks apply right now (an expired subscription falls back to Explorer). */
  function effectivePlan(sub) {
    if (sub && sub.status === 'active' && new Date(sub.ends_at) > new Date()) return D.planById(sub.plan);
    return D.planById('explorer');
  }

  /* ====================================================================== DEMO */
  var demo = (function () {
    var KEY = 'tb_demo_v1', mem = null;
    function load() {
      if (mem) return mem;
      try { mem = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { mem = null; }
      if (!mem) mem = { users: [], session: null, subs: {}, orders: [], bookings: [], requests: [], board: [], responses: [], reports: [] };
      return mem;
    }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* private mode: keep in memory */ } }
    function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); }
    function me() { var db = load(); return db.users.filter(function (u) { return u.id === db.session; })[0] || null; }
    function need() { var u = me(); if (!u) throw fail('err_auth_required'); return u; }
    function pub(u) { return u && { id: u.id, email: u.email, name: u.name, phone: u.phone || '', country: u.country || '', whatsapp: u.whatsapp || '' }; }
    function planOf(u) { return effectivePlan(load().subs[u.id]); }
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function seatsTaken(db, sid, date) {
      return db.bookings.filter(function (b) { return b.service_id === sid && b.date === date && (b.status === 'confirmed' || b.status === 'cancel_requested'); })
        .reduce(function (n, b) { return n + b.pax; }, 0);
    }
    function activate(db, u, planId, period) {
      var p = D.planById(planId), months = period === 'year' ? 12 : 1, old = db.subs[u.id];
      var same = old && old.plan === planId && new Date(old.ends_at) > new Date();
      var base = same ? new Date(old.ends_at) : new Date();
      db.subs[u.id] = { user_id: u.id, plan: planId, period: period, status: 'active', started_at: same ? old.started_at : now(), ends_at: addMonths(base, months).toISOString(),
        credits_left: (same ? old.credits_left : 0) + p.credits * months };
    }
    function createBooking(db, u, d, via, total) {
      var b = { code: code(), user_id: u.id, service_id: d.service, date: d.date, pax: d.pax, total_usd: total, status: 'confirmed', hotel: d.hotel || '', phone: d.phone || '', notes: d.notes || '', via: via, created_at: now() };
      db.bookings.push(b); return b;
    }
    return {
      session: function () { return Promise.resolve(pub(me())); },
      signUp: function (d) {
        var db = load(), email = String(d.email || '').trim().toLowerCase();
        if (db.users.some(function (u) { return u.email === email; })) return Promise.reject(fail('err_email_taken'));
        var u = { id: uid(), email: email, pw: hash(d.password), name: d.name || email.split('@')[0], lang: d.lang };
        db.users.push(u); db.session = u.id; save(); emit(); return Promise.resolve({ user: pub(u) });
      },
      signIn: function (d) {
        var db = load(), email = String(d.email || '').trim().toLowerCase();
        var u = db.users.filter(function (x) { return x.email === email && x.pw === hash(d.password); })[0];
        if (!u) return Promise.reject(fail('err_invalid_login'));
        db.session = u.id; save(); emit(); return Promise.resolve({ user: pub(u) });
      },
      signOut: function () { load().session = null; save(); emit(); return Promise.resolve(); },
      resetPassword: function () { return Promise.resolve(); },
      updatePassword: function () { return Promise.resolve(); },
      getProfile: function () { return Promise.resolve(pub(need())); },
      updateProfile: function (p) { var u = need(); ['name', 'phone', 'country', 'whatsapp'].forEach(function (k) { if (p[k] !== undefined) u[k] = String(p[k]).slice(0, 80); }); save(); emit(); return Promise.resolve(pub(u)); },
      getSubscription: function () { var u = me(); return Promise.resolve(u ? (load().subs[u.id] || null) : null); },
      listBookings: function () { var u = need(); return Promise.resolve(load().bookings.filter(function (b) { return b.user_id === u.id; }).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; })); },
      getBooking: function (c) { var u = need(); return Promise.resolve(load().bookings.filter(function (b) { return b.code === c && b.user_id === u.id; })[0] || null); },
      requestCancel: function (c) {
        var u = need(), b = load().bookings.filter(function (x) { return x.code === c && x.user_id === u.id; })[0];
        if (!b) return Promise.reject(fail('err_not_found'));
        if (new Date(b.date + 'T00:00:00') - Date.now() < 24 * 3600 * 1000) return Promise.reject(fail('err_cancel_window'));
        b.status = 'cancel_requested'; save(); emit(); return Promise.resolve(b);
      },
      seatsLeft: function (sid, date) {
        var s = D.serviceById(sid); if (!s || !s.cap) return Promise.resolve(null);
        return Promise.resolve(Math.max(0, s.cap - seatsTaken(load(), sid, date)));
      },
      checkout: function (p) {
        var u = need(), db = load();
        return sleep(900).then(function () {
          var order = { id: 'ORD-' + uid().slice(0, 8), user_id: u.id, kind: p.kind, ref: p.kind === 'subscription' ? p.plan : p.service, status: 'paid', created_at: now() };
          if (p.kind === 'subscription') {
            var plan = D.planById(p.plan); if (!plan.month) throw fail('err_bad_request');
            order.amount_usd = D.planPrice(plan, p.period); activate(db, u, p.plan, p.period);
          } else {
            var s = D.serviceById(p.service); if (!s) throw fail('err_not_found');
            if (s.cap && s.cap - seatsTaken(db, s.id, p.date) < p.pax) throw fail('err_sold_out');
            var t = D.bookingTotal(s, p.pax, planOf(u).id); order.amount_usd = t.total;
            order.booking_code = createBooking(db, u, p, 'paid', t.total).code;
          }
          db.orders.push(order); save(); emit();
          return { orderId: order.id, demo: true };
        });
      },
      bookWithCredit: function (p) {
        var u = need(), db = load(), sub = db.subs[u.id], s = D.serviceById(p.service);
        if (!sub || !s || s.cat !== 'transfers' || s.unit !== 'vehicle' || effectivePlan(sub).id === 'explorer' || sub.credits_left < 1) return Promise.reject(fail('err_no_credit'));
        sub.credits_left -= 1;
        var b = createBooking(db, u, Object.assign({}, p, { pax: 1 }), 'credit', 0);
        db.orders.push({ id: 'ORD-' + uid().slice(0, 8), user_id: u.id, kind: 'booking', ref: s.id, amount_usd: 0, status: 'paid', booking_code: b.code, created_at: now() });
        save(); emit(); return Promise.resolve({ code: b.code });
      },
      getOrder: function (id) { var u = need(); return Promise.resolve(load().orders.filter(function (o) { return o.id === id && o.user_id === u.id; })[0] || null); },
      createRequest: function (p) {
        var u = need(), db = load(), plan = planOf(u);
        if (p.type === 'concierge') {
          if (plan.concierge === 0) return Promise.reject(fail('err_plan_required'));
          var start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
          var used = db.requests.filter(function (r) { return r.user_id === u.id && r.type === 'concierge' && new Date(r.created_at) >= start; }).length;
          if (plan.concierge > 0 && used >= plan.concierge) return Promise.reject(fail('err_quota'));
        }
        var r = { id: uid(), user_id: u.id, type: p.type, subject: String(p.subject || '').slice(0, 120), message: String(p.message || '').slice(0, 2000), contact: String(p.contact || '').slice(0, 120), status: 'new', created_at: now() };
        db.requests.push(r); save(); return Promise.resolve(r);
      },
      conciergeUsage: function () {
        var u = need(), db = load(), start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
        return Promise.resolve(db.requests.filter(function (r) { return r.user_id === u.id && r.type === 'concierge' && new Date(r.created_at) >= start; }).length);
      },
      boardList: function () {
        var u = need(); if (planOf(u).board < 1) return Promise.reject(fail('err_plan_required'));
        var db = load();
        return Promise.resolve(db.board.filter(function (p) { return p.status === 'open'; }).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; }).map(function (p) {
          return Object.assign({}, p, { mine: p.user_id === u.id, responded: db.responses.some(function (r) { return r.post_id === p.id && r.user_id === u.id; }) });
        }));
      },
      boardCreate: function (p) {
        var u = need(), plan = planOf(u); if (plan.board < 1) return Promise.reject(fail('err_plan_required'));
        var post = { id: uid(), user_id: u.id, author_name: u.name, title: String(p.title).slice(0, 90), activity: String(p.activity || '').slice(0, 40), date_from: p.date_from, date_to: p.date_to || p.date_from, languages: String(p.languages || '').slice(0, 60), note: String(p.note || '').slice(0, 600), status: 'open', created_at: now() };
        load().board.push(post); save(); return Promise.resolve(post);
      },
      boardClose: function (id) { var u = need(), p = load().board.filter(function (x) { return x.id === id && x.user_id === u.id; })[0]; if (p) p.status = 'closed'; save(); return Promise.resolve(); },
      boardRespond: function (id, r) {
        var u = need(), db = load(); if (planOf(u).board < 1) return Promise.reject(fail('err_plan_required'));
        var post = db.board.filter(function (x) { return x.id === id; })[0]; if (!post || post.user_id === u.id) return Promise.reject(fail('err_bad_request'));
        db.responses.push({ id: uid(), post_id: id, user_id: u.id, author_name: u.name, message: String(r.message).slice(0, 500), contact: String(r.contact).slice(0, 120), created_at: now() });
        save(); return Promise.resolve();
      },
      boardResponses: function (id) { var u = need(); var db = load(); var post = db.board.filter(function (x) { return x.id === id && x.user_id === u.id; })[0]; return Promise.resolve(post ? db.responses.filter(function (r) { return r.post_id === id; }) : []); },
      boardReport: function (id, reason) { var u = need(); load().reports.push({ id: uid(), post_id: id, user_id: u.id, reason: String(reason).slice(0, 300), created_at: now() }); save(); return Promise.resolve(); }
    };
  })();

  /* ====================================================================== LIVE */
  var liveApi = (function () {
    var S = null, SKEY = 'tb_session';
    try { S = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { S = null; }
    function store(s) { S = s; try { if (s) localStorage.setItem(SKEY, JSON.stringify(s)); else localStorage.removeItem(SKEY); } catch (e) { /* ignore */ } }
    function user() { return S && S.user ? { id: S.user.id, email: S.user.email, name: (S.user.user_metadata && S.user.user_metadata.name) || S.user.email.split('@')[0] } : null; }
    var refreshing = null;
    function refresh() {
      if (!S || !S.refresh_token) return Promise.reject(fail('err_auth_required'));
      if (refreshing) return refreshing;
      refreshing = fetch(cfg.supabaseUrl + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: cfg.supabaseAnonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: S.refresh_token }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.access_token) { store(null); emit(); throw fail('err_auth_required'); } store(j); return j; }); })
        .then(function (j) { refreshing = null; return j; }, function (e) { refreshing = null; throw e; });
      return refreshing;
    }
    function token() {
      if (!S) return Promise.resolve(null);
      var exp = S.expires_at ? S.expires_at * 1000 : (S.obtained_at || 0) + (S.expires_in || 3600) * 1000;
      if (exp - Date.now() < 60000) return refresh().then(function (j) { return j.access_token; });
      return Promise.resolve(S.access_token);
    }
    function parseErr(j, status) {
      var m = (j && (j.msg || j.message || j.error_description || j.error)) || '';
      if (/invalid login/i.test(m)) return fail('err_invalid_login');
      if (/already|registered/i.test(m)) return fail('err_email_taken');
      if (/password/i.test(m) && /(short|least|weak)/i.test(m)) return fail('err_weak_password');
      if (/confirm/i.test(m)) return fail('err_confirm_email');
      if (j && j.code === 'P0001' && j.message) return fail(String(j.message).split(':')[0].trim());
      if (status === 401 || status === 403) return fail('err_auth_required');
      return fail('err_generic', m);
    }
    function rest(path, o) {
      o = o || {};
      return (o.anon ? Promise.resolve(null) : token()).then(function (tk) {
        var h = { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + (tk || cfg.supabaseAnonKey), 'Content-Type': 'application/json' };
        if (o.prefer) h.Prefer = o.prefer;
        return fetch(cfg.supabaseUrl + '/rest/v1/' + path, { method: o.method || 'GET', headers: h, body: o.body ? JSON.stringify(o.body) : undefined })
          .then(function (r) { return r.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* not json */ } if (!r.ok) throw parseErr(j, r.status); return j; }); });
      });
    }
    function rpc(name, args) { return rest('rpc/' + name, { method: 'POST', body: args || {} }); }
    function authCall(path, body, method) {
      return fetch(cfg.supabaseUrl + '/auth/v1/' + path, { method: method || 'POST', headers: { apikey: cfg.supabaseAnonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw parseErr(j, r.status); return j; }); });
    }
    function need() { var u = user(); if (!u) throw fail('err_auth_required'); return u; }
    function eq(v) { return 'eq.' + encodeURIComponent(v); }

    // returning from an e-mail link (confirm / recovery): Supabase puts the tokens in the URL hash
    var recovery = false;
    (function () {
      var h = location.hash.replace(/^#/, ''); if (h.indexOf('access_token=') < 0) return;
      var q = {}; h.split('&').forEach(function (kv) { var p = kv.split('='); q[p[0]] = decodeURIComponent(p[1] || ''); });
      if (!q.access_token) return;
      try {
        var payload = JSON.parse(atob(q.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        store({ access_token: q.access_token, refresh_token: q.refresh_token, expires_in: +q.expires_in || 3600, expires_at: payload.exp, user: { id: payload.sub, email: payload.email, user_metadata: payload.user_metadata || {} } });
        recovery = q.type === 'recovery';
      } catch (e) { /* ignore bad link */ }
      history.replaceState(null, '', location.pathname + location.search);
    })();

    function sessionOk(j) {
      store(Object.assign({}, j, { obtained_at: Date.now(), expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600) }));
      emit(); return { user: user() };
    }
    return {
      _rest: rest, _rpc: rpc, _recovery: function () { var r = recovery; recovery = false; return r; },
      session: function () { return Promise.resolve(user()); },
      signUp: function (d) {
        return authCall('signup', { email: d.email, password: d.password, data: { name: d.name, lang: d.lang } }).then(function (j) {
          if (j.access_token) return sessionOk(j);
          return { needsConfirm: true };
        });
      },
      signIn: function (d) { return authCall('token?grant_type=password', { email: d.email, password: d.password }).then(sessionOk); },
      signOut: function () {
        var p = S ? fetch(cfg.supabaseUrl + '/auth/v1/logout', { method: 'POST', headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + S.access_token } }).catch(function () { }) : Promise.resolve();
        store(null); emit(); return p.then(function () { });
      },
      resetPassword: function (email) { return authCall('recover', { email: email, redirect_to: location.origin + '/account' }).then(function () { }); },
      updatePassword: function (pw) {
        return token().then(function (tk) {
          return fetch(cfg.supabaseUrl + '/auth/v1/user', { method: 'PUT', headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) })
            .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw parseErr(j, r.status); }); });
        });
      },
      getProfile: function () { var u = need(); return rest('profiles?id=' + eq(u.id) + '&select=*').then(function (a) { var p = a[0] || {}; return { id: u.id, email: u.email, name: p.name || u.name, phone: p.phone || '', country: p.country || '', whatsapp: p.whatsapp || '', is_admin: !!p.is_admin }; }); },
      updateProfile: function (p) { var u = need(), b = {}; ['name', 'phone', 'country', 'whatsapp'].forEach(function (k) { if (p[k] !== undefined) b[k] = String(p[k]).slice(0, 80); }); return rest('profiles?id=' + eq(u.id), { method: 'PATCH', body: b, prefer: 'return=minimal' }).then(function () { emit(); return liveApi.getProfile(); }); },
      getSubscription: function () { var u = user(); if (!u) return Promise.resolve(null); return rest('subscriptions?user_id=' + eq(u.id) + '&select=*').then(function (a) { return a[0] || null; }); },
      listBookings: function () { need(); return rest('bookings?select=*&order=created_at.desc'); },
      getBooking: function (c) { need(); return rest('bookings?code=' + eq(c) + '&select=*').then(function (a) { return a[0] || null; }); },
      requestCancel: function (c) { return rpc('request_cancel', { p_code: c }); },
      seatsLeft: function (sid, date) { var s = D.serviceById(sid); if (!s || !s.cap) return Promise.resolve(null); return rpc('seats_left', { p_service: sid, p_date: date }); },
      checkout: function (p) {
        need(); if (!cfg.paymentsBase) return Promise.reject(fail('err_payments_off'));
        return token().then(function (tk) {
          return fetch(cfg.paymentsBase.replace(/\/$/, '') + '/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk }, body: JSON.stringify(p) })
            .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.url) throw fail(j.error && /^err_/.test(j.error) ? j.error : 'err_generic'); return j; }); });
        }).then(function (j) { location.href = j.url; return new Promise(function () { }); });
      },
      bookWithCredit: function (p) { return rpc('book_with_credit', { p_service: p.service, p_date: p.date, p_hotel: p.hotel || '', p_phone: p.phone || '', p_notes: p.notes || '' }).then(function (c) { emit(); return { code: c }; }); },
      getOrder: function (id) { need(); return rest('orders?id=' + eq(id) + '&select=*').then(function (a) { return a[0] || null; }); },
      createRequest: function (p) { return rpc('create_request', { p_type: p.type, p_subject: p.subject || '', p_message: p.message || '', p_contact: p.contact || '' }); },
      conciergeUsage: function () { return rpc('concierge_used'); },
      boardList: function () { return rest('board_posts?status=eq.open&select=*&order=created_at.desc').then(function (posts) { var u = need(); return rest('board_responses?user_id=' + eq(u.id) + '&select=post_id').then(function (rs) { var done = {}; rs.forEach(function (r) { done[r.post_id] = 1; }); return posts.map(function (p) { return Object.assign({}, p, { mine: p.user_id === u.id, responded: !!done[p.id] }); }); }); }); },
      boardCreate: function (p) { return rpc('board_create', { p_title: p.title, p_activity: p.activity || '', p_from: p.date_from, p_to: p.date_to || p.date_from, p_languages: p.languages || '', p_note: p.note || '' }); },
      boardClose: function (id) { return rest('board_posts?id=' + eq(id), { method: 'PATCH', body: { status: 'closed' }, prefer: 'return=minimal' }); },
      boardRespond: function (id, r) { return rpc('board_respond', { p_post: id, p_message: r.message, p_contact: r.contact }); },
      boardResponses: function (id) { return rest('board_responses?post_id=' + eq(id) + '&select=*&order=created_at.asc'); },
      boardReport: function (id, reason) { return rpc('board_report', { p_post: id, p_reason: reason }); }
    };
  })();

  var impl = live ? liveApi : demo;
  TB.mode = live ? 'live' : 'demo';
  TB.api = Object.assign({}, impl, {
    onChange: function (f) { listeners.push(f); },
    effectivePlan: effectivePlan,
    ymd: ymd,
    recoveryPending: live ? liveApi._recovery : function () { return false; }
  });
})();
