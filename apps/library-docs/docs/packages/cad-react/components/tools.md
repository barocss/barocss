# Tools

Groups the ordered solid cutters for Difference. Tools is a logical slot, not a native feature or a union of its children.

Import `Tools` from `@barocss/cad-react`. This private experimental workspace API is not a published installable package.

## Props and output

| Prop | Input/default | Meaning |
|---|---|---|
| `children` | Required; one or more realized solids | Each tool is subtracted in the current declared order. |

## Example

```tsx
import { Difference, Target, Tools, Extrude, Rectangle, Circle } from '@barocss/cad-react';

export function TwoHolePlate() {
  return <Difference>
    <Target><Extrude distance={6}><Rectangle min={[0,0]} max={[80,60]} /></Extrude></Target>
    <Tools>
      {[10,70].map(x => <Extrude key={x} from={-1} distance={8}>
        <Circle center={[x,10]} radius={3} />
      </Extrude>)}
    </Tools>
  </Difference>;
}
```

Insert the returned composition as the single output of a Part with a connected lifecycle. Any Definitions in the example remain logical siblings of that output; Target/Tools are used only inside Difference.

## Composition and validation

Tools belongs directly under Difference beside exactly one Target. Keyed arrays and compatible synchronous wrappers can produce its cutters. The cutter order is preserved rather than silently merged.

An empty group refuses. Profiles must first be extruded to solids. Tools has no ref, solid, geometry-query or implicit-depth prop and cannot be the standalone Part output. More than one Tools slot is invalid.

## References and identity

React keys provide mounted cutter identity during supported reorder/update. Tool source identity is separate from physical intersection success; native IDs are generated without author-supplied values.

## Measured boundary

The actual Bracket cuts four radius3 floor holes followed by its window. The two-tool sample is a complete API pattern grounded in those source/tests, not an additional measured geometry domain.

The complete code block uses current public exports; its extracted type-check result is recorded separately. Type/compiler checks do not by themselves evaluate this standalone example as a new native case. Read the [component catalog](/packages/cad-react/components), [refs and compiler](/packages/cad-react/references), [engine integration](/packages/cad-react/engine-viewer) and [current support limits](/packages/cad-react/limits).
