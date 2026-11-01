#!/bin/zsh
# usage: run.sh probe.ts  -> bundles from the model package and runs, output to probe.log
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
A=/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-compassionate-turing-e88276/0fddd342-b409-4074-aa06-d8dff804f568/scratchpad/audit
E=$A/$1; O=${E%.ts}.mjs
cd /Users/user/github/barocss/barocss/.claude/worktrees/compassionate-turing-e88276/packages/barocss-cad-model
node --input-type=module -e "const {build}=await import('esbuild'); await build({entryPoints:['$E'],outfile:'$O',bundle:true,platform:'node',format:'esm',target:'node22',logLevel:'warning',nodePaths:[process.cwd()+'/node_modules']})" && node $O > ${E%.ts}.log 2>&1; echo exit=$?
