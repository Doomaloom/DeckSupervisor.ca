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
select pg_temp.assert_true(jsonb_array_length(result_snapshot('20000000-0000-0000-0000-000000000004')::jsonb->'conflicts')=1,'one conflict immutable');
select result_admin('20000000-0000-0000-0000-000000000004','resolve',jsonb_build_object('id',result_snapshot('20000000-0000-0000-0000-000000000004')::jsonb->'conflicts'->0->>'id','choice','incoming'));
select pg_temp.assert_true((result_snapshot('20000000-0000-0000-0000-000000000004')::jsonb->'records'->0->>'revision')::int=2,'supervisor resolution new revision');
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(3,2)||'{"action":"delete","payload":{}}')->>'status'='accepted','delete tombstone accepted');
select pg_temp.assert_true((result_snapshot('20000000-0000-0000-0000-000000000004')::jsonb->'records'->0->>'deleted')::boolean,'tombstone present');
select pg_temp.assert_true(jsonb_array_length(result_snapshot('20000000-0000-0000-0000-000000000004')::jsonb->'history')=3,'revision history retained');
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(4,3)||'{"payload":{"status":"present","name":"DO-NOT-PERSIST"}}')->>'status'='rejected','PII payload rejected');
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(5,0)||'{"kind":"attempt","recordId":"a0000000-0000-0000-0000-000000000001","payload":{"skillId":"LittleSplash1:1","createdAt":"2026-10-05T09:00:00Z","submittedAt":"2026-10-05T09:01:00Z","results":[{"subskillId":"LittleSplash1:1:1","status":"successful"}]}}')->>'status'='rejected','partial criteria cannot inflate success');
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(6,0)||'{"kind":"attempt","recordId":"a0000000-0000-0000-0000-000000000001","payload":{"skillId":"LittleSplash1:1","createdAt":"2026-10-05T09:00:00Z","submittedAt":"2026-10-05T09:01:00Z","results":[{"subskillId":"LittleSplash1:1:1","status":"successful"},{"subskillId":"LittleSplash1:1:2","status":"not_yet"}]}}')->>'status'='accepted','complete criteria accepted');
select pg_temp.assert_true(not (result_snapshot('20000000-0000-0000-0000-000000000004')::jsonb->'records'->0->>'success')::boolean,'server computes not-yet success');
select result_registry('20000000-0000-0000-0000-000000000004',jsonb_build_object('courseId','course-stable-id','swimmerId','swimmer-stable-id','enrollmentId','90000000-0000-0000-0000-000000000001','matchKey',repeat('b',64)),true);
select pg_temp.assert_true(jsonb_array_length(result_registry('20000000-0000-0000-0000-000000000004')->'courses'->0->'swimmers'->0->'matchKeys')=2,'explicit alias retained');
select pg_temp.denied($q$select * from public.result_records$q$,'direct result table denied');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000008","role":"authenticated"}',true);
select pg_temp.denied($q$select result_snapshot('20000000-0000-0000-0000-000000000004')::jsonb$q$,'unassigned cannot read');
select pg_temp.denied($q$select result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(7,3))$q$,'unassigned cannot correct');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000007","role":"authenticated"}',true);
select pg_temp.assert_true(jsonb_array_length(result_snapshot('20000000-0000-0000-0000-000000000004')::jsonb->'records')=2,'assigned instructor reads scope');
select pg_temp.denied($q$select result_admin('20000000-0000-0000-0000-000000000004','grants')$q$,'instructor cannot administer grants');
reset role;
set role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select result_mint('20000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002',jsonb_build_object('datasetId','decksupervisor:80000000-0000-0000-0000-000000000001','instructorId','50000000-0000-0000-0000-000000000009','uploadHash',encode(sha256(convert_to('upload-secret','UTF8')),'hex'),'readHash',encode(sha256(convert_to('read-secret','UTF8')),'hex'),'courses',jsonb_build_array(jsonb_build_object('sourceId','course-stable-id','classId','60000000-0000-0000-0000-000000000009','swimmers',jsonb_build_array(jsonb_build_object('sourceId','swimmer-stable-id','enrollmentId','90000000-0000-0000-0000-000000000001'))))));
select pg_temp.assert_true(jsonb_array_length(result_snapshot(null,null,'read-secret')::jsonb->'records')=2,'read capability scoped');
select pg_temp.denied($q$select result_snapshot(null,null,'upload-secret')::jsonb$q$,'upload capability cannot read');
select pg_temp.denied($q$select result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(7,3),'read-secret')$q$,'read capability cannot write');
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.result_op(7,3),'upload-secret')->>'status'='accepted','upload capability accepted');
reset role;
select pg_temp.assert_true(not exists(select 1 from result_operations where operation::text like '%DO-NOT-PERSIST%'),'rejected PII not stored');
update result_grants set read_expires_at=now()-interval '1 second';
set role service_role;
select pg_temp.denied($q$select result_snapshot(null,null,'read-secret')::jsonb$q$,'read expires separately');
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
 select (value->>'id')::uuid into cid from jsonb_array_elements(result_snapshot('20000000-0000-0000-0000-000000000004')::jsonb->'conflicts') where value->'operation'->>'operationId'='70000000-0000-0000-0000-000000000008';
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

-- ===========================================================================
-- Completion audit (requirement-by-requirement). Fresh fixture: two instructors
-- (A account ...07, B account ...08), classes 1 and 3 for A, class 2 for B.
-- Every identifier is synthetic. 'DO-NOT-PERSIST' marks text that must never
-- reach result storage.
-- ===========================================================================
begin;
create function pg_temp.sid() returns uuid language sql immutable as $$select '20000000-0000-0000-0000-000000000004'::uuid$$;
create function pg_temp.ds() returns text language sql immutable as $$select 'decksupervisor:80000000-0000-0000-0000-0000000000a1'$$;
create function pg_temp.ins(n int) returns uuid language sql immutable as $$select ('50000000-0000-0000-0000-0000000000a'||n)::uuid$$;
create function pg_temp.cls(n int) returns uuid language sql immutable as $$select ('60000000-0000-0000-0000-0000000000a'||n)::uuid$$;
create function pg_temp.enr(n int) returns uuid language sql immutable as $$select ('90000000-0000-0000-0000-0000000000a'||n)::uuid$$;
create function pg_temp.rec(n int) returns text language sql immutable as $$select 'a1000000-0000-0000-0000-'||lpad(n::text,12,'0')$$;
create function pg_temp.arec(e int,d text default '2026-10-05') returns text language sql immutable as $$select 'attendance:'||pg_temp.enr(e)||':'||d$$;
-- who: 'postgres', 'service', 'anon', or the last digits of a synthetic user id.
create function pg_temp.act(who text) returns void language plpgsql as $$
begin
 if who='postgres' then perform set_config('role','none',true);
 elsif who='service' then perform set_config('role','service_role',true); perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 elsif who='anon' then perform set_config('role','anon',true); perform set_config('request.jwt.claims','{"role":"anon"}',true);
 else perform set_config('role','authenticated',true); perform set_config('request.jwt.claims',format('{"sub":"00000000-0000-0000-0000-%s","role":"authenticated"}',lpad(who,12,'0')),true);
 end if;
end $$;
-- Expect one specific validation failure (the raised message, or the SQLSTATE of
-- a constraint/cast error), so a typo or an authorization error cannot pass.
create function pg_temp.fails(statement text,label text,expect text) returns void language plpgsql as $$
declare outcome text:='none';
begin
 begin execute statement; exception when insufficient_privilege then outcome:='denied'; when others then outcome:=case when sqlstate='P0001' then sqlerrm else sqlstate end; end;
 if outcome is distinct from expect then raise exception 'FAIL (expected "%", got "%"): %',expect,outcome,label; end if;
 raise notice 'PASS: % [%]',label,outcome;
end $$;
create function pg_temp.op(n int,base int default 0,c int default 1,e int default 1,d text default '2026-10-05',extra jsonb default '{}') returns jsonb language sql as $$
 select jsonb_build_object('operationId','7a000000-0000-0000-0000-'||lpad(n::text,12,'0'),'sessionId',pg_temp.sid(),'datasetId',pg_temp.ds(),'classId',pg_temp.cls(c),'enrollmentId',pg_temp.enr(e),'recordId',pg_temp.arec(e,d),'kind','attendance','action','upsert','baseRevision',base,'lessonDate',d,'curriculumVersion','templates-b50c7f987e101b7e','payload',jsonb_build_object('status','present'))||extra $$;
create function pg_temp.ls(a text default 'successful',b text default 'successful',created text default '2026-10-05T09:00:00Z',skill text default 'LittleSplash1:1') returns jsonb language sql as $$
 select jsonb_build_object('skillId',skill,'createdAt',created,'submittedAt','2026-10-05T09:30:00Z','results',jsonb_build_array(jsonb_build_object('subskillId',skill||':1','status',a),jsonb_build_object('subskillId',skill||':2','status',b))) $$;
create function pg_temp.timed(elapsed bigint,laps int default 4,first text default 'successful') returns jsonb language sql as $$
 select jsonb_build_object('skillId','Splash7:10','createdAt','2026-10-05T09:00:00Z','submittedAt','2026-10-05T09:30:00Z','results',jsonb_build_array(jsonb_build_object('subskillId','Splash7:10:1','status',first),jsonb_build_object('subskillId','Splash7:10:2','status','successful'),jsonb_build_object('subskillId','Splash7:10:3','status','successful')),'timed',jsonb_build_object('lapsRequired',4,'lapsCompleted',laps,'elapsedMs',elapsed)) $$;
create function pg_temp.att(n int,base int,r int,payload jsonb,extra jsonb default '{}') returns jsonb language sql as $$
 select pg_temp.op(n,base,1,1,'2026-10-05',jsonb_build_object('kind','attempt','recordId',pg_temp.rec(r),'payload',payload)||extra) $$;
create function pg_temp.ap(o jsonb,token text default null) returns jsonb language sql as $$select public.result_apply(pg_temp.sid(),o,token)$$;
create function pg_temp.st(o jsonb,token text default null) returns text language sql as $$select public.result_apply(pg_temp.sid(),o,token)->>'status'$$;
create function pg_temp.snap(c int default null) returns jsonb language sql as $$select public.result_snapshot(pg_temp.sid(),case when c is null then null else pg_temp.cls(c) end)::jsonb$$;
create function pg_temp.one(record_id text) returns jsonb language sql as $$select r from jsonb_array_elements(pg_temp.snap()->'records') r where r->>'recordId'=record_id$$;
create function pg_temp.rev(record_id text) returns int language sql as $$select coalesce((pg_temp.one(record_id)->>'revision')::int,0)$$;
create function pg_temp.conflict(n int) returns jsonb language sql as $$select c from jsonb_array_elements(pg_temp.snap()->'conflicts') c where c->'operation'->>'operationId'='7a000000-0000-0000-0000-'||lpad(n::text,12,'0')$$;
create function pg_temp.resolve(n int,choice text,expected int default null) returns jsonb language sql as $$
 select public.result_admin(pg_temp.sid(),'resolve',jsonb_strip_nulls(jsonb_build_object('id',pg_temp.conflict(n)->>'id','choice',choice,'expectedRevision',expected)))$$;
