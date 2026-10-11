/** Own IPC only. No reference or physical law runs at import time. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
export function observer(path){const child=spawn('python3',[path],{stdio:['pipe','pipe','pipe']}),reader=createInterface({input:child.stdout});let pending=null,stderr='',failure=null,closed=false,exitCode=null,closing=null;const exited=new Promise(resolve=>child.once('close',resolve));
 function fail(error){failure=error;if(pending){const waiter=pending;pending=null;waiter.reject(error);}}
 child.stderr.on('data',data=>{stderr+=data;});
 reader.on('line',line=>{if(!pending){fail(new Error('unsolicited hinge reference output'));return;}const waiter=pending;pending=null;try{waiter.resolve(JSON.parse(line));}catch(error){waiter.reject(error);}});
 child.on('error',fail);child.stdin.on('error',fail);child.on('exit',code=>{closed=true;exitCode=code;if(pending)fail(new Error('hinge reference exited '+code));else if(code!==0)failure=new Error('hinge reference exited '+code);});
 function request(line){if(failure)return Promise.reject(failure);assert.equal(closed,false);assert.equal(pending,null);return new Promise((resolve,reject)=>{pending={resolve,reject};child.stdin.write(line+'\n');});}
 return {ask(data){return request(JSON.stringify(data));},askRaw(line){assert.equal(typeof line,'string');assert.equal(line.includes('\n'),false);return request(line);},stderr(){return stderr;},close(){if(!closing)closing=(async()=>{if(!closed)child.stdin.end();await exited;if(failure)throw failure;assert.equal(exitCode,0,'reference process must exit0');})();return closing;},get failure(){return failure;}};}
