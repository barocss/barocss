import {useEffect,useRef,type PointerEvent as ReactPointerEvent,type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {resolveCadGeometryReference} from '@barocss/cad';
import {CadEditorError,type CadEditorSession,type CadEditorSnapshot,type CadEditorDraftField,type CadEditorBodyTranslationField} from '../types.js';
import type {Control} from './pole-axis-gizmo.js';
import {preparePlaneTranslationProjection,planeTranslationDisplacement,type ObjectMovePlane,type PlaneTranslationProjection} from './plane-translation-projection.js';

interface Props {
  session:CadEditorSession;control:Control;canvas:HTMLCanvasElement;snapStep:number|null;disabled:boolean;
  onError:(error:CadEditorError)=>void;onGestureChange:(active:boolean)=>void;
}
interface Gesture {
  pointerId:number;element:SVGPolygonElement;control:Control;projection:PlaneTranslationProjection;
  generation:number;displayGeneration:number;view:CadEditorSnapshot['view'];source:string;cameraKey:string;
  rect:{left:number;top:number;width:number;height:number};startX:number;startY:number;step:number|null;moved:boolean;
  raw:Partial<Record<CadEditorDraftField,string>>;
}
const fields:CadEditorBodyTranslationField[]=['xMM','yMM','zMM'];
const planes:ObjectMovePlane[]=['xy','xz','yz'];
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const samePoint=(a:number[],b:number[])=>a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
const sameRaw=(a:Partial<Record<CadEditorDraftField,string>>,b:Partial<Record<CadEditorDraftField,string>>)=>
  Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>a[key as CadEditorDraftField]===b[key as CadEditorDraftField]);
const rawNumber=(value:number)=>Object.is(value,-0)?'-0':String(value);

