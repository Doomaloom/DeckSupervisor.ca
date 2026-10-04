#!/usr/bin/env bash
# Disposable local PostgreSQL only. No Supabase credentials or existing DB used.
set -euo pipefail

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
for command_name in initdb pg_ctl psql; do
  if ! command -v "$command_name" >/dev/null; then
    printf 'Required command not found: %s\n' "$command_name" >&2
    exit 1
  fi
done

test_root=$(mktemp -d /tmp/cob-rls-test.XXXXXX)
stop_test_database() {
  pg_ctl -D "$test_root/data" -m fast -w stop >/dev/null 2>&1 || true
  printf 'Test logs and disposable database retained at %s\n' "$test_root"
}
trap stop_test_database EXIT
initdb -D "$test_root/data" -U postgres --auth=trust --no-locale --encoding=UTF8 >"$test_root/initdb.log" 2>&1
if ! pg_ctl -D "$test_root/data" -l "$test_root/postgres.log" \
  -o "-k $test_root -p 55439 -c listen_addresses=''" -w start >/dev/null; then
  sed -n '1,100p' "$test_root/postgres.log" >&2
  exit 1
fi
# Explicit connection flags ignore any PGHOST/PGDATABASE set for a real project.
local_psql=(psql -X -h "$test_root" -p 55439 -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
if ! "${local_psql[@]}" -f "$repo_root/backend/tests/rls_bootstrap.sql" \
  -f "$repo_root/backend/tests/rls.sql" -f "$repo_root/backend/tests/rls_instructor.sql" -f "$repo_root/backend/tests/rls_instructor_accounts.sql" -f "$repo_root/backend/tests/rls_lesson_plans.sql" -f "$repo_root/backend/tests/rls_instructor_regression.sql" -f "$repo_root/backend/tests/rls_session_instructors.sql" -f "$repo_root/backend/tests/rls_recovery.sql" >"$test_root/regression.log" 2>&1; then
  tail -100 "$test_root/regression.log" >&2
  exit 1
fi

# Force a failure AFTER old policies/grants have been removed, and prove the
# transaction restores them. This event trigger exists only in this test DB.
"${local_psql[@]}" -f "$repo_root/backend/tests/rls_rollback_setup.sql"
if "${local_psql[@]}" -f "$repo_root/backend/supabase_rls_reset.sql" >"$test_root/rollback.log" 2>&1; then
  printf 'FAIL: expected injected migration failure\n' >&2
  exit 1
fi
"${local_psql[@]}" -f "$repo_root/backend/tests/rls_rollback_verify.sql"
printf 'RLS regression suite passed, including migration rollback.\n'
