import {useEffect,useRef,useState,type RefObject} from 'react';
import type {CadEditorSession} from '@barocss/cad-editor';

type Panels={objectsVisible:boolean;propertiesVisible:boolean};
type Layout=Panels&{focused:boolean;restore:Panels};

/** Host layout only: the native editor and its forms stay mounted. */
export function useWorkspaceLayout(root:RefObject<HTMLDivElement|null>,session:CadEditorSession,blocked:()=>boolean,ready:boolean){
  const [layout,setLayout]=useState<Layout>({objectsVisible:true,propertiesVisible:true,focused:false,
    restore:{objectsVisible:true,propertiesVisible:true}});
  const current=useRef(layout);current.current=layout;
  const latest=useRef({blocked,ready});latest.current={blocked,ready};
  const pointers=useRef(new Map<number,Element>());
  const [captured,setCaptured]=useState(false);
  const [viewportReady,setViewportReady]=useState(false);
  const actualReady=()=>root.current?.querySelector('.cad-editor-viewport')?.getAttribute('data-viewer-ready')==='true';
  const hasCapture=()=>[...pointers.current].some(([id,target])=>target.isConnected&&target.hasPointerCapture(id));
  function unavailable(){
    const state=session.getSnapshot();
    return latest.current.blocked()||!latest.current.ready||!actualReady()||state.disposed||state.candidate!==null||state.selectionTransition!==null
      ||hasCapture()||!root.current?.getClientRects().length||document.querySelector('[role="dialog"][data-state="open"]')!==null;
  }
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
  useEffect(()=>{if(captured&&!hasCapture())setCaptured(false);});
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
    const key=(event:KeyboardEvent)=>{
      if(event.key!=='F8'||event.defaultPrevented||event.repeat||event.isComposing||event.keyCode===229
        ||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
      const target=event.target;
      if(!(target instanceof Element)||!root.current?.contains(target)||!target.closest('.cad-editor-viewport')
        ||target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="dialog"],[role="menu"]')||unavailable())return;
      event.preventDefault();event.stopPropagation();toggleFocus();
    };
    window.addEventListener('pointerdown',down,true);window.addEventListener('pointerup',release,true);
    window.addEventListener('pointercancel',release,true);window.addEventListener('lostpointercapture',release,true);window.addEventListener('keydown',key);
    return()=>{listening=false;pointers.current.clear();window.removeEventListener('pointerdown',down,true);
      window.removeEventListener('pointerup',release,true);window.removeEventListener('pointercancel',release,true);
      window.removeEventListener('lostpointercapture',release,true);window.removeEventListener('keydown',key);};
  },[session,root]);
  return{...layout,disabled:blocked()||!ready||!viewportReady||captured,toggleObjects:()=>togglePanel('objectsVisible'),
    toggleProperties:()=>togglePanel('propertiesVisible'),toggleFocus};
}
