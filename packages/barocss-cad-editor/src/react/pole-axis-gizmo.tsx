import {useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {resolveCadGeometryReference, type CadGeometryReferenceV0} from '@barocss/cad';
import {CadEditorError, type CadEditorSession, type CadEditorSnapshot, type CadEditorPoleField} from '../types.js';
import type {CadEditorDisplayReceipt, CadEditorCurveFocusReceipt} from './types.js';
import {useCadEditorSnapshot} from './use-session.js';
import type {PolePoint} from './curve-pole-projection.js';
import {projectPoleAxis, movePoleOnAxis, parseMovementSnapStep, type PoleAxis, type PoleAxisProjection} from './pole-axis-projection.js';

interface Props {
  session: CadEditorSession;
  documentReceipt: CadEditorDisplayReceipt | null;
  curveReceipt: CadEditorCurveFocusReceipt | null;
  canvas: HTMLCanvasElement | null;
  onError: (error: CadEditorError) => void;
  onGestureChange: (active: boolean) => void;
}
interface Control {
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
const rawNumber = (value:number) => Object.is(value,-0) ? '-0' : String(value);
const same = (a:unknown,b:unknown) => JSON.stringify(a) === JSON.stringify(b);
function sameRaw(a:Partial<Record<CadEditorPoleField,string>>,b:Partial<Record<CadEditorPoleField,string>>) {
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => a[key as CadEditorPoleField] === b[key as CadEditorPoleField]);
}

function currentControl(snapshot:CadEditorSnapshot, documentReceipt:CadEditorDisplayReceipt|null, curveReceipt:CadEditorCurveFocusReceipt|null):Control|null {
  if (snapshot.disposed) return null;
  const surface = snapshot.selection, curve = snapshot.curveSelection;
  const capability = snapshot.bodyCapabilities.find(body => body.bodyId === snapshot.selectedBodyId);
  if (snapshot.view.kind === 'document' && surface && capability?.canEditSurfacePole
    && documentReceipt?.state.status === 'ready' && snapshot.displayBodyIds.includes(surface.bodyId)
    && documentReceipt.state.documentBodies.some(body => body.binding.bodyId === surface.bodyId && body.ref.kind === 'surface')
    && same(documentReceipt.state.document,snapshot.accepted)) {
    const resolved = resolveCadGeometryReference(snapshot.accepted,surface.reference);
    if (resolved.geometry.kind === 'surface') return {point:[...resolved.geometry.controlPoints[surface.uIndex][surface.vIndex]],
      key:`surface:${surface.bodyId}:${surface.uIndex}:${surface.vIndex}`,reference:surface.reference,kind:'surface',receipt:documentReceipt};
  }
  if (snapshot.view.kind === 'curve-focus' && curve && capability?.canEditCurvePole
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
  const latest = useRef(props); latest.current = props;
  const gesture = useRef<Gesture|null>(null);
  const [movingAxis,setMovingAxis] = useState<PoleAxis|null>(null);
  const [snapEnabled,setSnapEnabled] = useState(false);
  const [stepRaw,setStepRaw] = useState('1');
  let step:number|null = null, stepError:string|null = null;
  if (snapEnabled) {
    try {step = parseMovementSnapStep(stepRaw);}
    catch {stepError = 'Enter a snap distance from 0.000001 to 1000000 mm.';}
  }
  let control:Control|null = null;
  try {control = currentControl(snapshot,props.documentReceipt,props.curveReceipt);} catch { /* Unavailable bindings have no handles. */ }
  const canvas = props.canvas, rect = canvas?.getBoundingClientRect();
  const pending = Object.keys(snapshot.pending).length > 0;
  const busy = snapshot.candidate !== null || snapshot.selectionTransition !== null || snapshot.disposed || pending || movingAxis !== null;
  const projections:(PoleAxisProjection|null)[] = [];
  if (control && rect && rect.width > 0 && rect.height > 0 && control.receipt.width > 0 && control.receipt.height > 0) {
    const ghost = control.point.map((value,index) => {
      const raw = snapshot.pending[fields[index]];
      return raw === undefined ? value : /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim()) ? Number(raw) : NaN;
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
  function stage(kind:Control['kind'],axis:PoleAxis,value:number) {
    const raw = rawNumber(value);
    if (kind === 'surface') session.stageSurfacePoleField(fields[axis],raw);
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
    if (state.disposed || state.candidate || state.selectionTransition || state.generation !== g.generation
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
      gesture.current = {pointerId:event.pointerId,element:event.currentTarget,axis,control:structuredClone(selected),
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
      g.moved = true; g.raw[fields[g.axis]] = stage(g.control.kind,g.axis,point[g.axis]);
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
      stage(selected.kind,axis,selected.point[axis]+delta);session.prepareApply();
    } catch (cause) {failure(cause);}
  }
  if (!control || !canvas || !rect || rect.width <= 0 || rect.height <= 0 || control.receipt.width <= 0 || control.receipt.height <= 0) return null;
  const visible = projections.filter(Boolean).length;
  return <div className="cad-editor-axis-controls" data-testid="pole-axis-overlay">
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
    <div className="cad-editor-axis-palette" aria-label="Control point movement">
      <div className="pole-move-title">Move control point <span>XYZ · mm</span></div>
      <label className="pole-snap-toggle"><input type="checkbox" data-testid="pole-snap-enabled" checked={snapEnabled} disabled={busy}
        onChange={event=>setSnapEnabled(event.target.checked)}/>Snap movement</label>
      <label className="pole-snap-distance">Step (mm)<input type="text" inputMode="decimal" maxLength={128} value={stepRaw}
        data-testid="pole-snap-step" disabled={!snapEnabled || busy} aria-invalid={stepError !== null} aria-describedby={stepError?snapErrorId:undefined}
        onChange={event=>setStepRaw(event.target.value)}/></label>
      {stepError && <p id={snapErrorId} data-testid="pole-snap-error" role="alert">{stepError}</p>}
      <p role="status" data-testid="pole-axis-status">{movingAxis !== null ? `Moving ${names[movingAxis]} · Release to apply. Escape cancels.`
        : pending ? 'Values pending. Apply or discard to continue.'
        : visible === 0 ? 'Fit the selected point or edit its coordinates.'
        : visible < 3 ? 'Drag an axis. Use Isometric to reach other axes.' : 'Drag an axis. Arrow keys move one step.'}</p>
    </div>
  </div>;
}
