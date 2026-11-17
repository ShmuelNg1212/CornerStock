-- Store activity log.
-- 1. A permanent record of each catalog model edit, written by a trigger. The trigger
--    catches the edit form and the catalog file import.
-- 2. One read function for the activity page: stock movements and catalog edits,
--    newest first, with keyset paging. It runs as the caller, so the read policies apply.

create index stock_movements_at_idx on public.stock_movements (at desc, id desc);

create table public.catalog_changes (
  id bigint generated always as identity primary key,
  model_id uuid not null references public.ball_models (id),
  -- Null when the edit did not come from a signed-in account (for example the SQL Editor).
  actor uuid references public.profiles (id),
  at timestamptz not null default now(),
  old_values jsonb not null,
  new_values jsonb not null
);

create index catalog_changes_at_idx on public.catalog_changes (at desc, id desc);
create index catalog_changes_model_idx on public.catalog_changes (model_id);

create trigger catalog_changes_permanent
  before update or delete on public.catalog_changes
  for each row execute function public.forbid_movement_change();

alter table public.catalog_changes enable row level security;
create policy staff_read on public.catalog_changes for select to authenticated
  using (public.current_staff_role() is not null);
revoke all on public.catalog_changes from anon, authenticated;
grant select on public.catalog_changes to authenticated;

-- Writes one change row with only the values that changed. An edit with no change writes nothing.
create function public.record_catalog_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
  v_before jsonb := '{}';
  v_after jsonb := '{}';
  v_key text;
begin
  for v_key in select jsonb_object_keys(v_new) loop
    if v_key not in ('id', 'created_at') and v_old -> v_key is distinct from v_new -> v_key then
      v_before := v_before || jsonb_build_object(v_key, v_old -> v_key);
      v_after := v_after || jsonb_build_object(v_key, v_new -> v_key);
    end if;
  end loop;
  if v_after <> '{}' then
    insert into public.catalog_changes (model_id, actor, old_values, new_values)
    values (new.id, auth.uid(), v_before, v_after);
  end if;
  return null;
end;
$$;

revoke execute on function public.record_catalog_change() from public, anon, authenticated;

create trigger ball_models_record_change
  after update on public.ball_models
  for each row execute function public.record_catalog_change();

-- The activity of the store, newest first. Pass the last row of a page as the
-- p_before_* values to get the next page. p_types limits the types; null gives all.
-- Types: receive, sell, reverse_sale, transfer, adjust, remove, model_edit.
create function public.activity_feed(
  p_before_at timestamptz default null,
  p_before_src smallint default null,
  p_before_id bigint default null,
  p_types text[] default null,
  p_limit int default 50
) returns table (
  src smallint,
  id bigint,
  at timestamptz,
  type text,
  actor_name text,
  ball_id uuid,
  serial text,
  model_id uuid,
  model_name text,
  brand text,
  weight_lb smallint,
  from_location text,
  to_location text,
  reason text,
  reference text,
  old_values jsonb,
  new_values jsonb
)
language sql stable security invoker set search_path = '' as $$
  with stock as (
    select 0::smallint as src, m.id, m.at, m.type::text as type, nullif(p.full_name, '') as actor_name,
      b.id as ball_id, b.serial, bm.id as model_id, bm.name as model_name, bm.brand, bm.nominal_weight_lb as weight_lb,
      fl.name as from_location, tl.name as to_location, m.reason,
      case when m.type <> 'adjust' then m.reference end as reference,
      case when m.type = 'adjust' then m.reference::jsonb end as old_values,
      -- The new values of a correction are the old values of the next correction,
      -- or the current values of the ball when no later correction exists.
      case when m.type = 'adjust' then coalesce(
        (select n.reference::jsonb from public.stock_movements n
          where n.ball_id = m.ball_id and n.type = 'adjust' and n.id > m.id order by n.id limit 1),
        jsonb_build_object(
          'serial', b.serial, 'gross_weight_oz', b.gross_weight_oz, 'top_weight', b.top_weight,
          'pin_min', b.pin_min, 'pin_max', b.pin_max, 'boxed_on', b.boxed_on
        )
      ) end as new_values
    from public.stock_movements m
    join public.balls b on b.id = m.ball_id
    join public.ball_models bm on bm.id = b.model_id
    left join public.locations fl on fl.id = m.from_location_id
    left join public.locations tl on tl.id = m.to_location_id
    left join public.profiles p on p.id = m.actor
    where (p_types is null or m.type::text = any (p_types))
      -- The row (at, 0, id) is before the cursor. "at <=" lets the time index find the start.
      and (p_before_at is null or (m.at <= p_before_at
        and (m.at < p_before_at or 0 < p_before_src or (0 = p_before_src and m.id < p_before_id))))
    order by m.at desc, m.id desc
    limit least(greatest(p_limit, 1), 100)
  ),
  catalog as (
    select 1::smallint as src, c.id, c.at, 'model_edit' as type, nullif(p.full_name, '') as actor_name,
      null::uuid as ball_id, null::text as serial, bm.id as model_id, bm.name as model_name, bm.brand,
      bm.nominal_weight_lb as weight_lb, null::text as from_location, null::text as to_location,
      null::text as reason, null::text as reference, c.old_values, c.new_values
    from public.catalog_changes c
    join public.ball_models bm on bm.id = c.model_id
    left join public.profiles p on p.id = c.actor
    where (p_types is null or 'model_edit' = any (p_types))
      and (p_before_at is null or (c.at <= p_before_at
        and (c.at < p_before_at or 1 < p_before_src or (1 = p_before_src and c.id < p_before_id))))
    order by c.at desc, c.id desc
    limit least(greatest(p_limit, 1), 100)
  )
  select * from (select * from stock union all select * from catalog) feed
  order by feed.at desc, feed.src desc, feed.id desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke execute on function public.activity_feed(timestamptz, smallint, bigint, text[], int) from public, anon;
grant execute on function public.activity_feed(timestamptz, smallint, bigint, text[], int) to authenticated;
