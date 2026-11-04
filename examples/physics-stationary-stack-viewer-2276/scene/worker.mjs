// The sole World and clock live here. The main thread displays returned states.
import {createPhysicsWorld} from '/physics/index.js';
let world=null,worlds=0,calls=0;
self.onmessage=event=>{
 const {id,type,model,options}=event.data;
 try{
  let state;
  if(type==='reset'){world?.dispose();world=createPhysicsWorld(model,options);worlds++;calls=0;state=world.getState();}
  else if(type==='step'){if(!world)throw Error('World not initialized');state=world.step([]);calls++;}
  else throw Error('Unknown display request');
  self.postMessage({id,state,worlds,calls});
 }catch(error){self.postMessage({id,error:{name:error?.name??typeof error,code:error?.code??null,message:String(error?.message??error),details:error?.details??null}});}
};
