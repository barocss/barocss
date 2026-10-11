/** Own IPC only. No reference or physical law runs at import time. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {appendFileSync,writeFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
export function observer(path,{stderrPath,stdoutPath,stdinPath,exitPath}={}){if(stderrPath)writeFileSync(stderrPath,Buffer.alloc(0),{flag:'wx'});if(stdoutPath)writeFileSync(stdoutPath,Buffer.alloc(0),{flag:'wx'});if(stdinPath)writeFileSync(stdinPath,Buffer.alloc(0),{flag:'wx'});const child=spawn('python3',[path],{stdio:['pipe','pipe','pipe']});let pending=null,stderr='',stderrBytes=0,stdoutBytes=0,stdinBytes=0,failure=null,closed=false,exitCode=null,closing=null;const exited=new Promise(resolve=>child.once('close',resolve));
 function fail(error){failure??=error;if(pending){const waiter=pending;pending=null;waiter.reject(failure);}}
 child.stdout.on('data',data=>{stdoutBytes+=data.length;if(stdoutPath){try{appendFileSync(stdoutPath,data);}catch(error){fail(error);}}});
 child.stderr.on('data',data=>{stderrBytes+=data.length;stderr+=data;if(stderrPath){try{appendFileSync(stderrPath,data);}catch(error){fail(error);}}});
 const reader=createInterface({input:child.stdout});
 reader.on('line',line=>{if(!pending){fail(new Error('unsolicited hinge reference output'));return;}const waiter=pending;pending=null;try{waiter.resolve(JSON.parse(line));}catch(error){waiter.reject(error);}});
 child.on('error',fail);child.stdin.on('error',fail);child.on('close',code=>{closed=true;exitCode=code;if(exitPath){try{writeFileSync(exitPath,JSON.stringify({pid:child.pid,exitCode:code,stdinBytes,stdinPath:stdinPath??null,stdoutBytes,stdoutPath:stdoutPath??null,stderrBytes,stderrPath:stderrPath??null})+'\n',{flag:'wx'});}catch(error){fail(error);}}if(pending)fail(new Error('hinge reference exited '+code));else if(code!==0)failure??=new Error('hinge reference exited '+code);});
 function request(line){if(failure)return Promise.reject(failure);assert.equal(closed,false);assert.equal(pending,null);const encoded=line+'\n';if(stdinPath)appendFileSync(stdinPath,encoded);stdinBytes+=Buffer.byteLength(encoded);return new Promise((resolve,reject)=>{pending={resolve,reject};child.stdin.write(encoded);});}
 return {ask(data){return request(JSON.stringify(data));},askRaw(line){assert.equal(typeof line,'string');assert.equal(line.includes('\n'),false);return request(line);},stderr(){return stderr;},close(){if(!closing)closing=(async()=>{if(!closed)child.stdin.end();await exited;if(failure)throw failure;assert.equal(exitCode,0,'reference process must exit0');})();return closing;},get failure(){return failure;}};}
