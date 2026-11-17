-- Low-stock alert. See doc/adr/0004-low-stock-minimum.md.
-- The owner sets a minimum for a model (one UPC: one model at one weight). The minimum applies to
-- each active location. A location with fewer balls in stock than the minimum is low.

alter table public.ball_models
  add column min_in_stock smallint check (min_in_stock between 0 and 99);

-- The row-level security policy `owner_update` lets only the owner change a model.
grant update (min_in_stock) on public.ball_models to authenticated;

-- One row for each model and active location that is below its minimum.
-- A location with no ball of the model gives 0, so an out-of-stock model shows too.
-- Security invoker: the policies of the tables apply, so only active staff see rows.
create view public.low_stock with (security_invoker = true) as
  select m.id as model_id, l.id as location_id, coalesce(c.in_stock, 0) as in_stock, m.min_in_stock
  from public.ball_models m
  cross join public.locations l
  left join public.stock_counts c on c.model_id = m.id and c.location_id = l.id
  where l.active and m.min_in_stock > 0 and coalesce(c.in_stock, 0) < m.min_in_stock;

revoke all on public.low_stock from public, anon;
grant select on public.low_stock to authenticated;
