-- Fix: record "new" has no field "updated_at"
-- Run this in Supabase SQL Editor for existing environments.

alter table public.questionnaires
  add column if not exists created_at timestamptz not null default now();

alter table public.questionnaires
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  if to_jsonb(new) ? 'updated_at' then
    new := jsonb_populate_record(new, jsonb_build_object('updated_at', now()));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_questionnaires_updated_at on public.questionnaires;
create trigger trg_questionnaires_updated_at
before update on public.questionnaires
for each row
execute procedure public.set_current_timestamp_updated_at();

-- Deduplicate user rows and enforce upsert target
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by updated_at desc, id desc
    ) as rn
  from public.questionnaires
)
delete from public.questionnaires q
using ranked r
where q.id = r.id
  and r.rn > 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'questionnaires_user_id_key'
      and conrelid = 'public.questionnaires'::regclass
  ) then
    alter table public.questionnaires
      add constraint questionnaires_user_id_key unique (user_id);
  end if;
end;
$$;
