import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { resolveCadGeometryReference, type CadGeometryReferenceV0 } from '@barocss/cad';
import { CadEditorError, type CadEditorSession, type CadEditorPoleField } from '../types.js';
import type { CadEditorCurvePresentationReceipt } from './types.js';
import { useCadEditorSnapshot } from './use-session.js';
import { projectCurvePole,moveCurvePoleInViewPlane,type CurvePolePlane,type PolePoint } from './curve-pole-projection.js';

interface Props {session:CadEditorSession;receipt:CadEditorCurvePresentationReceipt|null;canvas:HTMLCanvasElement|null;onError:(error:CadEditorError)=>void}
interface Gesture {
  pointerId:number;element:SVGCircleElement;bodyId:string;index:number;previousIndex:number;
  generation:number;displayGeneration:number;reference:CadGeometryReferenceV0;
  plane:CurvePolePlane;startX:number;startY:number;rect:{left:number;top:number;width:number;height:number};
  cameraKey:string;moved:boolean;dxCss:number;dyCss:number;raw:Partial<Record<CadEditorPoleField,string>>;
}
const fields=['xMM','yMM','zMM'] as const;
const rawNumber=(value:number)=>Object.is(value,-0)?'-0':String(value);
function sameRaw(a:Partial<Record<CadEditorPoleField,string>>,b:Partial<Record<CadEditorPoleField,string>>){return Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>a[key as CadEditorPoleField]===b[key as CadEditorPoleField]);}

