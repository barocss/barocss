#!/bin/sh
# usage: run.sh entry.ts  -> bundles into out/ and runs with node
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
A=/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-heuristic-gould-b94e20/de70f387-aaec-4213-a427-f7006e5caab3/scratchpad/audit
F=/Users/user/github/barocss/barocss/.claude/worktrees/agent-af167fdb085fc2526/packages/barocss-cad-model
E="$1"; O="$A/out/$(basename "$E" .ts).mjs"
cd "$F" && node --input-type=module -e "const {build}=await import('esbuild'); await build({entryPoints:['$E'],outfile:'$O',bundle:true,platform:'node',format:'esm',target:'node22',logLevel:'error',nodePaths:[process.cwd()+'/node_modules']})" && shift && node $NODEFLAGS "$O" "$@"
