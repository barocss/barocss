import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { resolveCadGeometryReference, type CadGeometryReferenceV0 } from '@barocss/cad';
import { CadEditorError, type CadEditorSession, type CadEditorPoleField } from '../types.js';
import type { CadEditorDisplayReceipt } from './types.js';
import { useCadEditorSnapshot } from './use-session.js';
import { projectCurvePole,moveCurvePoleInViewPlane,type CurvePolePlane,type PolePoint } from './curve-pole-projection.js';

interface Props {session:CadEditorSession;receipt:CadEditorDisplayReceipt|null;canvas:HTMLCanvasElement|null;onError:(error:CadEditorError)=>void}
interface Gesture {
  pointerId:number;element:SVGCircleElement;bodyId:string;index:number;vCount:number;previousU:number;previousV:number;
  generation:number;displayGeneration:number;reference:CadGeometryReferenceV0;
  plane:CurvePolePlane;startX:number;startY:number;rect:{left:number;top:number;width:number;height:number};
  cameraKey:string;moved:boolean;dxCss:number;dyCss:number;raw:Partial<Record<CadEditorPoleField,string>>;
}
const fields=['xMM','yMM','zMM'] as const;
const rawNumber=(value:number)=>Object.is(value,-0)?'-0':String(value);
function sameRaw(a:Partial<Record<CadEditorPoleField,string>>,b:Partial<Record<CadEditorPoleField,string>>){return Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>a[key as CadEditorPoleField]===b[key as CadEditorPoleField]);}

