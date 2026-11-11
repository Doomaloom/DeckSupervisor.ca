#!/usr/bin/env bash
# Run via: bash scripts/instructor-qa.sh bash scripts/test-results-roundtrip.sh
# Uses the disposable provider only; never reads hosted credentials.
set -euo pipefail
qa_website=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
qa_tablet=${REC_TEC_QA_TABLET:-"$qa_website/../rec-tablet"}
qa_evidence="$qa_website/tmp/results-sync"
mkdir -p "$qa_evidence"
(
 cd "$qa_tablet"
 REC_TEC_QA_URL=http://127.0.0.1:18082 \
 REC_TEC_QA_EVIDENCE="$qa_evidence/tablet-evidence.json" \
 GOCACHE=${GOCACHE:-/tmp/rec-tec-roundtrip-cache} \
 go test -tags ci ./src/workflows/swimming/repository -run '^TestLiveResultsRoundTrip$' -count=1 -v
) | tee "$qa_evidence/tablet-live.log"
(
 cd "$qa_website/frontend"
 node scripts/test-results-browser.mjs "$qa_evidence/tablet-evidence.json" "$qa_evidence/results-browser"
) | tee "$qa_evidence/results-browser.log"
