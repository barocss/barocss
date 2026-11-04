import * as React from 'react';
import {Part} from '../src/index.js';
import {type ModelHost,type EnginePort,type MassPolicy} from '../src/engine.js';
import {ExistingViewerHost} from '../src/viewer.js';
import {RevolvedSection} from './RevolvedSection.js';
import {connectHost} from './connect-host.js';
import {ExampleShell,InspectorGroup,NumericField} from './ExampleShell.js';

/** The consumer supplies its existing client and provenance-aware mass merger.
 * It must grant this host exclusive evaluation use of the client. No Worker is created here. */
export function RevolveApp({engine,massPolicy,onHost}: {
  engine:EnginePort;massPolicy:MassPolicy;onHost?:(host:ModelHost|null)=>void;
}) {
  const canvas=React.useRef<HTMLCanvasElement>(null);
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
  return <ExampleShell documentName="Revolve" canvas={canvas} host={host} error={error} onReset={()=>setAngle(90)} controls={
    <InspectorGroup title="Revolve"><NumericField label="Angle" ariaLabel="Revolve Angle" value={angle} min={1} max={360} step={1} unit="°" onChange={setAngle}/></InspectorGroup>
  }>
    {host&&<Part admission="synchronous" lifecycle={host}><RevolvedSection angle={angle}/></Part>}
  </ExampleShell>;
}
