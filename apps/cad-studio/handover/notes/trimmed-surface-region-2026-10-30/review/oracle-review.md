# D341 independent oracle and browser source review

## Scope

SOURCE ONLY. Fixed checkout `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`. This reviewer read the Node test helper, its new Model consumers and the prepared browser driver. No candidate/test/build/browser/heavy operation ran. No repository file was edited. Only this `/tmp/d341-review` capsule was written. Kernel adapter review has a separate capsule.

## Initial verdict

No required arithmetic or algorithm-independence defect found. One required comb acceptance coverage improvement was sent directly to root and Model author: compare every returned component area/centroid with the independent oracle, rather than only component count and total area. The author added unused consume-matching for each output and requires zero remaining expected components. Final source re-read confirms all78/79 components, including centroid y positions, are now independently matched. The source coverage finding is closed. No runtime result is inferred from assertions being present.

## Node oracle checks

- The normalized BigInt rational operations, exact DataView binary64 decoder and integration formulas are unchanged from the reviewed D340 helper.
- With `crop` undefined, the selected domain is the same original domain; `cropO` is undefined; switch-level and clipping branches are skipped. Changing destructured interval bindings from const to let adds no arithmetic or mutation to the original Line objects. Thus the D340 oracle path has no observed source behavior drift.
- With crop supplied, selected-axis bounds come from the crop while outside complement endpoints still come from the original perpendicular domain. This is necessary: the original polygon defines removed material before intersection with the requested crop.
- For a nonparallel trim edge `o=m*t+b`, switch level `(cropBorder-b)/m` is exact and admitted only on the original closed edge and selected crop interval. A selected-constant edge is already an original vertex sweep level. A perpendicular-constant edge has no endpoint-formula switch. The skips at helper line52 therefore do not omit a required interior switch.
- Original vertex levels, selected crop endpoints and both perpendicular-border switch levels partition the domain so each interval's lower maximum and upper minimum selects the same Line or crop constant throughout an open slab. Entirely out-of-crop intervals become nonpositive and are skipped; partially clipped positive intervals retain their exact linear width. No tolerance or approximate sorting decides this.
- The exact integral uses width, t*width and (right^2-left^2)/2. Crop clipping changes only the two endpoint lines; the area/first-moment formulas remain correct.
- Adjacent nodes join only through strictly positive exact interval overlap at their shared level; zero-width contacts cannot bridge components. Union-find and moment sums retain exact rational arithmetic. `trimRegionOracle` places the Split wrapper cut at the crop's selected-axis upper endpoint, so every interior slab is lower and no positive crop material is dropped into the unused upper result.
- The helper has no product imports, Kernel predicates, arrangement calls, clipping dependencies or SectionRationalContext usage. It is independent from the Kernel half-edge arrangement. The fixed world map remains [20+5u,-11+5v,3], area Jacobian25, matching all fixtures to which its moments are applied.

## Model consumer checks

- The ten public160 cases obtain UV from actual `trimByCurve`; the ideal eight-point loop is not substituted in those oracle inputs. Each case computes the crop in both sweep axes and requires exact normalized component area/centroid agreement, independently of output order.
- Positive cases consume-match stored output polygon world area/centroid against independent expected components, assert exact native cropped-area sums, used-child certificate fields, explicit masks, one shared native support/source, and independent owned arrays. Full-domain copy checks exact material equality and zero native operations; other frozen public crops expect four actual native operations.
- Empty inside crop uses an oracle zero-component result to require Model DIRECT_VALUE refusal and unchanged original document/visibility. Invalid ranges/profiles, missing/ambiguous IDs, collapse and retry paths are represented in source. Actual selection/Undo proof belongs to the browser driver.
- The160 comb source matches the accepted simple zigzag/left-spine construction. Its312 boundary intersections imply V476/E788 by source mathematics. Oracle expected inside78/outside79 checks are independent. The initial output assertion checks only count and total area; the requested per-component matching closes a possible missing/duplicated-tooth false acceptance.
- The dedicated triangle fixture at lines183-190 has the diagonal's crop switch levels at the crop endpoints, so it alone does not exercise an interior formula switch. The comb has many interior switch levels; its independent centroid checks exercise that extension. No additional implementation change was requested for the triangle.