create function pg_temp.sw(n int,e int,k text,active boolean default null) returns jsonb language sql as $$
 select jsonb_strip_nulls(jsonb_build_object('sourceId','audit-swimmer-'||n,'enrollmentId',pg_temp.enr(e),'matchKey',repeat(k,64),'active',active))$$;
create function pg_temp.course(n int,instr int,swimmers jsonb) returns jsonb language sql as $$
 select jsonb_build_object('sourceId','audit:course:'||n,'classId',pg_temp.cls(n),'instructorId',pg_temp.ins(instr),'lessonDates',jsonb_build_array('2026-10-05','2026-10-12'),'swimmers',swimmers)$$;
create function pg_temp.put(courses jsonb,extra jsonb default '{}') returns jsonb language sql as $$
 select public.result_registry(pg_temp.sid(),jsonb_build_object('schemaVersion',1,'sessionId',pg_temp.sid(),'datasetId',pg_temp.ds(),'courses',courses)||extra)$$;
create function pg_temp.reg() returns jsonb language sql as $$select public.result_registry(pg_temp.sid())$$;
create function pg_temp.swimmer(n int,e int) returns jsonb language sql as $$
 select s from jsonb_array_elements(pg_temp.reg()->'courses') c,jsonb_array_elements(c->'swimmers') s where c->>'sourceId'='audit:course:'||n and s->>'enrollmentId'=pg_temp.enr(e)::text$$;
create function pg_temp.reconcile(n int,s int,e int,k text,extra jsonb default '{}') returns jsonb language sql as $$
 select public.result_registry(pg_temp.sid(),jsonb_build_object('courseId','audit:course:'||n,'swimmerId','audit-swimmer-'||s,'enrollmentId',pg_temp.enr(e),'matchKey',k)||extra,true)$$;
create function pg_temp.mint(instr int,token text,courses jsonb,extra jsonb default '{}',creator int default 2) returns jsonb language sql as $$
 select public.result_mint(pg_temp.sid(),('00000000-0000-0000-0000-'||lpad(creator::text,12,'0'))::uuid,jsonb_build_object('datasetId',pg_temp.ds(),'instructorId',pg_temp.ins(instr),'uploadHash',encode(sha256(convert_to('audit-upload-'||token,'UTF8')),'hex'),'readHash',encode(sha256(convert_to('audit-read-'||token,'UTF8')),'hex'),'courses',courses)||extra)$$;
create function pg_temp.read(token text) returns jsonb language sql as $$select public.result_snapshot(null,null,'audit-read-'||token)::jsonb$$;

insert into public.session_instructors(session_id,id,name,account_id,position) values(pg_temp.sid(),pg_temp.ins(1),'','00000000-0000-0000-0000-000000000007',97),(pg_temp.sid(),pg_temp.ins(2),'','00000000-0000-0000-0000-000000000008',98);
insert into public.instructor_assignments(session_id,id,name,account_id,instructor_id) values(pg_temp.sid(),pg_temp.ins(1),'','00000000-0000-0000-0000-000000000007',pg_temp.ins(1)),(pg_temp.sid(),pg_temp.ins(2),'','00000000-0000-0000-0000-000000000008',pg_temp.ins(2));
insert into public.instructor_classes(id,session_id,assignment_id,code,level,start_time,end_time) values(pg_temp.cls(1),pg_temp.sid(),pg_temp.ins(1),'AUDIT-1','LittleSplash1','10:00','10:30'),(pg_temp.cls(2),pg_temp.sid(),pg_temp.ins(2),'AUDIT-2','LittleSplash1','10:00','10:30'),(pg_temp.cls(3),pg_temp.sid(),pg_temp.ins(1),'AUDIT-3','LittleSplash1','10:30','11:00');

-- ---- Identity registry ----------------------------------------------------
select pg_temp.act('2');
select pg_temp.assert_true(pg_temp.reg() is null,'registry GET is null (HTTP 404) before registration');
select pg_temp.assert_true((select bool_and((select array_agg(k order by k) from jsonb_object_keys(c) k)=array['code','id','instructorId']) and bool_or(c->>'id'=pg_temp.cls(1)::text and c->>'instructorId'=pg_temp.ins(1)::text and c->>'code'='AUDIT-1') from jsonb_array_elements(result_admin(pg_temp.sid(),'classes')->'classes') c),'result-classes returns only id/code/instructorId for active classes');
select pg_temp.act('7');
select pg_temp.denied($q$select pg_temp.reg()$q$,'assigned instructor cannot probe an unregistered registry');
select pg_temp.denied($q$select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,1,'1')))))$q$,'instructor cannot PUT the registry');
select pg_temp.denied($q$select result_admin(pg_temp.sid(),'classes')$q$,'result-classes is supervisor-only');
select pg_temp.act('2');
select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,1,'1'),pg_temp.sw(2,2,'2'))),pg_temp.course(2,2,jsonb_build_array(pg_temp.sw(3,3,'3')))));
select pg_temp.assert_true(pg_temp.reg()->>'datasetId'=pg_temp.ds() and jsonb_array_length(pg_temp.reg()->'courses')=2 and (pg_temp.reg()->>'schemaVersion')::int=1 and pg_temp.reg()->>'sessionId'=pg_temp.sid()::text,'supervisor reads the whole registered dataset');
select pg_temp.assert_true(pg_temp.swimmer(1,1)=jsonb_build_object('sourceId','audit-swimmer-1','enrollmentId',pg_temp.enr(1),'active',true,'matchKey',repeat('1',64),'matchKeys',jsonb_build_array(repeat('1',64))),'swimmer source ID, enrollment ID and opaque key preserved exactly, nothing else stored');
select pg_temp.act('7');
select pg_temp.assert_true(jsonb_array_length(pg_temp.reg()->'courses')=1 and pg_temp.reg()->'courses'->0->>'classId'=pg_temp.cls(1)::text,'instructor A reads only the actively assigned course');
select pg_temp.denied($q$select pg_temp.reconcile(1,1,1,repeat('b',64))$q$,'reconcile is supervisor-only');
select pg_temp.act('8');
select pg_temp.assert_true(jsonb_array_length(pg_temp.reg()->'courses')=1 and pg_temp.reg()->'courses'->0->>'classId'=pg_temp.cls(2)::text,'instructor B reads only the actively assigned course');
select pg_temp.act('9');
select pg_temp.denied($q$select pg_temp.reg()$q$,'unassigned account cannot read the registry');
select pg_temp.act('5');
select pg_temp.denied($q$select pg_temp.reg()$q$,'owner of a different session cannot read the registry');
select pg_temp.denied($q$select pg_temp.put('[]')$q$,'owner of a different session cannot replace the registry');
select pg_temp.act('2');
create temp table audit_registry on commit drop as select pg_temp.reg() as body;
grant select on audit_registry to authenticated;
select pg_temp.fails($q$select pg_temp.put('[]','{"datasetId":"decksupervisor:80000000-0000-0000-0000-0000000000ff"}')$q$,'dataset identity immutable','Dataset identity immutable');
select pg_temp.fails($q$select pg_temp.put('[]','{"sessionId":"20000000-0000-0000-0000-000000000003"}')$q$,'registry body must name the route session','Invalid registry');
select pg_temp.fails($q$select pg_temp.put('[]','{"exportedBy":"DO-NOT-PERSIST"}')$q$,'unknown registry field rejected','Invalid registry');
select pg_temp.fails($q$select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,'[]')||jsonb_build_object('classId',pg_temp.cls(3))))$q$,'course class identity immutable','Course identity immutable');
select pg_temp.fails($q$select pg_temp.put(jsonb_build_array(pg_temp.course(1,2,'[]')))$q$,'class cannot be bound to an instructor who is not assigned to it','Invalid class binding');
select pg_temp.fails($q$select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,'[]')||'{"name":"DO-NOT-PERSIST"}'))$q$,'unknown course field (name) rejected','Invalid class binding');
select pg_temp.fails($q$select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,'[]')||'{"lessonDates":["2026-02-30"]}'))$q$,'impossible lesson date rejected','22008');
select pg_temp.fails($q$select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,'[]')||'{"lessonDates":["DO-NOT-PERSIST"]}'))$q$,'free-text lesson date rejected','Invalid date');
select pg_temp.fails($q$select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,'[]')||'{"lessonDates":[]}'))$q$,'empty lesson dates rejected','Invalid lesson dates');
select pg_temp.fails($q$select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,9,'1')))))$q$,'enrollment identity immutable for a known swimmer source','Enrollment identity immutable');
select pg_temp.fails($q$select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,1,'1'))),pg_temp.course(2,2,jsonb_build_array(pg_temp.sw(8,1,'8')))))$q$,'an enrollment ID cannot move to another course','23505');
select pg_temp.fails($q$select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,1,'1')||'{"name":"DO-NOT-PERSIST"}'))))$q$,'unknown swimmer field (name) rejected','Invalid swimmer identity');
select pg_temp.fails($q$select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,1,'1')||'{"phone":"DO-NOT-PERSIST"}'))))$q$,'unknown swimmer field (phone) rejected','Invalid swimmer identity');
select pg_temp.fails($q$select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(8,8,'A')))))$q$,'uppercase match key rejected','23514');
select pg_temp.fails($q$select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(8,8,'g')))))$q$,'non-hex match key rejected','23514');
select pg_temp.fails($q$select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(8,8,'8')||jsonb_build_object('matchKey',repeat('8',63))))))$q$,'short match key rejected','23514');
select pg_temp.fails($q$select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(8,8,'8')||'{"matchKey":"DO-NOT-PERSIST Jane Doe 555-0100"}'))))$q$,'plain-text match key rejected','23514');
select pg_temp.fails($q$select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(8,8,'8')-'matchKey'))))$q$,'missing match key rejected','23502');
select pg_temp.fails($q$select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,1,'c')))))$q$,'changed fingerprint requires explicit reconciliation','Explicit alias reconciliation required');
select pg_temp.fails($q$select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(8,8,'2')))))$q$,'a fingerprint cannot be claimed by a second enrollment','23505');
select pg_temp.assert_true(pg_temp.reg()=(select body from audit_registry),'every rejected PUT is atomic: registry unchanged and nothing deactivated');
select pg_temp.fails($q$select pg_temp.reconcile(1,1,2,repeat('b',64))$q$,'reconcile must name the registered course/swimmer/enrollment triple','Invalid alias');
select pg_temp.fails($q$select pg_temp.reconcile(1,1,1,repeat('B',64))$q$,'reconcile rejects a non-opaque key','23514');
select pg_temp.fails($q$select pg_temp.reconcile(1,1,1,repeat('b',64),'{"name":"DO-NOT-PERSIST"}')$q$,'reconcile rejects extra fields','Invalid alias');
select pg_temp.reconcile(1,1,1,repeat('b',64));
select pg_temp.assert_true(pg_temp.swimmer(1,1)->'matchKeys' @> jsonb_build_array(repeat('1',64),repeat('b',64)) and jsonb_array_length(pg_temp.swimmer(1,1)->'matchKeys')=2,'reconcile adds an alias and keeps the old key');
select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,1,'b'),pg_temp.sw(2,2,'2'))),pg_temp.course(2,2,jsonb_build_array(pg_temp.sw(3,3,'3')))));
select pg_temp.assert_true((pg_temp.swimmer(1,1)->>'active')::boolean and jsonb_array_length(pg_temp.swimmer(1,1)->'matchKeys')=2,'a reconciled alias is accepted by the next PUT without creating another');

