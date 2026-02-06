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

create or replace function prevent_account_type_change()
returns trigger as $$
begin
  if auth.role() = 'authenticated' and new.account_type <> old.account_type then
    raise exception 'account_type cannot be changed';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_account_type_guard on profiles;
create trigger profiles_account_type_guard
before update on profiles
for each row execute function prevent_account_type_change();

alter table profiles enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table team_invites enable row level security;
alter table custom_rosters enable row level security;

drop policy if exists "Profiles insert by owner" on profiles;
drop policy if exists "Profiles read by owner" on profiles;
drop policy if exists "Profiles read by full-time" on profiles;
drop policy if exists "Profiles update by owner" on profiles;

create policy "Profiles insert by owner"
  on profiles for insert
  with check (id = auth.uid());

create policy "Profiles read by owner"
  on profiles for select
  using (id = auth.uid());

create policy "Profiles read by full-time"
  on profiles for select
  using (is_full_time(auth.uid()));

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

create policy "Team invites read by invitee"
  on team_invites for select
  using (invitee_id = auth.uid() or is_team_owner(team_id, auth.uid()));

create policy "Team invites create by owner"
  on team_invites for insert
  with check (is_team_owner(team_id, auth.uid()));

create policy "Team invites update by invitee or owner"
  on team_invites for update
  using (invitee_id = auth.uid() or is_team_owner(team_id, auth.uid()));

create policy "Custom rosters owner only"
  on custom_rosters for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