/** Two display-plane offsets use the existing single native object-translation admission. */
export function ObjectPlaneGizmo(props:Props) {
  const latest=useRef(props);latest.current=props;
  const gesture=useRef<Gesture|null>(null),pointerIds=useRef(new Set<number>());
  const state=props.session.getSnapshot(),bounds=props.canvas.getBoundingClientRect();
  const projections=new Map<ObjectMovePlane,PlaneTranslationProjection>();
  for(const plane of planes)try{
    const projection=preparePlaneTranslationProjection(props.control.point,props.control.receipt.state.camera,props.control.receipt.state.mmToSceneUnit,
      bounds.width,bounds.height,props.control.receipt.width,props.control.receipt.height,plane);
    if(projection)projections.set(plane,projection);
  }catch{ /* A clipped or parallel plane has no handle. */ }
  const active=gesture.current;
  if(active)projections.set(active.projection.plane,active.projection);
  function failure(cause:unknown){latest.current.onError(cause instanceof CadEditorError?cause:
    new CadEditorError('INPUT',cause instanceof Error?cause.message:'Cannot move this object in the selected plane.',{field:'body-plane-drag'},cause));}
  function otherCapture(own?:Gesture){
    const viewport=latest.current.canvas.closest('.cad-editor-viewport');
    if(!viewport)return true;
    return [...pointerIds.current].some(id=>[viewport,...viewport.querySelectorAll('*')].some(node=>
      !(own&&id===own.pointerId&&node===own.element)&&node.hasPointerCapture(id)));
  }
  function currentSource(snapshot:CadEditorSnapshot):string|null {
    const now=latest.current,selected=snapshot.selection??snapshot.curveSelection;
    const cap=snapshot.bodyCapabilities.find(body=>body.bodyId===snapshot.selectedBodyId);
    if(snapshot.editTarget!=='object'||snapshot.disposed||snapshot.candidate||snapshot.selectionTransition||!cap?.canTranslateBody
      ||!selected||selected.bodyId!==snapshot.selectedBodyId||!same(selected.reference,now.control.reference)
      ||!now.canvas.isConnected||!now.canvas.getClientRects().length
      ||document.querySelector('[role="dialog"][data-state="open"],[role="menu"]')!==null
      ||now.canvas.closest('.cad-editor-viewport')?.getAttribute('data-viewer-ready')!=='true'
      ||now.control.receipt.state.status!=='ready')return null;
    if(now.control.kind==='surface'){
      if(snapshot.view.kind!=='document'||!snapshot.selection||!snapshot.displayBodyIds.includes(selected.bodyId)
        ||!same(now.control.receipt.state.document,snapshot.accepted))return null;
    }else if(snapshot.view.kind!=='curve-focus'||!snapshot.curveSelection||snapshot.view.bodyId!==selected.bodyId)return null;
    try{
      const resolved=resolveCadGeometryReference(snapshot.accepted,selected.reference);
      const point=resolved.geometry.kind==='surface'&&snapshot.selection
        ?resolved.geometry.controlPoints[snapshot.selection.uIndex]?.[snapshot.selection.vIndex]
        :resolved.geometry.kind==='curve'&&snapshot.curveSelection?resolved.geometry.controlPoints[snapshot.curveSelection.index]:null;
      if(!point||resolved.geometry.kind!==now.control.kind||!samePoint(point,now.control.point))return null;
      return resolved.source;
    }catch{return null;}
  }
  function owned(current:Gesture,requireCapture=true){
    const now=latest.current,snapshot=now.session.getSnapshot(),rect=now.canvas.getBoundingClientRect();
    const selected=snapshot.selection??snapshot.curveSelection;
    const key=snapshot.selection?`surface:${snapshot.selection.bodyId}:${snapshot.selection.uIndex}:${snapshot.selection.vIndex}`
      :snapshot.curveSelection?`curve:${snapshot.curveSelection.bodyId}:${snapshot.curveSelection.index}`:'';
    return snapshot.generation===current.generation&&snapshot.displayGeneration===current.displayGeneration&&same(snapshot.view,current.view)
      &&key===current.control.key&&same(selected?.reference,current.control.reference)&&sameRaw(snapshot.pending,current.raw)
      &&now.control.key===current.control.key&&same(now.control.reference,current.control.reference)&&samePoint(now.control.point,current.control.point)
      &&currentSource(snapshot)===current.source&&JSON.stringify(now.control.receipt.state.camera)===current.cameraKey
      &&now.control.receipt.width===current.control.receipt.width&&now.control.receipt.height===current.control.receipt.height
      &&Object.is(now.control.receipt.state.mmToSceneUnit,current.control.receipt.state.mmToSceneUnit)&&Object.is(now.snapStep,current.step)
      &&rect.left===current.rect.left&&rect.top===current.rect.top&&rect.width===current.rect.width&&rect.height===current.rect.height
      &&(!requireCapture||current.element.hasPointerCapture(current.pointerId))&&!otherCapture(current);
  }
  function finish(current:Gesture){
    gesture.current=null;latest.current.onGestureChange(false);
    try{if(current.element.hasPointerCapture(current.pointerId))current.element.releasePointerCapture(current.pointerId);}catch{}
  }
  function cancel(restore:boolean){
    const current=gesture.current;if(!current)return;
    const restoreRaw=restore&&owned(current,false);finish(current);
    if(restoreRaw)try{latest.current.session.discardPending();}catch(cause){failure(cause);}
  }
  function check(current:Gesture){if(!owned(current))throw new CadEditorError('STALE','The object, view or draft changed. Review the pending offsets.',{field:'body-plane-drag'});}
  useEffect(()=>{
    const down=(event:PointerEvent)=>{if(event.target instanceof Element&&latest.current.canvas.closest('.cad-editor-viewport')?.contains(event.target))pointerIds.current.add(event.pointerId);};
    const release=(event:PointerEvent)=>{if(event.type!=='lostpointercapture')pointerIds.current.delete(event.pointerId);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&gesture.current){event.preventDefault();event.stopPropagation();cancel(true);}};
    window.addEventListener('pointerdown',down,true);window.addEventListener('pointerup',release,true);window.addEventListener('pointercancel',release,true);
    window.addEventListener('lostpointercapture',release,true);window.addEventListener('keydown',escape,true);
    return()=>{window.removeEventListener('pointerdown',down,true);window.removeEventListener('pointerup',release,true);window.removeEventListener('pointercancel',release,true);
      window.removeEventListener('lostpointercapture',release,true);window.removeEventListener('keydown',escape,true);cancel(true);pointerIds.current.clear();};
  },[props.session]);
  useEffect(()=>{const current=gesture.current;if(current&&!owned(current))cancel(false);});
  function begin(event:ReactPointerEvent<SVGPolygonElement>,plane:ObjectMovePlane){
    if(!event.isPrimary||event.button!==0||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
    event.preventDefault();event.stopPropagation();if(props.disabled||gesture.current||otherCapture())return;
    try{
      const now=latest.current,snapshot=now.session.getSnapshot(),source=currentSource(snapshot),rect=now.canvas.getBoundingClientRect();
      if(source===null||Object.keys(snapshot.pending).length)return;
      const projection=preparePlaneTranslationProjection(now.control.point,now.control.receipt.state.camera,now.control.receipt.state.mmToSceneUnit,
        rect.width,rect.height,now.control.receipt.width,now.control.receipt.height,plane);if(!projection)return;
      const x=event.clientX-rect.left,y=event.clientY-rect.top;
      planeTranslationDisplacement(projection,x,y,x,y,now.snapStep);
      event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.focus({preventScroll:true});
      gesture.current={pointerId:event.pointerId,element:event.currentTarget,control:structuredClone(now.control),projection,generation:snapshot.generation,
        displayGeneration:snapshot.displayGeneration,view:structuredClone(snapshot.view),source,cameraKey:JSON.stringify(now.control.receipt.state.camera),
        rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},startX:x,startY:y,step:now.snapStep,moved:false,raw:{}};
      now.onGestureChange(true);
    }catch(cause){cancel(false);failure(cause);}
  }
  function move(event:ReactPointerEvent<SVGPolygonElement>){
    const current=gesture.current;if(!current||event.pointerId!==current.pointerId)return;
    event.preventDefault();event.stopPropagation();
    try{
      check(current);const x=event.clientX-current.rect.left,y=event.clientY-current.rect.top;
      if(!current.moved&&Math.hypot(x-current.startX,y-current.startY)<=3)return;
      const offsets=planeTranslationDisplacement(current.projection,current.startX,current.startY,x,y,current.step);
      for(const axis of current.projection.axes){
        check(current);const field=fields[axis],raw=rawNumber(offsets[axis]);
        latest.current.session.stageBodyTranslationField(field,raw);current.raw[field]=raw;
        check(current);
      }
      current.moved=true;
    }catch(cause){cancel(false);failure(cause);}
  }
  function end(event:ReactPointerEvent<SVGPolygonElement>){
    if(gesture.current?.pointerId!==event.pointerId)return;
    move(event);const current=gesture.current;if(!current)return;
    event.preventDefault();event.stopPropagation();
    try{check(current);finish(current);if(current.moved)latest.current.session.prepareApply();}
    catch(cause){cancel(false);failure(cause);}
  }
  function keyboard(event:ReactKeyboardEvent<SVGPolygonElement>,plane:ObjectMovePlane){
    const first=event.key==='ArrowRight'||event.key==='ArrowLeft',second=event.key==='ArrowUp'||event.key==='ArrowDown';
    if(!(first||second)||event.defaultPrevented||event.repeat||event.nativeEvent.isComposing||event.keyCode===229||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
    event.preventDefault();event.stopPropagation();if(props.disabled||gesture.current||otherCapture())return;
    try{
      const now=latest.current,snapshot=now.session.getSnapshot(),source=currentSource(snapshot);if(source===null||Object.keys(snapshot.pending).length)return;
      const cameraKey=JSON.stringify(now.control.receipt.state.camera),rect=now.canvas.getBoundingClientRect(),step=now.snapStep;
      const projection=projections.get(plane);if(!projection)return;
      const axis=projection.axes[first?0:1],direction=event.key==='ArrowLeft'||event.key==='ArrowDown'?-1:1,value=(now.snapStep??1)*direction;
      if(!Number.isFinite(value)||Math.abs(value)>10000)throw new RangeError('Move by up to 10000 mm per axis.');
      const raw=rawNumber(value),field=fields[axis];now.session.stageBodyTranslationField(field,raw);
      const staged=now.session.getSnapshot();
      if(staged.generation!==snapshot.generation||staged.displayGeneration!==snapshot.displayGeneration||!same(staged.view,snapshot.view)
        ||!same(staged.selection,snapshot.selection)||!same(staged.curveSelection,snapshot.curveSelection)
        ||!sameRaw(staged.pending,{[field]:raw})||currentSource(staged)!==source||otherCapture()
        ||JSON.stringify(latest.current.control.receipt.state.camera)!==cameraKey||!Object.is(latest.current.snapStep,step)
        ||now.canvas.getBoundingClientRect().left!==rect.left||now.canvas.getBoundingClientRect().top!==rect.top
        ||now.canvas.getBoundingClientRect().width!==rect.width||now.canvas.getBoundingClientRect().height!==rect.height)
        throw new CadEditorError('STALE','The object or draft changed. Review the pending offsets.',{field:'body-plane-drag'});
      now.session.prepareApply();
    }catch(cause){failure(cause);}
  }
  if(!projections.size)return null;
  return <div className="cad-editor-plane-controls">
    <svg className="object-plane-svg" width={bounds.width} height={bounds.height} viewBox={`0 0 ${bounds.width} ${bounds.height}`} aria-label="Object movement planes">
      {planes.map(plane=>{const projection=projections.get(plane);if(!projection)return null;
        return <polygon key={plane} points={projection.quad.map(point=>point.x+','+point.y).join(' ')} className="object-plane-handle" data-plane={plane}
          data-testid={'object-plane-'+plane} role="button" tabIndex={0} aria-label={'Move object in '+plane.toUpperCase()+' plane'} aria-disabled={props.disabled||Boolean(active&&active.projection.plane!==plane)}
          onPointerDown={event=>begin(event,plane)} onPointerMove={move} onPointerUp={end} onKeyDown={event=>keyboard(event,plane)}
          onPointerCancel={event=>{if(gesture.current?.pointerId===event.pointerId)cancel(true);}}
          onLostPointerCapture={event=>{if(gesture.current?.pointerId===event.pointerId)cancel(true);}}>
          <title>{'Move object in '+plane.toUpperCase()+' plane'}</title>
        </polygon>;
      })}
    </svg>
  </div>;
}