/** Original coefficient handles; the sampled Surface stays accepted until PointerUp's real candidate. */
export function SurfacePoleHandles({session,receipt,canvas,onError}:Props){
  const snapshot=useCadEditorSnapshot(session);
  const gesture=useRef<Gesture|null>(null),latest=useRef({receipt,canvas});latest.current={receipt,canvas};
  const [moving,setMoving]=useState(false);
  let points:PolePoint[]=[],planes:(CurvePolePlane|null)[]=[],width=0,height=0;
  const selectedPole=snapshot.selection;
  const binding=receipt?.state.documentBodies.find(body=>body.binding.bodyId===selectedPole?.bodyId);
  const active=receipt!==null&&canvas!==null&&receipt.state.status==='ready'
    &&snapshot.view.kind==='document'&&selectedPole!==null&&!snapshot.disposed
    &&snapshot.displayBodyIds.includes(selectedPole.bodyId)&&binding?.ref.kind==='surface'
    &&binding.binding.documentId===selectedPole.reference.documentId
    &&binding.binding.documentRevision===selectedPole.reference.documentRevision
    &&JSON.stringify(receipt.state.document)===JSON.stringify(snapshot.accepted)
    &&snapshot.bodyCapabilities.some(body=>body.bodyId===selectedPole.bodyId&&body.canEditSurfacePole);
  let vCount=0;
  if(active){
    try{
      const resolved=resolveCadGeometryReference(snapshot.accepted,selectedPole.reference);
      if(resolved.geometry.kind==='surface'){
        vCount=selectedPole.countV;
        points=resolved.geometry.controlPoints.flatMap(row=>row.map(point=>[...point] as PolePoint));
        const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;
        const index=selectedPole.uIndex*vCount+selectedPole.vIndex;
        if(snapshot.editTarget==='object'&&Object.keys(snapshot.pending).length){
          const offset=fields.map(field=>{const raw=snapshot.pending[field];return raw===undefined?0:/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim())?Number(raw):NaN;});
          if(offset.every(Number.isFinite))points=points.map(point=>point.map((value,axis)=>offset[axis]===0?value:value+offset[axis]) as PolePoint);
        }
        if(snapshot.editTarget==='pole'&&Object.keys(snapshot.pending).length&&index<points.length){
          const point=points[index].map((value,axis)=>{
            const raw=snapshot.pending[fields[axis]];return raw===undefined?value:raw.trim()===''?NaN:Number(raw);
          }) as PolePoint;
          if(point.every(Number.isFinite))points[index]=point;
        }
        planes=points.map(point=>projectCurvePole(point,receipt.state.camera,receipt.state.mmToSceneUnit,width,height,receipt.width,receipt.height));
        const g=gesture.current;
        if(g?.moved&&planes[g.index]===null)planes[g.index]={...g.plane,xCss:g.plane.xCss+g.dxCss,yCss:g.plane.yCss+g.dyCss};
      }
    }catch{points=[];planes=[];}
  }
  function failure(cause:unknown){onError(cause instanceof CadEditorError?cause:new CadEditorError('INPUT',cause instanceof Error?cause.message:'Cannot move this point.',{field:'surface-pole-drag'},cause));}
  function current(g:Gesture){
    const state=session.getSnapshot(),now=latest.current;
    const rect=now.canvas?.getBoundingClientRect();
    if(state.disposed||state.candidate||state.selectionTransition||state.generation!==g.generation
      ||state.displayGeneration!==g.displayGeneration||state.view.kind!=='document'
      ||state.selection?.bodyId!==g.bodyId||state.selection.uIndex!==Math.floor(g.index/g.vCount)||state.selection.vIndex!==g.index%g.vCount
      ||JSON.stringify(state.selection.reference)!==JSON.stringify(g.reference)||!sameRaw(state.pending,g.raw)
      ||!now.receipt||JSON.stringify(now.receipt.state.document)!==JSON.stringify(state.accepted)||JSON.stringify(now.receipt.state.camera)!==g.cameraKey||!rect
      ||rect.left!==g.rect.left||rect.top!==g.rect.top||rect.width!==g.rect.width||rect.height!==g.rect.height)
      throw new CadEditorError('STALE','The view or point changed. Review the pending values before moving again.',{field:'surface-pole-drag',bodyId:g.bodyId});
  }
  function release(g:Gesture){try{if(g.element.hasPointerCapture(g.pointerId))g.element.releasePointerCapture(g.pointerId);}catch{}}
  function cancel(restore:boolean){
    const g=gesture.current;if(!g)return;gesture.current=null;setMoving(false);release(g);
    if(!restore)return;
    const state=session.getSnapshot();
    if(!state.disposed&&!state.candidate&&!state.selectionTransition&&state.generation===g.generation
      &&state.displayGeneration===g.displayGeneration&&state.selection?.bodyId===g.bodyId
      &&state.selection.uIndex===Math.floor(g.index/g.vCount)&&state.selection.vIndex===g.index%g.vCount&&sameRaw(state.pending,g.raw)){
      try{session.discardPending();session.requestSelection({bodyId:g.bodyId,uIndex:g.previousU,vIndex:g.previousV});}catch(cause){failure(cause);}
    }
  }
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&gesture.current){event.preventDefault();event.stopPropagation();cancel(true);}};
    window.addEventListener('keydown',key,true);
    return()=>{window.removeEventListener('keydown',key,true);const g=gesture.current;if(g){gesture.current=null;release(g);const s=session.getSnapshot();if(!s.disposed&&!s.candidate&&!s.selectionTransition&&s.generation===g.generation&&s.displayGeneration===g.displayGeneration&&s.selection?.bodyId===g.bodyId&&s.selection.uIndex===Math.floor(g.index/g.vCount)&&s.selection.vIndex===g.index%g.vCount&&sameRaw(s.pending,g.raw)){try{session.discardPending();session.requestSelection({bodyId:g.bodyId,uIndex:g.previousU,vIndex:g.previousV});}catch{}}}};
  },[session]);
  function begin(event:ReactPointerEvent<SVGCircleElement>,index:number){
    if(snapshot.editTarget!=='pole'){
      const currentState=session.getSnapshot();if(currentState.candidate||currentState.selectionTransition||currentState.disposed)return;
      if(!event.isPrimary||event.button!==0||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!active)return;
      event.preventDefault();event.stopPropagation();
      try{session.requestSelection({bodyId:selectedPole!.bodyId,uIndex:Math.floor(index/vCount),vIndex:index%vCount});event.currentTarget.focus({preventScroll:true});}catch(cause){failure(cause);}
      return;
    }
    if(snapshot.editTarget!=='pole'||!event.isPrimary||event.button!==0||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!active||!receipt||!canvas)return;
    event.preventDefault();event.stopPropagation();
    try{
      const before=session.getSnapshot();
      if(before.candidate||before.selectionTransition||Object.keys(before.pending).length)throw new CadEditorError('INPUT','Apply or discard your draft before dragging a point.',{field:'surface-pole-drag'});
      if(before.view.kind!=='document'||!before.selection||!before.displayBodyIds.includes(before.selection.bodyId)||JSON.stringify(receipt.state.document)!==JSON.stringify(before.accepted))throw new CadEditorError('STALE','Select the current displayed Surface.',{field:'surface-pole-drag'});
      const resolved=resolveCadGeometryReference(before.accepted,before.selection.reference);
      if(resolved.geometry.kind!=='surface')throw new CadEditorError('STALE','Select the current original Surface.',{field:'surface-pole-drag'});
      const rect=canvas.getBoundingClientRect(),plane=projectCurvePole([...resolved.geometry.controlPoints[Math.floor(index/vCount)][index%vCount]] as PolePoint,receipt.state.camera,receipt.state.mmToSceneUnit,rect.width,rect.height,receipt.width,receipt.height);
      if(!plane)return;
      const previousU=before.selection!.uIndex,previousV=before.selection!.vIndex;
      session.requestSelection({bodyId:before.selection!.bodyId,uIndex:Math.floor(index/vCount),vIndex:index%vCount});
      const state=session.getSnapshot();
      if(state.selection?.uIndex!==Math.floor(index/vCount)||state.selection?.vIndex!==index%vCount||state.candidate||state.selectionTransition)throw new CadEditorError('STALE','The selected point changed.',{field:'surface-pole-drag'});
      event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.focus({preventScroll:true});
      gesture.current={pointerId:event.pointerId,element:event.currentTarget,bodyId:state.selection!.bodyId,index,vCount,previousU,previousV,generation:state.generation,displayGeneration:state.displayGeneration,reference:structuredClone(state.selection.reference),plane,startX:event.clientX,startY:event.clientY,rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},cameraKey:JSON.stringify(receipt.state.camera),moved:false,dxCss:0,dyCss:0,raw:{}};
      setMoving(true);
    }catch(cause){failure(cause);}
  }
  function move(event:ReactPointerEvent<SVGCircleElement>){
    const g=gesture.current;if(!g||event.pointerId!==g.pointerId)return;event.preventDefault();event.stopPropagation();
    try{
      current(g);const dx=event.clientX-g.startX,dy=event.clientY-g.startY;
      if(!g.moved&&Math.hypot(dx,dy)<=3)return;
      const point=moveCurvePoleInViewPlane(g.plane,dx,dy);g.moved=true;g.dxCss=dx;g.dyCss=dy;
      for(let i=0;i<fields.length;i++){const text=rawNumber(point[i]);session.stageSurfacePoleField(fields[i],text);g.raw[fields[i]]=text;}
    }catch(cause){cancel(false);failure(cause);}
  }
  function end(event:ReactPointerEvent<SVGCircleElement>){
    const g=gesture.current;if(!g||event.pointerId!==g.pointerId)return;event.preventDefault();event.stopPropagation();
    try{current(g);gesture.current=null;setMoving(false);release(g);if(g.moved)session.prepareApply();}
    catch(cause){cancel(false);failure(cause);}
  }
  if(!active||!points.length)return null;
  const selected=selectedPole.uIndex*vCount+selectedPole.vIndex,pending=Object.keys(snapshot.pending).length>0;
  const edges: [number,number][]=[];
  for(let u=0;u<selectedPole.countU;u++)for(let v=0;v<vCount;v++){
    const i=u*vCount+v;
    if(v+1<vCount)edges.push([i,i+1]);
    if(u+1<selectedPole.countU)edges.push([i,i+vCount]);
  }
  return <div className="cad-editor-surface-controls" data-testid="surface-control-overlay">
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="cad-editor-surface-control-svg" aria-label="Original Surface control net">
      {edges.map(([a,b])=>planes[a]&&planes[b]?<line key={a+'-'+b} x1={planes[a]!.xCss} y1={planes[a]!.yCss} x2={planes[b]!.xCss} y2={planes[b]!.yCss} className={pending?'curve-control-line pending':'curve-control-line'}/>:null)}
      {planes.map((plane,index)=>plane?<circle key={index} cx={plane.xCss} cy={plane.yCss} r={index===selected?7:5} role="button" tabIndex={0} aria-label={'Surface point U '+Math.floor(index/vCount)+' V '+index%vCount} aria-pressed={index===selected} data-testid={'surface-pole-handle-'+Math.floor(index/vCount)+'-'+index%vCount} className={'curve-control-point'+(index===selected?' selected':'')+(pending&&index===selected?' pending':'')}
        onPointerDown={event=>begin(event,index)} onPointerMove={move} onPointerUp={end} onPointerCancel={event=>{if(gesture.current?.pointerId===event.pointerId)cancel(true);}} onLostPointerCapture={event=>{if(gesture.current?.pointerId===event.pointerId)cancel(true);}}
        onKeyDown={event=>{if((event.key==='Enter'||event.key===' ')&&!event.nativeEvent.isComposing){event.preventDefault();const state=session.getSnapshot();if(state.candidate||state.selectionTransition||state.disposed)return;try{session.requestSelection({bodyId:selectedPole.bodyId,uIndex:Math.floor(index/vCount),vIndex:index%vCount});}catch(cause){failure(cause);}}}}/>:null)}
    </svg>
    {snapshot.editTarget!=='rotation'&&snapshot.editTarget!=='scale'&&<p className="cad-editor-surface-drag-hint" role="status" data-testid="surface-drag-status">{moving?'Release to apply. Escape cancels.':pending?'Point values pending. Apply or discard to continue.':snapshot.editTarget!=='pole'?'Select a grip, then use the object handle.':'Drag a control point · Escape cancels'}</p>}
  </div>;
}