-- ---- Operations: revisions, idempotency, independent receipts --------------
select pg_temp.act('7');
select pg_temp.assert_true(pg_temp.ap(pg_temp.op(1))=jsonb_build_object('operationId','7a000000-0000-0000-0000-000000000001','status','accepted','revision',1),'first revision is 1 from base 0');
select pg_temp.assert_true(pg_temp.ap(pg_temp.op(1))=jsonb_build_object('operationId','7a000000-0000-0000-0000-000000000001','status','already_accepted','revision',1),'duplicate operationId is already_accepted at the same revision');
select pg_temp.assert_true(pg_temp.ap(pg_temp.op(1,0,1,1,'2026-10-05','{"payload":{"status":"absent"}}'))=jsonb_build_object('operationId','7a000000-0000-0000-0000-000000000001','status','rejected','revision',0,'reason','operation_id_reused'),'changed reuse of an operationId is rejected');
select pg_temp.assert_true(pg_temp.rev(pg_temp.arec(1))=1 and pg_temp.one(pg_temp.arec(1))->'payload'->>'status'='present' and (select count(*)=1 from jsonb_array_elements(pg_temp.snap()->'history')),'neither the duplicate nor the changed reuse created a revision or altered the record');
select pg_temp.assert_true(pg_temp.st(pg_temp.op(1))='already_accepted','original receipt survives a rejected reuse');
select pg_temp.assert_true(pg_temp.ap(pg_temp.op(2,1,1,1,'2026-10-05','{"payload":{"status":"absent"}}'))->>'revision'='2','correction from base 1 becomes revision 2');
select pg_temp.assert_true(pg_temp.st(pg_temp.op(3,0,1,2))='accepted','second swimmer attendance accepted');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(4,0,2,3))$q$,'instructor A cannot write to instructor B''s class');
select pg_temp.act('8');
select pg_temp.assert_true(pg_temp.st(pg_temp.op(4,0,2,3))='accepted','instructor B writes own class');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(5,2))$q$,'instructor B cannot correct instructor A''s record');
select pg_temp.act('7');

