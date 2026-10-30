import {planCurveFeaturePatternPath} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/dist/api/index.js';
import {planQuadraticCut} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/dist/features/quadratic-cut-plan.js';
const path={degree:2,knots:[0,0,0,1,1,1],weights:[1,1,1],controlPoints:[[0,0,0],[20,0,0],[20,20,0]]};
for(const [spacing,count] of [[10,3],[.5,64]])try {console.log(JSON.stringify({spacing,count,result:planQuadraticCut(path.controlPoints,spacing,count,10000,(c,m)=>{throw Error(c+':'+m)})}));} catch(e){console.log(e.stack)}
console.log(planCurveFeaturePatternPath(path,10,3));
