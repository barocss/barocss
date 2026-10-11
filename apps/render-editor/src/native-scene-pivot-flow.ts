import {parseRenderNativeSceneDocument, serializeRenderNativeSceneDocument, validateRenderNativeSceneDocument,
  prepareRenderNativeSceneAppearance, prepareRenderNativeSceneGizmo, deriveRenderNativeSceneGizmoPose} from '@barocss/render-editor';
import type {RenderNativeSceneDocument, RenderNativeScenePose, RenderSceneGizmoMode, RenderSceneGizmoKey} from '@barocss/render-editor';
import {createCadGeometryReference, queryCadDocumentBounds, validateCadDocumentBounds} from '@barocss/cad';
import {prepareCamera, prepareEngineScene} from '@barocss/gpu';
import type {MeshCamera} from '@barocss/gpu';
import {createNativeSceneHost} from './native-scene-host';
import {prepareNativeViewportAppearance} from './native-viewport-presentation';

type XYZ = readonly [number, number, number]; type XY = readonly [number, number]; type Q = readonly [number, number, number, number];
const center: XYZ = [0, -550, 0], axes = ['x', 'y', 'z'] as const;
const viewport = {width: 900, height: 600, backingWidth: 1800, backingHeight: 1200};
const camera: MeshCamera = {eye: [6, 4, 8], target: [0, -.55, 0], up: [0, 1, 0], fovYDegrees: 50, near: .01, far: 100};
const scope = 'Actual public CAD bounds, GPU camera/unit-pose matrices, Native pivot/preflight and declared host presentation protocol. CPU mathematics is separate from GUI pixels; files contain original authorship only.';
function check(value: unknown, message: string): asserts value {if (!value) throw new Error(message);}
const copy = <T,>(value: T): T => structuredClone(value);
function equal(a: unknown, b: unknown, label = 'value'): void {
  if (Object.is(a, b)) return;
  check(a !== null && b !== null && typeof a === 'object' && typeof b === 'object', label + ' differs.');
  const left = Object.keys(a), right = Object.keys(b); check(left.length === right.length && left.every(key => right.includes(key)), label + ' fields differ.');
  for (const key of left) equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], label + '.' + key);
}
function near(a: number, b: number, tolerance = 1e-8): void {check(Number.isFinite(a) && Math.abs(a - b) <= tolerance, `${a} differs from ${b} (tolerance ${tolerance}).`);}
function vectorNear(a: XYZ, b: XYZ, tolerance = 1e-8): void {a.forEach((value, index) => near(value, b[index]!, tolerance));}
function refuse(operation: () => unknown): unknown {try {operation();} catch (cause) {return cause;} throw new Error('Expected actual pivot refusal.');}
function guarded<T>(reads: string[], operation: () => T): T {
  const saved = new Map<string, PropertyDescriptor | undefined>();
  try {
    for (const key of ['window', 'document', 'HTMLCanvasElement', 'WebGL2RenderingContext', 'requestAnimationFrame']) {
      saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, {configurable: true, get() {reads.push(key); throw Error('Pure pivot read ' + key);}});
    } return operation();
  } finally {for (const [key, descriptor] of saved) {if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);}}
}
function body(document: RenderNativeSceneDocument): string {const ids = document.nativeDocument.bodies.filter(item => !['body_preview_a', 'body_preview_b'].includes(item.id)); check(ids.length === 1, 'Supply genuine three-body original file.'); return ids[0]!.id;}
function pose(document: RenderNativeSceneDocument, bodyId: string): RenderNativeScenePose {const value = document.display.poses.find(item => item.bodyId === bodyId); check(value, 'Explicit original pose required.'); return value;}
function withPose(document: RenderNativeSceneDocument, next: RenderNativeScenePose): RenderNativeSceneDocument {return validateRenderNativeSceneDocument({...document, display: {...document.display, poses: document.display.poses.map(item => item.bodyId === next.bodyId ? next : item)}});}
function qProduct(a: Q, b: Q): [number, number, number, number] {return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0], a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];}
/** Independent quaternion oracle; only tests normalize, never authored q. */
function rotate(q: Q, point: XYZ): [number, number, number] {const length = Math.hypot(...q), n = q.map(value => value / length) as [number,number,number,number]; return qProduct(qProduct(n, [...point, 0]), [-n[0],-n[1],-n[2],n[3]]).slice(0,3) as [number,number,number];}
function rotationMatrix(q: Q) {
  return prepareEngineScene({format: 'barocss-gpu-engine-scene', version: 0, id: 'pivot_oracle', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', camera, background: [0,0,0], geometries: [], materials: [],
    nodes: [{id:'unit_pose',type:'group',parentId:null,translation:[0,0,0],rotationXYZW:[...q],scale:[1,1,1],visible:true}]}).nodes[0]!.worldMatrix;
}
function matrixVector(matrix: readonly number[], point: XYZ): [number,number,number] {return [0,1,2].map(row => matrix[row]!*point[0]+matrix[4+row]!*point[1]+matrix[8+row]!*point[2]) as [number,number,number];}
function worldCenter(current: RenderNativeScenePose, independent = false): [number,number,number] {
  const scaled = center.map((value,i) => value*current.scale[i]!) as [number,number,number], offset = independent ? rotate(current.rotationXYZW,scaled) : matrixVector(rotationMatrix(current.rotationXYZW),scaled);
  return offset.map((value,i) => value+current.translationMM[i]!) as [number,number,number];
}
function projection(document: RenderNativeSceneDocument, current: RenderNativeScenePose, pivot: 'origin'|'bounds-center', view = camera) {
  const origin = (pivot === 'origin' ? current.translationMM : worldCenter(current)).map(value => value*document.display.mmToSceneUnit) as [number,number,number], matrices = prepareCamera(view,viewport.backingWidth/viewport.backingHeight);
  const forward = (point: XYZ): XY => {const v = [0,1,2,3].map(row=>matrices.view[row]!*point[0]+matrices.view[row+4]!*point[1]+matrices.view[row+8]!*point[2]+matrices.view[row+12]!);
    const clip = [0,1,2,3].map(row=>matrices.projection[row]!*v[0]!+matrices.projection[row+4]!*v[1]!+matrices.projection[row+8]!*v[2]!+matrices.projection[row+12]! *v[3]!); return [(1+clip[0]!/clip[3]!)*viewport.width/2,(1-clip[1]!/clip[3]!)*viewport.height/2];};
  const depth = -(matrices.view[2]!*origin[0]+matrices.view[6]!*origin[1]+matrices.view[10]!*origin[2]+matrices.view[14]!);
  return {origin,forward,radius:160*depth/(matrices.projection[5]!*viewport.height)};
}
function operation(document: RenderNativeSceneDocument, bodyId: string, mode: RenderSceneGizmoMode, space:'world'|'local', key:RenderSceneGizmoKey, view = camera) {
  const current = pose(document,bodyId), projected = projection(document,current,'bounds-center',view), prepared = prepareRenderNativeSceneGizmo(document,bodyId,view,viewport,mode,space,'bounds-center'), handle = prepared.handles.find(item=>item.key===key);
  check(handle,'Supported oblique pivot handle missing: '+mode+'/'+space+'/'+key);
  const axis=axes.indexOf(key as typeof axes[number]), matrix=rotationMatrix(current.rotationXYZW);
  const local=(index:number):XYZ=>{const values=[matrix[index*4]!,matrix[index*4+1]!,matrix[index*4+2]!], length=Math.hypot(...values);return values.map(value=>value/length) as [number,number,number];};
  const direction:XYZ=space==='world'?[0,1,2].map(i=>i===axis?1:0) as [number,number,number]:local(axis);
  const at=(distance:number):XY=>projected.forward(projected.origin.map((value,i)=>value+direction[i]!*distance) as [number,number,number]);
  let from:XY,to:XY;
  if(mode==='translate'){from=at(.2);to=at(.3);}
  else if(mode==='scale'&&key==='uniform'){from=handle.anchor;to=[prepared.pivot[0]+(from[0]-prepared.pivot[0])*1.1,prepared.pivot[1]+(from[1]-prepared.pivot[1])*1.1];}
  else if(mode==='scale'){from=at(projected.radius*.2);to=at(projected.radius*.3);}
  else {const index=handle.points.findIndex(point=>point===handle.anchor);check(index>=0&&index<64,'Front ring anchor phase missing.');
    const a:XYZ=space==='world'?[0,1,2].map(i=>i===(axis+1)%3?1:0) as [number,number,number]:local((axis+1)%3), b:XYZ=space==='world'?[0,1,2].map(i=>i===(axis+2)%3?1:0) as [number,number,number]:local((axis+2)%3);
    const arc=(theta:number):XY=>projected.forward(projected.origin.map((value,i)=>value+projected.radius*(a[i]!*Math.cos(theta)+b[i]!*Math.sin(theta))) as [number,number,number]);
    const theta=index*Math.PI/32,left=arc(theta-1e-5),right=arc(theta+1e-5), tangent=[right[0]-left[0],right[1]-left[1]],length=Math.hypot(...tangent);check(length>1e-8,'Independent tangent degenerate.');
    from=handle.anchor;to=[from[0]+tangent[0]!/length*12,from[1]+tangent[1]!/length*12];}
  const result=deriveRenderNativeSceneGizmoPose(document,bodyId,view,viewport,mode,space,key,from,to,'bounds-center');
  if(mode==='rotate'){const half=.15/2,delta=[0,0,0,Math.cos(half)] as [number,number,number,number];delta[axis]=Math.sin(half);const expected=space==='world'?qProduct(delta,current.rotationXYZW):qProduct(current.rotationXYZW,delta);result.rotationXYZW.forEach((value,i)=>near(value,expected[i]!,1e-7));equal(result.scale,current.scale);}
  else {equal(result.rotationXYZW,current.rotationXYZW);if(mode==='scale')result.scale.forEach((value,i)=>near(value,current.scale[i]!*(key==='uniform'||axis===i?1.1:1)));}
  if(mode==='translate')vectorNear(result.translationMM,current.translationMM.map((value,i)=>value+direction[i]!*.1/document.display.mmToSceneUnit) as [number,number,number]);
  else {vectorNear(worldCenter(result),worldCenter(current),1e-8);vectorNear(worldCenter(result,true),worldCenter(current,true),2e-4);}
  const next=withPose(document,result);prepareRenderNativeSceneAppearance(next);return {result,from,to,prepared};
}

