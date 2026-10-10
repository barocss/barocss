import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createCadGeometryReference, curveDomain, surfaceDomain } from '@barocss/cad';
import { CadEditorError } from '../types.js';
import type { CadEditorSession, CadEditorGeometryAnalysisResult } from '../types.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';
import { useCadEditorSnapshot } from './use-session.js';

export interface CadEditorGeometryAnalysisProps {
  session: CadEditorSession;
  onAnalysis?: (result: CadEditorGeometryAnalysisResult | null) => void;
  onError?: (error: CadEditorError) => void;
}
type Mode = 'curvature' | 'derivatives';
interface RawParameters { session: CadEditorSession; bodyId: string | null; mode: Mode; t: string; u: string; v: string }
interface Capture { session: CadEditorSession; generation: number; key: string; result: CadEditorGeometryAnalysisResult }
function exact(value: number): string { return Object.is(value, -0) ? '-0' : String(value); }
function formatted(value: number): string { return Object.is(value, -0) ? '-0' : value.toFixed(6); }
function diagnostic(error: CadEditorError): string {
  const messages = [error.message]; let cause: unknown = error.cause;
  for (let i = 0; i < 6 && cause instanceof Error; i++) { messages.push(cause.message); cause = cause.cause; }
  return messages.join('\n');
}
function guidance(error: CadEditorError): string {
  const text = diagnostic(error);
  if (/Original coordinates and knots|Degree must be|Native array size/i.test(text)) return 'This geometry is outside the analysis limits. Open Help for the supported range.';
  if (/CONTINUITY|continuity|multiplicity/i.test(text)) return 'Second derivatives are unavailable at this knot. Choose another original parameter.';
  if (/REGULARITY|tangent norm|collinear|nearly parallel/i.test(text)) return 'Curvature is unavailable here. Try Derivatives or choose another parameter.';
  if (/ARITHMETIC|representable|arithmetic range/i.test(text)) return 'This result exceeds the supported numeric range. Choose another parameter.';
  if (error.code === 'STALE') return 'The object changed. Inspect its current geometry again.';
  if (error.code === 'LIFECYCLE') return 'Reopen the viewport to inspect this object.';
  if (error.code === 'UNSUPPORTED') return 'Choose a supported original Curve or Surface.';
  return 'Enter finite numbers within the original parameter domains and inspect again.';
}
function parameter(raw: string): number {
  const value = raw.trim();
  if (raw.length > 128 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(Number(value))) {
    throw new CadEditorError('INPUT', 'Enter a finite decimal or exponent parameter of at most 128 characters.', { field: 'geometry-analysis' });
  }
  return Number(value);
}