-- ---- Operations: schema validation. Each case is one mutation of a valid op. --
create temp table audit_bad(n int,label text,o jsonb,why text default null) on commit drop;
grant select on audit_bad to authenticated;
select pg_temp.act('postgres');
insert into audit_bad(n,label,o) values
(100,'unknown kind',pg_temp.op(100,2)||'{"kind":"note"}'),
(101,'unknown action',pg_temp.op(101,2)||'{"action":"patch"}'),
(102,'client-computed success field',pg_temp.op(102,2)||'{"success":true}'),
(103,'free-text field on the operation',pg_temp.op(103,2)||'{"note":"DO-NOT-PERSIST"}'),
(104,'swimmer name field on the operation',pg_temp.op(104,2)||'{"name":"DO-NOT-PERSIST"}'),
(105,'attendance recordId for another enrollment',pg_temp.op(105,2)||jsonb_build_object('recordId',pg_temp.arec(2))),
(106,'attendance recordId for another date',pg_temp.op(106,2)||jsonb_build_object('recordId',pg_temp.arec(1,'2026-10-12'))),
(107,'free-text attendance recordId',pg_temp.op(107,2)||'{"recordId":"DO-NOT-PERSIST"}'),
(108,'lesson date outside the registered dates',pg_temp.op(108,0,1,1,'2026-10-06')),
(109,'impossible lesson date',pg_temp.op(109,0,1,1,'2026-13-40')),
(110,'wrong dataset',pg_temp.op(110,2)||'{"datasetId":"decksupervisor:80000000-0000-0000-0000-0000000000ff"}'),
(111,'negative baseRevision',pg_temp.op(111,2)||'{"baseRevision":-1}'),
(112,'non-numeric baseRevision',pg_temp.op(112,2)||'{"baseRevision":"DO-NOT-PERSIST"}'),
(113,'free-text curriculumVersion',pg_temp.op(113,2)||'{"curriculumVersion":"DO-NOT-PERSIST"}'),
(114,'unknown attendance status',pg_temp.op(114,2)||'{"payload":{"status":"late"}}'),
(115,'attendance payload with a note',pg_temp.op(115,2)||'{"payload":{"status":"present","note":"DO-NOT-PERSIST"}}'),
(116,'attendance payload without status',pg_temp.op(116,2)||'{"payload":{}}'),
(117,'delete with a non-empty payload',pg_temp.op(117,2)||'{"action":"delete","payload":{"status":"absent"}}'),
(118,'payload that is not an object',pg_temp.op(118,2)||'{"payload":"DO-NOT-PERSIST"}'),
(119,'operation naming another session',pg_temp.op(119,2)||'{"sessionId":"20000000-0000-0000-0000-000000000003"}'),
(120,'enrollment that is not in the class',pg_temp.op(120,0,1,3)),
(121,'delete of a record that never existed',pg_temp.op(121,0,1,1,'2026-10-12')||'{"action":"delete","payload":{}}'),
(122,'missing required field',pg_temp.op(122,2)-'lessonDate'),
(130,'unknown skill',pg_temp.att(130,0,9,pg_temp.ls()||'{"skillId":"DO-NOT-PERSIST"}')),
(131,'unknown curriculum version',pg_temp.att(131,0,9,pg_temp.ls(),'{"curriculumVersion":"templates-0000000000000000"}')),
(132,'missing curriculum version',pg_temp.att(132,0,9,pg_temp.ls(),'{"curriculumVersion":""}')),
(133,'duplicated criterion hides a missing one',pg_temp.att(133,0,9,pg_temp.ls()||'{"results":[{"subskillId":"LittleSplash1:1:1","status":"successful"},{"subskillId":"LittleSplash1:1:1","status":"successful"}]}')),
(134,'missing criterion',pg_temp.att(134,0,9,pg_temp.ls()||'{"results":[{"subskillId":"LittleSplash1:1:1","status":"successful"}]}')),
(135,'criterion from another skill',pg_temp.att(135,0,9,pg_temp.ls()||'{"results":[{"subskillId":"LittleSplash1:1:1","status":"successful"},{"subskillId":"LittleSplash1:2:2","status":"successful"}]}')),
(136,'extra criterion beyond the catalog',pg_temp.att(136,0,9,pg_temp.ls()||'{"results":[{"subskillId":"LittleSplash1:1:1","status":"successful"},{"subskillId":"LittleSplash1:1:2","status":"successful"},{"subskillId":"LittleSplash1:1:3","status":"successful"}]}')),
(137,'criterion with a comment',pg_temp.att(137,0,9,pg_temp.ls()||'{"results":[{"subskillId":"LittleSplash1:1:1","status":"successful","comment":"DO-NOT-PERSIST"},{"subskillId":"LittleSplash1:1:2","status":"successful"}]}')),
(138,'unknown criterion status',pg_temp.att(138,0,9,pg_temp.ls('successful','DO-NOT-PERSIST'))),
(139,'draft flag in payload',pg_temp.att(139,0,9,pg_temp.ls()||'{"draft":true}')),
(140,'client-computed success in payload',pg_temp.att(140,0,9,pg_temp.ls('not_yet','not_yet')||'{"success":true}')),
(141,'free-text notes in payload',pg_temp.att(141,0,9,pg_temp.ls()||'{"notes":"DO-NOT-PERSIST"}')),
(142,'createdAt after submittedAt',pg_temp.att(142,0,9,pg_temp.ls('successful','successful','2026-10-05T10:00:00Z'))),
(143,'free-text createdAt',pg_temp.att(143,0,9,pg_temp.ls('successful','successful','DO-NOT-PERSIST'))),
(144,'date-prefixed free-text createdAt',pg_temp.att(144,0,9,pg_temp.ls('successful','successful','2026-10-05T DO-NOT-PERSIST'))),
(145,'attempt recordId that is not a UUID',pg_temp.att(145,0,9,pg_temp.ls(),'{"recordId":"DO-NOT-PERSIST"}')),
(146,'timing on a skill that is not a benchmark',pg_temp.att(146,0,9,pg_temp.ls()||'{"timed":{"lapsRequired":4,"lapsCompleted":4,"elapsedMs":1000}}')),
(147,'benchmark without timing',pg_temp.att(147,0,9,pg_temp.timed(1000)-'timed')),
(148,'timing with an extra field',pg_temp.att(148,0,9,jsonb_set(pg_temp.timed(1000),'{timed,note}','"DO-NOT-PERSIST"'))),
(149,'zero required laps',pg_temp.att(149,0,9,jsonb_set(jsonb_set(pg_temp.timed(1000),'{timed,lapsRequired}','0'),'{timed,lapsCompleted}','0'))),
(150,'more laps completed than required',pg_temp.att(150,0,9,pg_temp.timed(1000,5))),
(151,'negative elapsed time',pg_temp.att(151,0,9,jsonb_set(pg_temp.timed(1000),'{timed,elapsedMs}','-1'))),
(152,'fractional elapsed time',pg_temp.att(152,0,9,jsonb_set(pg_temp.timed(1000),'{timed,elapsedMs}','1000.5'))),
(153,'missing elapsed time',pg_temp.att(153,0,9,pg_temp.timed(1000)#-'{timed,elapsedMs}'));
update audit_bad b set why=v.why from (values (100,'Invalid operation'),(101,'Invalid operation'),(102,'Invalid operation'),(103,'Invalid operation'),(104,'Invalid operation'),(105,'Invalid attendance identity'),(106,'Invalid attendance identity'),(107,'Invalid attendance identity'),(108,'Invalid scope'),(109,'22008'),(110,'Invalid scope'),(111,'Invalid operation'),(112,'Invalid operation'),(113,'Invalid version'),(114,'Invalid attendance'),(115,'Invalid attendance'),(116,'Invalid attendance'),(117,'Invalid deletion'),(118,'Invalid operation'),(119,'Invalid operation'),(120,'Invalid scope'),(121,'accepted by validation'),(122,'Invalid identity'),(130,'Invalid curriculum'),(131,'Invalid curriculum'),(132,'Invalid curriculum'),(133,'Incomplete criteria'),(134,'Invalid curriculum'),(135,'Incomplete criteria'),(136,'Invalid curriculum'),(137,'Invalid criterion'),(138,'Invalid criterion'),(139,'Invalid curriculum'),(140,'Invalid curriculum'),(141,'Invalid curriculum'),(142,'Invalid assessment times'),(143,'Invalid assessment times'),(144,'22007'),(145,'22P02'),(146,'Skill is not timed'),(147,'Missing benchmark timing'),(148,'Invalid timing'),(149,'Invalid timing'),(150,'Invalid completed laps'),(151,'Invalid timing'),(152,'Invalid timing'),(153,'Invalid timing')) v(n,why) where v.n=b.n;
-- Prove WHY each case is refused (not merely that something refused it).
do $$ declare b record; outcome text; begin for b in select * from audit_bad order by n loop outcome:='accepted by validation'; begin perform result_validate(b.o,pg_temp.sid()); exception when others then outcome:=case when sqlstate='P0001' then sqlerrm else sqlstate end; end; perform pg_temp.assert_true(outcome=b.why,format('refused for the intended reason: %s [%s]',b.label,outcome)); end loop; end $$;
select pg_temp.act('7');
select pg_temp.assert_true(pg_temp.ap(o)=jsonb_build_object('operationId',o->>'operationId','status','rejected','revision',0,'reason','invalid_operation'),'rejected: '||label) from audit_bad order by n;
select pg_temp.assert_true(pg_temp.ap(o)->>'status'='rejected','rejection is durable on retry: '||label) from audit_bad where n in (103,141);
select pg_temp.assert_true(pg_temp.rev(pg_temp.arec(1))=2 and pg_temp.one(pg_temp.rec(9)) is null and jsonb_array_length(pg_temp.snap()->'conflicts')=0 and jsonb_array_length(pg_temp.snap()->'history')=3,'rejected operations created no record, revision, history or conflict');
select pg_temp.act('postgres');
select pg_temp.assert_true((select count(*)=(select count(*) from audit_bad) and bool_and(ro.operation is null and ro.receipt->>'status'='rejected' and ro.operation_hash ~ '^[a-f0-9]{64}$') from result_operations ro join audit_bad b on ro.operation_id=(b.o->>'operationId')::uuid),'rejected operations keep only a hash and receipt, never the submitted body');
select pg_temp.act('7');
-- Positive controls: the unmutated shapes are accepted and success is derived.
select pg_temp.assert_true(pg_temp.ap(pg_temp.att(160,0,1,pg_temp.ls()))->>'status'='accepted' and (pg_temp.one(pg_temp.rec(1))->>'success')::boolean,'all criteria successful => server success true');
select pg_temp.assert_true(pg_temp.st(pg_temp.att(161,0,2,pg_temp.timed(180000)))='accepted' and (pg_temp.one(pg_temp.rec(2))->>'success')::boolean,'benchmark at exactly the limit with all laps => success');
select pg_temp.assert_true(pg_temp.st(pg_temp.att(162,0,3,pg_temp.timed(180001)))='accepted' and not (pg_temp.one(pg_temp.rec(3))->>'success')::boolean,'benchmark 1 ms over the limit is stored but not successful');
select pg_temp.assert_true(pg_temp.st(pg_temp.att(163,0,4,pg_temp.timed(1000,3)))='accepted' and not (pg_temp.one(pg_temp.rec(4))->>'success')::boolean,'incomplete laps are stored but not successful');
select pg_temp.assert_true(pg_temp.st(pg_temp.att(164,0,5,pg_temp.timed(1000,4,'not_yet')))='accepted' and not (pg_temp.one(pg_temp.rec(5))->>'success')::boolean,'fast benchmark with a not-yet criterion is not successful');
select pg_temp.assert_true(pg_temp.one(pg_temp.rec(2))-array['revision','deleted','success','updatedAt']=pg_temp.att(161,0,2,pg_temp.timed(180000)) and (pg_temp.one(pg_temp.rec(2))->>'revision')::int=1 and not (pg_temp.one(pg_temp.rec(2))->>'deleted')::boolean and pg_temp.one(pg_temp.rec(2)) ? 'updatedAt','stored record is exactly the operation plus revision/deleted/success/updatedAt');

-- ---- Attempt identity is immutable across corrections and tombstones --------
select pg_temp.act('postgres');
insert into result_curriculum select 'audit-version-2',level,skill_id,criteria from result_curriculum where version='templates-b50c7f987e101b7e' and skill_id like 'LittleSplash1:%';
select pg_temp.act('7');
select pg_temp.assert_true(pg_temp.st(pg_temp.att(170,1,1,pg_temp.ls('successful','successful','2026-10-05T09:00:00Z','LittleSplash1:2')))='rejected','correction cannot change skillId');
select pg_temp.assert_true(pg_temp.st(pg_temp.att(171,1,1,pg_temp.ls(),'{"curriculumVersion":"audit-version-2"}'))='rejected','correction cannot change curriculumVersion (even to another valid version)');
select pg_temp.assert_true(pg_temp.st(pg_temp.att(172,1,1,pg_temp.ls('successful','successful','2026-10-05T08:00:00Z')))='rejected','correction cannot change createdAt');
select pg_temp.assert_true(pg_temp.st(pg_temp.att(173,1,1,'{}','{"action":"delete","curriculumVersion":"audit-version-2"}'))='rejected','tombstone cannot change curriculumVersion');
select pg_temp.assert_true(pg_temp.st(pg_temp.att(174,1,1,pg_temp.ls())||jsonb_build_object('enrollmentId',pg_temp.enr(2)))='rejected','record cannot move to another enrollment');
select pg_temp.assert_true(pg_temp.st(pg_temp.att(175,1,1,pg_temp.ls())||'{"lessonDate":"2026-10-12"}')='rejected','record cannot move to another lesson date');
select pg_temp.assert_true(pg_temp.st(pg_temp.op(176,1)||jsonb_build_object('kind','attempt','payload',pg_temp.ls()))='rejected','record cannot change kind');
select pg_temp.assert_true(pg_temp.ap(pg_temp.att(177,1,1,pg_temp.ls('not_yet','successful')))->>'revision'='2' and not (pg_temp.one(pg_temp.rec(1))->>'success')::boolean,'a correction that keeps identity is accepted and success is recomputed');
select pg_temp.assert_true(pg_temp.ap(pg_temp.att(178,2,1,'{}','{"action":"delete"}'))->>'revision'='3' and (pg_temp.one(pg_temp.rec(1))->>'deleted')::boolean and pg_temp.one(pg_temp.rec(1))->>'curriculumVersion'='templates-b50c7f987e101b7e' and not (pg_temp.one(pg_temp.rec(1))->>'success')::boolean,'tombstone is revision 3, keeps curriculumVersion and is never successful');
select pg_temp.assert_true(pg_temp.st(pg_temp.att(179,3,1,pg_temp.ls('successful','successful','2026-10-05T08:00:00Z')))='rejected','after a tombstone the original createdAt still binds');
select pg_temp.assert_true(pg_temp.st(pg_temp.att(180,3,1,pg_temp.ls('successful','successful','2026-10-05T09:00:00Z','LittleSplash1:2')))='rejected','after a tombstone the original skillId still binds');
select pg_temp.assert_true(pg_temp.ap(pg_temp.att(181,3,1,pg_temp.ls()))->>'revision'='4','re-recording with the original identity continues the revision chain');
select pg_temp.assert_true((select array_agg((h->>'revision')::int order by (h->>'revision')::int)=array[1,2,3,4] and bool_and((h->'record'->>'deleted')::boolean=((h->>'revision')::int=3)) and bool_and((h->'record'->>'revision')=(h->>'revision')) from jsonb_array_elements(pg_temp.snap()->'history') h where h->>'recordId'=pg_temp.rec(1)),'history keeps every revision including the tombstone');

-- ---- Conflicts and supervisor review ----------------------------------------
select pg_temp.assert_true(pg_temp.ap(pg_temp.op(200,1))=jsonb_build_object('operationId','7a000000-0000-0000-0000-000000000200','status','pending_review','revision',2,'reason','revision_conflict'),'stale baseRevision is pending_review at the current revision');
select pg_temp.assert_true(pg_temp.rev(pg_temp.arec(1))=2 and pg_temp.one(pg_temp.arec(1))->'payload'->>'status'='absent','pending review is not silently applied');
select pg_temp.assert_true(pg_temp.ap(pg_temp.op(200,1))->>'status'='pending_review' and (select count(*)=1 from jsonb_array_elements(pg_temp.snap()->'conflicts')),'conflict retry stays pending_review and records one conflict only');
select pg_temp.assert_true(pg_temp.conflict(200)->'operation'=pg_temp.op(200,1) and pg_temp.conflict(200)->'current'=pg_temp.one(pg_temp.arec(1)) and not (pg_temp.conflict(200)->>'resolved')::boolean and (select array_agg(k order by k)=array['current','id','operation','resolved'] from jsonb_object_keys(pg_temp.conflict(200)) k),'conflict exposes exactly id/operation/current/resolved');
select pg_temp.assert_true(pg_temp.st(pg_temp.op(201,1)||'{"payload":{"status":"late"}}')='rejected' and (select count(*)=1 from jsonb_array_elements(pg_temp.snap()->'conflicts')),'an invalid stale operation is rejected, never queued for review');
select pg_temp.denied($q$select pg_temp.resolve(200,'incoming',2)$q$,'instructor cannot resolve a conflict');
select pg_temp.act('2');
select pg_temp.fails($q$select pg_temp.resolve(200,'merge',2)$q$,'unknown resolution choice rejected','Invalid conflict');
select pg_temp.fails($q$select result_admin(pg_temp.sid(),'resolve','{"id":"00000000-0000-0000-0000-00000000dead","choice":"current","expectedRevision":2}')$q$,'unknown conflict rejected','Invalid conflict');
select pg_temp.fails($q$select result_admin('20000000-0000-0000-0000-000000000001','resolve',jsonb_build_object('id',pg_temp.conflict(200)->>'id','choice','incoming','expectedRevision',2))$q$,'a conflict cannot be resolved through another session the caller owns','Invalid conflict');
select pg_temp.fails($q$select result_admin(pg_temp.sid(),'purge')$q$,'unknown admin action rejected','Invalid action');
select pg_temp.assert_true(pg_temp.resolve(200,'current',2)='{"resolved":true}' and pg_temp.rev(pg_temp.arec(1))=2 and pg_temp.one(pg_temp.arec(1))->'payload'->>'status'='absent' and (pg_temp.conflict(200)->>'resolved')::boolean and pg_temp.conflict(200)->'operation'=pg_temp.op(200,1),'choice current keeps the record and retains the reviewed operation');
select pg_temp.assert_true(pg_temp.resolve(200,'incoming',2)='{"resolved":true}' and pg_temp.rev(pg_temp.arec(1))=2,'a resolved conflict cannot be re-decided');
select pg_temp.act('postgres');
select pg_temp.assert_true((select resolution='current' and resolved_by='00000000-0000-0000-0000-000000000002' and resolved_at is not null and success is not null from result_conflicts where operation->>'operationId'='7a000000-0000-0000-0000-000000000200'),'review audit (choice, reviewer, time) retained');
select pg_temp.act('7');
select pg_temp.assert_true(pg_temp.st(pg_temp.op(202,1))='pending_review','second stale edit pending');
select pg_temp.assert_true(pg_temp.ap(pg_temp.op(203,2,1,1,'2026-10-05','{"payload":{"status":"unmarked"}}'))->>'revision'='3','concurrent third edit accepted as revision 3');
select pg_temp.act('2');
select pg_temp.fails($q$select pg_temp.resolve(202,'incoming',2)$q$,'review of revision 2 cannot overwrite unseen revision 3','Conflict changed; refresh review');
select pg_temp.fails($q$select pg_temp.resolve(202,'incoming')$q$,'omitting expectedRevision falls back to the conflict-time revision and is equally guarded','Conflict changed; refresh review');
select pg_temp.fails($q$select pg_temp.resolve(202,'current',2)$q$,'even keeping current requires a fresh review','Conflict changed; refresh review');
select pg_temp.assert_true(pg_temp.rev(pg_temp.arec(1))=3 and not (pg_temp.conflict(202)->>'resolved')::boolean,'failed reviews change nothing');
select pg_temp.assert_true(pg_temp.resolve(202,'incoming',3)='{"resolved":true}' and pg_temp.rev(pg_temp.arec(1))=4 and pg_temp.one(pg_temp.arec(1))->>'operationId'='7a000000-0000-0000-0000-000000000202' and pg_temp.one(pg_temp.arec(1))->'payload'->>'status'='present','choice incoming becomes the next revision');
select pg_temp.assert_true((select count(*)=4 from jsonb_array_elements(pg_temp.snap()->'history') h where h->>'recordId'=pg_temp.arec(1)) and (pg_temp.conflict(202)->>'resolved')::boolean,'incoming resolution is recorded in history and the conflict is kept');
select pg_temp.act('7');
select pg_temp.assert_true(pg_temp.ap(pg_temp.op(202,1))->>'status'='pending_review' and pg_temp.rev(pg_temp.arec(1))=4,'retrying a reviewed operation never re-applies it');
select pg_temp.assert_true(pg_temp.ap(pg_temp.op(204,5,1,1,'2026-10-12'))=jsonb_build_object('operationId','7a000000-0000-0000-0000-000000000204','status','pending_review','revision',0,'reason','revision_conflict') and pg_temp.conflict(204)->'current'='null'::jsonb,'nonzero base for a record the server has never seen is pending at revision 0');
select pg_temp.act('2');
select pg_temp.fails($q$select pg_temp.resolve(204,'incoming',1)$q$,'expectedRevision must be 0 when no accepted record exists','Conflict changed; refresh review');
select pg_temp.assert_true(pg_temp.resolve(204,'incoming',0)='{"resolved":true}' and pg_temp.rev(pg_temp.arec(1,'2026-10-12'))=1,'expectedRevision 0 accepts the incoming version as revision 1');
select pg_temp.act('7');
select pg_temp.assert_true(pg_temp.st(pg_temp.op(205,3,1,2,'2026-10-12'))='pending_review' and pg_temp.st(pg_temp.op(206,0,1,2,'2026-10-12'))='accepted','a record is created while a no-record conflict waits');
select pg_temp.act('2');
select pg_temp.fails($q$select pg_temp.resolve(205,'incoming',0)$q$,'expectedRevision 0 is stale once a record exists','Conflict changed; refresh review');
select pg_temp.assert_true(pg_temp.resolve(205,'current',1)='{"resolved":true}' and pg_temp.one(pg_temp.arec(2,'2026-10-12'))->>'operationId'='7a000000-0000-0000-0000-000000000206','fresh review keeps the newer record');
select pg_temp.act('8');
select pg_temp.assert_true(pg_temp.st(pg_temp.op(207,7,2,3))='pending_review','instructor B has a pending conflict in class 2');

-- ---- Read scoping ------------------------------------------------------------
select pg_temp.act('2');
select pg_temp.assert_true((select count(distinct r->>'classId')=2 from jsonb_array_elements(pg_temp.snap()->'records') r) and (select count(distinct c->'operation'->>'classId')=2 from jsonb_array_elements(pg_temp.snap()->'conflicts') c) and (select array_agg(k order by k)=array['conflicts','history','records','schemaVersion'] from jsonb_object_keys(pg_temp.snap()) k),'supervisor reads records and conflicts for every class');
select pg_temp.assert_true((select count(*)>0 and bool_and(r->>'classId'=pg_temp.cls(2)::text) from jsonb_array_elements(pg_temp.snap(2)->'records') r) and (select count(*)>0 and bool_and(h->'record'->>'classId'=pg_temp.cls(2)::text) from jsonb_array_elements(pg_temp.snap(2)->'history') h) and (select count(*)=1 and bool_and(c->'operation'->>'classId'=pg_temp.cls(2)::text) from jsonb_array_elements(pg_temp.snap(2)->'conflicts') c),'classId filter narrows records, history and conflicts');
select pg_temp.assert_true((select bool_or((r->>'deleted')::boolean) from jsonb_array_elements(pg_temp.snap(1)->'history') h, lateral (select h->'record' as r) x),'snapshot history includes tombstones');
select pg_temp.act('7');
select pg_temp.assert_true((select count(*)>0 and bool_and(r->>'classId'=pg_temp.cls(1)::text) from jsonb_array_elements(pg_temp.snap()->'records') r) and (select count(*)>0 and bool_and(h->'record'->>'classId'=pg_temp.cls(1)::text) from jsonb_array_elements(pg_temp.snap()->'history') h) and (select count(*)>0 and bool_and(c->'operation'->>'classId'=pg_temp.cls(1)::text) from jsonb_array_elements(pg_temp.snap()->'conflicts') c),'instructor A reads only own class records, history and conflicts');
select pg_temp.assert_true(pg_temp.snap(2)=jsonb_build_object('schemaVersion',1,'records','[]'::jsonb,'conflicts','[]'::jsonb,'history','[]'::jsonb),'classId filter cannot widen an instructor''s scope');
select pg_temp.act('8');
select pg_temp.assert_true((select count(*)=1 and bool_and(r->>'classId'=pg_temp.cls(2)::text) from jsonb_array_elements(pg_temp.snap()->'records') r) and (select bool_and(c->'operation'->>'classId'=pg_temp.cls(2)::text) from jsonb_array_elements(pg_temp.snap()->'conflicts') c),'instructor B reads only own class');
select pg_temp.act('9');
select pg_temp.denied($q$select pg_temp.snap()$q$,'unassigned account cannot read results');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(208,4))$q$,'unassigned account cannot write results');
select pg_temp.act('5');
select pg_temp.denied($q$select pg_temp.snap()$q$,'owner of another session cannot read results');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(208,4))$q$,'owner of another session cannot write results');
select pg_temp.denied($q$select result_admin(pg_temp.sid(),'grants')$q$,'owner of another session cannot list grants');
select pg_temp.act('anon');
select pg_temp.denied($q$select pg_temp.reg()$q$,'anonymous cannot call the registry RPC');
select pg_temp.denied($q$select pg_temp.snap()$q$,'anonymous cannot call the snapshot RPC');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(208,4))$q$,'anonymous cannot call the apply RPC');
select pg_temp.denied($q$select result_admin(pg_temp.sid(),'grants')$q$,'anonymous cannot call the admin RPC');
select pg_temp.denied($q$select pg_temp.mint(1,'X','[]')$q$,'anonymous cannot mint');

