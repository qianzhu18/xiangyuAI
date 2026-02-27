-- Fix existing environments that already created questionnaires without a unique(user_id)
-- Run this once in Supabase SQL Editor before using upsert(onConflict: 'user_id')

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
