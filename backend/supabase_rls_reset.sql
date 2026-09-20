-- DeckSupervisor: complete, repeatable RLS replacement for the existing schema.
-- Run this ENTIRE file in Supabase SQL Editor as postgres (or the table owner
-- with BYPASSRLS). Supersedes supabase_rls.sql, supabase_rls_update.sql, and
-- supabase_invite_rpc.sql. Table/schema migrations must already be applied.
-- Replaces ALL policies on the 14 named application tables, including policies
-- added manually. No application rows are changed. Other tables are untouched.
-- See docs/database-rls.md for the permission matrix and verification commands.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Fail before replacing policies if this is not the expected application schema.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'teams', 'team_members', 'team_invites', 'sessions',
    'schematics', 'session_shares', 'session_notes', 'session_reports',
    'roster_level_edits', 'roster_student_level_edits', 'custom_rosters',
    'report_cards', 'request_assignments'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = table_name and c.relkind = 'r'
    ) then
      raise exception 'Missing application table public.%. Apply the schema migrations first.', table_name;
    end if;
  end loop;
end;
$$;

-- Keep this schema OUT of Supabase's exposed schemas. Policies can use it
-- without exposing its definer functions as Data API RPC endpoints.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated, service_role;

create or replace function app_private.is_full_time()
returns boolean language sql stable security definer
set search_path = '' set row_security = off
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and account_type = 'full_time'
  );
$$;

create or replace function app_private.is_team_owner(team uuid)
returns boolean language sql stable security definer
set search_path = '' set row_security = off
as $$
  select exists (
    select 1 from public.teams
    where id = team and owner_id = (select auth.uid())
  );
$$;

create or replace function app_private.is_team_member(team uuid)
returns boolean language sql stable security definer
set search_path = '' set row_security = off
as $$
  select exists (
    select 1 from public.team_members
    where team_id = team and user_id = (select auth.uid())
  );
$$;

create or replace function app_private.is_team_invitee(team uuid)
returns boolean language sql stable security definer
set search_path = '' set row_security = off
as $$
  select exists (
    select 1 from public.team_invites
    where team_id = team and invitee_id = (select auth.uid()) and status = 'pending'
  );
$$;

create or replace function app_private.can_read_profile(profile_id uuid)
returns boolean language sql stable security definer
set search_path = '' set row_security = off
as $$
  select profile_id = (select auth.uid())
    or exists (
      select 1 from public.team_members mine
      join public.team_members other on other.team_id = mine.team_id
      where mine.user_id = (select auth.uid()) and other.user_id = profile_id
    )
    or exists (
      select 1 from public.teams t
      join public.team_members m on m.team_id = t.id
      where (t.owner_id = (select auth.uid()) and m.user_id = profile_id)
         or (m.user_id = (select auth.uid()) and t.owner_id = profile_id)
    )
    or exists (
      select 1 from public.team_invites i
      join public.teams t on t.id = i.team_id
      where i.status = 'pending'
        and ((t.owner_id = (select auth.uid()) and i.invitee_id = profile_id)
          or (i.invitee_id = (select auth.uid()) and t.owner_id = profile_id))
    );
$$;

create or replace function app_private.is_session_owner(session uuid)
returns boolean language sql stable security definer
set search_path = '' set row_security = off
as $$
  select exists (
    select 1 from public.sessions
    where id = session and created_by = (select auth.uid())
  );
$$;

create or replace function app_private.can_read_session(session uuid)
returns boolean language sql stable security definer
set search_path = '' set row_security = off
as $$
  select app_private.is_session_owner(session)
    or exists (
      select 1 from public.session_shares
      where session_id = session and shared_with = (select auth.uid())
        and share_date = (now() at time zone 'America/Toronto')::date
    )
    or exists (
      select 1 from public.sessions s
      where s.id = session and app_private.is_full_time()
        and (app_private.is_team_owner(s.team_id) or app_private.is_team_member(s.team_id))
    );
$$;

create or replace function app_private.can_edit_roster(session uuid)
returns boolean language sql stable security definer
set search_path = '' set row_security = off
as $$
  select app_private.is_session_owner(session)
    or exists (
      select 1 from public.session_shares
      where session_id = session and shared_with = (select auth.uid())
        and share_date = (now() at time zone 'America/Toronto')::date
        and allow_roster_edits
    );
$$;

