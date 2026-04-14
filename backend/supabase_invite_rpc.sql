create or replace function accept_team_invite(invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_team_id uuid;
  v_invitee uuid;
begin
  select team_id, invitee_id
    into v_team_id, v_invitee
  from team_invites
  where id = invite_id
    and status = 'pending';

  if v_team_id is null then
    raise exception 'Invite not found or not pending';
  end if;

  if v_invitee <> auth.uid() then
    raise exception 'Not authorized to accept this invite';
  end if;

  insert into team_members (team_id, user_id, role)
  values (v_team_id, v_invitee, 'member')
  on conflict do nothing;

  update team_invites
  set status = 'accepted'
  where id = invite_id;
end;
$$;

grant execute on function accept_team_invite(uuid) to authenticated;
revoke execute on function accept_team_invite(uuid) from anon;

create or replace function decline_team_invite(invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_invitee uuid;
begin
  select invitee_id
    into v_invitee
  from team_invites
  where id = invite_id
    and status = 'pending';

  if v_invitee is null then
    raise exception 'Invite not found or not pending';
  end if;

  if v_invitee <> auth.uid() then
    raise exception 'Not authorized to decline this invite';
  end if;

  update team_invites
  set status = 'declined'
  where id = invite_id;
end;
$$;

grant execute on function decline_team_invite(uuid) to authenticated;
revoke execute on function decline_team_invite(uuid) from anon;

create or replace function revoke_team_invite(invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_team_id uuid;
begin
  select team_id
    into v_team_id
  from team_invites
  where id = invite_id
    and status = 'pending';

  if v_team_id is null then
    raise exception 'Invite not found or not pending';
  end if;

  if not is_team_owner(v_team_id, auth.uid()) then
    raise exception 'Not authorized to revoke this invite';
  end if;

  update team_invites
  set status = 'revoked'
  where id = invite_id;
end;
$$;

grant execute on function revoke_team_invite(uuid) to authenticated;
revoke execute on function revoke_team_invite(uuid) from anon;

create or replace function leave_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_owner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select owner_id
    into v_owner_id
  from teams
  where id = p_team_id;

  if v_owner_id is null then
    raise exception 'Team not found';
  end if;

  if v_owner_id = auth.uid() then
    raise exception 'Team owners cannot leave their own team';
  end if;

  delete from team_members
  where team_id = p_team_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Membership not found';
  end if;
end;
$$;

grant execute on function leave_team(uuid) to authenticated;
revoke execute on function leave_team(uuid) from anon;

create or replace function search_invitable_part_time_profiles(
  p_team_id uuid,
  p_query text,
  p_limit integer default 25
)
returns table (
  id uuid,
  first_name text,
  last_name text,
  email text
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  with args as (
    select
      nullif(trim(coalesce(p_query, '')), '') as query,
      greatest(1, least(coalesce(p_limit, 25), 50)) as row_limit
  )
  select
    p.id,
    p.first_name,
    p.last_name,
    p.email
  from profiles p
  cross join args
  where auth.uid() is not null
    and is_team_owner(p_team_id, auth.uid())
    and p.account_type = 'part_time'
    and not exists (
      select 1
      from team_members tm
      where tm.team_id = p_team_id
        and tm.user_id = p.id
    )
    and not exists (
      select 1
      from team_invites ti
      where ti.team_id = p_team_id
        and ti.invitee_id = p.id
        and ti.status = 'pending'
    )
    and (
      args.query is null
      or p.first_name ilike '%' || args.query || '%'
      or p.last_name ilike '%' || args.query || '%'
      or p.email ilike '%' || args.query || '%'
    )
  order by p.first_name, p.last_name, p.email
  limit (select row_limit from args);
$$;

grant execute on function search_invitable_part_time_profiles(uuid, text, integer) to authenticated;
revoke execute on function search_invitable_part_time_profiles(uuid, text, integer) from anon;
