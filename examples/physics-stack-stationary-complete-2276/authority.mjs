// Host-only actual same-algorithm authority. No solver or producer import.
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
export const PROFILE='STATIONARY_NORMAL_EXACT_V1';
export const ADMISSION='ROOT_SAME32_SOURCE_NATIVE_FRACTION_FLOAT_CONFIRMED';
export function readAuthority(root,pins){
 assert.equal(pins.profile,PROFILE);assert.equal(pins.stationaryCandidateAdmission,ADMISSION);
 const read=name=>{assert.equal(typeof name,'string');const expected=pins.files[name];assert.ok(expected,'authority input must be pinned');const path=resolve(root,name);assert.equal(statSync(path).size,expected.bytes);assert.ok(expected.bytes<=2**21);const bytes=readFileSync(path);assert.equal(createHash('sha256').update(bytes).digest('hex'),expected.sha256);return JSON.parse(bytes);};
 const value=read(pins.authorityManifest);assert.equal(value.format,'stationary-complete-authority-v1');assert.equal(value.profile,PROFILE);assert.equal(value.stationaryCandidateAdmission,ADMISSION);assert.equal(value.providerDigest,pins.providerDigest);
 const run=read(value.libraryRunReceipt),source=read(value.sourceReceipt),native=read(value.nativeReceipt);
 assert.equal(run.status,'PASS_BOUNDED_EXACT_STATIONARY_PACKAGE_STACK_PHASE');assert.equal(run.parity,true);assert.equal(run.firstFailure,null);
 for(const report of [source,native]){assert.equal(report.status,'PASS_INTERNAL_PHASE_FIRST32_ONE_STEP_AND_FRESH16');assert.equal(report.firstFailure,null);assert.equal(report.reports.length,6);for(const scene of ['ALIGNED','OFFSET','YAW'])for(const n of [1,16]){const row=report.reports.find(r=>r.scene===scene&&r.selectedSteps===n);assert.ok(row);assert.equal(row.phaseAccepted,n);assert.equal(row.failure,null);}}
 assert.deepEqual(source.reports,native.reports,'actual Source/genuine Native evidence parity');
 const nativeRoot=resolve(root,value.nativeRoot);assert.ok(nativeRoot.startsWith(resolve(root,'examples/physics-stack-stationary-library-2276/evidence')+sep));assert.equal(value.nativeRoot,pins.authorityNativeRoot);
 const descriptor=d=>{assert.ok(d&&typeof d.path==='string');assert.ok(resolve(root,d.path).startsWith(nativeRoot+sep),'no historical QR authority');assert.ok(Number.isSafeInteger(d.bytes)&&d.bytes>0&&d.bytes<=2**21&&/^[a-f0-9]{64}$/.test(d.sha256));assert.deepEqual(pins.files[d.path],{bytes:d.bytes,sha256:d.sha256});};
 const recordKeys=[],wireKeys=[];
 for(const scene of ['ALIGNED','OFFSET','YAW']){for(let step=0;step<=16;step++){const key=scene+':'+step;recordKeys.push(key);const r=value.records[key];assert.ok(r);descriptor(r.json);descriptor(r.raw);const ops=step===0?['quality']:['contacts','world','step-ledger','quality'];for(const op of ops){const wireKey=key+':'+op;wireKeys.push(wireKey);const pair=value.authority[wireKey];assert.ok(pair);descriptor(pair.request);descriptor(pair.reply);}}}
 assert.deepEqual(Object.keys(value.records).sort(),recordKeys.sort());assert.deepEqual(Object.keys(value.authority).sort(),wireKeys.sort());assert.equal(wireKeys.length,195);
 return {...value,nativeResult:native};
}
