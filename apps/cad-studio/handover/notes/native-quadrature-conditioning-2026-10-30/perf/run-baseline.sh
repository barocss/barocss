#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d344-perf/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d344-native-quadrature-baseline >> /tmp/d344-perf/gate.log 2>&1
"$TASK_NODE" /tmp/d344-perf/qualify.mjs > /tmp/d344-perf/baseline-qualification.log 2>&1
RUNS=7 WARMUP=3 BATCH=32 BASE=/tmp/d344-perf/baseline.json "$TASK_NODE" scripts/perf-bench.mjs save native-cylinder-ordinary-first-mass,native-cylinder-tiny-first-mass > /tmp/d344-perf/baseline.log 2>&1
SHAPE=/tmp/d344-perf/baseline-shape.json BATCH=32 "$TASK_NODE" scripts/perf-bench.mjs shape-save native-cylinder-ordinary-first-mass,native-cylinder-tiny-first-mass > /tmp/d344-perf/baseline-shape.log 2>&1
"$TASK_NODE" --version > /tmp/d344-perf/node-version.txt
sysctl -n machdep.cpu.brand_string > /tmp/d344-perf/cpu.txt
sw_vers > /tmp/d344-perf/os.txt
