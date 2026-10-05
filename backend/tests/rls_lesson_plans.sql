\set ON_ERROR_STOP on
\ir ../supabase_lesson_plans.sql
\ir ../supabase_lesson_plans.sql
\ir ../supabase_lesson_plan_curriculum.sql
\ir ../supabase_lesson_plan_curriculum.sql
\ir ../supabase_lesson_plan_workouts.sql
\ir ../supabase_lesson_plan_workouts.sql
begin;
update sessions set session_day='Mo',start_date='2026-10-05',end_date='2026-10-26' where id='20000000-0000-0000-0000-000000000004';
insert into instructor_assignments(session_id,id,name,account_id) values('20000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000001','Alex','00000000-0000-0000-0000-000000000007');
insert into instructor_classes(id,session_id,assignment_id,code,level,start_time,end_time) values
('60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000001','A','Swimmer 1','09:00','09:30'),
('60000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000001','B','Swimmer 2','09:30','10:00');
set role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000007","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*)=4 from instructor_weeks('2026-10-05','2026-10-26','Mo')),'Monday-start calendar weeks');
select pg_temp.assert_true((select count(*)=2 from instructor_weeks('2026-10-05','2026-10-16','Mini Session 1')),'mini session weekday weeks');
select pg_temp.assert_true((select count(*)=0 from instructor_plans),'opening weeks leaves plans null');
insert into instructor_plans(session_id,class_id,week,rows,updated_by) values
('20000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000001','2026-10-05','[{"skill":"Float","activity":"First","location":"Shallow end","duration":5},{"skill":"Kick","activity":"Second","location":"Lane 2","duration":10}]',auth.uid()),
('20000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000001','2026-10-12','[]',auth.uid()),
('20000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000002','2026-10-05','[]',auth.uid());
select pg_temp.assert_true((select count(*)=3 from instructor_plans),'independent two-class multiple-week plans');
update instructor_plans set curriculum_level='Splash2A' where class_id='60000000-0000-0000-0000-000000000001' and week='2026-10-05';
select pg_temp.assert_true((select curriculum_level='Splash2A' from instructor_plans where class_id='60000000-0000-0000-0000-000000000001' and week='2026-10-05'),'curriculum level persists');
do $$
declare invalid_level text;
begin
 foreach invalid_level in array array['SplashPrivate','Unknown'] loop
  begin
   update instructor_plans set curriculum_level=invalid_level;
   raise exception 'FAIL: accepted invalid curriculum %', invalid_level;
  exception when check_violation then
   raise notice 'PASS: invalid curriculum % denied', invalid_level;
  end;
 end loop;
end $$;

select pg_temp.assert_true((select rows->0->>'activity'='First' and rows->1->>'activity'='Second' from instructor_plans where class_id='60000000-0000-0000-0000-000000000001' and week='2026-10-05'),'row ordering and four columns persist');
select pg_temp.denied($q$insert into instructor_plans(session_id,class_id,week,rows,updated_by) values('20000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000001','2026-10-06','[]',auth.uid())$q$,'non-Monday denied');
do $$
declare
 valid jsonb := '{"version":1,"title":"Workout","sections":{"warmUp":[{"repetitions":1,"distance":25,"activity":"Choice","notes":""}],"mainSet":[{"repetitions":4,"distance":50,"activity":"Front crawl","notes":"","timing":{"kind":"interval","seconds":90}}],"coolDown":[{"repetitions":1,"distance":25,"activity":"Choice","notes":""}]}}';
 invalid jsonb;
begin
 update instructor_plans set rows=jsonb_set(rows,'{0,workout}',valid) where class_id='60000000-0000-0000-0000-000000000001' and week='2026-10-05';
 perform pg_temp.assert_true((select rows->0->'workout'=valid from instructor_plans where class_id='60000000-0000-0000-0000-000000000001' and week='2026-10-05'),'structured workout retained');
 foreach invalid in array array[
  jsonb_set(valid,'{version}','2'),jsonb_set(valid,'{title}','" "'),
  jsonb_set(valid,'{sections,warmUp}','[]'),
  jsonb_set(valid,'{sections,mainSet,0,distance}','1.5'),
  jsonb_set(valid,'{sections,mainSet,0,timing,kind}','"unknown"'),
  jsonb_set(valid,'{sections,mainSet,0,timing,seconds}','0'),
  jsonb_set(valid,'{sections,mainSet,0,unknown}','true'),
  jsonb_set(valid,'{sections,mainSet,0,notes}','null'),
  jsonb_set(valid,'{sections,mainSet}','[null]'), 'null'::jsonb
 ] loop
  perform pg_temp.assert_true(not public.valid_lesson_workout(invalid),'invalid workout rejected by helper');
  begin
   update instructor_plans set rows=jsonb_set(rows,'{0,workout}',invalid) where class_id='60000000-0000-0000-0000-000000000001' and week='2026-10-05';
   raise exception 'FAIL: accepted invalid workout %',invalid;
  exception when check_violation then raise notice 'PASS: invalid workout denied'; end;
 end loop;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000008","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*)=0 from instructor_plans),'other account plans hidden');
select pg_temp.denied($q$insert into instructor_plans(session_id,class_id,week,rows,updated_by) values('20000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000001','2026-10-19','[]',auth.uid())$q$,'other account save denied');
reset role;
update instructor_assignments set account_id=null;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000007","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*)=0 from instructor_plans),'unlink revokes plan access');
reset role;
select pg_temp.assert_true((select count(*)=3 from instructor_plans),'unlink retains plans');
update instructor_assignments set account_id='00000000-0000-0000-0000-000000000008';
set role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000008","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*)=3 from instructor_plans),'reassignment transfers saved plan access');
reset role;
rollback;
