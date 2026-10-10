import {useRef, useState, useSyncExternalStore} from 'react';
import type {RenderEditorController} from './controller.js';
import type {RenderEditorSessionSnapshot} from './session.js';
import {normalizeRenderEditorError} from './errors.js';
import type {RenderEditorError} from './errors.js';
import {inspectRenderSceneObjects, editRenderSceneObjectSource} from './scene-object-source.js';
import type {RenderSceneObjectProperties, RenderSceneObjectKind, RenderSceneObjectPatch} from './scene-object-source.js';

type Raw = Record<string, string | [string, string, string]>;
interface Binding {properties: RenderSceneObjectProperties; raw: Raw; removed: boolean; invalid: boolean; error: RenderEditorError | null; editedField: string | null}
interface Store {accepted: RenderEditorSessionSnapshot['accepted']; manualEdit: number; baseline: string; lastOutput: string; entries: Map<string, Binding>; invalidId: string | null; sourceError: RenderEditorError | null}
const numeric = (text: string) => /^[\t\n\v\f\r ]*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[\t\n\v\f\r ]*$/.test(text) && Number.isFinite(Number(text)) ? Number(text) : NaN;
const format = (value: number) => Object.is(value, -0) ? '-0' : String(value);
const vectorKeys = new Set(['translate', 'rotateDegrees', 'size', 'start', 'end']);
const LABELS: Record<RenderSceneObjectKind, string> = {sphere:'Sphere',box:'Box',cylinder:'Cylinder',capsule:'Capsule','rounded-box':'Rounded box',torus:'Torus'};
function keys(type: RenderSceneObjectKind): string[] {
  const dimensions = type === 'sphere' ? ['radius'] : type === 'box' ? ['size'] : type === 'cylinder' ? ['radius', 'height']
    : type === 'capsule' ? ['radius', 'start', 'end'] : type === 'rounded-box' ? ['radius', 'size'] : ['majorRadius', 'minorRadius'];
  return ['translate', 'rotateDegrees', ...dimensions, 'color'];
}
function rawOf(object: RenderSceneObjectProperties): Raw {
  const raw: Raw = {};
  for (const key of keys(object.type)) {
    const value = (object as unknown as Record<string, unknown>)[key];
    raw[key] = Array.isArray(value) ? value.map(format) as [string, string, string] : typeof value === 'number' ? format(value) : value as string;
  }
  return raw;
}
function readStore(snapshot: RenderEditorSessionSnapshot, manualEdit: number): Store {
  const entries = new Map<string, Binding>();
  let sourceError: RenderEditorError | null = null;
  try {
    const draft = inspectRenderSceneObjects(snapshot.draftSource), applied = inspectRenderSceneObjects(snapshot.accepted.sceneSource);
    for (const object of draft) entries.set(object.objectId, {properties: object, raw: rawOf(object), removed: false, invalid: false, error: null, editedField: null});
    for (const object of applied) if (!entries.has(object.objectId)) entries.set(object.objectId, {properties: object, raw: rawOf(object), removed: true, invalid: false, error: null, editedField: null});
  } catch (cause) { sourceError = normalizeRenderEditorError(cause); }
  return {accepted: snapshot.accepted, manualEdit, baseline: snapshot.draftSource, lastOutput: snapshot.draftSource, entries, invalidId: null, sourceError};
}
function parse(binding: Binding): {patch: RenderSceneObjectPatch; errors: Record<string, string>} {
  const values: Record<string, unknown> = {}, errors: Record<string, string> = {};
  for (const key of keys(binding.properties.type)) {
    const raw = binding.raw[key];
    if (key === 'color') {
      if (typeof raw !== 'string' || !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) errors[key] = 'Use #rgb or #rrggbb.';
      values[key] = raw; continue;
    }
    const list = typeof raw === 'string' ? [raw] : raw;
    const numbers = list.map(numeric);
    numbers.forEach((value, axis) => {
      const field = vectorKeys.has(key) ? `${key}.${axis}` : key;
      if (!Number.isFinite(value)) errors[field] = 'Enter a finite decimal number.';
      else if (key === 'rotateDegrees' && Math.abs(value) > 360) errors[field] = 'Use degrees from -360 to 360.';
      else if (['translate', 'start', 'end'].includes(key) && Math.abs(value) > 1000) errors[field] = 'Use a value from -1000 to 1000.';
      else if (!['translate', 'start', 'end', 'rotateDegrees'].includes(key) && (value <= 0 || value > 1000 || Math.fround(value) <= 0)) errors[field] = 'Use a positive value up to 1000.';
    });
    values[key] = vectorKeys.has(key) ? numbers : numbers[0];
  }
  return {patch: values as RenderSceneObjectPatch, errors};
}

