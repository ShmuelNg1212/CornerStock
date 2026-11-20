-- Both owner reports count the same uncancelled sales in a Manila date range.
create function public.uncancelled_ball_sales(p_start date, p_end date, p_location_id uuid)
returns table (movement_id bigint, model_id uuid, location_id uuid)
language sql stable set search_path = '' as $$
  select sale.id, ball.model_id, sale.from_location_id
  from public.stock_movements sale
  join public.balls ball on ball.id = sale.ball_id
  -- Look beyond the chosen dates. The next sale or cancellation determines
  -- whether this sale counts. A later resale has its own movement.
  left join lateral (
    select next_movement.type from public.stock_movements next_movement
    where next_movement.ball_id = sale.ball_id and next_movement.id > sale.id
      and next_movement.type in ('sell', 'reverse_sale')
    order by next_movement.id limit 1
  ) following on true
  where sale.type = 'sell'
    and sale.at >= (p_start::timestamp at time zone 'Asia/Manila')
    and sale.at < (p_end::timestamp at time zone 'Asia/Manila')
    and (p_location_id is null or sale.from_location_id = p_location_id)
    and following.type is distinct from 'reverse_sale'::public.movement_type;
$$;

revoke execute on function public.uncancelled_ball_sales(date, date, uuid) from public, anon, authenticated;

create or replace function public.sales_report(p_period text, p_date date, p_location_id uuid default null)
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
      from public.uncancelled_ball_sales(v_start, v_end, p_location_id) sale
      join public.ball_models model on model.id = sale.model_id
      left join public.sale_prices price on price.movement_id = sale.movement_id
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

create function public.reorder_worksheet()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_start date := v_today - 29;
begin
  perform public.require_owner();

  return (
    with recent_sales as (
      select sale.model_id, sale.location_id, count(*) as units
      from public.uncancelled_ball_sales(v_start, v_today + 1, null) sale
      group by sale.model_id, sale.location_id
    ), worksheet_rows as (
      select low.model_id, low.location_id, model.name as model_name,
        model.brand, model.nominal_weight_lb as weight_lb, model.upc,
        location.name as location_name, low.in_stock, low.min_in_stock,
        coalesce(sales.units, 0) as units
      from public.low_stock low
      join public.ball_models model on model.id = low.model_id
      join public.locations location on location.id = low.location_id
      left join recent_sales sales on sales.model_id = low.model_id and sales.location_id = low.location_id
    )
    -- One JSON value avoids the Data API row limit.
    select jsonb_build_object(
      'start', v_start, 'end', v_today,
      'rows', coalesce((
        select jsonb_agg(to_jsonb(row) order by row.model_name, row.weight_lb, row.upc, row.location_name, row.location_id)
        from worksheet_rows row
      ), '[]'::jsonb),
      'locations', coalesce((
        select jsonb_agg(jsonb_build_object('id', location.id, 'name', location.name) order by location.name, location.id)
        from public.locations location where location.active
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke execute on function public.reorder_worksheet() from public, anon, authenticated;
grant execute on function public.reorder_worksheet() to authenticated;
