# Validate a screen before rendering

Build the existing local artifact from the repository root. Use React 19.2.3 in your TSX host. The host also supplies React DOM.

```sh
pnpm --filter @barocss/render build:library
```

```ts
import { validateSpec, getRenderSpecDefinition } from '@barocss/render';
import type { ScreenSpec } from '@barocss/render';

const screen: ScreenSpec = {
  root: 'layout',
  elements: {
    layout: { type: 'Layout', props: { id: 'layout', columns: 'single',
      gap: 'fractional' }, children: ['heading'] },
    heading: { type: 'Text', props: { id: 'heading', text: 'Profile' }, children: [] },
  },
};
const checked = validateSpec(screen);
if (!checked.ok) throw new Error(checked.errors[0].path);
const definition = getRenderSpecDefinition();
console.log(definition.definitionVersion, checked.ok);
```

This checks an authored screen and reads a copied contract descriptor. It does not mount React or start CSS. For a working form, copy the [profile-form example](./examples) into your React application. Register all five component functions and pass controlled state, `setState` and a callable own `save` property to `Renderer`.

Validate the inner screen object after parsing your response envelope. `ok` is not a TypeScript type guard. Keep your previous accepted screen when validation fails. Catch rendering errors in a host error boundary. See [host declarations](./guides#declare-bindings-and-actions).

`packages/barocss-render/package.json` (Manifest and version; local source) · `packages/barocss-render/README.md` (Package task notes; local source)
