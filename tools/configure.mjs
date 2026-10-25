// Usage: node tools/configure.mjs   (reads ./.env, rewrites the values in assets/js/config.js)
import fs from 'node:fs';
const envPath = new URL('../.env', import.meta.url), cfgPath = new URL('../assets/js/config.js', import.meta.url);
if (!fs.existsSync(envPath)) { console.error('No .env file. Copy .env.example to .env and fill it in.'); process.exit(1); }
const env = Object.fromEntries(fs.readFileSync(envPath, 'utf8').split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const map = { siteUrl: 'SITE_URL', supabaseUrl: 'SUPABASE_URL', supabaseAnonKey: 'SUPABASE_ANON_KEY', paymentsBase: 'PAYMENTS_BASE', whatsapp: 'WHATSAPP', supportEmail: 'SUPPORT_EMAIL', defaultLang: 'DEFAULT_LANG', defaultCurrency: 'DEFAULT_CURRENCY', payNote: 'PAY_NOTE' };
let src = fs.readFileSync(cfgPath, 'utf8'), n = 0;
for (const [k, e] of Object.entries(map)) {
  if (env[e] === undefined || env[e] === '') continue;
  const re = new RegExp("(\\b" + k + ":\\s*)'[^']*'");
  if (!re.test(src)) { console.warn('skip', k); continue; }
  src = src.replace(re, (_, p) => p + "'" + env[e].replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"); n++;
}
if (Object.values(env).some(v => /service_role|sk_live|secret/i.test(v))) { console.error('Refusing: values look like secrets. config.js is public.'); process.exit(1); }
fs.writeFileSync(cfgPath, src);
console.log('config.js updated (' + n + ' values). Mode:', env.SUPABASE_URL && env.SUPABASE_ANON_KEY ? 'LIVE' : 'DEMO');
