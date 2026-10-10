import {createClothWorld} from '@barocss/physics/cloth';
import {clothMetrics,exact} from './metrics.mjs';
import {scene,DT} from './frame.mjs';
function run(){const w=createClothWorld(scene()),states=[w.getState()];try{for(let i=0;i<240;i++)states.push(w.step(DT));}finally{w.dispose();}return states;}
const raw=a=>{const bytes=new Uint8Array(a.length*8),v=new DataView(bytes.buffer);for(let i=0;i<a.length;i++)v.setFloat64(i*8,a[i],true);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');};
const first=run(),second=run(),metrics=first.map(s=>({stepIndex:s.stepIndex,...clothMetrics(s)})),exactRepeat=exact(first,second);
console.log(JSON.stringify({passed:metrics.every(m=>m.passed)&&exactRepeat,metrics,exactRepeat,first:first.map(s=>({...s,positionsHex:raw(s.positionsM),velocitiesHex:raw(s.velocitiesMps),negativeZeroPositionOffsets:Array.from(s.positionsM,(v,i)=>Object.is(v,-0)?i:-1).filter(i=>i>=0),negativeZeroVelocityOffsets:Array.from(s.velocitiesMps,(v,i)=>Object.is(v,-0)?i:-1).filter(i=>i>=0),positionsM:Array.from(s.positionsM),velocitiesMps:Array.from(s.velocitiesMps),triangles:Array.from(s.triangles),pinnedVertexIndices:Array.from(s.pinnedVertexIndices)})),publicProducer:true,actualViewer:false}));
