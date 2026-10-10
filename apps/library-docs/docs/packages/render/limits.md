# Render limits and errors

## Accepted data

A screen has exactly `root` and `elements`, with 2–32 nodes. Root is a Layout. Every ID matches `[a-z][a-z0-9-]{0,31}` and equals its node's `props.id`. Non-root nodes have exactly one parent; the graph is reachable and acyclic. Leaves have empty `children`. Unknown fields, props and types fail. Labels and text have 1–300 UTF-16 code units.

Only Layout, Card, Text, Input and Button exist. Layout/Card choices map to fixed utilities. Input bindings and Button actions cannot carry expressions, HTML, arbitrary styles or URL instructions.

## Host declarations

Each declaration array has at most 32 unique strings. Restricted paths start with `/`, contain nonempty identifier segments and have at most 256 characters. Escaped JSON Pointer segments, numeric array indices and unsafe prototype names are refused. Action names are bounded lowercase identifiers. Used handlers must be own data properties containing functions. Inherited/accessor callbacks and missing handlers fail before activation.

## Recover from an error

Use validator paths for candidate correction. A renderer throw belongs to the host's error boundary. Revalidate after correction and retain the previous accepted screen until then. Register ordinary function/class components. Object-valued `memo` and `forwardRef` registrations are not supported here.

This prototype has no arbitrary schema extension, transport, AI call, normalization, focus manager or persistence. Package version 0.12.0 is the clean manifest value. [#478](https://github.com/barocss/barocss/issues/478) verifies the historical published artifact; it does not qualify later local source changes or prove identical payloads. The old package README staged-release notice is historical.

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render/README.md)
