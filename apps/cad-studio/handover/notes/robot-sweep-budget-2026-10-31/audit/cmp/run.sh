#!/bin/sh
# run.sh <tag> [MUT=file env]: head and/or fix variants over the sweep-using tests
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
A=/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-heuristic-gould-b94e20/de70f387-aaec-4213-a427-f7006e5caab3/scratchpad/audit2229/cmp
G=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TESTS="${TESTS:-api-robot-boundary.test.ts api-robot-path-contract.test.ts api-robot.test.ts api-rs6-loop-motion.test.ts o22-designed-contact.test.ts o24a-cam.test.ts o24a-loops.test.ts pg6-running-fit.test.ts r4-caches.test.ts rb9.test.ts robot-ccd.test.ts robot-public-clearance.test.ts robot-public-angular.test.ts robot-sweep.test.ts robot-public-harness.test.ts rs1-samples.test.ts robot-sweep-budget.test.ts sheet-acceptance.test.ts rs3-movement.test.ts tool-contract.test.ts}"
cd $A
sh $G acquire heavy 1200 audit2229
for v in $VARIANTS; do rm -rf logs-$1-$v; node cmp.mjs $v $A/b-$1-$v $A/logs-$1-$v $TESTS > $1-$v.txt 2>&1; echo "$v exit $?"; grep -E "^# (tests|pass|fail)" $1-$v.txt; done
sh $G release
