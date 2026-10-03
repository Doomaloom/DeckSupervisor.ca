-- TEST ONLY: follows rls.sql in the same disposable database connection.
\set ON_ERROR_STOP on
\ir ../supabase_instructor.sql
\ir ../supabase_instructor.sql
begin;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select save_instructor_schematic('20000000-0000-0000-0000-000000000004',
 '{"assignmentIds":["50000000-0000-0000-0000-000000000001"],"codes":["A"],"instructors":["Alex"],"assignments":[{"id":"50000000-0000-0000-0000-000000000001","name":"Alex","classes":[{"code":"A","level":"Swimmer 1","start_time":"09:00","end_time":"09:30"}]}]}');
update instructor_assignments set account_id='00000000-0000-0000-0000-000000000007' where session_id='20000000-0000-0000-0000-000000000004';
select pg_temp.assert_true((select count(*)=1 from instructor_classes where code='A'),'owner persisted metadata');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000007","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*)=1 from instructor_classes),'linked class visible');
select pg_temp.assert_true((select count(*)=1 from instructor_sessions()),'linked context visible');
select pg_temp.assert_true((select count(*)=0 from schematics where session_id='20000000-0000-0000-0000-000000000004'),'link grants no schematic');
select pg_temp.assert_true((select count(*)=0 from sessions where id='20000000-0000-0000-0000-000000000004'),'link grants no session');
select pg_temp.affects('update instructor_assignments set account_id=null',0,'instructor cannot unlink');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000008","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*)=0 from instructor_classes),'unlinked metadata hidden');
select pg_temp.assert_true((select count(*)=0 from instructor_sessions()),'unlinked contexts hidden');
reset role;
rollback;
