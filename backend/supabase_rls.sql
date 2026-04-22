create or replace function is_full_time(uid uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from profiles where id = uid and account_type = 'full_time'
  );
$$;

create or replace function is_team_owner(team uuid, uid uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (select 1 from teams where id = team and owner_id = uid);
$$;

create or replace function is_team_member(team uuid, uid uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (select 1 from team_members where team_id = team and user_id = uid);
$$;

create or replace function is_team_invitee(team uuid, uid uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from team_invites
    where team_id = team and invitee_id = uid and status = 'pending'
  );
$$;

create or replace function can_read_profile(profile_id uuid, uid uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    profile_id = uid
    or exists (
      select 1
      from team_members my_team
      join team_members other_team
        on other_team.team_id = my_team.team_id
      where my_team.user_id = uid
        and other_team.user_id = profile_id
    )
    or exists (
      select 1
      from teams t
      join team_members tm on tm.team_id = t.id
      where t.owner_id = uid
        and tm.user_id = profile_id
    )
    or exists (
      select 1
      from team_invites ti
      where ti.invitee_id = profile_id
        and ti.status = 'pending'
        and is_team_owner(ti.team_id, uid)
    )
    or exists (
      select 1
      from teams t
      join team_members tm on tm.team_id = t.id
      where t.owner_id = profile_id
        and tm.user_id = uid
    );
$$;

create or replace function guard_profile_account_type()
returns trigger as $$
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
$$ language plpgsql;

drop trigger if exists profiles_account_type_guard on profiles;
create trigger profiles_account_type_guard
before insert or update on profiles
for each row execute function guard_profile_account_type();

alter table profiles enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table team_invites enable row level security;
alter table custom_rosters enable row level security;
alter table report_cards enable row level security;
alter table request_assignments enable row level security;

drop policy if exists "Profiles insert by owner" on profiles;
drop policy if exists "Profiles read by owner" on profiles;
drop policy if exists "Profiles read by authenticated users" on profiles;
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

create policy "Profiles read by authenticated users"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "Profiles read by related teams"
  on profiles for select
  using (can_read_profile(id, auth.uid()));

create policy "Profiles update by owner"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Teams create by full-time" on teams;
drop policy if exists "Teams read by owner or member" on teams;
drop policy if exists "Teams update by owner" on teams;

create policy "Teams create by full-time"
  on teams for insert
  with check (is_full_time(auth.uid()) and owner_id = auth.uid());

create policy "Teams read by owner or member"
  on teams for select
  using (
    owner_id = auth.uid()
    or is_team_member(id, auth.uid())
    or is_team_invitee(id, auth.uid())
  );

create policy "Teams update by owner"
  on teams for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Team members read by member or owner" on team_members;
drop policy if exists "Team members add by owner" on team_members;
drop policy if exists "Team members remove by owner" on team_members;

create policy "Team members read by member or owner"
  on team_members for select
  using (
    user_id = auth.uid()
    or is_team_owner(team_id, auth.uid())
  );

create policy "Team members add by owner"
  on team_members for insert
  with check (is_team_owner(team_id, auth.uid()));

create policy "Team members remove by owner"
  on team_members for delete
  using (is_team_owner(team_id, auth.uid()));

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

create policy "Custom rosters owner only"
  on custom_rosters for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Report cards read" on report_cards;
drop policy if exists "Report cards create" on report_cards;
drop policy if exists "Report cards update" on report_cards;
drop policy if exists "Report cards delete" on report_cards;
drop policy if exists "Request assignments read" on request_assignments;
drop policy if exists "Request assignments create" on request_assignments;
drop policy if exists "Request assignments update" on request_assignments;
drop policy if exists "Request assignments delete" on request_assignments;

create policy "Request assignments read"
  on request_assignments for select
  using (auth.role() = 'authenticated');

create policy "Request assignments create"
  on request_assignments for insert
  with check (is_full_time(auth.uid()));

create policy "Request assignments update"
  on request_assignments for update
  using (is_full_time(auth.uid()))
  with check (is_full_time(auth.uid()));

create policy "Request assignments delete"
  on request_assignments for delete
  using (is_full_time(auth.uid()));

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
