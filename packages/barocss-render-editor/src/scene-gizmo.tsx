import {useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import type {RenderEditorController} from './controller.js';
import {normalizeRenderEditorError, type RenderEditorError} from './errors.js';
import {editRenderSceneObjectSource} from './scene-object-source.js';
import {prepareRenderSceneGizmo, deriveRenderSceneGizmoPatch, type RenderSceneGizmoMode, type RenderSceneGizmoViewport} from './scene-gizmo-projection.js';

interface Props {controller:RenderEditorController; canvas:HTMLCanvasElement|null; disabled?:boolean; onError?:(error:RenderEditorError)=>void; onHelp?:()=>void; onGestureChange?:(active:boolean)=>void}
type Point = readonly [number,number];
type Box = RenderSceneGizmoViewport & {left:number;top:number};
const viewportOf=(box:Box):RenderSceneGizmoViewport=>({width:box.width,height:box.height,backingWidth:box.backingWidth,backingHeight:box.backingHeight});
const sameBox = (a:Box,b:Box) => (['width','height','backingWidth','backingHeight','left','top'] as const).every(key=>a[key]===b[key]);
const arrowPoints=(points:readonly Point[],anchor:Point)=>{const prior=points[Math.max(0,points.length-2)]??anchor, dx=anchor[0]-prior[0],dy=anchor[1]-prior[1],length=Math.hypot(dx,dy)||1,x=dx/length,y=dy/length;return [[anchor[0]+4*x,anchor[1]+4*y],[anchor[0]-7*x+4*y,anchor[1]-7*y-4*x],[anchor[0]-7*x-4*y,anchor[1]-7*y+4*x]].map(p=>p.join(',')).join(' ');};
const measure = (canvas:HTMLCanvasElement):Box => {const rect=canvas.getBoundingClientRect();return {left:rect.left,top:rect.top,width:rect.width,height:rect.height,backingWidth:canvas.width,backingHeight:canvas.height};};

/** Projected source handles share the existing canvas and renderer. */
export function SceneGizmo({controller,canvas,disabled=false,onError,onHelp,onGestureChange}:Props) {
  const session=useSyncExternalStore(controller.session.subscribe,controller.session.getSnapshot,controller.session.getSnapshot);
  const view=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  const [mode,setMode]=useState<RenderSceneGizmoMode>('translate'), [box,setBox]=useState<Box|null>(null), [active,setActive]=useState<string|null>(null), [notice,setNotice]=useState(''), [localHelp,setLocalHelp]=useState(false);
  const svg=useRef<SVGSVGElement>(null), help=useRef<HTMLButtonElement>(null);
  const latest=useRef({disabled,onError,onHelp,onGestureChange,mode}); latest.current={disabled,onError,onHelp,onGestureChange,mode};
  const localHelpOpen=useRef(localHelp);localHelpOpen.current=localHelp;
  const cancelGesture=useRef<(()=>void)|null>(null);
  useEffect(()=>{if(!canvas)return;const update=()=>setBox(measure(canvas));const observer=new ResizeObserver(update);observer.observe(canvas);update();return()=>observer.disconnect();},[canvas]);
  const clean=!session.sourceDirty&&!session.cameraDirty&&!session.objectInputInvalid;
  const preparation=useMemo(()=>{
    if(!box||!session.activeObjectId||view.cameraPreview||view.disposed||view.presentedRevision===null||(!clean&&!view.transformPreview))return {pivot:[0,0] as Point,handles:[],unavailable:null};
    try{return prepareRenderSceneGizmo(view.transformPreview?.source??session.accepted.sceneSource,session.activeObjectId,session.accepted.camera,viewportOf(box),mode);}
    catch{return {pivot:[0,0] as Point,handles:[],unavailable:'Handles are unavailable for this view. Use the object fields.'};}
  },[box,session.accepted,session.activeObjectId,clean,view.transformPreview,view.cameraPreview,view.disposed,view.presentedRevision,mode]);
  useEffect(()=>{
    if(!canvas||!svg.current)return;
    const element=svg.current;
    type Gesture={snapshot:ReturnType<typeof controller.session.getSnapshot>;id:string;source:string;box:Box;mode:RenderSceneGizmoMode;key:'x'|'y'|'z'|'uniform';from:Point;to:Point;pointer:number;capture:Element;expected:ReturnType<typeof controller.getSnapshot>['transformPreview'];moved:boolean;failed:boolean};
    let gesture:Gesture|null=null, frame:number|null=null, presenting=false;
    const point=(event:PointerEvent,g:Gesture):Point=>[event.clientX-g.box.left,event.clientY-g.box.top];
    const fresh=(g:Gesture)=>!controller.getSnapshot().disposed&&controller.getSnapshot().presentedRevision!==null&&!controller.getSnapshot().cameraPreview&&controller.session.getSnapshot()===g.snapshot&&controller.session.getSnapshot().activeObjectId===g.id&&controller.getSnapshot().transformPreview===g.expected;
    const valid=(g:Gesture)=>fresh(g)&&sameBox(measure(canvas),g.box);
    const release=()=>{if(frame!==null){cancelAnimationFrame(frame);frame=null;}const old=gesture;gesture=null;if(old&&old.capture.hasPointerCapture(old.pointer))old.capture.releasePointerCapture(old.pointer);setActive(null);latest.current.onGestureChange?.(false);};
    const report=(cause:unknown)=>{const error=normalizeRenderEditorError(cause);if(error!==cause)Object.defineProperty(error,'cause',{value:cause,enumerable:false,configurable:true});setNotice('The transform was refused. Check the object fields or camera.');latest.current.onError?.(error);};
    const cancel=()=>{const old=gesture;const restore=old&&fresh(old)&&old.expected!==null;release();if(restore){presenting=true;const result=controller.cancelObjectPreview();presenting=false;if(!result.ok)report(result.error);}};
    cancelGesture.current=cancel;
    const flush=()=>{
      frame=null;const g=gesture;if(!g)return false;
      if(!valid(g)){if(fresh(g))cancel();else release();setNotice('The scene changed. Start a new transform.');return false;}
      if(!g.moved)return true;
      try {
        const patch=deriveRenderSceneGizmoPatch(g.source,g.id,g.snapshot.accepted.camera,viewportOf(g.box),g.mode,g.key,g.from,g.to);
        const source=editRenderSceneObjectSource(g.source,g.id,patch);
        presenting=true;const result=controller.previewObjectSource(g.id,source);presenting=false;
        g.expected=controller.getSnapshot().transformPreview;g.failed=!result.ok;
        if(result.ok&&!fresh(g)){release();setNotice('The scene changed. Start a new transform.');return false;}
        if(!result.ok){report(result.error);if(controller.getSnapshot().disposed||controller.getSnapshot().presentedRevision===null)release();return false;}setNotice('');return true;
      }catch(cause){presenting=false;g.failed=true;report(cause);return false;}
    };
    const down=(event:PointerEvent)=>{
      const handle=(event.target as Element).closest<SVGElement>('[data-gizmo-key]');
      const state=controller.session.getSnapshot(), current=controller.getSnapshot();
      if(!handle||event.button!==0||gesture||latest.current.disabled||current.cameraPreview||current.transformPreview||current.disposed||current.presentedRevision===null||state.sourceDirty||state.cameraDirty||state.objectInputInvalid||!state.activeObjectId)return;
      event.preventDefault();event.stopPropagation();const rect=measure(canvas), key=handle.dataset.gizmoKey as Gesture['key'];
      gesture={snapshot:state,id:state.activeObjectId,source:state.accepted.sceneSource,box:rect,mode:latest.current.mode,key,from:[event.clientX-rect.left,event.clientY-rect.top],to:[event.clientX-rect.left,event.clientY-rect.top],pointer:event.pointerId,capture:handle,expected:null,moved:false,failed:false};
      handle.focus();handle.setPointerCapture(event.pointerId);setActive(handle.getAttribute('aria-label'));setNotice('');latest.current.onGestureChange?.(true);
    };
    const move=(event:PointerEvent)=>{const g=gesture;if(!g||event.pointerId!==g.pointer)return;event.preventDefault();event.stopPropagation();g.to=point(event,g);g.moved ||= Math.hypot(g.to[0]-g.from[0],g.to[1]-g.from[1])>=3;if(frame===null)frame=requestAnimationFrame(flush);};
    const up=(event:PointerEvent)=>{
      const g=gesture;if(!g||event.pointerId!==g.pointer)return;event.preventDefault();event.stopPropagation();g.to=point(event,g);g.moved ||= Math.hypot(g.to[0]-g.from[0],g.to[1]-g.from[1])>=3;
      if(frame!==null){cancelAnimationFrame(frame);frame=null;}const success=flush();const commit=success&&gesture===g&&valid(g)&&g.moved&&g.expected!==null;
      release();if(commit){presenting=true;const result=controller.applyObjectPreview();presenting=false;if(!result.ok)report(result.error);}
    };
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&gesture){event.preventDefault();event.stopPropagation();cancel();return;}
      if(latest.current.disabled||localHelpOpen.current)return;
      const handle=event.target instanceof Element?event.target.closest<SVGElement>('[data-gizmo-key]'):null;
      const offsets:Record<string,Point>={ArrowLeft:[-6,0],ArrowRight:[6,0],ArrowUp:[0,-6],ArrowDown:[0,6]};
      if(handle&&offsets[event.key]&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.isComposing){
        event.preventDefault();event.stopPropagation();const state=controller.session.getSnapshot(), current=controller.getSnapshot();
        if(event.repeat||gesture||latest.current.disabled||current.cameraPreview||current.transformPreview||current.disposed||current.presentedRevision===null||state.sourceDirty||state.cameraDirty||state.objectInputInvalid||!state.activeObjectId)return;
        try {const rect=measure(canvas), key=handle.dataset.gizmoKey as Gesture['key'];const prepared=prepareRenderSceneGizmo(state.accepted.sceneSource,state.activeObjectId,state.accepted.camera,viewportOf(rect),latest.current.mode);const selected=prepared.handles.find(value=>value.key===key);if(!selected)return;
          const delta=offsets[event.key]!, from=selected.anchor, to:Point=[from[0]+delta[0],from[1]+delta[1]];
          const patch=deriveRenderSceneGizmoPatch(state.accepted.sceneSource,state.activeObjectId,state.accepted.camera,viewportOf(rect),latest.current.mode,key,from,to), source=editRenderSceneObjectSource(state.accepted.sceneSource,state.activeObjectId,patch);
          latest.current.onGestureChange?.(true);presenting=true;const preview=controller.previewObjectSource(state.activeObjectId,source);presenting=false;
          if(!preview.ok)report(preview.error);else if(controller.getSnapshot().transformPreview){const result=controller.applyObjectPreview();if(!result.ok)report(result.error);}latest.current.onGestureChange?.(false);
        }catch(cause){presenting=false;latest.current.onGestureChange?.(false);report(cause);}return;
      }

      if(event.key==='Escape'&&(gesture||((event.target===canvas||handle!==null)&&controller.getSnapshot().transformPreview))){event.preventDefault();event.stopPropagation();if(gesture)cancel();else{const result=controller.cancelObjectPreview();if(!result.ok)report(result.error);}return;}
      if(gesture&&(event.ctrlKey||event.metaKey)&&['n','o','s','z'].includes(event.key.toLowerCase())){event.preventDefault();event.stopPropagation();}
    };
    const lost=(event:PointerEvent)=>{if(gesture?.pointer===event.pointerId)cancel();};
    const context=()=>{release();};
    const resized=()=>{const old=gesture;if(!old||sameBox(measure(canvas),old.box))return;cancel();};
    const gestureObserver=new ResizeObserver(resized);gestureObserver.observe(canvas);
    const changed=()=>{if(!presenting&&gesture&&!valid(gesture)){if(fresh(gesture))cancel();else release();setNotice('The scene changed. Start a new transform.');}};
    const unview=controller.subscribe(changed), unsession=controller.session.subscribe(changed);
    element.addEventListener('pointerdown',down);element.addEventListener('pointermove',move);element.addEventListener('pointerup',up);element.addEventListener('pointercancel',lost);element.addEventListener('lostpointercapture',lost);
    window.addEventListener('keydown',keydown);window.addEventListener('blur',cancel);canvas.addEventListener('webglcontextlost',context);
    return()=>{gestureObserver.disconnect();cancel();cancelGesture.current=null;unview();unsession();element.removeEventListener('pointerdown',down);element.removeEventListener('pointermove',move);element.removeEventListener('pointerup',up);element.removeEventListener('pointercancel',lost);element.removeEventListener('lostpointercapture',lost);window.removeEventListener('keydown',keydown);window.removeEventListener('blur',cancel);canvas.removeEventListener('webglcontextlost',context);};
  },[controller,canvas]);
  const pending=Boolean(view.transformPreview), locked=disabled||Boolean(active)||pending||Boolean(view.cameraPreview)||view.disposed;
  const choose=(value:RenderSceneGizmoMode)=>{if(locked)return;setMode(value);setNotice('');};
  const cancelPending=()=>{cancelGesture.current?.();if(controller.getSnapshot().transformPreview){const result=controller.cancelObjectPreview();if(!result.ok)onError?.(result.error);}};
  return <>
    <div className="re-gizmo-toolbar" aria-label="Object transform controls">{(['translate','rotate','scale'] as const).map(value=><button key={value} type="button" data-testid={`gizmo-mode-${value}`} aria-pressed={mode===value} disabled={locked} onClick={()=>choose(value)}>{value==='translate'?'Move':value==='rotate'?'Rotate':'Uniform scale'}</button>)}<button ref={help} type="button" data-testid="gizmo-help" aria-label="Transform controls Help" onClick={()=>onHelp?onHelp():setLocalHelp(true)}>Help</button>{pending&&!active&&<button type="button" disabled={disabled||view.disposed} onClick={cancelPending}>Cancel transform</button>}</div>
    <svg ref={svg} className="re-gizmo-overlay" data-testid="gizmo-overlay" width="100%" height="100%" aria-label="Projected object transform handles">{preparation.handles.length>0&&<circle className="re-gizmo-pivot" cx={preparation.pivot[0]} cy={preparation.pivot[1]} r="3"/>}{preparation.handles.map(handle=><g key={`${mode}-${handle.key}`} data-gizmo-key={handle.key} data-testid={`gizmo-handle-${handle.key}`} aria-label={handle.label} role="button" tabIndex={locked? -1:0} aria-disabled={locked} className={`re-gizmo-handle re-gizmo-axis-${handle.key}`}><polyline className="re-gizmo-hit" points={handle.points.map(p=>p.join(',')).join(' ')}/><polyline className="re-gizmo-line" points={handle.points.map(p=>p.join(',')).join(' ')}/><circle className="re-gizmo-hit-anchor" cx={handle.anchor[0]} cy={handle.anchor[1]} r="11"/>{mode==='translate'?<polygon className="re-gizmo-anchor" points={arrowPoints(handle.points,handle.anchor)}/>:mode==='scale'?<rect className="re-gizmo-anchor" x={handle.anchor[0]-5} y={handle.anchor[1]-5} width="10" height="10"/>:<circle className="re-gizmo-anchor" cx={handle.anchor[0]} cy={handle.anchor[1]} r="4"/>}<text x={handle.anchor[0]+8} y={handle.anchor[1]-7}>{handle.key==='uniform'?'S':handle.key.toUpperCase()}</text></g>)}</svg>
    <p className="re-gizmo-status" data-testid="gizmo-status" role="status">{active?`${active} · Release to apply · Escape to cancel`:pending?'Transform preview · Cancel or correct the refused change':notice||preparation.unavailable||(!clean?'Apply or Discard drafts to use handles.':'')}</p>
    {localHelp&&<div className="re-camera-local-help" role="dialog" aria-label="Transform controls"><p>Drag Move or Rotate axes, or the Uniform scale handle. Release applies once. Escape cancels. Handles use the source origin and scene units; local rotation is X, then Y, then Z. Focus a handle and use arrows for a small transform. Use the numeric object fields when a handle is unavailable.</p><button type="button" onClick={()=>{setLocalHelp(false);help.current?.focus();}}>Close Help</button></div>}
  </>;
}
