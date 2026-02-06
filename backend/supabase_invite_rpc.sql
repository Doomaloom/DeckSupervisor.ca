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
