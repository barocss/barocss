import {useEffect,useRef,type PointerEvent as ReactPointerEvent,type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {CadEditorError,type CadEditorSession,type CadEditorDraftField} from '../types.js';
import type {Control} from './pole-axis-gizmo.js';
import {prepareRotationProjection,rotationPointerAngle,unwrapRotationDelta,rotationMarkerPoint,type RotationProjection} from './rotation-projection.js';

interface Props {
  session:CadEditorSession;
  control:Control;
  canvas:HTMLCanvasElement;
  snapStep:number|null;
  disabled:boolean;
  onError:(error:CadEditorError)=>void;
  onGestureChange:(active:boolean)=>void;
}
interface Gesture {
  pointerId:number;element:SVGElement;control:Control;projection:RotationProjection;
  generation:number;displayGeneration:number;axis:'x'|'y'|'z';cameraKey:string;
  rect:{left:number;top:number;width:number;height:number};
  startX:number;startY:number;previousAngle:number;cumulative:number;step:number|null;moved:boolean;
  raw:Partial<Record<CadEditorDraftField,string>>;
}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const sameRaw=(a:Partial<Record<CadEditorDraftField,string>>,b:Partial<Record<CadEditorDraftField,string>>)=>
  Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>a[key as CadEditorDraftField]===b[key as CadEditorDraftField]);
const rawNumber=(number:number)=>Object.is(number,-0)?'-0':String(number);

