import {useId, useRef, useState, useSyncExternalStore} from 'react';
import {RenderMixedDocumentError} from './mixed-document.js';
import type {RenderMixedDocumentV1} from './mixed-document.js';
import type {RenderMixedController} from './mixed-controller.js';
import type {RenderMixedSessionSnapshot} from './mixed-session.js';
import {inspectRenderMixedSphereSource, editRenderMixedSphereSource} from './mixed-sphere-source.js';

type Properties = ReturnType<typeof inspectRenderMixedSphereSource>;
interface RawProperties {radius: string; translate: [string, string, string]; color: string}
interface Binding {
  accepted: RenderMixedDocumentV1;
  manualEdit: number;
  baselineSource: string;
  lastOutput: string;
  properties: Properties | null;
  raw: RawProperties;
  invalid: boolean;
  error: RenderMixedDocumentError | null;
}
interface SphereInspectorProps {
  controller: RenderMixedController;
  hidden: boolean;
  disabled: boolean;
  manualEdit: number;
  onEditSource: () => void;
  onHelp?: () => void;
  onError?: (error: RenderMixedDocumentError) => void;
}
const DECIMAL = /^[\t\n\v\f\r ]*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[\t\n\v\f\r ]*$/;
const format = (value: number) => Object.is(value, -0) ? '-0' : String(value);
const number = (text: string) => DECIMAL.test(text) && Number.isFinite(Number(text)) ? Number(text) : NaN;
const normalize = (cause: unknown) => cause instanceof RenderMixedDocumentError ? cause : new RenderMixedDocumentError('INPUT', 'The Sphere fields could not be staged.', cause);

function bind(snapshot: RenderMixedSessionSnapshot, manualEdit: number): Binding {
  const source = snapshot.draft.sceneSource;
  try {
    const properties = inspectRenderMixedSphereSource(source);
    return {accepted: snapshot.accepted, manualEdit, baselineSource: source, lastOutput: source, properties,
      raw: {radius: format(properties.radius), translate: properties.translate.map(format) as [string, string, string], color: properties.color}, invalid: false, error: null};
  } catch (cause) {
    return {accepted: snapshot.accepted, manualEdit, baselineSource: source, lastOutput: source, properties: null,
      raw: {radius: '', translate: ['', '', ''], color: ''}, invalid: false, error: normalize(cause)};
  }
}

function fieldErrors(raw: RawProperties) {
  const radius = number(raw.radius), translate = raw.translate.map(number) as [number, number, number];
  const radiusError = !Number.isFinite(radius) ? 'Enter a finite decimal radius.' : radius <= 0 || radius > 1000 || Math.fround(radius) <= 0 ? 'Use a positive radius up to 1000.' : null;
  const translateErrors = translate.map(value => !Number.isFinite(value) ? 'Enter a finite decimal position.' : Math.abs(value) > 1000 ? 'Use a value from -1000 to 1000.' : null);
  const colorError = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw.color) ? null : 'Use #rgb or #rrggbb.';
  return {radius, translate, radiusError, translateErrors, colorError,
    invalid: radiusError !== null || translateErrors.some(Boolean) || colorError !== null};
}

