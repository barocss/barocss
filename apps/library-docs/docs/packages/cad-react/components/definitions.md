# Definitions

Declares reusable profiles and solids without adding independent Part outputs. It is a logical registry group, not a native modeling operation.

Import `Definitions` from `@barocss/cad-react`. This private experimental workspace API is not a published installable package.

## Props and output

| Prop | Input/default | Meaning |
|---|---|---|
| `children` | Required ReactNode | Supported profile or solid declarations with optional typed object refs. |

## Example

```tsx
import * as React from 'react';
import { Definitions, Circle, Extrude, type ProfileHandle } from '@barocss/cad-react';

export function SharedProfile() {
  const profile = React.useRef<ProfileHandle|null>(null);
  return <>
    <Extrude profile={profile} distance={20} />
    <Definitions><Circle ref={profile} center={[0,0]} radius={4} /></Definitions>
  </>;
}
```

Insert the returned composition as the single output of a Part with a connected lifecycle. Any Definitions in the example remain logical siblings of that output; Target/Tools are used only inside Difference.

## Composition and validation

Place Definitions alongside the single Part output. A consumer may appear earlier in JSX: the compiler resolves references in the committed graph. Use ProfileRef for an extrusion source and SolidRef for a target or transform source.

Rectangle, Circle and Polygon, plus candidate Loop and Profile, can declare profile tokens in this group. A synchronous ordinary component can pass its optional ref to Polygon. D504 controlled tests cover Polygon forward references through ordinary React components. This reference support does not qualify every native outline.

Definitions alone is not a Part solid output. Missing, duplicate, cross-Part, wrong-kind and cyclic references refuse. Callback refs and ref.current are not dependency tokens. Definitions has no own ref or native-ID prop.

## References and identity

React.useRef creates the supported object token; no useGeometryRef hook is exported. Handles expose kind metadata only. Reuse does not create persistent source-code links after saved-document reload.

## Measured boundary

Controlled compiler and real ReactDOM tests cover forward refs, scoped lookup, typed kinds and invalid retention. No separate unmeasured native face/region producer is added by this registry.

The complete code block uses current public exports; its extracted type-check result is recorded separately. Type/compiler checks do not by themselves evaluate this standalone example as a new native case. Read the [component catalog](/packages/cad-react/components), [refs and compiler](/packages/cad-react/references), [engine integration](/packages/cad-react/engine-viewer) and [current support limits](/packages/cad-react/limits).

## D509 source candidate

Loop and Profile are additional closed-profile producers in the proposed source candidate; Outer/Voids provide explicit single-loop slots, and LineSegment/ArcSegment provide exact ordered Loop descriptors. Regions, arbitrary plane/face inputs, constraints and Sweep/Loft adapters remain unexported. Extrude.profile and old primitive lowerings remain compatible. Revolve holes retain their existing operation-specific native admission, with no new physical qualification. No universal containment/contact repair or refusal is promised. New execution is NOT_RUN. Part denotes one declared logical Model result, which can contain multiple native pieces; refs do not select a connected piece.
