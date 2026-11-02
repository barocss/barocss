import {createPhysicsWorld} from '@barocss/physics';
import {clothMetrics,exact} from './metrics.mjs';
import {clothModelData} from './frame.mjs';
const input=clothModelData();
function run(){const w=createPhysicsWorld(input.model,input.options),states=[w.getState()];try{for(let i=0;i<240;i++)states.push(w.step([]));}finally{w.dispose();}return states;}
const raw=a=>{const bytes=new Uint8Array(a.length*8),v=new DataView(bytes.buffer);for(let i=0;i<a.length;i++)v.setFloat64(i*8,a[i],true);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');};
const first=run(),second=run(),metrics=first.map(s=>({stepIndex:s.stepIndex,...clothMetrics(s,input.model)})),exactRepeat=exact(first,second);
console.log(JSON.stringify({passed:metrics.every(m=>m.passed)&&exactRepeat,metrics,exactRepeat,model:input.model,first:first.map(s=>({...s,positionsHex:raw(s.cloths[0].positionsM),velocitiesHex:raw(s.cloths[0].velocitiesMps),negativeZeroPositionOffsets:Array.from(s.cloths[0].positionsM,(v,i)=>Object.is(v,-0)?i:-1).filter(i=>i>=0),negativeZeroVelocityOffsets:Array.from(s.cloths[0].velocitiesMps,(v,i)=>Object.is(v,-0)?i:-1).filter(i=>i>=0),cloths:s.cloths.map(c=>({...c,positionsM:Array.from(c.positionsM),velocitiesMps:Array.from(c.velocitiesMps)}))})),publicProducer:true,actualViewer:false}));
