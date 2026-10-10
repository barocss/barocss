import { useEffect, useId, useRef, useState } from 'react';
import { createCadGeometryReference } from '@barocss/cad';
import { CadEditorError } from '../types.js';
import type { CadEditorSession, CadEditorExportOptions, CadEditorExportResult } from '../types.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';
import { useCadEditorSnapshot } from './use-session.js';

export interface CadEditorExportReviewProps {
  session: CadEditorSession;
  onReview?: (result: CadEditorExportResult | null) => void;
  onError?: (error: CadEditorError) => void;
  onDownload: (result: CadEditorExportResult, kind: 'iges' | 'report') => void;
}
interface RawOptions {
  session: CadEditorSession; documentId: string;
  modelId: string; bodies: Record<string, {selected:boolean;outputId:string}>;
}
interface Capture {
  session: CadEditorSession; generation: number; documentId: string; revision: number;
  rawKey: string; result: CadEditorExportResult;
}
function sameData(left:unknown,right:unknown):boolean {
  if(Object.is(left,right))return true;
  if(!left || !right || typeof left!=='object' || typeof right!=='object')return false;
  const keys=Reflect.ownKeys(left),other=Reflect.ownKeys(right);
  return keys.length===other.length && keys.every(key=>other.includes(key) && sameData(Reflect.get(left,key),Reflect.get(right,key)));
}
function details(error: CadEditorError): string {
  const messages=[error.message];let cause:unknown=error.cause;
  for(let i=0;i<6 && cause instanceof Error;i++){messages.push(cause.message);cause=cause.cause;}
  return messages.join('\n');
}
function guidance(error: CadEditorError): string {
  if(error.context.field==='export-download')return 'Cannot download this capture. Review the export again and retry.';
  if(error.code==='STALE')return 'The document or export options changed. Review the export again.';
  const text=details(error);
  if(/ASCII|distinct|identity|output.*ID|identifier/i.test(text))return 'Use different ASCII model and output IDs, each from 1 to 48 characters.';
  if(/selection|select/i.test(text))return 'Select one to sixteen original bodies and review again.';
  return 'Cannot review this export. Check the selected bodies and output IDs.';
}

