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

grant execute on function toronto_today() to authenticated;
grant execute on function is_session_owner(uuid, uuid) to authenticated;
grant execute on function is_session_shared_today(uuid, uuid) to authenticated;
grant execute on function can_read_session(uuid, uuid) to authenticated;
grant execute on function can_edit_session(uuid, uuid) to authenticated;
grant execute on function can_edit_roster(uuid, uuid) to authenticated;

revoke execute on function toronto_today() from anon;
revoke execute on function is_session_owner(uuid, uuid) from anon;
revoke execute on function is_session_shared_today(uuid, uuid) from anon;
revoke execute on function can_read_session(uuid, uuid) from anon;
revoke execute on function can_edit_session(uuid, uuid) from anon;
revoke execute on function can_edit_roster(uuid, uuid) from anon;

alter table sessions enable row level security;
alter table schematics enable row level security;
alter table session_shares enable row level security;
alter table session_notes enable row level security;
alter table roster_level_edits enable row level security;
alter table roster_student_level_edits enable row level security;
alter table custom_rosters enable row level security;
alter table report_cards enable row level security;

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
