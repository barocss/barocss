# CAD source authoring manual checkpoint — #1606

- Docs parent: `0c9aa7e159d3713a70a4b67631715e027da28fef`
- Compiler/evaluator source pin: same adopted commit; source blobs read from Git, never a mutable checkout or package index
- Scope: `apps/library-docs/**` only. Existing workflow/domain/CNAME and exact-prism recipe pin `31b3033f9db55cab3aa61e3a15e755546d49823a` unchanged
- Node used: 24.19.0; existing esbuild and VitePress 1.6.4 cache, no install

## Passed scoped checks

1. `node apps/library-docs/scripts/check-cad-language.mjs` — four complete Source0/1/2/3 downloads compile, native Model remains v0, midpoint results `[10,0,0]`, `[10,0,15]`, `[50,0,15]`, `[50,0,100]`; Source3 width 10 cm → 12 cm yields `[60,0,120]` while the old result remains unchanged. Fifteen independent refusal cases and literal Surface Source0 success are asserted. Exact source closure, diagnostic ranges and bundle hash are in `cad-language-source-coverage.json`.
2. Same script verifies the downloadable complete authored feature-v0 JSON against the adopted native demo's pure `recipe`/`document` factory, including negative zero. This is extraction/data comparison, **not** native feature-document evaluation or codec-roundtrip validation.
3. `node apps/library-docs/scripts/check-cad-language-docs.mjs` — isolated VitePress Markdown rendering for five changed pages; 73 local links, 14 rendered anchors, four source includes, five downloadable files and 26 immutable Git blob targets checked. Details in `cad-language-docs-check.json`.
4. `git diff --check` and app-only changed-path review.

## First failures and corrections

- The initial test expected VERSION for Source3 text compiled with option2. Actual first error was KIND (`Unsupported declaration function`), because parsing refuses that declaration before the semantic header check. Retained this real refusal case and used a Source0-only header edit for the independent VERSION test. Documentation reports actual precedence.
- The standalone renderer cannot establish dynamic playground/example Vue fragment IDs. Existing dynamic links are explicitly listed as unchecked rather than marked passed.
- The newly written recipe link omitted VitePress's leading underscore for a numeric heading. Rendered target exposed `_2-cut-edit-and-reopen`; the link was corrected and the final check rerun.
- Root-level `import 'vitepress'` was unavailable in the sparse checkout. Reused the existing exact VitePress cache through an ignored app-local dependency link; no new dependency installed.

## Unrun and publication boundaries

Full VitePress build and aggregate `check:docs` (which requires built outputs), browser/GPU pixels, dynamic client anchors, editor physical interactions, native picker Save/Open, and a new Solid/JSON engine roundtrip were not run. No native campaign, registry claim, remote product write or deployment was performed. Prior executed exact-prism evidence remains its original receipt and pin. Parent review/adoption and deployment are separate.