-- Preserve the two public RPC interfaces used by the custom-roster backend.
-- Caller-supplied p_uid cannot be used to probe someone else's permissions.
create or replace function public.can_read_session(p_session_id uuid, p_uid uuid)
returns boolean language sql stable security invoker
set search_path = ''
as $$
  select coalesce(p_uid = (select auth.uid()), false)
    and app_private.can_read_session(p_session_id);
$$;

create or replace function public.can_edit_session(p_session_id uuid, p_uid uuid)
returns boolean language sql stable security invoker
set search_path = ''
as $$
  select coalesce(p_uid = (select auth.uid()), false)
    and app_private.is_session_owner(p_session_id);
$$;

-- RLS checks rows, not which columns changed. Protect identities and authorship
-- against moving an authorized row into another user's session or ownership.
create or replace function app_private.guard_row_identity()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  column_name text;
begin
  if current_user in ('authenticated', 'anon') or auth.role() in ('authenticated', 'anon') then
    foreach column_name in array tg_argv loop
      if (to_jsonb(new) -> column_name) is distinct from (to_jsonb(old) -> column_name) then
        raise exception '% cannot be changed on %', column_name, tg_table_name using errcode = '42501';
      end if;
    end loop;
    -- Owners may move their session only into a team they belong to (or make it
    -- personal). Losing membership does not remove ownership of an existing row.
    if tg_table_name = 'sessions' then
      if new.team_id is distinct from old.team_id and new.team_id is not null
        and not (app_private.is_team_owner(new.team_id) or app_private.is_team_member(new.team_id)) then
        raise exception 'Cannot move session into another team' using errcode = '42501';
      end if;
    end if;
    -- These upserts record the last editor in created_by; keep that behavior.
    if tg_table_name in ('roster_level_edits', 'roster_student_level_edits') then
      if new.created_by is distinct from old.created_by
        and new.created_by is distinct from auth.uid() then
        raise exception 'Cannot attribute roster edits to another user' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function app_private.guard_profile_account_type()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') or auth.role() in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if new.account_type is distinct from 'part_time' then
        raise exception 'account_type must default to part_time' using errcode = '42501';
      end if;
    elsif new.account_type is distinct from old.account_type then
      raise exception 'account_type cannot be changed by the user' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_account_type_guard on public.profiles;
create trigger profiles_account_type_guard before insert or update on public.profiles
for each row execute function app_private.guard_profile_account_type();

do $$
declare
  spec record;
begin
  for spec in select * from (values
    ('profiles', '''id'''),
    ('teams', '''id'', ''owner_id'''),
    ('sessions', '''id'', ''created_by'''),
    ('schematics', '''id'', ''session_id'', ''created_by'''),
    ('session_shares', '''id'', ''session_id'', ''shared_by'''),
    ('session_notes', '''id'', ''session_id'', ''created_by'''),
    ('session_reports', '''id'', ''session_id'', ''created_by'''),
    ('roster_level_edits', '''id'', ''session_id'', ''code'''),
    ('roster_student_level_edits', '''id'', ''session_id'', ''code'', ''student_name_hash'''),
    ('custom_rosters', '''id'', ''session_id'', ''owner_id'''),
    ('report_cards', '''id'', ''created_by'''),
    ('request_assignments', '''id''')
  ) as specs(table_name, arguments) loop
    execute format('drop trigger if exists app_rls_identity_guard on public.%I', spec.table_name);
    execute format(
      'create trigger app_rls_identity_guard before update on public.%I for each row execute function app_private.guard_row_identity(%s)',
      spec.table_name, spec.arguments
    );
  end loop;
end;
$$;

-- Remove policies by catalog lookup, so differently named legacy policies
-- cannot continue granting access alongside the replacements.
do $$
declare
  table_name text;
  policy_row record;
  columns text;
