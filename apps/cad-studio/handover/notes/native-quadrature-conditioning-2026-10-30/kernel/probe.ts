import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {brepMassProperties,brepSurfaceArea,checkBrep,tessellateBrep,solidMassFromIntegrals} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/dist/index.js';
import {brepQuadratureIntegrals,d344Trace} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/brep/brep-mass-quadrature.ts';
const brep=JSON.parse(readFileSync('/tmp/d344-kernel/input-brep.json','utf8')),before=JSON.stringify(brep);
const untouched={mass:brepMassProperties(brep,1),area:brepSurfaceArea(brep),check:checkBrep(brep,{strict:true}),mesh:tessellateBrep(brep,{segmentsPerQuarter:8})};
const traced=brepQuadratureIntegrals(brep,8);assert.ok(traced);const tracedMass=solidMassFromIntegrals(traced.integrals,1,'quadrature');assert.deepEqual(tracedMass,untouched.mass,'Instrumentation and source/dist behavior agree exactly');assert.equal(JSON.stringify(brep),before);
writeFileSync('/tmp/d344-kernel/baseline.json',JSON.stringify({untouched,traced,tracedMass,trace:d344Trace,unchanged:true},null,2));console.log(JSON.stringify({untouchedMass:untouched.mass,branches:d344Trace.faces,nodeCount:d344Trace.nodes.length,center:d344Trace.centre,meshed:traced.meshed}));
