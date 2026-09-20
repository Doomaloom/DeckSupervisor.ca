-- TEST ONLY: run after rls_bootstrap.sql in a disposable PostgreSQL cluster.
\set ON_ERROR_STOP on
\pset tuples_only on

create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end;
$$;
create function pg_temp.denied(statement text, label text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when insufficient_privilege then
    raise notice 'PASS: %', label;
    return;
  end;
  raise exception 'FAIL (expected 42501): %', label;
end;
$$;
create function pg_temp.affects(statement text, expected bigint, label text) returns void language plpgsql as $$
declare actual bigint;
begin
  execute statement;
  get diagnostics actual = row_count;
  perform pg_temp.assert_true(actual = expected, label);
end;
$$;

-- Fingerprint every application row to prove migration and reruns preserve data.
create function pg_temp.app_data() returns jsonb language plpgsql as $$
declare result jsonb := '{}'; t text; rows jsonb;
begin
  foreach t in array array['profiles','teams','team_members','team_invites','sessions',
    'schematics','session_shares','session_notes','session_reports','roster_level_edits',
    'roster_student_level_edits','custom_rosters','report_cards','request_assignments'] loop
    execute format('select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.%I t', t) into rows;
    result := result || jsonb_build_object(t, rows);
  end loop;
  return result;
end;
$$;
create temporary table original_data as select pg_temp.app_data() as snapshot;
\ir ../supabase_rls_reset.sql
\ir ../supabase_rls_reset.sql
select pg_temp.assert_true((select snapshot from original_data) = pg_temp.app_data(), 'upgrade and rerun preserve every application row');
select pg_temp.assert_true((select count(*) = 14 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relrowsecurity and c.relname <> 'unrelated_test_table'), 'all 14 app tables have RLS');
select pg_temp.assert_true(not exists(select 1 from pg_policies where policyname = 'forgotten_permissive_policy'), 'unknown legacy policy removed');
select pg_temp.assert_true(exists(select 1 from pg_policies where policyname = 'unrelated_policy'), 'unrelated table policy preserved');
select pg_temp.assert_true(not exists(select 1 from pg_policies where schemaname = 'public'
  and tablename <> 'unrelated_test_table' and roles <> array['authenticated']::name[]), 'every app policy targets authenticated');
select pg_temp.assert_true(not has_column_privilege('anon', 'public.profiles', 'email', 'SELECT'), 'old anonymous column grants removed');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.sessions', 'TRUNCATE'), 'authenticated cannot bypass RLS through truncate');
select pg_temp.assert_true(not has_function_privilege('anon', 'public.accept_team_invite(uuid)', 'EXECUTE'), 'anonymous RPC grant including PUBLIC removed');
select pg_temp.assert_true(not has_function_privilege('authenticated', 'public.can_read_profile(uuid,uuid)', 'EXECUTE'), 'legacy arbitrary-user helper closed');

begin;
set local role anon;
select pg_temp.denied('select * from public.profiles', 'anonymous cannot read profiles');
select pg_temp.denied('select public.accept_team_invite(''40000000-0000-0000-0000-000000000001'')', 'anonymous cannot accept invite');
do $$
declare t text;
begin
  foreach t in array array['teams','team_members','team_invites','sessions','schematics','session_shares',
    'session_notes','session_reports','roster_level_edits','roster_student_level_edits','custom_rosters','report_cards','request_assignments'] loop
    perform pg_temp.denied(format('select * from public.%I', t), 'anonymous denied: ' || t);
  end loop;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select pg_temp.denied('select public.accept_team_invite(''40000000-0000-0000-0000-000000000001'')', 'null-UID invite accept rejected');
select pg_temp.denied('select public.decline_team_invite(''40000000-0000-0000-0000-000000000001'')', 'null-UID invite decline rejected');
select pg_temp.denied('select public.revoke_team_invite(''40000000-0000-0000-0000-000000000001'')', 'null-UID invite revoke rejected');
select pg_temp.assert_true((select count(*) = 0 from public.sessions), 'null UID cannot read sessions');

-- Account provisioning; ordinary users cannot self-promote.
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000010"}', true);
select pg_temp.denied($q$insert into public.profiles(id, account_type) values (auth.uid(), 'full_time')$q$, 'full-time self-registration denied');
insert into public.profiles(id, first_name) values (auth.uid(), 'New user');
update public.profiles set first_name = 'Updated user' where id = auth.uid();
select pg_temp.assert_true((select first_name = 'Updated user' from public.profiles where id = auth.uid()), 'own profile insert/update works');
select pg_temp.denied($q$update public.profiles set account_type = 'full_time' where id = auth.uid()$q$, 'self-promotion denied');
select pg_temp.denied($q$insert into public.teams(owner_id, name) values (auth.uid(), 'Unauthorized')$q$, 'part-time team creation denied');

-- Unrelated user: the future share must not open current session access.
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000008"}', true);
select pg_temp.assert_true((select count(*) = 0 from public.sessions), 'future share does not grant current access');
select pg_temp.assert_true((select count(*) = 0 from public.team_members), 'unrelated user cannot enumerate memberships');
select pg_temp.assert_true((select count(*) = 1 from public.request_assignments), 'assignments retain signed-in global reads');
select pg_temp.denied($q$insert into public.request_assignments(event_id, term, location, instructor) values ('new','Fall','Pool','X')$q$, 'part-time assignment insert denied');
select pg_temp.affects($q$update public.request_assignments set instructor = 'X'$q$, 0, 'part-time assignment update denied');
select pg_temp.affects('delete from public.request_assignments', 0, 'part-time assignment delete denied');
select pg_temp.assert_true(not public.can_read_session('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'), 'RPC cannot impersonate session owner');
select pg_temp.assert_true((select count(*) = 0 from public.search_invitable_part_time_profiles('10000000-0000-0000-0000-000000000001','',25)), 'non-owner profile search returns nothing');
select pg_temp.denied($q$insert into public.sessions(team_id, created_by, session_day) values ('10000000-0000-0000-0000-000000000001',auth.uid(),'Monday')$q$, 'outsider team-session creation denied');
select pg_temp.denied($q$insert into public.team_members(team_id, user_id) values ('10000000-0000-0000-0000-000000000001',auth.uid())$q$, 'self-enrollment denied');
select pg_temp.denied($q$select public.accept_team_invite('40000000-0000-0000-0000-000000000001')$q$, 'wrong invitee denied');
do $$
declare t text; n bigint;
begin
  foreach t in array array['schematics','session_notes','session_reports','roster_level_edits',
    'roster_student_level_edits','custom_rosters','report_cards'] loop
    execute format('select count(*) from public.%I', t) into n;
    perform pg_temp.assert_true(n = 0, 'outsider cannot read ' || t);
  end loop;
end;
$$;

-- Session owner: supported writes and attempted changes of security boundaries.
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000002"}', true);
select pg_temp.assert_true((select count(*) = 3 from public.sessions), 'owner sees own team and personal sessions');
select pg_temp.assert_true((select count(*) = 5 from public.team_members), 'part-time member sees teammate directory');
select pg_temp.assert_true((select count(*) = 6 from public.profiles), 'team profile joins include teammates and team owner');
select pg_temp.assert_true(public.can_edit_session('20000000-0000-0000-0000-000000000001',auth.uid()), 'custom roster edit RPC remains compatible');
select pg_temp.assert_true(public.can_read_session('20000000-0000-0000-0000-000000000001',auth.uid()), 'custom roster read RPC remains compatible');
select pg_temp.affects($q$update public.sessions set location = 'Updated pool' where id = '20000000-0000-0000-0000-000000000001'$q$, 1, 'owner can edit session');
select pg_temp.denied($q$update public.sessions set team_id = '10000000-0000-0000-0000-000000000002' where id = '20000000-0000-0000-0000-000000000001'$q$, 'cannot move session into unrelated team');
select pg_temp.denied($q$update public.sessions set created_by = '00000000-0000-0000-0000-000000000008' where id = '20000000-0000-0000-0000-000000000001'$q$, 'cannot reassign session owner');
select pg_temp.denied($q$update public.session_shares set session_id = '20000000-0000-0000-0000-000000000003' where shared_with = '00000000-0000-0000-0000-000000000003'$q$, 'cannot repoint share into another session');
select pg_temp.denied($q$update public.session_notes set session_id = '20000000-0000-0000-0000-000000000003' where id = '30000000-0000-0000-0000-000000000001'$q$, 'cannot inject owned note into unauthorized session');
select pg_temp.denied($q$update public.session_reports set created_by = auth.uid() where id = '30000000-0000-0000-0000-000000000002'$q$, 'cannot take authorship of report');
select pg_temp.affects($q$update public.session_reports set title = 'Owner moderation' where id = '30000000-0000-0000-0000-000000000002'$q$, 1, 'owner can edit another author report');
insert into public.schematics(session_id, created_by, data)
values ('20000000-0000-0000-0000-000000000001', auth.uid(), '{"saved":true}')
on conflict (session_id) do update set created_by = excluded.created_by, data = excluded.data;
select pg_temp.assert_true((select data ->> 'saved' = 'true' from public.schematics where session_id = '20000000-0000-0000-0000-000000000001'), 'schematic upsert works');
select pg_temp.affects($q$update public.custom_rosters set service_name = 'Updated' where session_id = '20000000-0000-0000-0000-000000000001'$q$, 1, 'owner can update custom roster');

-- Active share with roster edit permission: class/student upserts must work
-- even if the session owner originally created the override.
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000003"}', true);
select pg_temp.assert_true((select count(*) = 1 from public.sessions), 'coverage editor sees only shared session');
select pg_temp.affects($q$update public.sessions set location = 'Unauthorized'$q$, 0, 'coverage editor cannot edit session');
select pg_temp.affects($q$update public.schematics set data = '{}'$q$, 0, 'coverage editor cannot edit schematic');
select pg_temp.affects($q$update public.custom_rosters set service_name = 'Unauthorized'$q$, 0, 'coverage editor cannot edit custom roster');
insert into public.roster_level_edits(session_id, created_by, code, level)
values ('20000000-0000-0000-0000-000000000001',auth.uid(),'CLASS-A','2')
on conflict (session_id, code) do update set created_by = excluded.created_by, level = excluded.level;
insert into public.roster_student_level_edits(session_id, created_by, code, student_name_hash, level)
values ('20000000-0000-0000-0000-000000000001',auth.uid(),'CLASS-A','hash','2')
on conflict (session_id, code, student_name_hash) do update set created_by = excluded.created_by, level = excluded.level;
select pg_temp.assert_true((select level = '2' and created_by = auth.uid() from public.roster_level_edits), 'coverage class upsert keeps last-editor semantics');
select pg_temp.assert_true((select level = '2' and created_by = auth.uid() from public.roster_student_level_edits), 'coverage student upsert works');
select pg_temp.denied($q$update public.roster_level_edits set created_by = '00000000-0000-0000-0000-000000000008'$q$, 'cannot forge roster edit attribution');
select pg_temp.affects($q$update public.session_notes set text = 'Updated by author' where id = '30000000-0000-0000-0000-000000000002'$q$, 1, 'share author can edit own note');
select pg_temp.affects($q$update public.session_notes set text = 'Unauthorized' where id = '30000000-0000-0000-0000-000000000001'$q$, 0, 'share author cannot edit owner note');
select pg_temp.denied($q$insert into public.session_shares(session_id, shared_by, shared_with, share_date) values ('20000000-0000-0000-0000-000000000001',auth.uid(),'00000000-0000-0000-0000-000000000007',current_date)$q$, 'coverage recipient cannot reshare');

-- Read-only coverage can contribute notes/reports, as in the current app.
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000004"}', true);
select pg_temp.assert_true((select count(*) = 1 from public.sessions), 'read-only coverage can read session');
select pg_temp.affects($q$update public.roster_level_edits set level = '9'$q$, 0, 'read-only coverage cannot edit class overrides');
select pg_temp.affects($q$update public.roster_student_level_edits set level = '9'$q$, 0, 'read-only coverage cannot edit student overrides');
select pg_temp.denied($q$insert into public.roster_level_edits(session_id, created_by, code, level) values ('20000000-0000-0000-0000-000000000001',auth.uid(),'CLASS-B','9')$q$, 'read-only coverage cannot insert overrides');
insert into public.session_notes(session_id, created_by, note_type, text)
values ('20000000-0000-0000-0000-000000000001',auth.uid(),'general','Coverage note');
insert into public.session_reports(session_id, created_by, title)
values ('20000000-0000-0000-0000-000000000001',auth.uid(),'Coverage report');
select pg_temp.affects('delete from public.session_reports where created_by = auth.uid()', 1, 'coverage author can delete own report');

-- Expired shares: authorship alone no longer permits deletion or writes.
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000009"}', true);
select pg_temp.assert_true((select count(*) = 0 from public.sessions), 'expired share grants no session reads');
select pg_temp.affects('delete from public.session_notes where created_by = auth.uid()', 0, 'expired share cannot delete old notes');
select pg_temp.affects('delete from public.session_reports where created_by = auth.uid()', 0, 'expired share cannot delete old reports');
select pg_temp.affects($q$update public.roster_level_edits set level = '9'$q$, 0, 'expired editable share cannot update roster');

-- Supervisors retain team-scoped read access, without ownership writes.
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}', true);
select pg_temp.assert_true((select count(*) = 2 from public.sessions), 'full-time owner sees team sessions, not personal or other team sessions');
select pg_temp.affects($q$update public.sessions set location = 'Unauthorized'$q$, 0, 'team owner cannot edit member-owned session');
select pg_temp.assert_true((select count(*) = 2 from public.report_cards), 'team report cards readable by supervisor');
select pg_temp.affects('delete from public.report_cards', 0, 'supervisor cannot delete another author report cards');
select pg_temp.affects($q$update public.request_assignments set instructor = 'Updated'$q$, 1, 'full-time assignment update allowed');
insert into public.request_assignments(event_id, term, location, instructor) values ('new','Fall','Pool','X');
select pg_temp.affects($q$delete from public.request_assignments where event_id = 'new'$q$, 1, 'full-time assignment insert/delete allowed');
insert into public.teams(owner_id, name) values (auth.uid(), 'New team');
select pg_temp.assert_true((select count(*) > 0 from public.search_invitable_part_time_profiles('10000000-0000-0000-0000-000000000001','',25)), 'owner invitation search works');
select pg_temp.denied($q$update public.team_invites set status = 'accepted'$q$, 'direct invite status update forbidden');
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000006"}', true);
select pg_temp.assert_true((select count(*) = 2 from public.sessions), 'full-time member sees team sessions');
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000005"}', true);
select pg_temp.assert_true((select count(*) = 1 from public.sessions), 'other-team supervisor cannot read team A');
select public.revoke_team_invite('40000000-0000-0000-0000-000000000002');
select pg_temp.assert_true((select status = 'revoked' from public.team_invites where id = '40000000-0000-0000-0000-000000000002'), 'team owner can revoke invite');

