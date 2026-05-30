delete from public.medical_records record
where not exists (
  select 1
  from public.pets pet
  where pet.id = record.pet_id
);

delete from public.reviews review
where review.pet_id is not null
  and not exists (
    select 1
    from public.pets pet
    where pet.id = review.pet_id
  );

alter table public.medical_records
drop constraint if exists medical_records_pet_id_fkey;

alter table public.medical_records
add constraint medical_records_pet_id_fkey
foreign key (pet_id)
references public.pets(id)
on delete cascade;

alter table public.reviews
drop constraint if exists reviews_pet_id_fkey;

alter table public.reviews
add constraint reviews_pet_id_fkey
foreign key (pet_id)
references public.pets(id)
on delete cascade;