-- ---- Grants --------------------------------------------------------------------
select pg_temp.act('2');
select pg_temp.denied($q$select pg_temp.mint(1,'X',jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,1,'1')))))$q$,'even the session owner cannot mint from the browser role');
select pg_temp.denied($q$select result_validate(pg_temp.op(1),pg_temp.sid())$q$,'validation helper is not callable by API roles');
select pg_temp.denied($q$select result_check_grant('audit-upload-A1',false)$q$,'grant lookup helper is not callable by API roles');
select pg_temp.act('service');
select pg_temp.denied($q$select pg_temp.snap()$q$,'service role without a capability has no ambient read access');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(208,4))$q$,'service role without a capability has no ambient write access');
select pg_temp.denied($q$select pg_temp.reg()$q$,'service role cannot call the registry RPC');
select pg_temp.denied($q$select pg_temp.mint(1,'X',jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,1,'1')))),'{}',7)$q$,'mint requires the creator to own the session');
select pg_temp.fails($q$select pg_temp.mint(1,'X',jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,1,'1')))),'{"datasetId":"decksupervisor:80000000-0000-0000-0000-0000000000ff"}')$q$,'mint rejects a foreign dataset','Invalid binding');
select pg_temp.fails($q$select pg_temp.mint(1,'X',jsonb_build_array(pg_temp.course(2,2,jsonb_build_array(pg_temp.sw(3,3,'3')))))$q$,'mint cannot bind instructor A to instructor B''s class','Invalid class binding');
select pg_temp.fails($q$select pg_temp.mint(1,'X',jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(3,3,'3')))))$q$,'mint cannot bind an enrollment from another class','Invalid enrollment binding');
select pg_temp.fails($q$select pg_temp.mint(1,'X',jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,8,'1')))))$q$,'mint cannot bind an unknown enrollment','Invalid enrollment binding');
select pg_temp.fails($q$select pg_temp.mint(1,'X','[]')$q$,'mint requires at least one class','Invalid binding');
select pg_temp.fails($q$select pg_temp.mint(1,'X',jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,1,'1')))),'{"uploadHash":"audit-upload-plaintext-token"}')$q$,'mint refuses anything that is not a SHA-256 hex digest','Invalid binding');
select pg_temp.fails($q$select pg_temp.mint(1,'X',jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,1,'1')))),jsonb_build_object('readHash',encode(sha256(convert_to('audit-upload-X','UTF8')),'hex')))$q$,'upload and read capabilities must differ','Invalid binding');
select pg_temp.assert_true((select array_agg(k order by k)=array['expiresAt','id'] from jsonb_object_keys(pg_temp.mint(1,'A1',jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,1,'1'),pg_temp.sw(2,2,'2')))))) k),'mint returns only id and expiry');
select pg_temp.mint(1,'A2',jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,1,'1'),pg_temp.sw(2,2,'2')))));
select pg_temp.mint(2,'B1',jsonb_build_array(pg_temp.course(2,2,jsonb_build_array(pg_temp.sw(3,3,'3')))));
select pg_temp.fails($q$select pg_temp.mint(1,'A1',jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,1,'1')))))$q$,'a capability hash can never be issued twice','23505');
select pg_temp.act('postgres');
select pg_temp.assert_true((select count(*)=3 and bool_and(expires_at=now()+interval '30 days' and read_expires_at=now()+interval '12 hours' and not revoked and creator_id='00000000-0000-0000-0000-000000000002' and upload_hash ~ '^[a-f0-9]{64}$' and read_hash ~ '^[a-f0-9]{64}$' and upload_hash<>read_hash) from result_grants where session_id=pg_temp.sid()),'each redemption is an independent grant: upload 30 days, read 12 hours');
select pg_temp.assert_true(not exists(select 1 from result_grants g where g::text like '%audit-upload-%' or g::text like '%audit-read-%'),'only hashes are stored, never a raw capability');
select pg_temp.act('service');
select pg_temp.assert_true((select count(*)>0 and bool_and(r->>'classId'=pg_temp.cls(1)::text and r->>'enrollmentId' in (pg_temp.enr(1)::text,pg_temp.enr(2)::text)) from jsonb_array_elements(pg_temp.read('A1')->'records') r) and (select bool_and(h->'record'->>'classId'=pg_temp.cls(1)::text) from jsonb_array_elements(pg_temp.read('A1')->'history') h) and (select count(*)>0 and bool_and(c->'operation'->>'classId'=pg_temp.cls(1)::text) from jsonb_array_elements(pg_temp.read('A1')->'conflicts') c),'read capability returns only the grant''s class and enrollments');
select pg_temp.assert_true((select count(*)=1 and bool_and(r->>'enrollmentId'=pg_temp.enr(3)::text) from jsonb_array_elements(pg_temp.read('B1')->'records') r),'instructor B''s read capability is scoped to B');
select pg_temp.assert_true(result_snapshot('20000000-0000-0000-0000-000000000003',pg_temp.cls(2),'audit-read-A1')::jsonb->'records'='[]'::jsonb and result_snapshot('20000000-0000-0000-0000-000000000003',null,'audit-read-A1')::jsonb=pg_temp.read('A1'),'a read capability ignores a caller-supplied session and cannot be widened by classId');
select pg_temp.denied($q$select result_snapshot(null,null,'audit-upload-A1')::jsonb$q$,'upload capability cannot read');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(210,4),'audit-read-A1')$q$,'read capability cannot upload');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(1),'audit-read-A1')$q$,'read capability cannot even fetch a duplicate receipt');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(210,4),'audit-upload-unknown')$q$,'unknown capability denied');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(210,4),'')$q$,'empty capability denied');
select pg_temp.denied($q$select result_snapshot(null,null,'')::jsonb$q$,'empty read capability denied');
select pg_temp.assert_true(pg_temp.ap(pg_temp.op(210,4),'audit-upload-A1')->>'revision'='5' and pg_temp.st(pg_temp.op(210,4),'audit-upload-A1')='already_accepted','upload capability writes within its scope and retries idempotently');
select pg_temp.assert_true(pg_temp.st(pg_temp.op(1),'audit-upload-A2')='already_accepted','a second independent grant for the same instructor works');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(211,1,2,3),'audit-upload-A1')$q$,'capability cannot write another instructor''s class');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(211,0,1,3),'audit-upload-A1')$q$,'capability cannot write an enrollment outside the grant');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(4,0,2,3),'audit-upload-A1')$q$,'capability cannot fetch another instructor''s accepted receipt');
select pg_temp.assert_true(pg_temp.st(pg_temp.op(212,1,2,3)||'{"payload":{"status":"absent"}}','audit-upload-B1')='accepted','instructor B''s capability writes B''s class');
select pg_temp.act('7');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(210,4),'audit-upload-A1')$q$,'a capability is refused outside the server''s service role (instructor)');
select pg_temp.denied($q$select pg_temp.read('A1')$q$,'a read capability is refused outside the service role (instructor)');
select pg_temp.act('2');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(210,4),'audit-upload-A1')$q$,'a capability is refused outside the service role (supervisor)');
select pg_temp.denied($q$select pg_temp.read('B1')$q$,'a read capability is refused outside the service role (supervisor)');

