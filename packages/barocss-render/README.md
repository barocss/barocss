# @barocss/render

An experimental, ESM-only React renderer for a validated profile-form screen contract.
The application supplies five component functions, state and actions. The package does not call
an AI model, parse a response envelope, open a network connection, or start a CSS runtime.
This is a narrow experimental API, not a general UI schema or a stable component library.

## Release status

The first public release is **staged and not yet published**. Until publication is independently
verified, build from this repository or use a local packed artifact. The development version is
not an npm installation recommendation. The release owner will replace this notice with the
verified installation version after publication.

```sh
pnpm --filter @barocss/render build:library
cd packages/barocss-render
pnpm pack
# In a separate application, install the resulting .tgz together with its peers.
pnpm add /path/to/barocss-render-VERSION.tgz react@19.2.3 react-dom@19.2.3
pnpm add -D typescript @types/react @types/react-dom
```

After publication, install the verified `@barocss/render` version and a compatible published
`@barocss/browser`. React **19.2.3** is the supported external peer. The host supplies React DOM.
Package root exports contain built JavaScript and TypeScript declarations, not repository JSX.
CommonJS `require` is not supported.

```tsx
import { Renderer, validateSpec, classesFor } from '@barocss/render';
import type { ComponentRegistry, FormState, ScreenSpec } from '@barocss/render';
```

Copy [examples/profile-form.tsx](./examples/profile-form.tsx) into a React application.
It includes an authored screen spec, all five registered component functions, controlled input,
a named save callback, JSON validation errors and retention of the last valid screen.
It uses no model or backend. Start BaroCSS in the host, once per mounted application:

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

Supply `<div id="root"></div>` in the host HTML and use the application's normal TSX bundler.
For CSS startup, add the published browser package or its local packed artifact. The renderer
never starts or owns that runtime.

## API and ownership

- `validateSpec(value: unknown)` returns `{ ok, errors: { path, message }[] }`. Pass the **inner
  screen object**, after the host parses any JSON string or outer response envelope. It does no
  repair or normalization and is not a TypeScript type guard. After `ok`, a typed host may cast
  the candidate to `ScreenSpec`. Validation errors belong to the host.
- `Renderer({ spec, components, state, setState, actions })` validates again and renders the
  registered components. It throws on invalid data or a missing used component. It is not an
  error boundary and does not retain the previous screen. The host owns last-valid-screen storage.
- `classesFor(node)` maps already validated Layout/Card choices to fixed BaroCSS utilities;
  other nodes return an empty string. It is not a validator. Register ordinary React component
  functions/classes; object-valued `memo` or `forwardRef` registrations are unsupported.

The host owns form state (`FormState` defaults to `{ name: string }`), `setState`, the callable
`save` action, all component HTML, BaroCSS startup, and any transport/session/cancellation policy.
The renderer does not validate state values or action functions. Stable node IDs become React
keys; retaining IDs and positions can preserve an input across complete-screen updates. Moving
or replacing a node can remount it. The host owns state and focus.

## Accepted screen contract

Only `root` and `elements` are accepted. There must be 2–32 nodes; root is a Layout. IDs match
`[a-z][a-z0-9-]{0,31}` and each node's `props.id` matches its key. References must exist; every
non-root node has one parent, all nodes are reachable and cycles fail. Unknown fields, props
and types fail. Text and labels contain 1–300 characters.

| Component | Props in addition to `id` | Children / action |
| --- | --- | --- |
| Layout | `columns`: responsive or single; `gap`: fractional or wide | Node ID array |
| Card | `padding`: fractional or spacious; `tone`: light or dark | Node ID array |
| Text | `text` | Empty array |
| Input | `label`; `value: { "$bindState": "/name" }` | Empty array |
| Button | `label` | Empty array; `on: { "press": { "action": "save" } }` |

Types describe shapes; they cannot prove graph structure, counts, matching IDs, text length or
validity of untrusted data. Always run the runtime validator. JSON cannot supply component
functions, arbitrary HTML, JavaScript, CSS, class names, external URLs or executable actions.
Host components can add fixed authored utility classes and render text as ordinary React children.

## Repository verification

```sh
pnpm --filter @barocss/render build:library
pnpm --filter @barocss/render test
node .github/scripts/check-packages.mjs
```

The packed-package check imports all three exports and type-checks an isolated consumer.
The optional `test:consumer` also tests browser input, save, validation rejection and last-valid
screen retention. It needs already installed React DOM, React types and Playwright/Chromium.
Set `REPO_DEPS_ROOT`, `REACT_ROOT`, `REACT_TYPES_ROOT`, and `PW_DIR` only if those assets are outside
this checkout. No browser download or model call is part of these checks. Authored fixtures show
this contract's behavior; they do not establish model performance or arbitrary UI support.
