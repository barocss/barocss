import {build} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/node_modules/esbuild/lib/main.js';
import{writeFileSync}from'node:fs';
const r=await build({entryPoints:['/tmp/d336-probe/entry.ts'],outfile:'/tmp/d336-probe/probe.mjs',bundle:true,platform:'node',format:'esm',target:'node22',metafile:true,absWorkingDir:'/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b',logLevel:'warning'});writeFileSync('/tmp/d336-probe/metafile.json',JSON.stringify(r.metafile,null,2));