-- Grants never expand: a new swimmer and a newly assigned class after minting.
select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,1,'1'),pg_temp.sw(2,2,'2'),pg_temp.sw(5,5,'5'))),pg_temp.course(2,2,jsonb_build_array(pg_temp.sw(3,3,'3'))),pg_temp.course(3,1,jsonb_build_array(pg_temp.sw(6,6,'6')))));
select pg_temp.assert_true(pg_temp.st(pg_temp.op(220,0,1,5))='accepted' and pg_temp.st(pg_temp.op(221,0,3,6))='accepted','supervisor records results for the new swimmer and new class');
select pg_temp.act('service');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(222,1,1,5),'audit-upload-A1')$q$,'old grant does not expand to a swimmer added later');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(222,1,3,6),'audit-upload-A1')$q$,'old grant does not expand to a class assigned later');
select pg_temp.assert_true((select bool_and(r->>'enrollmentId' in (pg_temp.enr(1)::text,pg_temp.enr(2)::text)) from jsonb_array_elements(pg_temp.read('A1')->'records') r) and (select bool_and(h->'record'->>'enrollmentId' in (pg_temp.enr(1)::text,pg_temp.enr(2)::text)) from jsonb_array_elements(pg_temp.read('A1')->'history') h),'old read capability does not expand either');
select pg_temp.mint(1,'A3',jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(5,5,'5'))),pg_temp.course(3,1,jsonb_build_array(pg_temp.sw(6,6,'6')))));
select pg_temp.assert_true(pg_temp.st(pg_temp.op(222,1,1,5),'audit-upload-A3')='accepted' and pg_temp.st(pg_temp.op(223,1,3,6),'audit-upload-A3')='accepted','only a newly redeemed grant covers the new scope');

-- Grant administration.
select pg_temp.act('7');
select pg_temp.denied($q$select result_admin(pg_temp.sid(),'grants')$q$,'instructor cannot list grants');
select pg_temp.denied($q$select result_admin(pg_temp.sid(),'revoke',jsonb_build_object('id','00000000-0000-0000-0000-000000000000'))$q$,'instructor cannot revoke grants');
select pg_temp.act('2');
select pg_temp.assert_true((select count(*)=4 and bool_and((select array_agg(k order by k) from jsonb_object_keys(g) k)=array['expiresAt','id','instructorId','revoked']) and bool_and(not (g->>'revoked')::boolean) and count(*) filter (where g->>'instructorId'=pg_temp.ins(1)::text)=3 from jsonb_array_elements(result_admin(pg_temp.sid(),'grants')->'grants') g),'grant list exposes only id/instructorId/expiresAt/revoked');
create temp table audit_grant on commit drop as select (g->>'id')::uuid as id,g->>'instructorId' as instructor from jsonb_array_elements(result_admin(pg_temp.sid(),'grants')->'grants') g;
grant select on audit_grant to authenticated;
select pg_temp.act('postgres');
delete from audit_grant where id not in (select id from result_grants where upload_hash=encode(sha256(convert_to('audit-upload-A2','UTF8')),'hex'));
select pg_temp.act('5');
select result_admin('20000000-0000-0000-0000-000000000003','revoke',jsonb_build_object('id',(select id from audit_grant)));
select pg_temp.act('service');
select pg_temp.assert_true(pg_temp.st(pg_temp.op(1),'audit-upload-A2')='already_accepted','another session''s owner cannot revoke this session''s grant');
select pg_temp.act('2');
select pg_temp.assert_true(result_admin(pg_temp.sid(),'revoke',jsonb_build_object('id',(select id from audit_grant)))='{}'::jsonb and (select count(*) filter (where (g->>'revoked')::boolean)=1 and bool_and((g->>'revoked')::boolean=((g->>'id')::uuid=(select id from audit_grant))) from jsonb_array_elements(result_admin(pg_temp.sid(),'grants')->'grants') g),'supervisor revokes exactly one grant');
select pg_temp.act('service');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(1),'audit-upload-A2')$q$,'revoked grant cannot fetch even a duplicate receipt');
select pg_temp.denied($q$select pg_temp.read('A2')$q$,'revoked grant cannot read');
select pg_temp.assert_true(pg_temp.st(pg_temp.op(1),'audit-upload-A1')='already_accepted' and pg_temp.read('A1') is not null,'revoking one redemption leaves the other redemption working');

