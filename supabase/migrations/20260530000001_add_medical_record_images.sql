alter table public.medical_records
add column if not exists image_urls jsonb not null default '[]'::jsonb;
