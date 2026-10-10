import {useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {Spline,Move,RotateCw,Scaling} from 'lucide-react';
import {resolveCadGeometryReference, type CadGeometryReferenceV0} from '@barocss/cad';
import {CadEditorError, type CadEditorSession, type CadEditorSnapshot, type CadEditorPoleField, type CadEditorEditTarget, type CadEditorDraftField, type CadEditorRotationAxis, type CadEditorScaleAxis} from '../types.js';
import type {CadEditorDisplayReceipt, CadEditorCurveFocusReceipt} from './types.js';
import {useCadEditorSnapshot} from './use-session.js';
import {Button} from './ui/button.js';
import type {PolePoint} from './curve-pole-projection.js';
import {ObjectRotationGizmo} from './object-rotation-gizmo.js';
import {ObjectScaleGizmo} from './object-scale-gizmo.js';
import {parseScaleStep} from './scale-projection.js';
import {parseAngularStep} from './rotation-projection.js';
import {projectPoleAxis, movePoleOnAxis, axisPointerDisplacement, parseMovementSnapStep, type PoleAxis, type PoleAxisProjection} from './pole-axis-projection.js';

interface Props {
  session: CadEditorSession;
  documentReceipt: CadEditorDisplayReceipt | null;
  curveReceipt: CadEditorCurveFocusReceipt | null;
  canvas: HTMLCanvasElement | null;
  onError: (error: CadEditorError) => void;
  onGestureChange: (active: boolean) => void;
}
export interface Control {
  point: PolePoint;
  key: string;
  reference: CadGeometryReferenceV0;
  kind: 'surface' | 'curve';
  receipt: CadEditorDisplayReceipt;
}
interface Gesture {
  pointerId: number;
  element: SVGCircleElement;
  axis: PoleAxis;
  editTarget: CadEditorEditTarget;
  control: Control;
  generation: number;
  displayGeneration: number;
  projection: PoleAxisProjection;
  startX: number;
  startY: number;
  rect: {left:number;top:number;width:number;height:number};
  cameraKey: string;
  step: number | null;
  moved: boolean;
  raw: Partial<Record<CadEditorPoleField,string>>;
}
const fields = ['xMM','yMM','zMM'] as const;
const names = ['X','Y','Z'] as const;
const tools = [
  {target:'pole',key:'q',name:'Control point',icon:Spline},
  {target:'object',key:'w',name:'Move object',icon:Move},
  {target:'rotation',key:'e',name:'Rotate object',icon:RotateCw},
  {target:'scale',key:'r',name:'Scale object',icon:Scaling},
] as const;
const rawNumber = (value:number) => Object.is(value,-0) ? '-0' : String(value);
const same = (a:unknown,b:unknown) => JSON.stringify(a) === JSON.stringify(b);
function sameRaw(a:Partial<Record<CadEditorPoleField,string>>,b:Partial<Record<CadEditorPoleField,string>>) {
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => a[key as CadEditorPoleField] === b[key as CadEditorPoleField]);
}