begin
  foreach table_name in array array[
    'profiles', 'teams', 'team_members', 'team_invites', 'sessions',
    'schematics', 'session_shares', 'session_notes', 'session_reports',
    'roster_level_edits', 'roster_student_level_edits', 'custom_rosters',
    'report_cards', 'request_assignments'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    for policy_row in select policyname from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy %I on public.%I', policy_row.policyname, table_name);
    end loop;
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    -- Table revokes do not remove independent column grants.
    select string_agg(format('%I', a.attname), ', ' order by a.attnum) into columns
      from pg_catalog.pg_attribute a
      where a.attrelid = format('public.%I', table_name)::regclass
        and a.attnum > 0 and not a.attisdropped;
    execute format('revoke all (%s) on table public.%I from public, anon, authenticated', columns, table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
  end loop;
end;
$$;

grant select, insert, update on public.profiles, public.teams to authenticated;
grant select, insert, delete on public.team_members to authenticated;
grant select, insert on public.team_invites to authenticated;
grant select, insert, update, delete on
  public.sessions, public.schematics, public.session_shares,
  public.session_notes, public.session_reports, public.roster_level_edits,
  public.roster_student_level_edits, public.custom_rosters,
  public.report_cards, public.request_assignments to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (app_private.can_read_profile(id));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = (select auth.uid()) and account_type = 'part_time');
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy teams_select on public.teams for select to authenticated
  using (owner_id = (select auth.uid()) or app_private.is_team_member(id) or app_private.is_team_invitee(id));
create policy teams_insert on public.teams for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select app_private.is_full_time()));
create policy teams_update on public.teams for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Members need the teammate directory to choose a coverage recipient.
create policy team_members_select on public.team_members for select to authenticated
  using (app_private.is_team_owner(team_id) or app_private.is_team_member(team_id));
create policy team_members_insert on public.team_members for insert to authenticated
  with check (app_private.is_team_owner(team_id));
create policy team_members_delete on public.team_members for delete to authenticated
  using (app_private.is_team_owner(team_id));

create policy team_invites_select on public.team_invites for select to authenticated
  using (invitee_id = (select auth.uid()) or app_private.is_team_owner(team_id));
create policy team_invites_insert on public.team_invites for insert to authenticated
  with check (app_private.is_team_owner(team_id) and status = 'pending');
-- Invite status changes are possible only through the authorized RPCs below.

create policy sessions_select on public.sessions for select to authenticated
  using (app_private.can_read_session(id));
create policy sessions_insert on public.sessions for insert to authenticated
  with check (created_by = (select auth.uid()) and
    (team_id is null or app_private.is_team_owner(team_id) or app_private.is_team_member(team_id)));
create policy sessions_update on public.sessions for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy sessions_delete on public.sessions for delete to authenticated
  using (created_by = (select auth.uid()));

create policy schematics_select on public.schematics for select to authenticated
  using (app_private.can_read_session(session_id));
create policy schematics_insert on public.schematics for insert to authenticated
  with check (created_by = (select auth.uid()) and app_private.is_session_owner(session_id));
create policy schematics_update on public.schematics for update to authenticated
  using (app_private.is_session_owner(session_id)) with check (app_private.is_session_owner(session_id));
create policy schematics_delete on public.schematics for delete to authenticated
  using (app_private.is_session_owner(session_id));

create policy session_shares_select on public.session_shares for select to authenticated
  using (shared_with = (select auth.uid()) or app_private.is_session_owner(session_id));
create policy session_shares_insert on public.session_shares for insert to authenticated
  with check (shared_by = (select auth.uid()) and app_private.is_session_owner(session_id));
create policy session_shares_update on public.session_shares for update to authenticated
  using (app_private.is_session_owner(session_id))
  with check (app_private.is_session_owner(session_id));
create policy session_shares_delete on public.session_shares for delete to authenticated
  using (app_private.is_session_owner(session_id));

create policy session_notes_select on public.session_notes for select to authenticated
  using (app_private.can_read_session(session_id));
create policy session_notes_insert on public.session_notes for insert to authenticated
  with check (created_by = (select auth.uid()) and app_private.can_read_session(session_id));
create policy session_notes_update on public.session_notes for update to authenticated
  using (app_private.can_read_session(session_id) and
    (created_by = (select auth.uid()) or app_private.is_session_owner(session_id)))
  with check (app_private.can_read_session(session_id) and
    (created_by = (select auth.uid()) or app_private.is_session_owner(session_id)));
create policy session_notes_delete on public.session_notes for delete to authenticated
  using (app_private.can_read_session(session_id) and
    (created_by = (select auth.uid()) or app_private.is_session_owner(session_id)));

create policy session_reports_select on public.session_reports for select to authenticated
  using (app_private.can_read_session(session_id));
create policy session_reports_insert on public.session_reports for insert to authenticated
  with check (created_by = (select auth.uid()) and app_private.can_read_session(session_id));
create policy session_reports_update on public.session_reports for update to authenticated
  using (app_private.can_read_session(session_id) and
    (created_by = (select auth.uid()) or app_private.is_session_owner(session_id)))
  with check (app_private.can_read_session(session_id) and
    (created_by = (select auth.uid()) or app_private.is_session_owner(session_id)));
