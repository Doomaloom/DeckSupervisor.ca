-- Apply after supabase_lesson_plan_curriculum.sql, before the workout-aware API/frontend.
begin;
create or replace function public.valid_lesson_workout(w jsonb) returns boolean
language plpgsql immutable set search_path=public as $$
declare section jsonb; s jsonb; timing jsonb; total_sets integer := 0; key text;
begin
 if jsonb_typeof(w) is distinct from 'object' or not (w ?& array['version','title','sections'])
  or (w - array['version','title','sections']) <> '{}'::jsonb
  or w->>'version' is distinct from '1' or jsonb_typeof(w->'version') is distinct from 'number'
  or jsonb_typeof(w->'title') is distinct from 'string' or length(w->>'title') > 200
  or regexp_replace(w->>'title','[[:space:]]','','g') = ''
  or jsonb_typeof(w->'sections') is distinct from 'object'
  or not (w->'sections' ?& array['warmUp','mainSet','coolDown'])
  or ((w->'sections') - array['warmUp','mainSet','coolDown']) <> '{}'::jsonb
 then return false; end if;
 foreach key in array array['warmUp','mainSet','coolDown'] loop
  section := w->'sections'->key;
  if jsonb_typeof(section) is distinct from 'array' then return false; end if;
  if jsonb_array_length(section) = 0 then return false; end if;
  total_sets := total_sets + jsonb_array_length(section);
  if total_sets > 100 then return false; end if;
  for s in select value from jsonb_array_elements(section) loop
   if jsonb_typeof(s) is distinct from 'object' or not (s ?& array['repetitions','distance','activity','notes'])
    or (s - array['repetitions','distance','activity','notes','timing']) <> '{}'::jsonb
    or jsonb_typeof(s->'repetitions') is distinct from 'number' or (s->>'repetitions') !~ '^[0-9]+$'
    or (s->>'repetitions')::numeric not between 1 and 1000
    or jsonb_typeof(s->'distance') is distinct from 'number' or (s->>'distance') !~ '^[0-9]+$'
    or (s->>'distance')::numeric not between 1 and 10000
    or jsonb_typeof(s->'activity') is distinct from 'string' or length(s->>'activity') > 200
    or regexp_replace(s->>'activity','[[:space:]]','','g') = ''
    or jsonb_typeof(s->'notes') is distinct from 'string' or length(s->>'notes') > 1000
   then return false; end if;
   if s ? 'timing' then
    timing := s->'timing';
    if jsonb_typeof(timing) is distinct from 'object' or not (timing ?& array['kind','seconds'])
     or (timing - array['kind','seconds']) <> '{}'::jsonb
     or jsonb_typeof(timing->'kind') is distinct from 'string' or timing->>'kind' not in ('rest','interval')
     or jsonb_typeof(timing->'seconds') is distinct from 'number' or (timing->>'seconds') !~ '^[0-9]+$'
     or (timing->>'seconds')::numeric not between 1 and 3600
    then return false; end if;
   end if;
  end loop;
 end loop;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end $$;

create or replace function public.validate_instructor_plan() returns trigger language plpgsql set search_path=public as $$
declare r jsonb;
begin
 if jsonb_array_length(new.rows)>200 then raise check_violation using message='Too many activities'; end if;
 for r in select value from jsonb_array_elements(new.rows) loop
  if jsonb_typeof(r) <> 'object' or not (r ?& array['skill','activity','location','duration'])
   or (r - array['skill','activity','location','duration','workout']) <> '{}'::jsonb
   or jsonb_typeof(r->'skill') <> 'string' or jsonb_typeof(r->'activity') <> 'string'
   or jsonb_typeof(r->'location') <> 'string' or jsonb_typeof(r->'duration') <> 'number'
   or length(r->>'skill')>2000 or octet_length(r->>'activity')>10000
   or (r->>'location') !~ '^(Lane( [1-9][0-9]?)?|Shallow end|Deep end)$'
   or (r->>'duration') !~ '^[0-9]+$' or (r->>'duration')::numeric not between 1 and 240
   or (r ? 'workout' and not public.valid_lesson_workout(r->'workout'))
  then raise check_violation using message='Invalid activity row'; end if;
 end loop;
 new.updated_at=now(); return new;
end $$;
revoke all on function public.valid_lesson_workout(jsonb) from public,anon;
grant execute on function public.valid_lesson_workout(jsonb) to authenticated;
commit;