function currentControl(snapshot:CadEditorSnapshot, documentReceipt:CadEditorDisplayReceipt|null, curveReceipt:CadEditorCurveFocusReceipt|null):Control|null {
  if (snapshot.disposed) return null;
  const surface = snapshot.selection, curve = snapshot.curveSelection;
  const capability = snapshot.bodyCapabilities.find(body => body.bodyId === snapshot.selectedBodyId);
  if (snapshot.view.kind === 'document' && surface && (snapshot.editTarget === 'scale' ? capability?.canScaleBody : snapshot.editTarget === 'rotation' ? capability?.canRotateBody : snapshot.editTarget === 'object' ? capability?.canTranslateBody : capability?.canEditSurfacePole)
    && documentReceipt?.state.status === 'ready' && snapshot.displayBodyIds.includes(surface.bodyId)
    && documentReceipt.state.documentBodies.some(body => body.binding.bodyId === surface.bodyId && body.ref.kind === 'surface')
    && same(documentReceipt.state.document,snapshot.accepted)) {
    const resolved = resolveCadGeometryReference(snapshot.accepted,surface.reference);
    if (resolved.geometry.kind === 'surface') return {point:[...resolved.geometry.controlPoints[surface.uIndex][surface.vIndex]],
      key:`surface:${surface.bodyId}:${surface.uIndex}:${surface.vIndex}`,reference:surface.reference,kind:'surface',receipt:documentReceipt};
  }
  if (snapshot.view.kind === 'curve-focus' && curve && (snapshot.editTarget === 'scale' ? capability?.canScaleBody : snapshot.editTarget === 'rotation' ? capability?.canRotateBody : snapshot.editTarget === 'object' ? capability?.canTranslateBody : capability?.canEditCurvePole)
    && snapshot.view.bodyId === curve.bodyId && curveReceipt?.state.status === 'ready'
    && curveReceipt.generation === snapshot.generation && curveReceipt.displayGeneration === snapshot.displayGeneration
    && same(curveReceipt.reference,curve.reference)) {
    const resolved = resolveCadGeometryReference(snapshot.accepted,curve.reference);
    if (resolved.geometry.kind === 'curve' && resolved.source === curveReceipt.preview.source) return {
      point:[...resolved.geometry.controlPoints[curve.index]],key:`curve:${curve.bodyId}:${curve.index}`,
      reference:curve.reference,kind:'curve',receipt:curveReceipt};
  }
  return null;
}

