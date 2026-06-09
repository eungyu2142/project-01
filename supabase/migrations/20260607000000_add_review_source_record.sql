alter table public.reviews
add column if not exists source_record_id text references public.medical_records(id) on delete set null;

create unique index if not exists reviews_source_record_id_key
on public.reviews (source_record_id)
where source_record_id is not null;