export function CadEditorGeometryAnalysis(props: CadEditorGeometryAnalysisProps) {
  const { session } = props, snapshot = useCadEditorSnapshot(session), bodyId = snapshot.selectedBodyId;
  const propsRef = useRef(props); propsRef.current = props;
  const id = useId(), composingRef = useRef(new Set<string>());
  // Snapshots are copied; native generation, not their object identity, owns this binding.
  const selected = useMemo(() => {
    if (bodyId === null || snapshot.disposed) return null;
    try {
      const resolved = createCadGeometryReference(snapshot.accepted, { bodyId });
      const geometry = resolved.geometry;
      const domains = geometry.kind === 'curve' ? { t: curveDomain(geometry), u: null, v: null }
        : { t: null, ...surfaceDomain(geometry) };
      return { reference: resolved.reference, domains, error: null };
    } catch (cause) {
      return { reference: null, domains: null, error: cause instanceof CadEditorError ? cause
        : new CadEditorError('NATIVE', 'Cannot inspect the selected original geometry.', { field: 'geometry-analysis' }, cause) };
    }
  }, [session, snapshot.generation, bodyId, snapshot.disposed]);
  function defaults(): RawParameters {
    const midpoint = (domain: [number, number] | null | undefined) => domain ? exact(domain[0] + (domain[1] - domain[0]) / 2) : '';
    return { session, bodyId, mode: 'curvature', t: midpoint(selected?.domains?.t), u: midpoint(selected?.domains?.u), v: midpoint(selected?.domains?.v) };
  }
  const [raw, setRaw] = useState<RawParameters>(defaults);
  const currentRaw = raw.session === session && raw.bodyId === bodyId ? raw : defaults();
  const [capture, setCapture] = useState<Capture | null>(null);
  const [error, setError] = useState<CadEditorError | null>(null);
  const key = JSON.stringify({ bodyId, reference: selected?.reference, mode: currentRaw.mode, t: currentRaw.t, u: currentRaw.u, v: currentRaw.v });
  const currentCapture = capture?.session === session && capture.generation === snapshot.generation && capture.key === key && !snapshot.disposed ? capture : null;
  const busy = snapshot.candidate !== null || snapshot.selectionTransition !== null || snapshot.disposed;
  function report(cause: unknown) {
    const failure = cause instanceof CadEditorError ? cause : new CadEditorError('NATIVE', 'Original geometry analysis failed.', { field: 'geometry-analysis' }, cause);
    setError(failure); try { propsRef.current.onError?.(failure); } catch { /* Diagnostics do not change native geometry. */ }
  }
  function notify(result: CadEditorGeometryAnalysisResult | null) {
    try { propsRef.current.onAnalysis?.(result === null ? null : structuredClone(result)); }
    catch (cause) { report(new CadEditorError('LIFECYCLE', 'Geometry analysis callback failed.', { field: 'geometry-analysis' }, cause)); }
  }
  useEffect(() => { setCapture(null); setError(null); notify(null); }, [session, snapshot.generation, key, snapshot.disposed]);
  useEffect(() => () => { try { propsRef.current.onAnalysis?.(null); } catch { /* Release the owned result on unmount. */ } }, [session]);
  function inspect() {
    try {
      const current = session.getSnapshot();
      if (current.candidate || current.selectionTransition || current.disposed) throw new CadEditorError('INPUT', 'Wait for the current selection or display decision.', { field: 'geometry-analysis' });
      if (current.generation !== snapshot.generation || current.selectedBodyId !== bodyId || !selected?.reference) throw new CadEditorError('STALE', 'The selected analysis binding changed.', { field: 'geometry-analysis' });
      const reference = selected.reference;
      const result = reference.geometryKind === 'curve'
        ? currentRaw.mode === 'curvature' ? session.inspectCurveCurvature(reference, parameter(currentRaw.t)) : session.inspectCurveD2(reference, parameter(currentRaw.t))
        : currentRaw.mode === 'curvature' ? session.inspectSurfaceCurvature(reference, parameter(currentRaw.u), parameter(currentRaw.v)) : session.inspectSurfaceD2(reference, parameter(currentRaw.u), parameter(currentRaw.v));
      setCapture({ session, generation: current.generation, key, result }); setError(null); notify(result);
    } catch (cause) { report(cause); }
  }
  if (bodyId === null) return null;
  const body = snapshot.accepted.document.bodies.find(item => item.id === bodyId);
  const result = currentCapture?.result;
  function field(name: 't' | 'u' | 'v', label: string, domain: [number, number]) {
    return <div className="cad-editor-field" key={name}>
      <Label htmlFor={id + '-' + name}>{label}</Label>
      <Input id={id + '-' + name} data-testid={'analysis-' + name} type="text" inputMode="decimal" maxLength={128}
        value={currentRaw[name]} disabled={busy} aria-describedby={id + '-domain-' + name}
        onChange={event => setRaw({ ...currentRaw, [name]: event.target.value })}
        onCompositionStart={() => composingRef.current.add(name)} onCompositionEnd={() => composingRef.current.delete(name)}
        onKeyDown={event => {
          if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229 || composingRef.current.has(name)
            || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
          event.preventDefault(); event.stopPropagation(); inspect();
        }}/>
      <span id={id + '-domain-' + name} data-testid={'analysis-domain-' + name} className="cad-editor-accepted">Domain [{exact(domain[0])}, {exact(domain[1])}]</span>
    </div>;
  }
  function metric(label: string, value: number | null, testId: string, unit: string) {
    return <div key={testId}><dt>{label} <span>{unit}</span></dt><dd data-testid={testId}>{value === null ? 'Unavailable' : formatted(value)}</dd></div>;
  }
  function vector(label: string, value: [number, number, number], prefix: string, unit: string) {
    return <section><h4>{label} · {unit}</h4><dl className="cad-editor-analysis-values">{value.map((number, axis) => metric(['X', 'Y', 'Z'][axis], number, prefix + '-' + ['x', 'y', 'z'][axis], ''))}</dl></section>;
  }
  return <section className="cad-editor-analysis" data-testid="analysis-section" aria-label={'Analysis of ' + body?.name}>
    <div className="cad-editor-analysis-title"><h3 className="cad-editor-heading">Analysis</h3>
      <Dialog><DialogTrigger asChild><Button type="button" variant="ghost" size="xs" data-testid="analysis-help">Help</Button></DialogTrigger>
        <DialogContent className="cad-editor-help-dialog" data-testid="analysis-help-dialog">
          <DialogHeader><DialogTitle>Original geometry analysis</DialogTitle><DialogDescription>Parameters, units and local evaluation limits.</DialogDescription></DialogHeader>
          <div className="cad-editor-help-body">
            <p>Inspect reads the accepted original Curve or Surface in authored XYZ/mm. Pending control-point edits stay pending. Hidden geometry can be inspected. Display samples and meshes are not the analysis authority.</p>
            <p>Parameters are original knot values, not control-pole indices or normalized values. Enter finite decimal or exponent values within the displayed closed domains. Reset parameters restores their midpoints without inspecting or changing geometry.</p>
            <p>Second derivatives support degree 1–5, Curve 2–64 poles and Surface 2–16 poles per axis, at most 256. Coordinates, knots and parameters must stay within ±10000; weights within 0.000001–1000000. The native evaluator owns these checks.</p>
            <p>Endpoints use the interior one-sided span. At an exact interior knot, degree minus multiplicity must be at least 2. An insufficiently continuous knot is refused without moving the query.</p>
            <p>Derivatives use original knot units: first derivatives are mm/parameter; second derivatives are mm/parameter². Surface mixed derivatives are mm/(U·V). Zero derivatives are valid. Curvature additionally needs a regular tangent or independent Surface tangents.</p>
            <p>Curve curvature is 1/mm and radius is mm. A straight regular Curve has zero curvature and no finite radius. Surface mean and principal curvatures are 1/mm; Gaussian curvature is 1/mm². Planar regular Surfaces can have zero curvature.</p>
            <p>The Surface normal follows du × dv. Mean and principal signs follow that orientation; Gaussian curvature does not. Full normal, metric, discriminant and roundoff policy are in the typed record. Ordinary values are rounded to six decimals; the callback keeps full native values and signed zero.</p>
            <p>Enter in a parameter field inspects only outside text composition. Tab does not inspect. Space activates the focused button. Help close or Escape returns focus to Help and retains raw values.</p>
            <p>Changing object, native content, parameters or query mode invalidates the result. Same-body pole selection, camera and display-only changes keep it. Failed same-current inspection retains the last valid result. This local query does not certify G2, torsion, principal directions, trims, Faces, Solids or manufacturing quality and does not repair geometry.</p>
            <p>The editor uses inspectCurveD2, inspectSurfaceD2, inspectCurveCurvature or inspectSurfaceCurvature with the full current document/asset/body/geometry reference. Native refusals keep their actual causes.</p>
            {error && <details><summary>Technical error details</summary><pre>{diagnostic(error)}</pre></details>}
            {selected?.error && <details><summary>Binding details</summary><pre>{diagnostic(selected.error)}</pre></details>}
          </div>
          <DialogClose asChild><Button type="button" variant="outline" className="cad-editor-export-close" data-testid="analysis-help-close">Close help</Button></DialogClose>
        </DialogContent>
      </Dialog>
    </div>
    <p className="cad-editor-analysis-object">{body?.name} · accepted geometry</p>
    {selected?.reference && selected.domains ? <>
      <div className="cad-editor-field"><Label htmlFor={id + '-mode'}>Query mode</Label><select id={id + '-mode'} data-testid="analysis-mode" value={currentRaw.mode} disabled={busy}
        onChange={event => setRaw({ ...currentRaw, mode: event.target.value as Mode })}><option value="curvature">Curvature</option><option value="derivatives">Derivatives</option></select></div>
      {selected.domains.t ? field('t', 'Parameter t', selected.domains.t) : <>{field('u', 'Parameter U', selected.domains.u!)}{field('v', 'Parameter V', selected.domains.v!)}</>}
      <div className="cad-editor-analysis-actions"><Button type="button" data-testid="analysis-inspect" disabled={busy} onClick={inspect}>Inspect</Button>
        <Button type="button" variant="outline" data-testid="analysis-reset" disabled={busy} onClick={() => setRaw({ ...defaults(), mode: currentRaw.mode })}>Reset parameters</Button></div>
    </> : <p role="status">{selected?.error ? guidance(selected.error) : 'Select a Curve or Surface to inspect.'}</p>}
    {error && <p role="alert" className="cad-editor-error" data-testid="analysis-error">{guidance(error)}</p>}
    {result && <section data-testid="analysis-result">
      <p className="cad-editor-analysis-note">Accepted geometry · {result.query === 'curvature' ? 'Local curvature' : 'Derivatives inspected'}</p>
      {result.query === 'curvature' && <dl className="cad-editor-analysis-values">{result.kind === 'curve' ? <>
        {metric('Curvature', result.result.curvaturePerMM, 'analysis-curvature', '1/mm')}{metric('Radius', result.result.radiusMM, 'analysis-radius', 'mm')}
      </> : <>{metric('Mean curvature', result.result.meanCurvaturePerMM, 'analysis-mean', '1/mm')}
        {metric('Gaussian curvature', result.result.gaussianCurvaturePerMM2, 'analysis-gaussian', '1/mm²')}
        {metric('Principal 1', result.result.principalCurvaturesPerMM[0], 'analysis-principal-1', '1/mm')}
        {metric('Principal 2', result.result.principalCurvaturesPerMM[1], 'analysis-principal-2', '1/mm')}</>}</dl>}
      <details data-testid="analysis-details"><summary>Details</summary>
        {(() => {
          const derivatives = result.query === 'curvature' ? result.result.derivatives : result.result;
          return <>{vector('Point', derivatives.point, 'analysis-point', 'mm')}{'derivative' in derivatives ? <>
            {vector('First derivative', derivatives.derivative, 'analysis-first', 'mm/parameter')}{vector('Second derivative', derivatives.secondDerivative, 'analysis-second', 'mm/parameter²')}
          </> : <>{vector('U derivative', derivatives.du, 'analysis-du', 'mm/U')}{vector('V derivative', derivatives.dv, 'analysis-dv', 'mm/V')}
            {vector('UU derivative', derivatives.duu, 'analysis-duu', 'mm/U²')}{vector('UV derivative', derivatives.duv, 'analysis-duv', 'mm/(U·V)')}{vector('VV derivative', derivatives.dvv, 'analysis-dvv', 'mm/V²')}</>}</>;
        })()}
        <p>Document revision {result.reference.documentRevision} · Asset revision {result.reference.assetRevision}</p>
        <h4>Full native record</h4><p>Signed zero is shown as "-0". The typed result keeps numeric values.</p><pre data-testid="analysis-record">{JSON.stringify(result, (_key, value) => Object.is(value, -0) ? '-0' : value, 2)}</pre>
      </details>
    </section>}
  </section>;
}
