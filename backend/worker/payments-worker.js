/**
 * Travel Buddy — payments Worker (Cloudflare Workers, single file, no dependencies).
 *
 *   POST /api/checkout   (browser, Bearer <supabase JWT>)  → creates a priced order in Supabase, returns the Kashier hosted-checkout URL
 *   GET  /api/return     (Kashier redirects the customer here) → verifies the signature, finalises the order, sends the customer back to the site
 *   POST /api/webhook    (Kashier server-to-server)         → same finalisation, in case the customer closes the tab
 *   GET  /api/health
 *
 * Money rules:  the browser NEVER sends a price. Prices come from Postgres (create_order). A payment is accepted only if
 * the Kashier signature is valid AND the paid amount/currency equal what we stored for that order. finalize_order() is idempotent.
 *
 * Secrets (wrangler secret put …):  SUPABASE_SERVICE_ROLE_KEY, KASHIER_API_KEY, KASHIER_SECRET_KEY (optional)
 * Variables (wrangler.toml [vars]):  SUPABASE_URL, KASHIER_MERCHANT_ID, KASHIER_MODE (test|live), PAY_CURRENCY, USD_TO_PAY_RATE, SITE_URL, ALLOWED_ORIGINS
 */

const enc = new TextEncoder();
export async function hmacHex(message, key) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(message)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function safeEqual(a, b) {
  a = String(a || '').toLowerCase(); b = String(b || '').toLowerCase();
  if (a.length !== b.length || !a) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0;
}
/** Kashier hosted-checkout hash. */
export const checkoutHash = (mid, orderId, amount, currency, apiKey) => hmacHex(`/?payment=${mid}.${orderId}.${amount}.${currency}`, apiKey);
const money = n => (Math.round(n * 100) / 100).toFixed(2);

/** Redirect-signature: every query param except `signature` and `mode`, in order, as k=v&k=v. */
export async function verifyReturnSignature(params, env) {
  const sig = params.get('signature'); if (!sig) return false;
  const q = []; for (const [k, v] of params) { if (k === 'signature' || k === 'mode') continue; q.push(`${k}=${v}`); }
  const str = q.join('&');
  for (const key of [env.KASHIER_API_KEY, env.KASHIER_SECRET_KEY].filter(Boolean)) if (safeEqual(await hmacHex(str, key), sig)) return true;
  return false;
}
/** Webhook-signature: data.signatureKeys sorted, as k=v&k=v, header x-kashier-signature. Falls back to raw-body HMAC. */
export async function verifyWebhookSignature(raw, body, header, env) {
  if (!header) return false;
  const data = body && body.data || {}, keys = Array.isArray(data.signatureKeys) ? [...data.signatureKeys].sort() : null;
  const candidates = [raw];
  if (keys) candidates.unshift(keys.map(k => `${k}=${data[k]}`).join('&'));
  for (const key of [env.KASHIER_API_KEY, env.KASHIER_SECRET_KEY].filter(Boolean)) for (const c of candidates) if (safeEqual(await hmacHex(c, key), header)) return true;
  return false;
}

