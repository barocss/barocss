# Extrude

Turns one supported closed profile into a solid using the existing Model extrusion. Sketch lowering is internal storage; there is no public sketch prop.

Import `Extrude` from `@barocss/cad-react`. This private experimental workspace API is not a published installable package.

## Props and output

| Prop | Input/default | Meaning |
|---|---|---|
| `distance` | Required finite nonzero number | Signed extrusion height in millimetres; no default. |
| `from` | Optional finite number | Local starting coordinate; omission preserves the existing backend default at the local origin. |
| `children` | Exactly one realized profile | Exclusive with profile. |
| `profile` | ProfileRef | Exclusive with children. |
| `ref` | Optional SolidRef | Reuse the resulting solid within this Part. |

## Example

```tsx
import { Extrude, Rectangle } from '@barocss/cad-react';

export function Floor() {
  return <Extrude from={0} distance={6}>
    <Rectangle min={[0,0]} max={[80,60]} />
  </Extrude>;
}
```

Insert the returned composition as the single output of a Part with a connected lifecycle. Any Definitions in the example remain logical siblings of that output; Target/Tools are used only inside Difference.

## Composition and validation

Extrude accepts Rectangle/Circle/Polygon output and, in the D509 implementation, Loop/Profile output, including a compatible output returned by a synchronous wrapper or resolved ProfileRef. ExtrudeProps names the public exclusive-input type. The result can feed Union, Difference or a rigid transform.

Zero/nonfinite distance or nonfinite from refuses. Both child and profile, multiple profiles, a solid token as profile, and arbitrary face/region descriptors refuse. Surface/face extrusion supported elsewhere in Studio is not automatically admitted here.

## References and identity

The result is a solid handle of kind extrude. Feature IDs and the profile sketch linkage are automatic; source props do not expose native node indices.

## Measured boundary

The Polygon producer uses the same profile child/ref contract. D504 qualifies the selected convex pentagon at widths 60 and 80 mm and an extrusion height of 8 mm, with current native, Worker, Viewer and returned-document Studio evidence. Other outlines remain outside that physical proof. Numeric declaration checks do not replace native outline validity.

The measured Bracket uses floor6, wall56 and declared overcut tools, with original widths80/100 and selected W80 transforms. Positive/negative distance input support is not a runtime certificate for all heights/directions.

The complete code block uses current public exports; its extracted type-check result is recorded separately. Type/compiler checks do not by themselves evaluate this standalone example as a new native case. Read the [component catalog](/packages/cad-react/components), [refs and compiler](/packages/cad-react/references), [engine integration](/packages/cad-react/engine-viewer) and [current support limits](/packages/cad-react/limits).

## D509 profile composition

D509 implements Loop, LineSegment, ArcSegment, Profile, Outer and Voids. The existing thirteen logical elements remain; the package now has nineteen. The 76 source-checkpoint controls (65 reused with unchanged inputs and 11 newly run), package/API types, lint and four semantic mutation controls pass. The selected all-six SegmentedProfiledPlate passes four original Viewer states and native proof. Returned-document Studio Open/F and the separate compound-metadata consumer pass at their saved source checkpoints. Current-source Studio continuation and fresh documentation verification are recorded separately from geometry evidence.

Loop and Profile produce closed-profile data. Outer/Voids and LineSegment/ArcSegment are structural descriptors, not extra native features. Extrude.profile, old Rectangle/Circle/Polygon lowerings and staged identities remain compatible. Exact circle conversion uses the existing helper with no sampling. Regions, arbitrary plane/face inputs, constraints and Sweep/Loft adapters remain unexported. Holed Revolve keeps its own native admission and remains physically unqualified by this Extrude case. No universal contact/containment repair or refusal is promised. Part remains one logical Model result that can contain multiple native pieces.
