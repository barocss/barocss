# Viewer: native geometry and derived display

Viewer loads bounded native CAD inputs and displays sampled Surface/Curve geometry through the public GPU backend. Use it when your host needs a canvas, camera controls, qualified object references and explicit query boundaries.

**Checkpoint:** `5f5ad866205a`; version `0.0.0-experimental`. Public configuration is local source availability, not verified npm publication. Use ordinary package-name imports with the existing TypeScript-capable workspace host and Node 22+. No source condition is required. Plain Node cannot resolve internal source `.js` specifiers to `.ts`.

## Four separate results

The original native model retains coefficients, weights, knots and IDs. Sampling creates display packets. Caller-authored poses transform display without editing that model. GPU rendering creates pixels. A display pick is approximate; a native parameter query evaluates the original geometry at stated parameters.

Caller ownership includes canvas/DOM, input focus, transport/cancellation, source revisions, simulation clock and disposal. Viewer owns its accepted copied state and GPU presentation resources.

[Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits and errors](./limits)

[Public Viewer and types](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-viewer/src/index.ts)

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-viewer/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-viewer/README.md)
