# Kernel file reachability — 2026-10-30

Static import-graph measurement of `packages/barocss-cad/src` at `b5a245d4f`. Nothing was run besides the script. It refreshes the R7.3d figure (2026-10-24: "117 of 401 files reachable from the live engine; 284 only through index.ts"), which counted every index.ts-only file as unused even when product code imports it.

Rerun from the repository root:

```bash
python3 apps/cad-studio/handover/notes/kernel-reachability-2026-10-30/reach.py
```

| Set | Files | Lines |
|---|---|---|
| All kernel `.ts` sources | 454 | 111,189 |
| A. Live engine: reachable from `part/part-model.ts`, `api/index.ts`, `internal/native-si-mass.ts`, `io/*` | 171 | 47,541 |
| B. A plus files behind the 383 names that other packages' product code imports from `@barocss/cad` | 297 | 78,390 |
| C. B plus files behind names imported only by tests or examples | 316 | — |
| D. **Used by nothing outside the kernel** (kernel's own tests may still use them) | **137** | **28,681** |
| E. Used only by other packages' tests or examples | 19 | 3,417 |

D by folder: planar-solids 32, root 24, nurbs 15, exact-proof 14, sketch 14, intersect 11, features 9, paired 7, brep 5, document 4, core 1, translated-strip 1. Largest: `modeling.ts` (the legacy `createCadModel` object API, 1,428 lines; outside the kernel only docs mention it), `nurbs/source-wide/source-line-width-material-body-graph.ts` (923), `nurbs/source-wide/source-knot-recipe-loft-graph.ts` (868), `paired/paired-roof-difference-body-proof-internal.ts` (730). The full list is [unused-files.txt](unused-files.txt).

Limits: imports are resolved by regular expression (static `import`/`export … from` with relative paths, plus named imports from the `@barocss/cad` root); dynamic imports, the `./api` and `./internal/*` subpaths' own consumers and kernel-internal test use are not separated. A file in D is a retire-or-keep candidate for R7.3d, not proven dead: each module still needs the per-module audit before removal.
