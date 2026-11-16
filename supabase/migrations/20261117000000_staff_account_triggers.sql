-- Fixes two account triggers. Run this file in the Supabase SQL Editor.

-- 1. Supabase Auth inserts a new user first. It writes the custom app metadata in a second
-- statement. Thus handle_new_user does not see the added_by_owner mark, and a staff account
-- that the owner adds gets no access. This trigger gives access when the mark arrives.
-- It acts only when the mark changes to true. A later metadata change does not reactivate
-- an account that the owner deactivated. A visitor cannot set app metadata.
create function public.handle_user_added_by_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce((new.raw_app_meta_data ->> 'added_by_owner')::boolean, false)
     and not coalesce((old.raw_app_meta_data ->> 'added_by_owner')::boolean, false) then
    update public.profiles set active = true where id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.handle_user_added_by_owner() from public, anon, authenticated;

create trigger on_auth_user_added_by_owner
  after update of raw_app_meta_data on auth.users
  for each row execute function public.handle_user_added_by_owner();

-- 2. keep_one_owner is a deferred trigger. It runs at commit as the role of the caller.
-- When Supabase Auth deletes a user, that role is supabase_auth_admin. It cannot read
-- public.profiles, so each delete of an account failed. The function now runs as its owner.
create or replace function public.keep_one_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where role = 'owner' and active) then
    raise exception 'LAST_OWNER' using errcode = 'P0001';
  end if;
  return null;
end;
$$;
