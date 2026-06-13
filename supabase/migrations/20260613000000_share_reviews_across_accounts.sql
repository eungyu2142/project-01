alter table public.reviews enable row level security;

drop policy if exists "Users can manage own reviews" on public.reviews;
drop policy if exists "Authenticated users can read all reviews" on public.reviews;
drop policy if exists "Users can insert own reviews" on public.reviews;
drop policy if exists "Users can update own reviews" on public.reviews;
drop policy if exists "Users can delete own reviews" on public.reviews;

create policy "Authenticated users can read all reviews"
on public.reviews
for select
to authenticated
using (true);

create policy "Users can insert own reviews"
on public.reviews
for insert
to authenticated
with check ((select auth.uid()::text) = user_id);

create policy "Users can update own reviews"
on public.reviews
for update
to authenticated
using ((select auth.uid()::text) = user_id)
with check ((select auth.uid()::text) = user_id);

create policy "Users can delete own reviews"
on public.reviews
for delete
to authenticated
using ((select auth.uid()::text) = user_id);
