import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const home=dirname(fileURLToPath(import.meta.url));
export function producerTransform({stage,src,edit,once}){
 copyFileSync(resolve(home,'producer.ts'),resolve(src,'producer.ts'));
 const b=resolve(stage,'B/candidate.ts');writeFileSync(b,readFileSync(b,'utf8')+`
// Stage-only export of the existing exact native line arithmetic. Original B immutable.
export function representedNativeLine(pair: Pair, anchorM: Vec, normal: Vec): {pointOnAM:Vec;pointOnBM:Vec;signedGapM:number} {
 const a=native(pair.a),b=native(pair.b),anchor=vector(anchorM),n=vector(normal),ia=interval(a,anchor,n),ib=interval(b,anchor,n);
 if(!ia||!ib)throw new Error('PRODUCER_NATIVE_LINE_UNRESOLVED');
 const gap=numeric(minus(ib.lo,ia.hi))*Math.sqrt(numeric(dot(n,n)));
 if(!Number.isFinite(gap))throw new Error('PRODUCER_NATIVE_GAP_NONFINITE');
 return {pointOnAM:numberVector(vplus(anchor,vscale(n,ia.hi))),pointOnBM:numberVector(vplus(anchor,vscale(n,ib.lo))),signedGapM:gap};
}
`);
 edit('persistent-box-contact.ts',s=>{
  s="import {actualContribution,emptyContribution,combineContribution} from './producer.js';\n"+s;
  s=once(s,'function apply(a: Body, b: Body, pointM: Vec3, impulse: Vec3): void {','function apply(a: Body, b: Body, pointM: Vec3, impulse: Vec3): any {');
  s=once(s,'  phaseApplyAfter(traceApply,a,b);','  const producerContribution=actualContribution(pointM,impulse);\n  phaseApplyAfter(traceApply,a,b);\n  return producerContribution;');
  s=once(s,'  impulse: PointImpulse): void {','  impulse: PointImpulse): any {');
  s=once(s,'  apply(a, b, pointM, add(scale(normal, impulse.normalNs), impulse.tangentNs));','  return apply(a, b, pointM, add(scale(normal, impulse.normalNs), impulse.tangentNs));');
  s=once(s,'  impulse: PointImpulse, normalTargetMps: number): void {','  impulse: PointImpulse, normalTargetMps: number): any {\n  let producerContribution=emptyContribution();');
  s=once(s,'  if (deltaNormal !== 0) apply(a, b, pointM, scale(normal, deltaNormal)); else phaseNoNormal();','  if (deltaNormal !== 0) producerContribution=combineContribution(producerContribution,apply(a, b, pointM, scale(normal, deltaNormal))); else phaseNoNormal();');
  s=once(s,'  apply(a, b, pointM, deltaTangent);','  producerContribution=combineContribution(producerContribution,apply(a, b, pointM, deltaTangent));\n  return producerContribution;');return s;
 });
 edit('world.ts',s=>{
  s="import {acceptedGeometry,acceptedMembership,addPairContribution,copyPairWrenches} from './producer.js';\nimport {phaseInitial} from './private-phase.js';\n"+s;
  s=once(s,'contacts: PhysicsContact[], events: PhysicsEvent[],','contacts: any[], events: PhysicsEvent[],');
  s=once(s,'identity: Identity, colliderIds: Map<string, string>): PhysicsState {','identity: Identity, colliderIds: Map<string, string>, pairWrenches:any[]): PhysicsState {');
  s=once(s,'  return {\n    identity: { ...identity }, stepIndex, timeSeconds: stepIndex * dt,','  return {\n    schemaVersion:2, identity: { ...identity }, stepIndex, timeSeconds: stepIndex * dt,');
  const start=s.indexOf('    contacts: contacts.map('),end=s.indexOf('    events: events.map(',start);if(start<0||end<0)throw Error('Canonical contacts anchor');s=s.slice(0,start)+'    contacts: copyData(contacts), pairWrenches:copyData(pairWrenches),\n'+s.slice(end);
  s=once(s,'    identity: { ...identity }, stepIndex, timeSeconds: stepIndex * dt, bodies,','    schemaVersion:2, identity: { ...identity }, stepIndex, timeSeconds: stepIndex * dt, bodies,');
  s=once(s,'    joints: [], contacts: [], events: [], ccdHits: [], cloths: [], fluids: [],','    joints: [], contacts: [], pairWrenches:[], events: [], ccdHits: [], cloths: [], fluids: [],');
  s=once(s,'  const dt = admitted.options.fixedStepSeconds;',"  if(admitted.domain||admitted.options.profile!=='rigid-persistent-box-v1'||admitted.bodies.length!==2||admitted.bodies.some(b=>b.shape.kind!=='box'||b.sensor||b.ccd)||admitted.joints.length)error('INVALID_CONFIG','private STATE2 producer qualifies only the frozen two-box persistent profile');\n  const dt = admitted.options.fixedStepSeconds;");
  s=once(s,'  let contacts: PhysicsContact[] = [];','  let contacts:any[] = [];\n  let pairWrenches:any[]=[];');
  s=once(s,'persistentPoints:[...persistentPoints],activePairs:[...activePairs],sleepFrames:', 'persistentPoints:[...persistentPoints],contacts:copyData(contacts),pairWrenches:copyData(pairWrenches),activePairs:[...activePairs],sleepFrames:');
  s=once(s,'  const world: PhysicsWorld = {','  contacts=phaseInitial(phaseContext,()=>acceptedGeometry(bodies,pairs,colliderIds));\n  activePairs=acceptedMembership(contacts);\n  const world: PhysicsWorld = {');
  s=once(s,'stepIndex, dt, identity, colliderIds);','stepIndex, dt, identity, colliderIds,pairWrenches);');
  s=once(s,'      const found = new Map<string, PhysicsContact>();','      const found = new Set<string>();\n      const stepPairWrenches=new Map();');
  const a=s.indexOf('          let contact = found.get(key);'),z=s.indexOf('          const manifold = ',a);if(a<0||z<0)throw Error('Old found/cache report anchor');s=s.slice(0,a)+'          found.add(key);\n'+s.slice(z);
  const pa=s.indexOf('          const points = manifold?'),pz=s.indexOf('          if (largeMode && dormantPair',pa);if(pa<0||pz<0)throw Error('Old averaged point anchor');s=s.slice(0,pa)+s.slice(pz);
  s=once(s,'warmStartPoint(a, b, point.pointM, hit.normal, impulse);','addPairContribution(stepPairWrenches,a,b,colliderIds,warmStartPoint(a, b, point.pointM, hit.normal, impulse));');
  s=once(s,'                solvePersistentPoint(a, b, point.pointM, hit.normal, impulse,\n                  persistentNormalTargets.get(pointKey)!);','                addPairContribution(stepPairWrenches,a,b,colliderIds,solvePersistentPoint(a, b, point.pointM, hit.normal, impulse,\n                  persistentNormalTargets.get(pointKey)!));');
  const ra=s.indexOf('            contact.impulseNs = 0;'),rz=s.indexOf('          if (bounds) {',ra);if(ra<0||rz<0)throw Error('Old cached scalar/vector report anchor');s=s.slice(0,ra)+"          } else { error('NUMERIC_LIMIT','private producer forbids unconverted scalar contact path'); }\n"+s.slice(rz);
  s=once(s,'      const nextContacts = [...found.values()];','      const nextContacts=acceptedGeometry(next,pairs,colliderIds);\n      const nextPairWrenches=copyPairWrenches(stepPairWrenches);');
  s=once(s,'      const nextActive = new Map<string, Omit<PhysicsEvent, \'phase\'>>(sensed);', '      const nextActive=acceptedMembership(nextContacts);');
  const ma=s.indexOf('      for (const contact of nextContacts) {'),mz=s.indexOf('      const nextEvents = ',ma);if(ma<0||mz<0)throw Error('Accepted membership anchor');s=s.slice(0,ma)+s.slice(mz);
  s=once(s,'      validateResult(next, nextContacts);','      validateResult(next, []);');
  s=once(s,'      for (const [aIndex,bIndex] of pairs) phaseQuery(next[aIndex],next[bIndex],true);\n','');
  s=once(s,'stepIndex + 1, dt, identity, colliderIds);','stepIndex + 1, dt, identity, colliderIds,nextPairWrenches);');
  s=once(s,'      contacts = nextContacts;','      contacts = nextContacts;\n      pairWrenches = nextPairWrenches;');
  s=once(s,'bodies = []; contacts = []; events = [];','bodies = []; contacts = []; pairWrenches=[]; events = [];');return s;
 });
 edit('types.ts',s=>{
  const a=s.indexOf('export interface Contact {'),b=s.indexOf('export interface JointState',a);if(a<0||b<0)throw Error('Canonical contact type anchor');
  s=s.slice(0,a)+`export interface ContactPoint {readonly id:string;readonly normalAtoB:Vec3;readonly anchorM:Vec3;readonly pointOnAM:Vec3;readonly pointOnBM:Vec3;readonly signedGapM:number}
export interface Contact {readonly colliderAId:EntityId;readonly colliderBId:EntityId;readonly bodyAId:EntityId;readonly bodyBId:EntityId;readonly points:readonly ContactPoint[]}
export interface BodyContactWrench {readonly linearImpulseNs:Vec3;readonly angularImpulseAboutWorldOriginNms:Vec3}
export interface PairWrench {readonly colliderAId:EntityId;readonly colliderBId:EntityId;readonly bodyAId:EntityId;readonly bodyBId:EntityId;readonly onA:BodyContactWrench;readonly onB:BodyContactWrench}
`+s.slice(b);
  s=once(s,'export interface PhysicsState {','export interface PhysicsState {\n  readonly schemaVersion:2;\n  readonly pairWrenches:readonly PairWrench[];');
  s=once(s,"readonly format: 'barocss-physics-recording';\n  readonly version: 1;","readonly format: 'barocss-physics-recording';\n  readonly version: 2;");return s;
 });
 edit('replay.ts',s=>once(s,"format: 'barocss-physics-recording', version: 1,","format: 'barocss-physics-recording', version: 2,"));
 edit('replay-json.ts',s=>s.replaceAll('BCPHREC1','BCPHREC2').replace('82, 69, 67, 49','82, 69, 67, 50'));
 edit('replay-validation.ts',s=>{
  s=once(s,'data.version !== 1','data.version !== 2');
  s=once(s,"['identity','stepIndex','timeSeconds','bodies','joints','contacts','events','ccdHits','cloths','fluids','pairStats']","['schemaVersion','identity','stepIndex','timeSeconds','bodies','joints','contacts','pairWrenches','events','ccdHits','cloths','fluids','pairStats']");
  s=once(s,'  identity(state.identity);',"  if(state.schemaVersion!==2)replayError('INVALID_SNAPSHOT','STATE2 required');\n  identity(state.identity);");
  const a=s.indexOf('  entries(state.contacts,'),b=s.indexOf('  entries(state.events,',a);if(a<0||b<0)throw Error('Canonical replay contact validation anchor');
  s=s.slice(0,a)+`  function pairOwner(c:Record<string,unknown>):string {body(c.bodyAId);body(c.bodyBId);collider(c.colliderAId);collider(c.colliderBId);if(c.bodyAId>=c.bodyBId||colliders.get(c.colliderAId as string)!==c.bodyAId||colliders.get(c.colliderBId as string)!==c.bodyBId)replayError('INVALID_SNAPSHOT','pair ordering/owners differ');return c.bodyAId+'\\u0000'+c.bodyBId;}
  let priorContact='';entries(state.contacts,['colliderAId','colliderBId','bodyAId','bodyBId','points'],c=>{const key=pairOwner(c);if(key<=priorContact)replayError('INVALID_SNAPSHOT','contact pairs not unique/sorted');priorContact=key;if(!Array.isArray(c.points)||c.points.length===0)replayError('INVALID_SNAPSHOT','contact points required');let priorPoint='';entries(c.points,['id','normalAtoB','anchorM','pointOnAM','pointOnBM','signedGapM'],p=>{if(typeof p.id!=='string'||p.id<=priorPoint)replayError('INVALID_SNAPSHOT','point IDs not unique/sorted');priorPoint=p.id as string;vector(p.normalAtoB);vector(p.anchorM);vector(p.pointOnAM);vector(p.pointOnBM);number(p.signedGapM);});});
  let priorWrench='';entries(state.pairWrenches,['colliderAId','colliderBId','bodyAId','bodyBId','onA','onB'],p=>{const key=pairOwner(p);if(key<=priorWrench)replayError('INVALID_SNAPSHOT','wrench pairs not unique/sorted');priorWrench=key;for(const side of ['onA','onB']){const value=record(p[side],['linearImpulseNs','angularImpulseAboutWorldOriginNms'],'body contact wrench');vector(value.linearImpulseNs);vector(value.angularImpulseAboutWorldOriginNms);}});
`+s.slice(b);
  s=once(s,"  entries(state.events,","  let previousAcceptedEvent='';\n  entries(state.events,");
  s=once(s,"    collider(e.colliderAId); collider(e.colliderBId);","    collider(e.colliderAId); collider(e.colliderBId); const ownerA=colliders.get(e.colliderAId as string),ownerB=colliders.get(e.colliderBId as string),key=ownerA+'\\u0000'+ownerB;if(ownerA>=ownerB||key<=previousAcceptedEvent)replayError('INVALID_SNAPSHOT','event pair order/ownership invalid');previousAcceptedEvent=key;");
  return '// @ts-nocheck\n'+s;
 });
}
