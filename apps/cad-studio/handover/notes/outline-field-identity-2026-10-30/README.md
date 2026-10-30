# D348 — Keep sketch identity through feature-editor dimension edits

Status: **BOUNDED_QUALIFIED**, the first bounded item of roadmap 09 (Advanced sketch, CG3). Source commit `a85968f2c` (4 paths: `outlineFields.ts`, new Model test, Studio driver, fixture `d348.bcad`). [Qualification](qualification.json), [Korean report](report.ko.md), [independent audit](review/independent-audit.md).

Work split (owner instruction 2026-10-30): root judgment, probes and verification on Opus (this session); independent audit on an Opus sub-agent; fix, tests and driver written by Sonnet sub-agents from frozen briefs. The root edited one comment, one test name and four assertions after the audit, plus a lint helper in the driver. Codex "Sol" models were not used.

## Choosing the gap

09 asks for geometry within the original residual limits, DOF/conflict/redundancy/nonconvergence diagnostics, and authored coordinates/dimensions/references preserved through constraint edit, downstream feature and Save/fresh Open. A first probe of returned outline geometry ([ret.ts](probe-before/ret.ts)) found no defect: 24 rounded-rectangle solves (tangent arcs, radii, lengths, H/V; on-grid, off-grid, jittered) meet 1e-7 mm / 1e-9 rad on the returned points and bulges. The advertised consumer "saved and driven from the feature editor" had a label-only test; probing its `set` reproduced reference loss, so D348 takes that.

## Baseline defects (base `5445ba911`)

Probes in [probe-before](probe-before/) call the unchanged `outlineFields(...).set`:

- The sketch node's stable `id` is dropped (Studio's `withIds` then hands out a new serial), as are `construction`, `on` and the node extras (`NODE_EXTRA_FIELDS`). Only `plane` survived.
- The outline was rebuilt from `outlinePolygon`, which carries no side ids, so `profileOf` gave fresh ones whenever another loop existed: outer `e1..e6` became `e11..e16` with a hole; an attached circle's hole `e5` became `e13`.
- A downstream fillet on `n1.side[e2]|n1.side[e3]` then failed: "The selected edge no longer exists" ([down.ts](probe-before/down.ts)).
- A node without `sideTags` gained them, renaming positional walls without their features ([more.ts](probe-before/more.ts)).
- Actual Studio [run-00](studio/run-00/receipt.json) on the unchanged source: Apply of `Length of edge 1` 60→70 was refused with that toast, the document stayed unchanged, and the refused attempt named outer sides `e12..e17`. Errors 0, resources closed. Root viewed its failure image (field 70, toast, body still 60 wide).

## Repair

`set` commits the dimension on the reopened main shape (`sketchShapes(old).shape`: outline plus its side ids and attached circles' ids), rebuilds the profile with `profileOf([r.shape, ...done])` as before, and composes the node from the rebuilt geometry plus `plane`, `on`, `construction` and `NODE_EXTRA_FIELDS` from the old node. A node without `sideTags` gains none. Refused values still return the same array. No Kernel, schema, dependency, WASM or document-format change.

## Retained failures and corrections

1. The fix sub-agent's sandbox refused git, so it ran no negative control. Root ran the new tests on base: 1 pass / 4 fail.
2. The first run00 attempt never started: the offline `pnpm install` lacked `@rolldown/binding-darwin-arm64`. The same pinned 1.2.11 package was copied (real copy) from the D347 worktree; [stderr head](studio/run-00-env-fail-stderr-head.txt).
3. The independent audit returned PASS with F1: a pre-existing loop-order shift for pre-R10a positional hole names, which fails loudly. It is retained as a limit and the claim was narrowed. F2: a weak test name and missing extras assertions; fixed.
4. Driver lint: 6 unused destructuring variables, replaced by a module-level `without` helper before run01.

## Verification

- Model: new test 5/5 (base 1/4). Affected 65/65: `node scripts/test.mjs editFields construction frk3-editor frk4-editor frk5-editor parameters api-parameters sheet hole-types sketch-outline-field-identity api-verbs`. After the audit edits, `sketch-outline-field-identity editFields fields.test` passed 11/11. Types and eslint PASS.
- Studio: `node scripts/test.mjs constraints sketchIds` 28/28; `tsc --noEmit` PASS; driver eslint has 0 errors and the same console warning as the other drivers.
- Audit probes: 23 downstream edits across 13 dimension kinds. Fixed: 0 failures. Unfixed: 23.
- Actual Studio [run-01](studio/run-01/receipt.json): one Chrome, three sequential contexts.
  1. Open `d348.bcad` (bytes equal the fixture) and edit `Length of edge 1` to 70. Ids n0/n1/n2, nextId 3, sideTags, construction and the fillet edge are unchanged; nothing is rematched, held or suppressed; volume 17480.6858.
  2. Enter value 0: Apply stays disabled and the document is unchanged.
  3. Undo, then Redo.
  4. Reopen the sketch: 70 and 20 are locked, the construction line shows, the hole is present. Escape leaves it unchanged.
  5. Save, then fresh Open, then edit `Length of edge 2` to 25 (volume 19980.6858). Undo, Redo, Save.
  6. Fresh Open and reopen the sketch: 70/25 and the construction line are there.
  - Five product reads (evaluate ok, `n1.side[e2]|n1.side[e3]` exists at the moved corner) and five independent Python Fraction oracles all PASS (worst volume delta 1.09e-11).
  - Errors, console and watcher changes are 0. All 980 frozen files equal the commit.
  - Root viewed 02/04/07 and the run00 failure image.

## Boundaries

Raw logs, screenshots, HTML snapshots and bundled `.mjs` are not committed (repository guard); numbers and commands live here and in the receipts. NOT_RUN: full Kernel/Model/Studio suites, Kernel build (no Kernel change), remote CI, perf-bench (not a performance change), release. Limits: one L plate in the actual flow; pre-R10a hole order (F1); linked sketches have no outline fields; Studio reopen→Finish keeps only `id` of the node extras and may drop `on` for a non-associative sketch on a body (audit S1, code reading only, not changed); hashes are provenance only.
