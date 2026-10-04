-- Disposable database only; run after instructor schema installation.
\set ON_ERROR_STOP on
begin;
-- Simulate a legacy full-time link without relaxing validation for new links.
alter table instructor_assignments disable trigger instructor_account_link_guard;
insert into instructor_assignments(session_id,id,name,account_id) values
 ('20000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000009','Legacy','00000000-0000-0000-0000-000000000001');
alter table instructor_assignments enable trigger instructor_account_link_guard;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*)=1 from search_linkable_part_time_profiles('20000000-0000-0000-0000-000000000001','User 03',25)), 'link search includes existing team members');
select pg_temp.assert_true((select count(*)=1 from search_linkable_part_time_profiles('20000000-0000-0000-0000-000000000001','user07@example.invalid',25)), 'link search includes pending invitees by email');
select pg_temp.assert_true((select count(*)=1 from search_linkable_part_time_profiles('20000000-0000-0000-0000-000000000004','  User 07  ',25)), 'owner without team can search with trimmed names');
select pg_temp.assert_true((select count(*)=0 from search_linkable_part_time_profiles('20000000-0000-0000-0000-000000000004','User 01',25)), 'full-time accounts excluded');
select pg_temp.assert_true((select count(*)=0 from search_linkable_part_time_profiles('20000000-0000-0000-0000-000000000004',' ',25)), 'blank query returns no directory');
select pg_temp.assert_true((select count(*)=1 from search_linkable_part_time_profiles('20000000-0000-0000-0000-000000000004','User',1)), 'search limit applied');
select pg_temp.assert_true((select count(*)=1 and bool_and(account->>'email'='user01@example.invalid') from instructor_assignment_accounts('20000000-0000-0000-0000-000000000004')), 'owner can display legacy linked account');
update instructor_assignments set account_id=account_id,name='Legacy renamed';
do $$
begin
 begin
  update instructor_assignments set account_id='00000000-0000-0000-0000-000000000005';
  raise exception 'FAIL: new full-time link accepted';
 exception when check_violation then raise notice 'PASS: full-time target rejected'; end;
 begin
  insert into instructor_assignments(session_id,id,name,account_id) values
   ('20000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000008','Invalid','00000000-0000-0000-0000-000000000005');
  raise exception 'FAIL: new full-time insert accepted';
 exception when check_violation then raise notice 'PASS: full-time insert rejected'; end;
end $$;
update instructor_assignments set account_id=null;
select pg_temp.assert_true((select account is null and account_id is null from instructor_assignment_accounts('20000000-0000-0000-0000-000000000004')), 'legacy unlink allowed');
update instructor_assignments set account_id='00000000-0000-0000-0000-000000000007';
select pg_temp.assert_true((select account->>'email'='user07@example.invalid' from instructor_assignment_accounts('20000000-0000-0000-0000-000000000004')), 'part-time link allowed');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*)=0 from search_linkable_part_time_profiles('20000000-0000-0000-0000-000000000001','User',25)), 'shared-session editor cannot search');
select pg_temp.assert_true((select count(*)=0 from instructor_assignment_accounts('20000000-0000-0000-0000-000000000004')), 'other account cannot display links');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000007","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*)=0 from search_linkable_part_time_profiles('20000000-0000-0000-0000-000000000004','User',25)), 'linked instructor cannot search');
select pg_temp.assert_true((select count(*)=0 from instructor_assignment_accounts('20000000-0000-0000-0000-000000000004')), 'linked instructor cannot display owner account links');
reset role;
set role anon;
select pg_temp.denied($q$select * from search_linkable_part_time_profiles('20000000-0000-0000-0000-000000000004','User',25)$q$, 'anonymous search denied');
select pg_temp.denied($q$select * from instructor_assignment_accounts('20000000-0000-0000-0000-000000000004')$q$, 'anonymous linked accounts denied');
reset role;
rollback;
