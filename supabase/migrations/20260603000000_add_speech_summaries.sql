create table if not exists speech_summaries (
  id text primary key,
  user_id text not null,
  scope text not null default 'record',
  pet_id text references pets(id) on delete cascade,
  hospital_id text,
  date date not null,
  title text not null,
  fields jsonb not null default '{}'::jsonb,
  transcript text not null default '',
  warnings jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table speech_summaries enable row level security;

drop policy if exists "Users can manage own speech summaries" on speech_summaries;

create policy "Users can manage own speech summaries"
on speech_summaries
for all
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);