create policy session_reports_delete on public.session_reports for delete to authenticated
  using (app_private.can_read_session(session_id) and
    (created_by = (select auth.uid()) or app_private.is_session_owner(session_id)));

create policy roster_level_edits_select on public.roster_level_edits for select to authenticated
  using (app_private.can_read_session(session_id));
create policy roster_level_edits_insert on public.roster_level_edits for insert to authenticated
  with check (created_by = (select auth.uid()) and app_private.can_edit_roster(session_id));
create policy roster_level_edits_update on public.roster_level_edits for update to authenticated
  using (app_private.can_edit_roster(session_id)) with check (app_private.can_edit_roster(session_id));
create policy roster_level_edits_delete on public.roster_level_edits for delete to authenticated
  using (app_private.can_edit_roster(session_id));

create policy roster_student_level_edits_select on public.roster_student_level_edits for select to authenticated
  using (app_private.can_read_session(session_id));
create policy roster_student_level_edits_insert on public.roster_student_level_edits for insert to authenticated
  with check (created_by = (select auth.uid()) and app_private.can_edit_roster(session_id));
create policy roster_student_level_edits_update on public.roster_student_level_edits for update to authenticated
  using (app_private.can_edit_roster(session_id)) with check (app_private.can_edit_roster(session_id));
create policy roster_student_level_edits_delete on public.roster_student_level_edits for delete to authenticated
  using (app_private.can_edit_roster(session_id));

create policy custom_rosters_select on public.custom_rosters for select to authenticated
  using (app_private.can_read_session(session_id));
create policy custom_rosters_insert on public.custom_rosters for insert to authenticated
  with check (owner_id = (select auth.uid()) and app_private.is_session_owner(session_id));
create policy custom_rosters_update on public.custom_rosters for update to authenticated
  using (app_private.is_session_owner(session_id)) with check (app_private.is_session_owner(session_id));
create policy custom_rosters_delete on public.custom_rosters for delete to authenticated
  using (app_private.is_session_owner(session_id));

create policy report_cards_select on public.report_cards for select to authenticated
  using (created_by = (select auth.uid()) or app_private.is_team_owner(team_id) or app_private.is_team_member(team_id));
create policy report_cards_insert on public.report_cards for insert to authenticated
  with check (created_by = (select auth.uid()) and
    (team_id is null or app_private.is_team_owner(team_id) or app_private.is_team_member(team_id)));
create policy report_cards_update on public.report_cards for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()) and
    (team_id is null or app_private.is_team_owner(team_id) or app_private.is_team_member(team_id)));
create policy report_cards_delete on public.report_cards for delete to authenticated
  using (created_by = (select auth.uid()));

-- This table has no team_id; retain its existing global signed-in read scope.
create policy request_assignments_select on public.request_assignments for select to authenticated
  using ((select auth.uid()) is not null);
create policy request_assignments_insert on public.request_assignments for insert to authenticated
  with check ((select app_private.is_full_time()));
create policy request_assignments_update on public.request_assignments for update to authenticated
  using ((select app_private.is_full_time())) with check ((select app_private.is_full_time()));
create policy request_assignments_delete on public.request_assignments for delete to authenticated
  using ((select app_private.is_full_time()));

-- Lock the pending invite before checking/changing it so accept/decline/revoke
-- cannot race. Explicit NULL checks avoid SQL's three-valued comparison trap.
create or replace function public.accept_team_invite(invite_id uuid)
returns void language plpgsql security definer
set search_path = '' set row_security = off
as $$
declare
  invitation public.team_invites%rowtype;
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select * into invitation from public.team_invites
    where id = invite_id and status = 'pending' for update;
  if not found or invitation.invitee_id is distinct from caller then
    raise exception 'Invite not found, not pending, or not authorized' using errcode = '42501';
  end if;
  insert into public.team_members (team_id, user_id, role)
    values (invitation.team_id, caller, 'member') on conflict do nothing;
  update public.team_invites set status = 'accepted' where id = invite_id;
end;
$$;

create or replace function public.decline_team_invite(invite_id uuid)
returns void language plpgsql security definer
set search_path = '' set row_security = off
as $$
declare
  invitation public.team_invites%rowtype;
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select * into invitation from public.team_invites
    where id = invite_id and status = 'pending' for update;
  if not found or invitation.invitee_id is distinct from caller then
    raise exception 'Invite not found, not pending, or not authorized' using errcode = '42501';
  end if;
  update public.team_invites set status = 'declined' where id = invite_id;
