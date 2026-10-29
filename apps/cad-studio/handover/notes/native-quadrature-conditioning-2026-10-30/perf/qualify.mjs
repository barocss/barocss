import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as K from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/dist/index.js';
import { wholePatchTest } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/dist/brep/brep-mass-quadrature.js';
const root = '/tmp/d344-perf', hash = text => createHash('sha256').update(text).digest('hex');
const actual = JSON.parse(readFileSync('/tmp/d344-kernel/input-brep.json', 'utf8'));
const result = {};
for (const [name,height] of [['ordinary',5.00009],['tiny',.34567890000000023-.3456789]]) {
 const solid = K.transformPrismatic(K.prismaticFromProfile({ outer:[{kind:'arc',start:[3,0],center:[0,0],direction:'ccw'}],height,tag:'cylinder'}), {matrix:[1,0,0,1],offset:[.1234567,-.2345678],zOffset:.3456789});
 const brep = K.brepFromPrismatic(solid,{id:'cylinder'}), before = JSON.stringify(brep);
 const check = K.checkBrep(brep,{strict:true}); assert.equal(check.valid,true);
 assert.equal(brep.bodies.length,1); assert.equal(brep.bodies[0].kind,'solid'); assert.equal(brep.shells.length,1); assert.equal(brep.shells[0].closed,true);
 const whole = wholePatchTest(brep), patches = brep.faces.filter(f=>whole(f)).map(f=>f.id);
 // WholePatchTest also accepts planar full patches; classify exact constant-Z cap supports separately.
 const planarCaps = brep.faces.filter(f=>f.surface.kind==='surface' && f.surface.controlPoints.flat().every(p=>p[2]===f.surface.controlPoints[0][0][2])).map(f=>f.id);
 const curvedWholePatches = patches.filter(id=>!planarCaps.includes(id)); assert.equal(curvedWholePatches.length,2); assert.equal(planarCaps.length,2);
 const nativeMass = K.brepMassProperties(brep,1,{quadratureSegments:8}), area = K.brepSurfaceArea(brep), prismatic = K.prismaticMassProperties(solid,1);
 assert.equal(nativeMass.method,'quadrature'); assert.equal(JSON.stringify(brep),before);
 const coords = brep.edges.flatMap(e=>e.curve.controlPoints), bounds = [0,1,2].map(axis=>[Math.min(...coords.map(p=>p[axis])),Math.max(...coords.map(p=>p[axis]))]);
 if(name==='tiny') assert.deepEqual(bounds[2],[.3456789,.34567890000000023]);
 const geometry = {counts:Object.fromEntries(['bodies','shells','faces','loops','coedges','edges','vertices'].map(k=>[k,brep[k].length])),closed:brep.shells.map(s=>s.closed),bodyKinds:brep.bodies.map(b=>b.kind),faceNames:brep.faces.map(f=>f.name),edgeNames:brep.edges.map(e=>e.name),bounds,planarCaps,curvedWholePatches,allWholePatchTestFaces:patches};
 writeFileSync(`${root}/${name}-input-brep.json`,before+'\n');
 result[name] = {sourceRecipe:{radius:3,height,centerXY:[.1234567,-.2345678],zOffset:.3456789},geometry,fullInputSha256:hash(before),inputUnchangedAfterMassAreaValidity:JSON.stringify(brep)===before,strictCheck:check,nativeMass,area,prismaticContext:prismatic,actualD343FullByteEqual:before===JSON.stringify(actual),scope:'Baseline wrong native mass is observed, not accepted as accuracy oracle; exact same input fixture must be used for candidate'};
}
writeFileSync(`${root}/baseline-qualification.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
