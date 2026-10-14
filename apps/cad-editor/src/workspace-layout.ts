import {useEffect,useRef,useState,type RefObject,type PointerEventHandler,type KeyboardEventHandler} from 'react';
import type {CadEditorSession,CadEditorSnapshot} from '@barocss/cad-editor';

export type WorkspacePanel = 'objects' | 'properties';
export interface WorkspacePanelDividerProps {
  panel: WorkspacePanel;
  visible: boolean;
  disabled: boolean;
  resizing: boolean;
  value: number;
  min: number;
  max: number;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onPointerCancel: PointerEventHandler<HTMLDivElement>;
  onLostPointerCapture: PointerEventHandler<HTMLDivElement>;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
}
type Panels={objectsVisible:boolean;propertiesVisible:boolean};
type Layout=Panels&{focused:boolean;restore:Panels;objectsWidth:number|null;propertiesWidth:number|null};
type NativeState=Pick<CadEditorSnapshot,'generation'|'displayGeneration'|'view'|'selectedBodyId'|'selection'|'curveSelection'
  |'editTarget'|'rotationAxis'|'scaleAxis'|'pending'> & {documentId:string;documentRevision:number};
interface Measurement {width:number;hostWidth:number;otherWidth:number;min:number;max:number}
interface ResizeGesture {
  panel:WorkspacePanel;pointerId:number;element:HTMLDivElement;startX:number;moved:boolean;
  measurement:Measurement;native:NativeState;panels:Panels;
  originalObjectsWidth:number|null;originalPropertiesWidth:number|null;
}
const MIN_CANVAS=360;
const widthKey=(panel:WorkspacePanel)=>panel==='objects'?'objectsWidth':'propertiesWidth';
const visibleKey=(panel:WorkspacePanel)=>panel==='objects'?'objectsVisible':'propertiesVisible';
function same(a:unknown,b:unknown):boolean {
  if(Object.is(a,b))return true;
  if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>same(value,b[index]));
  if(a!==null&&b!==null&&typeof a==='object'&&typeof b==='object'){
    const x=a as Record<string,unknown>,y=b as Record<string,unknown>;
    return Object.keys(x).length===Object.keys(y).length&&Object.keys(x).every(key=>Object.hasOwn(y,key)&&same(x[key],y[key]));
  }
  return false;
}
function nativeState(snapshot:CadEditorSnapshot):NativeState {
  const {generation,displayGeneration,view,selectedBodyId,selection,curveSelection,editTarget,rotationAxis,scaleAxis,pending}=snapshot;
  return {generation,displayGeneration,view,selectedBodyId,selection,curveSelection,editTarget,rotationAxis,scaleAxis,pending,
    documentId:snapshot.accepted.document.documentId,documentRevision:snapshot.accepted.document.revision};
}