export function runNativeScenePivotFlow(originalText:string) {
  const browserGlobalReads:string[]=[];return guarded(browserGlobalReads,()=>{
    const original=parseRenderNativeSceneDocument(originalText), bodyId=body(original), current=pose(original,bodyId), before=serializeRenderNativeSceneDocument(original), actual=prepareRenderNativeSceneAppearance(original);
    check(original.revision===32&&original.nativeDocument.revision===4,'Use preserved1531SECOND32/native4.');check(before===originalText,'Original file canonical bytes differ.');
    const reference=createCadGeometryReference(actual.authored.native,{bodyId}), bounds=queryCadDocumentBounds(actual.authored.native,reference.reference);validateCadDocumentBounds(actual.authored.native,bounds);
    equal(bounds.boxCenterMM,center);equal(bounds.boundsMM,{min:[-700,-550,-700],max:[700,-550,700]});check(bounds.report.geometryAuthority==='original-native-control-hull','Wrong bounds authority.');
    const q90:Q=[0,0,Math.SQRT1_2,Math.SQRT1_2];vectorNear(matrixVector(rotationMatrix(q90),[1,0,0]),[0,1,0]);vectorNear(rotate(q90,[0,-550,0]),[550,0,0]);
    const matrices=rotationMatrix(current.rotationXYZW);for(let axis=0;axis<3;axis++)vectorNear(matrixVector(matrices,[0,1,2].map(i=>i===axis?1:0) as [number,number,number]),rotate(current.rotationXYZW,[0,1,2].map(i=>i===axis?1:0) as [number,number,number]),1e-7);
    const entry=actual.authored.entries.find(item=>item.binding.bodyId===bodyId);check(entry?.kind==='surface','Real selected Surface packet missing.');
    const primitive=actual.viewer.prepared.primitives.find(item=>'ref'in item.entry&&item.entry.ref.modelId===entry.ref.modelId&&item.entry.ref.geometryId===entry.ref.geometryId);check(primitive?.normals,'Actual display primitive/normals missing.');
    for(const offset of [0,12,entry.packet.positions.length-3]){const transformed=rotate(current.rotationXYZW,[0,1,2].map(i=>entry.packet.positions[offset+i]!*current.scale[i]!) as [number,number,number]), normal=rotate(current.rotationXYZW,[0,1,2].map(i=>entry.packet.normals[offset+i]!/current.scale[i]!) as [number,number,number]),length=Math.hypot(...normal);
      for(let axis=0;axis<3;axis++){near(primitive.positions[offset+axis]!,Math.fround((transformed[axis]!+current.translationMM[axis]!)*original.display.mmToSceneUnit),4e-7);near(primitive.normals[offset+axis]!,Math.fround(normal[axis]!/length),2e-7);}}
    const origin=prepareRenderNativeSceneGizmo(original,bodyId,camera,viewport,'scale','local'), explicit=prepareRenderNativeSceneGizmo(original,bodyId,camera,viewport,'scale','local','origin'), centered=prepareRenderNativeSceneGizmo(original,bodyId,camera,viewport,'scale','local','bounds-center');equal(origin,explicit);
    check(Math.hypot(origin.pivot[0]-centered.pivot[0],origin.pivot[1]-centered.pivot[1])>1,'Offset original Surface pivots should differ.');const oracle=projection(original,current,'bounds-center').forward(worldCenter(current).map(value=>value*.001) as [number,number,number]);centered.pivot.forEach((value,i)=>near(value,oracle[i]!,1e-8));
    const outcomes:unknown[]=[];for(const space of ['world','local'] as const)for(const key of axes)outcomes.push(operation(original,bodyId,'rotate',space,key).result);
    for(const key of [...axes,'uniform'] as const)outcomes.push(operation(original,bodyId,'scale','local',key).result);outcomes.push(operation(original,bodyId,'translate','world','x').result);
    const rawQ=q90.map(value=>value*(1+2e-10)) as [number,number,number,number], tinyScale=withPose(original,{...current,translationMM:[1200,-0,200],rotationXYZW:rawQ,scale:[.001,.7,1.2]});
    for(const mode of ['translate','rotate','scale'] as const){const space=mode==='translate'?'world':'local', prepared=prepareRenderNativeSceneGizmo(tinyScale,bodyId,camera,viewport,mode,space,'bounds-center'), handle=prepared.handles.find(item=>item.key==='x');check(handle,'Small native scale profile was narrowed.');
      equal(deriveRenderNativeSceneGizmoPose(tinyScale,bodyId,camera,viewport,mode,space,'x',handle.anchor,handle.anchor,'bounds-center'),pose(tinyScale,bodyId));
      const omitted=deriveRenderNativeSceneGizmoPose(original,bodyId,camera,viewport,mode,space,'x',origin.pivot,origin.pivot), named=deriveRenderNativeSceneGizmoPose(original,bodyId,camera,viewport,mode,space,'x',origin.pivot,origin.pivot,'origin');equal(omitted,named);}
    operation(tinyScale,bodyId,'scale','local','x');
    const failureCauses:unknown[]=[];failureCauses.push(refuse(()=>prepareRenderNativeSceneGizmo(original,bodyId,camera,viewport,'scale','local','bad' as 'origin')));
    failureCauses.push(refuse(()=>prepareRenderNativeSceneGizmo(original,'unknown',camera,viewport,'scale','local','bounds-center')));
    failureCauses.push(refuse(()=>deriveRenderNativeSceneGizmoPose(original,bodyId,camera,viewport,'rotate','local','x',[-1,-1],[1,1],'bounds-center')));
    const invalidSource={...original,nativeDocument:{...original.nativeDocument,assets:original.nativeDocument.assets.map((item,i)=>i===0?{...item,source:'bad native syntax'}:item)}};
    failureCauses.push(refuse(()=>prepareRenderNativeSceneGizmo(invalidSource,bodyId,camera,viewport,'scale','local','bounds-center')));
    const overScale=withPose(original,{...current,scale:[99,current.scale[1],current.scale[2]]});failureCauses.push(refuse(()=>operation(overScale,bodyId,'scale','local','uniform')));
    const nearLimit=withPose(original,{...current,translationMM:[9999,-0,0],rotationXYZW:q90,scale:[.8,30,.7]}), limitCamera:MeshCamera={...camera,eye:[32.499,4,8],target:[26.499,0,0]};prepareRenderNativeSceneAppearance(nearLimit);
    failureCauses.push(refuse(()=>operation(nearLimit,bodyId,'rotate','world','z',limitCamera)));
    const underflow=withPose(original,{...current,translationMM:[1e-50,0,0],rotationXYZW:[0,0,0,1]});const error=refuse(()=>prepareRenderNativeSceneGizmo(underflow,bodyId,camera,viewport,'scale','local','bounds-center'));
    const messages:string[]=[];for(let item:unknown=error,index=0;item&&index<8;index++){messages.push(item instanceof Error?item.message:String(item));item=typeof item==='object'&&item!==null&&'cause'in item?item.cause:null;}
    check(messages.some(message=>message.includes('underflows in Float32')),'Underflow fixture must reach actual original F32 provider refusal.');failureCauses.push(messages);
    check(serializeRenderNativeSceneDocument(original)===before,'Math/refusals altered original authoring.');
    const host=createNativeSceneHost(original);let shown=original,shownCamera=copy(camera),owner:object={},fail=false;
    host.setPresenter((prepared,override)=>{const request=prepareNativeViewportAppearance(prepared,override);if(fail){fail=false;throw Error('Declared CPU presentation refusal');}shown=prepared.authored.document;shownCamera=copy(request.display.camera);owner={};},()=>owner,()=>shownCamera);
    host.selectTarget(bodyId);shownCamera=copy(camera);host.observeView(shownCamera);const snapshot=host.getSnapshot(), token=host.beginBodyPosePreview(bodyId), derived=operation(snapshot.accepted,bodyId,'rotate','local','z').result;
    fail=true;refuse(()=>host.previewBodyPose(token,derived));check(host.getSnapshot().accepted===snapshot.accepted&&host.getSnapshot().posePreview===null,'Failed preview changed authority.');
    host.previewBodyPose(token,derived);check(host.getSnapshot().accepted===snapshot.accepted&&host.getSnapshot().canUndo===snapshot.canUndo,'Pivot preview authored history.');vectorNear(worldCenter(pose(shown,bodyId)),worldCenter(current));
    const preview=host.getSnapshot().posePreview;fail=true;refuse(()=>host.cancelBodyPosePreview(token));check(host.getSnapshot().posePreview===preview,'Failed Cancel lost retryable pivot preview.');host.cancelBodyPosePreview(token);equal(shown,snapshot.accepted);
    const applied=host.beginBodyPosePreview(bodyId);host.previewBodyPose(applied,derived);host.applyBodyPosePreview(applied);check(host.getSnapshot().accepted.revision===snapshot.accepted.revision+1,'Pivot release must be ONE whole history.');
    host.materialSession.setDraftUniforms({amount:NaN});refuse(()=>host.beginBodyPosePreview(bodyId));check(Number.isNaN(host.materialSession.getSnapshot().draftUniforms.amount),'Guard consumed raw.');host.dispose();
    return {scope,browserGlobalReads,selectedBodyId:bodyId,bounds:{boundsMM:bounds.boundsMM,boxCenterMM:bounds.boxCenterMM,report:bounds.report},outcomes,refusals:failureCauses.length,actualUnderflowMessages:messages,
      checks:['Actual original control-hull c=[0,-550,0], known90deg and independent q/public unit-matrix witnesses.','Default/explicit origin parity; distinct actual centered projection; local/world RotateXYZ, ScaleXYZ/All center invariant (matrix1e-8mm, independent quaternion2e-4mm), Move100mm.','Native .001 scale, rawq and -0 noops, fullappearance refusals/source retention and actual original F32 underflow.','Declared host preview/history/raw/failure/Cancel retry protocol, never graphics.']};
  });
}

