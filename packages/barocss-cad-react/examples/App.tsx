import * as React from 'react';
import {Part} from '../src/index.js';
import {type ModelHost,type EnginePort,type MassPolicy} from '../src/engine.js';
import {ExistingViewerHost} from '../src/viewer.js';
import {Bracket} from './Bracket.js';
import {connectHost} from './connect-host.js';
import {ExampleShell,InspectorGroup,NumericField,exampleErrorMessage} from './ExampleShell.js';

/** The consumer supplies its existing client and provenance-aware mass merger.
 * It must grant this host exclusive evaluation use of the client. No Worker is created here. */
export function App({engine,massPolicy,onHost,onRestart}: {
  engine:EnginePort;massPolicy:MassPolicy;onHost?:(host:ModelHost|null)=>void;onRestart?:()=>boolean;
}) {
  const canvas=React.useRef<HTMLCanvasElement>(null);
  const [width,setWidth]=React.useState(80);
  const [host,setHost]=React.useState<ModelHost|null>(null);
  const [error,setError]=React.useState<string|null>(null);
  const [,refresh]=React.useReducer((value:number)=>value+1,0);
  const retry=host&&onRestart?()=>{
    try{
      if(!onRestart())return 'Worker restart failed. Your current model remains open.';
      setError(null);refresh();
    }catch(cause){return exampleErrorMessage(cause);}
  }:undefined;
  React.useEffect(()=>{
    let retired=false;let owned:ModelHost|null=null;
    void ExistingViewerHost.create(canvas.current!).then(sink=>{
      if(retired){sink.dispose();return;}
      owned=connectHost(engine,massPolicy,sink);
      setHost(owned);onHost?.(owned);
    }).catch(cause=>{
      try { owned?.dispose(); } catch { /* Keep the original startup error. */ }
      owned=null;
      if(!retired){setHost(null);setError(exampleErrorMessage(cause));}
    });
    return()=>{retired=true;owned?.dispose();onHost?.(null);};
  },[engine,massPolicy,onHost]);
  return <ExampleShell canvas={canvas} host={host} error={error} onRetry={retry} onReset={()=>setWidth(80)} controls={
    <InspectorGroup title="Dimensions"><NumericField label="Width" ariaLabel="Width" value={width} min={80} max={100} step={20} unit="mm" onChange={setWidth}/></InspectorGroup>
  }>
    {host&&<Part admission="synchronous" lifecycle={host}><Bracket width={width}/></Part>}
  </ExampleShell>;
}
