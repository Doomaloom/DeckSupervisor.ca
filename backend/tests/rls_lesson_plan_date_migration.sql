-- TEST ONLY: run after the instructor and lesson-plan RLS suites in a disposable DB.
\set ON_ERROR_STOP on
insert into public.sessions(id,team_id,created_by,session_day,start_date,end_date) values
('29900000-0000-0000-0000-000000000001',null,'00000000-0000-0000-0000-000000000002','Tu','2026-10-06','2026-10-27');
insert into public.instructor_assignments(session_id,id,name,account_id) values
('29900000-0000-0000-0000-000000000001','59900000-0000-0000-0000-000000000001','Alex','00000000-0000-0000-0000-000000000007');
insert into public.instructor_classes(id,session_id,assignment_id,code,level,start_time,end_time) values
('69900000-0000-0000-0000-000000000001','29900000-0000-0000-0000-000000000001','59900000-0000-0000-0000-000000000001','MIGRATION','Splash 1','09:00','09:30');
insert into public.instructor_plans(session_id,class_id,week,rows,updated_by) values
('29900000-0000-0000-0000-000000000001','69900000-0000-0000-0000-000000000001','2026-10-05','[{"skill":"Float","activity":"Preserved","location":"Shallow end","duration":5}]','00000000-0000-0000-0000-000000000007');
\ir ../supabase_lesson_plans.sql
\ir ../supabase_lesson_plans.sql
select pg_temp.assert_true((select count(*)=1 and min(week)='2026-10-06'::date and min(rows->0->>'activity')='Preserved'
 from public.instructor_plans where class_id='69900000-0000-0000-0000-000000000001'),'existing Monday plan moved to Tuesday and preserved on reapply');
set role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000007","role":"authenticated"}',false);
select pg_temp.assert_true((select count(*)=1 from public.instructor_plans where class_id='69900000-0000-0000-0000-000000000001' and week='2026-10-06'),'migrated plan readable by instructor');
reset role;
delete from public.sessions where id='29900000-0000-0000-0000-000000000001';
