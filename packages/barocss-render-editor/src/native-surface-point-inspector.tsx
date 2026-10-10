import { useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react';
import { surfaceDomain } from '@barocss/cad';
import type { Surface } from '@barocss/cad';
import type { RenderMixedController } from './mixed-controller.js';
import { RenderMixedDocumentError } from './mixed-document.js';
import type { RenderMixedDocumentV1 } from './mixed-document.js';
import { queryRenderMixedSurfacePoint } from './mixed-surface-point.js';
import type { RenderMixedSurfacePointResult } from './mixed-surface-point.js';

type NativeDomain = ReturnType<typeof surfaceDomain>;
interface InspectionState {
  context: string;
  accepted: RenderMixedDocumentV1;
  u: string;
  v: string;
  result: RenderMixedSurfacePointResult | null;
  error: RenderMixedDocumentError | null;
}

const DECIMAL = /^[\t\n\v\f\r ]*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[\t\n\v\f\r ]*$/;
function format(value: number): string { return Object.is(value, -0) ? '-0' : String(value); }
function number(text: string): number {
  if (!DECIMAL.test(text)) return NaN;
  const value = Number(text);
  return Number.isFinite(value) ? value : NaN;
}
function midpoint(domain: readonly [number, number]): string { return format(domain[0] / 2 + domain[1] / 2); }
function parameterError(value: number, name: string, domain: readonly [number, number] | undefined): string | null {
  if (!Number.isFinite(value)) return `Enter a finite ${name} value.`;
  if (domain && (value < domain[0] || value > domain[1])) return `${name} must be from ${format(domain[0])} to ${format(domain[1])}.`;
  return null;
}
function errorDetails(error: unknown): string {
  if (error instanceof Error) return `${error.message}${error.cause === undefined ? '' : `\n${errorDetails(error.cause)}`}`;
  if (Array.isArray(error)) return JSON.stringify(error, null, 2);
  return String(error);
}

/** Private inspection state only. It does not edit session drafts or the preview. */
export function NativeSurfacePointInspector({ controller }: { controller: RenderMixedController }) {
  const snapshot = useSyncExternalStore(controller.session.subscribe, controller.session.getSnapshot, controller.session.getSnapshot);
  const presentation = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const disposed = snapshot.disposed || presentation.disposed;
  const accepted = snapshot.accepted, id = useId(), errorId = `${id}-error`;
  const native = useMemo((): { domain: NativeDomain | null; error: RenderMixedDocumentError | null } => {
    const surface = snapshot.prepared.model.objects.find((object): object is Surface => object.kind === 'surface' && object.id === accepted.asset.surfaceId);
    if (!surface || snapshot.prepared.model.name !== accepted.asset.modelId) {
      return { domain: null, error: new RenderMixedDocumentError('QUALIFICATION', 'The applied Surface is unavailable.') };
    }
    try { return { domain: surfaceDomain(surface), error: null }; }
    catch (cause) { return { domain: null, error: new RenderMixedDocumentError('NATIVE', 'The applied Surface domain is unavailable.', cause) }; }
  }, [snapshot.prepared, accepted]);
  const context = JSON.stringify([accepted.documentId, accepted.asset.modelId, accepted.asset.surfaceId,
    ...(native.domain ? [...native.domain.u, ...native.domain.v].map(format) : ['unavailable'])]);
  const initial = (): InspectionState => ({ context, accepted, u: native.domain ? midpoint(native.domain.u) : '',
    v: native.domain ? midpoint(native.domain.v) : '', result: null, error: null });
  const [inspection, setInspection] = useState<InspectionState>(initial);
  // New refs/domains display their actual defaults immediately. Same context
  // keeps raw text, while every accepted transaction invalidates old results.
  const current = inspection.context === context ? inspection : initial();
  const result = inspection.accepted === accepted && inspection.context === context
    && inspection.result?.documentId === accepted.documentId && Object.is(inspection.result.documentRevision, accepted.revision)
    ? inspection.result : null;
  const queryError = inspection.accepted === accepted && inspection.context === context ? inspection.error : null;
  useEffect(() => {
    setInspection((previous) => previous.accepted === accepted && previous.context === context ? previous : ({ context, accepted,
      u: previous.context === context ? previous.u : native.domain ? midpoint(native.domain.u) : '',
      v: previous.context === context ? previous.v : native.domain ? midpoint(native.domain.v) : '', result: null, error: null }));
  }, [accepted, context]);
  const u = number(current.u), v = number(current.v);
  const uError = parameterError(u, 'U', native.domain?.u), vError = parameterError(v, 'V', native.domain?.v);
  const failure = native.error ?? queryError;
  const message = native.error ? 'The applied Surface cannot be inspected.' : uError ?? vError
    ?? (queryError ? 'Point inspection failed. Check U and V, then try again.' : null);
  const setParameter = (field: 'u' | 'v', text: string) => {
    setInspection({ context, accepted, u: current.u, v: current.v, [field]: text, result: null, error: null });
  };
  const inspect = () => {
    try {
      if (controller.session.getSnapshot().accepted !== accepted) throw new RenderMixedDocumentError('INPUT', 'The applied Surface changed. Inspect it again.');
      const result = queryRenderMixedSurfacePoint(accepted, u, v);
      setInspection({ context, accepted, u: current.u, v: current.v, result, error: null });
    } catch (cause) {
      const error = cause instanceof RenderMixedDocumentError ? cause : new RenderMixedDocumentError('NATIVE', 'The source point could not be inspected.', cause);
      setInspection({ context, accepted, u: current.u, v: current.v, result: null, error });
    }
  };
  return <details className="re-camera-advanced re-surface-point" data-testid="surface-point-panel"
    data-surface-id={snapshot.prepared.metadata.surfaceId}>
    <summary>Source point</summary>
    <p className="re-caption" data-testid="surface-point-applied">Applied Surface: {accepted.asset.surfaceId}</p>
    <fieldset className="re-surface-point-parameters"><legend>Parameters</legend>
      <div className="re-vector">
        {(['u', 'v'] as const).map((field) => {
          const name = field.toUpperCase(), domain = native.domain?.[field], invalid = field === 'u' ? uError : vError;
          return <div className="re-surface-point-parameter" key={field}><label htmlFor={`${id}-${field}`}><span>{name}</span>
            <input id={`${id}-${field}`} type="text" inputMode="decimal" aria-label={`Surface ${name}`}
              aria-invalid={invalid !== null} aria-describedby={message ? errorId : undefined}
              value={current[field]} disabled={disposed || native.domain === null}
              onChange={(event) => setParameter(field, event.target.value)} /></label>
            {domain && <small>Min {format(domain[0])} · Max {format(domain[1])}</small>}</div>;
        })}
      </div>
    </fieldset>
    {message && <p id={errorId} className="re-native-position-error" data-testid="surface-point-error">{message}</p>}
    <button type="button" className="re-primary" data-testid="inspect-surface-point"
      disabled={disposed || native.domain === null || uError !== null || vError !== null} onClick={inspect}>Inspect point</button>
    {failure && <details className="re-mixed-details"><summary>Details</summary><pre>{errorDetails(failure)}</pre></details>}
    {result && <div className="re-surface-point-result" data-testid="surface-point-result">
      <p className="re-caption" data-testid="surface-point-scope">Applied {result.modelId} / {result.surfaceId}</p>
      <table aria-label="Native point coordinates in millimeters"><thead><tr><th>Axis</th><th>Source · mm</th></tr></thead>
        <tbody>{result.pointMM.map((value, axis) => <tr key={axis}><th scope="row">{['X', 'Y', 'Z'][axis]}</th>
          <td data-testid={`surface-point-${['x', 'y', 'z'][axis]}`}>{format(value)}</td></tr>)}</tbody></table>
    </div>}
    <details className="re-surface-point-help"><summary>Help: Source point</summary>
      <p className="re-caption">U and V are original Source 0 knot parameters, with no unit. The source point uses native coordinates in mm.</p>
      <p className="re-caption">Inspect point reads the applied Surface. Pending source, Surface, and position changes stay drafts. The sampled preview can differ from this source point; this action does not pick pixels.</p>
      <p className="re-caption">Parameters and results are temporary. They do not change geometry or saved files. Apply, Open, and history changes clear the result.</p>
    </details>
  </details>;
}
