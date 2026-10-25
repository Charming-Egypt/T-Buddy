// node backend/worker/test.mjs — offline tests for the payments Worker (Supabase + Kashier are mocked).
import assert from 'node:assert/strict';
import worker, { hmacHex, checkoutHash, verifyReturnSignature } from './payments-worker.js';
const env = { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'svc', KASHIER_MERCHANT_ID: 'MID-1', KASHIER_API_KEY: 'apikey', KASHIER_SECRET_KEY: 'secret', KASHIER_MODE: 'test', PAY_CURRENCY: 'EGP', USD_TO_PAY_RATE: '50', SITE_URL: 'https://site.test', ALLOWED_ORIGINS: 'https://site.test' };
const orders = {}, finalized = [];
globalThis.fetch = async (url, o = {}) => {
  url = String(url); const body = o.body ? JSON.parse(o.body) : null, ok = (j, s = 200) => new Response(JSON.stringify(j), { status: s });
  if (url.endsWith('/auth/v1/user')) return o.headers.Authorization === 'Bearer good' ? ok({ id: 'u1' }) : ok({}, 401);
  if (url.endsWith('/rpc/create_order')) { if (body.p_ref === 'bad') return ok({ message: 'err_not_found', code: 'P0001' }, 400); const x = { id: 'ORD-1', amount_usd: body.p_kind === 'subscription' ? 19 : 114.75, status: 'pending' }; orders['ORD-1'] = x; return ok(x); }
  if (url.includes('/rest/v1/orders?id=eq.') && o.method === 'PATCH') { Object.assign(orders['ORD-1'], body); return new Response(null, { status: 204 }); }
  if (url.includes('/rest/v1/orders?id=eq.')) { const id = decodeURIComponent(url.match(/eq\.([^&]+)/)[1]); return ok(orders[id] ? [orders[id]] : []); }
  if (url.endsWith('/rpc/finalize_order')) { finalized.push(body); orders[body.p_order].status = body.p_ok ? 'paid' : 'failed'; return ok({ status: orders[body.p_order].status }); }
  throw new Error('unexpected fetch ' + url);
};
const call = (path, init) => worker.fetch(new Request('https://pay.test' + path, init), env);
let n = 0; const t = async (name, fn) => { await fn(); console.log('ok  ' + name); n++; };

await t('health', async () => { const r = await (await call('/api/health')).json(); assert.equal(r.configured, true); });
await t('checkout needs a valid login', async () => { const r = await call('/api/checkout', { method: 'POST', body: '{}', headers: { Authorization: 'Bearer nope' } }); assert.equal(r.status, 401); });
await t('checkout surfaces db errors as err_ codes', async () => { const r = await call('/api/checkout', { method: 'POST', headers: { Authorization: 'Bearer good' }, body: JSON.stringify({ kind: 'booking', service: 'bad', date: '2030-01-01' }) }); assert.equal(r.status, 400); assert.equal((await r.json()).error, 'err_not_found'); });
let payUrl;
await t('checkout returns a signed Kashier URL with server-side price', async () => {
  const r = await call('/api/checkout', { method: 'POST', headers: { Authorization: 'Bearer good', Origin: 'https://site.test' }, body: JSON.stringify({ kind: 'booking', service: 'ras-mohammed', date: '2030-01-01', pax: 3, amount_usd: 1, price: 1, lang: 'ar' }) });
  assert.equal(r.status, 200); assert.equal(r.headers.get('access-control-allow-origin'), 'https://site.test');
  const j = await r.json(); payUrl = new URL(j.url); assert.equal(payUrl.searchParams.get('amount'), '5737.50');   // 114.75 USD x 50, ignores the client's "price"
  assert.equal(payUrl.searchParams.get('currency'), 'EGP'); assert.equal(payUrl.searchParams.get('display'), 'ar');
  assert.equal(payUrl.searchParams.get('hash'), await hmacHex('/?payment=MID-1.ORD-1.5737.50.EGP', 'apikey'));
  assert.equal(payUrl.searchParams.get('merchantRedirect'), 'https://pay.test/api/return'); assert.equal(orders['ORD-1'].pay_amount, '5737.50');
});
const signed = async (p, key = 'apikey') => { const q = Object.entries(p).map(([k, v]) => `${k}=${v}`).join('&'); return `${q}&signature=${await hmacHex(q, key)}&mode=test`; };
await t('return with BAD signature never pays', async () => {
  const r = await call('/api/return?paymentStatus=SUCCESS&merchantOrderId=ORD-1&amount=5737.50&currency=EGP&signature=deadbeef', { redirect: 'manual' });
  assert.equal(r.status, 302); assert.equal(finalized.length, 0); assert.match(r.headers.get('location'), /payment\/result\?order=ORD-1/);
});
await t('return with valid signature but WRONG amount fails the order', async () => {
  const qs = await signed({ paymentStatus: 'SUCCESS', merchantOrderId: 'ORD-1', amount: '1.00', currency: 'EGP' });
  await call('/api/return?' + qs, {}); assert.equal(finalized.at(-1).p_ok, false); orders['ORD-1'].status = 'pending';
});
await t('return with valid signature + right amount finalises once', async () => {
  const qs = await signed({ paymentStatus: 'SUCCESS', merchantOrderId: 'ORD-1', amount: '5737.50', currency: 'EGP' }, 'secret');
  const before = finalized.length; await call('/api/return?' + qs, {}); assert.equal(finalized.length, before + 1); assert.equal(finalized.at(-1).p_ok, true);
  await call('/api/return?' + qs, {}); assert.equal(finalized.length, before + 1);   // second call: order no longer pending -> no second finalize
});
await t('webhook: signature required, then settles', async () => {
  orders['ORD-1'].status = 'pending';
  const data = { merchantOrderId: 'ORD-1', status: 'SUCCESS', amount: 5737.5, currency: 'EGP', signatureKeys: ['status', 'merchantOrderId', 'amount', 'currency'] };
  const raw = JSON.stringify({ event: 'pay', data });
  let r = await call('/api/webhook', { method: 'POST', body: raw, headers: { 'x-kashier-signature': 'bad' } }); assert.equal(r.status, 401);
  const sig = await hmacHex('amount=5737.5&currency=EGP&merchantOrderId=ORD-1&status=SUCCESS', 'apikey');
  r = await call('/api/webhook', { method: 'POST', body: raw, headers: { 'x-kashier-signature': sig } }); assert.equal(r.status, 200); assert.equal(orders['ORD-1'].status, 'paid');
});
await t('checkoutHash helper', async () => assert.equal(await checkoutHash('M', 'O', '1.00', 'EGP', 'k'), await hmacHex('/?payment=M.O.1.00.EGP', 'k')));
await t('CORS rejects unknown origins', async () => { const r = await call('/api/checkout', { method: 'OPTIONS', headers: { Origin: 'https://evil.test' } }); assert.equal(r.headers.get('access-control-allow-origin'), null); });
console.log(`\n${n} worker tests passed`);
