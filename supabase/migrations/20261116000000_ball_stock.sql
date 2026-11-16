-- Ball stock, first version.
-- Rule: clients read tables through row-level security. Clients change stock only
-- through the functions in this file. Each function writes one stock movement.

create type public.staff_role as enum ('owner', 'staff');
create type public.ball_status as enum ('in_stock', 'sold', 'removed');
create type public.movement_type as enum ('receive', 'sell', 'reverse_sale', 'transfer', 'adjust', 'remove');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.staff_role not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.locations (name) values ('Sta. Lucia East Mall');

-- One row for each UPC: a model at one nominal weight.
create table public.ball_models (
  id uuid primary key default gen_random_uuid(),
  upc text not null unique check (upc ~ '^[0-9]{12}$'),
  brand text,
  name text not null check (length(trim(name)) between 1 and 120),
  nominal_weight_lb smallint not null check (nominal_weight_lb between 6 and 16),
  color text,
  fragrance text,
  coverstock text,
  weight_block text,
  finish text,
  rg numeric(4, 3) check (rg between 2 and 3),
  diff numeric(4, 3) check (diff between 0 and 0.1),
  mass_bias numeric(4, 3) check (mass_bias between 0 and 0.1),
  product_code text,
  selling_price numeric(10, 2) check (selling_price >= 0),
  created_at timestamptz not null default now()
);

-- One row for each physical ball.
create table public.balls (
  id uuid primary key default gen_random_uuid(),
  serial text not null unique check (serial ~ '^[A-Z0-9-]{6,30}$'),
  model_id uuid not null references public.ball_models (id),
  location_id uuid not null references public.locations (id),
  status public.ball_status not null default 'in_stock',
  gross_weight_oz smallint check (gross_weight_oz between 80 and 287),
  top_weight numeric(4, 2) check (top_weight between 0 and 10),
  pin_min numeric(3, 2) check (pin_min between 0 and 8),
  pin_max numeric(3, 2) check (pin_max between 0 and 8),
  boxed_on date,
  label_photo_path text,
  received_at timestamptz not null default now(),
  received_by uuid not null references public.profiles (id),
  check (pin_min is null or pin_max is null or pin_min <= pin_max)
);

create index balls_in_stock_idx on public.balls (location_id, model_id) where status = 'in_stock';

create table public.stock_movements (
  id bigint generated always as identity primary key,
  ball_id uuid not null references public.balls (id),
  type public.movement_type not null,
  from_location_id uuid references public.locations (id),
  to_location_id uuid references public.locations (id),
  actor uuid not null references public.profiles (id),
  at timestamptz not null default now(),
  reason text,
  reference text,
  -- The client makes one request id for each user action. A repeated submission
  -- has the same id, and thus cannot change stock a second time.
  request_id uuid not null unique
);

create index stock_movements_ball_idx on public.stock_movements (ball_id, at);

-- Stock movements are a permanent record.
create function public.forbid_movement_change() returns trigger
language plpgsql as $$
begin
  raise exception 'MOVEMENTS_ARE_PERMANENT' using errcode = 'P0001';
end;
$$;

create trigger stock_movements_permanent
  before update or delete on public.stock_movements
  for each row execute function public.forbid_movement_change();

-- In-stock count for each model in each location.
create view public.stock_counts with (security_invoker = true) as
  select model_id, location_id, count(*)::int as in_stock
  from public.balls
  where status = 'in_stock'
  group by model_id, location_id;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

-- Each new account gets a profile. The first account is the owner.
-- Later accounts are active only when the owner made them in the app: the app sets
-- app metadata, which a visitor who signs up by himself cannot set. Thus a self sign-up
-- gets no access, also if sign-ups are left open in the Supabase project by mistake.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_first boolean;
begin
  lock table public.profiles in share row exclusive mode;
  v_first := not exists (select 1 from public.profiles);
  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when v_first then 'owner'::public.staff_role else 'staff'::public.staff_role end,
    v_first or coalesce((new.raw_app_meta_data ->> 'added_by_owner')::boolean, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The role of the caller, or null when the caller is not an active staff member.
create function public.current_staff_role() returns public.staff_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active;
$$;

create function public.require_staff() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if public.current_staff_role() is null then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create function public.require_owner() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if public.current_staff_role() is distinct from 'owner' then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

-- There is always one active owner or more.
create function public.keep_one_owner() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from public.profiles where role = 'owner' and active) then
    raise exception 'LAST_OWNER' using errcode = 'P0001';
  end if;
  return null;
