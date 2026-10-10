import {useEffect,useId,useRef,useState,type RefObject} from 'react';
import {Command} from 'lucide-react';
import {Button} from './components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from './components/ui/dialog';

export type CommandId='pole'|'object'|'rotation'|'scale'|'fit-document'|'fit-selected'|'objects'|'properties'|'focus';
export interface PaletteCommand {id:CommandId;name:string;shortcut?:string;status?:string;disabled:boolean}
interface Props {
  root:RefObject<HTMLDivElement|null>;
  commands:PaletteCommand[];
  blocked:()=>boolean;
  ready:()=>boolean;
  available:(id:CommandId)=>boolean;
  execute:(id:CommandId)=>void;
}

/** Private host UI. Every command is rechecked after its modal has left the DOM. */
export function CadCommandPalette(props:Props) {
  const latest=useRef(props);latest.current=props;
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[activeId,setActiveId]=useState<CommandId|null>(null);
  const [,refresh]=useState(0),ids=useId(),search=useRef<HTMLInputElement|null>(null),content=useRef<HTMLDivElement|null>(null);
  const composing=useRef(false);
  const returnFocus=useRef<HTMLElement|null>(null),pending=useRef<{id:CommandId;dialog:HTMLDivElement|null}|null>(null),scheduled=useRef<number|null>(null);
  const pointers=useRef(new Set<number>());
  function captured() {
    const root=latest.current.root.current;if(!root)return false;
    return [...pointers.current].some(id=>root.hasPointerCapture(id)||[...root.querySelectorAll('*')].some(node=>node.hasPointerCapture(id)));
  }
  function allowed(ignoreOwnDialog=false) {
    const now=latest.current,root=now.root.current;
    if(now.blocked()||!now.ready()||captured()||!root?.getClientRects().length
      ||root.querySelector('.cad-editor-viewport')?.getAttribute('data-viewer-ready')!=='true')return false;
    return ![...document.querySelectorAll('[role="menu"],[role="dialog"][data-state="open"]')]
      .some(node=>!(ignoreOwnDialog&&node===content.current));
  }
  function show() {
    if(!allowed())return;
    if(scheduled.current!==null){cancelAnimationFrame(scheduled.current);scheduled.current=null;}
    returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    pending.current=null;composing.current=false;setQuery('');setActiveId(null);setOpen(true);
  }
  function choose(id:CommandId) {
    if(!allowed(true)||!latest.current.available(id))return;
    pending.current={id,dialog:content.current};setOpen(false);
  }
  useEffect(()=>{
    let listening=true;
    const down=(event:PointerEvent)=>{pointers.current.add(event.pointerId);setTimeout(()=>{if(listening)refresh(value=>value+1);},0);};
    const release=(event:PointerEvent)=>{if(event.type!=='lostpointercapture'||!captured())pointers.current.delete(event.pointerId);refresh(value=>value+1);};
    const key=(event:KeyboardEvent)=>{
      if(event.defaultPrevented||event.repeat||event.isComposing||event.keyCode===229||event.altKey||event.shiftKey
        ||event.ctrlKey===event.metaKey||event.key.toLowerCase()!=='k')return;
      const target=event.target,viewport=latest.current.root.current?.querySelector('.cad-editor-viewport');
      if(!(target instanceof Element)||!viewport?.contains(target)
        ||target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="dialog"],[role="menu"]'))return;
      event.preventDefault();event.stopPropagation();if(allowed())show();
    };
    window.addEventListener('keydown',key);window.addEventListener('pointerdown',down,true);
    window.addEventListener('pointerup',release,true);window.addEventListener('pointercancel',release,true);window.addEventListener('lostpointercapture',release,true);
    const observer=new MutationObserver(()=>{if(listening)refresh(value=>value+1);});
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-state','data-viewer-ready','role']});
    return()=>{listening=false;pending.current=null;if(scheduled.current!==null)cancelAnimationFrame(scheduled.current);
      observer.disconnect();
      window.removeEventListener('keydown',key);window.removeEventListener('pointerdown',down,true);
      window.removeEventListener('pointerup',release,true);window.removeEventListener('pointercancel',release,true);window.removeEventListener('lostpointercapture',release,true);pointers.current.clear();};
  },[]);
  const executable=allowed(true);
  const filtered=props.commands.filter(command=>(command.name+' '+(command.shortcut??'')).toLowerCase().includes(query.trim().toLowerCase()))
    .map(command=>({...command,disabled:command.disabled||!executable}));
  const enabled=filtered.filter(command=>!command.disabled),active=enabled.find(command=>command.id===activeId)??enabled[0];
  return <>
    <Button type="button" variant="ghost" size="icon-sm" data-testid="command-palette-open" aria-label="Commands (Ctrl or Command K)"
      aria-keyshortcuts="Control+K Meta+K" aria-haspopup="dialog" aria-expanded={open} title="Commands (Ctrl or Command K)" disabled={!allowed()} onClick={show}><Command/></Button>
    <Dialog open={open} onOpenChange={value=>{if(!value)pending.current=null;setOpen(value);}}>
      <DialogContent ref={content} data-testid="command-palette-dialog" className="cad-editor-help-dialog gap-3 p-4"
        onEscapeKeyDown={event=>{if(composing.current||event.isComposing||event.keyCode===229)event.preventDefault();}}
        onOpenAutoFocus={event=>{event.preventDefault();search.current?.focus();}}
        onCloseAutoFocus={event=>{event.preventDefault();returnFocus.current?.focus({preventScroll:true});const command=pending.current;pending.current=null;
          if(command){let frames=0;const dispatch=()=>{scheduled.current=null;
            if(!allowed()||!latest.current.available(command.id))return;
            if(command.dialog?.isConnected){if(++frames<40)scheduled.current=requestAnimationFrame(dispatch);return;}
            latest.current.execute(command.id);
          };scheduled.current=requestAnimationFrame(dispatch);}}}>
        <DialogHeader><DialogTitle className="text-sm">Commands</DialogTitle><DialogDescription className="text-xs">Find a modeling or view command.</DialogDescription></DialogHeader>
        <input ref={search} data-testid="command-palette-search" aria-label="Search commands" role="combobox" aria-autocomplete="list"
          aria-expanded="true" aria-controls={ids+'-results'} aria-activedescendant={active?ids+'-'+active.id:undefined}
          className="h-8 w-full rounded border border-input bg-background px-3 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={query} maxLength={128} placeholder="Search commands…" onChange={event=>{setQuery(event.target.value);setActiveId(null);}}
          onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}}
          onKeyDown={event=>{
            if(composing.current||event.nativeEvent.isComposing||event.keyCode===229||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
            if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();event.stopPropagation();if(!enabled.length)return;
              const index=enabled.findIndex(command=>command.id===active?.id),direction=event.key==='ArrowDown'?1:-1;
              setActiveId(enabled[(index+direction+enabled.length)%enabled.length].id);
            }else if(event.key==='Enter'&&!event.repeat){event.preventDefault();event.stopPropagation();if(active)choose(active.id);}
          }}/>
        <div id={ids+'-results'} role="listbox" aria-label="Commands" className="grid max-h-[55dvh] gap-1 overflow-y-auto">
          {filtered.map(command=><Button key={command.id} id={ids+'-'+command.id} type="button" role="option" tabIndex={-1}
            data-testid={'command-palette-'+command.id} aria-selected={active?.id===command.id} aria-disabled={command.disabled} disabled={command.disabled}
            variant={active?.id===command.id?'secondary':'ghost'} size="sm" className="h-8 w-full justify-between gap-3 text-xs"
            onPointerMove={()=>{if(!command.disabled)setActiveId(command.id);}} onClick={()=>choose(command.id)}>
            <span>{command.name}</span><span className="flex items-center gap-3 text-[10px] text-muted-foreground">{command.status&&<span>{command.status}</span>}{command.shortcut&&<kbd>{command.shortcut}</kbd>}</span>
          </Button>)}
        </div>
        {filtered.length===0&&<p role="status" className="m-0 text-xs text-muted-foreground">No commands found.</p>}
      </DialogContent>
    </Dialog>
  </>;
}
