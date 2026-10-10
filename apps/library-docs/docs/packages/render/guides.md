# Own form state and screen transitions

## Declare bindings and actions

Declare permissions in host code. Supply the same contract to the validator and the renderer.

```ts
import { validateSpec, getRenderSpecDefinition } from '@barocss/render';
import type { RenderContract } from '@barocss/render';

const contract = {
  textBindings: ['/draft/name', '/draft/topic'],
  actions: ['review', 'edit', 'confirm'],
} as const satisfies RenderContract<string, string>;
const definition = getRenderSpecDefinition(contract);
// candidate is the inner object obtained by your host's JSON parser.
const checkCandidate = (candidate: unknown) => validateSpec(candidate, contract);
console.log(definition.permissions, checkCandidate({}).ok);
```

Use corresponding `ScreenSpec<Binding, Action>` and `ComponentRegistry<State, Binding, Action>` types. The renderer passes the literal binding to your component. Your component reads and writes the declared state field; the renderer never traverses state.

## Retain the accepted screen

Parse → validate → retain the candidate only when `ok` → render with the same host contract. Show paths from `errors` beside the proposed input. A rejected proposal must not overwrite the host's accepted screen. `Renderer` validates again, but does not implement this retention policy.

## Start CSS once

Use the existing [Browser package gateway](/packages/browser/) to start and stop the CSS runtime in the host. `classesFor(node)` returns fixed utilities for validated Layout/Card nodes. Render does not own a BrowserRuntime, DOM observer or server stylesheet.

## Preserve input identity

Keep IDs and positions stable for updates that should retain input instances. Component functions must implement controlled fields with the supplied `state` and `setState`. A named Button callback uses the registered host function captured for that render. Changing a registry property later does not redirect the captured callback.

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render/README.md)