-- Invite RPCs preserve their argument names and add membership atomically.
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000007"}', true);
select pg_temp.assert_true((select count(*) = 2 from public.teams), 'invitee can read invited teams before joining');
select public.accept_team_invite(invite_id => '40000000-0000-0000-0000-000000000001');
select pg_temp.assert_true(exists(select 1 from public.team_members where user_id = auth.uid()), 'accept creates own membership');
select pg_temp.assert_true((select status = 'accepted' from public.team_invites where id = '40000000-0000-0000-0000-000000000001'), 'accept changes status');
select pg_temp.denied($q$select public.accept_team_invite('40000000-0000-0000-0000-000000000001')$q$, 'accepted invite cannot be accepted again');
select public.decline_team_invite('40000000-0000-0000-0000-000000000003');
select pg_temp.assert_true((select status = 'declined' from public.team_invites where id = '40000000-0000-0000-0000-000000000003'), 'invitee can decline');

-- Service-role operations remain available for the backend's session creation.
\ir rls_part_time_workflow.sql
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
update public.profiles set account_type = 'full_time' where id = '00000000-0000-0000-0000-000000000010';
insert into public.sessions(created_by, session_day) values ('00000000-0000-0000-0000-000000000010', 'Sunday');
select pg_temp.assert_true((select count(*) = 5 from public.sessions), 'service role bypass remains available');
rollback;
\echo RLS regression tests passed.