-- Binding state is rechecked on every request, before any duplicate receipt.
select pg_temp.act('postgres');
alter table session_instructors disable trigger user;
alter table instructor_assignments disable trigger user;
alter table instructor_classes disable trigger user;
update session_instructors set active=false where session_id=pg_temp.sid() and id=pg_temp.ins(1);
select pg_temp.act('service');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(1),'audit-upload-A1')$q$,'inactive instructor: duplicate receipt denied');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(230,5),'audit-upload-A1')$q$,'inactive instructor: new upload denied');
select pg_temp.denied($q$select pg_temp.read('A1')$q$,'inactive instructor: read denied');
select pg_temp.fails($q$select pg_temp.mint(1,'A4',jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,1,'1')))))$q$,'inactive instructor: no new grant can be minted','Invalid class binding');
select pg_temp.assert_true(pg_temp.st(pg_temp.op(4,0,2,3),'audit-upload-B1')='already_accepted','another instructor''s grant is unaffected');
select pg_temp.act('7');
select pg_temp.denied($q$select pg_temp.snap()$q$,'inactive instructor: website read denied');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(1))$q$,'inactive instructor: website duplicate receipt denied');
select pg_temp.denied($q$select pg_temp.reg()$q$,'inactive instructor: registry read denied');
select pg_temp.act('postgres');
update session_instructors set active=true where session_id=pg_temp.sid() and id=pg_temp.ins(1);
update instructor_assignments set active=false where session_id=pg_temp.sid() and id=pg_temp.ins(1);
select pg_temp.act('service');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(1),'audit-upload-A1')$q$,'inactive assignment: duplicate receipt denied');
select pg_temp.denied($q$select pg_temp.read('A1')$q$,'inactive assignment: read denied');
select pg_temp.act('7');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(1))$q$,'inactive assignment: website write denied');
select pg_temp.act('postgres');
update instructor_assignments set active=true where session_id=pg_temp.sid() and id=pg_temp.ins(1);
update instructor_classes set active=false where id=pg_temp.cls(1);
select pg_temp.act('service');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(1),'audit-upload-A1')$q$,'inactive class: duplicate receipt denied');
select pg_temp.denied($q$select pg_temp.read('A1')$q$,'inactive class: read denied');
select pg_temp.act('7');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(1))$q$,'inactive class: website write denied');
select pg_temp.act('postgres');
update instructor_classes set active=true where id=pg_temp.cls(1);
update instructor_assignments set account_id=null where session_id=pg_temp.sid() and id=pg_temp.ins(1);
select pg_temp.act('7');
select pg_temp.denied($q$select pg_temp.snap()$q$,'unlinked account: website read denied');
select pg_temp.denied($q$select pg_temp.ap(pg_temp.op(1))$q$,'unlinked account: website write denied');
select pg_temp.act('postgres');
update instructor_assignments set account_id='00000000-0000-0000-0000-000000000007' where session_id=pg_temp.sid() and id=pg_temp.ins(1);
alter table session_instructors enable trigger user;
alter table instructor_assignments enable trigger user;
alter table instructor_classes enable trigger user;
select pg_temp.act('service');
select pg_temp.assert_true(pg_temp.st(pg_temp.op(1),'audit-upload-A1')='already_accepted' and pg_temp.read('A1') is not null,'restoring the binding restores the original durable receipt');

-- ---- Transfers, removals and history ------------------------------------------
select pg_temp.act('2');
select pg_temp.fails($q$select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,1,'1'))),pg_temp.course(2,2,jsonb_build_array(pg_temp.sw(3,3,'3'),pg_temp.sw(2,2,'4'))),pg_temp.course(3,1,jsonb_build_array(pg_temp.sw(6,6,'6')))))$q$,'a transfer cannot reuse the old enrollment ID','23505');
select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,1,'1'),pg_temp.sw(5,5,'5',false))),pg_temp.course(2,2,jsonb_build_array(pg_temp.sw(3,3,'3'),pg_temp.sw(2,4,'4'))),pg_temp.course(3,1,jsonb_build_array(pg_temp.sw(6,6,'6')))));
select pg_temp.assert_true(not (pg_temp.swimmer(1,2)->>'active')::boolean and pg_temp.swimmer(1,2)->>'sourceId'='audit-swimmer-2' and pg_temp.swimmer(1,2)->>'matchKey'=repeat('2',64),'omitted enrollment becomes inactive and is still returned with its identity');
select pg_temp.assert_true(not (pg_temp.swimmer(1,5)->>'active')::boolean,'PUT active:false is stored inactive');
select pg_temp.assert_true((pg_temp.swimmer(2,4)->>'active')::boolean and pg_temp.swimmer(2,4)->>'sourceId'='audit-swimmer-2' and (pg_temp.swimmer(1,1)->>'active')::boolean,'transfer creates a new active enrollment in the destination class');
select pg_temp.put(jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(1,1,'1'),pg_temp.sw(5,5,'5',false))),pg_temp.course(2,2,jsonb_build_array(pg_temp.sw(3,3,'3'),pg_temp.sw(2,4,'4'))),pg_temp.course(3,1,jsonb_build_array(pg_temp.sw(6,6,'6')))));
select pg_temp.assert_true(not (pg_temp.swimmer(1,2)->>'active')::boolean and not (pg_temp.swimmer(1,5)->>'active')::boolean and jsonb_array_length(pg_temp.reg()->'courses'->0->'swimmers')+jsonb_array_length(pg_temp.reg()->'courses'->1->'swimmers')+jsonb_array_length(pg_temp.reg()->'courses'->2->'swimmers')=6,'repeating the PUT keeps inactive enrollments inactive and keeps every historical enrollment');
select pg_temp.assert_true(pg_temp.one(pg_temp.arec(2)) is not null and (select count(*)>0 from jsonb_array_elements(pg_temp.snap(1)->'history') h where h->'record'->>'enrollmentId'=pg_temp.enr(2)::text),'results recorded before the transfer are retained under the old enrollment');
select pg_temp.assert_true(pg_temp.ap(pg_temp.op(240,1,1,2,'2026-10-05','{"payload":{"status":"absent"}}'))->>'revision'='2','supervisor can still correct an existing record of a removed enrollment');
select pg_temp.assert_true(pg_temp.ap(pg_temp.op(241,2,1,2)||'{"action":"delete","payload":{}}')->>'revision'='3','supervisor can still tombstone an existing record of a removed enrollment');
select pg_temp.assert_true(pg_temp.st(pg_temp.op(242,0,1,2)||jsonb_build_object('kind','attempt','recordId',pg_temp.rec(20),'payload',pg_temp.ls()))='rejected' and pg_temp.one(pg_temp.rec(20)) is null,'a removed enrollment cannot receive a new record');
select pg_temp.assert_true(pg_temp.st(pg_temp.op(243,0,2,2))='rejected','the old enrollment cannot be used in the destination class');
select pg_temp.act('8');
select pg_temp.assert_true(pg_temp.st(pg_temp.op(244,0,2,4))='accepted','the new enrollment records results in the destination class');
select pg_temp.assert_true(pg_temp.reg()->'courses'->0->'swimmers' @> jsonb_build_array(jsonb_build_object('enrollmentId',pg_temp.enr(4))) and not exists(select 1 from jsonb_array_elements(pg_temp.snap()->'records') r where r->>'enrollmentId'=pg_temp.enr(2)::text),'destination instructor sees the new enrollment but not the previous class history');
select pg_temp.act('service');
select pg_temp.fails($q$select pg_temp.mint(1,'A5',jsonb_build_array(pg_temp.course(1,1,jsonb_build_array(pg_temp.sw(2,2,'2')))))$q$,'a removed enrollment cannot be bound into a new grant','Invalid enrollment binding');
select pg_temp.assert_true(exists(select 1 from jsonb_array_elements(pg_temp.read('A1')->'history') h where h->'record'->>'enrollmentId'=pg_temp.enr(2)::text and (h->'record'->>'deleted')::boolean),'an existing read grant still returns the retained history and tombstone');

-- ---- Privacy and storage boundary ------------------------------------------------
select pg_temp.act('postgres');
do $$ declare t text; hits bigint; total bigint:=0; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'result\_%' loop
  execute format('select count(*) from public.%I x where x::text like %L',t,'%DO-NOT-PERSIST%') into hits; total:=total+hits;
 end loop;
 perform pg_temp.assert_true(total=0,'no rejected free text, name or contact value reached any result table');
end $$;
select pg_temp.assert_true(not exists(select 1 from information_schema.columns where table_schema='public' and table_name like 'result\_%' and column_name ~* '(name|email|phone|contact|address|birth|guardian|note|comment)'),'no result table has a name, contact or free-text column');
select pg_temp.assert_true((select bool_and((select count(*)=0 from jsonb_object_keys(c.operation) k where k not in ('operationId','sessionId','datasetId','classId','enrollmentId','recordId','kind','action','baseRevision','lessonDate','curriculumVersion','payload'))) from result_conflicts c) and (select bool_and((select count(*)=0 from jsonb_object_keys(r.record) k where k not in ('operationId','sessionId','datasetId','classId','enrollmentId','recordId','kind','action','baseRevision','lessonDate','curriculumVersion','payload','revision','deleted','success','updatedAt'))) from result_history r),'stored operations, conflicts and history contain only contract fields');
select pg_temp.assert_true((select bool_and(case when record->>'kind'='attendance' then record->'payload' in ('{}'::jsonb,'{"status":"present"}','{"status":"absent"}','{"status":"unmarked"}') else (select count(*)=0 from jsonb_object_keys(record->'payload') k where k not in ('skillId','createdAt','submittedAt','results','timed')) end) from result_history),'stored payloads contain only enumerated statuses and catalog criteria');
select pg_temp.assert_true((select count(*)=10 and bool_and(c.relrowsecurity) from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and c.relname like 'result\_%') and not exists(select 1 from pg_policies where schemaname='public' and tablename like 'result\_%'),'all 10 result tables have RLS enabled and no policy grants direct access');
select pg_temp.assert_true(not exists(select 1 from pg_class c,unnest(array['anon','authenticated']) r where c.relnamespace='public'::regnamespace and c.relkind='r' and c.relname like 'result\_%' and (has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege(r,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))),'anon and authenticated hold no table or column privilege on result tables');
select pg_temp.act('2');
select pg_temp.denied('select * from public.'||t,'direct select denied: '||t) from unnest(array['result_datasets','result_courses','result_enrollments','result_aliases','result_grants','result_records','result_history','result_operations','result_conflicts','result_curriculum']) t;
select pg_temp.denied($q$insert into public.result_records values(pg_temp.sid(),'x',pg_temp.cls(1),pg_temp.enr(1),1,'{}')$q$,'direct insert denied');
select pg_temp.denied($q$update public.result_grants set revoked=false$q$,'direct update denied');
select pg_temp.denied($q$delete from public.result_history$q$,'direct delete denied');
select pg_temp.denied($q$update public.result_enrollments set active=true$q$,'direct registry update denied');
select pg_temp.act('postgres');
rollback;

