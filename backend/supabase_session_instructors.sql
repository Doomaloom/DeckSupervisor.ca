-- Repeatable upgrade after supabase_instructor.sql and supabase_lesson_plans.sql.
begin;
create table if not exists public.session_instructors (
 session_id uuid not null references public.sessions(id) on delete cascade,
 id uuid not null, name text not null default '', account_id uuid references public.profiles(id),
 position integer not null check(position>=0), active boolean not null default true, primary key(session_id,id)
);
alter table public.session_instructors enable row level security;
drop policy if exists session_instructor_read on public.session_instructors;
create policy session_instructor_read on public.session_instructors for select to authenticated using(public.can_edit_session(session_id,auth.uid()));
revoke all on public.session_instructors from public,anon,authenticated;
grant select on public.session_instructors to authenticated;
alter table public.sessions add column if not exists instructor_roster_initialized boolean not null default false;
alter table public.instructor_assignments add column if not exists instructor_id uuid;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.instructor_assignments'::regclass and conname='assignment_session_instructor_fk') then
  alter table public.instructor_assignments add constraint assignment_session_instructor_fk foreign key(session_id,instructor_id) references public.session_instructors(session_id,id);
 end if;
end $$;

-- Refresh legacy name projections without changing class identity or timetable positions.
create or replace function public.sync_session_instructor_projection(p_session uuid)
returns void language plpgsql security definer set search_path='' as $$
declare saved jsonb; names jsonb; ids jsonb; entries jsonb;
begin
 update public.sessions set instructors=coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.name) order by i.position)
  from public.session_instructors i where i.session_id=p_session and i.active),'[]'::jsonb) where id=p_session;
 update public.instructor_assignments a set instructor_id=null,name='',account_id=null where a.session_id=p_session and a.instructor_id is not null
 and not exists(select 1 from public.session_instructors i where i.session_id=a.session_id and i.id=a.instructor_id and i.active);
 update public.instructor_assignments a set name=i.name,account_id=i.account_id from public.session_instructors i
 where a.session_id=p_session and i.session_id=a.session_id and i.id=a.instructor_id and i.active;
 select data into saved from public.schematics where session_id=p_session;
 if saved is null or not(saved ? 'assignmentIds') then return; end if;
 select coalesce(jsonb_agg(coalesce(a.name,'') order by x.ordinality),'[]'::jsonb),coalesce(jsonb_agg(a.instructor_id order by x.ordinality),'[]'::jsonb)
 into names,ids from jsonb_array_elements_text(saved->'assignmentIds') with ordinality x(id,ordinality)
 left join public.instructor_assignments a on a.session_id=p_session and a.id=x.id::uuid;
 select coalesce(jsonb_agg(e.value || jsonb_build_object('name',coalesce(a.name,''),'instructor_id',a.instructor_id) order by e.ordinality),'[]'::jsonb)
 into entries from jsonb_array_elements(coalesce(saved->'assignments','[]'::jsonb)) with ordinality e(value,ordinality)
 left join public.instructor_assignments a on a.session_id=p_session and a.id=(e.value->>'id')::uuid;
 update public.schematics set data=saved || jsonb_build_object('instructors',names,'instructorIds',ids,'assignments',entries),updated_at=now() where session_id=p_session;
end $$;

create or replace function public.initialize_session_instructors(p_session uuid)
returns void language plpgsql security definer set search_path='' as $$
declare s public.sessions; a record; entry jsonb; n integer:=0; column_names text[]:=array[]::text[];
begin
 select * into s from public.sessions where id=p_session for update;
 if not found or s.instructor_roster_initialized then return; end if;
 for a in select ia.* from public.instructor_assignments ia left join public.schematics sc on sc.session_id=ia.session_id
 where ia.session_id=p_session and ia.active
 order by coalesce((select min(x.ordinality) from jsonb_array_elements_text(coalesce(sc.data->'assignmentIds','[]'::jsonb)) with ordinality x(id,ordinality) where x.id=ia.id::text),2147483647),ia.id loop
  insert into public.session_instructors(session_id,id,name,account_id,position) values(p_session,a.id,a.name,a.account_id,n);
  update public.instructor_assignments set instructor_id=a.id where session_id=p_session and id=a.id;
  column_names:=array_append(column_names,a.name); n:=n+1;
 end loop;
 for entry in select value from jsonb_array_elements(coalesce(s.instructors,'[]'::jsonb)) loop
  if (select count(*) from unnest(column_names) name where name=coalesce(entry->>'name',''))=1
   and (select count(*) from jsonb_array_elements(coalesce(s.instructors,'[]'::jsonb)) e where e->>'name'=entry->>'name')=1 then continue; end if;
  insert into public.session_instructors(session_id,id,name,position) values(p_session,gen_random_uuid(),coalesce(entry->>'name',''),n); n:=n+1;
 end loop;
 update public.sessions set instructor_roster_initialized=true where id=p_session;
 perform public.sync_session_instructor_projection(p_session);
