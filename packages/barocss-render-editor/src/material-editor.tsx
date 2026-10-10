import {useMemo,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {compileMeshMaterial,type MeshMaterialUniform} from '@barocss/gpu';
import type {RenderMaterialSession,RenderMaterialSessionSnapshot} from './material-session.js';
import {normalizeRenderEditorError,type RenderEditorError} from './errors.js';

export interface MaterialEditorProps {session:RenderMaterialSession;onError?:(error:RenderEditorError)=>void;disabled?:boolean;preview?:ReactNode}
interface RawBinding {accepted:RenderMaterialSessionSnapshot['accepted'];output:string;values:Map<string,string>}
const numberText=(value:number)=>Object.is(value,-0)?'-0':String(value);
const numeric=(text:string)=>/^[\t\n\v\f\r ]*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[\t\n\v\f\r ]*$/.test(text)&&Number.isFinite(Number(text))?Number(text):NaN;
const fingerprint=(values:Readonly<Record<string,number>>)=>JSON.stringify(Object.entries(values).map(([name,value])=>[name,!Number.isFinite(value)?numberText(value):Object.is(value,-0)?'-0':value]));
function readBinding(snapshot:RenderMaterialSessionSnapshot):RawBinding {return {accepted:snapshot.accepted,output:fingerprint(snapshot.draftUniforms),values:new Map(Object.entries(snapshot.draftUniforms).map(([name,value])=>[name,numberText(value)]))};}

/** Material authoring with accepted CPU inspection and an optional host-owned preview. */
export function MaterialEditor({session,onError,disabled=false,preview}:MaterialEditorProps) {
  const snapshot=useSyncExternalStore(session.subscribe,session.getSnapshot,session.getSnapshot);
  const [stored,setStored]=useState(()=>readBinding(snapshot)),binding=useRef(stored),previousDirty=useRef(snapshot.dirty),[error,setError]=useState<RenderEditorError|null>(null);
  const compiled=useMemo(()=>compileMeshMaterial(snapshot.draftSource),[snapshot.draftSource]);
  const restored=previousDirty.current&&!snapshot.dirty;previousDirty.current=snapshot.dirty;
  const changed=stored.accepted!==snapshot.accepted||stored.output!==fingerprint(snapshot.draftUniforms)||restored;
  const current=changed?readBinding(snapshot):stored;
  if(changed){binding.current=current;setStored(current);setError(null);}
  const publish=(value:RawBinding)=>{binding.current=value;setStored(value);};
  const locked=disabled||snapshot.disposed;
  const report=(cause:unknown)=>{const actual=normalizeRenderEditorError(cause);if(actual!==cause)Object.defineProperty(actual,'cause',{value:cause,configurable:true});setError(actual);onError?.(actual);};
  const changeUniform=(name:string,text:string)=>{
    if(disabled||session.getSnapshot().disposed||text.length>256)return;
    const before=session.getSnapshot(),values=new Map(binding.current.values);values.set(name,text);
    const overrides=Object.fromEntries([...Object.entries(before.draftUniforms).filter(([key])=>key!==name),[name,numeric(text)]]);
    const next={...binding.current,output:fingerprint(overrides),values};publish(next);
    try{session.setDraftUniforms(overrides);setError(null);}catch(cause){publish({...next,output:fingerprint(session.getSnapshot().draftUniforms)});report(cause);}
  };
  const apply=()=>{if(disabled||session.getSnapshot().disposed)return;try{session.commitPrepared(session.prepareDraft());setError(null);}catch(cause){report(cause);}};
  const discard=()=>{if(disabled||session.getSnapshot().disposed)return;try{session.discardDraft();publish(readBinding(session.getSnapshot()));setError(null);}catch(cause){report(cause);}};
  const defaults=()=>{if(disabled||session.getSnapshot().disposed)return;try{session.setDraftUniforms({});publish(readBinding(session.getSnapshot()));setError(null);}catch(cause){report(cause);}};
  const uniforms:readonly MeshMaterialUniform[]=compiled.ok?compiled.material.uniforms:[];
  const unlisted=Object.keys(snapshot.draftUniforms).filter(name=>!uniforms.some(uniform=>uniform.name===name));
  const rawTextDirty=[...current.values].some(([name,text])=>!Object.hasOwn(snapshot.draftUniforms,name)||text!==numberText(snapshot.draftUniforms[name]));
  const hasPreview=preview!==undefined&&preview!==null&&preview!==false;
  const rgb=snapshot.sample.linearRGB,shaderId=snapshot.sample.material.shaderId;
  return <section className={`re-material-editor${hasPreview?' re-material-editor--preview':''}`} aria-label="Material editor">
    <header className="re-material-toolbar"><strong>Opaque fragment material</strong><span>{snapshot.dirty?'Draft changes':'Applied'}</span><button type="button" data-testid="material-apply" disabled={locked||!snapshot.dirty} onClick={apply}>Apply</button><button type="button" data-testid="material-discard" disabled={locked||(!snapshot.dirty&&!rawTextDirty)} onClick={discard}>Discard</button></header>
    <div className="re-material-workspace">
      <section className="re-material-source" aria-label="Material source editor"><div className="re-material-heading"><h2>Source</h2><span>{snapshot.draftSource===snapshot.accepted.shaderSource?'Applied':'Draft'}</span></div><textarea data-testid="material-source" aria-label="Material source" value={snapshot.draftSource} disabled={locked} spellCheck={false} onChange={event=>{if(disabled||session.getSnapshot().disposed)return;try{session.setDraftSource(event.target.value);setError(null);}catch(cause){report(cause);}}}/></section>
      {hasPreview&&<section className="re-material-preview" aria-label="Material preview">{preview}</section>}
      <aside className="re-material-inspector" aria-label="Material inspection">
        <section aria-label="Material uniforms"><div className="re-material-heading"><h2>Uniforms</h2><button type="button" data-testid="material-use-defaults" disabled={locked||Object.keys(snapshot.draftUniforms).length===0} onClick={defaults}>Use defaults</button></div>
          {!compiled.ok?<p className="re-material-caption">Correct Source to inspect declarations. Uniform overrides and field drafts are kept.</p>:uniforms.length===0?<p className="re-material-caption">No declared uniforms.</p>:uniforms.map(uniform=>{
            const supplied=Object.hasOwn(snapshot.draftUniforms,uniform.name),text=current.values.get(uniform.name)??numberText(supplied?snapshot.draftUniforms[uniform.name]:uniform.default),value=numeric(text);
            const invalid=!Number.isFinite(value)||value<uniform.min||value>uniform.max;
            const id=`material-uniform-${uniform.name}`;
            return <div className="re-material-uniform" key={uniform.name}><label htmlFor={id}>{uniform.name}<span>{supplied?'Override':'Default'}</span></label><input id={id} data-testid={id} aria-label={`Uniform ${uniform.name}`} type="text" inputMode="decimal" maxLength={256} disabled={locked} value={text} aria-invalid={invalid} aria-describedby={`${id}-range`} onChange={event=>changeUniform(uniform.name,event.target.value)}/><p id={`${id}-range`}>{invalid?'Enter a finite value in ':''}{numberText(uniform.min)} to {numberText(uniform.max)} · default {numberText(uniform.default)}</p></div>;
          })}
          {compiled.ok&&unlisted.length>0&&<p className="re-material-caption">Overrides absent from Source: {unlisted.join(', ')}. Correct Source or Use defaults.</p>}
        </section>
        <section className="re-material-sample" aria-label="Accepted CPU sample"><div className="re-material-heading"><h2>CPU inspection</h2><span>Applied sample</span></div><dl><dt>Shader ID</dt><dd data-testid="material-shader-id">{shaderId}</dd>{rgb.map((value,index)=><div key={index}><dt>Linear {['R','G','B'][index]}</dt><dd data-testid={`material-sample-${['r','g','b'][index]}`}>{numberText(value)}</dd></div>)}</dl><div className="re-material-swatch" aria-label="CPU sample color" style={{backgroundColor:`color(srgb-linear ${rgb.join(' ')})`}}/><p className="re-material-caption">CSS color · srgb-linear</p></section>
        <section className="re-material-diagnostics" aria-label="Material diagnostics" data-testid="material-diagnostics"><div className="re-material-heading"><h2>Diagnostics</h2><span>{snapshot.diagnostics.length}</span></div>{snapshot.diagnostics.length>0?<ul>{snapshot.diagnostics.map((diagnostic,index)=><li key={index}>{diagnostic.range?`Line ${diagnostic.range.line}, column ${diagnostic.range.column}: `:''}{diagnostic.message}</li>)}</ul>:<p className="re-material-caption">{snapshot.dirty?'Apply to inspect the complete draft.':'No material errors.'}</p>}{error&&<div className="re-material-error" role="alert"><p>Material changes could not apply. The applied CPU sample is kept. See details.</p><details><summary>Details</summary><pre>{error.code}: {error.message}</pre></details></div>}</section>
      </aside>
    </div>
  </section>;
}
