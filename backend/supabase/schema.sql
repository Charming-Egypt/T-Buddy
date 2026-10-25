-- =====================================================================
-- Travel Buddy — database schema (Supabase / PostgreSQL 15+)
-- Run once in: Supabase → SQL Editor → paste → Run.   Then run seed.sql.
-- Safe to re-run: everything is "create or replace" / "if not exists".
-- =====================================================================

-- ---------- catalogue (mirrors assets/js/data.js, generated into seed.sql) ----------
create table if not exists public.plans (
  id text primary key, rank int not null, month_usd numeric(8,2) not null default 0, year_usd numeric(8,2) not null default 0,
  discount_pct int not null default 0 check (discount_pct between 0 and 90), transfer_credits int not null default 0,
  concierge int not null default 0,          -- requests / month, -1 = unlimited
  board int not null default 0,              -- 0 = no Buddy Board access
  active boolean not null default true
);
create table if not exists public.services (
  id text primary key, category text not null, title_en text not null, price_usd numeric(10,2) not null check (price_usd >= 0),
  unit text not null, capacity int, days int[],              -- days: allowed weekdays, 0 = Sunday
  active boolean not null default true
);

-- ---------- people ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text, phone text, whatsapp text, country text, is_admin boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null references public.plans(id), period text not null check (period in ('month', 'year')),
  status text not null default 'active', started_at timestamptz not null default now(), ends_at timestamptz not null,
  credits_left int not null default 0, updated_at timestamptz not null default now()
);

-- ---------- money ----------
create table if not exists public.orders (
  id text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('subscription', 'booking')), ref text not null, period text,
  service_date date, pax int not null default 1, amount_usd numeric(10,2) not null, pay_currency text, pay_amount numeric(12,2),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  meta jsonb not null default '{}'::jsonb, booking_code text, gateway jsonb, created_at timestamptz not null default now(), paid_at timestamptz
);
create table if not exists public.bookings (
  code text primary key, user_id uuid not null references auth.users(id) on delete cascade, service_id text not null references public.services(id),
  date date not null, pax int not null default 1, total_usd numeric(10,2) not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancel_requested', 'cancelled', 'refunded')),
  hotel text, phone text, notes text, via text not null default 'paid', order_id text, created_at timestamptz not null default now()
);

-- ---------- support & community ----------
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('concierge', 'contact', 'system')), subject text, message text, contact text,
  status text not null default 'new' check (status in ('new', 'in_progress', 'done')), created_at timestamptz not null default now()
);
create table if not exists public.board_posts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, author_name text,
  title text not null, activity text, date_from date not null, date_to date, languages text, note text,
  status text not null default 'open' check (status in ('open', 'closed', 'removed')), created_at timestamptz not null default now()
);
create table if not exists public.board_responses (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.board_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, author_name text, message text not null, contact text not null,
  created_at timestamptz not null default now(), unique (post_id, user_id)
);
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(), post_id uuid references public.board_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, reason text, status text not null default 'new', created_at timestamptz not null default now()
);

create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists bookings_user_idx on public.bookings (user_id, created_at desc);
create index if not exists bookings_seat_idx on public.bookings (service_id, date) where status in ('confirmed', 'cancel_requested');
create index if not exists board_open_idx on public.board_posts (created_at desc) where status = 'open';

-- ---------- helpers ----------
create or replace function public.cairo_today() returns date language sql stable as $$ select (now() at time zone 'Africa/Cairo')::date $$;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

-- the plan whose perks apply right now (expired subscriptions fall back to nothing = Explorer)
create or replace function public.active_plan(p_user uuid) returns public.plans language sql stable security definer set search_path = public as $$
  select p.* from public.subscriptions s join public.plans p on p.id = s.plan where s.user_id = p_user and s.status = 'active' and s.ends_at > now() $$;

create or replace function public.has_board_access() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select board from public.active_plan(auth.uid())), 0) >= 1 $$;

create or replace function public.seats_left(p_service text, p_date date) returns int language sql stable security definer set search_path = public as $$
  select case when s.capacity is null then null
              else greatest(0, s.capacity - coalesce((select sum(b.pax) from public.bookings b where b.service_id = s.id and b.date = p_date and b.status in ('confirmed', 'cancel_requested')), 0))::int end
  from public.services s where s.id = p_service $$;

create or replace function public.concierge_used() returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.requests where user_id = auth.uid() and type = 'concierge' and created_at >= date_trunc('month', now()) $$;

