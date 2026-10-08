-- Apply after supabase_rls_reset.sql. Repeatable, transactional upgrade.
begin;

create table if not exists public.roster_class_hashes (
 session_id uuid not null references public.sessions(id) on delete cascade,
 code text not null check (code <> '' and code = btrim(code)),
 roster_hash text not null check (roster_hash ~ '^[0-9a-f]{64}$'),
 class_details jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now(),
 primary key (session_id, code)
);
create table if not exists public.roster_print_updates (
 session_id uuid not null,
 code text not null,
 roster_hash text not null check (roster_hash ~ '^[0-9a-f]{64}$'),
 revision uuid not null default gen_random_uuid(),
 changed_at timestamptz not null default now(),
 primary key (session_id, code),
 foreign key (session_id, code) references public.roster_class_hashes(session_id, code) on delete cascade
);
alter table public.roster_class_hashes enable row level security;
alter table public.roster_print_updates enable row level security;
drop policy if exists roster_hash_read on public.roster_class_hashes;
create policy roster_hash_read on public.roster_class_hashes for select to authenticated
 using (public.can_read_session(session_id, auth.uid()));
drop policy if exists roster_update_read on public.roster_print_updates;
create policy roster_update_read on public.roster_print_updates for select to authenticated
 using (public.can_read_session(session_id, auth.uid()));
revoke all on public.roster_class_hashes, public.roster_print_updates from public, anon, authenticated;
grant select on public.roster_class_hashes, public.roster_print_updates to authenticated;
grant all on public.roster_class_hashes, public.roster_print_updates to service_role;

create or replace function public.sync_roster_class_hashes(p_session uuid, p_classes jsonb, p_empty_hash text)
returns table(code text, roster_hash text, class_details jsonb)
language plpgsql security definer set search_path='' as $$
declare entry jsonb; previous_hash text; initialized boolean; incoming jsonb;
begin
 if auth.uid() is null or not (
  app_private.can_edit_roster(p_session)
  or (app_private.is_full_time() and app_private.can_read_session(p_session))
 ) then raise insufficient_privilege using message='Roster upload denied'; end if;
 if jsonb_typeof(p_classes) is distinct from 'array' or p_empty_hash is null or p_empty_hash !~ '^[0-9a-f]{64}$' then
  raise check_violation using message='Invalid roster hashes';
 end if;
 if exists(select 1 from jsonb_array_elements(p_classes) e
  where coalesce(e->>'code','')='' or e->>'code' <> btrim(e->>'code')
   or coalesce(e->>'roster_hash','') !~ '^[0-9a-f]{64}$'
   or jsonb_typeof(e->'class_details') is distinct from 'object'
   or (e->'class_details') ? 'students')
  or exists(select 1 from jsonb_array_elements(p_classes) e group by e->>'code' having count(*)>1) then
  raise check_violation using message='Invalid or duplicate course codes';
 end if;
 -- One upload or acknowledgement per session at a time, including first upload.
 perform 1 from public.sessions s where s.id=p_session for update;
 initialized := exists(select 1 from public.roster_class_hashes h where h.session_id=p_session);
 -- Missing classes now have an empty roster; retain class metadata for blank sheets.
 select coalesce(jsonb_agg(jsonb_build_object('code',h.code,'roster_hash',p_empty_hash,'class_details',h.class_details)), '[]'::jsonb)
 into incoming from public.roster_class_hashes h where h.session_id=p_session
 and not exists(select 1 from jsonb_array_elements(p_classes) e where e->>'code'=h.code);
 incoming := p_classes || incoming;
 for entry in select value from jsonb_array_elements(incoming) loop
  select h.roster_hash into previous_hash from public.roster_class_hashes h where h.session_id=p_session and h.code=entry->>'code';
  insert into public.roster_class_hashes as h(session_id,code,roster_hash,class_details)
  values(p_session,entry->>'code',entry->>'roster_hash',entry->'class_details')
  on conflict on constraint roster_class_hashes_pkey do update set roster_hash=excluded.roster_hash,class_details=excluded.class_details,updated_at=now();
  if initialized and previous_hash is distinct from entry->>'roster_hash' then
   insert into public.roster_print_updates as u(session_id,code,roster_hash)
   values(p_session,entry->>'code',entry->>'roster_hash')
   on conflict on constraint roster_print_updates_pkey do update set roster_hash=excluded.roster_hash,revision=gen_random_uuid(),changed_at=now();
  end if;
 end loop;
 return query select h.code,h.roster_hash,h.class_details from public.roster_class_hashes h where h.session_id=p_session order by h.code;
end $$;

create or replace function public.resolve_roster_print_updates(p_session uuid, p_updates jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare removed jsonb;
begin
 if auth.uid() is null or not public.can_read_session(p_session,auth.uid()) then
  raise insufficient_privilege using message='Session printing denied';
 end if;
 if jsonb_typeof(p_updates) is distinct from 'array' then raise check_violation using message='Invalid print updates'; end if;
 perform 1 from public.sessions s where s.id=p_session for update;
 with resolved as (
  delete from public.roster_print_updates u where u.session_id=p_session
   and exists(select 1 from jsonb_array_elements(p_updates) e where e->>'code'=u.code and e->>'revision'=u.revision::text)
  returning u.code
 ) select coalesce(jsonb_agg(code),'[]'::jsonb) into removed from resolved;
 return removed;
end $$;
revoke all on function public.sync_roster_class_hashes(uuid,jsonb,text), public.resolve_roster_print_updates(uuid,jsonb) from public, anon;
grant execute on function public.sync_roster_class_hashes(uuid,jsonb,text), public.resolve_roster_print_updates(uuid,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
