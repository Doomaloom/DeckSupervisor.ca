\set ON_ERROR_STOP on
-- Simulate legacy duplicate columns, a full-time link and an existing plan before upgrade.
begin;
insert into public.instructor_assignments(session_id,id,name,account_id) values
 ('20000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000001','Alex','00000000-0000-0000-0000-000000000007'),
 ('20000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000002','Alex','00000000-0000-0000-0000-000000000008');
alter table public.instructor_assignments disable trigger instructor_account_link_guard;
insert into public.instructor_assignments(session_id,id,name,account_id) values
 ('20000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000003','Legacy','00000000-0000-0000-0000-000000000001');
alter table public.instructor_assignments enable trigger instructor_account_link_guard;
insert into public.instructor_classes(id,session_id,assignment_id,code,level,start_time,end_time) values
 ('60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000001','A','Swimmer 1','09:00','09:30');
update public.sessions set session_day='Mo',start_date='2026-10-05',end_date='2026-10-26',instructors='[{"name":"Alex"},{"name":"Legacy"},{"name":"Unscheduled"}]' where id='20000000-0000-0000-0000-000000000004';
insert into public.instructor_plans(session_id,class_id,week,updated_by,rows) values
 ('20000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000001','2026-10-05','00000000-0000-0000-0000-000000000007','[]');
update public.schematics set data='{"assignmentIds":["50000000-0000-0000-0000-000000000001","50000000-0000-0000-0000-000000000002","50000000-0000-0000-0000-000000000003"],"codes":["A","",""],"instructors":["Alex","Alex","Legacy"]}' where session_id='20000000-0000-0000-0000-000000000004';
commit;
\ir ../supabase_session_instructors.sql
create temporary table roster_snapshot as select to_jsonb(i) row from public.session_instructors i;
\ir ../supabase_session_instructors.sql
select pg_temp.assert_true(not exists((select row from roster_snapshot except select to_jsonb(i) from session_instructors i) union (select to_jsonb(i) from session_instructors i except select row from roster_snapshot)), 'roster migration repeat preserves all rows');
begin;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*)=5 from session_instructor_roster('20000000-0000-0000-0000-000000000004')), 'migration preserves duplicate names and unmatched names');
select pg_temp.assert_true((select account_id='00000000-0000-0000-0000-000000000007' from session_instructor_roster('20000000-0000-0000-0000-000000000004') where id='50000000-0000-0000-0000-000000000001'), 'migration preserves linked identity');
select save_session_with_instructors('20000000-0000-0000-0000-000000000004','{"location":"Updated pool"}',
 '[{"id":"50000000-0000-0000-0000-000000000001","name":"Renamed Alex","account_id":"00000000-0000-0000-0000-000000000007"},{"id":"50000000-0000-0000-0000-000000000003","name":"Legacy","account_id":"00000000-0000-0000-0000-000000000001"},{"id":"50000000-0000-0000-0000-000000000004","name":"","account_id":null}]');
select pg_temp.assert_true((select name='Renamed Alex' from instructor_assignments where id='50000000-0000-0000-0000-000000000001'), 'rename updates linked columns');
select pg_temp.assert_true((select jsonb_array_length(instructors)=3 from sessions where id='20000000-0000-0000-0000-000000000004'), 'blank roster row persists');
select pg_temp.assert_true((select data->'instructors'->>0='Renamed Alex' from schematics where session_id='20000000-0000-0000-0000-000000000004'), 'rename updates stored print data');
select save_instructor_schematic('20000000-0000-0000-0000-000000000004',
 '{"assignmentIds":["50000000-0000-0000-0000-000000000001","50000000-0000-0000-0000-000000000003"],"codes":["A",""],"assignments":[{"id":"50000000-0000-0000-0000-000000000001","instructor_id":"50000000-0000-0000-0000-000000000001","classes":[{"code":"A","level":"Swimmer 1","start_time":"09:00","end_time":"09:30"}]},{"id":"50000000-0000-0000-0000-000000000003","instructor_id":"50000000-0000-0000-0000-000000000003","classes":[]}]}');
select pg_temp.assert_true((select id='60000000-0000-0000-0000-000000000001' from instructor_classes where code='A'), 'schematic save keeps class identity');
do $$ begin
 begin
  perform save_session_with_instructors('20000000-0000-0000-0000-000000000004','{"location":"Should roll back"}',
   '[{"id":"50000000-0000-0000-0000-000000000001","name":"Invalid","account_id":"00000000-0000-0000-0000-000000000005"}]');
  raise exception 'FAIL full-time account accepted';
 exception when check_violation then null; end;
end $$;
select pg_temp.assert_true((select location='Updated pool' from sessions where id='20000000-0000-0000-0000-000000000004'), 'invalid roster rolls back details');
select save_session_with_instructors('20000000-0000-0000-0000-000000000004','{}','[]');
select pg_temp.assert_true((select jsonb_array_length(instructors)=0 from sessions where id='20000000-0000-0000-0000-000000000004'), 'zero instructor count persists');
select pg_temp.assert_true((select name='' and account_id is null and instructor_id is null and active from instructor_assignments where id='50000000-0000-0000-0000-000000000001'), 'removal leaves unnamed active timetable column');
select pg_temp.assert_true((select data->'codes'->>0='A' and data->'instructorIds'->0='null'::jsonb from schematics where session_id='20000000-0000-0000-0000-000000000004'), 'removal retains class positions');
do $$ begin
 begin
  perform save_instructor_schematic('20000000-0000-0000-0000-000000000004','{"assignments":[{"id":"50000000-0000-0000-0000-000000000001","instructor_id":"50000000-0000-0000-0000-000000000001","classes":[]}]}');
  raise exception 'FAIL stale schematic accepted';
 exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000007","role":"authenticated"}',true);
select pg_temp.assert_true(not can_plan_class('20000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000001','2026-10-05'), 'removal revokes old account access');
select pg_temp.assert_true((select count(*)=0 from session_instructor_roster('20000000-0000-0000-0000-000000000004')), 'instructor cannot read owner roster');
select pg_temp.denied($q$select save_session_with_instructors('20000000-0000-0000-0000-000000000004','{}','[]')$q$,'instructor cannot save session roster');
reset role;
select pg_temp.assert_true((select count(*)=1 from instructor_plans where class_id='60000000-0000-0000-0000-000000000001'), 'removal retains saved plan');
set role anon;
select pg_temp.denied($q$select * from session_instructor_roster('20000000-0000-0000-0000-000000000004')$q$,'anonymous roster denied');
reset role;
rollback;
