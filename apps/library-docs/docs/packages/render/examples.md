# Render: validate screen data and own form behavior

Render composes host-supplied React components from a bounded screen object. The host owns HTML, state, input bindings, callable actions and CSS startup. It is separate from GPU Scene rendering.

Use the package's built ESM root with React 19.2.3; the application supplies React DOM and a TSX bundler. This package's default root selects built JavaScript rather than workspace TypeScript source. Use an artifact containing the documented exports; a version string alone does not establish that a later local API change matches an earlier published artifact.

## Validate an inner screen object

```ts
import { validateSpec, getRenderSpecDefinition, classesFor } from '@barocss/render';
import type { ScreenSpec } from '@barocss/render';
const screen: ScreenSpec = {
  root: 'layout', elements: {
    layout: { type: 'Layout', props: { id: 'layout', columns: 'single', gap: 'fractional' }, children: ['heading'] },
    heading: { type: 'Text', props: { id: 'heading', text: 'Profile' }, children: [] },
  },
};
const validation = validateSpec(screen);
console.log(validation); // {ok:true,errors:[]}.
console.log(classesFor(screen.elements.layout)); // grid grid-cols-1 gap-2.5.
console.log(getRenderSpecDefinition().definitionVersion); // 1.
```

Parse any transport envelope in the host, then validate the inner screen. A missing root or unsupported field produces error paths. Validation does not repair data, execute actions or render a component. It is not a TypeScript type guard. Retain your last accepted screen when a new proposal fails, and pass the same host contract to validation and rendering.

The definition is detached descriptive data. Its version 1 is a metadata format version, separate from package version or permission authority. Editing it cannot extend the accepted component set.

## Mount a complete controlled form

In an ordinary TSX browser host, supply `<div id="root"></div>` and make the following module its entry:

```tsx
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Renderer, classesFor } from '@barocss/render';
import type { ComponentRegistry, ScreenSpec } from '@barocss/render';

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

The form starts with Ada. Change the input to Grace and activate Save profile; the output becomes Grace. JSON declares `/name` and `save`, while the registered component and action implement the actual state access and callback. Render never traverses state or calls a backend. This is a host integration recipe; the GPU playground does not verify its form/focus behavior.

## Own permissions, errors and lifetime

Declare alternate binding paths/action names in one host `RenderContract`. Use that same contract with `validateSpec` and `Renderer`. Generated data cannot grant itself a component function or an undeclared action. Used actions must be own data properties containing functions; inherited/accessor/missing callbacks fail before activation.

Register ordinary function/class React components. Object-valued memo/forwardRef registrations are unsupported by this renderer. Stable node IDs become React keys; moving or replacing nodes can still remount them. The host owns controlled state and focus.

`Renderer` validates again and can throw. Use a host error boundary and keep last-valid-screen state; the renderer is not a storage manager or recovery boundary. `classesFor` supplies fixed utility strings for validated Layout/Card nodes. Start the [Browser CSS runtime](/packages/browser/) separately if you want those utilities styled. Without it, the example remains ordinary unstyled HTML. Unmount React and destroy host-owned CSS/listeners when closing the application.
