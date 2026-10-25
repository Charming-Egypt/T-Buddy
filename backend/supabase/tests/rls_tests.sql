-- Behavioural tests for schema.sql. Run on a scratch database AFTER stub_supabase.sql (plain Postgres) or on a Supabase branch.
-- Every assertion raises on failure; a clean run ends with "ALL TESTS PASSED".
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true); execute 'set local role authenticated'; end $$;
create or replace function pg_temp.as_service() returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', '', true); execute 'set local role service_role'; end $$;
create or replace function pg_temp.reset() returns void language plpgsql as $$ begin execute 'reset role'; end $$;
create or replace function pg_temp.expect_err(code text, stmt text) returns void language plpgsql as $$
declare ok boolean := false; begin
  begin execute stmt; exception when others then ok := (sqlerrm like code || '%'); if not ok then raise exception 'expected % but got: %', code, sqlerrm; end if; end;
  if not ok then raise exception 'expected error % but statement succeeded: %', code, stmt; end if; end $$;
create or replace function pg_temp.eq(label text, got anyelement, want anyelement) returns void language plpgsql as $$ begin
  if got is distinct from want then raise exception 'FAIL %: got % want %', label, got, want; end if; raise notice 'ok  %', label; end $$;

do $$
declare
  free_u uuid := gen_random_uuid(); plus_u uuid := gen_random_uuid(); plus2_u uuid := gen_random_uuid(); vip_u uuid := gen_random_uuid(); admin_u uuid := gen_random_uuid();
  o public.orders; r jsonb; d date := public.cairo_today() + 3; n int; bcode text; post uuid;
