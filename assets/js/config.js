/* Travel Buddy — site configuration.
   Fill these in (or run `node tools/configure.mjs` with a .env file) and the site switches from DEMO mode to LIVE mode.
   None of these values is secret: the Supabase anon key is designed to be public (Row-Level-Security protects the data).
   Secrets (service-role key, Kashier keys) live ONLY in the payments Worker — never here. */
window.TB = window.TB || {};
TB.config = {
  brand: 'Travel Buddy',
  siteUrl: '',                 // e.g. https://www.travelbuddy-sharm.com  (used for canonical / share links)
  supabaseUrl: '',             // https://xxxx.supabase.co
  supabaseAnonKey: '',         // anon public key
  paymentsBase: '',            // https://pay.yourdomain.com  (the Worker in backend/worker)
  whatsapp: '',                // international format, digits only, e.g. 201001234567  (leave empty to hide the button)
  supportEmail: '',            // e.g. hello@yourdomain.com  (leave empty to hide)
  defaultLang: 'en',           // en | ar | ru | de
  defaultCurrency: 'USD',      // display currency: USD | EUR | GBP | EGP | RUB | PLN
  // Fallback display rates (1 USD = x). The site refreshes them from a free public API when online.
  rates: { USD: 1, EUR: 0.92, GBP: 0.78, EGP: 48.5, RUB: 90, PLN: 4.0 },
  payNote: ''                  // shown at checkout, e.g. 'Card payments are processed in EGP by Kashier.'
};
