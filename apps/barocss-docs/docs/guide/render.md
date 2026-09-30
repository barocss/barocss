---
title: Experimental React renderer
description: Application-owned profile forms from strictly validated screen specs
---

# Experimental React renderer

::: warning Staged release — not yet available on npm
`@barocss/render` is prepared for its first public release. Do not install the current published
BaroCSS version as a renderer version. Use the local build below until publication is verified.
The existing browser, server and kit installation guides retain their published version.
:::

The renderer accepts an inner screen object and calls five application-owned React components.
It does not call a model or create components from HTML, JavaScript or CSS. This is an experimental
profile-form contract, not a general-purpose UI schema. See the [API contract](/api/render).

## Local installation while staged

Build from the repository, then install the resulting tarball in your React application:

```sh
pnpm --filter @barocss/render build:library
cd packages/barocss-render
pnpm pack
# Run these in the consuming application. Replace VERSION with the packed version.
pnpm add /path/to/barocss-render-VERSION.tgz react@19.2.3 react-dom@19.2.3
pnpm add @barocss/browser@__BAROCSS_VERSION__
pnpm add -D typescript @types/react @types/react-dom
```

React 19.2.3 is the supported peer; React DOM and a TSX bundler belong to the host.
The package exports ESM JavaScript and types at its root. CommonJS is unsupported.

## Complete authored form example

Copy this into `profile-form.tsx`. It defines the complete spec, registry, input state, validation
error list and save callback. Invalid JSON/spec data leaves the previous valid screen in place.
The renderer receives the **inner object**; the host parses any outer model response separately.
This example makes no model call.

```tsx
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
```

## Start BaroCSS in the application

Copy this into `main.tsx`, supply `<div id="root"></div>` in your HTML and use your normal React
bundler. CSS generation is owned by the browser runtime; the renderer does not start it.

```tsx
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRuntime } from '@barocss/browser';
import { ProfileForm } from './profile-form';

function App() {
  useEffect(() => {
    const runtime = new BrowserRuntime();
    runtime.observe(document.body, { scan: true });
    return () => runtime.destroy();
  }, []);
  return <ProfileForm onSave={(snapshot) => console.log(snapshot.name)} />;
}
createRoot(document.getElementById('root')!).render(<App />);
```

Enter a name, press **Save profile**, then edit the JSON heading. Stable IDs and positions preserve
the controlled input during a complete-screen update. Moving or replacing a node can remount it;
the host owns state and focus. This is not a streamed-patch API.
