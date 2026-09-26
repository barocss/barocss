#!/bin/sh
# Build each release worktree in .rel/<v> (created with `git worktree add --detach .rel/<v> @barocss/browser@<v>`).
R=$(cd "$(dirname "$0")/../.." && pwd)/.rel
for v in ${VERSIONS:-0.8.0 0.8.1 0.8.2 0.9.0 0.10.0 0.10.1}; do
  d=$R/$v
  (cd $d && pnpm install --frozen-lockfile --prefer-offline >/dev/null 2>&1) || echo "INSTALL FAIL $v"
  for p in barocss barocss-browser barocss-server; do (cd $d/packages/$p && pnpm run build:library >/dev/null 2>&1) || echo "FAIL $v $p"; done
  echo "$v $(wc -c < $d/packages/barocss-browser/dist/cdn/barocss.umd.cjs)"
done
