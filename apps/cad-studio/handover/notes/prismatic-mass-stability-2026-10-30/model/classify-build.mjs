import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const {build}=createRequire('/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/package.json')('esbuild');
const result=await build({entryPoints:['/tmp/d343-model/classify-providers.ts'],bundle:true,platform:'node',format:'esm',target:'node22',outfile:'/tmp/d343-model/classify-providers.mjs',metafile:true});writeFileSync('/tmp/d343-model/classify-metafile.json',JSON.stringify(result.metafile,null,2));
