#!/bin/sh
# Usage: sh scripts/regress-394/run.sh <ssr|shell> <runs> [versions...]
# Needs .rel/<v> built by build-releases.sh. Raw outputs go to .out/ (not committed); summarize.mjs builds result.json.
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
: "${PW_DIR:=/Users/user/.npm/_npx/705bc6b22212b352}"
: "${CHROME:=$HOME/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing}"
export PW_DIR CHROME
kind=$1; runs=$2; shift 2
mkdir -p "$ROOT/.out"
for v in "$@"; do
  if [ "$kind" = ssr ]; then
    BARO_ROOT=$ROOT/.rel/$v OUT=$ROOT/.out/ssr${TAG}-$v.json PROBE_PORT=${PORT:-7650} node "$ROOT/scripts/regress-394/ssr-run.mjs" "$runs" > "$ROOT/.out/ssr${TAG}-$v.log" 2>&1 || echo "ERR ssr $v"
  else
    BARO_ROOT=$ROOT/.rel/$v OUT=$ROOT/.out/shell${TAG}-$v.json TWB_DIR=/__twb_mem__ PROBE_PORT=${PORT:-7660} node --import "$ROOT/scripts/rerun-383/twb-shim.mjs" "$ROOT/scripts/regress-394/shell-run.mjs" "$runs" > "$ROOT/.out/shell${TAG}-$v.log" 2>&1 || echo "ERR shell $v"
  fi
  echo "done $kind $v"
done
