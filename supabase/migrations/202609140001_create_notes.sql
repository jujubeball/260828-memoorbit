begin;

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_pinned boolean not null default false
);

create index notes_user_updated_idx on public.notes (user_id, updated_at desc);
alter table public.notes enable row level security;

-- 브라우저 공개 키만 가진 게스트는 접근할 수 없고, 로그인 사용자는 자신의 행만 다룹니다.
revoke all on public.notes from anon, authenticated;
grant select, insert, update, delete on public.notes to authenticated;

create policy notes_select_own on public.notes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy notes_insert_own on public.notes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy notes_update_own on public.notes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy notes_delete_own on public.notes for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 수정 시각은 클라이언트의 시계가 아닌 DB의 시계로 갱신합니다.
create function public.set_note_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger notes_updated_at before update on public.notes
  for each row execute function public.set_note_updated_at();

commit;
