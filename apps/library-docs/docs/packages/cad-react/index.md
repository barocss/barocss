# CAD React

`@barocss/cad-react` is a private experimental workspace package, version `0.0.0-experimental`. It describes CAD geometry with ordinary React components, lowers the committed geometry to the existing [CAD Model](/packages/cad-model/) document, and can connect an injected engine to the existing [Viewer](/packages/viewer/).

The current package is TypeScript source in this repository. It is not a published npm package, a portable engine client, a distribution build or a standalone Worker. The host application supplies the engine, Worker setup and mass integration. There is no `npm install` quick start for this private checkpoint.

## What you can compose

| Operation | Components | Result |
|---|---|---|
| Closed planar profile | `Rectangle`, `Circle` | Profile input for an extrusion |
| Solid extrusion | `Extrude` | Existing native extrusion of one profile |
| Solid union | `Union` | Join at least two realized solids |
| Ordered subtraction | `Difference`, `Target`, `Tools` | Subtract tools from one target |
| Rigid placement | `Translate`, `Rotate` | Existing Model body-transform nodes |
| Reuse | `Definitions`, typed object refs | Share a declared profile or solid within one Part |
| Model lifecycle | `Part`, `ModelHost` | Commit declarations and coordinate an injected engine |
| Display | `ExistingViewerHost` | Send engine display meshes to the existing Viewer |

Read the [component catalog](/packages/cad-react/components), [references and compiler](/packages/cad-react/references), [engine and Viewer integration](/packages/cad-react/engine-viewer), [examples](/packages/cad-react/examples) and [support boundaries](/packages/cad-react/limits).

## A Part is a model root

```tsx
import {
  Part, Extrude, Rectangle, type ModelLifecycle,
} from '@barocss/cad-react';

export function Plate({ lifecycle }: { lifecycle: ModelLifecycle }) {
  return <Part admission="synchronous" lifecycle={lifecycle} units="mm">
    <Extrude distance={6}>
      <Rectangle min={[0,0]} max={[80,60]} />
    </Extrude>
  </Part>;
}
```

This declaration produces a model. It does not create an engine or a visible canvas by itself. Pass an appropriate lifecycle, such as a connected `ModelHost`, and provide the [display integration](/packages/cad-react/engine-viewer).

React runs normal function components and hooks. Committed hidden DOM markers record membership and sibling order. The compiler does not call your component functions manually and does not infer their output from `React.Children` alone. Native feature IDs are automatic; no manual Sketch IDs or native body references are required.

For the complete existing ModelNode inventory and the missing adapter backlog, read the [CAD Model support map](/packages/cad-react/support-map). Existing backend operations are broader than this first React subset; this page does not claim full CAD React coverage.

## Public entry points

| Entry point | Runtime exports |
|---|---|
| `@barocss/cad-react` | `Part`, `Rectangle`, `Circle`, `Extrude`, `Union`, `Difference`, `Target`, `Tools`, `Definitions`, `Translate`, `Rotate`, `CompositionCompiler`, `IrError` |
| `@barocss/cad-react/engine` | `ModelHost` |
| `@barocss/cad-react/viewer` | `ExistingViewerHost` |

All public type exports are listed with their contracts on the component, references and engine pages. The package exports no custom React hook. Examples use normal `React.useRef`, `React.useState` and effects; these are React APIs, not CAD geometry-query hooks.

## Current evidence

The original package App/Bracket checkpoint measures widths80→100→80 with the real existing Worker/Viewer, exact returned-document/frame identity, a public Studio Open and independent native checks at both widths. Its24 controlled tests and package/API types pass. Those results cover the original declared example, not arbitrary React programs or geometry.

The Translate/Rotate extension has34 controlled tests and package/API types/lint passing. Its selected W80 cardinal transform states and exact returned-document Studio Open have independent native evidence. The current desktop examples add a right inspector with working collapse/reopen, numeric controls, real readiness and Reset. Both Transform and Width examples have fresh UI evidence; [validation limits](/packages/cad-react/limits) distinguish those consumers from reused native proof. API acceptance and finite runtime states remain separate.
