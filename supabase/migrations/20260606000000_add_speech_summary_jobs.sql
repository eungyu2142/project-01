create table if not exists public.speech_summary_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  scope text not null default 'record' check (scope in ('record', 'review')),
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  audio_path text not null,
  audio_name text not null default '',
  audio_type text not null default '',
  audio_size bigint not null default 0,
  transcript text not null default '',
  summary jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists speech_summary_jobs_user_created_at_idx
on public.speech_summary_jobs (user_id, created_at desc);

alter table public.speech_summary_jobs enable row level security;

drop policy if exists "Users can read own speech summary jobs" on public.speech_summary_jobs;

create policy "Users can read own speech summary jobs"
on public.speech_summary_jobs
for select
to authenticated
using ((select auth.uid()::text) = user_id);

grant select on public.speech_summary_jobs to authenticated;

create or replace function public.fail_stale_speech_summary_job(job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.speech_summary_jobs
  set
    status = 'failed',
    error_message = '음성 요약 작업이 서버 제한 시간을 초과했어요. 다시 시도해 주세요.',
    completed_at = now(),
    updated_at = now()
  where id = job_id
    and user_id = auth.uid()::text
    and status = 'processing'
    and updated_at < now() - interval '8 minutes';

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

grant execute on function public.fail_stale_speech_summary_job(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'speech-audio',
  'speech-audio',
  false,
  26214400,
  array[
    'audio/*',
    'video/mp4',
    'video/webm'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload own speech audio" on storage.objects;
drop policy if exists "Users can read own speech audio" on storage.objects;
drop policy if exists "Users can delete own speech audio" on storage.objects;

create policy "Users can upload own speech audio"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'speech-audio'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can read own speech audio"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'speech-audio'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can delete own speech audio"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'speech-audio'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

notify pgrst, 'reload schema';