end $$;
select public.initialize_session_instructors(id) from public.sessions;
create or replace function public.initialize_new_session_instructors()
returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.initialize_session_instructors(new.id); return new; end $$;
drop trigger if exists initialize_session_roster on public.sessions;
create trigger initialize_session_roster after insert on public.sessions for each row execute function public.initialize_new_session_instructors();

create or replace function public.session_instructor_roster(p_session uuid)
returns table(id uuid,name text,account_id uuid,account jsonb,class_count bigint)
language sql stable security definer set search_path='' set row_security=off as $$
 select i.id,i.name,i.account_id,
 case when p.id is null then null else jsonb_build_object('id',p.id,'first_name',p.first_name,'last_name',p.last_name,'email',p.email) end,
 (select count(*) from public.instructor_classes c join public.instructor_assignments a on a.session_id=c.session_id and a.id=c.assignment_id
  where a.session_id=i.session_id and a.instructor_id=i.id and a.active and c.active)
 from public.session_instructors i left join public.profiles p on p.id=i.account_id
 where i.session_id=p_session and i.active and public.can_edit_session(p_session,auth.uid()) order by i.position
$$;

create or replace function public.replace_session_instructor_roster(p_session uuid,p_roster jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare e jsonb; iid uuid; aid uuid; prior public.session_instructors; idx integer:=0;
begin
 if jsonb_typeof(p_roster) is distinct from 'array' then raise check_violation using message='Invalid instructor roster'; end if;
 if exists(select 1 from jsonb_array_elements(p_roster) r group by r->>'id' having count(*)>1) then raise check_violation using message='Duplicate instructor identity'; end if;
 for e in select value from jsonb_array_elements(p_roster) loop
  if jsonb_typeof(e->'name') is distinct from 'string' or e->>'id' is null or length(e->>'name')>2000 then raise check_violation using message='Invalid instructor row'; end if;
  iid:=(e->>'id')::uuid; aid:=(e->>'account_id')::uuid;
  select * into prior from public.session_instructors where session_id=p_session and id=iid;
  if found and not prior.active then raise check_violation using message='Instructor was removed. Reload the session.'; end if;
  if aid is not null and (prior.id is null or prior.account_id is distinct from aid)
   and not exists(select 1 from public.profiles where id=aid and account_type='part_time') then raise check_violation using message='Instructor links require a part-time account'; end if;
  insert into public.session_instructors(session_id,id,name,account_id,position) values(p_session,iid,e->>'name',aid,idx)
  on conflict(session_id,id) do update set name=excluded.name,account_id=excluded.account_id,position=excluded.position;
  idx:=idx+1;
 end loop;
 update public.session_instructors i set active=false where session_id=p_session and active
 and not exists(select 1 from jsonb_array_elements(p_roster) draft where (draft->>'id')::uuid=i.id);
 perform public.sync_session_instructor_projection(p_session);
end $$;

create or replace function public.save_session_with_instructors(p_session uuid,p_fields jsonb,p_roster jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.sessions; next_row public.sessions;
begin
 if not public.can_edit_session(p_session,auth.uid()) then raise insufficient_privilege using message='Session editing denied'; end if;
 select * into s from public.sessions where id=p_session for update;
 if exists(select 1 from jsonb_object_keys(p_fields) k where k not in
  ('team_id','session_day','session_season','session_year','start_date','end_date','session_start_time24','session_end_time24','location','source_locations','updated_at')) then raise check_violation using message='Unsupported session field'; end if;
 next_row:=jsonb_populate_record(null::public.sessions,to_jsonb(s)||p_fields);
 update public.sessions set team_id=next_row.team_id,session_day=next_row.session_day,session_season=next_row.session_season,
 session_year=next_row.session_year,start_date=next_row.start_date,end_date=next_row.end_date,
 session_start_time24=next_row.session_start_time24,session_end_time24=next_row.session_end_time24,
 location=next_row.location,source_locations=next_row.source_locations,updated_at=now() where id=p_session;
 perform public.replace_session_instructor_roster(p_session,p_roster);
 return (select to_jsonb(saved_session) from public.sessions saved_session where id=p_session);
end $$;

create or replace function public.link_session_instructor_assignment(p_session uuid,p_assignment uuid,p_account uuid)
returns table(id uuid,name text,account_id uuid)
language plpgsql security definer set search_path='' as $$
declare iid uuid; roster jsonb;
begin
 if not public.can_edit_session(p_session,auth.uid()) then raise insufficient_privilege; end if;
 perform 1 from public.sessions where sessions.id=p_session for update;
 select a.instructor_id into iid from public.instructor_assignments a where a.session_id=p_session and a.id=p_assignment and a.active;
 if iid is null then raise check_violation using message='Select a session instructor for this column first'; end if;
 select jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'account_id',case when i.id=iid then p_account else i.account_id end) order by i.position)
 into roster from public.session_instructors i where i.session_id=p_session and i.active;
 perform public.replace_session_instructor_roster(p_session,roster);
 return query select a.id,a.name,a.account_id from public.instructor_assignments a where a.session_id=p_session and a.id=p_assignment;
