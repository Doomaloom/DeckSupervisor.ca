\set ON_ERROR_STOP on
\ir ../supabase_lesson_plans.sql
\ir ../supabase_lesson_plans.sql
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
select pg_temp.assert_true((select rows->0->>'activity'='First' and rows->1->>'activity'='Second' from instructor_plans where class_id='60000000-0000-0000-0000-000000000001' and week='2026-10-05'),'row ordering and four columns persist');
select pg_temp.denied($q$insert into instructor_plans(session_id,class_id,week,rows,updated_by) values('20000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000001','2026-10-06','[]',auth.uid())$q$,'non-Monday denied');
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
