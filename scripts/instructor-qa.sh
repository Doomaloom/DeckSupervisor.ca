#!/usr/bin/env bash
# Disposable local QA; never consumes hosted Supabase credentials.
set -euo pipefail
qa_repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
qa_root=$(mktemp -d /tmp/instructor-qa.XXXXXX)
qa_children=()
cleanup() {
 for qa_pid in "${qa_children[@]}"; do kill "$qa_pid" 2>/dev/null || true; done
 if [[ -f "$qa_root/api.pid" ]]; then kill "$(cat "$qa_root/api.pid")" 2>/dev/null || true; fi
 pg_ctl -D "$qa_root/data" -m fast -w stop >/dev/null 2>&1 || true
 rm -rf -- "$qa_root"
 printf 'Disposable QA accounts, plans, metadata, database and processes removed.\n'
}
trap cleanup EXIT
initdb -D "$qa_root/data" -U postgres --auth=trust --no-locale --encoding=UTF8 >"$qa_root/init.log" 2>&1
pg_ctl -D "$qa_root/data" -l "$qa_root/postgres.log" -o "-k $qa_root -p 55440 -c listen_addresses=''" -w start >/dev/null
psql -X -h "$qa_root" -p 55440 -U postgres -d postgres -v ON_ERROR_STOP=1 -q \
 -f "$qa_repo/backend/tests/rls_bootstrap.sql" -f "$qa_repo/backend/tests/rls.sql" \
 -f "$qa_repo/backend/supabase_instructor.sql" -f "$qa_repo/backend/supabase_lesson_plans.sql" -f "$qa_repo/backend/supabase_lesson_plan_curriculum.sql" -f "$qa_repo/backend/supabase_lesson_plan_workouts.sql" \
 -f "$qa_repo/backend/tests/instructor-qa/fixtures.sql" -f "$qa_repo/backend/supabase_session_instructors.sql" >"$qa_root/fixture.log" 2>&1
for qa_migration in supabase_lesson_plan_activities.sql supabase_lesson_plan_equipment.sql supabase_results_sync.sql; do
 if [[ -f "$qa_repo/backend/$qa_migration" ]]; then
  psql -X -h "$qa_root" -p 55440 -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f "$qa_repo/backend/$qa_migration" >>"$qa_root/fixture.log" 2>&1
 fi
done
(cd "$qa_repo/backend"; GOCACHE=/tmp/cob-go-cache go build -o "$qa_root/api" ./cmd/instructor-qa)
python3 "$qa_repo/backend/tests/instructor-qa/provider.py" "$qa_root" >"$qa_root/provider.log" 2>&1 & qa_children+=("$!")
"$qa_root/api" >"$qa_root/api.log" 2>&1 & echo "$!" >"$qa_root/api.pid"
# Available only to this disposable fixture's child command. Restarting both
# persistence and API between the tablet and browser phases proves durability.
qa_restart_results_backend() {
 kill "$(cat "$qa_root/api.pid")"
 pg_ctl -D "$qa_root/data" -m fast -w restart >"$qa_root/restart.log" 2>&1
 "$qa_root/api" >>"$qa_root/api.log" 2>&1 & echo "$!" >"$qa_root/api.pid"
 python3 - <<'PY'
import time, urllib.request, urllib.error
for attempt in range(100):
 try:
  urllib.request.urlopen('http://127.0.0.1:18080/api/device-results', timeout=1)
 except urllib.error.HTTPError as error:
  if error.code == 401: break
 except OSError: pass
 time.sleep(.1)
else: raise SystemExit('Restarted QA backend did not become ready')
PY
 printf 'Restarted disposable PostgreSQL and Go API; existing results retained for browser verification.\n'
}
export qa_root
export -f qa_restart_results_backend
(cd "$qa_repo/frontend"; exec node node_modules/vite/bin/vite.js --config vite.instructor-qa.config.ts) >"$qa_root/vite.log" 2>&1 & qa_children+=("$!")
printf 'QA URL http://127.0.0.1:18082; database %s; synthetic password: Synthetic-test-only-42!\n' "$qa_root"
if (( $# )); then
 python3 - <<'PY'
import time, urllib.request
for attempt in range(300):
 try:
  with urllib.request.urlopen('http://127.0.0.1:18082/sign-in', timeout=1) as response:
   if response.status == 200: break
 except OSError: pass
 time.sleep(.1)
else: raise SystemExit('Local QA frontend did not become ready')
PY
 "$@"
else
 read -r -p 'Press Enter to stop and remove all disposable fixtures. ' qa_end
fi
