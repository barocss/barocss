import * as React from 'react';
import {Part} from '../src/index.js';
import {type ModelHost,type EnginePort,type MassPolicy} from '../src/engine.js';
import {ExistingViewerHost} from '../src/viewer.js';
import {TransformedBracket} from './TransformedBracket.js';
import {connectHost} from './connect-host.js';
import {ExampleShell,InspectorGroup,NumericField} from './ExampleShell.js';

/** The consumer supplies its existing client and provenance-aware mass merger.
 * It must grant this host exclusive evaluation use of the client. No Worker is created here. */
export function TransformApp({engine,massPolicy,onHost}: {
  engine:EnginePort;massPolicy:MassPolicy;onHost?:(host:ModelHost|null)=>void;
}) {
  const canvas=React.useRef<HTMLCanvasElement>(null);
  const [dx,setDx]=React.useState(30);
  const [angle,setAngle]=React.useState(90);
  const [host,setHost]=React.useState<ModelHost|null>(null);
  const [error,setError]=React.useState<string|null>(null);
  React.useEffect(()=>{
    let retired=false;let owned:ModelHost|null=null;
    void ExistingViewerHost.create(canvas.current!).then(sink=>{
      if(retired){sink.dispose();return;}
      owned=connectHost(engine,massPolicy,sink);
      setHost(owned);onHost?.(owned);
    }).catch(cause=>{
      try { owned?.dispose(); } catch { /* Keep the original startup error. */ }
      owned=null;
      if(!retired){setHost(null);setError(String(cause));}
    });
    return()=>{retired=true;owned?.dispose();onHost?.(null);};
  },[engine,massPolicy,onHost]);
  return <ExampleShell canvas={canvas} host={host} error={error} onReset={()=>{setDx(30);setAngle(90);}} controls={<>
    <InspectorGroup title="Translation"><NumericField label="X" ariaLabel="Translation X" value={dx} min={30} max={50} step={20} unit="mm" onChange={setDx}/></InspectorGroup>
    <InspectorGroup title="Rotation"><NumericField label="Z" ariaLabel="Rotation Z" value={angle} min={90} max={180} step={90} unit="°" onChange={setAngle}/></InspectorGroup>
  </>}>
    {host&&<Part admission="synchronous" lifecycle={host}><TransformedBracket dx={dx} angle={angle}/></Part>}
  </ExampleShell>;
}
