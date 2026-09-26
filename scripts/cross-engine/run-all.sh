#!/bin/sh
# #374: rerun the claim-carrying browser probes per engine (ports 7250-7259). Usage:
#   PW_DIR=<dir with node_modules/playwright-core whose browsers.json matches the cached firefox/webkit>
#   CHROME=<chromium binary> TWB_DIR=<@tailwindcss/browser dir> sh scripts/cross-engine/run-all.sh [engines...]
# Writes scripts/cross-engine/out/<probe>.<engine>.{log,json}; then restore the committed
# scripts/o5-probe/result.json (the probes overwrite it) before committing.
set -u
cd "$(dirname "$0")/../.."
OUT=scripts/cross-engine/out; mkdir -p $OUT
for E in ${@:-chromium firefox webkit}; do
  for P in o5-probe:7250 csp-probe:7254 embed-probe:7256 cms-probe:7258; do
    N=${P%%:*}; PORT=${P##*:}
    ENGINE=$E PROBE_PORT=$PORT node scripts/$N/run.mjs > $OUT/$N.$E.log 2>&1; echo "$N $E exit=$?"
    cp scripts/$N/result.json $OUT/$N.$E.json 2>/dev/null
  done
done
