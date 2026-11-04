# Part

The model root and declaration lifecycle. Part is a logical React element, not a native feature node or a visible canvas.

Import `Part` from `@barocss/cad-react`. This private experimental workspace API is not a published installable package.

## Props and output

| Prop | Input/default | Meaning |
|---|---|---|
| `lifecycle` | Required ModelLifecycle | dirty, invalid, complete and detached callbacks; a connected ModelHost implements them. |
| `admission` | Required "synchronous" | Explicit caller contract for supported synchronous composition. |
| `units` | Optional "mm"; default "mm" | All source lengths are millimetres. |
| `children` | Required ReactNode | Exactly one realized solid output outside any Definitions groups. |

## Example

```tsx
import { Part, Extrude, Rectangle, type ModelLifecycle } from '@barocss/cad-react';

export function PlateModel({ lifecycle }: { lifecycle: ModelLifecycle }) {
  return <Part admission="synchronous" lifecycle={lifecycle}>
    <Extrude distance={6}><Rectangle min={[0,0]} max={[80,60]} /></Extrude>
  </Part>;
}
```

The example includes its Part context and accepts a real lifecycle from its caller. It creates no Worker or canvas.

## Composition and validation

React executes wrappers and hooks. Part records committed descendants and sends lifecycle changes; it neither calls component functions manually nor constructs a Worker. Supply the separate engine/Viewer integration to evaluate and display the model.

Two solids outside Definitions refuse; combine them through Union or Difference. A profile alone is not a solid output. Nested Parts, portals and unsupported async boundaries are not model operands. A wrapper-hidden Suspense boundary is still outside synchronous admission.

## References and identity

Mounted features use automatic IDs. Invalid declarations retain the compiler's last accepted document while the lifecycle retires freshness; previous visible geometry is not current success. Part does not reconnect source identity after reload.

## Measured boundary

Original App/Bracket widths80→100→80 and the selected transformed W80 flow exercise this root with the real injected engine/Viewer. This does not cover arbitrary React scheduling or geometry.

The complete code block uses current public exports; its extracted type-check result is recorded separately. Type/compiler checks do not by themselves evaluate this standalone example as a new native case. Read the [component catalog](/packages/cad-react/components), [refs and compiler](/packages/cad-react/references), [engine integration](/packages/cad-react/engine-viewer) and [current support limits](/packages/cad-react/limits).
