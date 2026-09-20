-- TEST ONLY, used by scripts/test-rls.sh.
do $$
begin
  if (select policies from public.test_policy_snapshot) is distinct from
    (select jsonb_agg(to_jsonb(p) order by schemaname, tablename, policyname) from pg_policies p) then
    raise exception 'FAIL: policy replacement was not rolled back';
  end if;
  -- Exclude the snapshot table itself, consistently with the saved input.
  if (select grants from public.test_grant_snapshot) is distinct from
    (select jsonb_agg(jsonb_build_array(oid, relacl) order by oid) from pg_class
      where relnamespace = 'public'::regnamespace and relkind = 'r'
        and relname <> 'test_grant_snapshot') then
    raise exception 'FAIL: table grants were not rolled back';
  end if;
  raise notice 'PASS: failed migration restores policies and grants';
end;
$$;
drop event trigger test_reject_policy;
