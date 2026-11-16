\set ON_ERROR_STOP on
\ir ../supabase_results_sync.sql
\ir ../supabase_results_sync.sql
begin;
-- All participant identifiers below are synthetic and no names enter result storage.
insert into public.session_instructors(session_id,id,name,account_id,position) values('20000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000009','','00000000-0000-0000-0000-000000000007',99);
insert into public.instructor_assignments(session_id,id,name,account_id,instructor_id) values('20000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000009','','00000000-0000-0000-0000-000000000007','50000000-0000-0000-0000-000000000009');
insert into public.instructor_classes(id,session_id,assignment_id,code,level,start_time,end_time) values('60000000-0000-0000-0000-000000000009','20000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000009','RESULT-QA','LittleSplash1','09:00','09:30');
create function pg_temp.result_op(n integer,base integer default 0) returns jsonb language sql as $$select jsonb_build_object('operationId','70000000-0000-0000-0000-'||lpad(n::text,12,'0'),'sessionId','20000000-0000-0000-0000-000000000004','datasetId','decksupervisor:80000000-0000-0000-0000-000000000001','classId','60000000-0000-0000-0000-000000000009','enrollmentId','90000000-0000-0000-0000-000000000001','recordId','attendance:90000000-0000-0000-0000-000000000001:2026-10-05','kind','attendance','action','upsert','baseRevision',base,'lessonDate','2026-10-05','curriculumVersion','templates-b50c7f987e101b7e','payload',jsonb_build_object('status','present'))$$;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select result_registry('20000000-0000-0000-0000-000000000004',jsonb_build_object('schemaVersion',1,'sessionId','20000000-0000-0000-0000-000000000004','datasetId','decksupervisor:80000000-0000-0000-0000-000000000001','courses',jsonb_build_array(jsonb_build_object('sourceId','course-stable-id','classId','60000000-0000-0000-0000-000000000009','instructorId','50000000-0000-0000-0000-000000000009','lessonDates',jsonb_build_array('2026-10-05'),'swimmers',jsonb_build_array(jsonb_build_object('sourceId','swimmer-stable-id','enrollmentId','90000000-0000-0000-0000-000000000001','matchKey',repeat('a',64)))))));
select pg_temp.assert_true(result_registry('20000000-0000-0000-0000-000000000004')->'courses'->0->>'sourceId'='course-stable-id','browser source IDs preserved');
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(1))->>'status'='accepted','first operation accepted');
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(1))->>'status'='already_accepted','idempotent retry');
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(1)||'{"payload":{"status":"absent"}}')->>'status'='rejected','changed operation reuse denied');
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(2))->>'status'='pending_review','stale revision durable conflict');
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(2))->>'status'='pending_review','conflict retry durable');
select pg_temp.assert_true(jsonb_array_length(result_snapshot('20000000-0000-0000-0000-000000000004')->'conflicts')=1,'one conflict immutable');
select result_admin('20000000-0000-0000-0000-000000000004','resolve',jsonb_build_object('id',result_snapshot('20000000-0000-0000-0000-000000000004')->'conflicts'->0->>'id','choice','incoming'));
select pg_temp.assert_true((result_snapshot('20000000-0000-0000-0000-000000000004')->'records'->0->>'revision')::int=2,'supervisor resolution new revision');
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(3,2)||'{"action":"delete","payload":{}}')->>'status'='accepted','delete tombstone accepted');
select pg_temp.assert_true((result_snapshot('20000000-0000-0000-0000-000000000004')->'records'->0->>'deleted')::boolean,'tombstone present');
select pg_temp.assert_true(jsonb_array_length(result_snapshot('20000000-0000-0000-0000-000000000004')->'history')=3,'revision history retained');
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(4,3)||'{"payload":{"status":"present","name":"DO-NOT-PERSIST"}}')->>'status'='rejected','PII payload rejected');
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(5,0)||'{"kind":"attempt","recordId":"a0000000-0000-0000-0000-000000000001","payload":{"skillId":"LittleSplash1:1","createdAt":"2026-10-05T09:00:00Z","submittedAt":"2026-10-05T09:01:00Z","results":[{"subskillId":"LittleSplash1:1:1","status":"successful"}]}}')->>'status'='rejected','partial criteria cannot inflate success');
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(6,0)||'{"kind":"attempt","recordId":"a0000000-0000-0000-0000-000000000001","payload":{"skillId":"LittleSplash1:1","createdAt":"2026-10-05T09:00:00Z","submittedAt":"2026-10-05T09:01:00Z","results":[{"subskillId":"LittleSplash1:1:1","status":"successful"},{"subskillId":"LittleSplash1:1:2","status":"not_yet"}]}}')->>'status'='accepted','complete criteria accepted');
select pg_temp.assert_true(not (result_snapshot('20000000-0000-0000-0000-000000000004')->'records'->0->>'success')::boolean,'server computes not-yet success');
select result_registry('20000000-0000-0000-0000-000000000004',jsonb_build_object('courseId','course-stable-id','swimmerId','swimmer-stable-id','enrollmentId','90000000-0000-0000-0000-000000000001','matchKey',repeat('b',64)),true);
select pg_temp.assert_true(jsonb_array_length(result_registry('20000000-0000-0000-0000-000000000004')->'courses'->0->'swimmers'->0->'matchKeys')=2,'explicit alias retained');
select pg_temp.denied($q$select * from public.result_records$q$,'direct result table denied');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000008","role":"authenticated"}',true);
select pg_temp.denied($q$select result_snapshot('20000000-0000-0000-0000-000000000004')$q$,'unassigned cannot read');
select pg_temp.denied($q$select result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(7,3))$q$,'unassigned cannot correct');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000007","role":"authenticated"}',true);
select pg_temp.assert_true(jsonb_array_length(result_snapshot('20000000-0000-0000-0000-000000000004')->'records')=2,'assigned instructor reads scope');
select pg_temp.denied($q$select result_admin('20000000-0000-0000-0000-000000000004','grants')$q$,'instructor cannot administer grants');
reset role;
set role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select result_mint('20000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002',jsonb_build_object('datasetId','decksupervisor:80000000-0000-0000-0000-000000000001','instructorId','50000000-0000-0000-0000-000000000009','uploadHash',encode(sha256(convert_to('upload-secret','UTF8')),'hex'),'readHash',encode(sha256(convert_to('read-secret','UTF8')),'hex'),'courses',jsonb_build_array(jsonb_build_object('sourceId','course-stable-id','classId','60000000-0000-0000-0000-000000000009','swimmers',jsonb_build_array(jsonb_build_object('sourceId','swimmer-stable-id','enrollmentId','90000000-0000-0000-0000-000000000001'))))));
select pg_temp.assert_true(jsonb_array_length(result_snapshot(null,null,'read-secret')->'records')=2,'read capability scoped');
select pg_temp.denied($q$select result_snapshot(null,null,'upload-secret')$q$,'upload capability cannot read');
select pg_temp.denied($q$select result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(7,3),'read-secret')$q$,'read capability cannot write');
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(7,3),'upload-secret')->>'status'='accepted','upload capability accepted');
reset role;
select pg_temp.assert_true(not exists(select 1 from result_operations where operation::text like '%DO-NOT-PERSIST%'),'rejected PII not stored');
update result_grants set read_expires_at=now()-interval '1 second';
set role service_role;
select pg_temp.denied($q$select result_snapshot(null,null,'read-secret')$q$,'read expires separately');
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(7,3),'upload-secret')->>'status'='already_accepted','upload survives read expiration');
select pg_temp.denied($q$select result_apply('20000000-0000-0000-0000-000000000003',pg_temp.result_op(7,3),'upload-secret')$q$,'upload capability cannot cross sessions even for an accepted operation');
reset role;
update result_grants set expires_at=now()-interval '1 second';
set role service_role;
select pg_temp.denied($q$select result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(7,3),'upload-secret')$q$,'expired upload capability cannot replay an accepted operation');
reset role;
update result_grants set expires_at=now()+interval '30 days';
set role service_role;
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(7,3),'upload-secret')->>'status'='already_accepted','authorization failures preserve the original durable receipt');
reset role;
alter table instructor_assignments disable trigger assignment_roster_guard;
update instructor_assignments set instructor_id='50000000-0000-0000-0000-000000000001' where id='50000000-0000-0000-0000-000000000009';
alter table instructor_assignments enable trigger assignment_roster_guard;
set role service_role;
select pg_temp.denied($q$select result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(7,3),'upload-secret')$q$,'reassignment invalidates even duplicate receipt');
reset role;
alter table instructor_assignments disable trigger assignment_roster_guard;
update instructor_assignments set instructor_id='50000000-0000-0000-0000-000000000009' where id='50000000-0000-0000-0000-000000000009';
update result_grants set revoked=true;
alter table instructor_assignments enable trigger assignment_roster_guard;
set role service_role;
select pg_temp.denied($q$select result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(7,3),'upload-secret')$q$,'revocation checked on retry');
reset role;

