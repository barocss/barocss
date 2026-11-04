# Circle

A closed circular profile in local XY. It lowers to existing sketch storage for extrusion, not to a solid hole feature by itself.

Import `Circle` from `@barocss/cad-react`. This private experimental workspace API is not a published installable package.

## Props and output

| Prop | Input/default | Meaning |
|---|---|---|
| `center` | Required readonly [x,y] | Finite local XY millimetres. |
| `radius` | Required positive finite number | Radius in millimetres, not diameter. |
| `ref` | Optional ProfileRef | Object token whose handle kind is circle. |

## Example

```tsx
import { Circle, Extrude } from '@barocss/cad-react';

export function CircularTool() {
  return <Extrude from={-1} distance={8}>
    <Circle center={[10,10]} radius={3} />
  </Extrude>;
}
```

Insert the returned composition as the single output of a Part with a connected lifecycle. Any Definitions in the example remain logical siblings of that output; Target/Tools are used only inside Difference.

## Composition and validation

Circle produces a profile. Extrude turns it into a solid; place that solid in Tools to cut a target. Circle alone does not subtract material and does not infer a hole direction or depth.

Nonfinite or nonpositive radius refuses. Supply a dense finite center tuple. A circle profile cannot be supplied where a solid ref or solid child is required. Native circular-face queries and selected planar regions are separate unsupported source capabilities.

## References and identity

A ProfileRef may be forwarded through ordinary components or Definitions. Pass the object token, not ref.current; the handle contains kind metadata, not synchronous native geometry.

## Measured boundary

The four radius3 floor-hole tools in the original and transformed Bracket flows are measured. This is not a certificate for every radius, placement or Boolean arrangement.

The complete code block uses current public exports; its extracted type-check result is recorded separately. Type/compiler checks do not by themselves evaluate this standalone example as a new native case. Read the [component catalog](/packages/cad-react/components), [refs and compiler](/packages/cad-react/references), [engine integration](/packages/cad-react/engine-viewer) and [current support limits](/packages/cad-react/limits).