/** Original coefficient handles; the sampled Curve stays accepted until PointerUp's real candidate. */
export function CurvePoleHandles({session,receipt,canvas,onError}:Props){
  const snapshot=useCadEditorSnapshot(session);
  const gesture=useRef<Gesture|null>(null),latest=useRef({receipt,canvas});latest.current={receipt,canvas};
  const [moving,setMoving]=useState(false);
  let points:PolePoint[]=[],planes:(CurvePolePlane|null)[]=[],width=0,height=0;
  const active=receipt!==null&&canvas!==null&&receipt.state.status==='ready'
    && snapshot.view.kind==='curve-focus'&&snapshot.view.bodyId===receipt.reference.bodyId
    && snapshot.curveSelection?.bodyId===receipt.reference.bodyId&&receipt.generation===snapshot.generation
    && receipt.displayGeneration===snapshot.displayGeneration&&!snapshot.disposed
    && snapshot.bodyCapabilities.some(body=>body.bodyId===receipt.reference.bodyId&&body.canEditCurvePole);
  if(active){
    try{
      const resolved=resolveCadGeometryReference(snapshot.accepted,receipt.reference);
      if(resolved.geometry.kind==='curve'&&resolved.source===receipt.preview.source){
        points=resolved.geometry.controlPoints.map(point=>[...point] as PolePoint);
        const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;
        const selected=snapshot.curveSelection!;
        if(snapshot.editTarget==='object'&&Object.keys(snapshot.pending).length){
          const offset=fields.map(field=>{const raw=snapshot.pending[field];return raw===undefined?0:/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim())?Number(raw):NaN;});
          if(offset.every(Number.isFinite))points=points.map(point=>point.map((value,axis)=>offset[axis]===0?value:value+offset[axis]) as PolePoint);
        }
        if(snapshot.editTarget==='pole'&&Object.keys(snapshot.pending).length&&selected.index<points.length){
          const p=points[selected.index].map((value,index)=>{
            const raw=snapshot.pending[fields[index]];return raw===undefined?value:raw.trim()===''?NaN:Number(raw);
          }) as PolePoint;
          if(p.every(Number.isFinite))points[selected.index]=p;
        }
        planes=points.map(point=>projectCurvePole(point,receipt.state.camera,receipt.state.mmToSceneUnit,width,height,receipt.width,receipt.height));
        const activeGesture=gesture.current;
        // Keep the captured SVG element alive when the pending point leaves the visible rectangle.
        if(activeGesture?.moved&&planes[activeGesture.index]===null)planes[activeGesture.index]={...activeGesture.plane,xCss:activeGesture.plane.xCss+activeGesture.dxCss,yCss:activeGesture.plane.yCss+activeGesture.dyCss};
      }
    }catch{points=[];planes=[];}
  }
  function failure(cause:unknown){onError(cause instanceof CadEditorError?cause:new CadEditorError('INPUT',cause instanceof Error?cause.message:'Cannot move this point.',{field:'curve-pole-drag'},cause));}
  function current(g:Gesture){
    const state=session.getSnapshot(),now=latest.current;
    const rect=now.canvas?.getBoundingClientRect();
    if(state.disposed||state.candidate||state.selectionTransition||state.generation!==g.generation
      ||state.displayGeneration!==g.displayGeneration||state.view.kind!=='curve-focus'||state.view.bodyId!==g.bodyId
      ||state.curveSelection?.bodyId!==g.bodyId||state.curveSelection.index!==g.index
      ||JSON.stringify(state.curveSelection.reference)!==JSON.stringify(g.reference)||!sameRaw(state.pending,g.raw)
      ||!now.receipt||JSON.stringify(now.receipt.state.camera)!==g.cameraKey||!rect
      ||rect.left!==g.rect.left||rect.top!==g.rect.top||rect.width!==g.rect.width||rect.height!==g.rect.height)
      throw new CadEditorError('STALE','The view or point changed. Review the pending values before moving again.',{field:'curve-pole-drag',bodyId:g.bodyId});
  }
  function release(g:Gesture){try{if(g.element.hasPointerCapture(g.pointerId))g.element.releasePointerCapture(g.pointerId);}catch{}}
  function cancel(restore:boolean){
    const g=gesture.current;if(!g)return;gesture.current=null;setMoving(false);release(g);
    if(!restore)return;
    const state=session.getSnapshot();
    if(!state.disposed&&!state.candidate&&!state.selectionTransition&&state.generation===g.generation
      &&state.displayGeneration===g.displayGeneration&&state.curveSelection?.bodyId===g.bodyId
      &&state.curveSelection.index===g.index&&sameRaw(state.pending,g.raw)){
      try{session.discardPending();if(g.previousIndex!==g.index)session.requestSelection({bodyId:g.bodyId,index:g.previousIndex});}catch(cause){failure(cause);}
    }
  }
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&gesture.current){event.preventDefault();event.stopPropagation();cancel(true);}};
    window.addEventListener('keydown',key,true);
    return()=>{window.removeEventListener('keydown',key,true);const g=gesture.current;if(g){gesture.current=null;release(g);const s=session.getSnapshot();if(!s.disposed&&!s.candidate&&!s.selectionTransition&&s.generation===g.generation&&s.displayGeneration===g.displayGeneration&&sameRaw(s.pending,g.raw)){try{session.discardPending();}catch{}}}};
  },[session]);
  function begin(event:ReactPointerEvent<SVGCircleElement>,index:number){
    if(snapshot.editTarget!=='pole'){
      const currentState=session.getSnapshot();if(currentState.candidate||currentState.selectionTransition||currentState.disposed)return;
      if(!event.isPrimary||event.button!==0||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!active)return;
      event.preventDefault();event.stopPropagation();
      try{session.requestSelection({bodyId:receipt!.reference.bodyId,index});event.currentTarget.focus({preventScroll:true});}catch(cause){failure(cause);}
      return;
    }
    if(snapshot.editTarget!=='pole'||!event.isPrimary||event.button!==0||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!active||!receipt||!canvas)return;
    event.preventDefault();event.stopPropagation();
    try{
      const before=session.getSnapshot();
      if(before.candidate||before.selectionTransition||Object.keys(before.pending).length)throw new CadEditorError('INPUT','Apply or discard your draft before dragging a point.',{field:'curve-pole-drag'});
      const resolved=resolveCadGeometryReference(before.accepted,receipt.reference);
      if(resolved.geometry.kind!=='curve')throw new CadEditorError('STALE','Select the current original Curve.',{field:'curve-pole-drag'});
      const rect=canvas.getBoundingClientRect(),plane=projectCurvePole([...resolved.geometry.controlPoints[index]] as PolePoint,receipt.state.camera,receipt.state.mmToSceneUnit,rect.width,rect.height,receipt.width,receipt.height);
      if(!plane)return;
      const previousIndex=before.curveSelection?.index??index;
      session.requestSelection({bodyId:receipt.reference.bodyId,index});
      const state=session.getSnapshot();
      if(state.curveSelection?.index!==index||state.candidate||state.selectionTransition)throw new CadEditorError('STALE','The selected point changed.',{field:'curve-pole-drag'});
      event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.focus({preventScroll:true});
      gesture.current={pointerId:event.pointerId,element:event.currentTarget,bodyId:receipt.reference.bodyId,index,previousIndex,generation:state.generation,displayGeneration:state.displayGeneration,reference:structuredClone(state.curveSelection.reference),plane,startX:event.clientX,startY:event.clientY,rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},cameraKey:JSON.stringify(receipt.state.camera),moved:false,dxCss:0,dyCss:0,raw:{}};
      setMoving(true);
    }catch(cause){failure(cause);}
  }
  function move(event:ReactPointerEvent<SVGCircleElement>){
    const g=gesture.current;if(!g||event.pointerId!==g.pointerId)return;event.preventDefault();event.stopPropagation();
    try{
      current(g);const dx=event.clientX-g.startX,dy=event.clientY-g.startY;
      if(!g.moved&&Math.hypot(dx,dy)<=3)return;
      const point=moveCurvePoleInViewPlane(g.plane,dx,dy);g.moved=true;g.dxCss=dx;g.dyCss=dy;
      for(let i=0;i<fields.length;i++){const text=rawNumber(point[i]);session.stageCurvePoleField(fields[i],text);g.raw[fields[i]]=text;}
    }catch(cause){cancel(false);failure(cause);}
  }
  function end(event:ReactPointerEvent<SVGCircleElement>){
    const g=gesture.current;if(!g||event.pointerId!==g.pointerId)return;event.preventDefault();event.stopPropagation();
    try{current(g);gesture.current=null;setMoving(false);release(g);if(g.moved)session.prepareApply();}
    catch(cause){cancel(false);failure(cause);}
  }
  if(!active||!points.length)return null;
  const selected=snapshot.curveSelection!.index,pending=Object.keys(snapshot.pending).length>0;
  return <div className="cad-editor-curve-controls" data-testid="curve-control-overlay">
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="cad-editor-curve-control-svg" aria-label="Original Curve control points">
      {planes.map((p,index)=>index>0&&p&&planes[index-1]?<line key={'line'+index} x1={planes[index-1]!.xCss} y1={planes[index-1]!.yCss} x2={p.xCss} y2={p.yCss} className={pending?'curve-control-line pending':'curve-control-line'}/>:null)}
      {planes.map((p,index)=>p?<circle key={index} cx={p.xCss} cy={p.yCss} r={index===selected?7:5} role="button" tabIndex={0} aria-label={'Curve point '+(index+1)} aria-pressed={index===selected} data-testid={'curve-pole-handle-'+index} className={'curve-control-point'+(index===selected?' selected':'')+(pending&&index===selected?' pending':'')}
        onPointerDown={event=>begin(event,index)} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>cancel(true)} onLostPointerCapture={()=>{if(gesture.current)cancel(true);}}
        onKeyDown={event=>{if((event.key==='Enter'||event.key===' ')&&!event.nativeEvent.isComposing){event.preventDefault();const state=session.getSnapshot();if(state.candidate||state.selectionTransition||state.disposed)return;try{session.requestSelection({bodyId:receipt.reference.bodyId,index});}catch(cause){failure(cause);}}}}/>:null)}
    </svg>
    {snapshot.editTarget!=='rotation'&&snapshot.editTarget!=='scale'&&<p className="cad-editor-curve-drag-hint" role="status" data-testid="curve-drag-status">{moving?'Release to apply. Escape cancels.':pending?'Point values pending. Apply or discard to continue.':snapshot.editTarget!=='pole'?'Select a grip, then use the object handle.':'Drag a point to move it in the view plane.'}</p>}
  </div>;
}
