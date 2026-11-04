# Rotate

Rotates one solid with the existing Model body-rotation node. The component declares parameters; native backend code performs the transformation.

Import `Rotate` from `@barocss/cad-react`. This private experimental workspace API is not a published installable package.

## Props and output

| Prop | Input/default | Meaning |
|---|---|---|
| `axis` | Required x/y/z | Existing axis vocabulary. |
| `angle` | Required finite number; abs≤3600 | Degrees; zero is valid. |
| `pivot` | Optional readonly [x,y,z] | Explicit finite mm coordinates; omission stays omitted and uses the existing backend origin default. |
| `children` | One realized solid | Exclusive with solid. |
| `solid` | SolidRef | Exclusive with children. |
| `ref` | Optional SolidRef | Resulting handle kind rotate. |

## Example

```tsx
import { Rotate, Translate, Extrude, Rectangle } from '@barocss/cad-react';

export function PlacedPlate() {
  return <Translate offset={[30,40,5]}>
    <Rotate axis="z" angle={90} pivot={[0,0,0]}>
      <Extrude distance={6}><Rectangle min={[0,0]} max={[80,60]} /></Extrude>
    </Rotate>
  </Translate>;
}
```

Insert the returned composition as the single output of a Part with a connected lifecycle. Any Definitions in the example remain logical siblings of that output; Target/Tools are used only inside Difference.

## Composition and validation

RotateProps uses SolidInput. The inner Rotate above lowers before the outer Translate. Provide an explicit pivot when that placement matters; an omitted pivot is not silently written into the authored document.

Invalid axis, nonfinite/out-of-limit angle, sparse/nonfinite explicit pivot, incompatible profile input, mixed child/ref or wrong cardinality refuse. There is no quaternion/matrix, camera, arbitrary-axis vector or selected-face rotation prop.

## References and identity

Mounted transform identity and refs follow the same Part-scoped rules as other solids. Compiler validation retains prior accepted source on refusal; it does not make that old visible shape current.

## Measured boundary

API axes/±3600 input acceptance is broader than independent actual proof. D497 measures only W80 Bracket, Z90°/180°, explicit origin pivot and selected dx30/50 translations. No arbitrary-angle or non-origin-pivot accuracy certificate follows.

The complete code block uses current public exports; its extracted type-check result is recorded separately. Type/compiler checks do not by themselves evaluate this standalone example as a new native case. Read the [component catalog](/packages/cad-react/components), [refs and compiler](/packages/cad-react/references), [engine integration](/packages/cad-react/engine-viewer) and [current support limits](/packages/cad-react/limits).
