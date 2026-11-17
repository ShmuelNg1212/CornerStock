-- Stock count. Rules: doc/adr/0005-stock-count-rules.md.
-- Staff count one whole location by scanning the serial of each ball. The finish compares the
-- scans with the in-stock balls of the location and keeps the result. A count changes no stock.
-- Each correction from the result goes through the existing stock functions.
-- Clients have no access to the count tables. They use the functions in this file.

create type public.count_status as enum ('open', 'finished', 'cancelled');
create type public.count_outcome as enum ('found', 'missing', 'unexpected');
-- Why a scan is unexpected. Set only for the outcome 'unexpected'.
create type public.count_kind as enum ('other_location', 'sold', 'removed', 'not_recorded');

create table public.counts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id),
  status public.count_status not null default 'open',
  started_by uuid not null references public.profiles (id),
  started_at timestamptz not null default now(),
  finished_by uuid references public.profiles (id),
  finished_at timestamptz,
  found int,
  missing int,
  unexpected int,
  check ((status = 'finished') = (finished_at is not null))
);

-- One open count for each location.
create unique index counts_one_open_idx on public.counts (location_id) where status = 'open';
create index counts_finished_idx on public.counts (finished_at desc) where status = 'finished';

create table public.count_scans (
  id bigint generated always as identity primary key,
  count_id uuid not null references public.counts (id),
  serial text not null check (serial ~ '^[A-Z0-9-]{6,30}$'),
  scanned_by uuid not null references public.profiles (id),
  scanned_at timestamptz not null default now(),
  unique (count_id, serial)
);

-- The result of a finished count, kept at the finish.
create table public.count_lines (
  count_id uuid not null references public.counts (id),
  serial text not null,
  ball_id uuid references public.balls (id),
  outcome public.count_outcome not null,
  kind public.count_kind,
  -- For 'other_location': the location of the ball at the finish.
  other_location_id uuid references public.locations (id),
  primary key (count_id, serial),
  check ((outcome = 'unexpected') = (kind is not null))
);

alter table public.counts enable row level security;
alter table public.count_scans enable row level security;
alter table public.count_lines enable row level security;
revoke all on public.counts, public.count_scans, public.count_lines from anon, authenticated;

-- ---------------------------------------------------------------------------
-- A move from a count carries a reason, so the activity log shows its cause. Only the count
-- functions set the reason: clients call transfer_ball, which gives no reason.
-- ---------------------------------------------------------------------------

drop function public.transfer_ball(uuid, uuid, uuid);

create function public.transfer_ball_with_reason(p_ball_id uuid, p_to_location_id uuid, p_request_id uuid, p_reason text)
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

  insert into public.stock_movements (ball_id, type, from_location_id, to_location_id, actor, reason, request_id)
  values (p_ball_id, 'transfer', v_from, p_to_location_id, v_actor, nullif(trim(left(p_reason, 200)), ''), p_request_id);
end;
$$;

create function public.transfer_ball(p_ball_id uuid, p_to_location_id uuid, p_request_id uuid)
returns void
language sql security definer set search_path = public as $$
  select public.transfer_ball_with_reason(p_ball_id, p_to_location_id, p_request_id, null);
$$;

-- ---------------------------------------------------------------------------
-- Helpers (not callable by clients)
-- ---------------------------------------------------------------------------

-- The totals of an open count: the scans, and the in-stock balls of the location now.
create function public.count_totals(p_count_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', c.id,
    'location_id', c.location_id,
    'location', l.name,
    'started_at', c.started_at,
    'scanned', (select count(*) from public.count_scans s where s.count_id = c.id),
    'expected', (select count(*) from public.balls b where b.location_id = c.location_id and b.status = 'in_stock')
  )
  from public.counts c join public.locations l on l.id = c.location_id
  where c.id = p_count_id;
$$;

