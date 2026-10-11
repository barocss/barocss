# Viewer: native geometry and derived display

[Native points and display pose](./display-pose) — Measure original native points, apply a separate display pose and select a projected point in the actual 3D view.

Viewer loads bounded native CAD inputs and displays sampled Surface/Curve geometry through the public GPU backend. Use it when your host needs a canvas, camera controls, qualified object references and explicit query boundaries.

**Checkpoint:** `5f5ad866205a`; version `0.0.0-experimental`. Public configuration is local source availability, not verified npm publication. Use ordinary package-name imports with the existing TypeScript-capable workspace host and Node 22+. No source condition is required. Plain Node cannot resolve internal source `.js` specifiers to `.ts`.

## Four separate results

The original native model retains coefficients, weights, knots and IDs. Sampling creates display packets. Caller-authored poses transform display without editing that model. GPU rendering creates pixels. A display pick is approximate; a native parameter query evaluates the original geometry at stated parameters.

Caller ownership includes canvas/DOM, input focus, transport/cancellation, source revisions, simulation clock and disposal. Viewer owns its accepted copied state and GPU presentation resources.

[Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits and errors](./limits)

`packages/barocss-viewer/package.json` (Manifest and version; local source) · `packages/barocss-viewer/README.md` (Package task notes; local source)