/** Private bounded text state. Only the public source writer stages authored properties. */
export function MixedSphereInspector({controller, hidden, disabled, manualEdit, onEditSource, onHelp, onError}: SphereInspectorProps) {
  const snapshot = useSyncExternalStore(controller.session.subscribe, controller.session.getSnapshot, controller.session.getSnapshot);
  const [stored, setStored] = useState(() => bind(snapshot, manualEdit));
  const binding = useRef(stored);
  const contextChanged = stored.accepted !== snapshot.accepted || stored.manualEdit !== manualEdit
    || stored.lastOutput !== snapshot.draft.sceneSource || (stored.invalid && !snapshot.sphereInputInvalid);
  const current = contextChanged ? bind(snapshot, manualEdit) : stored;
  if (contextChanged) { binding.current = current; setStored(current); }
  const id = useId(), issues = fieldErrors(current.raw), locked = disabled || current.properties === null;
  const setBinding = (next: Binding) => { binding.current = next; setStored(next); };

  const change = (field: 'radius' | 'color' | number, text: string) => {
    const view = controller.getSnapshot(), state = controller.session.getSnapshot(), previous = binding.current;
    if (disabled || view.cameraPreview || view.disposed || state.disposed || !previous.properties) return;
    // Native text limits bound each raw field; do not silently truncate a scripted oversized value.
    if (text.length > 256) return;
    const raw = {...previous.raw, translate: [...previous.raw.translate] as [string, string, string]};
    if (typeof field === 'number') raw.translate[field] = text;
    else raw[field] = text;
    const parsed = fieldErrors(raw);
    let next = {...previous, raw, invalid: true, error: null as RenderMixedDocumentError | null};
    try {
      if (parsed.invalid) {
        setBinding(next);
        controller.session.setDraftSphereSource(null);
        return;
      }
      const output = editRenderMixedSphereSource(previous.baselineSource, previous.properties.objectId,
        {radius: parsed.radius, translate: parsed.translate, color: raw.color});
      next = {...next, lastOutput: output, properties: inspectRenderMixedSphereSource(output), invalid: false};
      setBinding(next);
      controller.session.setDraftSphereSource(output);
    } catch (cause) {
      const error = normalize(cause);
      setBinding({...previous, raw, invalid: true, error});
      try { controller.session.setDraftSphereSource(null); } catch (refusal) { onError?.(normalize(refusal)); }
    }
  };

  return <section className="re-camera re-panel re-sphere-inspector" aria-label="Sphere inspector" data-testid="inspector-sphere" hidden={hidden}>
    <div className="re-panel-heading"><h2>Sphere</h2><span>{snapshot.sphereInputInvalid || snapshot.draft.sceneSource !== snapshot.accepted.sceneSource ? 'Draft' : 'Applied'}</span></div>
    <dl className="re-object-summary"><dt>Name</dt><dd>{current.properties?.objectId ?? snapshot.prepared.metadata.objectId}</dd><dt>Type</dt><dd>Sphere</dd></dl>
    {!current.properties ? <p className="re-caption">Correct the Scene source to edit Sphere properties.</p> : null}
    <label className="re-scalar re-sphere-radius" htmlFor={`${id}-radius`}><span>Radius · scene units</span><input id={`${id}-radius`} type="text" inputMode="decimal" aria-label="Sphere radius" data-testid="sphere-radius" maxLength={256} disabled={locked} value={current.raw.radius} aria-invalid={current.properties !== null && issues.radiusError !== null} aria-describedby={current.properties && issues.radiusError ? `${id}-radius-error` : undefined} onChange={event => change('radius', event.target.value)} /></label>
    {current.properties && issues.radiusError ? <p id={`${id}-radius-error`} className="re-sphere-field-error">{issues.radiusError}</p> : null}
    <fieldset><legend>Position · scene units</legend><div className="re-vector">{current.raw.translate.map((value, axis) => <div className="re-sphere-position-field" key={axis}><label htmlFor={`${id}-position-${axis}`}><span>{['X', 'Y', 'Z'][axis]}</span><input id={`${id}-position-${axis}`} type="text" inputMode="decimal" aria-label={`Sphere ${['X', 'Y', 'Z'][axis]}`} data-testid={`sphere-position-${['x', 'y', 'z'][axis]}`} maxLength={256} disabled={locked} value={value} aria-invalid={current.properties !== null && issues.translateErrors[axis] !== null} aria-describedby={current.properties && issues.translateErrors[axis] ? `${id}-position-error-${axis}` : undefined} onChange={event => change(axis, event.target.value)} /></label>{current.properties && issues.translateErrors[axis] ? <p id={`${id}-position-error-${axis}`} className="re-sphere-field-error">{issues.translateErrors[axis]}</p> : null}</div>)}</div></fieldset>
    <label className="re-scalar" htmlFor={`${id}-color`}><span>Color · opaque hex</span><input id={`${id}-color`} type="text" aria-label="Sphere color" data-testid="sphere-color" maxLength={256} disabled={locked} value={current.raw.color} aria-invalid={current.properties !== null && issues.colorError !== null} aria-describedby={current.properties && issues.colorError ? `${id}-color-error` : undefined} onChange={event => change('color', event.target.value)} /></label>
    {current.properties && issues.colorError ? <p id={`${id}-color-error`} className="re-sphere-field-error">{issues.colorError}</p> : null}
    {current.error && current.properties ? <div className="re-sphere-source-error" role="status"><p>{current.error.code === 'BYTES' ? 'The source has no room for this change. Edit source to make room, or correct the fields.' : 'The source change was refused. Correct the fields or edit source.'}</p><details><summary>Details</summary><pre>{current.error.message}</pre></details></div> : null}
    <div className="re-sphere-actions"><button type="button" disabled={disabled} onClick={onEditSource}>Edit source</button>{onHelp ? <button type="button" data-testid="sphere-properties-help" onClick={onHelp}>Sphere properties Help</button> : null}</div>
    {!onHelp ? <details className="re-mixed-help"><summary>Help: Sphere properties</summary><p>Radius and Position use scene units. Color uses #rgb or #rrggbb. Changes remain drafts until Apply. Incomplete fields keep their text and block whole Apply and file actions, even when hidden.</p><p>Edit Scene source explicitly replaces these field drafts. Sphere Position edits original scene source; native Surface Position changes only its display. Selection and Help do not move geometry or pick pixels.</p></details> : null}
  </section>;
}
