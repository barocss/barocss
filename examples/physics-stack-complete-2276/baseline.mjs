import assert from 'node:assert/strict';
import {Cancelled} from '../physics-stack-pipeline-2276/protocol.mjs';
// Same helper used by the live driver and fixed synthetic controls.
export class CommittedBaseline{
 constructor(){this.promoted=false;this.state=null;this.identity=null;this.waiters=0;this.promise=new Promise((r,j)=>{this.resolve=r;this.reject=j;});this.promise.catch(()=>{});}
 async forQuality(step,after,permit){
  if(step<960)return null;if(step===960)return after;
  assert.ok(this.waiters<3,'baseline waiters belong to three credits');this.waiters++;
  try{const state=await this.promise;if(!permit())throw new Cancelled();assert.ok(this.promoted);return state;}finally{this.waiters--;}
 }
 commit(step,contiguous,state,identity){assert.equal(step,960);assert.equal(contiguous,960);assert.equal(this.promoted,false);assert.equal(state.stepIndex,960);this.state=state;this.identity=identity;this.promoted=true;this.resolve(state);}
 stop(){this.reject(new Cancelled());}
}
