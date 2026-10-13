# CAD documentation impact checks

This is a **read-only maintenance aid**, not automatic documentation generation or CAD correctness verification.

After fetching the refs locally, run:

```sh
pnpm --filter @barocss/library-docs check:cad-impact
node apps/library-docs/scripts/check-cad-impact.mjs develop HEAD
```

The first command runs pure Node tests; the second reports impacted manual pages for Git's `develop...HEAD` change set. For a pull request, use its actual base and head refs. The script requires those refs locally; it performs no fetch or checkout and makes no modifications.

Output includes `impacts` with existing/missing review-target files and `unmapped` CAD-family source changes. Exit 1 indicates a missing manual target or unmatched relevant source file; exit 2 indicates invalid refs or Git failure. An exit 0 is **mapping completeness only**, never approval of documentation semantics.

Reviewers still need to inspect changed public interfaces, example behavior, supported/refused geometry and any historical fixed-SHA receipts. A file edit can be refactoring with no user-facing change; conversely unchanged signatures can hide altered behavior. Always run any appropriate example, typecheck, browser, and full documentation build in their own scopes. The impact report explicitly reports `reviewed:false`, `nativeExecuted:false`, and `browserExecuted:false`.

Current mapping is intentionally narrow. New CAD geometry families may appear under `unmapped` and require a deliberate owner review; do not add catch-all routing that masks the absence of a documented capability.
