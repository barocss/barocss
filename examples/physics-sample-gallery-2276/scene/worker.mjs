import {createPhysicsWorld} from '@barocss/physics';
let world=null,worlds=0,calls=0,scenario=null;
self.onmessage=e=>{const{id,type}=e.data;try{let state,commands=[];
 if(type==='reset'){const next=e.data.scenario;if(!Number.isInteger(next.steps)||next.steps<1||next.steps>128||next.commands.length!==next.steps)throw Error('finite authored gallery');const owner=createPhysicsWorld(next.model,next.options);world?.dispose();world=owner;scenario=next;worlds++;calls=0;state=world.getState();}
 else if(type==='step'){if(!world||calls>=scenario.steps)throw Error('finite gallery owner');commands=structuredClone(scenario.commands[calls]);state=world.step(commands);calls++;}
 else throw Error('unknown gallery request');self.postMessage({id,state,worlds,calls,commands});
 }catch(error){self.postMessage({id,error:{name:error?.name??typeof error,code:error?.code??null,message:String(error?.message??error)}});}};
