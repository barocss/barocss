# Union

Joins realized solid operands in declared order through existing Model union nodes. The React group may lower to more than one native node.

Import `Union` from `@barocss/cad-react`. This private experimental workspace API is not a published installable package.

## Props and output

| Prop | Input/default | Meaning |
|---|---|---|
| `children` | Required; at least two realized solids | Compatible synchronous wrappers are allowed. |
| `ref` | Optional SolidRef | The combined solid handle has kind union. |

## Example

```tsx
import { Union, Extrude, Rectangle } from '@barocss/cad-react';

export function BracketTarget() {
  return <Union>
    <Extrude distance={6}><Rectangle min={[0,0]} max={[80,60]} /></Extrude>
    <Extrude distance={56}><Rectangle min={[0,54]} max={[80,60]} /></Extrude>
  </Union>;
}
```

Insert the returned composition as the single output of a Part with a connected lifecycle. Any Definitions in the example remain logical siblings of that output; Target/Tools are used only inside Difference.

## Composition and validation

Union folds its operands through the existing backend in source order. Use it to make the single target for a Difference or the single Part output. It does not join unrelated React nodes or execute user component functions.

Fewer than two realized solids refuses. Profile inputs are incompatible. There is no solid prop on Union; reuse refs through components that accept a solid input. Backend Boolean refusals and native tolerances remain authoritative.

## References and identity

Stable React keys retain supported mounted operand IDs across reorder; the current order still determines native parent refs. A remounted key creates new identity.

## Measured boundary

The floor/wall union is part of the independently measured Bracket. That selected Boolean arrangement is not general union robustness or geometric-equivalence proof.

The complete code block uses current public exports; its extracted type-check result is recorded separately. Type/compiler checks do not by themselves evaluate this standalone example as a new native case. Read the [component catalog](/packages/cad-react/components), [refs and compiler](/packages/cad-react/references), [engine integration](/packages/cad-react/engine-viewer) and [current support limits](/packages/cad-react/limits).