-- new auth user -> profile row
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name) values (new.id, left(coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), 60)) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- ordering (SERVICE ROLE ONLY — called by the payments Worker) ----------
-- The price is computed HERE, from the catalogue and the user's real subscription. The browser can never set a price.
create or replace function public.create_order(p_user uuid, p_kind text, p_ref text, p_period text, p_date date, p_pax int, p_meta jsonb)
returns public.orders language plpgsql security definer set search_path = public as $$
declare v_plan public.plans; v_svc public.services; v_pct int; v_qty int := 1; v_base numeric; v_amount numeric; v_id text; v_o public.orders;
begin
  if p_kind = 'subscription' then
    select * into v_plan from public.plans where id = p_ref and active;
    if not found or v_plan.month_usd <= 0 or p_period not in ('month', 'year') then raise exception 'err_bad_request'; end if;
    v_amount := case when p_period = 'year' then v_plan.year_usd else v_plan.month_usd end;
  elsif p_kind = 'booking' then
    select * into v_svc from public.services where id = p_ref and active;
    if not found then raise exception 'err_not_found'; end if;
    if p_date is null or p_date < public.cairo_today() + 1 then raise exception 'err_date_past'; end if;
    if v_svc.days is not null and not (extract(dow from p_date)::int = any (v_svc.days)) then raise exception 'err_date_day'; end if;
    if v_svc.unit = 'person' then v_qty := greatest(1, least(coalesce(p_pax, 1), 50)); end if;
    if v_svc.capacity is not null and public.seats_left(v_svc.id, p_date) < v_qty then raise exception 'err_sold_out'; end if;
    select coalesce((public.active_plan(p_user)).discount_pct, 0) into v_pct;
    v_base := round(v_svc.price_usd * v_qty, 2);
    v_amount := round(v_base * (100 - v_pct) / 100.0, 2);
  else raise exception 'err_bad_request'; end if;
  if v_amount <= 0 then raise exception 'err_bad_request'; end if;
  v_id := 'ORD-' || upper(substr(md5(gen_random_uuid()::text), 1, 10));
  insert into public.orders (id, user_id, kind, ref, period, service_date, pax, amount_usd, meta)
  values (v_id, p_user, p_kind, p_ref, p_period, p_date, v_qty, v_amount,
          jsonb_build_object('hotel', left(coalesce(p_meta ->> 'hotel', ''), 80), 'phone', left(coalesce(p_meta ->> 'phone', ''), 30), 'notes', left(coalesce(p_meta ->> 'notes', ''), 400)))
  returning * into v_o;
  return v_o;
end $$;

create or replace function public.new_code() returns text language plpgsql as $$
declare c text; begin
  loop c := 'TB-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from public.bookings where code = c); end loop;
  return c;
end $$;

