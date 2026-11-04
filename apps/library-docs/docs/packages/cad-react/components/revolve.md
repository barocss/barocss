# Revolve

Revolve turns one closed profile into a solid through the existing CAD Model revolve node. Provide a profile, a sketch axis and an angle. The result is a solid that other operations can use. The selected rectangle example below has current browser, native geometry and Studio Open evidence.

Import `Revolve` from `@barocss/cad-react`. The package is private, version `0.0.0-experimental`; it is not a published portable install.

## Props and output

| Prop | Input/default | Meaning |
|---|---|---|
| `axis` | Required `x` or `y` | Axis in the existing sketch plane convention. |
| `angle` | Required finite number greater than 0 and at most 360 | Degrees. There is no adapter default. |
| `origin` | Optional readonly `[x,y]` | Explicit finite sketch coordinates in mm; omission stays omitted. Existing backend supplies `[0,0]`. |
| `children` | One realized profile | Exclusive with `profile`. |
| `profile` | Typed ProfileRef | Exclusive with children; scoped to the same Part. |
| `ref` | Optional SolidRef | Resulting solid handle has kind `revolve`. |

## Example

```tsx
import { Rectangle, Revolve } from '@barocss/cad-react';

export function RevolvedSection({ angle = 90 }: { angle?: number }) {
  return <Revolve axis="y" angle={angle}>
    <Rectangle min={[10,20]} max={[20,50]} />
  </Revolve>;
}
```

Place this composition as the single output inside a Part with a connected lifecycle. It lowers to an automatically identified sketch and revolve node. The React component and profile references are logical declarations, not public native sketch IDs.

## Composition and validation

Rectangle, Circle and Polygon are the prior closed profile adapters. The D509 implementation adds Loop/Profile sources; holed Revolve remains subject to its separate native limits and is not physically qualified by the selected Extrude case. Use one child or one profile reference. Definitions can hold a referenced profile; Boolean operations and Translate/Rotate can consume the resulting solid. Declaration tests for those combinations do not qualify every combination as a native physical case.

Angles that are zero, negative, nonfinite or greater than 360° are refused. Invalid axes, sparse/nonfinite explicit origins, missing/wrong-kind references, mixed child/ref and wrong cardinality refuse. Staged native IDs commit only on accepted compilation. Compiler refusal retains its prior accepted source; ModelHost invalidation clears its current desired document. A stale visible shape does not establish current acceptance.

Polygon can feed this profile contract, but no Polygon Revolve physical certificate is claimed by D504.

There is no public sketch ID, arbitrary vector axis, direction, selected face, open wire or native-face provider prop. Existing backend geometry restrictions still apply.

## Runtime boundary

The actual checks use only the rectangle shown above, the y axis and the omitted origin. They measure 90°, 180° and 360°, then use Reset to return to 90°. Source review confirms the existing convention sweeps this positive-X rectangle toward positive Z. Partial states have radial end caps and genus 0; the full 360° state has no radial end caps and genus 1. Current native B-reps satisfy those distinct partial/full topology contracts. Output mass and independent B-rep mass agree with the polar integral: volumes of 2250π, 4500π and 9000π mm³; centroids `[k,35,k]`, `[0,35,k]`, `[0,35,0]`, with `k=280/(9π)` mm. Native relative volume and absolute centroid/boundary/normal budgets remain 1e-9.

The browser uses working Angle and Reset controls, public group collapse/reopen and a 1200 ms idle sample. Those panel actions preserve the exact document and current geometry ownership. Reset returns the exact original document and rendered frame. Public Studio Open and Frame all consume that returned 90° document with fresh root Worker values. Three native captures plus two exact 90° subproof reuses bind five fresh consumers; they are not five native captures.

The standalone code block is the measured geometry recipe, but the physical proof also depends on the current connected host and source pins. The x axis, Circle, explicit origin and downstream combinations remain outside actual physical qualification until separately measured. D463 is historical Studio evidence; it is not current React native proof. No new kernel algorithm, tolerance, face/UV, asynchronous admission or general SDK guarantee follows.

## D509 profile composition

D509 implements Loop, LineSegment, ArcSegment, Profile, Outer and Voids. The existing thirteen logical elements remain; the package now has nineteen. The 76 source-checkpoint controls (65 reused with unchanged inputs and 11 newly run), package/API types, lint and four semantic mutation controls pass. The selected all-six SegmentedProfiledPlate passes four original Viewer states and native proof. Returned-document Studio Open/F and the separate compound-metadata consumer pass at their saved source checkpoints. Current-source Studio continuation and fresh documentation verification are recorded separately from geometry evidence.

Loop and Profile produce closed-profile data. Outer/Voids and LineSegment/ArcSegment are structural descriptors, not extra native features. Extrude.profile, old Rectangle/Circle/Polygon lowerings and staged identities remain compatible. Exact circle conversion uses the existing helper with no sampling. Regions, arbitrary plane/face inputs, constraints and Sweep/Loft adapters remain unexported. Holed Revolve keeps its own native admission and remains physically unqualified by this Extrude case. No universal contact/containment repair or refusal is promised. Part remains one logical Model result that can contain multiple native pieces.
