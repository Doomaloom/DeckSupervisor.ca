-- TEST ONLY: minimal Supabase auth surface for an EMPTY disposable database.
-- Never run this against a hosted project.
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
$$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

\ir ../supabase_tables.sql
\ir ../supabase_tables_update.sql

-- The original base file used profile_id/uid; the historical update attempted
-- p_profile_id/p_uid and fails with CREATE OR REPLACE's argument-name rule.
-- Installing the base file here exercises compatibility with that older state.
\ir ../supabase_rls.sql
\ir ../supabase_invite_rpc.sql

create table public.unrelated_test_table (id integer);
alter table public.unrelated_test_table enable row level security;
create policy unrelated_policy on public.unrelated_test_table for select using (true);
create policy forgotten_permissive_policy on public.sessions for all using (true) with check (true);
grant all on all tables in schema public to anon, authenticated, service_role;
grant select (email), update (account_type) on public.profiles to anon;

insert into auth.users select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
from generate_series(1, 10) n;
insert into public.profiles(id, email, first_name, account_type)
select id, 'user' || right(id::text, 2) || '@example.invalid', 'User ' || right(id::text, 2),
  case when right(id::text, 2) in ('01', '05', '06') then 'full_time' else 'part_time' end
from auth.users where right(id::text, 2) <> '10';

insert into public.teams(id, owner_id, name) values
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Team A'),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'Team B');
insert into public.team_members(team_id, user_id)
select '10000000-0000-0000-0000-000000000001', id from public.profiles
where right(id::text, 2) in ('02', '03', '04', '06', '09');
insert into public.team_invites(id, team_id, invitee_id) values
('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000007'),
('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000008'),
('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000007');
insert into public.sessions(id, team_id, created_by, session_day) values
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Monday'),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Tuesday'),
('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'Monday'),
('20000000-0000-0000-0000-000000000004', null, '00000000-0000-0000-0000-000000000002', 'Wednesday');
insert into public.session_shares(session_id, shared_by, shared_with, share_date, allow_roster_edits)
select '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', id,
  (now() at time zone 'America/Toronto')::date + case right(id::text, 2) when '09' then -1 when '08' then 1 else 0 end,
  right(id::text, 2) in ('03', '09', '08')
from public.profiles where right(id::text, 2) in ('03', '04', '08', '09');
insert into public.schematics(session_id, created_by)
select id, created_by from public.sessions;
insert into public.custom_rosters(id, session_id, owner_id, day, service_name)
select id, id, created_by, 'Monday', 'Swimming' from public.sessions;
insert into public.roster_level_edits(session_id, created_by, code, level)
select id, created_by, 'CLASS-A', '1' from public.sessions;
insert into public.roster_student_level_edits(session_id, created_by, code, student_name_hash, level)
select id, created_by, 'CLASS-A', 'hash', '1' from public.sessions;
insert into public.session_notes(id, session_id, created_by, note_type, text) values
('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'general', 'Owner note'),
('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'general', 'Editor note'),
('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000009', 'general', 'Expired-share note');
insert into public.session_reports(id, session_id, created_by, title)
select id, session_id, created_by, text from public.session_notes;
insert into public.report_cards(session, day, instructor, number_of_report_cards, team_id, created_by)
select 'Fall 2026', session_day, 'Instructor', 4, team_id, created_by from public.sessions;
insert into public.request_assignments(event_id, term, location, instructor)
values ('event', 'Fall', 'Pool', 'Instructor');