begin
  delete from public.bookings; delete from public.orders; delete from public.subscriptions; delete from auth.users;
  insert into auth.users (id, email, raw_user_meta_data) values (free_u, 'free@x.com', '{"name":"Free"}'), (plus_u, 'plus@x.com', '{"name":"Plus"}'), (plus2_u, 'plus2@x.com', '{"name":"Plus Two"}'), (vip_u, 'vip@x.com', '{"name":"Vip"}'), (admin_u, 'admin@x.com', '{}');
  update public.profiles set is_admin = true where id = admin_u;
  perform pg_temp.eq('profile trigger', (select name from public.profiles where id = plus_u), 'Plus');

  -- subscriptions through the service-role flow
  perform pg_temp.as_service();
  o := public.create_order(plus_u, 'subscription', 'plus', 'month', null, null, '{}'); perform pg_temp.eq('plus month price', o.amount_usd, 19.00::numeric);
  r := public.finalize_order(o.id, true, '{}'); perform pg_temp.eq('finalize paid', r ->> 'status', 'paid');
  r := public.finalize_order(o.id, true, '{}'); perform pg_temp.eq('finalize idempotent', r ->> 'created', 'false');
  o := public.create_order(plus2_u, 'subscription', 'buddy', 'month', null, null, '{}'); perform public.finalize_order(o.id, true, '{}');
  o := public.create_order(vip_u, 'subscription', 'vip', 'year', null, null, '{}'); perform pg_temp.eq('vip year price', o.amount_usd, 490.00::numeric); perform public.finalize_order(o.id, true, '{}');
  perform pg_temp.eq('vip credits (2/mo x 12)', (select credits_left from public.subscriptions where user_id = vip_u), 24);
  o := public.create_order(plus_u, 'subscription', 'plus', 'month', null, null, '{}'); perform public.finalize_order(o.id, true, '{}');
  perform pg_temp.eq('renewal extends ~60 days', (select ends_at > now() + interval '59 days' from public.subscriptions where user_id = plus_u), true);
  perform pg_temp.expect_err('err_bad_request', $q$select public.create_order(gen_random_uuid(), 'subscription', 'explorer', 'month', null, null, '{}')$q$);

  -- booking pricing is decided by the server
  o := public.create_order(plus_u, 'booking', 'ras-mohammed', null, d, 3, '{"hotel":"H","phone":"123456"}'); perform pg_temp.eq('plus 15% discount 3 pax', o.amount_usd, 114.75::numeric);
  o := public.create_order(free_u, 'booking', 'ras-mohammed', null, d, 2, '{}'); perform pg_temp.eq('free user full price', o.amount_usd, 90.00::numeric);
  r := public.finalize_order(o.id, true, '{}'); bcode := r ->> 'booking_code'; perform pg_temp.eq('booking created', (select b.status from public.bookings b where b.code = r ->> 'booking_code'), 'confirmed');
  perform pg_temp.eq('seats reduced', public.seats_left('ras-mohammed', d), 28);
  perform pg_temp.expect_err('err_date_past', format($q$select public.create_order(%L, 'booking', 'tiran', null, current_date, 1, '{}')$q$, free_u));
  perform pg_temp.expect_err('err_date_day', format($q$select public.create_order(%L, 'booking', 'stargazing', null, %L, 1, '{}')$q$, free_u, (select min(x) from generate_series(d, d + 6, '1 day') x where extract(dow from x) not in (1, 4))::date));
  perform pg_temp.expect_err('err_sold_out', format($q$select public.create_order(%L, 'booking', 'ras-mohammed', null, %L, 29, '{}')$q$, free_u, d));
  perform pg_temp.expect_err('err_not_found', format($q$select public.create_order(%L, 'booking', 'nope', null, %L, 1, '{}')$q$, free_u, d));
  o := public.create_order(free_u, 'booking', 'tiran', null, d, 1, '{}'); r := public.finalize_order(o.id, false, '{}'); perform pg_temp.eq('failed payment', r ->> 'status', 'failed');
  perform pg_temp.eq('no booking on failure', (select count(*) from public.bookings where order_id = o.id), 0::bigint);

  -- what a logged-in browser can and cannot do
  perform pg_temp.as_user(free_u);
  perform pg_temp.eq('user sees only own bookings', (select count(*) from public.bookings), 1::bigint);
  perform pg_temp.eq('user sees only own orders', (select count(*) from public.orders where user_id <> free_u), 0::bigint);
  perform pg_temp.expect_err('permission denied', $q$update public.profiles set is_admin = true$q$);
  perform pg_temp.expect_err('permission denied', $q$insert into public.orders (id, user_id, kind, ref, amount_usd, status) values ('X', gen_random_uuid(), 'booking', 'tiran', 0, 'paid')$q$);
  perform pg_temp.expect_err('permission denied', $q$insert into public.subscriptions (user_id, plan, period, ends_at) values (gen_random_uuid(), 'vip', 'year', now())$q$);
  perform pg_temp.expect_err('permission denied', format($q$select public.create_order(%L, 'subscription', 'vip', 'year', null, null, '{}')$q$, free_u));
  perform pg_temp.expect_err('permission denied', format($q$select public.finalize_order('ORD-1', true, '{}')$q$));
  update public.bookings set status = 'refunded';   -- RLS hides the row from the update: silently 0 rows
  perform pg_temp.eq('user cannot refund own booking', (select status from public.bookings), 'confirmed');
  perform pg_temp.eq('anon-visible catalogue', (select count(*) from public.services), 29::bigint);
  perform pg_temp.expect_err('err_plan_required', $q$select public.board_create('t', 'sea', current_date + 2, null, '', '')$q$);
  perform pg_temp.expect_err('err_plan_required', $q$select public.create_request('concierge', 's', 'm', 'c')$q$);
  perform pg_temp.eq('free user cannot read board', (select count(*) from public.board_posts), 0::bigint);
  perform pg_temp.eq('contact request ok', (select public.create_request('contact', 's', 'hello', 'c') is not null), true);
  perform pg_temp.reset();

  -- cancellation window
  perform pg_temp.as_user(free_u);
  perform pg_temp.eq('cancel >24h ok', (select status from public.request_cancel(bcode)), 'cancel_requested');
  perform pg_temp.expect_err('err_bad_request', format($q$select public.request_cancel(%L)$q$, bcode));
  perform pg_temp.reset(); perform pg_temp.as_service();
  o := public.create_order(free_u, 'booking', 'airport-sedan', null, public.cairo_today() + 1, 1, '{}'); r := public.finalize_order(o.id, true, '{}');
  perform pg_temp.reset(); update public.bookings b set date = public.cairo_today() where b.code = r ->> 'booking_code';
  perform pg_temp.as_user(free_u); perform pg_temp.expect_err('err_cancel_window', format($q$select public.request_cancel(%L)$q$, r ->> 'booking_code')); perform pg_temp.reset();

  -- buddy board
  perform pg_temp.as_user(plus_u);
  post := public.board_create('Dive buddy', 'diving', public.cairo_today() + 2, null, 'EN', 'note');
  perform pg_temp.eq('plus sees own post', (select count(*) from public.board_posts), 1::bigint); perform pg_temp.reset();
  perform pg_temp.as_user(plus2_u);
  perform pg_temp.eq('buddy sees open posts', (select count(*) from public.board_posts), 1::bigint);
  perform public.board_respond(post, 'I am in', '+44123'); perform public.board_respond(post, 'again', '+44123');
  perform pg_temp.eq('one reply per user', (select count(*) from public.board_responses), 1::bigint);
  perform pg_temp.expect_err('err_bad_request', format($q$select public.board_respond(%L, 'x', 'y')$q$, gen_random_uuid())); perform pg_temp.reset();
  perform pg_temp.as_user(plus_u); perform pg_temp.eq('author sees replies', (select count(*) from public.board_responses), 1::bigint);
  perform pg_temp.expect_err('err_bad_request', format($q$select public.board_respond(%L, 'x', 'y')$q$, post)); perform pg_temp.reset();
  perform pg_temp.as_user(vip_u); perform pg_temp.eq('stranger cannot read replies', (select count(*) from public.board_responses), 0::bigint); perform pg_temp.reset();

  -- concierge quota (Buddy = 1 / month)
  perform pg_temp.as_user(plus2_u);
  perform public.create_request('concierge', 'Dinner', 'table for 6', 'wa'); perform pg_temp.expect_err('err_quota', $q$select public.create_request('concierge', 'again', 'x', 'y')$q$);
  perform pg_temp.eq('usage counted', public.concierge_used(), 1); perform pg_temp.reset();

  -- included transfer credits
  perform pg_temp.as_user(vip_u);
  bcode := public.book_with_credit('airport-sedan', public.cairo_today() + 2, 'EZY1', '123456', '');
  perform pg_temp.eq('credit consumed', (select credits_left from public.subscriptions), 23);
  perform pg_temp.expect_err('err_no_credit', format($q$select public.book_with_credit('ras-mohammed', %L, '', '', '')$q$, public.cairo_today() + 2)); perform pg_temp.reset();
  perform pg_temp.as_user(free_u); perform pg_temp.expect_err('err_no_credit', format($q$select public.book_with_credit('airport-sedan', %L, '', '', '')$q$, public.cairo_today() + 2)); perform pg_temp.reset();

  -- admin
  perform pg_temp.as_user(admin_u);
  perform pg_temp.eq('admin sees all bookings', (select count(*) >= 3 from public.bookings), true);
  perform public.admin_resolve_cancel(bcode, true);
  perform pg_temp.eq('credit restored on refund', (select credits_left from public.subscriptions where user_id = vip_u), 24); perform pg_temp.reset();
  perform pg_temp.as_user(free_u); perform pg_temp.expect_err('err_auth_required', format($q$select public.admin_resolve_cancel(%L, true)$q$, bcode)); perform pg_temp.reset();

  raise notice 'ALL TESTS PASSED';
end $$;
