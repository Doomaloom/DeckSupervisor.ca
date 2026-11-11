#!/usr/bin/env python3
"""Refresh immutable result criterion IDs from a reviewed Rectab catalog.
Usage: python3 scripts/generate-result-curriculum.py /path/to/catalog.json
Benchmark timing limits in result_validate must also track benchmarks.go.
"""
import json
from pathlib import Path
import sys

catalog = json.loads(Path(sys.argv[1]).read_text())
path = Path(__file__).resolve().parent.parent / 'backend/supabase_results_sync.sql'
content = path.read_text().split('-- Frozen curriculum IDs, generated from rec-tablet catalog ')[0]
content += '-- Frozen curriculum IDs, generated from rec-tablet catalog ' + catalog['version'] + '.\n'
for level in catalog['levels']:
    for skill in level['skills']:
        values = [catalog['version'], level['id'], skill['id'], json.dumps([s['id'] for s in skill['subskills']])]
        content += 'insert into public.result_curriculum values(' + ','.join("'" + value.replace("'", "''") + "'" for value in values) + ') on conflict do nothing;\n'
path.write_text(content + 'commit;\n')
