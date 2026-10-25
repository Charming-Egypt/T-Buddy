# Travel Buddy — شرم الشيخ

موقع رفيق السائح لشرم الشيخ: رحلات وخدمات تُحجز بالدفع، باقات اشتراك شهرية وعضويات، بوابة حجز، أدوات سياحية، لوحة رفاق السفر، وصفحة إدارة. بنفس تصميم Discover Sharm. لا يحتاج build — ملفات ثابتة (HTML/CSS/JS).

## وضعان للتشغيل
| الوضع | متى | ماذا يحدث |
|---|---|---|
| **DEMO** | `config.js` فاضي | كل شيء يعمل داخل المتصفح (localStorage) والدفع تجريبي — للمعاينة فقط، ويظهر شريط تنبيه. |
| **LIVE** | بعد إدخال مفاتيح Supabase + Worker الدفع | حسابات حقيقية، قاعدة بيانات، دفع Kashier فعلي. |

للمعاينة المحلية: `node tools/serve.mjs 8090` ثم افتح http://localhost:8090

## Go live (خطوة بخطوة)

### 1) Supabase (قاعدة البيانات والحسابات)
1. أنشئ مشروعاً في supabase.com.
2. SQL Editor: شغّل `backend/supabase/schema.sql` ثم `backend/supabase/seed.sql` (الباقات والخدمات).
3. Authentication → URL Configuration: ضع `Site URL` = رابط موقعك، وأضف نفس الرابط في Redirect URLs.
4. سجّل حساباً من الموقع، ثم اجعله أدمن:
   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = 'you@example.com');
   ```
5. انسخ `Project URL` و `anon key` (Settings → API).

> بعد تعديل الأسعار/الخدمات في `assets/js/data.js` شغّل `node tools/make-seed.mjs` وأعد تنفيذ `seed.sql`.

### 2) Worker الدفع (Cloudflare + Kashier)
1. `cd backend/worker` وراجع `wrangler.toml` (المتغيرات والأسرار موثقة بداخله).
2. أضف الأسرار بـ `wrangler secret put ...` (مفاتيح Kashier و `SUPABASE_SERVICE_ROLE_KEY`). **لا تضعها أبداً في `config.js`.**
3. `wrangler deploy` ثم اربطه بدومين مثل `pay.your-domain.com`.
4. في لوحة Kashier ضع رابط الـ webhook: `https://pay.your-domain.com/api/webhook`.
5. جرّب بوضع **test** أولاً، ثم بدّل لـ live. الخصم يتم بالعملة المحددة في الإعدادات (غالباً EGP).

### 3) إعداد الموقع
```
cp .env.example .env      # عدّل القيم
node tools/configure.mjs  # يكتب assets/js/config.js
```
القيم: `SITE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PAYMENTS_BASE`, `WHATSAPP` (أرقام فقط بصيغة دولية), `SUPPORT_EMAIL`.

### 4) الاستضافة (Cloudflare Pages أو Netlify)
- ارفع المجلد كما هو (بدون build). على Cloudflare Workers/Pages: ملف `wrangler.jsonc` يفعّل توجيه الـ SPA (`single-page-application`) و`.assetsignore` يمنع رفع `backend` و`tools`؛ و`_headers` للأمان. (على Netlify/Pages القديم أضف `_redirects` بسطر `/* /index.html 200`).
- بدّل الدومين في `sitemap.xml` و`robots.txt`.
- عند كل تحديث للملفات غيّر `VERSION` في `sw.js` حتى يحدّث الزوار النسخة المخزنة.
- صفحة الإدارة: `/admin.html` (للأدمن فقط، لا تُفهرس).

## قبل الإطلاق — راجع هذه النقاط
- **الأسعار والخدمات** في `data.js` أمثلة، عدّلها لأسعارك وموردينك الفعليين.
- **النصوص القانونية** (الشروط/الخصوصية/الاسترجاع) قوالب عامة — يجب مراجعتها من محامٍ.
- **واتساب والبريد** فارغان حتى تضبطهما.
- **تجديد الاشتراك يدوي** (يشتري العميل مرة أخرى) — لا يوجد خصم تلقائي متكرر.
- **الاسترجاع**: من صفحة الإدارة ← Bookings؛ استرد المبلغ من Kashier أولاً ثم اضغط "Refunded".
- صورة الغلاف محمّلة من رابط خارجي مع بديل متدرج؛ يُفضّل رفع صورتك.
- صفحات القانون بالروسية والألمانية تظهر بالإنجليزية.

## الاختبارات
```
node backend/worker/test.mjs                        # منطق الدفع والتوقيعات
node tools/make-seed.mjs                            # توليد seed.sql
# قاعدة البيانات (Postgres عادي):
psql -f backend/supabase/tests/stub_supabase.sql -f backend/supabase/schema.sql -f backend/supabase/tests/rls_tests.sql
```
**لم يُختبر**: الاتصال الفعلي بـ Supabase و Kashier (لا شبكة/مفاتيح في بيئة التطوير) — جرّبهما بحسابات تجريبية قبل استقبال العملاء.

## هيكل المشروع
`index.html` + `assets/` الواجهة · `admin.html` الإدارة · `backend/supabase` قاعدة البيانات · `backend/worker` الدفع · `tools/` أدوات التشغيل.