/** A display ring stages an angle; actual native shape rotation stays behind the existing admission gate. */
export function ObjectRotationGizmo(props:Props) {
  const latest=useRef(props);latest.current=props;
  const gesture=useRef<Gesture|null>(null);
  const snapshot=props.session.getSnapshot(),rect=props.canvas.getBoundingClientRect();
  let projection:RotationProjection|null=null;
  try {projection=prepareRotationProjection(props.control.point,props.control.receipt.state.camera,
    props.control.receipt.state.mmToSceneUnit,rect.width,rect.height,props.control.receipt.width,props.control.receipt.height,snapshot.rotationAxis);} catch { /* A refused view has no rotation handle. */ }
  const g=gesture.current;
  if(!projection&&g&&sameRaw(snapshot.pending,g.raw)&&rect.width>0&&rect.height>0)projection=g.projection;
  function failure(cause:unknown) {
    latest.current.onError(cause instanceof CadEditorError?cause:new CadEditorError('INPUT',cause instanceof Error?cause.message:'Cannot rotate this object.',{field:'body-rotation-drag'},cause));
  }
  function owned(current:Gesture) {
    const now=latest.current,state=now.session.getSnapshot(),bounds=now.canvas.getBoundingClientRect();
    const selected=state.selection??state.curveSelection;
    const key=state.selection?`surface:${state.selection.bodyId}:${state.selection.uIndex}:${state.selection.vIndex}`
      :state.curveSelection?`curve:${state.curveSelection.bodyId}:${state.curveSelection.index}`:'';
    return !state.disposed&&!state.candidate&&!state.selectionTransition&&state.editTarget==='rotation'
      &&state.rotationAxis===current.axis&&state.generation===current.generation&&state.displayGeneration===current.displayGeneration
      &&key===current.control.key&&same(selected?.reference,current.control.reference)&&sameRaw(state.pending,current.raw)
      &&now.control.key===current.control.key&&same(now.control.reference,current.control.reference)&&same(now.control.point,current.control.point)
      &&now.control.receipt.state.status==='ready'&&JSON.stringify(now.control.receipt.state.camera)===current.cameraKey
      &&now.control.receipt.width===current.control.receipt.width&&now.control.receipt.height===current.control.receipt.height
      &&bounds.left===current.rect.left&&bounds.top===current.rect.top&&bounds.width===current.rect.width&&bounds.height===current.rect.height;
  }
  function finish(current:Gesture) {
    gesture.current=null;latest.current.onGestureChange(false);
    try{if(current.element.hasPointerCapture(current.pointerId))current.element.releasePointerCapture(current.pointerId);}catch{}
  }
  function cancel(restore:boolean) {
    const current=gesture.current;if(!current)return;
    const canRestore=restore&&owned(current);finish(current);
    if(canRestore)try{latest.current.session.discardPending();}catch(cause){failure(cause);}
  }
  function check(current:Gesture) {
    if(!owned(current))throw new CadEditorError('STALE','The object, axis or view changed. Review the pending angle.',{field:'body-rotation-drag'});
  }
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&gesture.current){event.preventDefault();event.stopPropagation();cancel(true);}};
    window.addEventListener('keydown',escape,true);
    return()=>{window.removeEventListener('keydown',escape,true);cancel(true);};
  },[props.session]);
  function begin(event:ReactPointerEvent<SVGElement>) {
    if(!event.isPrimary||event.button!==0||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
    event.preventDefault();event.stopPropagation();
    if(!projection||props.disabled||gesture.current)return;
    try {
      const state=props.session.getSnapshot();
      if(state.editTarget!=='rotation'||state.candidate||state.selectionTransition||state.disposed||Object.keys(state.pending).length)return;
      const bounds=props.canvas.getBoundingClientRect(),x=event.clientX-bounds.left,y=event.clientY-bounds.top;
      const angle=rotationPointerAngle(projection,x,y);
      event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.focus({preventScroll:true});
      gesture.current={pointerId:event.pointerId,element:event.currentTarget,control:structuredClone(props.control),projection,
        generation:state.generation,displayGeneration:state.displayGeneration,axis:state.rotationAxis,cameraKey:JSON.stringify(props.control.receipt.state.camera),
        rect:{left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height},startX:x,startY:y,previousAngle:angle,cumulative:0,
        step:props.snapStep,moved:false,raw:{}};
      latest.current.onGestureChange(true);
    }catch(cause){failure(cause);}
  }
  function move(event:ReactPointerEvent<SVGElement>) {
    const current=gesture.current;if(!current||event.pointerId!==current.pointerId)return;
    event.preventDefault();event.stopPropagation();
    try {
      check(current);
      const x=event.clientX-current.rect.left,y=event.clientY-current.rect.top;
      if(!current.moved&&Math.hypot(x-current.startX,y-current.startY)<=3)return;
      const angle=rotationPointerAngle(current.projection,x,y);
      const cumulative=current.cumulative+unwrapRotationDelta(angle,current.previousAngle);
      let degrees=cumulative*180/Math.PI;
      if(!Number.isFinite(degrees)||Math.abs(degrees)>360)throw new RangeError('Rotate by up to 360 degrees per action.');
      if(current.step!==null)degrees=Math.round(degrees/current.step)*current.step;
      if(!Number.isFinite(degrees)||Math.abs(degrees)>360)throw new RangeError('Rotate by up to 360 degrees per action.');
      const text=rawNumber(degrees);latest.current.session.stageBodyRotation(text);
      current.raw.angleDegrees=text;current.previousAngle=angle;current.cumulative=cumulative;current.moved=true;
    }catch(cause){cancel(false);failure(cause);}
  }
  function end(event:ReactPointerEvent<SVGElement>) {
    const current=gesture.current;if(!current||event.pointerId!==current.pointerId)return;
    event.preventDefault();event.stopPropagation();
    try{check(current);finish(current);if(current.moved)latest.current.session.prepareApply();}
    catch(cause){cancel(false);failure(cause);}
  }
  function keyboard(event:ReactKeyboardEvent<SVGElement>) {
    const direction=event.key==='ArrowRight'||event.key==='ArrowUp'?1:event.key==='ArrowLeft'||event.key==='ArrowDown'?-1:0;
    if(!direction||event.repeat||event.nativeEvent.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
    event.preventDefault();event.stopPropagation();
    if(props.disabled||gesture.current)return;
    try{
      const state=latest.current.session.getSnapshot();
      if(state.editTarget!=='rotation'||state.candidate||state.selectionTransition||Object.keys(state.pending).length)return;
      latest.current.session.stageBodyRotation(rawNumber((props.snapStep??1)*direction));latest.current.session.prepareApply();
    }catch(cause){failure(cause);}
  }
  if(!projection)return <p className="rotation-view-hint" data-testid="rotation-status">Change view or fit the selected grip.</p>;
  const pending=Object.keys(snapshot.pending).length>0;
  const rawAngle=snapshot.pending.angleDegrees??'0';
  const angle=Number(rawAngle);
  const displayAngle=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(rawAngle)&&Number.isFinite(angle)&&Math.abs(angle)<=360?angle:0;
  const marker=rotationMarkerPoint(projection,displayAngle*Math.PI/180);
  const handlers={onPointerDown:begin,onPointerMove:move,onPointerUp:end,
    onPointerCancel:(event:ReactPointerEvent<SVGElement>)=>{if(gesture.current?.pointerId===event.pointerId)cancel(true);},
    onLostPointerCapture:(event:ReactPointerEvent<SVGElement>)=>{if(gesture.current?.pointerId===event.pointerId)cancel(true);}};
  return <div className={'cad-editor-rotation-controls'+(pending?' pending':'')}>
    <svg width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`} className="cad-editor-rotation-svg" aria-label="Object rotation plane">
      <polyline points={projection.ring.map(point=>point.x+','+point.y).join(' ')} className="rotation-ring-line"/>
      <polyline points={projection.ring.map(point=>point.x+','+point.y).join(' ')} className="rotation-ring-hit" data-testid="object-rotation-ring" {...handlers}/>
      <line x1={projection.xCss} y1={projection.yCss} x2={marker.x} y2={marker.y} className="rotation-angle-line"/>
      <circle cx={marker.x} cy={marker.y} r={8} tabIndex={0} role="button" aria-label={'Rotate object around '+snapshot.rotationAxis.toUpperCase()}
        aria-disabled={props.disabled&&!gesture.current} className="rotation-ring-handle" data-testid="rotate-ring-handle" {...handlers} onKeyDown={keyboard}/>
    </svg>
    {(gesture.current||pending)&&<p className="rotation-view-hint" data-testid="rotation-status" role="status">{gesture.current?'Release to apply. Escape cancels.':'Angle pending. Apply or discard.'}</p>}
  </div>;
}
