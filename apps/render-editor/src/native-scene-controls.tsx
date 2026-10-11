import {useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {validateMeshOptions, type MeshLighting} from '@barocss/gpu';
import type {NativeSceneHost} from './native-scene-host';
import {Button} from './components/ui/button';
import {NativeTransformInspector} from './native-transform-inspector';

interface Props {host: NativeSceneHost; disabled: boolean; onError: (cause: unknown) => void}
const text = (value: number) => Object.is(value, -0) ? '-0' : String(value);
const fields = ['Ambient', 'Directional', 'Direction X', 'Direction Y', 'Direction Z'];
const values = (lighting: MeshLighting) => [lighting.ambientStrength, lighting.directionalStrength, ...lighting.direction].map(text);
const number = (value: string) => /^[\t\n\v\f\r ]*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[\t\n\v\f\r ]*$/.test(value) && Number.isFinite(Number(value)) ? Number(value) : NaN;

/** Native controls share the existing inspector; numeric field text remains local until valid. */
export function NativeSceneControls({host, disabled, onError}: Props) {
  const snapshot = useSyncExternalStore(host.subscribe, host.getSnapshot, host.getSnapshot);
  const [portal, setPortal] = useState<Element | null>(null);
  const [raw, setRaw] = useState(() => values(snapshot.draftDocument.display.lighting));
  const previous = useRef({accepted: snapshot.accepted, dirty: snapshot.dirty});
  useLayoutEffect(() => {
    const inspector = document.querySelector('.re-material-host .re-material-inspector');
    if (!inspector) return;
    const slot = document.createElement('div'); inspector.prepend(slot); setPortal(slot);
    return () => {slot.remove();};
  }, []);
  useLayoutEffect(() => {
    if (previous.current.accepted !== snapshot.accepted || previous.current.dirty && !snapshot.dirty) setRaw(values(snapshot.draftDocument.display.lighting));
    previous.current = {accepted: snapshot.accepted, dirty: snapshot.dirty};
  }, [snapshot.accepted, snapshot.dirty, snapshot.draftDocument]);
  const locked = disabled || snapshot.poseGestureActive || !!snapshot.posePreview || !snapshot.available || snapshot.disposed;
  const bodyTitle = snapshot.accepted.nativeDocument.bodies.find(body => body.id === snapshot.selectedBodyId)?.name ?? snapshot.selectedBodyId;
  const change = (index: number, value: string) => {
    if (locked || value.length > 256) return;
    const next = [...raw]; next[index] = value; setRaw(next);
    const numeric = next.map(number);
    try {
      if (numeric.some(value => !Number.isFinite(value))) {host.setLightingInputInvalid(true); return;}
      const lighting: MeshLighting = {ambientStrength: numeric[0], directionalStrength: numeric[1], direction: [numeric[2], numeric[3], numeric[4]]};
      validateMeshOptions({mmToSceneUnit: snapshot.draftDocument.display.mmToSceneUnit, translate: [0, 0, 0], color: [1, 1, 1], background: snapshot.draftDocument.display.background, lighting});
      host.stageLighting(lighting); host.setLightingInputInvalid(false);
    } catch (cause) {host.setLightingInputInvalid(true); onError(cause);}
  };
  const apply = () => {try {host.commitPrepared(host.prepareDraft());} catch (cause) {onError(cause);}};
  const discard = () => {try {host.discardDraft(); setRaw(values(host.getSnapshot().draftDocument.display.lighting));} catch (cause) {onError(cause);}};
  const field = (index: number) => <div className="re-material-uniform" key={index}><label htmlFor={'native-light-' + index}>{index < 2 ? fields[index] : ['X', 'Y', 'Z'][index - 2]}</label><input id={'native-light-' + index} data-testid={'native-light-' + index} aria-label={fields[index]} type="text" inputMode="decimal" maxLength={256} disabled={locked} value={raw[index]} aria-invalid={snapshot.invalidLighting} onChange={event => change(index, event.target.value)}/></div>;
  if (!portal) return null;
  return createPortal(<section className="re-native-controls" aria-label="Native scene controls">
    <div className="re-material-heading"><h2 data-testid="native-properties-body-title" title={bodyTitle}>{bodyTitle}</h2><span>Properties</span></div>
    <NativeTransformInspector host={host} disabled={disabled} onError={onError}/>
    <div className="re-material-heading"><h2>Lighting</h2><span>{snapshot.invalidLighting ? 'Correct fields' : 'Scene draft'}</span></div>
    {field(0)}{field(1)}<div className="re-native-direction" style={{display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'}}>{[2, 3, 4].map(field)}</div>
    <div className="re-material-heading"><Button size="sm" disabled={locked || !snapshot.dirty} data-testid="native-scene-apply" onClick={apply}>Apply scene</Button><Button variant="ghost" size="sm" disabled={locked || !snapshot.dirty} data-testid="native-scene-discard" onClick={discard}>Discard</Button></div>
  </section>, portal);
}