-- Payment result -> effect. Idempotent: the webhook, the browser return and a manual retry can all call it; only the first one acts.
create or replace function public.finalize_order(p_order text, p_ok boolean, p_gateway jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.orders; s public.subscriptions; v_plan public.plans; v_months int; v_same boolean; v_base timestamptz; v_code text; v_left int; v_over boolean := false;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then return jsonb_build_object('status', 'missing'); end if;
  if o.status <> 'pending' then return jsonb_build_object('status', o.status, 'created', false); end if;
  if not p_ok then
    update public.orders set status = 'failed', gateway = p_gateway where id = o.id;
    return jsonb_build_object('status', 'failed', 'created', false);
  end if;

  if o.kind = 'subscription' then
    select * into v_plan from public.plans where id = o.ref;
    v_months := case when o.period = 'year' then 12 else 1 end;
    select * into s from public.subscriptions where user_id = o.user_id for update;
    v_same := found and s.plan = o.ref and s.status = 'active' and s.ends_at > now();
    v_base := case when v_same then s.ends_at else now() end;
    insert into public.subscriptions as t (user_id, plan, period, status, started_at, ends_at, credits_left)
    values (o.user_id, o.ref, o.period, 'active', now(), v_base + make_interval(months => v_months), (case when v_same then s.credits_left else 0 end) + v_plan.transfer_credits * v_months)
    on conflict (user_id) do update set plan = excluded.plan, period = excluded.period, status = 'active',
      started_at = case when v_same then t.started_at else now() end, ends_at = excluded.ends_at, credits_left = excluded.credits_left, updated_at = now();
  else
    v_left := public.seats_left(o.ref, o.service_date); v_over := v_left is not null and v_left < o.pax;
    v_code := public.new_code();
    insert into public.bookings (code, user_id, service_id, date, pax, total_usd, status, hotel, phone, notes, via, order_id)
    values (v_code, o.user_id, o.ref, o.service_date, o.pax, o.amount_usd, case when v_over then 'cancel_requested' else 'confirmed' end, o.meta ->> 'hotel', o.meta ->> 'phone', o.meta ->> 'notes', 'paid', o.id);
    if v_over then   -- two people paid for the last seat at the same time: flag for a human (refund or move the date)
      insert into public.requests (user_id, type, subject, message, contact) values (o.user_id, 'system', 'Overbooked paid order ' || o.id, 'Booking ' || v_code || ' exceeded capacity. Refund or move the date.', o.meta ->> 'phone');
    end if;
  end if;
  update public.orders set status = 'paid', paid_at = now(), booking_code = v_code, gateway = p_gateway where id = o.id;
  return jsonb_build_object('status', 'paid', 'created', true, 'booking_code', v_code);
end $$;

-- ---------- member actions (called from the browser with the user's JWT) ----------
create or replace function public.book_with_credit(p_service text, p_date date, p_hotel text, p_phone text, p_notes text)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_svc public.services; s public.subscriptions; v_code text;
begin
  if v_uid is null then raise exception 'err_auth_required'; end if;
  select * into v_svc from public.services where id = p_service and active;
  if not found or v_svc.category <> 'transfers' or v_svc.unit <> 'vehicle' then raise exception 'err_no_credit'; end if;
  if p_date is null or p_date < public.cairo_today() + 1 then raise exception 'err_date_past'; end if;
  select * into s from public.subscriptions where user_id = v_uid for update;
  if not found or s.status <> 'active' or s.ends_at <= now() or s.credits_left < 1 then raise exception 'err_no_credit'; end if;
  update public.subscriptions set credits_left = credits_left - 1, updated_at = now() where user_id = v_uid;
  v_code := public.new_code();
  insert into public.bookings (code, user_id, service_id, date, pax, total_usd, status, hotel, phone, notes, via)
  values (v_code, v_uid, p_service, p_date, 1, 0, 'confirmed', left(p_hotel, 80), left(p_phone, 30), left(p_notes, 400), 'credit');
  insert into public.orders (id, user_id, kind, ref, service_date, pax, amount_usd, status, booking_code, paid_at, gateway)
  values ('ORD-' || upper(substr(md5(gen_random_uuid()::text), 1, 10)), v_uid, 'booking', p_service, p_date, 1, 0, 'paid', v_code, now(), '{"via":"credit"}');
  return v_code;
end $$;

create or replace function public.request_cancel(p_code text) returns public.bookings language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where code = p_code and user_id = auth.uid() for update;
  if not found then raise exception 'err_not_found'; end if;
  if b.status <> 'confirmed' then raise exception 'err_bad_request'; end if;
  if (b.date::timestamp at time zone 'Africa/Cairo') - now() < interval '24 hours' then raise exception 'err_cancel_window'; end if;
  update public.bookings set status = 'cancel_requested' where code = p_code returning * into b;
  insert into public.requests (user_id, type, subject, message) values (auth.uid(), 'system', 'Cancellation requested ' || p_code, 'Refund via the payment gateway, then mark the booking as refunded in the admin page.');
  return b;
end $$;

-- admin: finish a cancellation (and give the credit back if it was booked with one)
create or replace function public.admin_resolve_cancel(p_code text, p_refunded boolean) returns void language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  if not public.is_admin() then raise exception 'err_auth_required'; end if;
  select * into b from public.bookings where code = p_code for update;
  if not found then raise exception 'err_not_found'; end if;
  update public.bookings set status = case when p_refunded then 'refunded' else 'cancelled' end where code = p_code;
  if b.via = 'credit' and b.status in ('confirmed', 'cancel_requested') then update public.subscriptions set credits_left = credits_left + 1 where user_id = b.user_id; end if;
end $$;

create or replace function public.create_request(p_type text, p_subject text, p_message text, p_contact text) returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_plan public.plans; v_id uuid;
begin
  if v_uid is null then raise exception 'err_auth_required'; end if;
  if p_type not in ('concierge', 'contact') or coalesce(trim(p_message), '') = '' then raise exception 'err_bad_request'; end if;
  if p_type = 'concierge' then
    v_plan := public.active_plan(v_uid);
    if v_plan.id is null or v_plan.concierge = 0 then raise exception 'err_plan_required'; end if;
    if v_plan.concierge > 0 and public.concierge_used() >= v_plan.concierge then raise exception 'err_quota'; end if;
  elsif (select count(*) from public.requests where user_id = v_uid and type = 'contact' and created_at > now() - interval '1 day') >= 10 then raise exception 'err_quota'; end if;
  insert into public.requests (user_id, type, subject, message, contact) values (v_uid, p_type, left(p_subject, 120), left(p_message, 2000), left(p_contact, 120)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.board_create(p_title text, p_activity text, p_from date, p_to date, p_languages text, p_note text) returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'err_auth_required'; end if;
  if not public.has_board_access() then raise exception 'err_plan_required'; end if;
  if coalesce(trim(p_title), '') = '' or p_from is null or p_from < public.cairo_today() then raise exception 'err_bad_request'; end if;
  if (select count(*) from public.board_posts where user_id = v_uid and status = 'open') >= 5 then raise exception 'err_quota'; end if;
  insert into public.board_posts (user_id, author_name, title, activity, date_from, date_to, languages, note)
  values (v_uid, (select left(name, 40) from public.profiles where id = v_uid), left(p_title, 90), left(p_activity, 40), p_from, coalesce(p_to, p_from), left(p_languages, 60), left(p_note, 600)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.board_respond(p_post uuid, p_message text, p_contact text) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); p public.board_posts;
begin
  if v_uid is null then raise exception 'err_auth_required'; end if;
  if not public.has_board_access() then raise exception 'err_plan_required'; end if;
  select * into p from public.board_posts where id = p_post and status = 'open';
  if not found or p.user_id = v_uid or coalesce(trim(p_message), '') = '' or coalesce(trim(p_contact), '') = '' then raise exception 'err_bad_request'; end if;
  insert into public.board_responses (post_id, user_id, author_name, message, contact)
  values (p_post, v_uid, (select left(name, 40) from public.profiles where id = v_uid), left(p_message, 500), left(p_contact, 120)) on conflict (post_id, user_id) do nothing;
end $$;

create or replace function public.board_report(p_post uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'err_auth_required'; end if;
  insert into public.reports (post_id, user_id, reason) values (p_post, auth.uid(), left(p_reason, 300));
end $$;

-- ---------- row level security ----------
alter table public.plans enable row level security;          alter table public.services enable row level security;
alter table public.profiles enable row level security;       alter table public.subscriptions enable row level security;
alter table public.orders enable row level security;         alter table public.bookings enable row level security;
alter table public.requests enable row level security;       alter table public.board_posts enable row level security;
alter table public.board_responses enable row level security; alter table public.reports enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

create policy catalogue_plans on public.plans for select using (true);
create policy catalogue_services on public.services for select using (true);
create policy profiles_own on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy subs_own on public.subscriptions for select using (user_id = auth.uid() or public.is_admin());
create policy orders_own on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy bookings_own on public.bookings for select using (user_id = auth.uid() or public.is_admin());
create policy bookings_admin_update on public.bookings for update using (public.is_admin());
create policy requests_own on public.requests for select using (user_id = auth.uid() or public.is_admin());
create policy requests_admin_update on public.requests for update using (public.is_admin());
create policy board_read on public.board_posts for select using ((status = 'open' and public.has_board_access()) or user_id = auth.uid() or public.is_admin());
create policy board_own_update on public.board_posts for update using (user_id = auth.uid() or public.is_admin());
create policy responses_read on public.board_responses for select using (user_id = auth.uid() or public.is_admin() or exists (select 1 from public.board_posts p where p.id = post_id and p.user_id = auth.uid()));
create policy reports_admin on public.reports for select using (public.is_admin());
create policy reports_admin_update on public.reports for update using (public.is_admin());

-- ---------- grants (least privilege) ----------
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
grant select on public.plans, public.services to anon, authenticated;
grant select on public.profiles, public.subscriptions, public.orders, public.bookings, public.requests, public.board_posts, public.board_responses, public.reports to authenticated;
grant update (name, phone, whatsapp, country) on public.profiles to authenticated;      -- is_admin can NOT be self-edited
grant update (status) on public.bookings, public.requests, public.board_posts, public.reports to authenticated;   -- RLS limits it to the owner (posts) or admins
grant execute on function public.seats_left(text, date) to anon, authenticated;
grant execute on function public.is_admin(), public.has_board_access(), public.concierge_used(), public.cairo_today() to authenticated;
grant execute on function public.book_with_credit(text, date, text, text, text), public.request_cancel(text), public.admin_resolve_cancel(text, boolean),
  public.create_request(text, text, text, text), public.board_create(text, text, date, date, text, text), public.board_respond(uuid, text, text), public.board_report(uuid, text) to authenticated;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;
grant execute on function public.create_order(uuid, text, text, text, date, int, jsonb), public.finalize_order(text, boolean, jsonb) to service_role;
