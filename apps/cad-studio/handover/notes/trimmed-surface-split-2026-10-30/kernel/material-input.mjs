import fs from 'node:fs';
import { evaluateCurve, splitTrimmedSurfaceAtParameter } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/dist/index.js';
const surface={kind:'surface',id:'support',degreeU:1,degreeV:1,knotsU:[-2,-2,6,6],knotsV:[1,1,7,7],controlPoints:[[[10,-6,3],[10,24,3]],[[50,-6,3],[50,24,3]]],weights:[[1,1],[1,1]]};
const corners=[[15,-1],[35,-1],[35,15],[29,15],[29,5],[21,5],[21,15],[15,15]];
const curve={kind:'curve',id:'loop',degree:1,knots:[0,0,1,2,3,4,5,6,7,8,8],controlPoints:[...corners,corners[0]].map(([x,y])=>[x,y,3]),weights:Array(9).fill(1)};
const uv=[];for(let i=0;i<160;i++){const p=evaluateCurve(curve,8*i/160);uv.push([(p[0]-20)/5,(p[1]+11)/5]);}
const results={};for(const keep of ['inside','outside'])results[keep]=splitTrimmedSurfaceAtParameter(surface,[{keep,uv}],{axis:'v',parameter:3.7,lowerSurfaceId:'lower',upperSurfaceId:'upper'});
fs.writeFileSync('/tmp/d340-kernel/material-record.json',JSON.stringify({boundary:'Kernel public Curve160 samples and new public helper; actual Model trimByCurve producer is separate forthcoming evidence',input:{uv,domain:{u:[-2,6],v:[1,7]},axis:'v',parameter:3.7},results},null,2)+'\n');
