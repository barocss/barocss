# Target

Selects the single solid operand for its parent Difference. Target is a logical slot and creates no native feature node of its own.

Import `Target` from `@barocss/cad-react`. This private experimental workspace API is not a published installable package.

## Props and output

| Prop | Input/default | Meaning |
|---|---|---|
| `children` | One realized solid child | Exclusive with solid. |
| `solid` | SolidRef | Exclusive with children; forward refs are supported after commit. |

## Example

```tsx
import * as React from 'react';
import { Definitions, Difference, Target, Tools, Extrude, Rectangle, Circle, type SolidHandle } from '@barocss/cad-react';

export function ReusedTarget() {
  const plate = React.useRef<SolidHandle|null>(null);
  return <>
    <Difference>
      <Target solid={plate} />
      <Tools><Extrude from={-1} distance={8}><Circle center={[10,10]} radius={3} /></Extrude></Tools>
    </Difference>
    <Definitions><Extrude ref={plate} distance={6}><Rectangle min={[0,0]} max={[80,60]} /></Extrude></Definitions>
  </>;
}
```

Insert the returned composition as the single output of a Part with a connected lifecycle. Any Definitions in the example remain logical siblings of that output; Target/Tools are used only inside Difference.

## Composition and validation

Use Target directly inside Difference. It accepts a compatible solid from an ordinary wrapper or one typed SolidRef. TargetProps is the public exclusive-input type.

Both child and solid, zero/multiple solids, a ProfileRef or missing/cyclic reference refuse. Target has no own output ref or native-ID prop. It is not a valid standalone Part solid.

## References and identity

A referenced solid belongs to the same Part and must have one binding owner. Pass the object ref, not its current handle; lookup resolves the committed graph.

## Measured boundary

Measured Bracket targets use ordinary child composition; controlled compiler/ReactDOM/type tests cover typed reference resolution. These are distinct proof channels.

The complete code block uses current public exports; its extracted type-check result is recorded separately. Type/compiler checks do not by themselves evaluate this standalone example as a new native case. Read the [component catalog](/packages/cad-react/components), [refs and compiler](/packages/cad-react/references), [engine integration](/packages/cad-react/engine-viewer) and [current support limits](/packages/cad-react/limits).
