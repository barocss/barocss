import * as React from 'react';
import {Part} from '../src/index.js';
import {type ModelHost,type EnginePort,type MassPolicy} from '../src/engine.js';
import {ExistingViewerHost} from '../src/viewer.js';
import {SegmentedProfiledPlate} from './SegmentedProfiledPlate.js';
import {connectHost} from './connect-host.js';
import {ExampleShell,InspectorGroup,NumericField,exampleErrorMessage} from './ExampleShell.js';

/** The application supplies its existing client and provenance-aware mass merger. */
export function ProfileApp({engine,massPolicy,onHost,onRestart}:{
  engine:EnginePort;massPolicy:MassPolicy;onHost?:(host:ModelHost|null)=>void;onRestart?:()=>boolean;
}){
  const canvas=React.useRef<HTMLCanvasElement>(null);
  const [radius,setRadius]=React.useState(6);
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
      owned=connectHost(engine,massPolicy,sink);setHost(owned);onHost?.(owned);
    }).catch(cause=>{
      try{owned?.dispose();}catch{/* Retain the original startup error. */}
      owned=null;if(!retired){setHost(null);setError(exampleErrorMessage(cause));}
    });
    return()=>{retired=true;owned?.dispose();onHost?.(null);};
  },[engine,massPolicy,onHost]);
  return <ExampleShell documentName="Profile" canvas={canvas} host={host} error={error} onRetry={retry} onReset={()=>setRadius(6)} controls={
    <InspectorGroup title="Plate"><NumericField label="Radius" ariaLabel="Profile Radius" value={radius} min={1} max={12} step={1} unit="mm" onChange={setRadius}/></InspectorGroup>
  }>
    {host&&<Part admission="synchronous" lifecycle={host}><SegmentedProfiledPlate radius={radius}/></Part>}
  </ExampleShell>;
}