/** Host layout only: the native editor and its forms stay mounted. */
export function useWorkspaceLayout(root:RefObject<HTMLDivElement|null>,session:CadEditorSession,blocked:()=>boolean,ready:boolean){
  const [layout,setLayout]=useState<Layout>({objectsVisible:true,propertiesVisible:true,focused:false,
    restore:{objectsVisible:true,propertiesVisible:true},objectsWidth:null,propertiesWidth:null});
  const current=useRef(layout);current.current=layout;
  const latest=useRef({blocked,ready});latest.current={blocked,ready};
  const pointers=useRef(new Map<number,Element>());
  const resize=useRef<ResizeGesture|null>(null);
  const [resizing,setResizing]=useState(false);
  const [captured,setCaptured]=useState(false);
  const [viewportReady,setViewportReady]=useState(false);
  const actualReady=()=>root.current?.querySelector('.cad-editor-viewport')?.getAttribute('data-viewer-ready')==='true';
  const hasCapture=(own?:ResizeGesture)=>[...pointers.current].some(([id,target])=>
    !(own&&id===own.pointerId&&target===own.element)&&target.isConnected&&target.hasPointerCapture(id));
  function unsafe(own?:ResizeGesture){
    const state=session.getSnapshot();
    return latest.current.blocked()||!latest.current.ready||!actualReady()||state.disposed||state.candidate!==null||state.selectionTransition!==null
      ||hasCapture(own)||!root.current?.getClientRects().length||document.querySelector('[role="dialog"][data-state="open"]')!==null;
  }
  const unavailable=()=>resize.current!==null||unsafe();
  function commit(next:Layout){current.current=next;setLayout(next);}
  function togglePanel(panel:'objectsVisible'|'propertiesVisible'){
    if(unavailable()||current.current.focused)return;
    commit({...current.current,[panel]:!current.current[panel]});
  }
  function toggleFocus(){
    if(unavailable())return;
    const before=current.current;
    commit(before.focused?{...before,...before.restore,focused:false}:{...before,objectsVisible:false,propertiesVisible:false,
      focused:true,restore:{objectsVisible:before.objectsVisible,propertiesVisible:before.propertiesVisible}});
  }
  function measure(panel:WorkspacePanel):Measurement|null {
    const host=root.current;
    const workspace=host?.querySelector<HTMLElement>('.app-workspace');
    const objectPanel=host?.querySelector<HTMLElement>('.document-tree');
    const propertyPanel=host?.querySelector<HTMLElement>('.cad-editor-inspector');
    const selected=panel==='objects'?objectPanel:propertyPanel;
    if(!workspace||!selected||!selected.getClientRects().length)return null;
    const hostWidth=workspace.getBoundingClientRect().width;
    const other=panel==='objects'?propertyPanel:objectPanel;
    const otherWidth=other?.getClientRects().length?other.getBoundingClientRect().width:0;
    const width=selected.getBoundingClientRect().width;
    const min=panel==='objects'?136:208;
    const max=Math.min(panel==='objects'?320:400,hostWidth-otherWidth-MIN_CANVAS);
    if(![hostWidth,otherWidth,width,max].every(Number.isFinite)||hostWidth<1000||width<=0||max<min)return null;
    return {width,hostWidth,otherWidth,min,max};
  }
  function finishResize(restore:boolean){
    const gesture=resize.current;if(!gesture)return;
    resize.current=null;setResizing(false);
    if(restore)commit({...current.current,objectsWidth:gesture.originalObjectsWidth,propertiesWidth:gesture.originalPropertiesWidth});
    try{if(gesture.element.hasPointerCapture(gesture.pointerId))gesture.element.releasePointerCapture(gesture.pointerId);}catch{ /* Keep pointer-release failures non-fatal, as before. */ }
  }
  function resizeCurrent(gesture:ResizeGesture):boolean {
    const bounds=measure(gesture.panel),state=session.getSnapshot(),panels=current.current;
    return !unsafe(gesture)&&!panels.focused&&panels.objectsVisible===gesture.panels.objectsVisible
      &&panels.propertiesVisible===gesture.panels.propertiesVisible&&same(nativeState(state),gesture.native)
      &&bounds!==null&&bounds.hostWidth===gesture.measurement.hostWidth
      &&(gesture.panel==='objects'?panels.propertiesWidth===gesture.originalPropertiesWidth:panels.objectsWidth===gesture.originalObjectsWidth);
  }
  function beginResize(panel:WorkspacePanel,event:Parameters<PointerEventHandler<HTMLDivElement>>[0]){
    if(!event.isPrimary||event.button!==0||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
    event.preventDefault();event.stopPropagation();
    if(unavailable()||current.current.focused||!current.current[visibleKey(panel)])return;
    const measurement=measure(panel);if(!measurement||!Number.isFinite(event.clientX))return;
    try{
      event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.focus({preventScroll:true});
      const before=current.current;
      resize.current={panel,pointerId:event.pointerId,element:event.currentTarget,startX:event.clientX,moved:false,
        measurement,native:nativeState(session.getSnapshot()),panels:{objectsVisible:before.objectsVisible,propertiesVisible:before.propertiesVisible},
        originalObjectsWidth:before.objectsWidth,originalPropertiesWidth:before.propertiesWidth};
      setResizing(true);
    }catch{finishResize(true);}
  }
  function moveResize(event:Parameters<PointerEventHandler<HTMLDivElement>>[0]){
    const gesture=resize.current;if(!gesture||gesture.pointerId!==event.pointerId)return;
    event.preventDefault();event.stopPropagation();
    if(!resizeCurrent(gesture)||!Number.isFinite(event.clientX)){finishResize(true);return;}
    const dx=event.clientX-gesture.startX;
    if(!gesture.moved&&Math.abs(dx)<=3)return;
    const {width,min,max}=gesture.measurement;
    const value=Math.min(max,Math.max(min,width+(gesture.panel==='objects'?dx:-dx)));
    gesture.moved=true;commit({...current.current,[widthKey(gesture.panel)]:value});
  }
  function endResize(event:Parameters<PointerEventHandler<HTMLDivElement>>[0]){
    const gesture=resize.current;if(!gesture||gesture.pointerId!==event.pointerId)return;
    moveResize(event);
    if(resize.current===gesture)finishResize(false);
  }
  function keyResize(panel:WorkspacePanel,event:Parameters<KeyboardEventHandler<HTMLDivElement>>[0]){
    if(event.defaultPrevented||event.repeat||event.nativeEvent.isComposing||event.keyCode===229
      ||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!['ArrowLeft','ArrowRight','Home'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();
    if(unavailable()||current.current.focused||!current.current[visibleKey(panel)])return;
    const measurement=measure(panel);if(!measurement)return;
    if(event.key==='Home'){commit({...current.current,[widthKey(panel)]:null});return;}
    const direction=(event.key==='ArrowRight'?1:-1)*(panel==='objects'?1:-1);
    const width=Math.min(measurement.max,Math.max(measurement.min,measurement.width+direction*8));
    commit({...current.current,[widthKey(panel)]:width});
  }
  useEffect(()=>{if(captured&&!hasCapture())setCaptured(false);});
  useEffect(()=>{const gesture=resize.current;if(gesture&&!resizeCurrent(gesture))finishResize(true);});
  useEffect(()=>{
    const host=root.current;if(!host)return;
    const refresh=()=>setViewportReady(actualReady());refresh();
    const observer=new MutationObserver(refresh);
    observer.observe(host,{subtree:true,childList:true,attributes:true,attributeFilter:['data-viewer-ready']});
    return()=>observer.disconnect();
  },[root]);
  useEffect(()=>{
    let listening=true;
    const down=(event:PointerEvent)=>{
      const target=event.target;if(!(target instanceof Element)||!root.current?.contains(target))return;
      pointers.current.set(event.pointerId,target);
      // Observe capture after React has processed the pointer event.
      setTimeout(()=>{if(listening)setCaptured(hasCapture());},0);
    };
    const release=(event:PointerEvent)=>{
      if(event.type==='lostpointercapture'&&pointers.current.get(event.pointerId)!==event.target)return;
      pointers.current.delete(event.pointerId);setCaptured(hasCapture());
    };
    const escape=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&resize.current){event.preventDefault();event.stopPropagation();finishResize(true);}
    };
    const key=(event:KeyboardEvent)=>{
      if(event.key!=='F8'||event.defaultPrevented||event.repeat||event.isComposing||event.keyCode===229
        ||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
      const target=event.target;
      if(!(target instanceof Element)||!root.current?.contains(target)||!target.closest('.cad-editor-viewport')
        ||target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="dialog"],[role="menu"]')||unavailable())return;
      event.preventDefault();event.stopPropagation();toggleFocus();
    };
    window.addEventListener('pointerdown',down,true);window.addEventListener('pointerup',release,true);
    window.addEventListener('pointercancel',release,true);window.addEventListener('lostpointercapture',release,true);
    window.addEventListener('keydown',escape,true);window.addEventListener('keydown',key);
    return()=>{listening=false;finishResize(true);pointers.current.clear();window.removeEventListener('pointerdown',down,true);
      window.removeEventListener('pointerup',release,true);window.removeEventListener('pointercancel',release,true);
      window.removeEventListener('lostpointercapture',release,true);window.removeEventListener('keydown',escape,true);window.removeEventListener('keydown',key);};
  },[session,root]);
  function dividerProps(panel:WorkspacePanel):WorkspacePanelDividerProps {
    const measurement=measure(panel),own=resize.current?.panel===panel;
    const visible=current.current[visibleKey(panel)]&&!current.current.focused;
    const value=measurement?.width??layout[widthKey(panel)]??(panel==='objects'?176:248);
    return {panel,visible,disabled:!visible||measurement===null||(!own&&(blocked()||!ready||!viewportReady||captured||resizing)),
      resizing:own,value,min:measurement?.min??(panel==='objects'?136:208),max:measurement?.max??(panel==='objects'?320:400),
      onPointerDown:event=>beginResize(panel,event),onPointerMove:moveResize,onPointerUp:endResize,
      onPointerCancel:event=>{if(resize.current?.pointerId===event.pointerId)finishResize(true);},
      onLostPointerCapture:event=>{if(resize.current?.pointerId===event.pointerId)finishResize(true);},
      onKeyDown:event=>keyResize(panel,event)};
  }
  return{...layout,resizing,dividerProps,disabled:blocked()||!ready||!viewportReady||captured||resizing,
    toggleObjects:()=>togglePanel('objectsVisible'),toggleProperties:()=>togglePanel('propertiesVisible'),toggleFocus};
}
