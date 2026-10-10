import {createUprightCapsuleController} from '@barocss/physics';
import {CASES} from './fixture.mjs';
import {config,command} from './frame.mjs';
import {numbers,encode,hex} from './binary.mjs';
import {createCapsulePacket} from './capsule-mesh.mjs';
import {createTerrain} from './terrain.mjs';
import {geometryChecks} from './geometry-checks.mjs';
const output=CASES.map(f=>{const terrain=createTerrain(f),capsule=createCapsulePacket(),geometry=geometryChecks(f,capsule,terrain);const runs=[];for(let r=0;r<2;r++){let c,states=[],error=null;try{c=createUprightCapsuleController(config(f));states.push(c.getSnapshot());for(let i=0;i<240;i++)states.push(c.step(command(f)));}catch(e){error={name:e.name,code:e.code,message:e.message};}finally{c?.dispose();}runs.push({states,rawHex:hex(encode(numbers(states))),error});}return {name:f.name,runs,geometry,terrain,capsule};});console.log(JSON.stringify(output));