interface SceneObjectInspectorProps {
  controller: RenderEditorController; manualEdit: number; onEditSource: () => void;
  onHelp?: () => void; onError?: (error: RenderEditorError) => void;
  onInvalidObject: (id: string | null, sourceCorrection?: boolean) => void;
}

/** Accepted-ID forms stay mounted. One incomplete object's text owns the global guard. */
export function SceneObjectInspector({controller, manualEdit, onEditSource, onHelp, onError, onInvalidObject}: SceneObjectInspectorProps) {
  const snapshot = useSyncExternalStore(controller.session.subscribe, controller.session.getSnapshot, controller.session.getSnapshot);
  const [stored, setStored] = useState(() => readStore(snapshot, manualEdit));
  const store = useRef(stored);
  const changed = stored.accepted !== snapshot.accepted || stored.manualEdit !== manualEdit || stored.lastOutput !== snapshot.draftSource || (stored.invalidId !== null && !snapshot.objectInputInvalid);
  const current = changed ? readStore(snapshot, manualEdit) : stored;
  if (changed) { store.current = current; setStored(current); }
  const change = (id: string, field: string, text: string, axis?: number) => {
    const state = controller.session.getSnapshot(), previous = store.current, old = previous.entries.get(id);
    if (state.disposed || !old || old.removed || previous.sourceError || (previous.invalidId && previous.invalidId !== id) || text.length > 256) return;
    const raw = {...old.raw};
    if (axis === undefined) raw[field] = text;
    else { const vector = [...raw[field]] as [string, string, string]; vector[axis] = text; raw[field] = vector; }
    const nextBinding = {...old, raw, invalid: false, error: null as RenderEditorError | null, editedField: axis === undefined ? field : `${field}.${axis}`};
    const entries = new Map(previous.entries); entries.set(id, nextBinding);
    const next = {...previous, entries, invalidId: null as string | null};
    const publish = (value: Store) => { store.current = value; setStored(value); };
    try {
      const parsed = parse(nextBinding);
      if (Object.keys(parsed.errors).length) {
        entries.set(id, {...nextBinding, invalid: true}); next.invalidId = id;
        publish(next); onInvalidObject(id); controller.session.setDraftObjectSource(null); return;
      }
      let output = previous.baseline;
      for (const [objectId, binding] of entries) if (!binding.removed) output = editRenderSceneObjectSource(output, objectId, parse(binding).patch);
      publish({...next, lastOutput: output}); onInvalidObject(null);
      controller.session.setDraftObjectSource(output);
    } catch (cause) {
      const error = normalizeRenderEditorError(cause);
      entries.set(id, {...nextBinding, invalid: true, error}); publish({...next, invalidId: id}); onInvalidObject(id, error.code === 'DOCUMENT_BYTES');
      try { controller.session.setDraftObjectSource(null); } catch (refusal) { onError?.(normalizeRenderEditorError(refusal)); }
    }
  };
  const selected = snapshot.activeObjectId;
  return <section className="re-camera re-panel re-scene-object-inspector" aria-label="Object properties">
    <div className="re-panel-heading"><h2>Object</h2><span>{snapshot.sourceDirty ? 'Draft' : 'Applied'}</span></div>
    {!selected ? <p className="re-caption">Select an applied object. Add stages a new object for Apply.</p> : null}
    {current.sourceError ? <p className="re-caption">Correct the Scene source to edit object properties.</p> : null}
    {snapshot.metadata.objects.map(object => {
      const binding = current.entries.get(object.id), active = selected === object.id;
      const errors = binding ? parse(binding).errors : {};
      const locked = snapshot.disposed || !binding || binding.removed || current.sourceError !== null || (current.invalidId !== null && current.invalidId !== object.id);
      return <div key={object.id} hidden={!active} data-testid={active ? 'scene-object-fields' : undefined} data-object-id={object.id}>
        <dl className="re-object-summary"><dt>Name</dt><dd>{object.id}</dd><dt>Type</dt><dd>{LABELS[binding?.properties.type ?? object.type]}</dd></dl>
        {binding?.removed ? <p className="re-caption">Removed in draft. Apply or Discard to resolve it.</p> : null}
        {current.invalidId && current.invalidId !== object.id ? <p className="re-caption">Correct {current.invalidId} before editing another object.</p> : null}
        {binding && keys(binding.properties.type).map(field => {
          const label = field === 'translate' ? 'Position · scene units' : field === 'rotateDegrees' ? 'Rotation · degrees' : field === 'size' ? 'Size · scene units' : field === 'start' ? 'Segment start · scene units' : field === 'end' ? 'Segment end · scene units' : field === 'majorRadius' ? 'Major radius · scene units' : field === 'minorRadius' ? 'Minor radius · scene units' : field === 'color' ? 'Color · opaque hex' : `${field === 'radius' ? 'Radius' : 'Height'} · scene units`;
          const raw = binding.raw[field];
          const input = (value: string, axis?: number) => {
            const key = axis === undefined ? field : `${field}.${axis}`;
            const error = errors[key] ?? (binding.error && binding.error.code !== 'DOCUMENT_BYTES' && binding.editedField === key ? 'Check this value against the other dimensions.' : undefined);
            const name = field === 'translate' ? 'position' : field === 'rotateDegrees' ? 'rotation' : field;
            const id = `scene-${object.id}-${name}${axis === undefined ? '' : `-${axis}`}`;
            return <div className="re-scene-property-field" key={key}><input id={id} type="text" inputMode={field === 'color' ? undefined : 'decimal'} maxLength={256} disabled={locked} value={value} aria-label={`Object ${name}${axis === undefined ? '' : ` ${['X', 'Y', 'Z'][axis]}`}`} data-testid={active ? `object-${name}${axis === undefined ? '' : `-${['x', 'y', 'z'][axis]}`}` : undefined} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={event => change(object.id, field, event.target.value, axis)} />{error && <p id={`${id}-error`} className="re-scene-field-error">{error}</p>}</div>;
          };
          return vectorKeys.has(field) ? <fieldset key={field}><legend>{label}</legend><div className="re-scene-vector">{(raw as [string, string, string]).map((value, axis) => <label key={axis}><span>{['X', 'Y', 'Z'][axis]}</span>{input(value, axis)}</label>)}</div></fieldset>
            : <div className="re-scene-scalar" key={field}><label htmlFor={`scene-${object.id}-${field}`}>{label}</label>{input(raw as string)}</div>;
        })}
        {binding?.error ? <div className="re-scene-source-error"><p>{binding.error.code === 'DOCUMENT_BYTES' ? 'The source has no room for this change. Edit source or correct the fields.' : 'This object change was refused. Correct its dimensions or edit source.'}</p><details><summary>Details</summary><pre>{binding.error.message}</pre></details></div> : null}
      </div>;
    })}
    <div className="re-sphere-actions"><button type="button" disabled={snapshot.disposed} onClick={onEditSource}>Edit source</button>{onHelp && <button type="button" onClick={onHelp}>Object properties Help</button>}</div>
    {!onHelp && <details className="re-mixed-help"><summary>Help: Object properties</summary><p>Position and dimensions use scene units. Rotation uses local degrees, X then Y then Z. Edits stay drafts until complete Apply. Hidden incomplete fields block Apply and file actions. Editing Source replaces those field drafts.</p></details>}
  </section>;
}
