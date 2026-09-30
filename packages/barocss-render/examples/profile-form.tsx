import { useState } from 'react';
import { Renderer, classesFor, validateSpec } from '@barocss/render';
import type { ComponentRegistry, FormState, ScreenSpec, ValidationError } from '@barocss/render';

// Authored data, equivalent to the existing profile-form fixture. Not a model response.
export const FORM_SPEC: ScreenSpec = {
  root: 'layout',
  elements: {
    layout: { type: 'Layout', props: { id: 'layout', columns: 'responsive', gap: 'fractional' }, children: ['card'] },
    card: { type: 'Card', props: { id: 'card', padding: 'fractional', tone: 'light' }, children: ['heading', 'name', 'save'] },
    heading: { type: 'Text', props: { id: 'heading', text: 'Profile settings' }, children: [] },
    name: { type: 'Input', props: { id: 'name', label: 'Name', value: { $bindState: '/name' } }, children: [] },
    save: { type: 'Button', props: { id: 'save', label: 'Save profile' }, children: [], on: { press: { action: 'save' } } },
  },
};

// The application creates HTML and owns this registry. JSON cannot replace these functions.
const components: ComponentRegistry = {
  Layout: ({ node, children }) => <section data-node-id={node.props.id} className={classesFor(node)}>{children}</section>,
  Card: ({ node, children }) => <article data-node-id={node.props.id} className={classesFor(node)}>{children}</article>,
  Text: ({ node }) => <p data-node-id={node.props.id}>{node.props.text}</p>,
  Input: ({ node, state, setState }) => <label>{node.props.label}
    <input aria-label={node.props.label} value={state.name}
      onChange={(event) => setState((old) => ({ ...old, name: event.target.value }))} />
  </label>,
  Button: ({ node, onAction }) => <button type="button" onClick={onAction}>{node.props.label}</button>,
};

export function ProfileForm({ onSave }: { onSave: (snapshot: FormState) => void }) {
  const [acceptedSpec, setAcceptedSpec] = useState(FORM_SPEC);
  const [state, setState] = useState<FormState>({ name: 'Ada' });
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [saved, setSaved] = useState('');

  function applyJson(raw: string) {
    let candidate: unknown;
    try { candidate = JSON.parse(raw); }
    catch { setErrors([{ path: '$', message: 'Invalid JSON' }]); return; }
    const result = validateSpec(candidate);
    setErrors(result.errors);
    // validateSpec reports errors; it is not a TypeScript assertion or an output-repair function.
    if (result.ok) setAcceptedSpec(candidate as ScreenSpec);
  }
  const actions = { save: () => {
    onSave({ ...state });
    setSaved(state.name);
  } };
  return <>
    <textarea aria-label="Screen JSON" defaultValue={JSON.stringify(FORM_SPEC)}
      onChange={(event) => applyJson(event.target.value)} />
    <ul aria-label="Validation errors">{errors.map(({ path, message }, index) =>
      <li key={`${path}-${index}`}>{path}: {message}</li>)}</ul>
    <Renderer spec={acceptedSpec} components={components} state={state} setState={setState} actions={actions} />
    <output aria-label="Saved name">{saved ? `Name: ${saved}` : ''}</output>
  </>;
}
