import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createPhysicsWorld} from './build/source.mjs';
const decode=x=>x&&typeof x==='object'&&Object.hasOwn(x,'$f64le')?Buffer.from(x.$f64le,'hex').readDoubleLE():Array.isArray(x)?x.map(decode):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,decode(v)])):x;
const study=JSON.parse(readFileSync(new URL('./study.json',import.meta.url))),pair=decode(study.pairRaw);pair.model.bodies[0].massKg=3.2;pair.model.bodies[0].initial.angularVelocityRadps=[.7,-.3,1.2];pair.model.colliders[0].geometry={kind:'capsule',radiusM:.12,halfLengthM:.27};
const world=createPhysicsWorld(pair.model,pair.options);const before=world.getState();let after;for(let n=0;n<12;n++)after=world.step();world.dispose();
// Uniform density: integrate cylinder and two hemispheres about the common COM.
const m=3.2,r=.12,h=.27,mc=m*(3*h)/(3*h+2*r),ms=m-mc;
const iy=mc*r*r/2+ms*2*r*r/5,ix=mc*(r*r/4+h*h/3)+ms*(2*r*r/5+h*h+3*h*r/4);
const R=q=>{const[x,y,z,w]=q,n=x*x+y*y+z*z+w*w;return[[(w*w+x*x-y*y-z*z)/n,2*(x*y-z*w)/n,2*(x*z+y*w)/n],[2*(x*y+z*w)/n,(w*w-x*x+y*y-z*z)/n,2*(y*z-x*w)/n],[2*(x*z-y*w)/n,2*(y*z+x*w)/n,(w*w-x*x-y*y+z*z)/n]];};
const L=state=>{const b=state.bodies[0],a=R(b.orientationXYZW),v=b.angularVelocityRadps,I=[ix,iy,ix],local=I.map((_,i)=>a.reduce((s,row,j)=>s+row[i]*v[j],0)*I[i]);return a.map(row=>row.reduce((s,x,i)=>s+x*local[i],0));};
const x=L(before),y=L(after),errors=y.map((v,i)=>Math.abs(v-x[i])),bound=1e-12+1e-12*Math.max(1,...x.map(Math.abs),...y.map(Math.abs));
const result={status:errors.every(e=>e<=bound)?'PASS':'FAIL_CAPSULE_VOLUME_INERTIA',expectedMoments:[ix,iy,ix],maxWorldMomentumError:Math.max(...errors),bound,pair,before,after};
mkdirSync(new URL('./evidence/capsule-baseline-01/',import.meta.url),{recursive:false});writeFileSync(new URL('./evidence/capsule-baseline-01/result.json',import.meta.url),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:result.status,maxWorldMomentumError:result.maxWorldMomentumError,bound}));assert.equal(result.status,'FAIL_CAPSULE_VOLUME_INERTIA','preserved expected initial failure changed');
