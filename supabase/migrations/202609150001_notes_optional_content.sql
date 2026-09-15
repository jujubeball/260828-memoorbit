-- Phase 1 명세에서 본문은 선택 항목입니다. 기존 메모와 소유자별 보안 정책을 보존하며 NULL 입력도 허용합니다.
-- 최초 설치는 202609140001_create_notes.sql 다음에 실행합니다.
begin;

alter table public.notes alter column content drop not null;

commit;
