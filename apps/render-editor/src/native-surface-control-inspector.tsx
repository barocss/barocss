import {useRef, useState, useSyncExternalStore} from 'react';
import {normalizeRenderEditorError, type RenderEditorError} from '@barocss/render-editor';
import type {NativeSceneHost, NativeSceneHostSnapshot} from './native-scene-host';

interface Props {host: NativeSceneHost; disabled: boolean; onError: (cause: unknown) => void}
interface RawBinding {
  accepted: NativeSceneHostSnapshot['accepted']; bodyId: string; resetEpoch: number;
  uIndex: number; vIndex: number; values: readonly string[];
}
const text = (value: number) => Object.is(value, -0) ? '-0' : String(value);
const numeric = (value: string) => /^[\t\n\v\f\r ]*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[\t\n\v\f\r ]*$/.test(value)
  && Number.isFinite(Number(value)) ? Number(value) : NaN;
function selectedSurface(snapshot: NativeSceneHostSnapshot) {
  if (snapshot.preparation.document !== snapshot.accepted) return null;
  const body = snapshot.accepted.nativeDocument.bodies.find(body => body.id === snapshot.selectedBodyId);
  const entry = snapshot.preparation.entries.find(entry => entry.binding.bodyId === body?.id);
  if (!body || entry?.kind !== 'surface' || !snapshot.accepted.display.visibleBodyIds.includes(body.id)
    || !snapshot.targets.some(target => target.bodyId === body.id)) return null;
  const asset = snapshot.preparation.native.compiledAssets.find(asset => asset.assetId === body.assetId);
  const surface = asset?.model.objects.find(object => object.id === body.geometryId);
  if (surface?.kind !== 'surface') return null;
  return {body, surface, shared: snapshot.accepted.nativeDocument.bodies.filter(other => other.assetId === body.assetId && other.id !== body.id).length};
}
function readBinding(snapshot: NativeSceneHostSnapshot): RawBinding {
  const selected = selectedSurface(snapshot);
  const selection = snapshot.selectedSurfacePole;
  const uIndex = selection.bodyId === snapshot.selectedBodyId ? selection.uIndex : 0;
  const vIndex = selection.bodyId === snapshot.selectedBodyId ? selection.vIndex : 0;
  const point = selected?.surface.controlPoints[uIndex]?.[vIndex], weight = selected?.surface.weights[uIndex]?.[vIndex];
  const patch = snapshot.surfacePoleBodyId === snapshot.selectedBodyId && snapshot.surfacePoleDraftPatch?.uIndex === uIndex
    && snapshot.surfacePoleDraftPatch.vIndex === vIndex ? snapshot.surfacePoleDraftPatch : null;
  return {accepted: snapshot.accepted, bodyId: snapshot.selectedBodyId, resetEpoch: snapshot.surfacePoleInputResetEpoch,
    uIndex, vIndex, values: patch ? [patch.xMM, patch.yMM, patch.zMM, patch.weight].map(text)
      : point && weight !== undefined ? [...point, weight].map(text) : []};
}
function inRange(value: number, index: number): boolean {
  return Number.isFinite(value) && (index < 3 ? Math.abs(value) <= 1e6 : value >= 1e-6 && value <= 1e6);
}

