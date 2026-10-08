\set ON_ERROR_STOP on
\ir ../supabase_roster_print_updates.sql
\ir ../supabase_roster_print_updates.sql
begin;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select * from sync_roster_class_hashes('20000000-0000-0000-0000-000000000001',
 jsonb_build_array(jsonb_build_object('code','A','roster_hash',repeat('a',64),'class_details',jsonb_build_object('code','A','serviceName','Splash 1'))),repeat('0',64));
select pg_temp.assert_true((select count(*)=1 from roster_class_hashes),'first upload saves baseline');
select pg_temp.assert_true((select count(*)=0 from roster_print_updates),'baseline has no updates');
select * from sync_roster_class_hashes('20000000-0000-0000-0000-000000000001',
 jsonb_build_array(jsonb_build_object('code','A','roster_hash',repeat('b',64),'class_details','{}'::jsonb)),repeat('0',64));
select pg_temp.assert_true((select count(*)=1 from roster_print_updates),'student change queues class');
create temporary table prior_revision as select code,revision from roster_print_updates;
select * from sync_roster_class_hashes('20000000-0000-0000-0000-000000000001',
 jsonb_build_array(jsonb_build_object('code','A','roster_hash',repeat('b',64),'class_details','{}'::jsonb)),repeat('0',64));
select pg_temp.assert_true((select count(*)=1 from roster_class_hashes),'hash codes remain unique');
select pg_temp.assert_true((select count(*)=1 from roster_print_updates),'queue codes remain unique');
select pg_temp.assert_true((select u.revision=p.revision from roster_print_updates u join prior_revision p using(code)),'unchanged reupload preserves pending revision');
select * from sync_roster_class_hashes('20000000-0000-0000-0000-000000000001',
 jsonb_build_array(jsonb_build_object('code','A','roster_hash',repeat('c',64),'class_details','{}'::jsonb),jsonb_build_object('code','B','roster_hash',repeat('b',64),'class_details','{}'::jsonb)),repeat('0',64));
select pg_temp.assert_true((select count(*)=2 from roster_print_updates),'changed and new classes queued');
select pg_temp.assert_true(resolve_roster_print_updates('20000000-0000-0000-0000-000000000001',(select jsonb_agg(to_jsonb(p)) from prior_revision p))='[]'::jsonb,'stale print or dismiss cannot clear newer upload');
select pg_temp.assert_true(jsonb_array_length(resolve_roster_print_updates('20000000-0000-0000-0000-000000000001',(select jsonb_agg(jsonb_build_object('code',code,'revision',revision)) from roster_print_updates)))=2,'print/dismiss clears current versions');
select pg_temp.assert_true((select count(*)=2 from roster_class_hashes),'acknowledgement retains baseline hashes');
select * from sync_roster_class_hashes('20000000-0000-0000-0000-000000000001',
 jsonb_build_array(jsonb_build_object('code','A','roster_hash',repeat('c',64),'class_details','{}'::jsonb),jsonb_build_object('code','B','roster_hash',repeat('b',64),'class_details','{}'::jsonb)),repeat('0',64));
select pg_temp.assert_true((select count(*)=0 from roster_print_updates),'unchanged upload after dismissal stays clear');
select * from sync_roster_class_hashes('20000000-0000-0000-0000-000000000001','[]'::jsonb,repeat('0',64));
select pg_temp.assert_true((select count(*)=2 from roster_print_updates),'removed classes queue empty sheets');
select pg_temp.assert_true((select bool_and(roster_hash=repeat('0',64)) from roster_class_hashes),'removed students become empty baseline');
do $$begin
 begin
  perform sync_roster_class_hashes('20000000-0000-0000-0000-000000000001',jsonb_build_array(jsonb_build_object('code','A','roster_hash',repeat('d',64),'class_details','{}'::jsonb),jsonb_build_object('code','A','roster_hash',repeat('e',64),'class_details','{}'::jsonb)),repeat('0',64));
  raise exception 'Duplicate course codes accepted';
 exception when check_violation then null;
 end;
end $$;
select pg_temp.assert_true((select bool_and(roster_hash=repeat('0',64)) from roster_class_hashes),'invalid upload rolled back');
select pg_temp.denied($q$delete from roster_print_updates$q$,'direct queue mutations denied');
select pg_temp.denied($q$update roster_class_hashes set roster_hash=repeat('d',64)$q$,'direct baseline mutations denied');

-- Same code in another session is a different class; it must not collide.
select * from sync_roster_class_hashes('20000000-0000-0000-0000-000000000002',jsonb_build_array(jsonb_build_object('code','A','roster_hash',repeat('d',64),'class_details','{}'::jsonb)),repeat('0',64));
select pg_temp.assert_true((select count(*)=3 from roster_class_hashes),'hash identity includes session');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000007","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*)=0 from roster_print_updates),'unrelated user cannot read queue');
select pg_temp.denied($q$select resolve_roster_print_updates('20000000-0000-0000-0000-000000000001','[]'::jsonb)$q$,'unrelated user cannot acknowledge');
select pg_temp.denied($q$select sync_roster_class_hashes('20000000-0000-0000-0000-000000000001','[]'::jsonb,repeat('0',64))$q$,'unrelated user cannot upload');
-- Read-only coverage can print/dismiss but cannot change upload baselines.
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*)=2 from roster_print_updates),'current coverage can read updates');
select pg_temp.denied($q$select sync_roster_class_hashes('20000000-0000-0000-0000-000000000001','[]'::jsonb,repeat('0',64))$q$,'read-only coverage cannot change baseline');
select pg_temp.assert_true(jsonb_array_length(resolve_roster_print_updates('20000000-0000-0000-0000-000000000001',(select jsonb_agg(jsonb_build_object('code',code,'revision',revision)) from roster_print_updates)))=2,'coverage can clear printed classes');
-- Full-time team staff may track uploads for existing team sessions.
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000006","role":"authenticated"}',true);
select * from sync_roster_class_hashes('20000000-0000-0000-0000-000000000001',jsonb_build_array(jsonb_build_object('code','A','roster_hash',repeat('f',64),'class_details','{}'::jsonb)),repeat('0',64));
select pg_temp.assert_true((select count(*)=1 from roster_print_updates),'team staff upload tracks only changed class');
reset role;
set role anon;
select pg_temp.denied($q$select * from roster_print_updates$q$,'anonymous queue read denied');
select pg_temp.denied($q$select sync_roster_class_hashes('20000000-0000-0000-0000-000000000001','[]'::jsonb,repeat('0',64))$q$,'anonymous sync denied');
reset role;
rollback;
