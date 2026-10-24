#!/bin/bash
# Usage: bash window.sh <clean detached scratch worktree of the commit, with its own node_modules (pnpm install --offline --frozen-lockfile)>.
# Writes window-<sha>/summary.txt (one line per step) and per-step logs beside the worktree. Never commit its output.
# Coordinator window (Phase 0 S9) in a clean detached checkout: builds, types, lint, every package suite, kernel RB and
# properties, then the full browser flow when the load allows. One step at a time; a summary line per step.
export PATH=$HOME/.nvm/versions/node/v22.19.0/bin:$PATH
R=$1
# One heavy run at a time across sessions (barocss-lanes-guard gate); this shell holds the lock until it exits.
GATE=$HOME/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
# Heavy steps take the gate one at a time (hstep), so the lanes' runs interleave with the window's.
trap 'sh "$GATE" release' EXIT
OUT=$(dirname "$R")/window-$(git -C "$R" rev-parse --short HEAD)
mkdir -p "$OUT"; : > "$OUT/summary.txt"
step() {
  local name=$1 dir=$2; shift 2
  local t0=$SECONDS
  (cd "$R/$dir" && "$@") > "$OUT/$name.log" 2>&1
  local rc=$?
  local tap
  tap=$(grep -E '^# (tests|pass|fail|skipped)' "$OUT/$name.log" | tr '\n' ' ')
  printf '%s rc=%s %ss %s | load %s\n' "$name" "$rc" "$((SECONDS - t0))" "$tap" "$(sysctl -n vm.loadavg)" >> "$OUT/summary.txt"
}
hstep() {
  local name=$1
  sh "$GATE" acquire heavy 14400 "coordinator window $(git -C "$R" rev-parse --short HEAD): $name" 2>>"$OUT/gate.log" || { echo "$name GATE gave up" >> "$OUT/summary.txt"; return; }
  step "$@"
  sh "$GATE" release
}
echo "HEAD $(git -C "$R" rev-parse HEAD)" >> "$OUT/summary.txt"
step build-cad packages/barocss-cad pnpm -s build:library
step build-gpu packages/barocss-gpu pnpm -s build:library
step build-studio apps/cad-studio pnpm -s build
step types-cad packages/barocss-cad pnpm -s type-check
step types-model packages/barocss-cad-model pnpm -s type-check
step types-gpu packages/barocss-gpu pnpm -s type-check
step types-studio apps/cad-studio pnpm -s type-check
step lint-cad packages/barocss-cad pnpm -s lint
step lint-model packages/barocss-cad-model pnpm -s lint
step lint-gpu packages/barocss-gpu pnpm -s lint
step lint-studio apps/cad-studio npx eslint src server test
hstep test-model packages/barocss-cad-model env TEST_CONCURRENCY=4 pnpm -s test
hstep test-studio apps/cad-studio env TEST_CONCURRENCY=4 pnpm -s test
hstep test-gpu packages/barocss-gpu pnpm -s test
hstep test-kernel packages/barocss-cad bash -c 'node --test --test-concurrency=4 test/*.test.mjs'
hstep rb packages/barocss-cad node scripts/rb/run.mjs
hstep props packages/barocss-cad node scripts/rb/props.mjs
hstep flow apps/cad-studio env CAD_STUDIO_CHAT_PORT=52591 CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" PW_DIR=$HOME/.cache/barocss-playwright/node_modules/playwright node test/browser-flow.mjs "$OUT/flow"
echo "DONE" >> "$OUT/summary.txt"
