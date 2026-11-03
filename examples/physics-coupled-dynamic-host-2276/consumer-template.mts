import {createPhysicsWorld, type PhysicsModel, type WorldOptions} from '__NATIVE_ENTRY__';
import {createPhysicsRecorder, restorePhysicsRecording} from '__NATIVE_ENTRY__';
declare const model: PhysicsModel;
declare const options: WorldOptions;
const world = createPhysicsWorld(model, options);
const recorder = createPhysicsRecorder(world);
const state = recorder.getState();
const schema: 2 = state.schemaVersion;
const point = state.contacts[0].points[0];
const anchor = point.anchorM;
const impulse = state.pairWrenches[0].onB.linearImpulseNs;
const moment = state.pairWrenches[0].onB.angularImpulseAboutWorldOriginNms;
const recording = recorder.saveRecording();
const version: 2 = recording.version;
restorePhysicsRecording(recording, {model, options, providerDigest: state.identity.providerDigest});
// @ts-expect-error Geometry contacts have no legacy aggregate normal impulse.
state.contacts[0].normalImpulseNs;
// @ts-expect-error Geometry contacts have no legacy aggregate tangent impulse.
state.contacts[0].tangentImpulseOnBNs;
// @ts-expect-error The World owns the fixed interval.
world.step(1 / 120);
void [schema, anchor, impulse, moment, version];
import {transportWarmTangent, WarmTransportError} from '__NATIVE_ENTRY__';
const warmHelper:(t:readonly [number,number,number],n:readonly [number,number,number])=>[number,number,number]=transportWarmTangent;
declare const warmError:WarmTransportError;
const warmReason:string=warmError.reason;
void [warmHelper,warmReason];
import {coupledStaticTarget,CoupledContactError} from '__NATIVE_ENTRY__';
type StaticArguments=Parameters<typeof coupledStaticTarget>[0];
declare const actualStaticInput:StaticArguments;
const candidateResult=coupledStaticTarget(actualStaticInput);
if(candidateResult.status==='STATIC_TARGET'){const j:readonly number[]=candidateResult.worldImpulseNs;void j;}
declare const coupledError:CoupledContactError;
const coupledCode:'COUPLED_PROFILE_UNSUPPORTED'|'COUPLED_UNRESOLVED'=coupledError.code;
void coupledCode;
import {lifecycleCaptures,lifecycleCaptureStats} from '__NATIVE_ENTRY__';
const captures=lifecycleCaptures();const calls:number=lifecycleCaptureStats().captureCalls;
for(const capture of captures.records){if(capture.status==='CAPTURED'){const s:import('__NATIVE_ENTRY__').PhysicsState=capture.publicState;void s;}}
void calls;

import {coupledContactTarget} from '__NATIVE_ENTRY__';
type DynamicInput=Parameters<typeof coupledContactTarget>[0];declare const actualDynamicInput:DynamicInput;const dynamicResult=coupledContactTarget(actualDynamicInput);if(dynamicResult.status==='DYNAMIC_TARGET'){const actualJ:readonly number[]=dynamicResult.worldImpulseNs;const meter:number=dynamicResult.certificate.dynamicCounts.integerOps;void [actualJ,meter];}
const noOldDynamicRefusal:('COUPLED_DYNAMIC_REQUIRED' extends typeof coupledError.code?true:false)=false;void noOldDynamicRefusal;