end;
$$;

create constraint trigger profiles_keep_one_owner
  after update or delete on public.profiles
  deferrable initially deferred
  for each row execute function public.keep_one_owner();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.ball_models enable row level security;
alter table public.balls enable row level security;
alter table public.stock_movements enable row level security;

create policy staff_read on public.profiles for select to authenticated
  using (public.current_staff_role() is not null);
create policy owner_update on public.profiles for update to authenticated
  using (public.current_staff_role() = 'owner') with check (public.current_staff_role() = 'owner');

create policy staff_read on public.locations for select to authenticated
  using (public.current_staff_role() is not null);
create policy owner_insert on public.locations for insert to authenticated
  with check (public.current_staff_role() = 'owner');
create policy owner_update on public.locations for update to authenticated
  using (public.current_staff_role() = 'owner') with check (public.current_staff_role() = 'owner');

create policy staff_read on public.ball_models for select to authenticated
  using (public.current_staff_role() is not null);
create policy owner_update on public.ball_models for update to authenticated
  using (public.current_staff_role() = 'owner') with check (public.current_staff_role() = 'owner');

create policy staff_read on public.balls for select to authenticated
  using (public.current_staff_role() is not null);

create policy staff_read on public.stock_movements for select to authenticated
  using (public.current_staff_role() is not null);

-- Table privileges. Row-level security limits the rows; these limit the commands.
revoke all on public.profiles, public.locations, public.ball_models, public.balls, public.stock_movements, public.stock_counts
  from anon, authenticated;
grant select on public.profiles, public.locations, public.ball_models, public.balls, public.stock_movements, public.stock_counts
  to authenticated;
grant update (full_name, role, active) on public.profiles to authenticated;
grant insert (name), update (name, active) on public.locations to authenticated;
grant update (brand, name, color, fragrance, coverstock, weight_block, finish, rg, diff, mass_bias, product_code, selling_price)
  on public.ball_models to authenticated;

-- ---------------------------------------------------------------------------
-- Stock functions
-- ---------------------------------------------------------------------------