export function CadEditorExportReview(props:CadEditorExportReviewProps) {
  const {session}=props,snapshot=useCadEditorSnapshot(session),document=snapshot.accepted.document;
  const propsRef=useRef(props);propsRef.current=props;
  const id=useId();
  const defaults=():RawOptions=>({session,documentId:document.documentId,modelId:document.documentId+'_iges',
    bodies:Object.fromEntries(document.bodies.map(body=>[body.id,{selected:false,outputId:body.id}]))});
  const [raw,setRaw]=useState<RawOptions>(defaults);
  const [open,setOpen]=useState(false);
  const [capture,setCapture]=useState<Capture|null>(null);
  const [error,setError]=useState<CadEditorError|null>(null);
  const currentRaw=raw.session===session && raw.documentId===document.documentId ? raw : defaults();
  const rows=document.bodies.map(body=>({body,value:currentRaw.bodies[body.id]??{selected:false,outputId:body.id}}));
  const rawKey=JSON.stringify({modelId:currentRaw.modelId,bodies:rows.map(row=>[row.body.id,row.value.selected,row.value.outputId])});
  const busy=snapshot.candidate!==null || snapshot.disposed;
  const currentCapture=capture!==null && capture.session===session && capture.generation===snapshot.generation
    && capture.documentId===document.documentId && capture.revision===document.revision && capture.rawKey===rawKey
    && !snapshot.disposed ? capture : null;
  function notify(result:CadEditorExportResult|null) {
    try{propsRef.current.onReview?.(result===null?null:structuredClone(result));}
    catch(cause){report(new CadEditorError('LIFECYCLE','Export review callback failed.',{field:'document-export'},cause));}
  }
  function report(cause:unknown) {
    const diagnostic=cause instanceof CadEditorError?cause:new CadEditorError('NATIVE','Native document export review failed.',{field:'document-export'},cause);
    setError(diagnostic);try{propsRef.current.onError?.(diagnostic);}catch{/* Host diagnostics do not change accepted export data. */}
  }
  useEffect(()=>{setCapture(null);setError(null);notify(null);},[session,snapshot.generation,document.documentId,document.revision,rawKey,snapshot.disposed]);
  useEffect(()=>()=>{try{propsRef.current.onReview?.(null);}catch{/* Owned CPU capture is invalidated on unmount. */}},[session]);
  function changeModel(value:string){setRaw({...currentRaw,modelId:value});}
  function changeBody(bodyId:string,change:Partial<RawOptions['bodies'][string]>){setRaw({...currentRaw,
    bodies:{...currentRaw.bodies,[bodyId]:{...(currentRaw.bodies[bodyId]??{selected:false,outputId:bodyId}),...change}}});}
  function options():CadEditorExportOptions {
    const current=session.getSnapshot();
    return {target:'iges-5.3-ascii',exportModelId:currentRaw.modelId,
      selections:current.accepted.document.bodies.filter(body=>currentRaw.bodies[body.id]?.selected).map(body=>({
        reference:createCadGeometryReference(current.accepted,{bodyId:body.id}).reference,outputId:currentRaw.bodies[body.id].outputId}))};
  }
  function review() {
    try {
      const current=session.getSnapshot();
      if(current.candidate || current.disposed)throw new CadEditorError('INPUT','Wait for the current candidate before reviewing export.',{field:'document-export'});
      const result=session.exportAccepted(options());
      setCapture({session,generation:current.generation,documentId:current.accepted.document.documentId,
        revision:current.accepted.document.revision,rawKey,result});setError(null);notify(result);
    } catch(cause){report(cause);}
  }
  function download(kind:'iges'|'report') {
    try {
      const current=session.getSnapshot();
      if(current.candidate)throw new CadEditorError('INPUT','Wait for the current candidate before downloading export.',{field:'document-export'});
      if(!currentCapture || currentCapture.session!==session || currentCapture.generation!==current.generation
        || currentCapture.documentId!==current.accepted.document.documentId || currentCapture.revision!==current.accepted.document.revision
        || currentCapture.rawKey!==rawKey || current.disposed)throw new CadEditorError('STALE','The captured export is no longer current.',{field:'document-export'});
      const requested=options();
      if(!sameData(requested,currentCapture.result.options))throw new CadEditorError('STALE','The qualified export references or IDs changed.',{field:'document-export'});
      propsRef.current.onDownload(structuredClone(currentCapture.result),kind);
    } catch(cause){report(cause);}
  }
  const result=currentCapture?.result,selectedCount=rows.filter(row=>row.value.selected).length;
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button type="button" variant="ghost" size="sm" disabled={busy} data-testid="export-iges-trigger">Export IGES</Button></DialogTrigger>
    <DialogContent className="cad-editor-help-dialog cad-editor-export-dialog" data-testid="export-review-dialog">
      <DialogHeader><DialogTitle>Review IGES export</DialogTitle><DialogDescription>Choose objects and review the export before downloading.</DialogDescription></DialogHeader>
      <div className="cad-editor-export-body">
        <p>IGES 5.3 ASCII · mm</p>
        {error && <p role="alert" className="cad-editor-error">{guidance(error)}</p>}
        <fieldset className="cad-editor-export-selections"><legend>Objects to export</legend>
          {rows.map(({body,value})=>{
            const binding=snapshot.accepted.bodyBindings.find(value=>value.bodyId===body.id)!;
            return <div className="cad-editor-export-object" key={body.id}>
              <label className="cad-editor-export-choice"><input type="checkbox" data-testid={'export-body-'+body.id} disabled={busy}
                checked={value.selected} onChange={event=>changeBody(body.id,{selected:event.target.checked})}/><span>{body.name}</span>
                <small>{snapshot.displayBodyIds.includes(body.id)?'Displayed':'Hidden'} · {binding.geometryKind==='surface'?'Surface':'Curve'}</small></label>
            </div>;
          })}
        </fieldset>
        <details data-testid="export-review-naming"><summary>Export naming</summary>
          <div className="cad-editor-export-field"><Label htmlFor={id+'-model'}>Export model ID</Label><Input id={id+'-model'}
            data-testid="export-model-id" type="text" value={currentRaw.modelId} disabled={busy} onChange={event=>changeModel(event.target.value)}/></div>
          {rows.filter(row=>row.value.selected).map(({body,value})=><div className="cad-editor-export-object" key={body.id}>
            <p>{body.name}</p><p className="cad-editor-export-identity">Asset {body.assetId} · Original geometry {body.geometryId}</p>
            <div className="cad-editor-export-field"><Label htmlFor={id+'-'+body.id}>Output ID</Label>
              <Input id={id+'-'+body.id} data-testid={'export-output-id-'+body.id} type="text" value={value.outputId} disabled={busy || !value.selected}
                onChange={event=>changeBody(body.id,{outputId:event.target.value})}/></div>
          </div>)}
        </details>
        <p>{selectedCount} selected · {rows.length-selectedCount} unselected</p>
        {result && <section data-testid="export-review-result" className="cad-editor-export-result">
          <h3>Ready to download</h3>
          <p data-testid="export-review-loss-summary">Geometry only. Source and history are excluded.</p>
          {result.report.directoryLabels.truncatedCount>0 && <p>Names are shortened in IGES.</p>}
          {result.report.directoryLabels.collisions.length>0 && <p>Some shortened names repeat. Download the loss report to keep the full name mappings.</p>}
          <p>Save the native document separately to keep editing.</p>
          <dl><dt>Selected objects</dt><dd data-testid="export-review-selected">{result.report.selectedObjectCount}</dd>
            <dt>Unselected bodies</dt><dd data-testid="export-review-unselected">{result.report.unselectedBodyIds.length}</dd>
            <dt>Output bytes</dt><dd data-testid="export-review-bytes">{result.report.outputBytes}</dd></dl>
          <details data-testid="export-review-details"><summary>Export details</summary>
          <p data-testid="export-review-revision">Accepted revision {result.report.documentRevision}</p>
          <p>Authored XYZ · no axis conversion</p>
          <p data-testid="export-review-signed-zero">Original native -0 occurrences: {result.report.signedZeroNormalization.nativeOccurrences}. IGES parameter -0 normalized to +0: {result.report.signedZeroNormalization.parameterOccurrences}. Original native bits stay unchanged.</p>
          <p data-testid="export-review-truncated">Directory labels use at most {result.report.directoryLabels.maximumCharacters} characters. Truncated labels: {result.report.directoryLabels.truncatedCount}.</p>
          <p data-testid="export-review-collisions">Label collisions: {result.report.directoryLabels.collisions.length}. Keep the full-ID report with the IGES file.</p>
          <h4>Original geometry and output mapping</h4>
          {result.report.mappings.map(mapping=><section key={mapping.reference.bodyId} data-testid={'export-mapping-'+mapping.reference.bodyId} className="cad-editor-export-mapping">
            <p>{document.bodies.find(body=>body.id===mapping.reference.bodyId)?.name??mapping.reference.bodyId} → {mapping.outputId} · {mapping.geometryKind} entity {mapping.entity}</p>
            <p>Asset {mapping.reference.assetId} revision {mapping.reference.assetRevision} · Geometry {mapping.reference.geometryId}</p>
            <p>Directory {mapping.directoryPointer} · Parameter {mapping.parameterPointer} · Label {mapping.directoryLabel}{mapping.labelTruncated?' (truncated)':''}</p>
            <p>Domain U [{mapping.domainU.join(', ')}]{mapping.domainV===null?'':' · V ['+mapping.domainV.join(', ')+']'}</p>
            {mapping.labelCollisionOutputIds.length>0 && <p>Collision output IDs: {mapping.labelCollisionOutputIds.join(', ')}</p>}
          </section>)}
          <details><summary>Actual preservation, omissions and unsupported data</summary>
            <h4>Preserved</h4><ul>{result.report.preserved.map(item=><li key={item}>{item}</li>)}</ul>
            <h4>Omitted</h4><ul>{result.report.omitted.map(item=><li key={item}>{item}</li>)}</ul>
            <h4>Unsupported</h4><ul>{result.report.unsupported.map(item=><li key={item}>{item}</li>)}</ul>
            <p>Writer geometry loss: {result.writerReport.geometryLoss}. This does not include authored source, original full identities or authoring history.</p>
          </details>
          <p>Geometric validity: {result.report.geometricValidity}. Topology certified: {String(result.report.topologyCertified)}. Solid: {String(result.report.solid)}.</p>
          <details><summary>Full native loss and identity report</summary><pre>{JSON.stringify(result.report,null,2)}</pre></details>
          </details>
        </section>}
      </div>
      <DialogFooter>
        <Dialog><DialogTrigger asChild><Button type="button" variant="ghost" data-testid="export-review-help" className="cad-editor-export-help">Help</Button></DialogTrigger>
          <DialogContent className="cad-editor-help-dialog" data-testid="export-review-help-dialog">
            <DialogHeader><DialogTitle>IGES export review</DialogTitle><DialogDescription>Accepted original geometry and explicit loss review.</DialogDescription></DialogHeader>
            <p>Review export creates and captures the IGES file and its full loss report. This step reconstructs the selected geometry and writes the output. Download uses the current capture.</p>
            <p>Choose 1–16 original canonical bodies by full document/asset/body/geometry references. Hidden and read-only bodies can be exported. Writer Source0 degree 1–5 support is independent of Viewer display support.</p>
            <p>Use distinct model/output ASCII IDs beginning with a letter or underscore and containing only letters, digits, underscores or hyphens, from 1 to 48 characters. IDs are not silently repaired. IGES directory labels have 8 characters, so truncation and collisions need the full-ID sidecar.</p>
            <p>IGES carries Curve 126 and Surface 128 geometry in authored XYZ/mm with no axis or unit conversion and no mesh export. The native report gives exact domains, directory/parameter mapping and output limits: 2 MiB, 80 ASCII columns and LF records.</p>
            <p>Negative zero is normalized to positive zero in exported numeric fields; original native bits remain intact. Geometry loss none does not mean full authored-data preservation. Original native source, canonical identities, unselected objects and authoring history are not embedded in IGES.</p>
            <p>Save the native document separately. IGES and report downloads do not mark the native document downloaded, clear drafts or change its dirty/capture state. STEP and feature-graph exchange are unsupported; GLB capability is an external derived bridge, not this writer.</p>
            <p>Changed export options or accepted native content invalidates the capture. Selection, camera or display-only changes keep a current capture. Failed same-current review keeps previous valid bytes; changed options require a new Review. Downloads recheck the current captured binding and never recompute export.</p>
            <p>Closing Help preserves all fields and returns focus to Help. Close or Escape returns to Export IGES. This exchange is not certified topology, Solid, manufacturing or IGES reimport/equivalence evidence.</p>
            {error && <details><summary>Technical error details</summary><pre>{details(error)}</pre></details>}
            {result && <details><summary>Actual native capabilities and quality</summary><pre>{JSON.stringify({capabilities:result.report.capabilities,quality:result.report.quality,limits:result.report.limits},null,2)}</pre></details>}
            <DialogClose asChild><Button type="button" variant="outline" data-testid="export-review-help-close" className="cad-editor-export-close">Close help</Button></DialogClose>
          </DialogContent>
        </Dialog>
        <DialogClose asChild><Button type="button" variant="outline" data-testid="export-review-close" className="cad-editor-export-close">Close</Button></DialogClose>
        <Button type="button" variant="outline" disabled={busy} data-testid="export-review-confirm" onClick={review}>Review export</Button>
        <Button type="button" disabled={busy || !currentCapture} data-testid="export-review-download-iges" onClick={()=>download('iges')}>Download IGES</Button>
        <Button type="button" variant="outline" disabled={busy || !currentCapture} data-testid="export-review-download-report" onClick={()=>download('report')}>Download loss report</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
