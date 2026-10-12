# Split an authored path segment

Insert a new boundary into an existing line, quadratic or cubic without flattening it into a polyline. `splitPathSegment` returns copied commands; your application decides when to apply them to a path.

This guide uses the adopted public `@barocss/canvas2d` `0.0.0-experimental` source at repository revision `23e6615a8e2c4ad9c9299184a6be5ff2735358b5`. Use this local workspace package with a TypeScript-capable bundler. The check below also builds and executes its genuine `publishConfig` JavaScript entry and checks its emitted declarations. This is local consumer verification, not evidence of npm publication. The older [path-control editor](./path-editing) retains its own source profile.

## Split the original cubic at its parameter midpoint

Use the complete snippet below as `main.ts`. It imports only the public entry. The coordinates are path-local logical pixels, before parent transforms or viewport mapping.

```ts
import { splitPathSegment } from '@barocss/canvas2d';
import type { PathCommand } from '@barocss/canvas2d';

// Path-local logical pixels, before any control or anchor drag.
export const original: PathCommand[] = [
  { kind: 'M', x: 0, y: 60 },
  { kind: 'C', c1x: 25, c1y: 0, c2x: 75, c2y: 100, x: 110, y: 60 },
  { kind: 'L', x: 110, y: 120 },
  { kind: 'L', x: 0, y: 120 },
  { kind: 'Z' },
];

// Index 1 addresses the original C command; t is its parameter, not arc length.
export const subdivided = splitPathSegment(original, 1, 0.5);

// Independent literal expectation for this original fixture (no API-derived oracle).
export const expected: PathCommand[] = [
  { kind: 'M', x: 0, y: 60 },
  { kind: 'C', c1x: 12.5, c1y: 30, c2x: 31.25, c2y: 40, x: 51.25, y: 52.5 },
  { kind: 'C', c1x: 71.25, c1y: 65, c2x: 92.5, c2y: 80, x: 110, y: 60 },
  { kind: 'L', x: 110, y: 120 },
  { kind: 'L', x: 0, y: 120 },
  { kind: 'Z' },
];
```

The result has six commands. The first half ends at `(51.25, 52.5)` and the second ends at the original `(110, 60)`. The two trailing L commands and Z remain in their original order. The expected values above are literals for the original cubic, before any control-point edit or anchor drag.

`t = 0.5` is the Bézier parameter midpoint. It does not promise half the arc length. The operation uses bounded binary64 de Casteljau interpolation and keeps the segment degree: L becomes two L commands, Q becomes two Q commands and C becomes two C commands. It does not tessellate the path or certify pixel-identical rendering for arbitrary inputs.

## Own and apply the returned commands

The returned array and every command record are independent of the input, including commands outside the selected segment. The call accepts a readonly command array; it does not mutate your authored data. Changing the returned copy cannot change the original. Changing the original after the call cannot change the returned copy.

The helper does not update a DisplayTree, path handle, paint, resource registration or scene version. In an editor, keep the accepted commands until the call succeeds, then apply the returned commands through the public path handle's `setPath`, preserving copied fill and stroke as shown in [path control editing](./path-editing). Selection, anchor dragging and Undo/Redo are application responsibilities. After insertion, the original suffix shifts forward by one command; update application-owned command indices accordingly.

## Bounds and explicit refusals

- The source must be a validated authored path with 2–256 commands. Successful insertion adds one command, so a 255-command source can become 256; splitting a 256-command source refuses with `SCENE_LIMIT`
- `index` is the zero-based position in the complete command array, including M and Z. It must be an in-range integer; negative zero is rejected
- `t` must be finite and strictly between 0 and 1. Both endpoints, NaN and negative zero refuse with `INVALID_SCENE`
- Targeting M or Z, or a constant selected L/Q/C segment within an otherwise valid source, refuses with `UNSUPPORTED_FEATURE`
- A derived half that collapses after Number rounding refuses with `SCENE_LIMIT`; an interior parameter alone does not guarantee success
- Source validation happens before index and parameter validation. Malformed paths can therefore refuse before the selected-segment check. This is not an SVG parser or a way to admit arbitrary command records

Refusals are `Canvas2DError` values with a `code`. Keep your accepted application state when a call throws. Do not substitute a partially split path or silently clamp a rejected parameter. Source coordinates and derived points remain within the admitted Scene numeric range (absolute magnitude at most 1,000,000).

## Run the bounded consumer check

From a checkout with the existing development dependencies and Node 22 or newer:

```sh
node apps/library-docs/scripts/check-path-subdivision.mjs
```

The check compiles the package, executes this exact snippet against both the public source and freshly emitted JavaScript, and type-checks both public entry declarations. It verifies the full literal cubic output, L/Q cases, copied ownership, frozen input, the 256-command boundary and explicit endpoint/unsupported/collapse refusals. Its receipt is written beneath the app's ignored VitePress cache. No browser, renderer, physical Save/Open or interactive catalog flow runs in this check.

## Existing native editor reference

The repository's [path-control editing example](https://github.com/barocss/barocss/blob/23e6615a8e2c4ad9c9299184a6be5ff2735358b5/examples/canvas2d-scene/path-control-editing/README.md) documents an `index.html?split=1` mode. Its retained [native observation](https://github.com/barocss/barocss/blob/23e6615a8e2c4ad9c9299184a6be5ff2735358b5/examples/canvas2d-scene/path-control-editing/evidence/path-split/observation.md) is historical proof for that native session, not a fresh browser result for this guide. This page adds no new interactive catalog entry and makes no current UI or physical Save/Open claim.

[Path control editing](./path-editing) · [Canvas2D API tasks](./api) · [Canvas2D examples](./examples)
