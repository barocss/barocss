# Render: validated React screens

Render maps a bounded screen object to host-supplied React components. Use it for a profile form or another form with explicit host-declared text bindings and actions. It does not compile GPU scenes.

**Checkpoint:** `5f5ad866205a`; manifest version `0.12.0`. The historical four-package 0.12.0 release is verified in [#478](https://github.com/barocss/barocss/issues/478). The current local source also declares 0.12.0 and contains later API changes. That version string does not prove this source matches the published artifact. Read [version stages](/concepts/versions) before choosing an artifact.

The clean manifest exports built ESM and declarations from `dist`. Its experimental profile-form renderer is separate from the proposed native renderer work in #1183/#1184. These pages describe only the four root functions actually present here.

## Choose the boundary

The host owns React components, form state, named callbacks, JSON transport, validation feedback, last-valid-screen retention and CSS runtime startup. Render owns validation, fixed Layout/Card classes and recursive component composition. Stable node IDs become React keys; they do not guarantee focus retention after a move or replacement.

[Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits and errors](./limits)

[Public declarations](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render/src/index.d.ts)

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render/README.md)