## Browser driver and embedded Python checks

- Driver source: `apps/cad-studio/test/trimmed-surface-region-browser.mjs`. Its independent Python verifier imports only stdlib Fraction/json/sys. It computes switch levels using the equivalent interpolation equation `a.t+(border-a.o)*(b.t-a.t)/(b.o-a.o)`, then filters levels into the selected crop span. Perpendicular and selected constant edges are handled as in the Node proof.
- Original-domain complement intervals are clipped by crop constants after crossing parity; exact midpoint ordering selects a fixed endpoint formula for each slab. Exact polynomial area/U/V moments and positive-overlap union-find match the Node algorithm and do not reuse Kernel decisions.
- Stored output uses a separate exact Green formula, with absolute ring area and outer-minus-holes composition. Component pairing sorts by exact centroid tuple, avoiding the previous approximate equal-area ordering issue. Area/centroid comparisons use the old practical1e-7 fixture tolerance. Eight interior/off-crop probes use independent parity and assert no duplicate owner. Probe coordinates avoid the frozen crop/trim boundaries; parity boundary ambiguity is therefore not used as evidence.
- Native inspector publicly compiles each actual source, resolves each component geometry, checks shared support/source and original-domain bounds, and records local trim-vertex world observations. It labels those observations separately from whole-child coefficient/regularity proof. Witness volume420/centroid/names are checked separately from surface material.
- Accepted material comes from actual public UI Trim160 and Extract region actions. Hidden original sidecar/source/name and unrelated objects are compared with prior accepted state. Inside2, outside pocket2, outside hole1 and retained rectangle1 have independent numerical checks, native Save/fresh Open and explicit mask checks.
- Empty material is checked by independent zero oracle, real Extract region refusal, unchanged document/selection/no downloads, original visibility/count, then Undo to the seed and Redo to the same original trim. The valid retry uses the original accepted trim. This checks no empty operation was appended to Undo.
- Existing IGES/Thicken/Sew refusals are exercised through actual controls. A prior real rename provides a precise Undo witness after all three failures. Numeric/UI success remains distinct from root screenshot review in the receipt.
- Generation is guarded by the root source-freeze environment before product generation. Initial subset, bundled source inputs, virtual generator source hashes, after-browser and after-cleanup hashes are separate. One Chrome process and serial contexts are prepared; failures preserve phase, outputs and screenshots. None of those prepared checks has been executed by this reviewer.

## Native parent precedence supplement

After the initial oracle review, a required Model test expectation mismatch was found at the tiny translated Region control. The test expected new Jacobian/material refusals, but the unchanged native Region checks U/V D1 and rejects before the new material consumer. The production adapter correctly preserves native-first precedence. This finding was sent to root/Model before their run completed.

The first owner-run Model log retains63 PASS /1 FAIL for that mismatch. The author changed only the test title and both inside/outside assertions to the native `original/extracted native U/V partial observation` reason. Final narrow source re-read confirms those assertions at lines200-208, while the ordinary native-admitted empty crop DOMAIN/material control remains at lines82-84. Model production and oracle arithmetic hashes are unchanged. The repaired owner log records18 PASS /0 FAIL /0 SKIP. This reviewer read the logs but did not execute either run. The source-test finding is closed; first failure is preserved.

## Final source hashes after coverage and test-expectation correction

```
b23882d5b38580e3db7dc914f9a2a7f7c1a8bcc5672c510a61bac93595b086d3  Model test/helpers/trimSplitOracle.ts
02d54df6d6fb2ec4bb29e7537de202bad00daec73082b945c1f0faeb517c8111  Model test/direct-trim-region.test.ts
73c29b5404d49e7afaa9c5b6583cff9fb62589a12931013a219b2f8df695083a  Studio test/trimmed-surface-region-browser.mjs
```

Reviewer runtime: NOT_RUN. Source review is complete with no open required finding; no product or visual PASS is claimed.
