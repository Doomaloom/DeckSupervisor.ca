-- Apply after schema reconciliation and supabase_rls_update.sql. Repeatable, transactional.
begin;
create table if not exists public.instructor_assignments (
 session_id uuid not null references public.sessions(id) on delete cascade,
 id uuid not null, name text not null default '', account_id uuid references public.profiles(id),
 active boolean not null default true, primary key(session_id,id)
);
create table if not exists public.instructor_classes (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.sessions(id) on delete cascade,
 assignment_id uuid not null, code text not null, level text not null, start_time time not null, end_time time not null,
 active boolean not null default true, unique(session_id,code), unique(session_id,id),
 foreign key(session_id,assignment_id) references public.instructor_assignments(session_id,id)
);
alter table public.instructor_assignments enable row level security;
alter table public.instructor_classes enable row level security;
drop policy if exists assignment_read on public.instructor_assignments;
create policy assignment_read on public.instructor_assignments for select to authenticated using (
 can_edit_session(session_id,auth.uid()) or (active and account_id=auth.uid()));
drop policy if exists assignment_manage on public.instructor_assignments;
create policy assignment_manage on public.instructor_assignments for all to authenticated using (
 can_edit_session(session_id,auth.uid())) with check(can_edit_session(session_id,auth.uid()));
drop policy if exists class_read on public.instructor_classes;
create policy class_read on public.instructor_classes for select to authenticated using (
 can_edit_session(session_id,auth.uid()) or (active and exists(select 1 from public.instructor_assignments a
 where a.session_id=instructor_classes.session_id and a.id=assignment_id and a.active and a.account_id=auth.uid())));
drop policy if exists class_manage on public.instructor_classes;
create policy class_manage on public.instructor_classes for all to authenticated using (
 can_edit_session(session_id,auth.uid())) with check(can_edit_session(session_id,auth.uid()));
revoke all on public.instructor_assignments,public.instructor_classes from anon,authenticated;
grant select,insert,update,delete on public.instructor_assignments,public.instructor_classes to authenticated;

-- Caller-authenticated transaction: only explicit metadata is projected from the supervisor save.
create or replace function public.save_instructor_schematic(p_session uuid,p_data jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare a jsonb; c jsonb; aid uuid;
begin
 if not can_edit_session(p_session,auth.uid()) then raise insufficient_privilege using message='Session editing denied'; end if;
 insert into schematics(session_id,created_by,data,updated_at) values(p_session,auth.uid(),p_data,now())
 on conflict(session_id) do update set data=excluded.data,updated_at=now();
 update instructor_assignments set active=false where session_id=p_session;
 update instructor_classes set active=false where session_id=p_session;
 for a in select value from jsonb_array_elements(p_data->'assignments') loop
  aid := (a->>'id')::uuid;
  insert into instructor_assignments(session_id,id,name) values(p_session,aid,a->>'name')
  on conflict(session_id,id) do update set name=excluded.name,active=true;
  for c in select value from jsonb_array_elements(a->'classes') loop
   insert into instructor_classes(session_id,assignment_id,code,level,start_time,end_time)
   values(p_session,aid,c->>'code',c->>'level',(c->>'start_time')::time,(c->>'end_time')::time)
   on conflict(session_id,code) do update set assignment_id=excluded.assignment_id,level=excluded.level,
    start_time=excluded.start_time,end_time=excluded.end_time,active=true;
  end loop;
 end loop;
end $$;
-- Session dates are local calendar dates in America/Toronto, not UTC instants.
create or replace function public.instructor_weeks(p_start date,p_end date,p_day text)
returns table(week date) language sql immutable set search_path=public as $$
 select distinct date_trunc('week',d)::date
 from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') d
 where trim(to_char(d,'Day'))=p_day
 or (array['Mo','Tu','We','Th','Fr','Sa','Su'])[extract(isodow from d)::int]=any(string_to_array(p_day,','))
 or (p_day like 'Mini Session %' and extract(isodow from d)<=5)
 order by 1
$$;
-- Links never grant access to sessions or schematics. This function returns only session context.
create or replace function public.instructor_sessions()
returns table(id uuid,session_day text,session_season text,session_year integer,location text,start_date date,end_date date,weeks jsonb)
language sql stable security definer set search_path=public as $$
 select s.id,s.session_day,s.session_season,s.session_year,s.location,s.start_date,s.end_date,
 coalesce((select jsonb_agg(w.week::text order by w.week) from instructor_weeks(s.start_date,s.end_date,s.session_day) w),'[]'::jsonb)
 from sessions s where exists(select 1 from instructor_assignments a
 where a.session_id=s.id and a.active and a.account_id=auth.uid()) order by s.start_date,s.id
$$;
revoke all on function public.instructor_weeks(date,date,text) from public,anon;
grant execute on function public.instructor_weeks(date,date,text) to authenticated;
revoke all on function public.save_instructor_schematic(uuid,jsonb),public.instructor_sessions() from public,anon;
grant execute on function public.save_instructor_schematic(uuid,jsonb),public.instructor_sessions() to authenticated;
commit;
