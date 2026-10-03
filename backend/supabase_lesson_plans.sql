begin;
create table if not exists public.instructor_plans (
 session_id uuid not null, class_id uuid not null, week date not null,
 rows jsonb not null check(jsonb_typeof(rows)='array'), updated_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now(), primary key(session_id,class_id,week),
 foreign key(session_id,class_id) references public.instructor_classes(session_id,id) on delete cascade
);
-- Uses live links, so unlinking immediately revokes access and reassignment retains plans.
create or replace function public.can_plan_class(p_session uuid,p_class uuid,p_week date)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from instructor_classes c join instructor_assignments a
 on a.session_id=c.session_id and a.id=c.assignment_id join sessions s on s.id=c.session_id
 where c.id=p_class and c.session_id=p_session and c.active and a.active and a.account_id=auth.uid()
 and extract(isodow from p_week)=1 and exists(
 select 1 from instructor_weeks(s.start_date,s.end_date,s.session_day) w where w.week=p_week))
$$;
alter table public.instructor_plans enable row level security;
drop policy if exists plan_read on public.instructor_plans;
create policy plan_read on public.instructor_plans for select to authenticated using(can_plan_class(session_id,class_id,week));
drop policy if exists plan_create on public.instructor_plans;
create policy plan_create on public.instructor_plans for insert to authenticated with check(can_plan_class(session_id,class_id,week) and updated_by=auth.uid());
drop policy if exists plan_update on public.instructor_plans;
create policy plan_update on public.instructor_plans for update to authenticated using(can_plan_class(session_id,class_id,week)) with check(can_plan_class(session_id,class_id,week) and updated_by=auth.uid());
-- Reject invalid direct storage requests too, not just API validation.
create or replace function public.validate_instructor_plan() returns trigger language plpgsql set search_path=public as $$
declare r jsonb;
begin
 if jsonb_array_length(new.rows)>200 then raise check_violation using message='Too many activities'; end if;
 for r in select value from jsonb_array_elements(new.rows) loop
  if jsonb_typeof(r) <> 'object' or not (r ?& array['skill','activity','location','duration'])
   or (r - array['skill','activity','location','duration']) <> '{}'::jsonb
   or jsonb_typeof(r->'skill') <> 'string' or jsonb_typeof(r->'activity') <> 'string'
   or jsonb_typeof(r->'location') <> 'string' or jsonb_typeof(r->'duration') <> 'number'
   or length(r->>'skill')>2000 or length(r->>'activity')>10000
   or (r->>'location') !~ '^(Lane( [1-9][0-9]?)?|Shallow end|Deep end)$'
   or (r->>'duration') !~ '^[0-9]+$' or (r->>'duration')::numeric not between 1 and 240
  then raise check_violation using message='Invalid activity row'; end if;
 end loop;
 new.updated_at=now(); return new;
end $$;
drop trigger if exists validate_instructor_plan on public.instructor_plans;
create trigger validate_instructor_plan before insert or update on public.instructor_plans for each row execute function public.validate_instructor_plan();
revoke all on public.instructor_plans from anon,authenticated;
grant select,insert,update on public.instructor_plans to authenticated;
revoke all on function public.can_plan_class(uuid,uuid,date),public.validate_instructor_plan() from public,anon;
grant execute on function public.can_plan_class(uuid,uuid,date) to authenticated;
commit;
