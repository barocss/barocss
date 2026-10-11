import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { type CadGeometryReferenceV0 } from '@barocss/cad';
import { CadEditorError, type CadEditorSession, type CadEditorPoleField, type CadEditorSnapshot } from '../types.js';
import type { CadEditorCurvePresentationReceipt, CadEditorDisplayReceipt } from './types.js';
import { resolveCurveControlPresentation, sameCurveControlData as same, type CurveControlPresentation } from './curve-control-presentation.js';
import { useCadEditorSnapshot } from './use-session.js';
import { projectCurvePole,moveCurvePoleInViewPlane,type CurvePolePlane,type PolePoint } from './curve-pole-projection.js';

interface Props {session:CadEditorSession;receipt:CadEditorCurvePresentationReceipt|null;documentReceipt:CadEditorDisplayReceipt|null;canvas:HTMLCanvasElement|null;
  isCurrentPresentation:(presentation:CurveControlPresentation)=>boolean;onGestureChange:(active:boolean)=>void;onError:(error:CadEditorError)=>void}
interface Gesture {
  pointerId:number;element:SVGCircleElement;bodyId:string;index:number;previousIndex:number;
  generation:number;displayGeneration:number;reference:CadGeometryReferenceV0;
  plane:CurvePolePlane;startX:number;startY:number;rect:{left:number;top:number;width:number;height:number};
  cameraKey:string;moved:boolean;dxCss:number;dyCss:number;raw:Partial<Record<CadEditorPoleField,string>>;
  session:CadEditorSession;presentation:CurveControlPresentation;editTarget:CadEditorSnapshot['editTarget'];
}
const fields=['xMM','yMM','zMM'] as const;
const rawNumber=(value:number)=>Object.is(value,-0)?'-0':String(value);
function sameRaw(a:Partial<Record<CadEditorPoleField,string>>,b:Partial<Record<CadEditorPoleField,string>>){return Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>a[key as CadEditorPoleField]===b[key as CadEditorPoleField]);}

