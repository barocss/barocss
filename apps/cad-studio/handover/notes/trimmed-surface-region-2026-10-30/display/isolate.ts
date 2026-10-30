import {readFileSync} from 'node:fs';
import {geometryOf} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/direct.ts';
import {trimmedMesh,keptAt} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/trim.ts';
import {surfaceDomain,surfaceEvaluator} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/index.ts';
for(const name of ['outside-hole','retained-rectangle']){const d=JSON.parse(readFileSync(`/tmp/d341-studio/run-01/${name}.bcad`,'utf8')).direct;for(const o of d.objects.filter(x=>!x.hidden&&x.trims?.length)){const g=geometryOf(d,o); console.log(name,o.id,JSON.stringify(surfaceDomain(g)));try{const m=trimmedMesh(g,o.trims);console.log('mesh',m.positions.length,m.indices.length);}catch(e){console.log('mesh failed',e.stack);}
const dom=surfaceDomain(g),at=surfaceEvaluator(g); for(const [fixU,a,b] of [[true,dom.u,dom.v],[false,dom.v,dom.u]] as const)for(let k=0;k<=7;k++)for(let i=0;i<=32;i++){const c=a[0]+(a[1]-a[0])*k/7,t=b[0]+(b[1]-b[0])*i/32,u=fixU?c:t,v=fixU?t:c;try{at(u,v);}catch(e){console.log('iso failed',{fixU,k,i,u,v},e.message);}}
for(const l of o.trims)for(const uv of l.uv)try{at(...uv);}catch(e){console.log('trim edge failed',uv,e.message);}
}}
