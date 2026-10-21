# @barocss/cad-model (experimental)

The CAD document model and engineering domain logic on top of [`@barocss/cad`](../barocss-cad): the studio document
and its evaluation, analyses, manufacturability checks, libraries, drawings' data and the agent tools. It has no UI:
no React, no DOM and no browser storage. An app such as `apps/cad-studio` supplies those.

Status: the package is empty. Its code moves in from `apps/cad-studio` in later steps of the package split (PKG-c
onward). Until then it exports nothing. Modules will be imported by path (`@barocss/cad-model/<module>`). A curated
public entry and a stability policy for its exports come before any release.

Version `0.0.0-experimental` is configured for public scoped-package access. This local configuration does not
establish registry availability or a release: publishing goes through the repository's release process.
