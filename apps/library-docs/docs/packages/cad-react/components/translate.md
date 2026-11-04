# Translate

Places one solid with the existing Model body-translation node. It adds the authored XYZ offset to the parent solid in model coordinates; no frontend transform math is introduced.

Import `Translate` from `@barocss/cad-react`. This private experimental workspace API is not a published installable package.

## Props and output

| Prop | Input/default | Meaning |
|---|---|---|
| `offset` | Required readonly [x,y,z] | Three explicit finite millimetre coordinates; sparse arrays refuse. |
| `children` | One realized solid | Exclusive with solid. |
| `solid` | SolidRef | Exclusive with children. |
| `ref` | Optional SolidRef | Resulting handle kind translate. |

## Example

```tsx
import { Translate, Extrude, Rectangle } from '@barocss/cad-react';

export function MovedPlate() {
  return <Translate offset={[30,40,5]}>
    <Extrude distance={6}><Rectangle min={[0,0]} max={[80,60]} /></Extrude>
  </Translate>;
}
```

Insert the returned composition as the single output of a Part with a connected lifecycle. Any Definitions in the example remain logical siblings of that output; Target/Tools are used only inside Difference.

## Composition and validation

TranslateProps uses SolidInput. A nested child is lowered first, then its resulting solid becomes the translation parent. Wrap Rotate in Translate to rotate first and then apply the world offset, as the TransformApp recipe does.

Missing coordinates, nonfinite/sparse offset, incompatible profile input, both child and solid or wrong cardinality refuse. Zero coordinates are valid; offset is not a destination bounding-box or unit-conversion command.

## References and identity

Mounted transforms preserve supported IDs when offset changes; invalid declarations do not consume committed IDs. The optional ref remains scoped to this Part, with no geometry or matrix exposed on its handle.

## Measured boundary

Actual W80 Bracket states use dx30/50,y40,z5 after Z90/180 origin rotation. Global translation plus automatic framing can produce identical pixels; current world Doc/centroid/bounds and owners establish the change, not forced framebuffer differences.

The complete code block uses current public exports; its extracted type-check result is recorded separately. Type/compiler checks do not by themselves evaluate this standalone example as a new native case. Read the [component catalog](/packages/cad-react/components), [refs and compiler](/packages/cad-react/references), [engine integration](/packages/cad-react/engine-viewer) and [current support limits](/packages/cad-react/limits).
