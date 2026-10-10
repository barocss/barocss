# Render: validate a screen and mount a controlled form

Render here is the React screen contract. It is separate from GPU scene rendering and the proposed native renderer work. The local manifest selects `dist`, not source. Historical npm0.12.0 publication does not prove later local0.12.0 APIs have the same payload.

## Task 1 — validate authored data and reject an unknown root

Use the existing repository build runtime and React19.2.3 peer. Build the clean local package before importing its actual compiled entry:

```sh
pnpm --filter @barocss/render build:library
node --input-type=module <<'JS'
import { validateSpec, getRenderSpecDefinition, classesFor } from './packages/barocss-render/dist/index.js';
const screen = {
  root: 'layout',
  elements: {
    layout: { type: 'Layout', props: { id: 'layout', columns: 'single', gap: 'fractional' }, children: ['heading'] },
    heading: { type: 'Text', props: { id: 'heading', text: 'Profile' }, children: [] },
  },
};
console.log(validateSpec(screen));
console.log(classesFor(screen.elements.layout));
console.log(getRenderSpecDefinition().definitionVersion);
console.log(validateSpec({ ...screen, root: 'absent' }));
JS
```

Run from the repository root. Importing built root requires the host's existing React peer resolution. A missing peer or missing `dist/index.js` is a setup failure, not a reason to reinterpret Render as a source-default package. The source-only manual runner intentionally excludes Render.

Expected values: first `{ok:true,errors:[]}`, classes `grid grid-cols-1 gap-2.5`, descriptor version1, and finally `ok:false` with a `root` validation path. The descriptor version is not package version. Validation does not repair input or render HTML. The host retains its accepted screen when the proposal fails.

This task is a runnable compiled-entry recipe. It was not executed in the #1270 six-package source-snippet checkpoint; that checkpoint contains no Render output or peer/build acceptance.

## Task 2 — own the component registry, input and save callback

In an existing React19.2.3/React DOM19.2.3 TSX host, build Render as above and make the actual built package root available as your declared workspace dependency. Use the host's normal Vite/dev command. For a small local Vite host in `examples/workspace-source`, create `render-form.html` with `<div id="root"></div><script type="module" src="/render-form.tsx"></script>`, and save the complete module below as `render-form.tsx`.

```sh
pnpm exec vite examples/workspace-source --host 127.0.0.1 --port 52937 --strictPort
```

That host needs its own installed React peers and the existing Vite runtime. The relative import below selects exactly the locally built public root; it does not alias an internal source helper. Open the printed URL's `/render-form.html`. Keep another process if the strict port is occupied.

```tsx
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Renderer, classesFor } from '../../packages/barocss-render/dist/index.js';
import type { ComponentRegistry, ScreenSpec } from '../../packages/barocss-render/dist/index.js';
const screen: ScreenSpec = {
  root: 'layout', elements: {
    layout: { type: 'Layout', props: { id: 'layout', columns: 'single', gap: 'fractional' }, children: ['card'] },
    card: { type: 'Card', props: { id: 'card', padding: 'fractional', tone: 'light' }, children: ['heading', 'name', 'save'] },
    heading: { type: 'Text', props: { id: 'heading', text: 'Profile' }, children: [] },
    name: { type: 'Input', props: { id: 'name', label: 'Name', value: { $bindState: '/name' } }, children: [] },
    save: { type: 'Button', props: { id: 'save', label: 'Save profile' }, children: [], on: { press: { action: 'save' } } },
  },
};
const components: ComponentRegistry = {
  Layout: ({ node, children }) => <section className={classesFor(node)}>{children}</section>,
  Card: ({ node, children }) => <article className={classesFor(node)}>{children}</article>,
  Text: ({ node }) => <p>{node.props.text}</p>,
  Input: ({ node, state, setState }) => <label>{node.props.label}<input
    value={state.name} onChange={event => setState({ name: event.target.value })} /></label>,
  Button: ({ node, onAction }) => <button type="button" onClick={onAction}>{node.props.label}</button>,
};
function App() {
  const [state, setState] = useState({ name: 'Ada' });
  const [saved, setSaved] = useState('');
  return <><Renderer spec={screen} components={components} state={state} setState={setState}
    actions={{ save: () => setSaved(state.name) }} /><output>{saved}</output></>;
}
const root = createRoot(document.getElementById('root')!);
root.render(<App />);
window.addEventListener('pagehide', () => root.unmount(), { once: true });
```

Expect Profile, an input initially containing Ada, and Save profile. Change the name to Grace and activate Save profile: output becomes Grace. Input/state/action functions belong to the host, not JSON. Missing/inherited/non-function used action registration throws before activation. Catch rendering failures in a host error boundary; do not overwrite last-valid-screen state during correction.

This minimal host has ordinary unstyled HTML. Fixed class strings become styled only when the host starts the existing [Browser CSS runtime](/packages/browser/). Render never starts that runtime. Unmount React and destroy host CSS/listeners when closing the document.

For full JSON proposal retention, use `packages/barocss-render/examples/profile-form.tsx`, which includes parsing, validator paths and accepted-screen storage. For declared multi-field transitions, use `packages/barocss-render/examples/request-form.tsx`. No model/backend is required for either authored form.

[The CAD/GPU playground](/playground) draws a different kind of scene. Its GPU screenshot does not establish React form, state, focus or callback behavior.

Source pin: `5f5ad866205a21510ac69552e704cc162fa253b5`. [API](./api) · [Exact public reference](./reference) · [Limits and errors](./limits).
