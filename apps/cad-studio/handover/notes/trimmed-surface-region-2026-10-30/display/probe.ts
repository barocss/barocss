import {readFileSync,writeFileSync} from 'node:fs';
import {directDisplay} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/direct.ts';
for(const name of ['inside-two-regions','outside-pocket','outside-hole','retained-rectangle']){
 const d=JSON.parse(readFileSync(`/tmp/d341-studio/run-01/${name}.bcad`,'utf8'));
 const out=directDisplay(d.direct); const results=[];
 for(const x of out){const bad=(a)=>a?Array.from(a).filter(v=>!Number.isFinite(v)).length:0;
 let area=0; const centroid=[0,0,0];if(x.indices)for(let k=0;k<x.indices.length;k+=3){ const a=x.indices[k]*3,b=x.indices[k+1]*3,c=x.indices[k+2]*3,p=x.positions;const ab=[p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]],ac=[p[c]-p[a],p[c+1]-p[a+1],p[c+2]-p[a+2]],A=Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0])/2;area+=A;for(let j=0;j<3;j++)centroid[j]+=A*(p[a+j]+p[b+j]+p[c+j])/3;}
 results.push({id:x.id,kind:x.kind,positions:x.positions.length,indices:x.indices?.length,badPositions:bad(x.positions),badNormals:bad(x.normals),badIsos:bad(x.isos),area,centroid:centroid.map(v=>v/area)});}
 console.log(JSON.stringify({name,results}));writeFileSync(`/tmp/d341-display/${name}-mesh.json`,JSON.stringify(out,(_,v)=>ArrayBuffer.isView(v)?Array.from(v as any):v));
}