// ---------- small helpers ----------
function cors(req, env) {
  const origin = req.headers.get('Origin') || '', allowed = (env.ALLOWED_ORIGINS || env.SITE_URL || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
  const h = { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
  if (allowed.includes(origin.replace(/\/$/, ''))) h['Access-Control-Allow-Origin'] = origin; return h;
}
const json = (data, status, req, env) => new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json', ...(req ? cors(req, env) : {}) } });
const hits = new Map();
function limited(req, bucket, max, windowMs) {
  const k = bucket + ':' + (req.headers.get('CF-Connecting-IP') || 'x'), now = Date.now(), a = (hits.get(k) || []).filter(t => now - t < windowMs);
  a.push(now); hits.set(k, a); if (hits.size > 5000) hits.clear(); return a.length > max;
}
async function sb(env, path, opts = {}) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { method: opts.method || 'GET', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch { /* not json */ }
  if (!r.ok) { const e = new Error((j && j.message) || 'db_error'); e.db = j; throw e; }
  return j;
}
const rpc = (env, name, args) => sb(env, `rpc/${name}`, { method: 'POST', body: args });
async function userFromJwt(req, env) {
  const m = /^Bearer (.+)$/.exec(req.headers.get('Authorization') || ''); if (!m) return null;
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${m[1]}` } });
  if (!r.ok) return null; const u = await r.json(); return u && u.id ? u : null;
}
let rateCache = { at: 0, v: 0 };
async function usdToPay(env) {
  const cur = (env.PAY_CURRENCY || 'EGP').toUpperCase(); if (cur === 'USD') return 1;
  if (env.USD_TO_PAY_RATE && +env.USD_TO_PAY_RATE > 0) return +env.USD_TO_PAY_RATE;
  if (Date.now() - rateCache.at < 3600e3 && rateCache.v) return rateCache.v;
  const r = await fetch('https://open.er-api.com/v6/latest/USD'); const j = await r.json(); const v = j && j.rates && j.rates[cur];
  if (!v) throw new Error('rate_unavailable'); rateCache = { at: Date.now(), v }; return v;
}
const siteResult = (env, order, extra = '') => `${(env.SITE_URL || '').replace(/\/$/, '')}/payment/result?order=${encodeURIComponent(order || '')}${extra}`;

// ---------- finalise (shared by return + webhook) ----------
export async function settle(env, orderId, status, amount, currency, gateway) {
  const rows = await sb(env, `orders?id=eq.${encodeURIComponent(orderId)}&select=id,status,pay_amount,pay_currency`);
  const o = rows && rows[0]; if (!o) return { status: 'missing' };
  if (o.status !== 'pending') return { status: o.status };
  const ok = String(status).toUpperCase() === 'SUCCESS' && Math.abs(parseFloat(amount) - parseFloat(o.pay_amount)) < 0.011 && String(currency).toUpperCase() === String(o.pay_currency).toUpperCase();
  if (String(status).toUpperCase() === 'SUCCESS' && !ok) { await rpc(env, 'finalize_order', { p_order: orderId, p_ok: false, p_gateway: { ...gateway, reason: 'amount_mismatch' } }); return { status: 'failed' }; }
  const r = await rpc(env, 'finalize_order', { p_order: orderId, p_ok: ok, p_gateway: gateway });
  return { status: r && r.status };
}

// ---------- routes ----------
async function checkout(req, env) {
  if (limited(req, 'co', 15, 60000)) return json({ error: 'err_quota' }, 429, req, env);
  const user = await userFromJwt(req, env); if (!user) return json({ error: 'err_auth_required' }, 401, req, env);
  let b; try { b = await req.json(); } catch { return json({ error: 'err_bad_request' }, 400, req, env); }
  const kind = b.kind === 'subscription' ? 'subscription' : b.kind === 'booking' ? 'booking' : null; if (!kind) return json({ error: 'err_bad_request' }, 400, req, env);
  const ref = String(kind === 'subscription' ? b.plan : b.service || '').slice(0, 40);
  let order;
  try {
    order = await rpc(env, 'create_order', { p_user: user.id, p_kind: kind, p_ref: ref, p_period: kind === 'subscription' ? String(b.period || '') : null,
      p_date: kind === 'booking' ? String(b.date || '') || null : null, p_pax: Math.max(1, Math.min(50, parseInt(b.pax, 10) || 1)),
      p_meta: { hotel: String(b.hotel || ''), phone: String(b.phone || ''), notes: String(b.notes || '') } });
  } catch (e) { const m = String(e.message || ''); return json({ error: /^err_[a-z_]+/.test(m) ? m.match(/^err_[a-z_]+/)[0] : 'err_generic' }, 400, req, env); }
  const cur = (env.PAY_CURRENCY || 'EGP').toUpperCase();
  let rate; try { rate = await usdToPay(env); } catch { return json({ error: 'err_generic' }, 502, req, env); }
  const amount = money(order.amount_usd * rate);
  await sb(env, `orders?id=eq.${encodeURIComponent(order.id)}`, { method: 'PATCH', body: { pay_currency: cur, pay_amount: amount }, headers: { Prefer: 'return=minimal' } });
  const hash = await checkoutHash(env.KASHIER_MERCHANT_ID, order.id, amount, cur, env.KASHIER_API_KEY);
  const origin = new URL(req.url).origin, q = new URLSearchParams({
    merchantId: env.KASHIER_MERCHANT_ID, orderId: order.id, amount, currency: cur, hash, mode: (env.KASHIER_MODE || 'live') === 'test' ? 'test' : 'live',
    merchantRedirect: `${origin}/api/return`, serverWebhook: `${origin}/api/webhook`, failureRedirect: 'true', redirectMethod: 'get', display: b.lang === 'ar' ? 'ar' : 'en', allowedMethods: 'card,wallet'
  });
  return json({ url: `https://checkout.kashier.io/?${q}`, orderId: order.id }, 200, req, env);
}

async function ret(req, env) {
  const p = new URL(req.url).searchParams, orderId = p.get('merchantOrderId') || p.get('orderId') || '';
  try {
    if (orderId && await verifyReturnSignature(p, env)) await settle(env, orderId, p.get('paymentStatus') || '', p.get('amount'), p.get('currency'), { via: 'return', transactionId: p.get('transactionId'), orderReference: p.get('orderReference'), card: p.get('cardBrand') });
  } catch (e) { console.error('return error', e.message); }
  return Response.redirect(siteResult(env, orderId), 302);   // the page re-reads the order from Supabase; an unsigned redirect can never mark anything paid
}

async function webhook(req, env) {
  if (limited(req, 'wh', 300, 60000)) return json({ error: 'rate' }, 429);
  const raw = await req.text(); let body; try { body = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400); }
  if (!await verifyWebhookSignature(raw, body, req.headers.get('x-kashier-signature'), env)) return json({ error: 'bad signature' }, 401);
  const d = body.data || {}, orderId = d.merchantOrderId;
  if (!orderId) return json({ ok: true });
  try { await settle(env, orderId, d.status, d.amount, d.currency, { via: 'webhook', transactionId: d.transactionId, kashierOrderId: d.kashierOrderId }); } catch (e) { console.error('webhook error', e.message); return json({ error: 'retry' }, 500); }
  return json({ ok: true });
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req, env) });
    try {
      if (u.pathname === '/api/health') return json({ ok: true, mode: env.KASHIER_MODE || 'live', configured: !!(env.KASHIER_MERCHANT_ID && env.KASHIER_API_KEY && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) });
      if (u.pathname === '/api/checkout' && req.method === 'POST') return await checkout(req, env);
      if (u.pathname === '/api/return' && req.method === 'GET') return await ret(req, env);
      if (u.pathname === '/api/webhook' && req.method === 'POST') return await webhook(req, env);
    } catch (e) { console.error(e); return json({ error: 'err_generic' }, 500, req, env); }
    return new Response('Not found', { status: 404 });
  }
};