end $$;

create or replace function public.guard_instructor_account_link()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.account_id is null then return new; end if;
 if tg_op='UPDATE' then
  if new.account_id is not distinct from old.account_id then return new; end if;
 elsif exists(select 1 from public.instructor_assignments a where a.session_id=new.session_id and a.id=new.id and a.account_id=new.account_id) then
  return new;
 end if;
 if new.instructor_id is not null and exists(select 1 from public.session_instructors i where i.session_id=new.session_id and i.id=new.instructor_id and i.active and i.account_id=new.account_id) then return new; end if;
 if not exists(select 1 from public.profiles p where p.id=new.account_id and p.account_type='part_time') then
  raise check_violation using message='Instructor links require a part-time account';
 end if;
 return new;
end $$;

create or replace function public.guard_assignment_roster()
returns trigger language plpgsql security definer set search_path='' as $$
declare i public.session_instructors;
begin
 if new.instructor_id is not null then
  select * into i from public.session_instructors where session_id=new.session_id and id=new.instructor_id and active;
  if not found then raise check_violation using message='Instructor was removed. Reload the session.'; end if;
  if new.account_id is distinct from i.account_id or new.name is distinct from i.name then raise check_violation using message='Edit instructor names and account links in Manage Session'; end if;
 elsif new.account_id is not null and (tg_op='INSERT' or old.instructor_id is not null) then
  raise check_violation using message='Select a session instructor before linking a column';
 end if;
 return new;
end $$;
drop trigger if exists assignment_roster_guard on public.instructor_assignments;
create trigger assignment_roster_guard before insert or update on public.instructor_assignments for each row execute function public.guard_assignment_roster();

create or replace function public.refresh_owned_schematic_roster(p_session uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.can_edit_session(p_session,auth.uid()) then raise insufficient_privilege; end if;
 perform public.sync_session_instructor_projection(p_session);
end $$;
create or replace function public.save_instructor_schematic(p_session uuid,p_data jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare a jsonb; c jsonb; aid uuid; iid uuid; inst public.session_instructors; old_iid uuid;
begin
 if not can_edit_session(p_session,auth.uid()) then raise insufficient_privilege using message='Session editing denied'; end if;
 perform 1 from public.sessions where id=p_session for update;
 update instructor_assignments set active=false where session_id=p_session;
 update instructor_classes set active=false where session_id=p_session;
 for a in select value from jsonb_array_elements(p_data->'assignments') loop
  aid:=(a->>'id')::uuid;
  select instructor_id into old_iid from instructor_assignments where session_id=p_session and id=aid;
  iid:=case when a ? 'instructor_id' then (a->>'instructor_id')::uuid else old_iid end;
  inst:=null;
  if iid is not null then
   select * into inst from public.session_instructors where session_id=p_session and id=iid and active;
   if not found then raise check_violation using message='Instructor was removed. Reload the session.'; end if;
  end if;
  insert into instructor_assignments(session_id,id,name,account_id,instructor_id) values(p_session,aid,coalesce(inst.name,''),inst.account_id,iid)
  on conflict(session_id,id) do update set name=excluded.name,account_id=excluded.account_id,instructor_id=excluded.instructor_id,active=true;
  for c in select value from jsonb_array_elements(a->'classes') loop
   insert into instructor_classes(session_id,assignment_id,code,level,start_time,end_time)
   values(p_session,aid,c->>'code',c->>'level',(c->>'start_time')::time,(c->>'end_time')::time)
   on conflict(session_id,code) do update set assignment_id=excluded.assignment_id,level=excluded.level,start_time=excluded.start_time,end_time=excluded.end_time,active=true;
  end loop;
 end loop;
 insert into schematics(session_id,created_by,data,updated_at) values(p_session,auth.uid(),p_data,now())
 on conflict(session_id) do update set data=excluded.data,updated_at=now();
 perform public.refresh_owned_schematic_roster(p_session);
end $$;
revoke all on function public.initialize_session_instructors(uuid),public.initialize_new_session_instructors(),public.sync_session_instructor_projection(uuid),
 public.replace_session_instructor_roster(uuid,jsonb),public.guard_assignment_roster() from public,anon,authenticated;
revoke all on function public.session_instructor_roster(uuid),public.save_session_with_instructors(uuid,jsonb,jsonb),
 public.link_session_instructor_assignment(uuid,uuid,uuid),public.refresh_owned_schematic_roster(uuid) from public,anon;
grant execute on function public.session_instructor_roster(uuid),public.save_session_with_instructors(uuid,jsonb,jsonb),
 public.link_session_instructor_assignment(uuid,uuid,uuid),public.refresh_owned_schematic_roster(uuid) to authenticated;
commit;
