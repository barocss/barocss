import fs from 'node:fs';
import process from 'node:process';
import { splitSurfaceAtParameter, evaluateSurface } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/dist/index.js';

const out = '/tmp/d340-plan/child-probe';
const surface = (points, ku=[0,0,1,1], kv=[0,0,1,1]) => ({kind:'surface',id:'original',degreeU:1,degreeV:1,knotsU:ku,knotsV:kv,controlPoints:points,weights:[[1,1],[1,1]]});
const cases = [
  {name:'translated-tiny-1e-16',surface:surface([[[9998,0,0],[9998,1,0]],[[9999,0,0],[9999,1,0]]]),axis:'u',parameter:1e-16},
  {name:'translated-MIN_VALUE',surface:surface([[[9998,0,0],[9998,1,0]],[[9999,0,0],[9999,1,0]]]),axis:'u',parameter:Number.MIN_VALUE},
  {name:'translated-representable-thin-1e-10',surface:surface([[[9998,0,0],[9998,1,0]],[[9999,0,0],[9999,1,0]]]),axis:'u',parameter:1e-10},
  {name:'ordinary-nonunit-slanted-fractional',surface:surface([[[0,0,0],[0,1,1]],[[1,0,1],[1,1,2]]],[-2,-2,6,6],[1,1,7,7]),axis:'u',parameter:0.4},
];
const reports = [];
for (const fixture of cases) {
  const before = JSON.stringify(fixture.surface);
  try {
    const result = splitSurfaceAtParameter(fixture.surface,{axis:fixture.axis,parameter:fixture.parameter,lowerSurfaceId:'lower',upperSurfaceId:'upper'});
    const observations = {};
    for(const side of ['lower','upper']) {
      const child = result[side], u=[child.knotsU[1],child.knotsU[2]],v=[child.knotsV[1],child.knotsV[2]], us=[u[0],u[0]+(u[1]-u[0])/2,u[1]],vs=[v[0],v[0]+(v[1]-v[0])/2,v[1]];
      observations[side]=[];
      for(const a of us) for(const b of vs) {
        try {observations[side].push({u:a,v:b,point:evaluateSurface(child,a,b)});}
        catch(error) {observations[side].push({u:a,v:b,error:{name:error?.name,message:error?.message,stack:error?.stack}});}
      }
    }
    reports.push({name:fixture.name,status:'RETURNED',fixture,result,observations,inputUnchanged:before===JSON.stringify(fixture.surface)});
    console.log(JSON.stringify({name:fixture.name,status:'RETURNED',maximumObservedDifference:result.report.maximumObservedDifference,report:result.report.geometricValidity,lowerPoles:result.lower.controlPoints,upperPoles:result.upper.controlPoints}));
  } catch(error) {
    const failure={name:fixture.name,status:'PARENT_REFUSED',fixture,error:{name:error?.name,code:error?.code,message:error?.message,stack:error?.stack,cause:error?.cause instanceof Error?{name:error.cause.name,message:error.cause.message,stack:error.cause.stack}:error?.cause},inputUnchanged:before===JSON.stringify(fixture.surface)};
    reports.push(failure);console.log(JSON.stringify(failure));
  }
}
fs.writeFileSync(`${out}/results.json`,JSON.stringify({node:process.version,boundary:'existing public splitSurfaceAtParameter only; no proposed D340 helper exists',reports},null,2)+'\n');
