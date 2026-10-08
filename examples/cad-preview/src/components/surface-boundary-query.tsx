import type {EditorController,EditorSnapshot} from '../editor-controller';
import type {Surface} from '@barocss/cad';
import {surfaceBoundaries} from '../surface-boundary-query';
import {refinementDomain} from '../surface-refinement';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Field,FieldLabel,FieldDescription} from './ui/field';
const scalar=(n:number)=>Object.is(n,-0)?'-0':String(n);
export function SurfaceBoundaryQuery({controller,state,surface}:{controller:EditorController;state:EditorSnapshot;surface:Surface}){
 const form=state.boundaryQueryForm,result=state.boundaryQuery,variesU=form.boundary==='v-min'||form.boundary==='v-max',decreasing=form.boundary==='v-max'||form.boundary==='u-min';
 return <details><summary className="section-heading">BOUNDARY EVALUATION <span>Original orientation</span></summary>
  <div className="refinement-axes" role="group" aria-label="Original Surface boundary">{surfaceBoundaries.map(boundary=><Button key={boundary} size="sm" variant={boundary===form.boundary?'secondary':'outline'} aria-pressed={boundary===form.boundary} onClick={()=>controller.stageBoundaryQuery('boundary',boundary)}>{boundary}</Button>)}</div>
  <Field><FieldLabel htmlFor="boundary-query-parameter">Boundary parameter</FieldLabel><Input id="boundary-query-parameter" inputMode="decimal" value={form.parameter} onChange={e=>controller.stageBoundaryQuery('parameter',e.target.value)}/><FieldDescription>Original {variesU?'U':'V'} domain [{refinementDomain(surface,variesU?'u':'v').map(scalar).join(', ')}] · {decreasing?'decreasing':'increasing'} correspondence.</FieldDescription></Field>
  <Button size="sm" className="wide" disabled={!!state.previewSurface||!!state.previewPlacement} onClick={()=>controller.evaluateBoundaryQuery()}>Evaluate native boundary</Button>
  {state.boundaryQueryError&&<p role="alert" className="property-error">{state.boundaryQueryError}</p>}
  {result&&<div role="status"><p className="transform-note">{result.objectId} · {result.surfaceId} · source0 · accepted revision {result.acceptedRevision}<br/>{result.boundary} t={scalar(result.parameter)} → U={scalar(result.surfaceParameters.u)}, V={scalar(result.surfaceParameters.v)} · {result.orientation}</p><dl className="reference-details">{([['Point · local XYZ mm',result.pointMM],['Tangent · mm / parameter',result.tangentMMPerParameter],['Signed Surface partial',result.signedSurfacePartialMMPerParameter]] as const).map(([label,vector])=><div key={label}><dt>{label}</dt><dd>{vector.map(scalar).join(', ')}</dd></div>)}</dl></div>}
  <FieldDescription>Accepted geometric parameter boundary. No topological edge, trim or wire identity. Pending edits stay pending. Local XYZ; placement is not applied.</FieldDescription>
 </details>;
}
