// Authored natural regression model only; expected states never become World input.
import {makeCase as coupled,numericWordsHex,packet} from '../physics-coupled-cubes-floor-2276/cases.mjs';
export {numericWordsHex,packet};
export function makeCase(){const c=coupled();c.caseId='natural-anisotropic-precontact';c.model.revision='coupled-natural-anisotropic-refusal-v1';const body=c.model.bodies.find(b=>b.id==='upper'),shape=c.model.colliders.find(x=>x.bodyId===body.id);body.initial.positionM=[0,5,0];body.initial.orientationXYZW=[.1,.2,.3,Math.sqrt(.86)];shape.geometry.halfExtentsM=[.25,.5,.75];return c;}

// New public bank; original makeCase() above is unchanged and preserved in baseline.
export function publicCases(){const specs=[['natural-120-64',false,120,64],['principal-spin-120-64',true,120,64],...['natural','principal-spin'].flatMap(mode=>[60,120,240].map(hz=>[mode+'-'+hz,mode==='principal-spin',hz,hz/10]))];return specs.map(([caseId,spin,hz,steps])=>{const c=makeCase();c.caseId=caseId;c.model.revision='anisotropic-inertia-'+caseId;c.options.fixedStepSeconds=1/hz;if(spin)c.model.bodies.find(b=>b.id==='upper').initial.orientationXYZW=[0,0,Math.SQRT1_2,Math.SQRT1_2];return{...c,steps,commands:Array.from({length:steps},(_,i)=>spin&&i===0?[{kind:'angularImpulse',bodyId:'upper',angularImpulseNms:[0,.125,0]}]:[])};});}
export function publicPacket(data){return{format:'anisotropic-inertia-public-v1',data,numericWordsF64leHex:numericWordsHex(data)};}
