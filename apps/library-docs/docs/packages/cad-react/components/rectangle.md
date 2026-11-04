# Rectangle

A closed axis-aligned profile in the local XY plane. The compiler lowers it to a native sketch-storage record when a consumer needs it; the logical component is a profile producer, not a solid.

Import `Rectangle` from `@barocss/cad-react`. This private experimental workspace API is not a published installable package.

## Props and output

| Prop | Input/default | Meaning |
|---|---|---|
| `min` | Required readonly [x,y] | Finite local XY millimetres. |
| `max` | Required readonly [x,y] | Both coordinates must exceed the corresponding min coordinate. |
| `ref` | Optional ProfileRef | Object token for reuse within this Part; no evaluated geometry is returned. |

## Example

```tsx
import { Rectangle, Extrude } from '@barocss/cad-react';

export function RectangularPlate() {
  return <Extrude distance={6}>
    <Rectangle min={[0,0]} max={[80,60]} />
  </Extrude>;
}
```

Insert the returned composition as the single output of a Part with a connected lifecycle. Any Definitions in the example remain logical siblings of that output; Target/Tools are used only inside Difference.

## Composition and validation

Place Rectangle under Extrude, or declare it in Definitions and pass its ProfileRef to an extrusion. Coordinates are local geometry, not pixel positions or a native face selection.

Zero or reversed extents refuse. Supply dense finite two-coordinate tuples. A Rectangle cannot be a Union/Target/transform solid input and cannot be the sole solid output of Part. No arbitrary polygon, rounded-corner or sketch-constraint prop is exposed.

## References and identity

Its optional ref has kind rectangle. Standard mounted identity and React keys support ID retention; there is no public id or sketch-ID prop.

## Measured boundary

Floor, wall and window-tool rectangles are exercised by the measured Bracket examples. The positive-extents/API contract is broader than those selected measured sizes.

The complete code block uses current public exports; its extracted type-check result is recorded separately. Type/compiler checks do not by themselves evaluate this standalone example as a new native case. Read the [component catalog](/packages/cad-react/components), [refs and compiler](/packages/cad-react/references), [engine integration](/packages/cad-react/engine-viewer) and [current support limits](/packages/cad-react/limits).