-- A fingerprint cannot silently rebind to a different swimmer.
insert into public.result_enrollments values('20000000-0000-0000-0000-000000000004','course-stable-id','second-source','90000000-0000-0000-0000-000000000002',true);
set role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
do $$ declare rejected boolean:=false; begin
 begin perform result_registry('20000000-0000-0000-0000-000000000004',jsonb_build_object('courseId','course-stable-id','swimmerId','second-source','enrollmentId','90000000-0000-0000-0000-000000000002','matchKey',repeat('a',64)),true); exception when unique_violation then rejected:=true; end;
 perform pg_temp.assert_true(rejected,'alias collision never silently accepted');
end $$;
reset role;
-- Benchmark timing is validated independently of client-computed criterion success.
create function pg_temp.timed_op(skill text,elapsed bigint,laps int default 4) returns jsonb language sql as $$
 select pg_temp.result_op(20,0)||jsonb_build_object('recordId','a0000000-0000-0000-0000-000000000002','kind','attempt','payload',jsonb_build_object('skillId',skill,'createdAt','2026-10-05T09:00:00Z','submittedAt','2026-10-05T09:01:00Z','results',(select jsonb_agg(jsonb_build_object('subskillId',value,'status','successful')) from result_curriculum,jsonb_array_elements_text(criteria) where skill_id=skill and version='templates-b50c7f987e101b7e'),'timed',jsonb_build_object('lapsRequired',4,'lapsCompleted',laps,'elapsedMs',elapsed)))
