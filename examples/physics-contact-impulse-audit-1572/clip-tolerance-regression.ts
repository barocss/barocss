/** Regression for the *production* side-plane clip implementation, exposed only
 * inside a temporary esbuild bundle. No test hooks ship in @barocss/physics.
 */
import { __physics1572Clip } from '../../packages/barocss-physics/src/contact-manifold.js';
import type {Vec3} from '../../packages/barocss-physics/src/types.js';
const epsilon=1e-9;
const polygon:Vec3[]=[[-1,0,0],[1,0,0],[1,1,0],[-1,1,0]];
const clipped=__physics1572Clip(polygon,[0,0,0],[1,0,0],0);
const boundary=clipped.filter(p=>Math.abs(p[0]-epsilon)<1e-12);
if(clipped.length!==4||boundary.length!==2)throw Error('CLIP_BOUNDARY_WITNESS');
for(const p of clipped)if(p[0]>epsilon+1e-12||!p.every(Number.isFinite))
 throw Error('CLIP_OUTSIDE_TOLERANT_HALFSPACE');
const near:Vec3[]=[[epsilon/2,0,0],[2*epsilon,0,0],[2*epsilon,1,0],[epsilon/2,1,0]];
const nearClipped=__physics1572Clip(near,[0,0,0],[1,0,0],0);
if(nearClipped.length!==4||nearClipped.filter(p=>Math.abs(p[0]-epsilon)<1e-12).length!==2)
 throw Error('CLIP_NEAR_TOLERANCE_CROSSING');
console.log(JSON.stringify({status:'PASS',regression:'production clip plane and intersection agree',boundaryCount:boundary.length,nearCount:nearClipped.length,epsilonM:epsilon}));
