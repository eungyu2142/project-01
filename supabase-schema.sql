create table if not exists user_profiles (
  id text primary key,
  login_id text,
  nickname text not null,
  email text not null,
  profile_emoji text not null,
  onboarding_completed_at timestamptz,
  city text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

alter table user_profiles add column if not exists login_id text;
alter table user_profiles add column if not exists onboarding_completed_at timestamptz;
update user_profiles
set login_id = split_part(email, '@', 1)
where login_id is null or btrim(login_id) = '';

create unique index if not exists user_profiles_login_id_key on user_profiles (login_id);

create or replace function public.is_login_id_available(candidate_login_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.user_profiles
    where login_id = candidate_login_id
  );
$$;

grant execute on function public.is_login_id_available(text) to anon, authenticated;

create or replace function public.get_email_by_login_id(candidate_login_id text)
returns text
language sql
security definer
set search_path = public
as $$
  select email
  from public.user_profiles
  where login_id = candidate_login_id
  limit 1;
$$;

grant execute on function public.get_email_by_login_id(text) to anon, authenticated;

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

create table if not exists pets (
  id text primary key,
  user_id text not null,
  name text not null,
  species text not null,
  animal_type text not null,
  gender text not null,
  age_label text not null,
  avatar text not null,
  created_at timestamptz not null default now()
);

create table if not exists medical_records (
  id text primary key,
  user_id text not null,
  pet_id text not null,
  hospital_id text not null,
  date date not null,
  diagnosis text not null,
  veterinarian_note text not null default '',
  prescription text not null default '',
  cost integer,
  memo text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  id text primary key,
  user_id text not null,
  hospital_id text not null,
  pet_id text,
  animal_type text not null,
  species text not null,
  pet_name text not null,
  diagnosis text not null default '',
  cost integer,
  date date not null,
  medicine text not null default '',
  tags jsonb not null default '[]'::jsonb,
  custom_tags jsonb not null default '[]'::jsonb,
  body text not null default '',
  image_urls jsonb not null default '[]'::jsonb,
  rating integer not null default 0,
  likes integer not null default 0,
  liked boolean not null default false,
  liked_at timestamptz,
  author_name text not null,
  is_mine boolean not null default true,
  created_at timestamptz not null default now()
);

alter table user_profiles enable row level security;
alter table pets enable row level security;
alter table medical_records enable row level security;
alter table reviews enable row level security;

drop policy if exists "Users can manage own profile" on user_profiles;
drop policy if exists "Users can manage own pets" on pets;
drop policy if exists "Users can manage own medical records" on medical_records;
drop policy if exists "Users can manage own reviews" on reviews;
drop policy if exists "Authenticated users can read all reviews" on reviews;
drop policy if exists "Users can insert own reviews" on reviews;
drop policy if exists "Users can update own reviews" on reviews;
drop policy if exists "Users can delete own reviews" on reviews;

create policy "Users can manage own profile"
on user_profiles
for all
using (auth.uid()::text = id)
with check (auth.uid()::text = id);

create policy "Users can manage own pets"
on pets
for all
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);

create policy "Users can manage own medical records"
on medical_records
for all
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);

create policy "Authenticated users can read all reviews"
on reviews
for select
using (auth.role() = 'authenticated');

create policy "Users can insert own reviews"
on reviews
for insert
with check (auth.uid()::text = user_id);

create policy "Users can update own reviews"
on reviews
for update
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);

create policy "Users can delete own reviews"
on reviews
for delete
using (auth.uid()::text = user_id);
