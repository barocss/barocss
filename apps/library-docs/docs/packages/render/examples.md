# Render examples

## Profile form

`packages/barocss-render/examples/profile-form.tsx` (Complete profile-form.tsx; local source) has all five registrations, controlled name input and the named save callback. Copy the example into your local React host after building the package. Edit the name, activate Save, propose malformed JSON, and observe that host validation keeps the last valid screen. The example uses no model or backend.

## Request form

`packages/barocss-render/examples/request-form.tsx` (Complete request-form.tsx; local source) demonstrates host-declared `/draft/name` and `/draft/topic` bindings and review/edit/confirm transitions. It is repository source and is not listed as an additional packed entry.

## Descriptor-only task

The [quickstart](./quickstart) validates a two-node screen and obtains definition version 1. It needs no DOM. A successful validation is evidence of the accepted screen contract, not evidence of model quality or arbitrary UI rendering.

`packages/barocss-render/package.json` (Manifest and version; local source) · `packages/barocss-render/README.md` (Package task notes; local source)
