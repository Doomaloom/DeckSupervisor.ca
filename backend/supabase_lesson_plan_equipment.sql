-- Apply after supabase_lesson_plan_activities.sql, before deploying equipment and device plan export.
begin;
create or replace function public.validate_instructor_plan() returns trigger language plpgsql set search_path=public as $$
declare r jsonb; a jsonb; e jsonb; equipment_keys text[]; activity_texts text[];
begin
 if jsonb_array_length(new.rows)>200 then raise check_violation using message='Too many activities'; end if;
 for r in select value from jsonb_array_elements(new.rows) loop
  if jsonb_typeof(r) <> 'object' or not (r ?& array['skill','activity','location','duration'])
   or (r - array['skill','activity','activities','location','duration','workout','equipment']) <> '{}'::jsonb
   or jsonb_typeof(r->'skill') <> 'string' or jsonb_typeof(r->'activity') <> 'string'
   or jsonb_typeof(r->'location') <> 'string' or jsonb_typeof(r->'duration') <> 'number'
   or length(r->>'skill')>2000 or octet_length(r->>'activity')>10000
   or (r->>'location') !~ '^(Lane( [1-9][0-9]?)?|Shallow end|Deep end)$'
   or (r->>'duration') !~ '^[0-9]+$' or (r->>'duration')::numeric not between 1 and 240
   or (r ? 'workout' and not public.valid_lesson_workout(r->'workout'))
  then raise check_violation using message='Invalid activity row'; end if;
  if r ? 'equipment' then
   if jsonb_typeof(r->'equipment') <> 'array' or jsonb_array_length(r->'equipment')>50
   then raise check_violation using message='Invalid equipment'; end if;
   equipment_keys := array[]::text[];
   for e in select value from jsonb_array_elements(r->'equipment') loop
    if jsonb_typeof(e)<>'string' or length(e #>> '{}')>100
     or regexp_replace(e #>> '{}','[[:space:]]','','g')=''
     or lower(btrim(e #>> '{}'))=any(equipment_keys)
    then raise check_violation using message='Invalid equipment'; end if;
    equipment_keys := array_append(equipment_keys,lower(btrim(e #>> '{}')));
   end loop;
  end if;
  if r ? 'activities' then
   if jsonb_typeof(r->'activities') <> 'array'
    or jsonb_array_length(r->'activities')>100 or r ? 'workout'
   then raise check_violation using message='Invalid activity row'; end if;
   activity_texts := array[]::text[];
   for a in select value from jsonb_array_elements(r->'activities') loop
    if jsonb_typeof(a) <> 'object' or not (a ?& array['kind','text'])
     or (a - array['kind','text']) <> '{}'::jsonb
     or a->>'kind' not in ('library','custom')
     or jsonb_typeof(a->'kind') <> 'string'
     or jsonb_typeof(a->'text') <> 'string'
     or octet_length(a->>'text')>10000
     or regexp_replace(a->>'text','[[:space:]]','','g')=''
    then raise check_violation using message='Invalid activity row'; end if;
    activity_texts := array_append(activity_texts,a->>'text');
   end loop;
   if array_to_string(activity_texts,E'\n\n') <> r->>'activity'
   then raise check_violation using message='Invalid activity row'; end if;
  end if;
 end loop;
 new.updated_at=now(); return new;
end $$;
-- Supervisors may read plans for export; instructor write access stays unchanged.
drop policy if exists plan_supervisor_read on public.instructor_plans;
create policy plan_supervisor_read on public.instructor_plans for select to authenticated
 using (public.can_edit_session(session_id,auth.uid()));
commit;
