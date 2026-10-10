import {useEffect,useRef,type PointerEvent as ReactPointerEvent,type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {CadEditorError,type CadEditorSession,type CadEditorDraftField,type CadEditorScaleAxis} from '../types.js';
import type {Control} from './pole-axis-gizmo.js';
import {prepareScaleProjection,scalePointerFactor,scaleMarkerPoint,type ScaleProjection} from './scale-projection.js';

interface Props {
  session:CadEditorSession;control:Control;canvas:HTMLCanvasElement;snapStep:number|null;disabled:boolean;
  onError:(error:CadEditorError)=>void;onGestureChange:(active:boolean)=>void;
}
interface Gesture {
  pointerId:number;element:SVGRectElement;control:Control;projection:ScaleProjection;
  generation:number;displayGeneration:number;axis:CadEditorScaleAxis;cameraKey:string;
  rect:{left:number;top:number;width:number;height:number};startX:number;startY:number;
  step:number|null;moved:boolean;raw:Partial<Record<CadEditorDraftField,string>>;
}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const sameRaw=(a:Partial<Record<CadEditorDraftField,string>>,b:Partial<Record<CadEditorDraftField,string>>)=>
  Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>a[key as CadEditorDraftField]===b[key as CadEditorDraftField]);

export function ObjectScaleGizmo(props:Props) {
  const latest=useRef(props);latest.current=props;
  const gesture=useRef<Gesture|null>(null);
  const snapshot=props.session.getSnapshot(),bounds=props.canvas.getBoundingClientRect();
  let projection:ScaleProjection|null=null;
  try{projection=prepareScaleProjection(props.control.point,props.control.receipt.state.camera,props.control.receipt.state.mmToSceneUnit,
    bounds.width,bounds.height,props.control.receipt.width,props.control.receipt.height,snapshot.scaleAxis);}catch{}
  const captured=gesture.current;
  if(!projection&&captured&&sameRaw(snapshot.pending,captured.raw)&&bounds.width>0&&bounds.height>0)projection=captured.projection;
  function failure(cause:unknown){latest.current.onError(cause instanceof CadEditorError?cause:
    new CadEditorError('INPUT',cause instanceof Error?cause.message:'Cannot scale this object.',{field:'body-scale-drag'},cause));}
  function owned(current:Gesture){
    const now=latest.current,state=now.session.getSnapshot(),rect=now.canvas.getBoundingClientRect();
    const selected=state.selection??state.curveSelection;
    const key=state.selection?`surface:${state.selection.bodyId}:${state.selection.uIndex}:${state.selection.vIndex}`
      :state.curveSelection?`curve:${state.curveSelection.bodyId}:${state.curveSelection.index}`:'';
    return!state.disposed&&!state.candidate&&!state.selectionTransition&&state.editTarget==='scale'&&state.scaleAxis===current.axis
      &&state.generation===current.generation&&state.displayGeneration===current.displayGeneration
      &&key===current.control.key&&same(selected?.reference,current.control.reference)&&sameRaw(state.pending,current.raw)
      &&now.control.key===current.control.key&&same(now.control.reference,current.control.reference)&&same(now.control.point,current.control.point)
      &&now.control.receipt.state.status==='ready'&&JSON.stringify(now.control.receipt.state.camera)===current.cameraKey
      &&now.control.receipt.width===current.control.receipt.width&&now.control.receipt.height===current.control.receipt.height
      &&rect.left===current.rect.left&&rect.top===current.rect.top&&rect.width===current.rect.width&&rect.height===current.rect.height;
  }
  function finish(current:Gesture){gesture.current=null;latest.current.onGestureChange(false);
    try{if(current.element.hasPointerCapture(current.pointerId))current.element.releasePointerCapture(current.pointerId);}catch{}}
  function cancel(restore:boolean){const current=gesture.current;if(!current)return;
    const restoreRaw=restore&&owned(current);finish(current);if(restoreRaw)try{latest.current.session.discardPending();}catch(cause){failure(cause);}}
  function check(current:Gesture){if(!owned(current))throw new CadEditorError('STALE','The object, axes or view changed. Review the pending factor.',{field:'body-scale-drag'});}
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&gesture.current){event.preventDefault();event.stopPropagation();cancel(true);}};
    window.addEventListener('keydown',escape,true);return()=>{window.removeEventListener('keydown',escape,true);cancel(true);};
  },[props.session]);
  function begin(event:ReactPointerEvent<SVGRectElement>){
    if(!event.isPrimary||event.button!==0||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
    event.preventDefault();event.stopPropagation();if(!projection||props.disabled||gesture.current)return;
    try{
      const state=props.session.getSnapshot();if(state.editTarget!=='scale'||state.candidate||state.selectionTransition||state.disposed||Object.keys(state.pending).length)return;
      const rect=props.canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
      scalePointerFactor(projection,x,y,x,y,null);
      event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.focus({preventScroll:true});
      gesture.current={pointerId:event.pointerId,element:event.currentTarget,control:structuredClone(props.control),projection,
        generation:state.generation,displayGeneration:state.displayGeneration,axis:state.scaleAxis,cameraKey:JSON.stringify(props.control.receipt.state.camera),
        rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},startX:x,startY:y,step:props.snapStep,moved:false,raw:{}};
      latest.current.onGestureChange(true);
    }catch(cause){failure(cause);}
  }
  function move(event:ReactPointerEvent<SVGRectElement>){
    const current=gesture.current;if(!current||event.pointerId!==current.pointerId)return;
    event.preventDefault();event.stopPropagation();
    try{
      check(current);const x=event.clientX-current.rect.left,y=event.clientY-current.rect.top;
      if(!current.moved&&Math.hypot(x-current.startX,y-current.startY)<=3)return;
      const factor=scalePointerFactor(current.projection,current.startX,current.startY,x,y,current.step);
      const raw=String(factor);latest.current.session.stageBodyScale(raw);current.raw.scaleFactor=raw;current.moved=true;
    }catch(cause){cancel(false);failure(cause);}
  }
  function end(event:ReactPointerEvent<SVGRectElement>){
    if(gesture.current?.pointerId!==event.pointerId)return;move(event);
    const current=gesture.current;if(!current)return;
    event.preventDefault();event.stopPropagation();
    try{check(current);finish(current);if(current.moved)latest.current.session.prepareApply();}catch(cause){cancel(false);failure(cause);}
  }
  function keyboard(event:ReactKeyboardEvent<SVGRectElement>){
    const direction=event.key==='ArrowRight'||event.key==='ArrowUp'?1:event.key==='ArrowLeft'||event.key==='ArrowDown'?-1:0;
    if(!direction||event.repeat||event.nativeEvent.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
    event.preventDefault();event.stopPropagation();if(props.disabled||gesture.current)return;
    try{const state=latest.current.session.getSnapshot();if(state.editTarget!=='scale'||state.candidate||state.selectionTransition||Object.keys(state.pending).length)return;
      const factor=1+(props.snapStep??.1)*direction;if(factor<.001||factor>100)throw new RangeError('Enter a scale factor from 0.001 to 100.');
      latest.current.session.stageBodyScale(String(factor));latest.current.session.prepareApply();}catch(cause){failure(cause);}
  }
  if(!projection)return<p className="rotation-view-hint" data-testid="scale-status">Change the view or fit the selected grip to reach these scale axes.</p>;
  const pending=Object.keys(snapshot.pending).length>0,raw=(snapshot.pending.scaleFactor??'1').trim(),value=Number(raw);
  const factor=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw)&&Number.isFinite(value)&&value>=.001&&value<=100?value:1;
  let marker:{x:number;y:number}|null=null;try{marker=scaleMarkerPoint(projection,factor);}catch{}
  const point=marker??{x:projection.handleX,y:projection.handleY};
  return<div className={'cad-editor-scale-controls'+(pending?' pending':'')}>
    <svg width={bounds.width} height={bounds.height} viewBox={`0 0 ${bounds.width} ${bounds.height}`} className="cad-editor-scale-svg" aria-label="Object scale axes">
      {marker&&<line x1={projection.xCss} y1={projection.yCss} x2={point.x} y2={point.y} className="scale-axis-line"/>}
      <circle cx={projection.xCss} cy={projection.yCss} r={4} className="scale-pivot"/>
      <rect x={point.x-8} y={point.y-8} width={16} height={16} rx={2} tabIndex={0} role="button" aria-label={'Scale '+(snapshot.scaleAxis==='uniform'?'all axes':snapshot.scaleAxis.toUpperCase())}
        aria-disabled={props.disabled&&!gesture.current} visibility={marker?'visible':'hidden'} className="scale-axis-handle" data-testid="object-scale-handle"
        onPointerDown={begin} onPointerMove={move} onPointerUp={end} onKeyDown={keyboard}
        onPointerCancel={event=>{if(gesture.current?.pointerId===event.pointerId)cancel(true);}}
        onLostPointerCapture={event=>{if(gesture.current?.pointerId===event.pointerId)cancel(true);}}/>
      {marker&&<text x={point.x+projection.dirX*20} y={point.y+projection.dirY*20} textAnchor="middle" dominantBaseline="central" className="scale-axis-label">{snapshot.scaleAxis==='uniform'?'All':snapshot.scaleAxis.toUpperCase()}</text>}
    </svg>
    <p className="rotation-view-hint" data-testid="scale-status" role="status">{gesture.current?'Release to apply. Escape cancels.':pending?'Factor pending. Apply or discard to continue.':'Drag the square. Arrow keys scale one step.'}</p>
  </div>;
}
