# Issue #471 — public renderer release preparation

## Scope and status

The owner authorized a release including `@barocss/render` and website documentation. The renderer
remains in `packages/barocss-render`. This preparation makes its existing five-component API
publishable, adds the license and portable documentation, and coordinates all four release packages.
No renderer behavior, model transport, native process or launch allowance was added.

All four packages have a pending minor Changeset; the installed Changesets planner resolves each
to **0.12.0**. Source versions were not advanced in this task. The renderer keeps its development
version until the separate reviewed version step. React 19.2.3 stays an external peer; React types
are a development dependency, resolved from already installed assets without a download.

The website links a staged renderer guide/API and a complete authored form example. The published
Docs marker remains 0.11.2. Public guides make no npm-availability claim for the renderer; maintainer
promotion instructions live in `docs/automatic-release.md`.

## Release safety

The shared release package set covers kit, browser, server and render. Guards reject missing/wrong
manifest identities, private packages, mismatched release versions, incomplete publication,
missing renderer readiness, changed candidate/main SHAs and incorrect main merge provenance.
A linked owner-posted render record must bind the packed consumer to the exact SHA/version.
`Guard`/`Ship` are retained wire labels for current Review/Execute evidence, not separate legacy roles.

Manual `publish=false` remains the default. Only explicit owner publication on protected main with
all evidence can enter OIDC publication. Render is first in the tarball sequence; tags/Releases are
created only after all four publications succeed. Any partial publication stops automatic retry.
This task did not authenticate, bootstrap npm, change trust settings, publish, deploy or create a main PR.
The first render package's Trusted Publisher setup remains a publication blocker owned by Planner.

## Private provenance and historical verification

The public-head corpus launcher no longer embeds private response/dispatch/result digests.
Expected digests are retained in private `private-471-prior-provenance.json`, with baseline provenance.
Saved-evidence verification fails closed when that file is absent or malformed. Private originals,
accepted historical commits, claims, corpus and frozen plans were not changed.

The current historical research freeze must reject the changed README and launcher. Run the original
#458 verifier only at the retained accepted #469 baseline. This preparation grants no new launch.
The public checkpoint must be a reviewed tree snapshot from remote develop, excluding private local
research ancestors. Removing literals at HEAD alone does not sanitize their reachable history.

## Verification

- `pnpm check`: passed (type-check, lint, tests and library builds). Existing kit skip remains.
- `node --test .github/scripts/*.test.mjs scripts/barocss-render-corpus/private-provenance.test.mjs`:
  27/27 passed, including every partial four-package state and missing/wrong renderer evidence.
- `node .github/scripts/check-packages.mjs`: all four tarballs pass license/export checks, isolated
  ESM/runtime imports and strict TypeScript; existing kit/browser/server ESM/CJS/CDN checks remain.
  Render has no require export and uses an installed external React peer.
- `pnpm --filter @barocss/render test`: built ESM smoke passed.
- Installed-assets `test:consumer`: 3/3 passed (strict types, browser input/save/rejection/retention,
  built ESM exports). The temporary-directory path comparison now uses canonical real paths.
- `pnpm --filter barocss-docs docs:build`: passed, including published-version pin checks.
- Isolated `pnpm install --offline --frozen-lockfile --lockfile-only --ignore-scripts`: passed.
- Focused lint: zero errors; existing command-line console warnings remain.
- Private saved prior accounting: four original dispatches verified, no model call.
- Current research freeze: expected rejection. Historical baseline verification is separate.
- `git diff --check`: passed.

Exact final commit/artifact binding, independent Review verdict and post-integration/checkpoint gates
are recorded on the Issue. Authored consumer fixtures demonstrate this narrow form path, not model
quality, arbitrary UI support, streaming or live latency. Publication remains NO-GO pending setup.