-- "the stock count of 2026-11-17 at Sta. Lucia East Mall". The date is the store date.
create function public.count_label(p_count_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select format('the stock count of %s at %s', to_char(c.started_at at time zone 'Asia/Manila', 'YYYY-MM-DD'), l.name)
  from public.counts c join public.locations l on l.id = c.location_id
  where c.id = p_count_id;
$$;

-- ---------------------------------------------------------------------------
-- Count functions
-- ---------------------------------------------------------------------------

-- Starts a count of the location, or gives the open count of the location.
create function public.start_count(p_location_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := public.require_staff();
  v_id uuid;
begin
  if not exists (select 1 from public.locations where id = p_location_id and active) then
    raise exception 'LOCATION_NOT_FOUND' using errcode = 'P0001';
  end if;
  insert into public.counts (location_id, started_by) values (p_location_id, v_actor)
  on conflict (location_id) where status = 'open' do nothing;
  select id into v_id from public.counts where location_id = p_location_id and status = 'open';
  return public.count_totals(v_id);
end;
$$;

-- Adds one serial to an open count. Gives the status of the ball, and the totals.
-- Status: found, other_location, sold, removed, not_recorded.
create function public.add_count_scan(p_count_id uuid, p_serial text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := public.require_staff();
  v_serial text := upper(btrim(coalesce(p_serial, '')));
  v_count public.counts;
  v_inserted int;
  v_ball record;
  v_status text;
begin
  if v_serial !~ '^[A-Z0-9-]{6,30}$' then
    raise exception 'INVALID_SERIAL' using errcode = 'P0001';
  end if;
  -- A share lock: scans run side by side, and the finish waits for them.
  select * into v_count from public.counts where id = p_count_id for share;
  if not found then
    raise exception 'COUNT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_count.status <> 'open' then
    raise exception 'COUNT_CLOSED' using errcode = 'P0001';
  end if;

  insert into public.count_scans (count_id, serial, scanned_by) values (p_count_id, v_serial, v_actor)
  on conflict (count_id, serial) do nothing;
  get diagnostics v_inserted = row_count;

  select b.id, b.status, b.location_id, l.name as location, m.name as model_name, m.brand, m.nominal_weight_lb
  into v_ball
  from public.balls b
  join public.ball_models m on m.id = b.model_id
  join public.locations l on l.id = b.location_id
  where b.serial = v_serial;

  v_status := case
    when v_ball.id is null then 'not_recorded'
    when v_ball.status = 'sold' then 'sold'
    when v_ball.status = 'removed' then 'removed'
    when v_ball.location_id = v_count.location_id then 'found'
    else 'other_location'
  end;

  return public.count_totals(p_count_id) || jsonb_build_object(
    'serial', v_serial,
    'status', v_status,
    'duplicate', v_inserted = 0,
    'ball_id', v_ball.id,
    'model_name', v_ball.model_name,
    'brand', v_ball.brand,
    'weight_lb', v_ball.nominal_weight_lb,
    'location', case when v_status = 'other_location' then v_ball.location end
  );
end;
$$;

-- The result of a finished count. `action` is the correction that the current stock allows:
-- move, remove, put_back, add, or null. `corrected` is true when the stock now agrees with the count.
create function public.count_result(p_count_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_count record;
  v_lines jsonb;
begin
  perform public.require_staff();
  select c.*, l.name as location, nullif(ps.full_name, '') as started_by_name, nullif(pf.full_name, '') as finished_by_name
  into v_count
  from public.counts c
  join public.locations l on l.id = c.location_id
  left join public.profiles ps on ps.id = c.started_by
  left join public.profiles pf on pf.id = c.finished_by
  where c.id = p_count_id;
  if not found then
    raise exception 'COUNT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_count.status <> 'finished' then
    raise exception 'COUNT_NOT_FINISHED' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.outcome, x.model_name, x.serial), '[]')
  into v_lines
  from (
    select
      cl.serial, cl.outcome, cl.kind, b.id as ball_id,
      m.name as model_name, m.brand, m.nominal_weight_lb as weight_lb,
      ol.name as other_location,
      case
        when cl.outcome = 'missing' then not here
        when cl.outcome = 'unexpected' then here
        else false
      end as corrected,
      case
        when cl.outcome = 'missing' and here then 'remove'
        when cl.outcome = 'unexpected' and b.id is null then 'add'
        when cl.outcome = 'unexpected' and b.status = 'in_stock' and not here then 'move'
        when cl.outcome = 'unexpected' and b.status = 'sold' then 'put_back'
      end as action
    from public.count_lines cl
    -- A ball recorded after the finish matches a 'not recorded' line by its serial.
    left join public.balls b on b.id = coalesce(cl.ball_id, (select r.id from public.balls r where r.serial = cl.serial))
    left join public.ball_models m on m.id = b.model_id
    left join public.locations ol on ol.id = cl.other_location_id
    cross join lateral (select coalesce(b.status = 'in_stock' and b.location_id = v_count.location_id, false) as here) h
    where cl.count_id = p_count_id
  ) x;

  return jsonb_build_object(
    'id', v_count.id,
    'location_id', v_count.location_id,
    'location', v_count.location,
    'status', v_count.status,
    'started_at', v_count.started_at,
    'finished_at', v_count.finished_at,
    'started_by', v_count.started_by_name,
    'finished_by', v_count.finished_by_name,
    'found', v_count.found,
    'missing', v_count.missing,
    'unexpected', v_count.unexpected,
    'lines', v_lines
  );
end;
$$;

-- Closes an open count. Compares the scans with the in-stock balls of the location now, and keeps the result.
create function public.finish_count(p_count_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := public.require_staff();
  v_count public.counts;
begin
  select * into v_count from public.counts where id = p_count_id for update;
  if not found then
    raise exception 'COUNT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_count.status <> 'open' then
    raise exception 'COUNT_CLOSED' using errcode = 'P0001';
  end if;

  -- One statement, so all lines see the stock at the same moment.
  -- Found and missing: each in-stock ball of the location. Unexpected: each other scan.
  insert into public.count_lines (count_id, serial, ball_id, outcome, kind, other_location_id)
  with here as (
    select b.id, b.serial from public.balls b
    where b.location_id = v_count.location_id and b.status = 'in_stock'
  ),
  scans as (
    select s.serial from public.count_scans s where s.count_id = p_count_id
  )
  select p_count_id, h.serial, h.id,
    case when exists (select 1 from scans where scans.serial = h.serial)
      then 'found'::public.count_outcome else 'missing'::public.count_outcome end,
    null::public.count_kind, null::uuid
  from here h
  union all
  select p_count_id, s.serial, b.id, 'unexpected',
    case
      when b.id is null then 'not_recorded'::public.count_kind
      when b.status = 'sold' then 'sold'
      when b.status = 'removed' then 'removed'
      else 'other_location'
    end,
    case when b.status = 'in_stock' then b.location_id end
  from scans s
  left join public.balls b on b.serial = s.serial
  where not exists (select 1 from here where here.serial = s.serial);

  update public.counts set
    status = 'finished',
    finished_by = v_actor,
    finished_at = now(),
    found = (select count(*) from public.count_lines where count_id = p_count_id and outcome = 'found'),
    missing = (select count(*) from public.count_lines where count_id = p_count_id and outcome = 'missing'),
    unexpected = (select count(*) from public.count_lines where count_id = p_count_id and outcome = 'unexpected')
  where id = p_count_id;

  return public.count_result(p_count_id);
end;
$$;

create function public.cancel_count(p_count_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  update public.counts set status = 'cancelled' where id = p_count_id and status = 'open';
  if not found then
    if exists (select 1 from public.counts where id = p_count_id) then
      raise exception 'COUNT_CLOSED' using errcode = 'P0001';
    end if;
    raise exception 'COUNT_NOT_FOUND' using errcode = 'P0001';
  end if;
end;
$$;

-- One correction from a line of a finished count. The current stock decides the correction:
-- move here (any staff), remove a missing ball (owner), put a sold ball back (owner, with a reason).
-- The reason of each correction names the count.
create function public.correct_count_line(p_count_id uuid, p_serial text, p_request_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_count public.counts;
  v_line public.count_lines;
  v_ball public.balls;
  v_label text;
begin
  perform public.require_staff();
  -- A repeated submission changes nothing.
  if exists (select 1 from public.stock_movements where request_id = p_request_id) then
    return;
  end if;

  select * into v_count from public.counts where id = p_count_id;
  if not found then
    raise exception 'COUNT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_count.status <> 'finished' then
    raise exception 'COUNT_NOT_FINISHED' using errcode = 'P0001';
  end if;

  select * into v_line from public.count_lines where count_id = p_count_id and serial = upper(btrim(p_serial));
  -- A "not recorded" line finds a ball recorded after the finish by its serial, as count_result does.
  if found then
    select * into v_ball from public.balls where id = coalesce(v_line.ball_id, (select r.id from public.balls r where r.serial = v_line.serial));
  end if;
  v_label := public.count_label(p_count_id);

  if v_line.outcome = 'missing' and v_ball.status = 'in_stock' and v_ball.location_id = v_count.location_id then
    perform public.require_owner();
    perform public.remove_ball(v_ball.id, p_request_id, 'Not found in ' || v_label);
  elsif v_line.outcome = 'unexpected' and v_ball.status = 'in_stock' and v_ball.location_id <> v_count.location_id then
    perform public.transfer_ball_with_reason(v_ball.id, v_count.location_id, p_request_id, 'Found in ' || v_label);
  elsif v_line.outcome = 'unexpected' and v_ball.status = 'sold' then
    perform public.require_owner();
    if coalesce(btrim(p_reason), '') = '' then
      raise exception 'REASON_REQUIRED' using errcode = 'P0001';
    end if;
    perform public.reverse_sale(v_ball.id, p_request_id, 'Found in ' || v_label || ': ' || btrim(left(p_reason, 120)));
  else
    raise exception 'NO_CORRECTION' using errcode = 'P0001';
  end if;
end;
$$;

-- The finished counts, newest first.
create function public.count_history(p_limit int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return (
    select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.finished_at desc), '[]')
    from (
      select c.id, c.location_id, l.name as location, c.started_at, c.finished_at,
        nullif(ps.full_name, '') as started_by, nullif(pf.full_name, '') as finished_by,
        c.found, c.missing, c.unexpected
      from public.counts c
      join public.locations l on l.id = c.location_id
      left join public.profiles ps on ps.id = c.started_by
      left join public.profiles pf on pf.id = c.finished_by
      where c.status = 'finished'
      order by c.finished_at desc
      limit least(greatest(p_limit, 1), 100)
    ) x
  );
end;
$$;

revoke execute on function
  public.transfer_ball(uuid, uuid, uuid),
  public.transfer_ball_with_reason(uuid, uuid, uuid, text),
  public.count_totals(uuid),
  public.count_label(uuid),
  public.start_count(uuid),
  public.add_count_scan(uuid, text),
  public.count_result(uuid),
  public.finish_count(uuid),
  public.cancel_count(uuid),
  public.correct_count_line(uuid, text, uuid, text),
  public.count_history(int)
  from public, anon;
-- Supabase gives new functions to signed-in users by default. The helpers stay internal.
revoke execute on function public.count_totals(uuid), public.count_label(uuid), public.transfer_ball_with_reason(uuid, uuid, uuid, text)
  from authenticated;
grant execute on function
  public.transfer_ball(uuid, uuid, uuid),
  public.start_count(uuid),
  public.add_count_scan(uuid, text),
  public.count_result(uuid),
  public.finish_count(uuid),
  public.cancel_count(uuid),
  public.correct_count_line(uuid, text, uuid, text),
  public.count_history(int)
  to authenticated;