-- Adds one ball to stock. Creates the model when the UPC is new.
-- A known UPC keeps its catalog values; the label values for the model are ignored.
create function public.receive_ball(
  p_label jsonb,
  p_location_id uuid,
  p_request_id uuid,
  p_label_photo_path text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := public.require_staff();
  v_ball_id uuid;
  v_model_id uuid;
begin
  select ball_id into v_ball_id from public.stock_movements where request_id = p_request_id;
  if found then
    return v_ball_id;
  end if;

  if not exists (select 1 from public.locations where id = p_location_id and active) then
    raise exception 'LOCATION_NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into public.ball_models (
    upc, brand, name, nominal_weight_lb, color, fragrance, coverstock, weight_block, finish,
    rg, diff, mass_bias, product_code
  ) values (
    p_label ->> 'upc',
    nullif(trim(p_label ->> 'brand'), ''),
    trim(p_label ->> 'model_name'),
    (p_label ->> 'nominal_weight_lb')::smallint,
    nullif(trim(p_label ->> 'color'), ''),
    nullif(trim(p_label ->> 'fragrance'), ''),
    nullif(trim(p_label ->> 'coverstock'), ''),
    nullif(trim(p_label ->> 'weight_block'), ''),
    nullif(trim(p_label ->> 'finish'), ''),
    (p_label ->> 'rg')::numeric,
    (p_label ->> 'diff')::numeric,
    (p_label ->> 'mass_bias')::numeric,
    nullif(trim(p_label ->> 'product_code'), '')
  )
  on conflict (upc) do nothing;

  select id into v_model_id from public.ball_models where upc = p_label ->> 'upc';
  if v_model_id is null then
    raise exception 'INVALID_LABEL' using errcode = 'P0001';
  end if;

  begin
    insert into public.balls (
      serial, model_id, location_id, gross_weight_oz, top_weight, pin_min, pin_max, boxed_on,
      label_photo_path, received_by
    ) values (
      p_label ->> 'serial',
      v_model_id,
      p_location_id,
      (p_label ->> 'gross_weight_oz')::smallint,
      (p_label ->> 'top_weight')::numeric,
      (p_label ->> 'pin_min')::numeric,
      (p_label ->> 'pin_max')::numeric,
      (p_label ->> 'boxed_on')::date,
      p_label_photo_path,
      v_actor
    )
    returning id into v_ball_id;
  exception when unique_violation then
    -- Either the same request ran at the same time, or the ball is already recorded.
    select ball_id into v_ball_id from public.stock_movements where request_id = p_request_id;
    if found then
      return v_ball_id;
    end if;
    select id into v_ball_id from public.balls where serial = p_label ->> 'serial';
    raise exception 'DUPLICATE_SERIAL' using errcode = 'P0001', detail = v_ball_id::text;
  end;

  insert into public.stock_movements (ball_id, type, to_location_id, actor, request_id)
  values (v_ball_id, 'receive', p_location_id, v_actor, p_request_id);

  return v_ball_id;
end;
$$;

-- Raises the correct error when a status change found no ball in the necessary status.
create function public.raise_ball_state(p_ball_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.balls where id = p_ball_id) then
    raise exception 'WRONG_STATUS' using errcode = 'P0001';
  end if;
  raise exception 'BALL_NOT_FOUND' using errcode = 'P0001';
end;
$$;