export interface NativeScenePivotFileObservations {readonly bodyId:string;readonly firstRevision:number;readonly secondRevision:number;readonly firstPose:RenderNativeScenePose;readonly secondPose:RenderNativeScenePose}
export function verifyNativeScenePivotFiles(originalText:string,firstText:string,secondText:string,observed:NativeScenePivotFileObservations) {
  const browserGlobalReads:string[]=[];return guarded(browserGlobalReads,()=>{
    const original=parseRenderNativeSceneDocument(originalText),first=parseRenderNativeSceneDocument(firstText),second=parseRenderNativeSceneDocument(secondText);
    check(body(original)===observed.bodyId&&observed.firstPose.bodyId===observed.bodyId&&observed.secondPose.bodyId===observed.bodyId,'Observed original body mismatch.');
    check(observed.firstRevision>original.revision&&observed.secondRevision>observed.firstRevision,'Use actual monotonic observed revisions.');
    equal(first,{...original,revision:observed.firstRevision,display:{...original.display,poses:original.display.poses.map(item=>item.bodyId===observed.bodyId?observed.firstPose:item)}},'FIRST actual pose-only delta');
    equal(second,{...first,revision:observed.secondRevision,display:{...first.display,poses:first.display.poses.map(item=>item.bodyId===observed.bodyId?observed.secondPose:item)}},'SECOND actual pose-only delta');
    for(const [document,text]of [[original,originalText],[first,firstText],[second,secondText]] as const){check(serializeRenderNativeSceneDocument(document)===text,'Genuine canonical file bytes differ.');prepareRenderNativeSceneAppearance(document);}
    vectorNear(worldCenter(observed.firstPose),worldCenter(pose(original,observed.bodyId)),1e-8);vectorNear(worldCenter(observed.secondPose),worldCenter(observed.firstPose),1e-8);
    return {scope:'Genuine authored-file public codec/appearance plus actual observed pose-only deltas; not GUI/pixel evidence.',browserGlobalReads,observed,checks:['Original source/TEN/otherbody/material/light/camera exact whole-object retention.','Actual monotonic revisions and supplied first/second poses only; source-bound center invariant and complete real preflight.']};
  });
}
