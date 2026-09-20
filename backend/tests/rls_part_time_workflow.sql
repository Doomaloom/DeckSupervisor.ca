-- Included inside rls.sql's rollback-only test transaction. Match application
-- payloads, including RETURNING and repeated saves, as the real part-time role.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000002"}', true);

with saved as (
  insert into public.profiles(id,email,first_name,last_name,location)
  values (auth.uid(),'user02@example.invalid','Part-time','QA','Pool')
  on conflict (id) do update set first_name=excluded.first_name,last_name=excluded.last_name,location=excluded.location
  returning id
) select pg_temp.assert_true((select count(*)=1 from saved),'profile upsert returns own row');

insert into public.sessions(id,created_by,team_id,session_day,session_season,session_year,instructors)
values ('21000000-0000-0000-0000-000000000001',auth.uid(),'10000000-0000-0000-0000-000000000001','Mo','Fall',2026,'[{"id":"instructor","name":"QA Instructor"}]');
insert into public.sessions(id,created_by,session_day) values ('21000000-0000-0000-0000-000000000002',auth.uid(),'Tu');
with saved as (
  insert into public.schematics(session_id,created_by,data)
  values ('21000000-0000-0000-0000-000000000001',auth.uid(),'{"codes":["CLASS-QA"],"instructors":["QA Instructor"]}')
  on conflict(session_id) do update set created_by=excluded.created_by,data=excluded.data,updated_at=now()
  returning id
) select pg_temp.assert_true((select count(*)=1 from saved),'first schematic save returns row');
with saved as (
  insert into public.schematics(session_id,created_by,data)
  values ('21000000-0000-0000-0000-000000000001',auth.uid(),'{"codes":["CLASS-QA"],"instructors":["QA Instructor 2"]}')
  on conflict(session_id) do update set session_id=excluded.session_id,created_by=excluded.created_by,data=excluded.data,updated_at=now()
  returning id
) select pg_temp.assert_true((select count(*)=1 from saved),'repeated schematic save returns row');

insert into public.custom_rosters(id,session_id,owner_id,day,service_name,source_codes,student_hashes)
values ('51000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001',auth.uid(),'Mo','Splash1','{CLASS-QA}','{synthetic-hash}');
select pg_temp.affects($q$update public.custom_rosters set session_id='21000000-0000-0000-0000-000000000001',service_name='Splash2A',updated_at=now() where id='51000000-0000-0000-0000-000000000001' returning id$q$,1,'custom roster repeated save works');

with saved as (
  insert into public.session_notes(id,session_id,created_by,note_type,text,done)
  values ('31000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001',auth.uid(),'todo','Synthetic task',false) returning id
) select pg_temp.assert_true((select count(*)=1 from saved),'todo creation returns row');
select pg_temp.affects($q$update public.session_notes set done=true where id='31000000-0000-0000-0000-000000000001' returning id$q$,1,'todo completion returns affected row');
with saved as (
  insert into public.session_reports(id,session_id,created_by,title,report_data)
  values ('31000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000001',auth.uid(),'QA report','{"staff":{}}') returning id
) select pg_temp.assert_true((select count(*)=1 from saved),'report creation returns row');
select pg_temp.affects($q$update public.session_reports set title='QA report saved',report_data='{"saved":true}',updated_at=now() where id='31000000-0000-0000-0000-000000000002' returning id$q$,1,'report autosave returns affected row');

insert into public.report_cards(session,day,instructor,number_of_report_cards,team_id,created_by)
values ('QA Fall 2026','Mo','QA Instructor',3,'10000000-0000-0000-0000-000000000001',auth.uid());
select pg_temp.affects($q$delete from public.report_cards where session='QA Fall 2026' and created_by=auth.uid() returning id$q$,1,'report-card resync clears own rows');
insert into public.report_cards(session,day,instructor,number_of_report_cards,team_id,created_by)
values ('QA Fall 2026','Mo','QA Instructor',4,'10000000-0000-0000-0000-000000000001',auth.uid());
select pg_temp.assert_true((select number_of_report_cards=4 from public.report_cards where session='QA Fall 2026'),'report-card resync persists totals');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000008"}', true);
select pg_temp.affects($q$update public.session_reports set title='Unauthorized' where id='31000000-0000-0000-0000-000000000002' returning id$q$,0,'outsider report update returns zero rows');
select pg_temp.affects($q$delete from public.session_notes where id='31000000-0000-0000-0000-000000000001' returning id$q$,0,'outsider todo delete returns zero rows');

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000002"}', true);
select pg_temp.affects($q$delete from public.session_reports where id='31000000-0000-0000-0000-000000000002' returning id$q$,1,'owner report delete returns row');
select pg_temp.affects($q$delete from public.sessions where id in ('21000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000002') returning id$q$,2,'owner deletes personal and team sessions');
select pg_temp.assert_true(not exists(select 1 from public.schematics where session_id='21000000-0000-0000-0000-000000000001'),'session deletion cascades schematics');
select pg_temp.assert_true(not exists(select 1 from public.custom_rosters where session_id='21000000-0000-0000-0000-000000000001'),'session deletion cascades custom rosters');
select pg_temp.assert_true(not exists(select 1 from public.session_notes where session_id='21000000-0000-0000-0000-000000000001'),'session deletion cascades notes');
delete from public.report_cards where session='QA Fall 2026' and created_by=auth.uid();