/** Original coefficient handles; the sampled Curve stays accepted until PointerUp's real candidate. */
export function CurvePoleHandles(props:Props){
  const {session,canvas}=props;
  const snapshot=useCadEditorSnapshot(session);
  const gesture=useRef<Gesture|null>(null),latest=useRef(props);latest.current=props;
  const pointers=useRef(new Set<number>()),composing=useRef(false);
  const [moving,setMoving]=useState(false);
  let points:PolePoint[]=[],planes:(CurvePolePlane|null)[]=[],width=0,height=0;
  const presentation=resolveCurveControlPresentation(snapshot,props.documentReceipt,props.receipt),receipt=presentation?.receipt??null;
  const active=presentation!==null&&canvas!==null&&!snapshot.disposed
    && snapshot.bodyCapabilities.some(body=>body.bodyId===presentation.reference.bodyId&&body.canEditCurvePole);
  if(active){
    try{
      if(presentation&&receipt){
        points=presentation.curve.controlPoints.map(point=>[...point] as PolePoint);
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
  function failure(cause:unknown){latest.current.onError(cause instanceof CadEditorError?cause:new CadEditorError('INPUT',cause instanceof Error?cause.message:'Cannot move this point.',{field:'curve-pole-drag'},cause));}
  function captured(id:number,own?:Gesture){return [document.documentElement,...document.querySelectorAll('*')].some(element=>
    !(own&&own.pointerId===id&&own.element===element)&&element.hasPointerCapture(id));}
  function otherCapture(own?:Gesture){return [...pointers.current].some(id=>captured(id,own));}
  function frame(){const now=latest.current;return resolveCurveControlPresentation(now.session.getSnapshot(),now.documentReceipt,now.receipt);}
  function context(value:CurveControlPresentation){const now=latest.current,box=now.canvas?.getBoundingClientRect();return !composing.current
    &&now.canvas?.isConnected===true&&now.canvas.getClientRects().length>0&&!!box&&box.width>0&&box.height>0
    &&!['hidden','collapse'].includes(getComputedStyle(now.canvas).visibility)
    &&!now.canvas.closest('[data-direct-host-busy="true"],[data-panel-resizing="true"]')
    &&document.querySelector('[role="dialog"][data-state="open"],[role="menu"]')===null&&now.isCurrentPresentation(value);}
  function isOwned(g:Gesture,capture=true,token?:string){
    const now=latest.current,state=now.session.getSnapshot(),value=frame();
    const rect=now.canvas?.getBoundingClientRect();
    return now.session===g.session&&!state.disposed&&!state.selectionTransition&&!!value&&!!rect
      &&(token===undefined?!state.candidate:state.candidate?.token===token)&&state.generation===g.generation&&state.displayGeneration===g.displayGeneration
      &&state.editTarget===g.editTarget&&state.curveSelection?.bodyId===g.bodyId&&state.curveSelection.index===g.index
      &&same(state.curveSelection.reference,g.reference)&&sameRaw(state.pending,g.raw)&&value.kind===g.presentation.kind
      &&same(value.reference,g.presentation.reference)&&value.source===g.presentation.source&&same(value.curve,g.presentation.curve)
      &&same(value.view,g.presentation.view)&&context(value)&&same(value.receipt.state.camera,g.presentation.receipt.state.camera)
      &&Object.is(value.receipt.state.mmToSceneUnit,g.presentation.receipt.state.mmToSceneUnit)
      &&now.canvas?.width===g.presentation.receipt.width&&now.canvas.height===g.presentation.receipt.height
      &&rect.left===g.rect.left&&rect.top===g.rect.top&&rect.width===g.rect.width&&rect.height===g.rect.height
      &&(!capture||g.element.hasPointerCapture(g.pointerId))&&!otherCapture(g);
  }
  function current(g:Gesture,capture=true){if(!isOwned(g,capture))
    throw new CadEditorError('STALE','The view or point changed. Review the pending values before moving again.',{field:'curve-pole-drag',bodyId:g.bodyId});
  }
  function release(g:Gesture){try{if(g.element.hasPointerCapture(g.pointerId))g.element.releasePointerCapture(g.pointerId);}catch{}}
  function cancel(restore:boolean){
    const g=gesture.current;if(!g)return;const owned=restore&&isOwned(g,false);finish(g);
    if(!restore)return;
    if(owned){
      try{g.session.discardPending();
        if(g.previousIndex!==g.index){
          g.raw={};
          // Discard emits synchronously. A subscriber may now own raw, selection or a candidate.
          if(isOwned(g,false))g.session.requestSelection({bodyId:g.bodyId,index:g.previousIndex});
        }
      }catch(cause){failure(cause);}
    }
  }
  function finish(g:Gesture){gesture.current=null;setMoving(false);latest.current.onGestureChange(false);release(g);}
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&gesture.current){event.preventDefault();event.stopPropagation();cancel(true);}};
    let live=true;
    const down=(event:PointerEvent)=>{pointers.current.add(event.pointerId);};
    const up=(event:PointerEvent)=>{if(!captured(event.pointerId))pointers.current.delete(event.pointerId);setTimeout(()=>{if(live&&!captured(event.pointerId))pointers.current.delete(event.pointerId);},0);};
    const start=()=>{cancel(true);composing.current=true;},end=()=>{composing.current=false;};
    window.addEventListener('keydown',key,true);window.addEventListener('pointerdown',down,true);window.addEventListener('pointerup',up,true);
    window.addEventListener('pointercancel',up,true);window.addEventListener('lostpointercapture',up,true);window.addEventListener('compositionstart',start,true);window.addEventListener('compositionend',end,true);
    return()=>{live=false;window.removeEventListener('keydown',key,true);window.removeEventListener('pointerdown',down,true);window.removeEventListener('pointerup',up,true);
      window.removeEventListener('pointercancel',up,true);window.removeEventListener('lostpointercapture',up,true);window.removeEventListener('compositionstart',start,true);window.removeEventListener('compositionend',end,true);cancel(true);pointers.current.clear();};
  },[session]);
  useEffect(()=>{const g=gesture.current;if(g&&!isOwned(g))cancel(false);});
  useEffect(()=>{if(!props.canvas)return;const observer=new ResizeObserver(()=>{const g=gesture.current;if(g&&!isOwned(g,false))cancel(false);});observer.observe(props.canvas);return()=>observer.disconnect();},[props.canvas]);
  function begin(event:ReactPointerEvent<SVGCircleElement>,index:number){
    if(snapshot.editTarget!=='pole'){
      const currentState=session.getSnapshot(),value=frame();if(currentState.candidate||currentState.selectionTransition||currentState.disposed||!value||!context(value)||otherCapture())return;
      if(!event.isPrimary||event.button!==0||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!active)return;
      event.preventDefault();event.stopPropagation();
      try{session.requestSelection({bodyId:value.reference.bodyId,index});event.currentTarget.focus({preventScroll:true});}catch(cause){failure(cause);}
      return;
    }
    if(snapshot.editTarget!=='pole'||!event.isPrimary||event.button!==0||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!active||!receipt||!canvas)return;
    event.preventDefault();event.stopPropagation();
    try{
      const before=session.getSnapshot(),value=frame();
      if(!value||!context(value)||otherCapture()||!value.curve.controlPoints[index])return;
      if(before.candidate||before.selectionTransition||Object.keys(before.pending).length)throw new CadEditorError('INPUT','Apply or discard your draft before dragging a point.',{field:'curve-pole-drag'});
      const rect=canvas.getBoundingClientRect(),plane=projectCurvePole([...value.curve.controlPoints[index]] as PolePoint,value.receipt.state.camera,value.receipt.state.mmToSceneUnit,rect.width,rect.height,value.receipt.width,value.receipt.height);
      if(!plane)return;
      const previousIndex=before.curveSelection?.index??index;
      session.requestSelection({bodyId:value.reference.bodyId,index});
      const state=session.getSnapshot(),selected=frame();
      if(!selected||state.curveSelection?.index!==index||state.candidate||state.selectionTransition||Object.keys(state.pending).length
        ||state.editTarget!==before.editTarget||state.generation!==before.generation||state.displayGeneration!==before.displayGeneration
        ||!same(selected.reference,value.reference)||selected.source!==value.source||!context(selected))throw new CadEditorError('STALE','The selected point changed.',{field:'curve-pole-drag'});
      event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.focus({preventScroll:true});
      gesture.current={session,presentation:structuredClone(selected),editTarget:state.editTarget,pointerId:event.pointerId,element:event.currentTarget,bodyId:value.reference.bodyId,index,previousIndex,generation:state.generation,displayGeneration:state.displayGeneration,reference:structuredClone(state.curveSelection.reference),plane,startX:event.clientX,startY:event.clientY,rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},cameraKey:JSON.stringify(value.receipt.state.camera),moved:false,dxCss:0,dyCss:0,raw:{}};
      latest.current.onGestureChange(true);setMoving(true);
    }catch(cause){failure(cause);}
  }
  function move(event:ReactPointerEvent<SVGCircleElement>){
    const g=gesture.current;if(!g||event.pointerId!==g.pointerId)return;event.preventDefault();event.stopPropagation();
    try{
      if(!event.isPrimary||event.buttons!==1||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey){cancel(true);return;}
      stage(g,event.clientX,event.clientY);
    }catch(cause){cancel(false);failure(cause);}
  }
  function stage(g:Gesture,x:number,y:number){
      current(g);const dx=x-g.startX,dy=y-g.startY;
      if(!g.moved&&Math.hypot(dx,dy)<=3)return;
      const point=moveCurvePoleInViewPlane(g.plane,dx,dy);g.moved=true;g.dxCss=dx;g.dyCss=dy;
      for(let i=0;i<fields.length;i++){current(g);const text=rawNumber(point[i]);g.raw={...g.raw,[fields[i]]:text};g.session.stageCurvePoleField(fields[i],text);current(g);}
  }
  function end(event:ReactPointerEvent<SVGCircleElement>){
    const g=gesture.current;if(!g||event.pointerId!==g.pointerId)return;event.preventDefault();event.stopPropagation();
    if(!event.isPrimary||event.button!==0||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey){cancel(true);return;}
    try{stage(g,event.clientX,event.clientY);current(g);finish(g);if(g.moved){current(g,false);const proposed=g.session.prepareApply();
      if(!proposed&&Object.keys(g.session.getSnapshot().pending).length===0)g.raw={};
      if(!isOwned(g,false,proposed?.token)){if(proposed&&g.session.getSnapshot().candidate?.token===proposed.token)g.session.cancelCandidate(proposed.token);
        throw new CadEditorError('STALE','The point change was replaced during preparation. Review the draft.',{field:'curve-pole-drag'});}}}
    catch(cause){cancel(false);failure(cause);}
  }
  if(!active||!points.length)return null;
  const selected=snapshot.curveSelection!.index,pending=Object.keys(snapshot.pending).length>0;
  return <div className="cad-editor-curve-controls" data-testid="curve-control-overlay">
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="cad-editor-curve-control-svg" aria-label="Original Curve control points">
      {planes.map((p,index)=>index>0&&p&&planes[index-1]?<line key={'line'+index} x1={planes[index-1]!.xCss} y1={planes[index-1]!.yCss} x2={p.xCss} y2={p.yCss} className={pending?'curve-control-line pending':'curve-control-line'}/>:null)}
      {planes.map((p,index)=>p?<circle key={index} cx={p.xCss} cy={p.yCss} r={index===selected?7:5} role="button" tabIndex={0} aria-label={'Curve point '+(index+1)} aria-pressed={index===selected} data-testid={'curve-pole-handle-'+index} className={'curve-control-point'+(index===selected?' selected':'')+(pending&&index===selected?' pending':'')}
        onPointerDown={event=>begin(event,index)} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>cancel(true)} onLostPointerCapture={()=>{if(gesture.current)cancel(true);}}
        onKeyDown={event=>{if((event.key==='Enter'||event.key===' ')&&!event.repeat&&!event.nativeEvent.isComposing&&event.keyCode!==229
          &&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();event.stopPropagation();const state=session.getSnapshot(),value=frame();
          if(!value||!context(value)||otherCapture()||state.candidate||state.selectionTransition||state.disposed)return;
          try{session.requestSelection({bodyId:value.reference.bodyId,index});}catch(cause){failure(cause);}}}}/>:null)}
    </svg>
    {snapshot.editTarget!=='rotation'&&snapshot.editTarget!=='scale'&&<p className="cad-editor-curve-drag-hint" role="status" data-testid="curve-drag-status">{moving?'Release to apply. Escape cancels.':pending?'Point values pending. Apply or discard to continue.':snapshot.editTarget!=='pole'?'Select a grip, then use the object handle.':'Drag a point to move it in the view plane.'}</p>}
  </div>;
}
