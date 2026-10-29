#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
TASK_OUT=/tmp/d340-plan/child-probe
trap '"$TASK_GATE" release >> "$TASK_OUT/gate.log" 2>&1' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP
"$TASK_GATE" acquire heavy 1800 d340-child-probe >> "$TASK_OUT/gate.log" 2>&1
python3 "$TASK_OUT/capsule.py" "$TASK_OUT/before.json" > "$TASK_OUT/capsule-before.log"
"$TASK_NODE" "$TASK_OUT/probe.mjs" > "$TASK_OUT/probe.log" 2>&1
python3 "$TASK_OUT/capsule.py" "$TASK_OUT/after.json" > "$TASK_OUT/capsule-after.log"
python3 - <<'PY'
import json
from pathlib import Path
p=Path('/tmp/d340-plan/child-probe');a=json.loads((p/'before.json').read_text());b=json.loads((p/'after.json').read_text());delta=[f for f,h in a['files'].items() if b['files'].get(f)!=h]
s={'sameHEAD':a['head']==b['head'],'sameStatus':a['status']==b['status'],'listedFiles':len(a['files']),'changedFiles':delta,'sameFileSet':a['files'].keys()==b['files'].keys(),'build':'NOT_RUN: parent supplied current D339 dist with unchanged split/insertion source','newHelper':'NOT_IMPLEMENTED','browser':'NOT_RUN'}
(p/'capsule-comparison.json').write_text(json.dumps(s,indent=2)+'\n');print(json.dumps(s))
PY
