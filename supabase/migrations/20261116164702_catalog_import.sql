-- Owner-managed catalog and atomic file imports. Existing stock functions keep
-- ownership of stock changes. The batch record is the permanent import audit.
create table public.catalog_import_batches (
  request_id uuid primary key,
  actor uuid not null references public.profiles(id),
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.catalog_import_batches enable row level security;
revoke all on public.catalog_import_batches from public, anon, authenticated;
grant select on public.catalog_import_batches to authenticated;
create policy owner_read on public.catalog_import_batches for select to authenticated
  using (public.current_staff_role() = 'owner');
create trigger catalog_import_batches_permanent before update or delete
  on public.catalog_import_batches for each row execute function public.forbid_movement_change();
create index catalog_import_batches_actor_idx on public.catalog_import_batches(actor);

-- Internal validation has no client execution grant. Constraints alone would
-- round extra decimal places and do not check a UPC's check digit.
create function public.validate_catalog_import_model(p_model jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  m public.ball_models;
  k text;
  n numeric;
  digit_sum integer := 0;
  i integer;
begin
  if jsonb_typeof(p_model) is distinct from 'object' then raise exception 'INVALID_IMPORT'; end if;
  for k in select jsonb_object_keys(p_model) loop
    if not k = any(array['upc','brand','name','nominal_weight_lb','color','fragrance','coverstock','weight_block','finish','rg','diff','mass_bias','product_code','selling_price']) then
      raise exception 'INVALID_IMPORT';
    end if;
  end loop;
  m := jsonb_populate_record(null::public.ball_models, p_model);
  if m.upc is null or m.upc !~ '^[0-9]{12}$' then raise exception 'INVALID_UPC'; end if;
  for i in 1..11 loop digit_sum := digit_sum + substring(m.upc,i,1)::integer * case when i % 2 = 1 then 3 else 1 end; end loop;
  if (10 - digit_sum % 10) % 10 <> substring(m.upc,12,1)::integer then raise exception 'INVALID_UPC'; end if;
  if m.name is null or length(trim(m.name)) not between 1 and 120
    or m.name <> trim(m.name)
    or m.nominal_weight_lb is null or m.nominal_weight_lb not between 6 and 16
    or (p_model->>'nominal_weight_lb')::numeric <> m.nominal_weight_lb then raise exception 'INVALID_IMPORT'; end if;
  foreach k in array array['brand','color','fragrance','coverstock','weight_block','finish','product_code'] loop
    if p_model->>k is not null and (length(p_model->>k) > 120 or p_model->>k <> trim(p_model->>k)) then raise exception 'INVALID_IMPORT'; end if;
  end loop;
  foreach k in array array['rg','diff','mass_bias','selling_price'] loop
    if p_model->>k is not null then
      n := (p_model->>k)::numeric;
      if n::text in ('NaN','Infinity','-Infinity')
        or (k='rg' and (n not between 2 and 3 or n <> round(n,3)))
        or (k in ('diff','mass_bias') and (n not between 0 and 0.1 or n <> round(n,3)))
        or (k='selling_price' and (n < 0 or n >= 10000000 or n <> round(n,2))) then raise exception 'INVALID_IMPORT'; end if;
    end if;
  end loop;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'INVALID_IMPORT';
end;
$$;
revoke execute on function public.validate_catalog_import_model(jsonb) from public, anon, authenticated;

create function public.commit_catalog_import(p_request_id uuid, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.require_owner();
  v_saved public.catalog_import_batches;
  v_entry jsonb;
  v_after jsonb;
  v_label jsonb;
  v_before jsonb;
  v_model public.ball_models;
  v_ball public.balls;
  v_model_id uuid;
  v_location uuid;
  v_reason text := trim(coalesce(p_payload->>'reason',''));
  v_changes jsonb;
  v_key text;
  v_numeric numeric;
  v_request uuid;
  v_models_added integer := 0;
  v_models_updated integer := 0;
  v_balls_added integer := 0;
  v_balls_updated integer := 0;
  v_unchanged integer := 0;
  v_result jsonb;
begin
  if p_request_id is null or jsonb_typeof(p_payload) is distinct from 'object'
    or coalesce(p_payload->>'kind','') not in ('catalog','stock')
    or jsonb_typeof(p_payload->'models') is distinct from 'array'
    or jsonb_typeof(p_payload->'balls') is distinct from 'array' then raise exception 'INVALID_IMPORT'; end if;
  if jsonb_array_length(p_payload->'models') > 1000 or jsonb_array_length(p_payload->'balls') > 1000
    or length(v_reason) > 200 or octet_length(p_payload::text) > 10000000
    or (p_payload->>'kind' = 'catalog' and jsonb_array_length(p_payload->'balls') > 0) then raise exception 'INVALID_IMPORT'; end if;
  for v_key in select jsonb_object_keys(p_payload) loop
    if not v_key = any(array['kind','reason','models','balls']) then raise exception 'INVALID_IMPORT'; end if;
  end loop;

  -- Serialize retries before reading the durable result. Table locks also close
  -- the absent-row race with scan intake and protect the reviewed snapshots.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into v_saved from public.catalog_import_batches where request_id = p_request_id;
  if found then
    if v_saved.actor <> v_actor or v_saved.payload <> p_payload then raise exception 'REQUEST_MISMATCH'; end if;
    return v_saved.result;
  end if;
  lock table public.ball_models in share row exclusive mode;
  lock table public.balls in share row exclusive mode;
  lock table public.locations in share mode;

  if exists (select 1 from jsonb_array_elements(p_payload->'models') e group by e->>'upc' having count(*)>1) then raise exception 'DUPLICATE_UPC'; end if;
  if exists (select 1 from jsonb_array_elements(p_payload->'balls') e group by e->>'serial' having count(*)>1) then raise exception 'DUPLICATE_SERIAL'; end if;

  for v_entry in select value from jsonb_array_elements(p_payload->'models') loop
    if jsonb_typeof(v_entry) is distinct from 'object' then raise exception 'INVALID_IMPORT'; end if;
    for v_key in select jsonb_object_keys(v_entry) loop
      if not v_key = any(array['upc','before','after']) then raise exception 'INVALID_IMPORT'; end if;
    end loop;
    v_after := v_entry->'after';
    perform public.validate_catalog_import_model(v_after);
    if v_entry->>'upc' is distinct from v_after->>'upc' then raise exception 'IMMUTABLE_IDENTITY'; end if;
    select * into v_model from public.ball_models where upc = v_entry->>'upc' for update;
    v_before := case when found then to_jsonb(v_model) else 'null'::jsonb end;
    if not (v_entry ? 'before') or v_before is distinct from v_entry->'before' then raise exception 'STALE_REVIEW'; end if;
    if v_model.id is not null and v_model.nominal_weight_lb <> (v_after->>'nominal_weight_lb')::smallint then raise exception 'IMMUTABLE_IDENTITY'; end if;

    if v_model.id is null then
      insert into public.ball_models(upc,brand,name,nominal_weight_lb,color,fragrance,coverstock,weight_block,finish,rg,diff,mass_bias,product_code,selling_price)
      select m.upc,m.brand,m.name,m.nominal_weight_lb,m.color,m.fragrance,m.coverstock,m.weight_block,m.finish,m.rg,m.diff,m.mass_bias,m.product_code,m.selling_price
      from jsonb_populate_record(null::public.ball_models,v_after) m;
      v_models_added := v_models_added + 1;
    elsif v_before - 'id' - 'created_at' is distinct from to_jsonb(jsonb_populate_record(null::public.ball_models,v_after)) - 'id' - 'created_at' then
      update public.ball_models set
        brand=m.brand,name=m.name,color=m.color,fragrance=m.fragrance,coverstock=m.coverstock,
        weight_block=m.weight_block,finish=m.finish,rg=m.rg,diff=m.diff,mass_bias=m.mass_bias,
        product_code=m.product_code,selling_price=m.selling_price
      from jsonb_populate_record(null::public.ball_models,v_after) m where ball_models.id=v_model.id;
      v_models_updated := v_models_updated + 1;
    else v_unchanged := v_unchanged + 1;
    end if;
  end loop;

  for v_entry in select value from jsonb_array_elements(p_payload->'balls') loop
    if jsonb_typeof(v_entry) is distinct from 'object' then raise exception 'INVALID_IMPORT'; end if;
    for v_key in select jsonb_object_keys(v_entry) loop
      if not v_key = any(array['serial','before','label','location_id']) then raise exception 'INVALID_IMPORT'; end if;
    end loop;
    v_label := v_entry->'label';
    if jsonb_typeof(v_label) is distinct from 'object'
      or v_entry->>'serial' is null or v_entry->>'serial' !~ '^[A-Z0-9-]{6,30}$'
      or v_label->>'serial' is distinct from v_entry->>'serial' then raise exception 'INVALID_IMPORT'; end if;
    for v_key in select jsonb_object_keys(v_label) loop
      if not v_key = any(array['serial','upc','brand','model_name','nominal_weight_lb','color','fragrance','coverstock','weight_block','finish','rg','diff','mass_bias','product_code','gross_weight_oz','top_weight','pin_min','pin_max','boxed_on']) then raise exception 'INVALID_IMPORT'; end if;
    end loop;
    select id into v_model_id from public.ball_models where upc=v_label->>'upc';
    if v_model_id is null or not exists (select 1 from jsonb_array_elements(p_payload->'models') e where e->>'upc'=v_label->>'upc') then raise exception 'INVALID_IMPORT'; end if;
    if (v_label->>'nominal_weight_lb')::numeric is distinct from (select nominal_weight_lb::numeric from public.ball_models where id=v_model_id) then raise exception 'IMMUTABLE_IDENTITY'; end if;
    v_location := (v_entry->>'location_id')::uuid;
    if v_location is null or not exists(select 1 from public.locations where id=v_location and active) then raise exception 'LOCATION_NOT_FOUND'; end if;

    foreach v_key in array array['gross_weight_oz','top_weight','pin_min','pin_max'] loop
      if v_label->>v_key is not null then
        v_numeric := (v_label->>v_key)::numeric;
        if v_numeric::text in ('NaN','Infinity','-Infinity')
          or (v_key='gross_weight_oz' and (v_numeric not between 80 and 287 or v_numeric <> trunc(v_numeric)))
          or (v_key='top_weight' and (v_numeric not between 0 and 10 or v_numeric <> round(v_numeric,2)))
          or (v_key in ('pin_min','pin_max') and (v_numeric not between 0 and 8 or v_numeric <> round(v_numeric,2))) then raise exception 'INVALID_IMPORT'; end if;
      end if;
    end loop;
    if (v_label->>'pin_min' is null) <> (v_label->>'pin_max' is null)
      or (v_label->>'pin_min')::numeric > (v_label->>'pin_max')::numeric then raise exception 'INVALID_IMPORT'; end if;
    if v_label->>'boxed_on' is not null and (v_label->>'boxed_on' !~ '^\d{4}-\d{2}-\d{2}$' or (v_label->>'boxed_on')::date < date '1990-01-01') then raise exception 'INVALID_IMPORT'; end if;

    select * into v_ball from public.balls where serial=v_entry->>'serial' for update;
    v_before := case when found then to_jsonb(v_ball) else 'null'::jsonb end;
    if not (v_entry ? 'before') or v_before is distinct from v_entry->'before' then raise exception 'STALE_REVIEW'; end if;
    if v_ball.id is null then
      perform public.receive_ball(v_label,v_location,gen_random_uuid());
      v_balls_added := v_balls_added+1;
    else
      if v_ball.model_id <> v_model_id then raise exception 'IMMUTABLE_IDENTITY'; end if;
      v_changes := jsonb_build_object('gross_weight_oz',(v_label->>'gross_weight_oz')::smallint,
        'top_weight',(v_label->>'top_weight')::numeric,'pin_min',(v_label->>'pin_min')::numeric,
        'pin_max',(v_label->>'pin_max')::numeric,'boxed_on',v_label->>'boxed_on');
      if v_changes is distinct from jsonb_build_object('gross_weight_oz',v_ball.gross_weight_oz,
        'top_weight',v_ball.top_weight,'pin_min',v_ball.pin_min,'pin_max',v_ball.pin_max,'boxed_on',v_ball.boxed_on)
        or v_location <> v_ball.location_id then
        if v_reason='' then raise exception 'REASON_REQUIRED'; end if;
        if v_changes is distinct from jsonb_build_object('gross_weight_oz',v_ball.gross_weight_oz,
          'top_weight',v_ball.top_weight,'pin_min',v_ball.pin_min,'pin_max',v_ball.pin_max,'boxed_on',v_ball.boxed_on) then
          perform public.adjust_ball(v_ball.id,v_changes,gen_random_uuid(),v_reason);
        end if;
        if v_location <> v_ball.location_id then
          -- Transfer writes through the stock function. Its public interface has
          -- no reason parameter; set the reason at insert with a local trigger.
          v_request := gen_random_uuid();
          perform set_config('cornerstock.import_transfer_reason',v_reason,true);
          perform public.transfer_ball(v_ball.id,v_location,v_request);
          perform set_config('cornerstock.import_transfer_reason','',true);
        end if;
        v_balls_updated := v_balls_updated+1;
      else v_unchanged := v_unchanged+1;
      end if;
    end if;
  end loop;
  v_result := jsonb_build_object('models_added',v_models_added,'models_updated',v_models_updated,
    'balls_added',v_balls_added,'balls_updated',v_balls_updated,'unchanged',v_unchanged);
  insert into public.catalog_import_batches(request_id,actor,payload,result) values(p_request_id,v_actor,p_payload,v_result);
  return v_result;
end;
$$;
revoke execute on function public.commit_catalog_import(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.commit_catalog_import(uuid,jsonb) to authenticated;

-- A transfer made during an import carries the owner's correction reason.
-- History stays immutable after insertion.
create function public.catalog_import_transfer_reason() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.type='transfer' and nullif(current_setting('cornerstock.import_transfer_reason',true),'') is not null then
    new.reason := current_setting('cornerstock.import_transfer_reason',true);
  end if;
  return new;
end;
$$;
revoke execute on function public.catalog_import_transfer_reason() from public, anon, authenticated;
create trigger catalog_import_transfer_reason before insert on public.stock_movements
  for each row execute function public.catalog_import_transfer_reason();