end;
$$;

create or replace function public.revoke_team_invite(invite_id uuid)
returns void language plpgsql security definer
set search_path = '' set row_security = off
as $$
declare
  invitation public.team_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select * into invitation from public.team_invites
    where id = invite_id and status = 'pending' for update;
  if not found or not app_private.is_team_owner(invitation.team_id) then
    raise exception 'Invite not found, not pending, or not authorized' using errcode = '42501';
  end if;
  update public.team_invites set status = 'revoked' where id = invite_id;
end;
$$;

create or replace function public.search_invitable_part_time_profiles(
  p_team_id uuid, p_query text, p_limit integer default 25
)
returns table (id uuid, first_name text, last_name text, email text)
language sql stable security definer
set search_path = '' set row_security = off
as $$
  select p.id, p.first_name, p.last_name, p.email from public.profiles p
  where (select auth.uid()) is not null and app_private.is_team_owner(p_team_id)
    and p.account_type = 'part_time'
    and not exists (
      select 1 from public.team_members m where m.team_id = p_team_id and m.user_id = p.id
    )
    and not exists (
      select 1 from public.team_invites i
      where i.team_id = p_team_id and i.invitee_id = p.id and i.status = 'pending'
    )
    and (nullif(trim(coalesce(p_query, '')), '') is null
      or p.first_name ilike '%' || trim(p_query) || '%'
      or p.last_name ilike '%' || trim(p_query) || '%'
      or p.email ilike '%' || trim(p_query) || '%')
  order by p.first_name, p.last_name, p.email
  limit greatest(1, least(coalesce(p_limit, 25), 50));
$$;

-- Revoke PUBLIC as well as anon: otherwise the default PUBLIC execute grant
-- continues to make a function callable by anonymous clients.
do $$
declare
  signature text;
  function_oid regprocedure;
begin
  foreach signature in array array[
    'public.is_full_time(uuid)', 'public.is_team_owner(uuid,uuid)',
    'public.is_team_member(uuid,uuid)', 'public.is_team_invitee(uuid,uuid)',
    'public.can_read_profile(uuid,uuid)', 'public.toronto_today()',
    'public.is_session_owner(uuid,uuid)', 'public.is_session_shared_today(uuid,uuid)',
    'public.can_edit_roster(uuid,uuid)', 'public.guard_profile_account_type()'
  ] loop
    function_oid := to_regprocedure(signature);
    if function_oid is not null then
      execute format('revoke all on function %s from public, anon, authenticated', function_oid);
    end if;
  end loop;
  foreach signature in array array[
    'app_private.is_full_time()', 'app_private.is_team_owner(uuid)',
    'app_private.is_team_member(uuid)', 'app_private.is_team_invitee(uuid)',
    'app_private.can_read_profile(uuid)', 'app_private.is_session_owner(uuid)',
    'app_private.can_read_session(uuid)', 'app_private.can_edit_roster(uuid)',
    'public.can_read_session(uuid,uuid)', 'public.can_edit_session(uuid,uuid)',
    'public.accept_team_invite(uuid)', 'public.decline_team_invite(uuid)',
    'public.revoke_team_invite(uuid)', 'public.search_invitable_part_time_profiles(uuid,text,integer)'
  ] loop
    function_oid := signature::regprocedure;
    execute format('revoke all on function %s from public, anon, authenticated', function_oid);
    execute format('grant execute on function %s to authenticated, service_role', function_oid);
  end loop;
end;
$$;
revoke all on function app_private.guard_row_identity(), app_private.guard_profile_account_type()
  from public, anon, authenticated;

create index if not exists team_members_user_team_rls_idx on public.team_members(user_id, team_id);
create index if not exists teams_owner_rls_idx on public.teams(owner_id);
create index if not exists team_invites_invitee_status_rls_idx on public.team_invites(invitee_id, status);

notify pgrst, 'reload schema';
commit;

-- Expected: 14 rows; rls_enabled = true; all policies target authenticated.
select c.relname as table_name, c.relrowsecurity as rls_enabled, count(p.oid) as policy_count
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
left join pg_catalog.pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relname in (
  'profiles', 'teams', 'team_members', 'team_invites', 'sessions',
  'schematics', 'session_shares', 'session_notes', 'session_reports',
  'roster_level_edits', 'roster_student_level_edits', 'custom_rosters',
  'report_cards', 'request_assignments'
)
group by c.relname, c.relrowsecurity order by c.relname;
