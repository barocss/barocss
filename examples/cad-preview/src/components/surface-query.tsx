import type {EditorController,EditorSnapshot} from '../editor-controller';
import type {Surface} from '@barocss/cad';
import {refinementDomain} from '../surface-refinement';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Field,FieldLabel,FieldDescription} from './ui/field';
const scalar=(n:number)=>Object.is(n,-0)?'-0':String(n);
export function SurfaceQuery({controller,state,surface}:{controller:EditorController;state:EditorSnapshot;surface:Surface}){
 const result=state.surfaceQuery;
 return <details className="surface-query"><summary className="section-heading">NATIVE EVALUATION <span>Original U/V</span></summary>
  <FieldDescription>Accepted original Surface only. Local XYZ in mm; U/V are dimensionless original parameters. Pending edits remain pending.</FieldDescription>
  {(['u','v'] as const).map(axis=><Field key={axis}><FieldLabel htmlFor={'query-'+axis}>Query {axis.toUpperCase()}</FieldLabel><Input id={'query-'+axis} inputMode="decimal" value={state.surfaceQueryForm[axis]} onChange={e=>controller.stageSurfaceQuery(axis,e.target.value)}/><FieldDescription>Original {axis.toUpperCase()} ∈ [{refinementDomain(surface,axis).map(scalar).join(', ')}]</FieldDescription></Field>)}
  <Button size="sm" className="wide" disabled={!!state.previewSurface||!!state.previewPlacement} onClick={()=>controller.evaluateSurfaceQuery()}>Evaluate native Surface</Button>
  {state.surfaceQueryError&&<p role="alert" className="property-error">{state.surfaceQueryError}</p>}
  {result&&<div role="status"><p className="transform-note">{result.objectId} · {result.surfaceId} · source0 · accepted revision {result.acceptedRevision}<br/>U={scalar(result.parameters.u)}, V={scalar(result.parameters.v)} · native local XYZ</p><dl className="reference-details">{([['Point · mm',result.pointMM],['dP/dU · mm / parameter',result.duMMPerParameter],['dP/dV · mm / parameter',result.dvMMPerParameter]] as const).map(([label,vector])=><div key={label}><dt>{label}</dt><dd>{vector.map(scalar).join(', ')}</dd></div>)}</dl><FieldDescription>Original first derivatives. No normalized mesh normal or global continuity certificate.</FieldDescription></div>}
 </details>;
}
