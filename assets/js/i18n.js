/* Travel Buddy — language, currency and formatting engine. Dictionaries live in assets/js/lang/*.js */
(function () {
  'use strict';
  var cfg = TB.config;
  var LANGS = { en: { name: 'English', dir: 'ltr', loc: 'en-GB' }, ar: { name: 'العربية', dir: 'rtl', loc: 'ar-u-nu-latn' }, ru: { name: 'Русский', dir: 'ltr', loc: 'ru-RU' }, de: { name: 'Deutsch', dir: 'ltr', loc: 'de-DE' } };
  var CURRENCIES = ['USD', 'EUR', 'GBP', 'EGP', 'RUB', 'PLN'];
  TB.dict = TB.dict || {};

  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } return null; }

  var lang = (function () {
    var s = ls('tb_lang'); if (s && LANGS[s]) return s;
    var n = (navigator.language || '').slice(0, 2).toLowerCase(); if (LANGS[n]) return n;
    return LANGS[cfg.defaultLang] ? cfg.defaultLang : 'en';
  })();
  var cur = (function () { var s = ls('tb_cur'); return CURRENCIES.indexOf(s) >= 0 ? s : cfg.defaultCurrency; })();
  var rates = Object.assign({}, cfg.rates);
  try { var cached = JSON.parse(ls('tb_rates') || 'null'); if (cached && cached.r) Object.assign(rates, cached.r); } catch (e) { /* ignore */ }

  function apply() {
    var l = LANGS[lang], de = document.documentElement;
    de.lang = lang; de.dir = l.dir;
  }

  function t(key, vars) {
    var s = (TB.dict[lang] && TB.dict[lang][key]);
    if (s === undefined) s = TB.dict.en && TB.dict.en[key];
    if (s === undefined) { (TB.missing = TB.missing || {})[lang + ':' + key] = 1; return key; }
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] === undefined ? m : vars[k]; });
    return s;
  }
  function has(key) { return !!(TB.dict.en && TB.dict.en[key] !== undefined); }
  function L(o) { if (!o) return ''; return o[lang] || o.en || ''; }

  function nf(v, o) { try { return new Intl.NumberFormat(LANGS[lang].loc, o).format(v); } catch (e) { return String(v); } }
  function money(usd, c) {
    c = c || cur;
    var v = usd * (rates[c] || 1), zero = (c === 'EGP' || c === 'RUB');
    if (zero) v = Math.round(v / (c === 'RUB' ? 10 : 5)) * (c === 'RUB' ? 10 : 5);   // tidy numbers for high-denomination currencies
    var frac = zero ? 0 : (Math.abs(v - Math.round(v)) < 0.005 ? 0 : 2);
    return nf(frac ? v : Math.round(v), { style: 'currency', currency: c, currencyDisplay: 'narrowSymbol', minimumFractionDigits: frac, maximumFractionDigits: frac });
  }
  function usd(v) { return nf(v, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function date(d, o) {
    var x = typeof d === 'string' && d.length === 10 ? new Date(d + 'T12:00:00') : new Date(d);
    try { return new Intl.DateTimeFormat(LANGS[lang].loc, o || { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(x); } catch (e) { return String(d); }
  }
  function num(n) { return nf(n); }

  function refreshRates() {
    var c = null; try { c = JSON.parse(ls('tb_rates') || 'null'); } catch (e) { /* ignore */ }
    if (c && Date.now() - c.at < 12 * 3600 * 1000) return;
    if (!window.fetch) return;
    fetch('https://open.er-api.com/v6/latest/USD').then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.rates) return;
      var r = {}; CURRENCIES.forEach(function (k) { if (j.rates[k]) r[k] = j.rates[k]; });
      Object.assign(rates, r); ls('tb_rates', JSON.stringify({ at: Date.now(), r: r }));
    }).catch(function () { /* offline: keep fallback rates */ });
  }

  TB.i18n = {
    LANGS: LANGS, CURRENCIES: CURRENCIES,
    get lang() { return lang; }, get dir() { return LANGS[lang].dir; }, get cur() { return cur; }, get rates() { return rates; },
    t: t, has: has, L: L, money: money, usd: usd, date: date, num: num,
    setLang: function (l) { if (!LANGS[l]) return; lang = l; ls('tb_lang', l); apply(); },
    setCur: function (c) { if (CURRENCIES.indexOf(c) < 0) return; cur = c; ls('tb_cur', c); },
    refreshRates: refreshRates, apply: apply
  };
  TB.t = t; TB.L = L;
  apply();
})();
