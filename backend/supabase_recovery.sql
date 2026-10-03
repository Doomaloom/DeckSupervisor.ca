-- One-use recovery grants contain no passwords or provider tokens.
begin;
create table if not exists public.password_recovery_grants (
 id text primary key check(length(id)=64), user_id uuid not null references auth.users(id) on delete cascade,
 expires_at timestamptz not null, state text not null default 'pending' check(state in ('pending','claimed','used'))
);
alter table public.password_recovery_grants enable row level security;
drop policy if exists recovery_own_read on public.password_recovery_grants;
create policy recovery_own_read on public.password_recovery_grants for select to authenticated using(user_id=auth.uid());
revoke all on public.password_recovery_grants from public,anon,authenticated;
grant select on public.password_recovery_grants to authenticated;
create or replace function public.register_recovery_grant(p_id text,p_expires timestamptz)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or p_expires<=now() or p_expires>now()+interval '15 minutes' then raise insufficient_privilege; end if;
 delete from password_recovery_grants where expires_at<now();
 insert into password_recovery_grants(id,user_id,expires_at) values(p_id,auth.uid(),p_expires);
end $$;
create or replace function public.claim_recovery_grant(p_id text)
returns boolean language plpgsql security definer set search_path=public as $$
declare changed bigint;
begin
 update password_recovery_grants set state='claimed' where id=p_id and user_id=auth.uid() and expires_at>now() and state='pending';
 get diagnostics changed=row_count;return changed=1;
end $$;
create or replace function public.finish_recovery_grant(p_id text,p_success boolean)
returns void language sql security definer set search_path=public as $$
 update password_recovery_grants set state=case when p_success then 'used' else 'pending' end
 where id=p_id and user_id=auth.uid() and state='claimed' and expires_at>now()
$$;
revoke all on function public.register_recovery_grant(text,timestamptz),public.claim_recovery_grant(text),public.finish_recovery_grant(text,boolean) from public,anon;
grant execute on function public.register_recovery_grant(text,timestamptz),public.claim_recovery_grant(text),public.finish_recovery_grant(text,boolean) to authenticated;
commit;
