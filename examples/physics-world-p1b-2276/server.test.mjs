import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {startServer} from '../physics-scene/server.mjs';
const manifest=new URL('../../packages/barocss-physics/src/provider-manifest.generated.ts',import.meta.url);
const before=readFileSync(manifest), time=statSync(manifest).mtimeMs;
const regenerated=spawnSync(process.execPath,[new URL('../../packages/barocss-physics/src/generate-provider.mjs',import.meta.url).pathname],{encoding:'utf8',timeout:180000});
assert.equal(regenerated.status,0);assert.deepEqual(readFileSync(manifest),before);assert.equal(statSync(manifest).mtimeMs,time);
const running=await startServer();
try {
 const home=await fetch(running.url);assert.equal(home.status,200);
 const app=await fetch(running.url+'/app.js');assert.equal(app.status,200);
 const script=await app.text();assert.ok(script.includes('barocss-physics-model'));assert.ok(script.includes('normalImpulseNs'));
 assert.equal((await fetch(running.url+'/absent')).status,404);
} finally {await running.close();}
assert.equal(running.server.listening,false);
console.log(JSON.stringify({result:'PASS',httpStartupBundleAndClose:true,providerWriteIdempotent:true,DOMExecution:'NOT_RUN',watch:'not part of this startup-only server'}));
