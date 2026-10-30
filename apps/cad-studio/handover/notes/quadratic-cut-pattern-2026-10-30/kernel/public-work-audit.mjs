// Diagnostic-only observation of the existing private counter; restore before leaving this process.
import {QuadraticCutWork} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/dist/features/quadratic-cut-arithmetic.js';
import {planCurveFeaturePatternPath} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/dist/api/index.js';
const original=QuadraticCutWork.prototype.take;let last;
QuadraticCutWork.prototype.take=function(...args){last=this;return original.apply(this,args)};
const path={degree:2,knots:[0,0,0,1,1,1],weights:[1,1,1],controlPoints:[[0,0,0],[20,0,0],[20,20,0]]};
const legacy={degree:2,knots:[0,0,0],weights:Array(63).fill(1),controlPoints:Array.from({length:63},(_,i)=>[i/2,.5,.5])};for(let i=1;i<31;i++)legacy.knots.push(i,i);legacy.knots.push(31,31,31);
try {for(const [name,raw,spacing,count]of[['curved3',path,10,3],['curved64',path,.5,64],['legacy63pole',legacy,.25,64]]){const result=planCurveFeaturePatternPath(raw,spacing,count);console.log(JSON.stringify({name,work:{...last.counts},offsets:result.offsets.length,length:result.length}));}}finally{QuadraticCutWork.prototype.take=original}
