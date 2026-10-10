# Render examples

## Profile form

[Complete profile-form.tsx](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render/examples/profile-form.tsx) has all five registrations, controlled name input and the named save callback. Copy the example into your local React host after building the package. Edit the name, activate Save, propose malformed JSON, and observe that host validation keeps the last valid screen. The example uses no model or backend.

## Request form

[Complete request-form.tsx](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render/examples/request-form.tsx) demonstrates host-declared `/draft/name` and `/draft/topic` bindings and review/edit/confirm transitions. It is repository source and is not listed as an additional packed entry.

## Descriptor-only task

The [quickstart](./quickstart) validates a two-node screen and obtains definition version 1. It needs no DOM. A successful validation is evidence of the accepted screen contract, not evidence of model quality or arbitrary UI rendering.

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render/README.md)
