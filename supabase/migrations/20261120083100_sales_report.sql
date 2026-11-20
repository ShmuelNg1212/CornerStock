create table public.sale_prices (
  movement_id bigint primary key references public.stock_movements (id),
  catalog_price numeric(10, 2) check (catalog_price >= 0)
);

alter table public.sale_prices enable row level security;
revoke all on public.sale_prices from public, anon, authenticated;

create trigger sale_prices_permanent
  before update or delete on public.sale_prices
  for each row execute function public.forbid_movement_change();

create or replace function public.sell_ball(p_ball_id uuid, p_request_id uuid, p_reference text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.require_staff();
  v_location uuid;
  v_price numeric(10, 2);
  v_movement_id bigint;
begin
  if exists (select 1 from public.stock_movements where request_id = p_request_id) then
    return;
  end if;

  update public.balls b set status = 'sold'
  from public.ball_models model
  where b.id = p_ball_id and b.status = 'in_stock' and model.id = b.model_id
  returning b.location_id, model.selling_price into v_location, v_price;
  if not found then
    perform public.raise_ball_state(p_ball_id);
  end if;

  insert into public.stock_movements (ball_id, type, from_location_id, actor, reference, request_id)
  values (p_ball_id, 'sell', v_location, v_actor, nullif(trim(p_reference), ''), p_request_id)
  returning id into v_movement_id;

  insert into public.sale_prices (movement_id, catalog_price) values (v_movement_id, v_price);
end;
$$;

create index stock_movements_sale_sequence_idx on public.stock_movements (ball_id, id)
  where type in ('sell', 'reverse_sale');

create function public.sales_report(p_period text, p_date date, p_location_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_start date;
  v_end date;
begin
  perform public.require_owner();
  if p_period is null or p_period not in ('day', 'week', 'month')
    or p_date is null or not isfinite(p_date) then
    raise exception 'INVALID_REPORT_PERIOD' using errcode = '22023';
  end if;

  v_start := date_trunc(p_period, p_date::timestamp)::date;
  v_end := (v_start + case p_period
    when 'day' then interval '1 day'
    when 'week' then interval '1 week'
    else interval '1 month'
  end)::date;

  return (
    with model_sales as (
      select model.id as model_id, model.name as model_name, model.brand, model.nominal_weight_lb as weight_lb,
        count(*) as units, sum(price.catalog_price) as value, count(*) - count(price.catalog_price) as unpriced
      from public.stock_movements sale
      join public.balls ball on ball.id = sale.ball_id
      join public.ball_models model on model.id = ball.model_id
      left join public.sale_prices price on price.movement_id = sale.id
      -- The next sell or cancellation belongs to this ball, even after the report period.
      -- Only an immediate cancellation cancels this sale. A later resale has its own record.
      left join lateral (
        select next_movement.type from public.stock_movements next_movement
        where next_movement.ball_id = sale.ball_id and next_movement.id > sale.id
          and next_movement.type in ('sell', 'reverse_sale')
        order by next_movement.id limit 1
      ) following on true
      where sale.type = 'sell'
        and sale.at >= (v_start::timestamp at time zone 'Asia/Manila')
        and sale.at < (v_end::timestamp at time zone 'Asia/Manila')
        and (p_location_id is null or sale.from_location_id = p_location_id)
        and following.type is distinct from 'reverse_sale'::public.movement_type
      group by model.id
    )
    -- Return one value so the API row limit does not cut off the model groups.
    select jsonb_build_object(
      'start', v_start, 'end', v_end - 1,
      'totals', jsonb_build_object(
        'units', coalesce(sum(units), 0), 'value', sum(value)::text, 'unpriced', coalesce(sum(unpriced), 0)
      ),
      'rows', coalesce(jsonb_agg(
        to_jsonb(model_sales) || jsonb_build_object('value', value::text) order by model_name, weight_lb, model_id
      ), '[]'::jsonb),
      'locations', (
        select coalesce(jsonb_agg(jsonb_build_object('id', location.id, 'name', location.name, 'active', location.active)
          order by location.name), '[]'::jsonb)
        from public.locations location
        where location.active or exists (
          select 1 from public.stock_movements sale where sale.type = 'sell' and sale.from_location_id = location.id
        )
      )
    ) from model_sales
  );
end;
$$;

revoke execute on function public.sales_report(text, date, uuid) from public, anon, authenticated;
grant execute on function public.sales_report(text, date, uuid) to authenticated;