$$;
select pg_temp.assert_true(result_validate(pg_temp.timed_op('Splash7:10',180000),'20000000-0000-0000-0000-000000000004'),'benchmark exact time limit succeeds');
select pg_temp.assert_true(not result_validate(pg_temp.timed_op('Splash7:10',180001),'20000000-0000-0000-0000-000000000004'),'over-limit benchmark cannot succeed');
select pg_temp.assert_true(not result_validate(pg_temp.timed_op('Splash8:9',360001),'20000000-0000-0000-0000-000000000004'),'second benchmark time enforced');
select pg_temp.assert_true(not result_validate(pg_temp.timed_op('Splash9:11',540001),'20000000-0000-0000-0000-000000000004'),'third benchmark time enforced');
select pg_temp.assert_true(not result_validate(pg_temp.timed_op('Splash7:10',100000,3),'20000000-0000-0000-0000-000000000004'),'incomplete laps cannot succeed');
do $$ declare rejected boolean:=false; begin
 begin perform result_validate(pg_temp.timed_op('Splash7:10',100000,5),'20000000-0000-0000-0000-000000000004'); exception when others then rejected:=true; end;
 perform pg_temp.assert_true(rejected,'excess laps rejected');
 rejected:=false;
 begin perform result_validate(pg_temp.timed_op('LittleSplash1:1',100000),'20000000-0000-0000-0000-000000000004'); exception when others then rejected:=true; end;
 perform pg_temp.assert_true(rejected,'nonbenchmark timing rejected');
end $$;
-- The accepted attendance is now revision 4. A third edit requires fresh conflict review.
set role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(8,0))->>'status'='pending_review','second stale edit pending');
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(9,4))->>'status'='accepted','third concurrent edit accepted');
do $$ declare rejected boolean:=false; cid uuid; begin
 select (value->>'id')::uuid into cid from jsonb_array_elements(result_snapshot('20000000-0000-0000-0000-000000000004')->'conflicts') where value->'operation'->>'operationId'='70000000-0000-0000-0000-000000000008';
 begin perform result_admin('20000000-0000-0000-0000-000000000004','resolve',jsonb_build_object('id',cid,'choice','incoming','expectedRevision',4)); exception when others then rejected:=true; end;
 perform pg_temp.assert_true(rejected,'stale reviewer cannot overwrite third edit');
 perform result_admin('20000000-0000-0000-0000-000000000004','resolve',jsonb_build_object('id',cid,'choice','incoming','expectedRevision',5));
end $$;
reset role;
update result_enrollments set active=false;
set role authenticated;
select pg_temp.assert_true(not (result_registry('20000000-0000-0000-0000-000000000004')->'courses'->0->'swimmers'->0->>'active')::boolean,'inactive enrollment remains inspectable');
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(10,6))->>'status'='accepted','historical existing record correctable');
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(11)||'{"kind":"attempt","recordId":"a0000000-0000-0000-0000-000000000003","payload":{"skillId":"LittleSplash1:1","createdAt":"2026-10-05T09:00:00Z","submittedAt":"2026-10-05T09:01:00Z","results":[{"subskillId":"LittleSplash1:1:1","status":"successful"},{"subskillId":"LittleSplash1:1:2","status":"successful"}]}}')->>'status'='rejected','inactive enrollment rejects new records');
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(12,1)||'{"kind":"attempt","recordId":"a0000000-0000-0000-0000-000000000001","payload":{"skillId":"LittleSplash1:1","createdAt":"2026-10-05T08:00:00Z","submittedAt":"2026-10-05T09:01:00Z","results":[{"subskillId":"LittleSplash1:1:1","status":"successful"},{"subskillId":"LittleSplash1:1:2","status":"successful"}]}}')->>'status'='rejected','attempt creation identity immutable');
reset role;
-- Owner privilege loss invalidates grants even if its source assignment stays active.
update result_grants set revoked=false;
alter table sessions disable trigger all;
update sessions set created_by='00000000-0000-0000-0000-000000000003' where id='20000000-0000-0000-0000-000000000004';
alter table sessions enable trigger all;
set role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select pg_temp.denied($q$select result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(7,3),'upload-secret')$q$,'creator permission loss revokes old capability');
reset role;
rollback;
