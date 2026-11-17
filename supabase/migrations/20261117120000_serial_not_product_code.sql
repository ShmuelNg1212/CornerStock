-- A product code is the same on every box of a model. A ball with a product code as its serial number
-- blocks the next box of that model. The scan can read the product code barcode in place of the serial.
-- This check covers every write of a serial number: receive_ball, adjust_ball, and the stock import.
-- It checks only a new or changed serial number, so that an old wrong serial number can be corrected.
create function public.refuse_product_code_serial() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.serial is not distinct from old.serial then
    return new;
  end if;
  if exists (select 1 from public.ball_models where upper(product_code) = upper(new.serial)) then
    raise exception 'SERIAL_IS_PRODUCT_CODE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger balls_serial_not_product_code
  before insert or update of serial on public.balls
  for each row execute function public.refuse_product_code_serial();
