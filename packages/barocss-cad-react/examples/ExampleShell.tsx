import * as React from 'react';
import type {ModelHost} from '../src/engine.js';
import './example-inspector.css';

export function exampleErrorMessage(error:unknown):string{
  if(error instanceof Error)return error.message||error.name;
  if(error&&typeof error==='object'){
    const fields=error as Record<string,unknown>;
    const words=['title','hint','detail'].map(key=>fields[key]).filter((value):value is string=>typeof value==='string'&&value.trim().length>0);
    if(words.length)return [...new Set(words)].join(' ');
  }
  return String(error);
}

type HostState={status:'starting'|'pending'|'ready'|'failed'|'disposed';error:string|null};
function useHostState(host:ModelHost|null):HostState{
  const [state,setState]=React.useState<HostState>({status:'starting',error:null});
  React.useEffect(()=>{
    if(!host){setState({status:'starting',error:null});return;}
    let retired=false;
    const poll=()=>{
      if(retired)return;
      const current=host.read();
      const status=current.status==='ready'?'ready':current.status==='failed'?'failed':current.status==='disposed'?'disposed':'pending';
      setState(previous=>previous.status===status&&previous.error===current.error?previous:{status,error:current.error});
    };
    poll();const timer=window.setInterval(poll,200);
    return()=>{retired=true;window.clearInterval(timer);};
  },[host]);
  return state;
}

export function InspectorGroup({title,children}:{title:string;children:React.ReactNode}){
  return <details className="cad-demo__group" open>
    <summary><span>{title}</span><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m5 6 3 3 3-3"/></svg></summary>
    <div className="cad-demo__group-content">{children}</div>
  </details>;
}
export function NumericField({label,ariaLabel,value,min,max,step,unit,onChange}:{
  label:string;ariaLabel:string;value:number;min:number;max:number;step:number;unit:'mm'|'°';onChange:(value:number)=>void;
}){
  return <label className="cad-demo__field"><span>{label}</span><span className="cad-demo__number">
    <input aria-label={ariaLabel} type="number" min={min} max={max} step={step} value={Number.isNaN(value)?'':value}
      onChange={event=>onChange(event.currentTarget.valueAsNumber)}/><span className="cad-demo__unit" aria-hidden="true">{unit}</span>
  </span></label>;
}
type InspectorProps={host:ModelHost|null;error:string|null;controls:React.ReactNode;onReset:()=>void;onRetry?:()=>string|void};
function Inspector({host,error,controls,onReset,onRetry}:InspectorProps){
  const state=useHostState(host),[retryError,setRetryError]=React.useState<string|null>(null);
  React.useEffect(()=>{setRetryError(null);},[host,state.status,state.error]);
  const retry=()=>{
    try{const failure=onRetry?.();setRetryError(typeof failure==='string'?failure:null);}
    catch(cause){setRetryError(exampleErrorMessage(cause));}
  };
  const message=error??retryError??state.error;
  const status=message?'failed':state.status;
  const statusText={starting:'Connecting',pending:'Updating',ready:'Ready',failed:'Error',disposed:'Closed'}[status];
  return <aside className="cad-demo__inspector" aria-label="Model inspector">
    <header className="cad-demo__inspector-header"><span>Inspector</span><span className="cad-demo__status" data-state={status} role="status" aria-label="Model status"><span aria-hidden="true"/>{statusText}</span></header>
    <div className="cad-demo__controls">{controls}</div>
    {message&&<p className="cad-demo__error" role="alert">{message}</p>}
    <footer className="cad-demo__inspector-footer">{status==='failed'&&onRetry&&<button className="cad-demo__reset" type="button" onClick={retry}>Retry</button>}<button className="cad-demo__reset" type="button" onClick={onReset}>Reset</button></footer>
  </aside>;
}
export function ExampleShell({canvas,host,error,controls,onReset,onRetry,children,documentName="Bracket"}:{
  canvas:React.RefObject<HTMLCanvasElement|null>;host:ModelHost|null;error:string|null;controls:React.ReactNode;onReset:()=>void;children:React.ReactNode;documentName?:string;onRetry?:()=>string|void;
}){
  return <main className="cad-demo">
    <section className="cad-demo__workspace" aria-label="Model workspace">
      <header className="cad-demo__workspace-header"><span className="cad-demo__brand">CAD<span>React</span></span><span className="cad-demo__document">{documentName}</span></header>
      <div className="cad-demo__viewport"><div className="cad-demo__canvas-frame">
        <canvas ref={canvas} width={1000} height={700} tabIndex={0} aria-label={`CAD ${documentName.toLowerCase()}`}/>
      </div></div>
      {children}
    </section>
    <Inspector host={host} error={error} controls={controls} onReset={onReset} onRetry={onRetry}/>
  </main>;
}
