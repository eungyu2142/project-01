create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.reviews where user_id = current_user_id::text;
  delete from public.medical_records where user_id = current_user_id::text;
  delete from public.pets where user_id = current_user_id::text;
  delete from public.user_profiles where id = current_user_id::text;
  delete from auth.users where id = current_user_id;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;

notify pgrst, 'reload schema';
