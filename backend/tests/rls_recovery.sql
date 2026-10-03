\set ON_ERROR_STOP on
\ir ../supabase_recovery.sql
\ir ../supabase_recovery.sql
begin;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000007","role":"authenticated"}',true);
select register_recovery_grant(repeat('a',64),now()+interval '10 minutes');
select pg_temp.assert_true(claim_recovery_grant(repeat('a',64)),'first recovery claim succeeds');
select pg_temp.assert_true(not claim_recovery_grant(repeat('a',64)),'concurrent recovery claim denied');
select finish_recovery_grant(repeat('a',64),false);
select pg_temp.assert_true(claim_recovery_grant(repeat('a',64)),'provider rejection allows retry');
select finish_recovery_grant(repeat('a',64),true);
select pg_temp.assert_true(not claim_recovery_grant(repeat('a',64)),'used recovery grant cannot replay');
select register_recovery_grant(repeat('b',64),now()+interval '10 minutes');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000008","role":"authenticated"}',true);
select pg_temp.assert_true(not claim_recovery_grant(repeat('b',64)),'cross-account claim denied');
select pg_temp.assert_true((select count(*)=0 from password_recovery_grants),'cross-account grant metadata hidden');
select pg_temp.denied($q$insert into password_recovery_grants(id,user_id,expires_at) values(repeat('c',64),auth.uid(),now()+interval '10 minutes')$q$,'direct grant mutation denied');
reset role;
update password_recovery_grants set expires_at=now()-interval '1 minute' where id=repeat('b',64);
set role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000007","role":"authenticated"}',true);
select pg_temp.assert_true(not claim_recovery_grant(repeat('b',64)),'expired grant denied');
reset role;
set role anon;
select pg_temp.denied($q$select register_recovery_grant(repeat('d',64),now()+interval '10 minutes')$q$,'guest grant RPC denied');
reset role;
rollback;
