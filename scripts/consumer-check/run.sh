#!/usr/bin/env bash
# Consumer check (#322): pack @barocss/kit, @barocss/browser and @barocss/server,
# install the tarballs into a scratch project, and verify every documented entry
# loads via CommonJS require(), ESM import, and TypeScript (node16 + bundler).
# Usage: bash scripts/consumer-check/run.sh [workdir]   (build:library first)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${1:-${TMPDIR:-/tmp}/barocss-consumer-check}"
HERE="$ROOT/scripts/consumer-check"
rm -rf "$WORK" && mkdir -p "$WORK/tarballs" "$WORK/app"
for pkg in barocss barocss-browser barocss-server; do
  # pnpm pack applies publishConfig and rewrites workspace:* ranges.
  (cd "$ROOT/packages/$pkg" && pnpm pack --pack-destination "$WORK/tarballs" >/dev/null)
done
cp "$HERE/cjs.cjs" "$HERE/esm.mjs" "$HERE/types.cts" "$HERE/types.mts" "$WORK/app/"
cd "$WORK/app"
echo '{"name":"consumer","private":true}' > package.json
npm i --no-audit --no-fund --prefer-offline --cache "${NPM_CACHE:-$WORK/npm-cache}" "$WORK"/tarballs/*.tgz >/dev/null
TSC="$ROOT/node_modules/typescript/bin/tsc"
fail=0
run() { if "$@" >"$WORK/err.txt" 2>&1; then echo "PASS $label"; else echo "FAIL $label"; head -20 "$WORK/err.txt"; fail=1; fi; }
label="CJS require (all entries)"; run node cjs.cjs
node cjs.cjs
label="ESM import (all entries)"; run node esm.mjs
node esm.mjs
TSO=(--noEmit --strict --skipLibCheck false --types node --typeRoots "$ROOT/node_modules/@types")
label="tsc node16 (cts+mts)"; run node "$TSC" "${TSO[@]}" --module node16 --moduleResolution node16 types.cts types.mts
label="tsc bundler (mts)"; run node "$TSC" "${TSO[@]}" --module esnext --moduleResolution bundler types.mts
exit $fail
