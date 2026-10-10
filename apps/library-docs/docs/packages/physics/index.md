# Physics: caller-driven bounded simulation

Physics advances admitted rigid bodies, visual water or visual cloth. It has no renderer and no hidden clock. Use it when your host can supply fixed time steps and apply copied results to a separate display layer.

**Checkpoint:** `5f5ad866205a`; version `0.0.0-experimental`. Public configuration is local source availability, not verified npm publication. Use ordinary package-name imports with the existing TypeScript-capable workspace host and Node 22+. No source condition is required. Plain Node cannot resolve internal source `.js` specifiers to `.ts`.

Lengths use metres, mass uses kilograms and time uses seconds. CAD uses millimetres. A CAD proxy is a separately admitted sphere or box simulation shape; it is not the original Surface or its sampled display mesh.

[Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits and errors](./limits)

[Rigid public root](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-physics/src/index.ts)

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-physics/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-physics/README.md)