/** Axis handles edit original native coefficients. The rendered shape remains accepted until admission. */
export function PoleAxisGizmo(props:Props) {
  const {session} = props;
  const snapshot = useCadEditorSnapshot(session);
  const snapErrorId = useId();
  const angularErrorId=useId(),scaleErrorId=useId();
  const latest = useRef(props); latest.current = props;
  const gesture = useRef<Gesture|null>(null);
  const transformGesture = useRef(false);
  const viewportPointers = useRef(new Map<number,Element>());
  const [pointerCaptured,setPointerCaptured] = useState(false);
  const [movingAxis,setMovingAxis] = useState<PoleAxis|null>(null);
  const [snapEnabled,setSnapEnabled] = useState(false);
  const [stepRaw,setStepRaw] = useState('1');
  const [rotationMoving,setRotationMoving]=useState(false);
  const [angularSnap,setAngularSnap]=useState(false);
  const [angularStepRaw,setAngularStepRaw]=useState('15');
  const rotationMode=snapshot.editTarget==='rotation';
  const scaleMode=snapshot.editTarget==='scale';
  const [scaleMoving,setScaleMoving]=useState(false);
  const [scaleSnap,setScaleSnap]=useState(false);
  const [scaleStepRaw,setScaleStepRaw]=useState('0.1');
  let scaleStep:number|null=null,scaleError:string|null=null;
  if(scaleSnap){try{scaleStep=parseScaleStep(scaleStepRaw);}catch{scaleError='Enter a factor step from 0.001 to 1.';}}
  let angularStep:number|null=null,angularError:string|null=null;
  if(angularSnap){try{angularStep=parseAngularStep(angularStepRaw);}catch{angularError='Enter an angle step from 0.001 to 180 degrees.';}}
  let step:number|null = null, stepError:string|null = null;
  if (snapEnabled) {
    try {step = parseMovementSnapStep(stepRaw);}
    catch {stepError = 'Enter a snap distance from 0.000001 to 1000000 mm.';}
  }
  let control:Control|null = null;
  try {control = currentControl(snapshot,props.documentReceipt,props.curveReceipt);} catch { /* Unavailable bindings have no handles. */ }
  const objectMode = snapshot.editTarget === 'object';
  const canvas = props.canvas, rect = canvas?.getBoundingClientRect();
  const pending = Object.keys(snapshot.pending).length > 0;
  const busy = snapshot.candidate !== null || snapshot.selectionTransition !== null || snapshot.disposed || pending || movingAxis !== null || rotationMoving || scaleMoving || pointerCaptured;
  function viewportHasCapture():boolean {
    return [...viewportPointers.current].some(([id,target])=>target.isConnected&&target.hasPointerCapture(id));
  }
  useEffect(()=>{if(pointerCaptured&&!viewportHasCapture())setPointerCaptured(false);});
  function available(state:CadEditorSnapshot,target:CadEditorEditTarget):boolean {
    const cap=state.bodyCapabilities.find(body=>body.bodyId===state.selectedBodyId);
    return target==='object'?cap?.canTranslateBody===true:target==='rotation'?cap?.canRotateBody===true
      :target==='scale'?cap?.canScaleBody===true:state.selection?cap?.canEditSurfacePole===true:cap?.canEditCurvePole===true;
  }
  function chooseTool(target:CadEditorEditTarget):boolean {
    try {
      const state=session.getSnapshot(),now=latest.current;
      if(gesture.current||transformGesture.current||viewportHasCapture()||state.disposed||state.candidate||state.selectionTransition||Object.keys(state.pending).length
        ||!available(state,target)||!currentControl(state,now.documentReceipt,now.curveReceipt))return false;
      const restoreScope=document.activeElement?.closest('.context-mode-controls');
      session.setEditTarget(target);
      if(restoreScope)now.canvas?.closest('.cad-editor-viewport')?.querySelector<HTMLButtonElement>('[data-testid="native-tool-'+target+'"]')?.focus({preventScroll:true});
      return true;
    }catch(cause){failure(cause);return false;}
  }
  function settingsAllowed(mode:'movement'|'rotation'|'scale'):boolean {
    const state=session.getSnapshot(),now=latest.current;
    const matching=mode==='movement'?state.editTarget==='pole'||state.editTarget==='object':state.editTarget===mode;
    return matching&&!gesture.current&&!transformGesture.current&&!viewportHasCapture()&&!state.disposed
      &&state.candidate===null&&state.selectionTransition===null&&Object.keys(state.pending).length===0
      &&now.canvas?.isConnected===true&&now.canvas.closest('.cad-editor-viewport')?.getAttribute('data-viewer-ready')==='true'
      &&currentControl(state,now.documentReceipt,now.curveReceipt)!==null;
  }
  function chooseAxis(mode:'rotation'|'scale',axis:CadEditorRotationAxis|CadEditorScaleAxis){
    try{if(!settingsAllowed(mode))return;if(mode==='rotation')session.setRotationAxis(axis as CadEditorRotationAxis);else session.setScaleAxis(axis);}
    catch(cause){failure(cause);}
  }
  function changeSnap(mode:'movement'|'rotation'|'scale',enabled:boolean){
    try{if(!settingsAllowed(mode))return;if(mode==='movement')setSnapEnabled(enabled);else if(mode==='rotation')setAngularSnap(enabled);else setScaleSnap(enabled);}
    catch(cause){failure(cause);}
  }
  function changeStep(mode:'movement'|'rotation'|'scale',raw:string){
    try{if(!settingsAllowed(mode))return;if(mode==='movement')setStepRaw(raw);else if(mode==='rotation')setAngularStepRaw(raw);else setScaleStepRaw(raw);}
    catch(cause){failure(cause);}
  }
  useEffect(()=>{
    let listening=true;
    const down=(event:PointerEvent)=>{
      const target=event.target,viewport=latest.current.canvas?.closest('.cad-editor-viewport');
      if(!(target instanceof Element)||!viewport?.contains(target))return;
      viewportPointers.current.set(event.pointerId,target);
      // A microtask can run between capture and React's pointerdown handler.
      setTimeout(()=>{if(listening)setPointerCaptured(viewportHasCapture());},0);
    };
    const release=(event:PointerEvent)=>{
      if(event.type==='lostpointercapture'&&viewportPointers.current.get(event.pointerId)!==event.target)return;
      viewportPointers.current.delete(event.pointerId);setPointerCaptured(viewportHasCapture());
    };
    const command=(event:KeyboardEvent)=>{
      if(event.defaultPrevented||event.repeat||event.isComposing||event.keyCode===229||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
      const tool=tools.find(item=>item.key===event.key.toLowerCase());if(!tool)return;
      const target=event.target,viewport=latest.current.canvas?.closest('.cad-editor-viewport');
      if(!(target instanceof Element)||!viewport?.contains(target)
        ||target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="dialog"],[role="menu"]'))return;
      if(chooseTool(tool.target)){event.preventDefault();event.stopPropagation();}
    };
    window.addEventListener('keydown',command);window.addEventListener('pointerdown',down,true);
    window.addEventListener('pointerup',release,true);window.addEventListener('pointercancel',release,true);window.addEventListener('lostpointercapture',release,true);
    return()=>{listening=false;window.removeEventListener('keydown',command);window.removeEventListener('pointerdown',down,true);
      window.removeEventListener('pointerup',release,true);window.removeEventListener('pointercancel',release,true);window.removeEventListener('lostpointercapture',release,true);viewportPointers.current.clear();};
  },[session]);
  const projections:(PoleAxisProjection|null)[] = [];
  if (!rotationMode && !scaleMode && control && rect && rect.width > 0 && rect.height > 0 && control.receipt.width > 0 && control.receipt.height > 0) {
    const ghost = control.point.map((value,index) => {
      const raw = snapshot.pending[fields[index]];
      if (raw === undefined) return value;
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim())) return NaN;
      const number = Number(raw);
      return objectMode ? number === 0 ? value : value+number : number;
    }) as PolePoint;
    const point = ghost.every(Number.isFinite) ? ghost : control.point;
    for (const axis of [0,1,2] as const) projections.push(projectPoleAxis(point,control.receipt.state.camera,
      control.receipt.state.mmToSceneUnit,rect.width,rect.height,control.receipt.width,control.receipt.height,axis));
    // Keep the captured element mounted if an owned ghost crosses the viewport boundary.
    const g = gesture.current;
    if (g && projections[g.axis] === null && sameRaw(snapshot.pending,g.raw)) {
      const q = (point[g.axis]-g.projection.originMM[g.axis])*g.projection.mmToSceneUnit;
      const depth = g.projection.depth-q*g.projection.cameraAxisDepth;
      const distance = q*g.projection.lengthCoefficient/depth;
      if (depth>0 && Number.isFinite(distance)) projections[g.axis] = {...g.projection,
        xCss:g.projection.xCss+g.projection.dirX*distance,yCss:g.projection.yCss+g.projection.dirY*distance};
    }
  }
  function failure(cause:unknown) {
    latest.current.onError(cause instanceof CadEditorError ? cause : new CadEditorError('INPUT',
      cause instanceof Error ? cause.message : 'Cannot move this axis.',{field:'pole-axis-drag'},cause));
  }
  function stage(kind:Control['kind'],axis:PoleAxis,value:number,target:CadEditorEditTarget) {
    const raw = rawNumber(value);
    if (target === 'object') session.stageBodyTranslationField(fields[axis],raw);
    else if (kind === 'surface') session.stageSurfacePoleField(fields[axis],raw);
    else session.stageCurvePoleField(fields[axis],raw);
    return raw;
  }
  function release(g:Gesture) {
    try {if (g.element.hasPointerCapture(g.pointerId)) g.element.releasePointerCapture(g.pointerId);} catch {}
  }
  function finishGesture(g:Gesture) {
    gesture.current = null; setMovingAxis(null); latest.current.onGestureChange(false); release(g);
  }
  function isOwned(g:Gesture) {
    const state = session.getSnapshot();
    const pole = state.selection ?? state.curveSelection;
    const key = state.selection ? `surface:${state.selection.bodyId}:${state.selection.uIndex}:${state.selection.vIndex}`
      : state.curveSelection ? `curve:${state.curveSelection.bodyId}:${state.curveSelection.index}` : '';
    if (state.editTarget !== g.editTarget || state.disposed || state.candidate || state.selectionTransition || state.generation !== g.generation
      || state.displayGeneration !== g.displayGeneration || key !== g.control.key
      || !same(pole?.reference,g.control.reference) || !sameRaw(state.pending,g.raw)) return false;
    try {
      const now = latest.current, control = currentControl(state,now.documentReceipt,now.curveReceipt);
      const rect = now.canvas?.getBoundingClientRect();
      return !!control && control.key === g.control.key && same(control.reference,g.control.reference)
        && !!rect && rect.left === g.rect.left && rect.top === g.rect.top && rect.width === g.rect.width && rect.height === g.rect.height
        && control.receipt.width === g.control.receipt.width && control.receipt.height === g.control.receipt.height
        && JSON.stringify(control.receipt.state.camera) === g.cameraKey;
    } catch {return false;}
  }
  function cancel(restore:boolean) {
    const g = gesture.current; if (!g) return;
    const owned = restore && isOwned(g);
    finishGesture(g);
    if (owned) try {session.discardPending();} catch (cause) {failure(cause);}
  }
  function checkCurrent(g:Gesture) {
    if (!isOwned(g)) throw new CadEditorError('STALE','The point or view changed. Review the pending values.',{field:'pole-axis-drag'});
  }
  useEffect(() => {
    const key = (event:KeyboardEvent) => {
      if (event.key === 'Escape' && gesture.current) {event.preventDefault();event.stopPropagation();cancel(true);}
    };
    window.addEventListener('keydown',key,true);
    return () => {window.removeEventListener('keydown',key,true); cancel(true);};
  },[session]);
  function begin(event:ReactPointerEvent<SVGCircleElement>,axis:PoleAxis) {
    if (!event.isPrimary || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();event.stopPropagation();
    if (!control || !canvas || stepError || busy) return;
    try {
      const before = session.getSnapshot(), now = latest.current;
      const selected = currentControl(before,now.documentReceipt,now.curveReceipt), bounds = canvas.getBoundingClientRect();
      if (!selected || selected.key !== control.key || before.candidate || before.selectionTransition || Object.keys(before.pending).length)
        throw new CadEditorError('STALE','Select the current point, then move its axis.',{field:'pole-axis-drag'});
      const projection = projectPoleAxis(selected.point,selected.receipt.state.camera,selected.receipt.state.mmToSceneUnit,
        bounds.width,bounds.height,selected.receipt.width,selected.receipt.height,axis);
      if (!projection) return;
      event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.focus({preventScroll:true});
      gesture.current = {pointerId:event.pointerId,element:event.currentTarget,axis,editTarget:before.editTarget,control:structuredClone(selected),
        generation:before.generation,displayGeneration:before.displayGeneration,projection,startX:event.clientX-bounds.left,
        startY:event.clientY-bounds.top,rect:{left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height},
        cameraKey:JSON.stringify(selected.receipt.state.camera),step:snapEnabled ? parseMovementSnapStep(stepRaw) : null,moved:false,raw:{}};
      setMovingAxis(axis);latest.current.onGestureChange(true);
    } catch (cause) {failure(cause);}
  }
  function move(event:ReactPointerEvent<SVGCircleElement>) {
    const g = gesture.current; if (!g || event.pointerId !== g.pointerId) return;
    event.preventDefault();event.stopPropagation();
    try {
      checkCurrent(g);
      const x = event.clientX-g.rect.left, y = event.clientY-g.rect.top;
      if (!g.moved && Math.hypot(x-g.startX,y-g.startY) <= 3) return;
      const point = movePoleOnAxis(g.projection,g.axis,g.startX,g.startY,x,y,g.step);
      const value = g.editTarget === 'object' ? axisPointerDisplacement(g.projection,g.startX,g.startY,x,y,g.step) : point[g.axis];
      g.moved = true; g.raw[fields[g.axis]] = stage(g.control.kind,g.axis,value,g.editTarget);
    } catch (cause) {cancel(false);failure(cause);}
  }
  function end(event:ReactPointerEvent<SVGCircleElement>) {
    const g = gesture.current; if (!g || event.pointerId !== g.pointerId) return;
    event.preventDefault();event.stopPropagation();
    try {checkCurrent(g);finishGesture(g);if (g.moved) session.prepareApply();}
    catch (cause) {cancel(false);failure(cause);}
  }
  function keyboardMove(event:ReactKeyboardEvent<SVGCircleElement>,axis:PoleAxis) {
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
    if (!direction || event.repeat || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();event.stopPropagation();
    if (busy || stepError) return;
    try {
      const before = session.getSnapshot(), now = latest.current;
      const selected = currentControl(before,now.documentReceipt,now.curveReceipt);
      if (!selected || !control || selected.key !== control.key || before.candidate || before.selectionTransition || Object.keys(before.pending).length) return;
      const delta = (snapEnabled ? parseMovementSnapStep(stepRaw) : 1)*direction;
      stage(selected.kind,axis,before.editTarget === 'object' ? delta : selected.point[axis]+delta,before.editTarget);session.prepareApply();
    } catch (cause) {failure(cause);}
  }
  if (!control || !canvas || !rect || rect.width <= 0 || rect.height <= 0 || control.receipt.width <= 0 || control.receipt.height <= 0) return null;
  const visible = projections.filter(Boolean).length;
  return <div className="cad-editor-axis-controls" data-testid="pole-axis-overlay">
    <div className={'cad-editor-native-tools'+(snapshot.view.kind==='curve-focus'?' focused':'')} role="toolbar" aria-label="Modeling tools">
      {tools.map(tool=><Button key={tool.target} type="button" variant="ghost" size="icon-sm" data-testid={'native-tool-'+tool.target}
        aria-label={tool.name+' ('+tool.key.toUpperCase()+')'} title={tool.name+' ('+tool.key.toUpperCase()+')'}
        aria-keyshortcuts={tool.key.toUpperCase()} aria-pressed={snapshot.editTarget===tool.target}
        disabled={busy||!available(snapshot,tool.target)} onClick={()=>chooseTool(tool.target)}>
        <tool.icon size={16} aria-hidden="true"/><kbd aria-hidden="true">{tool.key.toUpperCase()}</kbd>
      </Button>)}
    </div>
    <svg className="cad-editor-axis-svg" width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`} aria-label="Selected control point axes">
      {projections.map((p,axisIndex) => {
        if (!p) return null;
        const axis = axisIndex as PoleAxis, x = p.xCss+p.dirX*64, y = p.yCss+p.dirY*64;
        const disabled = stepError !== null || (busy && movingAxis !== axis);
        return <g key={axis} className={'pole-axis pole-axis-'+names[axis].toLowerCase()+(pending?' pending':'')+(disabled?' disabled':'')}>
          <line x1={p.xCss} y1={p.yCss} x2={x} y2={y}/>
          <polygon points={`${x},${y} ${x-p.dirX*12-p.dirY*5},${y-p.dirY*12+p.dirX*5} ${x-p.dirX*12+p.dirY*5},${y-p.dirY*12-p.dirX*5}`}/>
          <circle cx={x} cy={y} r={9} role="button" tabIndex={0} aria-label={'Move '+names[axis]}
            aria-disabled={disabled} data-testid={'pole-axis-'+names[axis].toLowerCase()}
            onPointerDown={event=>begin(event,axis)} onPointerMove={move} onPointerUp={end}
            onPointerCancel={event=>{if (gesture.current?.pointerId === event.pointerId) cancel(true);}}
            onLostPointerCapture={event=>{if (gesture.current?.pointerId === event.pointerId) cancel(true);}}
            onKeyDown={event=>keyboardMove(event,axis)}/>
          <text x={x+p.dirX*16} y={y+p.dirY*16} textAnchor="middle" dominantBaseline="central">{names[axis]}</text>
        </g>;
      })}
    </svg>
    {rotationMode&&<ObjectRotationGizmo session={session} control={control} canvas={canvas} snapStep={angularSnap?angularStep:null}
      disabled={(busy&&!rotationMoving)||angularError!==null} onError={failure}
      onGestureChange={active=>{transformGesture.current=active;setRotationMoving(active);latest.current.onGestureChange(active);}}/>}
    {scaleMode&&<ObjectScaleGizmo session={session} control={control} canvas={canvas} snapStep={scaleSnap?scaleStep:null}
      disabled={(busy&&!scaleMoving)||scaleError!==null} onError={failure}
      onGestureChange={active=>{transformGesture.current=active;setScaleMoving(active);latest.current.onGestureChange(active);}}/>}
    <div className="cad-editor-axis-palette" aria-label={scaleMode?'Scale settings':rotationMode?'Rotation settings':'Movement settings'}>
      <div className="pole-move-title">{scaleMode?'Scale object':rotationMode?'Rotate object':objectMode?'Move object':'Move control point'} <span>{scaleMode?'XYZ · ×':rotationMode?'XYZ · deg':'XYZ · mm'}</span></div>
      <div className="context-mode-controls" hidden={!scaleMode}>
        <div className="context-axis-row"><span>Axes</span><div className="context-axis-buttons" role="group" aria-label="Scale axes" data-testid="scale-axis">
          {(['uniform','x','y','z'] as const).map(axis=><Button key={axis} type="button" variant="ghost" size="xs" data-testid={'scale-axis-'+axis}
            aria-label={axis==='uniform'?'Scale all axes':'Scale '+axis.toUpperCase()+' axis'} aria-pressed={snapshot.scaleAxis===axis}
            disabled={busy||!scaleMode} onClick={()=>chooseAxis('scale',axis)}>{axis==='uniform'?'All':axis.toUpperCase()}</Button>)}
        </div></div>
        <label className="pole-snap-toggle"><input type="checkbox" data-testid="scale-snap-enabled" checked={scaleSnap} disabled={busy||!scaleMode}
          onChange={event=>changeSnap('scale',event.target.checked)}/>Snap factor</label>
        <label className="pole-snap-distance" hidden={!scaleSnap}>Step (×)<input type="text" inputMode="decimal" maxLength={128} data-testid="scale-snap-step" value={scaleStepRaw} disabled={!scaleSnap||busy||!scaleMode}
          aria-invalid={scaleError!==null} aria-describedby={scaleError?scaleErrorId:undefined} onChange={event=>changeStep('scale',event.target.value)}/></label>
        {scaleError&&<p id={scaleErrorId} data-testid="scale-snap-error" role="alert">{scaleError}</p>}
        {(scaleMoving||pending)&&<p role="status">{scaleMoving?'Release to apply · Escape cancels':'Factor pending'}</p>}
      </div>
      <div className="context-mode-controls" hidden={!rotationMode}>
        <div className="context-axis-row"><span>Axis</span><div className="context-axis-buttons" role="group" aria-label="Rotation axis" data-testid="rotation-axis">
          {(['x','y','z'] as const).map(axis=><Button key={axis} type="button" variant="ghost" size="xs" data-testid={'rotation-axis-'+axis}
            aria-label={'Rotate around '+axis.toUpperCase()} aria-pressed={snapshot.rotationAxis===axis}
            disabled={busy||!rotationMode} onClick={()=>chooseAxis('rotation',axis)}>{axis.toUpperCase()}</Button>)}
        </div></div>
        <label className="pole-snap-toggle"><input type="checkbox" data-testid="rotation-snap-enabled" checked={angularSnap} disabled={busy||!rotationMode}
          onChange={event=>changeSnap('rotation',event.target.checked)}/>Snap angle</label>
        <label className="pole-snap-distance" hidden={!angularSnap}>Step (deg)<input type="text" inputMode="decimal" maxLength={128} data-testid="rotation-snap-step" value={angularStepRaw} disabled={!angularSnap||busy||!rotationMode}
          aria-invalid={angularError!==null} aria-describedby={angularError?angularErrorId:undefined} onChange={event=>changeStep('rotation',event.target.value)}/></label>
        {angularError&&<p id={angularErrorId} data-testid="rotation-snap-error" role="alert">{angularError}</p>}
        {(rotationMoving||pending)&&<p role="status">{rotationMoving?'Release to apply · Escape cancels':'Angle pending'}</p>}
      </div>
      <div className="context-mode-controls" hidden={rotationMode||scaleMode}>
        <label className="pole-snap-toggle"><input type="checkbox" data-testid="pole-snap-enabled" checked={snapEnabled} disabled={busy||rotationMode||scaleMode}
          onChange={event=>changeSnap('movement',event.target.checked)}/>Snap movement</label>
        <label className="pole-snap-distance" hidden={!snapEnabled}>Step (mm)<input type="text" inputMode="decimal" maxLength={128} value={stepRaw}
          data-testid="pole-snap-step" disabled={!snapEnabled||busy||rotationMode||scaleMode} aria-invalid={stepError!==null} aria-describedby={stepError?snapErrorId:undefined}
          onChange={event=>changeStep('movement',event.target.value)}/></label>
        {stepError&&<p id={snapErrorId} data-testid="pole-snap-error" role="alert">{stepError}</p>}
        {(movingAxis!==null||pending||visible<3)&&<p role="status" data-testid="pole-axis-status">{movingAxis!==null?'Release to apply · Escape cancels'
          :pending?'Values pending':visible===0?'Fit the selected point or use its fields.':'Use Isometric to reach other axes.'}</p>}
      </div>
    </div>
  </div>;
}
