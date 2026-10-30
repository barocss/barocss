#!/bin/zsh
# usage: run.sh probe.ts -> bundles from the model package and runs it; output to probe.log
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
A=${0:A:h}; E=$A/$1; O=${E%.ts}.mjs
cd /Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model
node --input-type=module -e "const {build}=await import('esbuild'); await build({entryPoints:['$E'],outfile:'$O',bundle:true,platform:'node',format:'esm',target:'node22',logLevel:'warning',nodePaths:[process.cwd()+'/node_modules']})" && node $O > ${E%.ts}.log 2>&1; echo exit=$?