-- ===========================================================================
-- Migration: additive, repeatable over existing data, atomic on failure, and
-- self-healing for the default table/function grants a hosted project applies.
-- This part commits a small synthetic fixture to the disposable database and
-- removes it again at the end.
-- ===========================================================================
create function pg_temp.result_acl_ok() returns boolean language sql as $$
 select (select count(*)=9 and bool_and(p.prosecdef and exists(select 1 from unnest(p.proconfig) c where c in ('search_path=""','search_path='))) from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like 'result\_%')
 and not exists(select 1 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like 'result\_%' and (has_function_privilege('anon',p.oid,'EXECUTE') or exists(select 1 from aclexplode(p.proacl) a where a.grantee=0)))
 and (select array_agg(p.proname::text order by p.proname) from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like 'result\_%' and has_function_privilege('authenticated',p.oid,'EXECUTE'))=array['result_admin','result_apply','result_registry','result_snapshot']
 and (select array_agg(p.proname::text order by p.proname) from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like 'result\_%' and has_function_privilege('service_role',p.oid,'EXECUTE'))=array['result_apply','result_mint','result_snapshot']
 and (select count(*)=10 and bool_and(c.relrowsecurity) from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and c.relname like 'result\_%')
 and not exists(select 1 from pg_policies where schemaname='public' and tablename like 'result\_%')
 and not exists(select 1 from pg_class c,unnest(array['anon','authenticated']) r where c.relnamespace='public'::regnamespace and c.relkind='r' and c.relname like 'result\_%' and (has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege(r,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
 and not exists(select 1 from pg_class c,aclexplode(c.relacl) a where c.relnamespace='public'::regnamespace and c.relkind='r' and c.relname like 'result\_%' and a.grantee=0)$$;
create function pg_temp.result_fingerprint() returns jsonb language plpgsql as $$
declare t text; rows jsonb; result jsonb:='{}';
begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'result\_%' order by 1 loop
  execute format('select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]'') from public.%I x',t) into rows; result:=result||jsonb_build_object(t,rows);
 end loop;
 return result;
end $$;
select pg_temp.assert_true(pg_temp.result_acl_ok(),'function and table privileges are exactly the intended boundary after two applications');
begin;
insert into public.session_instructors(session_id,id,name,account_id,position) values('20000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-0000000000b1','','00000000-0000-0000-0000-000000000007',96);
insert into public.instructor_assignments(session_id,id,name,account_id,instructor_id) values('20000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-0000000000b1','','00000000-0000-0000-0000-000000000007','50000000-0000-0000-0000-0000000000b1');
insert into public.instructor_classes(id,session_id,assignment_id,code,level,start_time,end_time) values('60000000-0000-0000-0000-0000000000b1','20000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-0000000000b1','AUDIT-M','LittleSplash1','11:00','11:30');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select result_registry('20000000-0000-0000-0000-000000000004','{"schemaVersion":1,"sessionId":"20000000-0000-0000-0000-000000000004","datasetId":"decksupervisor:80000000-0000-0000-0000-0000000000b1","courses":[{"sourceId":"audit:course:m","classId":"60000000-0000-0000-0000-0000000000b1","instructorId":"50000000-0000-0000-0000-0000000000b1","lessonDates":["2026-10-05"],"swimmers":[{"sourceId":"audit-swimmer-m","enrollmentId":"90000000-0000-0000-0000-0000000000b1","matchKey":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"}]}]}');
create function pg_temp.mop(n int,base int,extra jsonb default '{}') returns jsonb language sql as $$select jsonb_build_object('operationId','7b000000-0000-0000-0000-'||lpad(n::text,12,'0'),'sessionId','20000000-0000-0000-0000-000000000004','datasetId','decksupervisor:80000000-0000-0000-0000-0000000000b1','classId','60000000-0000-0000-0000-0000000000b1','enrollmentId','90000000-0000-0000-0000-0000000000b1','recordId','attendance:90000000-0000-0000-0000-0000000000b1:2026-10-05','kind','attendance','action','upsert','baseRevision',base,'lessonDate','2026-10-05','curriculumVersion','templates-b50c7f987e101b7e','payload',jsonb_build_object('status','present'))||extra$$;
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.mop(1,0))->>'status'='accepted' and result_apply('20000000-0000-0000-0000-000000000004',pg_temp.mop(2,1,'{"action":"delete","payload":{}}'))->>'status'='accepted' and result_apply('20000000-0000-0000-0000-000000000004',pg_temp.mop(3,1))->>'status'='pending_review' and result_apply('20000000-0000-0000-0000-000000000004',pg_temp.mop(4,2,'{"payload":{"status":"late"}}'))->>'status'='rejected','migration fixture: accepted, tombstone, pending conflict and rejected receipt committed');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select result_mint('20000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002',jsonb_build_object('datasetId','decksupervisor:80000000-0000-0000-0000-0000000000b1','instructorId','50000000-0000-0000-0000-0000000000b1','uploadHash',encode(sha256(convert_to('audit-upload-M','UTF8')),'hex'),'readHash',encode(sha256(convert_to('audit-read-M','UTF8')),'hex'),'courses','[{"sourceId":"audit:course:m","classId":"60000000-0000-0000-0000-0000000000b1","swimmers":[{"sourceId":"audit-swimmer-m","enrollmentId":"90000000-0000-0000-0000-0000000000b1"}]}]'::jsonb));
commit;
create temp table audit_migration as select pg_temp.result_fingerprint() as data;
select pg_temp.assert_true((select jsonb_array_length(data->'result_records')=1 and jsonb_array_length(data->'result_history')=2 and jsonb_array_length(data->'result_conflicts')=1 and jsonb_array_length(data->'result_operations')=4 and jsonb_array_length(data->'result_grants')=1 and jsonb_array_length(data->'result_aliases')=1 from audit_migration),'migration fixture is durable across commit');
-- Simulate a hosted project's default privileges and an earlier leaky state.
grant all on public.result_datasets,public.result_courses,public.result_enrollments,public.result_aliases,public.result_grants,public.result_records,public.result_history,public.result_operations,public.result_conflicts,public.result_curriculum to anon,authenticated;
grant select on public.result_grants to public;
grant execute on function public.result_mint(uuid,uuid,jsonb),public.result_validate(jsonb,uuid),public.result_check_grant(text,boolean),public.result_class_access(uuid,uuid,uuid),public.result_creator_access(uuid,uuid),public.result_registry(uuid,jsonb,boolean),public.result_admin(uuid,text,jsonb),public.result_apply(uuid,jsonb,text),public.result_snapshot(uuid,uuid,text) to public,anon,authenticated;
select pg_temp.assert_true(not pg_temp.result_acl_ok() and has_table_privilege('anon','public.result_grants','SELECT') and has_function_privilege('authenticated','public.result_mint(uuid,uuid,jsonb)','EXECUTE'),'leaky starting state established for the re-apply test');
-- 1) A failure late in the migration must roll the whole migration back.
create function public.audit_reject_curriculum() returns trigger language plpgsql as $$begin raise exception 'Injected results migration failure'; end$$;
create trigger audit_reject_curriculum before insert on public.result_curriculum for each statement execute function public.audit_reject_curriculum();
\echo 'EXPECTED: the next application of supabase_results_sync.sql fails (injected) and prints errors'
\set ON_ERROR_STOP off
\ir ../supabase_results_sync.sql
\set ON_ERROR_STOP on
\echo 'END of expected injected-failure output'
select pg_temp.assert_true(has_table_privilege('anon','public.result_grants','SELECT') and has_function_privilege('authenticated','public.result_mint(uuid,uuid,jsonb)','EXECUTE') and not pg_temp.result_acl_ok(),'failed migration is atomic: its revokes were rolled back, nothing half-applied');
select pg_temp.assert_true(pg_temp.result_fingerprint()=(select data from audit_migration),'failed migration left every result row untouched');
drop trigger audit_reject_curriculum on public.result_curriculum;
drop function public.audit_reject_curriculum();
-- 2) Re-applying over live data preserves it and closes every leaked privilege.
\ir ../supabase_results_sync.sql
select pg_temp.assert_true(pg_temp.result_fingerprint()=(select data from audit_migration),'re-applying the migration preserves every result row (records, history, conflicts, receipts, grants, registry, curriculum)');
select pg_temp.assert_true(pg_temp.result_acl_ok() and not has_table_privilege('anon','public.result_grants','SELECT') and not has_function_privilege('authenticated','public.result_mint(uuid,uuid,jsonb)','EXECUTE') and not has_function_privilege('anon','public.result_snapshot(uuid,uuid,text)','EXECUTE'),'re-applying the migration removes leaked table, PUBLIC and function grants');
\ir ../supabase_results_sync.sql
select pg_temp.assert_true(pg_temp.result_fingerprint()=(select data from audit_migration) and pg_temp.result_acl_ok(),'a further application is a no-op');
begin;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select pg_temp.assert_true(result_apply('20000000-0000-0000-0000-000000000004',pg_temp.mop(1,0),'audit-upload-M')->>'status'='already_accepted' and jsonb_array_length(result_snapshot(null,null,'audit-read-M')::jsonb->'history')=2 and (result_snapshot(null,null,'audit-read-M')::jsonb->'records'->0->>'deleted')::boolean and result_apply('20000000-0000-0000-0000-000000000004',pg_temp.mop(3,1),'audit-upload-M')->>'status'='pending_review' and result_apply('20000000-0000-0000-0000-000000000004',pg_temp.mop(4,2,'{"payload":{"status":"late"}}'),'audit-upload-M')->>'status'='rejected','grants, receipts, tombstones and pending conflicts keep working after re-application');
rollback;
-- Remove the committed synthetic fixture from the disposable database.
begin;
set local session_replication_role=replica;
delete from public.result_conflicts where session_id='20000000-0000-0000-0000-000000000004';
delete from public.result_operations where session_id='20000000-0000-0000-0000-000000000004';
delete from public.result_history where session_id='20000000-0000-0000-0000-000000000004';
delete from public.result_records where session_id='20000000-0000-0000-0000-000000000004';
delete from public.result_grants where session_id='20000000-0000-0000-0000-000000000004';
delete from public.result_aliases where session_id='20000000-0000-0000-0000-000000000004';
delete from public.result_enrollments where session_id='20000000-0000-0000-0000-000000000004';
delete from public.result_courses where session_id='20000000-0000-0000-0000-000000000004';
delete from public.result_datasets where session_id='20000000-0000-0000-0000-000000000004';
delete from public.instructor_classes where id='60000000-0000-0000-0000-0000000000b1';
delete from public.instructor_assignments where id='50000000-0000-0000-0000-0000000000b1';
delete from public.session_instructors where id='50000000-0000-0000-0000-0000000000b1';
commit;
drop table audit_migration;
select pg_temp.assert_true(not exists(select 1 from public.result_datasets) and not exists(select 1 from public.result_records) and not exists(select 1 from public.result_grants) and not exists(select 1 from public.instructor_classes where code like 'AUDIT-%'),'audit fixture removed');
