#!/usr/bin/env bash
# Disposable local QA; never consumes hosted Supabase credentials.
set -euo pipefail
qa_repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
qa_root=$(mktemp -d /tmp/instructor-qa.XXXXXX)
qa_children=()
cleanup() {
 for qa_pid in "${qa_children[@]}"; do kill "$qa_pid" 2>/dev/null || true; done
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
(cd "$qa_repo/backend"; GOCACHE=/tmp/cob-go-cache go build -o "$qa_root/api" ./cmd/instructor-qa)
python3 "$qa_repo/backend/tests/instructor-qa/provider.py" "$qa_root" >"$qa_root/provider.log" 2>&1 & qa_children+=("$!")
"$qa_root/api" >"$qa_root/api.log" 2>&1 & qa_children+=("$!")
(cd "$qa_repo/frontend"; exec node node_modules/vite/bin/vite.js --config vite.instructor-qa.config.ts) >"$qa_root/vite.log" 2>&1 & qa_children+=("$!")
printf 'QA URL http://127.0.0.1:18082; database %s; synthetic password: Synthetic-test-only-42!\n' "$qa_root"
read -r -p 'Press Enter to stop and remove all disposable fixtures. ' qa_end
