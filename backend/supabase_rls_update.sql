create or replace function toronto_today()
returns date
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select (now() at time zone 'America/Toronto')::date;
$$;

create or replace function is_session_owner(p_session_id uuid, p_uid uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (select 1 from sessions where id = p_session_id and created_by = p_uid);
$$;

create or replace function is_session_shared_today(p_session_id uuid, p_uid uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from session_shares
    where session_id = p_session_id
      and shared_with = p_uid
      and share_date = toronto_today()
  );
$$;

create or replace function can_read_session(p_session_id uuid, p_uid uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    is_session_owner(p_session_id, p_uid)
    or is_session_shared_today(p_session_id, p_uid)
    or exists (
      select 1
      from sessions s
      join profiles p on p.id = p_uid
      where s.id = p_session_id
        and s.team_id is not null
        and p.account_type = 'full_time'
        and (
          is_team_owner(s.team_id, p_uid)
          or is_team_member(s.team_id, p_uid)
        )
    );
$$;

create or replace function can_edit_session(p_session_id uuid, p_uid uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select is_session_owner(p_session_id, p_uid);
$$;

create or replace function can_edit_roster(p_session_id uuid, p_uid uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    is_session_owner(p_session_id, p_uid)
    or exists (
      select 1 from session_shares
      where session_id = p_session_id
        and shared_with = p_uid
        and share_date = toronto_today()
        and allow_roster_edits = true
    );
$$;

create or replace function can_read_profile(p_profile_id uuid, p_uid uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    p_profile_id = p_uid
    or exists (
      select 1
      from team_members my_team
      join team_members other_team
        on other_team.team_id = my_team.team_id
      where my_team.user_id = p_uid
        and other_team.user_id = p_profile_id
    )
    or exists (
      select 1
      from teams t
      join team_members tm on tm.team_id = t.id
      where t.owner_id = p_uid
        and tm.user_id = p_profile_id
    )
    or exists (
      select 1
      from team_invites ti
      where ti.invitee_id = p_profile_id
        and ti.status = 'pending'
        and is_team_owner(ti.team_id, p_uid)
    )
    or exists (
      select 1
      from teams t
      join team_members tm on tm.team_id = t.id
      where t.owner_id = p_profile_id
        and tm.user_id = p_uid
    );
$$;

create or replace function guard_profile_account_type()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' and coalesce(new.account_type, 'part_time') <> 'part_time' then
      raise exception 'account_type must default to part_time';
    end if;
    if tg_op = 'UPDATE' and new.account_type <> old.account_type then
      raise exception 'account_type cannot be changed';
    end if;
  end if;
  return new;
end;
$$;

grant execute on function toronto_today() to authenticated;
grant execute on function is_session_owner(uuid, uuid) to authenticated;
grant execute on function is_session_shared_today(uuid, uuid) to authenticated;
grant execute on function can_read_session(uuid, uuid) to authenticated;
grant execute on function can_edit_session(uuid, uuid) to authenticated;
grant execute on function can_edit_roster(uuid, uuid) to authenticated;
grant execute on function can_read_profile(uuid, uuid) to authenticated;

revoke execute on function toronto_today() from anon;
revoke execute on function is_session_owner(uuid, uuid) from anon;
revoke execute on function is_session_shared_today(uuid, uuid) from anon;
revoke execute on function can_read_session(uuid, uuid) from anon;
revoke execute on function can_edit_session(uuid, uuid) from anon;
revoke execute on function can_edit_roster(uuid, uuid) from anon;
revoke execute on function can_read_profile(uuid, uuid) from anon;

drop trigger if exists profiles_account_type_guard on profiles;
create trigger profiles_account_type_guard
before insert or update on profiles
for each row execute function guard_profile_account_type();

alter table profiles enable row level security;
alter table sessions enable row level security;
alter table schematics enable row level security;
alter table session_shares enable row level security;
alter table session_notes enable row level security;
alter table session_reports enable row level security;
alter table roster_level_edits enable row level security;
alter table roster_student_level_edits enable row level security;
alter table custom_rosters enable row level security;
alter table report_cards enable row level security;
alter table request_assignments enable row level security;
alter table team_invites enable row level security;

drop policy if exists "Profiles insert by owner" on profiles;
drop policy if exists "Profiles read by owner" on profiles;
drop policy if exists "Profiles read by full-time" on profiles;
drop policy if exists "Profiles read by related teams" on profiles;
drop policy if exists "Profiles update by owner" on profiles;

create policy "Profiles insert by owner"
  on profiles for insert
  with check (
    id = auth.uid()
    and coalesce(account_type, 'part_time') = 'part_time'
  );

create policy "Profiles read by owner"
  on profiles for select
  using (id = auth.uid());

create policy "Profiles read by related teams"
  on profiles for select
  using (can_read_profile(id, auth.uid()));

create policy "Profiles update by owner"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Team invites read by invitee" on team_invites;
drop policy if exists "Team invites create by owner" on team_invites;
drop policy if exists "Team invites update by invitee or owner" on team_invites;
drop policy if exists "Team invites update via rpc only" on team_invites;

create policy "Team invites read by invitee"
  on team_invites for select
  using (invitee_id = auth.uid() or is_team_owner(team_id, auth.uid()));

create policy "Team invites create by owner"
  on team_invites for insert
  with check (
    is_team_owner(team_id, auth.uid())
    and status = 'pending'
  );

create policy "Team invites update via rpc only"
  on team_invites for update
  using (false)
  with check (false);

drop policy if exists "Sessions read" on sessions;
drop policy if exists "Sessions create" on sessions;
drop policy if exists "Sessions update" on sessions;
drop policy if exists "Sessions delete" on sessions;

create policy "Sessions read"
  on sessions for select
  using (can_read_session(id, auth.uid()));

create policy "Sessions create"
  on sessions for insert
  with check (
    created_by = auth.uid()
    and (
      team_id is null
      or is_team_member(team_id, auth.uid())
      or is_team_owner(team_id, auth.uid())
    )
  );

create policy "Sessions update"
  on sessions for update
  using (can_edit_session(id, auth.uid()))
  with check (can_edit_session(id, auth.uid()));

create policy "Sessions delete"
  on sessions for delete
  using (can_edit_session(id, auth.uid()));

drop policy if exists "Schematics read" on schematics;
drop policy if exists "Schematics create" on schematics;
drop policy if exists "Schematics update" on schematics;
drop policy if exists "Schematics delete" on schematics;

create policy "Schematics read"
  on schematics for select
  using (can_read_session(session_id, auth.uid()));

create policy "Schematics create"
  on schematics for insert
  with check (
    created_by = auth.uid()
    and can_edit_session(session_id, auth.uid())
  );

create policy "Schematics update"
  on schematics for update
  using (can_edit_session(session_id, auth.uid()))
  with check (can_edit_session(session_id, auth.uid()));

create policy "Schematics delete"
  on schematics for delete
  using (can_edit_session(session_id, auth.uid()));

drop policy if exists "Session shares read" on session_shares;
drop policy if exists "Session shares create" on session_shares;
drop policy if exists "Session shares update" on session_shares;
drop policy if exists "Session shares delete" on session_shares;

create policy "Session shares read"
  on session_shares for select
  using (
    shared_with = auth.uid()
    or shared_by = auth.uid()
    or is_session_owner(session_id, auth.uid())
  );

create policy "Session shares create"
  on session_shares for insert
  with check (
    shared_by = auth.uid()
    and is_session_owner(session_id, auth.uid())
  );

create policy "Session shares update"
  on session_shares for update
  using (
    shared_by = auth.uid()
    or is_session_owner(session_id, auth.uid())
  )
  with check (
    shared_by = auth.uid()
    or is_session_owner(session_id, auth.uid())
  );

create policy "Session shares delete"
  on session_shares for delete
  using (
    shared_by = auth.uid()
    or is_session_owner(session_id, auth.uid())
  );

drop policy if exists "Session notes read" on session_notes;
drop policy if exists "Session notes create" on session_notes;
drop policy if exists "Session notes update" on session_notes;
drop policy if exists "Session notes delete" on session_notes;
drop policy if exists "Session reports read" on session_reports;
drop policy if exists "Session reports create" on session_reports;
drop policy if exists "Session reports update" on session_reports;
drop policy if exists "Session reports delete" on session_reports;

create policy "Session notes read"
  on session_notes for select
  using (can_read_session(session_id, auth.uid()));

create policy "Session notes create"
  on session_notes for insert
  with check (
    created_by = auth.uid()
    and can_read_session(session_id, auth.uid())
  );

create policy "Session notes update"
  on session_notes for update
  using (
    created_by = auth.uid()
    or can_edit_session(session_id, auth.uid())
  )
  with check (
    created_by = auth.uid()
    or can_edit_session(session_id, auth.uid())
  );

create policy "Session notes delete"
  on session_notes for delete
  using (
    created_by = auth.uid()
    or can_edit_session(session_id, auth.uid())
  );

create policy "Session reports read"
  on session_reports for select
  using (can_read_session(session_id, auth.uid()));

create policy "Session reports create"
  on session_reports for insert
  with check (
    created_by = auth.uid()
    and can_read_session(session_id, auth.uid())
  );

create policy "Session reports update"
  on session_reports for update
  using (
    created_by = auth.uid()
    or can_edit_session(session_id, auth.uid())
  )
  with check (
    created_by = auth.uid()
    or can_edit_session(session_id, auth.uid())
  );

create policy "Session reports delete"
  on session_reports for delete
  using (
    created_by = auth.uid()
    or can_edit_session(session_id, auth.uid())
  );

drop policy if exists "Roster level edits read" on roster_level_edits;
drop policy if exists "Roster level edits create" on roster_level_edits;
drop policy if exists "Roster level edits update" on roster_level_edits;
drop policy if exists "Roster level edits delete" on roster_level_edits;

create policy "Roster level edits read"
  on roster_level_edits for select
  using (can_read_session(session_id, auth.uid()));

create policy "Roster level edits create"
  on roster_level_edits for insert
  with check (
    created_by = auth.uid()
    and can_edit_roster(session_id, auth.uid())
  );

create policy "Roster level edits update"
  on roster_level_edits for update
  using (can_edit_roster(session_id, auth.uid()))
  with check (can_edit_roster(session_id, auth.uid()));

create policy "Roster level edits delete"
  on roster_level_edits for delete
  using (can_edit_roster(session_id, auth.uid()));

drop policy if exists "Roster student edits read" on roster_student_level_edits;
drop policy if exists "Roster student edits create" on roster_student_level_edits;
drop policy if exists "Roster student edits update" on roster_student_level_edits;
drop policy if exists "Roster student edits delete" on roster_student_level_edits;
drop policy if exists "Custom rosters owner only" on custom_rosters;
drop policy if exists "Custom rosters read" on custom_rosters;
drop policy if exists "Custom rosters create" on custom_rosters;
drop policy if exists "Custom rosters update" on custom_rosters;
drop policy if exists "Custom rosters delete" on custom_rosters;
drop policy if exists "Report cards read" on report_cards;
drop policy if exists "Report cards create" on report_cards;
drop policy if exists "Report cards update" on report_cards;
drop policy if exists "Report cards delete" on report_cards;
drop policy if exists "Request assignments read" on request_assignments;
drop policy if exists "Request assignments create" on request_assignments;
drop policy if exists "Request assignments update" on request_assignments;
drop policy if exists "Request assignments delete" on request_assignments;

create policy "Roster student edits read"
  on roster_student_level_edits for select
  using (can_read_session(session_id, auth.uid()));

create policy "Roster student edits create"
  on roster_student_level_edits for insert
  with check (
    created_by = auth.uid()
    and can_edit_roster(session_id, auth.uid())
  );

create policy "Roster student edits update"
  on roster_student_level_edits for update
  using (can_edit_roster(session_id, auth.uid()))
  with check (can_edit_roster(session_id, auth.uid()));

create policy "Roster student edits delete"
  on roster_student_level_edits for delete
  using (can_edit_roster(session_id, auth.uid()));

create policy "Custom rosters read"
  on custom_rosters for select
  using (can_read_session(session_id, auth.uid()));

create policy "Custom rosters create"
  on custom_rosters for insert
  with check (
    owner_id = auth.uid()
    and can_edit_session(session_id, auth.uid())
  );

create policy "Custom rosters update"
  on custom_rosters for update
  using (can_edit_session(session_id, auth.uid()))
  with check (can_edit_session(session_id, auth.uid()));

create policy "Custom rosters delete"
  on custom_rosters for delete
  using (can_edit_session(session_id, auth.uid()));

create policy "Request assignments read"
  on request_assignments for select
  using (auth.role() = 'authenticated');

create policy "Request assignments create"
  on request_assignments for insert
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and account_type = 'full_time'
    )
  );

create policy "Request assignments update"
  on request_assignments for update
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and account_type = 'full_time'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and account_type = 'full_time'
    )
  );

create policy "Request assignments delete"
  on request_assignments for delete
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and account_type = 'full_time'
    )
  );

create policy "Report cards read"
  on report_cards for select
  using (
    created_by = auth.uid()
    or (
      team_id is not null
      and (
        is_team_owner(team_id, auth.uid())
        or is_team_member(team_id, auth.uid())
      )
    )
  );

create policy "Report cards create"
  on report_cards for insert
  with check (
    created_by = auth.uid()
    and (
      team_id is null
      or is_team_owner(team_id, auth.uid())
      or is_team_member(team_id, auth.uid())
    )
  );

create policy "Report cards update"
  on report_cards for update
  using (created_by = auth.uid())
  with check (
    created_by = auth.uid()
    and (
      team_id is null
      or is_team_owner(team_id, auth.uid())
      or is_team_member(team_id, auth.uid())
    )
  );

create policy "Report cards delete"
  on report_cards for delete
  using (created_by = auth.uid());