/** Edit original control-grid coefficients; sampled mesh points and body pose are separate. */
export function NativeSurfaceControlInspector({host, disabled, onError}: Props) {
  const snapshot = useSyncExternalStore(host.subscribe, host.getSnapshot, host.getSnapshot);
  const [stored, setStored] = useState(() => readBinding(snapshot)), binding = useRef(stored);
  const [error, setError] = useState<RenderEditorError | null>(null);
  const changed = stored.accepted !== snapshot.accepted || stored.bodyId !== snapshot.selectedBodyId
    || stored.resetEpoch !== snapshot.surfacePoleInputResetEpoch || stored.uIndex !== snapshot.selectedSurfacePole.uIndex
    || stored.vIndex !== snapshot.selectedSurfacePole.vIndex;
  const current = changed ? readBinding(snapshot) : stored;
  if (changed) {binding.current = current; setStored(current); setError(null);}
  const selected = selectedSurface(snapshot);
  const locked = disabled || snapshot.poseGestureActive || !!snapshot.posePreview || snapshot.surfacePoleGestureActive || !!snapshot.surfacePolePreview || !snapshot.available || snapshot.disposed;
  const refused = snapshot.invalidSurfacePole && snapshot.surfacePoleBodyId === current.bodyId;
  const parsed = current.values.map(numeric), invalid = parsed.length === 4 && !parsed.every(inRange);
  const report = (cause: unknown) => {setError(normalizeRenderEditorError(cause)); onError(cause);};
  const choose = (axis: 'u' | 'v', index: number) => {
    const live = host.getSnapshot(), surface = selectedSurface(live);
    if (disabled || live.dirty || live.poseGestureActive || live.posePreview || live.surfacePoleGestureActive || live.surfacePolePreview || !live.available || live.disposed || !surface) return;
    const before = binding.current;
    if (live.accepted !== before.accepted || live.selectedBodyId !== before.bodyId || live.surfacePoleInputResetEpoch !== before.resetEpoch) return;
    const uIndex = axis === 'u' ? index : before.uIndex, vIndex = axis === 'v' ? index : before.vIndex;
    if (!Number.isInteger(index) || uIndex < 0 || vIndex < 0 || uIndex >= surface.surface.controlPoints.length
      || vIndex >= surface.surface.controlPoints[uIndex].length) return;
    try {host.selectSurfacePole(uIndex, vIndex); setError(null);} catch (cause) {report(cause);}
  };
  const update = (index: number, value: string) => {
    const live = host.getSnapshot(), surface = selectedSurface(live), before = binding.current;
    if (disabled || value.length > 256 || live.poseGestureActive || live.posePreview || live.surfacePoleGestureActive || live.surfacePolePreview || !live.available || live.disposed
      || !surface || surface.shared || live.accepted !== before.accepted || live.selectedBodyId !== before.bodyId
      || live.surfacePoleInputResetEpoch !== before.resetEpoch) return;
    const values = [...before.values]; values[index] = value;
    const next = {...before, values}; binding.current = next; setStored(next);
    const numbers = values.map(numeric);
    try {
      if (numbers.length !== 4 || !numbers.every(inRange)) {
        host.setSurfacePoleInputInvalid(before.bodyId, before.uIndex, before.vIndex); setError(null); return;
      }
      host.stageSurfacePoleEdit(before.bodyId, {uIndex: before.uIndex, vIndex: before.vIndex,
        xMM: numbers[0], yMM: numbers[1], zMM: numbers[2], weight: numbers[3]});
      setError(null);
    } catch (cause) {
      try {host.setSurfacePoleInputInvalid(before.bodyId, before.uIndex, before.vIndex);} catch { /* A stale host keeps its authority. */ }
      report(cause);
    }
  };
  const field = (index: number, label: string) => <label>
    <span>{label}</span><input type="text" inputMode="decimal" maxLength={256} disabled={locked || !!selected?.shared}
      data-testid={'native-pole-' + label.toLowerCase()} aria-label={index < 3 ? 'Control point ' + label + ' in source mm' : 'Control point weight'}
      aria-invalid={!inRange(parsed[index], index) || refused && error !== null}
      aria-describedby={invalid || refused ? 'native-pole-error' : undefined} value={current.values[index] ?? ''}
      onChange={event => update(index, event.target.value)}/>
  </label>;
  return <details className="re-native-surface-control-inspector" data-testid="native-surface-control-inspector" data-body-id={current.bodyId}>
    <summary>Source control point</summary>
    {!selected ? <p className="re-material-caption">Select an applied visible Surface material to inspect its original points.</p> : <>
      <p className="re-material-caption" data-testid="native-pole-scope">Asset: {selected.body.assetId} · Surface: {selected.surface.id}</p>
      {selected.shared > 0 && <p className="re-material-caption" data-testid="native-pole-shared">Other bodies share this source asset. Duplicate this body first to edit its own control points.</p>}
      <div className="re-native-pole-indices">
        <label>U row<select aria-label="Control point U row" data-testid="native-pole-u" disabled={locked || snapshot.dirty} value={current.uIndex} onChange={event => choose('u', Number(event.target.value))}>
          {selected.surface.controlPoints.map((_row, index) => <option key={index} value={index}>{index + 1}</option>)}
        </select></label>
        <label>V column<select aria-label="Control point V column" data-testid="native-pole-v" disabled={locked || snapshot.dirty} value={current.vIndex} onChange={event => choose('v', Number(event.target.value))}>
          {selected.surface.controlPoints[current.uIndex].map((_point, index) => <option key={index} value={index}>{index + 1}</option>)}
        </select></label>
      </div>
      <fieldset className="re-native-transform-row"><legend>Control point (source mm)</legend><div className="re-native-transform-vector">{['X', 'Y', 'Z'].map((axis, index) => <span key={axis}>{field(index, axis)}</span>)}</div></fieldset>
      <div className="re-native-pole-weight">{field(3, 'Weight')}</div>
      <p className="re-material-caption">{snapshot.surfacePoleGestureActive ? 'Live Surface preview · release applies.'
        : snapshot.surfacePolePreview ? 'Surface preview retained · Cancel transform to restore.'
          : refused ? 'Correct point fields.' : snapshot.surfacePoleDraftActive ? 'Point draft · Apply scene to display.' : 'Original source coordinates · grid indices, not UV.'}</p>
      {(invalid || refused) && <div id="native-pole-error" className="re-native-transform-error" data-testid="native-pole-error" role="alert">
        <p>{invalid ? 'XYZ: −1000000 to 1000000 mm. Weight: 0.000001 to 1000000.' : 'This control point could not be staged. Correct the values or Discard.'}</p>
        {error && <details><summary>Details</summary><p>{error.message}</p></details>}
      </div>}
    </>}
  </details>;
}
