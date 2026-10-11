import {useRef, useState, useSyncExternalStore} from 'react';
import {normalizeRenderEditorError, RenderEditorError} from '@barocss/render-editor';
import type {NativeSceneHost, NativeSceneHostSnapshot} from './native-scene-host';

interface Props {host: NativeSceneHost; disabled: boolean; onError: (cause: unknown) => void}
interface RawBinding {accepted: NativeSceneHostSnapshot['accepted']; bodyId: string; resetEpoch: number; values: readonly string[]}
const axes = ['x', 'y', 'z'] as const;
const text = (value: number) => Object.is(value, -0) ? '-0' : String(value);
const numeric = (value: string) => /^[\t\n\v\f\r ]*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[\t\n\v\f\r ]*$/.test(value) && Number.isFinite(Number(value)) ? Number(value) : NaN;
function readBinding(snapshot: NativeSceneHostSnapshot): RawBinding {
  const pose = snapshot.draftDocument.display.poses.find(pose => pose.bodyId === snapshot.selectedBodyId);
  return {accepted: snapshot.accepted, bodyId: snapshot.selectedBodyId, resetEpoch: snapshot.bodyPoseInputResetEpoch,
    values: [...(pose?.translationMM ?? [0, 0, 0]), ...(pose?.scale ?? [1, 1, 1])].map(text)};
}
function inRange(value: number, index: number): boolean {
  return Number.isFinite(value) && (index < 3 ? value >= -10000 && value <= 10000 : value >= .001 && value <= 100);
}

/** Six corrective strings stage one original body pose; rotation and accepted presentation stay separate. */
export function NativeTransformInspector({host, disabled, onError}: Props) {
  const snapshot = useSyncExternalStore(host.subscribe, host.getSnapshot, host.getSnapshot);
  const [stored, setStored] = useState(() => readBinding(snapshot)), binding = useRef(stored);
  const [error, setError] = useState<RenderEditorError | null>(null);
  const changed = stored.accepted !== snapshot.accepted || stored.bodyId !== snapshot.selectedBodyId || stored.resetEpoch !== snapshot.bodyPoseInputResetEpoch;
  const current = changed ? readBinding(snapshot) : stored;
  if (changed) {binding.current = current; setStored(current); setError(null);}
  const locked = disabled || snapshot.poseGestureActive || !!snapshot.posePreview || !snapshot.available || snapshot.disposed;
  const update = (index: number, value: string) => {
    if (locked || value.length > 256) return;
    const before = binding.current, values = [...before.values]; values[index] = value;
    const next = {...before, values}; binding.current = next; setStored(next);
    const numbers = values.map(numeric);
    try {
      if (!numbers.every(inRange)) {
        host.setBodyPoseInputInvalid(before.bodyId);
        setError(null); return;
      }
      host.stageBodyPose(before.bodyId, {translationMM: numbers.slice(0, 3) as [number, number, number], scale: numbers.slice(3, 6) as [number, number, number]});
      setError(null);
    } catch (cause) {
      try {host.setBodyPoseInputInvalid(before.bodyId);} catch { /* A stale or unavailable host retains its own authority. */ }
      setError(normalizeRenderEditorError(cause)); onError(cause);
    }
  };
  const parsed = current.values.map(numeric), invalid = !parsed.every(inRange);
  const refused = snapshot.invalidBodyPose && snapshot.invalidBodyPoseBodyId === current.bodyId;
  const row = (kind: 'position' | 'scale', offset: number) => <fieldset className="re-native-transform-row">
    <legend>{kind === 'position' ? 'Position (mm)' : 'Scale'}</legend>
    <div className="re-native-transform-vector">{axes.map((axis, component) => {
      const index = offset + component, id = 'native-' + kind + '-' + axis;
      return <label key={axis} htmlFor={id}><span>{axis.toUpperCase()}</span><input id={id} data-testid={id} aria-label={(kind === 'position' ? 'Position ' + axis.toUpperCase() + ' in mm' : 'Scale ' + axis.toUpperCase())} aria-invalid={!inRange(parsed[index], index) || refused && error !== null} aria-describedby={invalid || refused ? 'native-transform-error' : undefined} type="text" inputMode="decimal" maxLength={256} value={current.values[index]} disabled={locked} onChange={event => update(index, event.target.value)}/></label>;
    })}</div>
  </fieldset>;
  return <section className="re-native-transform-inspector" aria-label="Body transform" data-testid="native-transform-inspector" data-body-id={current.bodyId}>
    <div className="re-material-heading"><h2>Transform</h2><span>{refused ? 'Correct fields' : 'Body draft'}</span></div>
    {row('position', 0)}{row('scale', 3)}
    <p className="re-native-rotation-cue">Rotate with Canvas handles.</p>
    {(invalid || refused) && <div id="native-transform-error" data-testid="native-transform-error" className="re-native-transform-error" role="alert">
      <p>{invalid ? 'Position: −10000 to 10000 mm. Scale: 0.001 to 100.' : 'This pose could not be staged. Correct the values.'}</p>
      {error && <details><summary>Details</summary><p>{error.message}</p></details>}
    </div>}
  </section>;
}
