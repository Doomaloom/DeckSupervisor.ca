-- TEST ONLY, used by scripts/test-rls.sh.
create table public.test_policy_snapshot as
select jsonb_agg(to_jsonb(p) order by schemaname, tablename, policyname) as policies from pg_policies p;
create table public.test_grant_snapshot as
select jsonb_agg(jsonb_build_array(oid, relacl) order by oid) as grants
from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'
  and relname <> 'test_grant_snapshot';
create function public.test_reject_policy() returns event_trigger language plpgsql as $$
begin
  raise exception 'Injected policy creation failure';
end;
$$;
create event trigger test_reject_policy on ddl_command_start when tag in ('CREATE POLICY')
execute function public.test_reject_policy();
