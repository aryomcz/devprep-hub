-- Backfill public.profiles for auth.users created before trigger on_auth_user_created existed.

insert into public.profiles (id, full_name, github_username)
select
  u.id,
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')), ''),
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'user_name', '')), '')
from auth.users u
on conflict (id) do nothing;
