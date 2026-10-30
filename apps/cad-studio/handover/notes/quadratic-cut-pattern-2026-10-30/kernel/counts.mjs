import {QuadraticCutWork} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/dist/features/quadratic-cut-arithmetic.js';
import {planQuadraticCut} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/dist/features/quadratic-cut-plan.js';
let recent; const original=QuadraticCutWork.prototype.take;QuadraticCutWork.prototype.take=function(...args){recent=this;return original.apply(this,args)};
for(const count of [4,8,16,32,64]) {try {const p=planQuadraticCut([[0,0,0],[20,0,0],[20,20,0]],.5,count,10000,(c,m)=>{throw Error(c+':'+m)});console.log(count,p.work)}catch(e){console.log(count,e.message,recent.counts)}}
