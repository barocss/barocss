# Affected workspace CI

[#1933](https://github.com/barocss/barocss/issues/1933) introduced affected selection;
[#1940](https://github.com/barocss/barocss/issues/1940) moved application tests out
of CI. The owner-approved [#1942](https://github.com/barocss/barocss/issues/1942)
now limits required PR/push coverage to **lint, TypeScript and builds**.

`Test and Build` remains the always-running required aggregate. Failed, canceled,
skipped or missing selected checks fail closed. A green result does not claim
runtime, browser or application tests passed. The protocol checker remains a
structural check before planning.

## Selection and outputs

Package changes select their owner and transitive reverse consumers across all
four dependency categories. A serial topological build includes forward build
prerequisites. At most two isolated package check jobs run concurrently. Full
fallback runs root types/lint/library builds plus application/example builds;
shared, public-contract, manifest, unknown and uncertain changes use that route.
Node heap remains 2 GiB, Rayon one thread, workspace concurrency two.

PR comparison uses trusted event SHAs and their merge base; both parents must
belong to the checked-out merge tree. Push `before` must be an ancestor of the
exact checkout. Missing, forced or unsafe comparisons fall back to full checks.
No event-supplied strings become shell commands. Selected scripts are checked
against their exact current manifests before execution.

Partial build artifacts bind this run, checkout SHA and plan hash. Each build
row names its audited output directory: libraries and Vite apps use `dist` (or their literal Vite `outDir`), and both
VitePress apps use `docs/.vitepress/dist`. Missing, empty, extra, unsafe, symlinked
or corrupt outputs fail; repository-relative layout is preserved during restore.
The final artifact job validates outputs rather than running packed runtime tests.

Plain library-docs Markdown selects VitePress/example generation and static
link/API validation. Executable/unknown Markdown or docs inputs use full checks.
App-owned test aliases, including docs Node test suites, remain external.

## Separate regression and release checks

`Manual and pre-release regression` (`regression.yml`) can be run explicitly
through workflow_dispatch, with no publication action. It also runs as a
required reusable dependency before the existing version-PR and npm-publication
operations. Existing owner, exact-SHA, readiness, environment, token and publication
gates are unchanged. No release is dispatched by this CI change.

That route retains the existing non-app recursive package tests, Viewer lifecycle
contracts, root CI/release tests and packed-export validation after required build
preparation. Application tests still run locally or on Execute Tester and their
results belong in the feature issue. Local scripts and test files are unchanged.
The existing 27 scoped Physics workflows retain their PR compilation and names;
their simulation/audit steps and output uploads run on their existing manual route.
The legacy main-PR `test` check name is retained but now performs types/lint; its
`build` sibling builds packages and documentation.

Run planner/artifact/policy controls locally with
`node --test .github/scripts/*.test.mjs`. Actual first Actions results must be
observed before claiming a speed improvement. This policy does not diagnose
historical runner shutdowns or establish physical browser acceptance.

## Application ESLint fallback

Apps without a declared `lint` script use the root ESLint configuration on
changed, tracked JS/TS files in that app. The runner uses safe individual argv
entries, not shell interpolation, and excludes untracked generated build files.
It prints the actual covered files and configured exclusions. Empty/ignored
selections explicitly do not claim a lint pass; `apps/barocss-docs` currently
has a root-config ignore. No ignore or lint rule is weakened.

Lint can have cross-file effects. Root/nested lint configuration, dependency
changes, unavailable comparison bases and unaudited local plugin wiring use all
tracked code in affected app owners. Manual/pre-release regression also uses all
relevant tracked app code. This can expose existing app lint errors; the former
recursive root lint did not cover apps without scripts. Runtime tests remain
external to required CI.

A narrowly verified `apps/library-docs/package.json` change to only the existing
`check:docs` command does not widen fallback lint to unrelated apps. The planner
compares all workspace manifests at the trusted base and actual checkout: every
other field and script must be semantically identical. The docs app still gets
all of its owned tracked code linted, and the full types/build/docs route remains.
Missing, added, deleted or renamed manifests, another script (including install
or prepare), dependency/configuration changes, and root manifests remain global.
Concurrent lint, TypeScript or build configuration changes also retain broad lint.
This is selection scope, not a waiver for the existing CAD-app lint errors exposed
by a prior overly broad docs-only selection.

The same lint-scope distinction applies to strictly additive GPU runtime test
registration in `packages/barocss-gpu/package.json`. The existing literal
`node --test` prefix and every existing argument must stay in order, with no
duplicates or removals. New arguments must be safe owned `tests/*.test.mjs` paths
added by the comparison and tracked as regular files in the actual checkout;
options, shell syntax, symlinks and untracked/missing paths refuse classification.
Every other workspace manifest field and script must remain identical. The full
types/lint/build route is retained, including GPU source lint, and concurrent app
source edits still receive their normal changed-file lint. Root, lifecycle,
dependency or configuration changes remain conservative. This does not waive the
66-file CAD lint debt: manual/pre-release full app lint remains unchanged.