create function public.sell_ball(p_ball_id uuid, p_request_id uuid, p_reference text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := public.require_staff();
  v_location uuid;
begin
  if exists (select 1 from public.stock_movements where request_id = p_request_id) then
    return;
  end if;

  -- The status test in the update makes this safe when two staff sell the same ball.
  update public.balls set status = 'sold'
  where id = p_ball_id and status = 'in_stock'
  returning location_id into v_location;
  if not found then
    perform public.raise_ball_state(p_ball_id);
  end if;

  insert into public.stock_movements (ball_id, type, from_location_id, actor, reference, request_id)
  values (p_ball_id, 'sell', v_location, v_actor, nullif(trim(p_reference), ''), p_request_id);
end;
$$;

create function public.transfer_ball(p_ball_id uuid, p_to_location_id uuid, p_request_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := public.require_staff();
  v_from uuid;
begin
  if exists (select 1 from public.stock_movements where request_id = p_request_id) then
    return;
  end if;

  if not exists (select 1 from public.locations where id = p_to_location_id and active) then
    raise exception 'LOCATION_NOT_FOUND' using errcode = 'P0001';
  end if;

  select location_id into v_from from public.balls
  where id = p_ball_id and status = 'in_stock' for update;
  if not found then
    perform public.raise_ball_state(p_ball_id);
  end if;
  if v_from = p_to_location_id then
    raise exception 'SAME_LOCATION' using errcode = 'P0001';
  end if;

  update public.balls set location_id = p_to_location_id where id = p_ball_id;

  insert into public.stock_movements (ball_id, type, from_location_id, to_location_id, actor, request_id)
  values (p_ball_id, 'transfer', v_from, p_to_location_id, v_actor, p_request_id);
end;
$$;

-- Owner only: puts a sold ball back in stock.
create function public.reverse_sale(p_ball_id uuid, p_request_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := public.require_owner();
  v_location uuid;
begin
  if exists (select 1 from public.stock_movements where request_id = p_request_id) then
    return;
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  update public.balls set status = 'in_stock'
  where id = p_ball_id and status = 'sold'
  returning location_id into v_location;
  if not found then
    perform public.raise_ball_state(p_ball_id);
  end if;

  insert into public.stock_movements (ball_id, type, to_location_id, actor, reason, request_id)
  values (p_ball_id, 'reverse_sale', v_location, v_actor, trim(p_reason), p_request_id);
end;
$$;

-- Owner only: takes a ball out of stock for a reason other than a sale.
create function public.remove_ball(p_ball_id uuid, p_request_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := public.require_owner();
  v_location uuid;
begin
  if exists (select 1 from public.stock_movements where request_id = p_request_id) then
    return;
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  update public.balls set status = 'removed'
  where id = p_ball_id and status = 'in_stock'
  returning location_id into v_location;
  if not found then
    perform public.raise_ball_state(p_ball_id);
  end if;

  insert into public.stock_movements (ball_id, type, from_location_id, actor, reason, request_id)
  values (p_ball_id, 'remove', v_location, v_actor, trim(p_reason), p_request_id);
end;
$$;

-- Owner only: corrects the values of one ball. The movement keeps the old values.
create function public.adjust_ball(p_ball_id uuid, p_changes jsonb, p_request_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := public.require_owner();
  v_old public.balls;
begin
  if exists (select 1 from public.stock_movements where request_id = p_request_id) then
    return;
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_old from public.balls where id = p_ball_id for update;
  if not found then
    raise exception 'BALL_NOT_FOUND' using errcode = 'P0001';
  end if;

  begin
    update public.balls set
      serial = coalesce(p_changes ->> 'serial', serial),
      gross_weight_oz = case when p_changes ? 'gross_weight_oz' then (p_changes ->> 'gross_weight_oz')::smallint else gross_weight_oz end,
      top_weight = case when p_changes ? 'top_weight' then (p_changes ->> 'top_weight')::numeric else top_weight end,
      pin_min = case when p_changes ? 'pin_min' then (p_changes ->> 'pin_min')::numeric else pin_min end,
      pin_max = case when p_changes ? 'pin_max' then (p_changes ->> 'pin_max')::numeric else pin_max end,
      boxed_on = case when p_changes ? 'boxed_on' then (p_changes ->> 'boxed_on')::date else boxed_on end
    where id = p_ball_id;
  exception when unique_violation then
    raise exception 'DUPLICATE_SERIAL' using errcode = 'P0001';
  end;

  insert into public.stock_movements (ball_id, type, actor, reason, reference, request_id)
  values (
    p_ball_id, 'adjust', v_actor, trim(p_reason),
    jsonb_build_object(
      'serial', v_old.serial, 'gross_weight_oz', v_old.gross_weight_oz, 'top_weight', v_old.top_weight,
      'pin_min', v_old.pin_min, 'pin_max', v_old.pin_max, 'boxed_on', v_old.boxed_on
    )::text,
    p_request_id
  );
end;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.current_staff_role(),
  public.receive_ball(jsonb, uuid, uuid, text),
  public.sell_ball(uuid, uuid, text),
  public.transfer_ball(uuid, uuid, uuid),
  public.reverse_sale(uuid, uuid, text),
  public.remove_ball(uuid, uuid, text),
  public.adjust_ball(uuid, jsonb, uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Supabase services (skipped where the service does not exist, as in the tests)
-- ---------------------------------------------------------------------------

do $$
begin
  -- Live view: send changes to the stock tables to signed-in clients.
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.balls, public.ball_models, public.locations;
  end if;

  -- Label photos: a private bucket that only staff can use.
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('labels', 'labels', false)
    on conflict (id) do nothing;

    execute $policy$
      create policy labels_staff_read on storage.objects for select to authenticated
        using (bucket_id = 'labels' and public.current_staff_role() is not null)
    $policy$;
    execute $policy$
      create policy labels_staff_insert on storage.objects for insert to authenticated
        with check (bucket_id = 'labels' and public.current_staff_role() is not null)
    $policy$;
  end if;
end;
$$;
