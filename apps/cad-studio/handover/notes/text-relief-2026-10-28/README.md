# Bounded Text relief evidence — 2026-10-28

Status: D296 runtime verified on frozen `62069bbd1`. Final whole kernel2000 total/1994 pass/0 fail/6 existing
skips, Model1822/1822, Studio365/365. Actual Chrome/WebGPU startup and relief flows36/37 pass. Generated tools/refusals/inventory checks pass; docs pass:68 pages/53 shots/4488 KiB/852 labels. The earlier initial kernel1994/0/6 run predates the final helper and is historical evidence.

## Supported source

One closed physical solid, native line-only upright representation, exactly one Z slab, and one exact unmerged +Z
top face. Actual slab material M and selected B-rep oriented trim F are checked separately for every filled glyph
component. The full component must be inside both, with requested font-flatness plus native-policy clearance and
conservative pair separation. Native policy is not widened. Unsupported source/face/component geometry is refused.
All checks run against the original source before direct emboss slabs or one batched engraving difference.
Directed-endpoint multiset matching has an exact split/merge fallback; complete oriented frontier equality and
a dyadic 3D audit remain required. No work or numeric limits were raised. Engrave leaves a positive native-policy web;
emboss needs represented positive raised height and seat. Result: one closed strict-valid physical solid.

## Stored/public contract

Model `text-relief` keeps parent, faces:[oneName], original text/FontSource, em size, at:[worldX,worldY], depth,
mode, explicit tolerance, optional tracking and existing NodeExtras/sigs. No plane or copied top Z is stored.
No new schema/container version, default font, runtime dependency or WASM is added. Missing selected sig is
structurally readable but refuses BAD_REFERENCE at native expansion. An ordinary source-height edit may follow the
same authored face's new top; signature identity is not a fixed-geometry assertion.

API: `.textRelief(b=>b.faces().facing('+z'), font, text,
{size,depth,at:[x,y],mode,tolerance?,tracking?})`.
Studio: Text relief → original font/text, em size, depth, tolerance, tracking, baseline X/Y, Emboss/Engrave → preview
and Apply/Cancel. Bound numbers are edited in Parameters. Text/font metadata stay opaque through reference remaps.

## Independent reference

The earlier independent fontTools4.67.0 observation gives ABeeZee A straight-outline area 148797 at unitsPerEm 1000.
On the actual 40x30x10 box with at [5,5], em 10/depth 2, the analytic references are 12029.7594 mm³ emboss and
11970.2406 mm³ engrave. Native/API tests and the actual Latin browser flow observe these references; engraving at depth1.5 also observes11977.68045 before reopening and editing to depth2.
Native output volume audit is not a set-equivalence proof or universal shape certificate. The split-cap test is
an internal helper fixture, not a separately authored public native-document fixture. Readonly output types do
not promise protection when callers force mutation.

## Current verified boundary

- PASS: final kernel focused 19/19; Model tsc second pass and 75/75 focused; Studio tsc and 35/35 focused.
- PASS: Nanum Gothic/Myeongjo 가한, both emboss and engrave, em 10/at [5,5]/depth 2, explicit default tolerance 0.01.
- EXPECTED REFUSAL: Nanum Myeongjo 가한 engraving with tolerance 0.002 exceeds the unchanged 1m boundary/Boolean
  work budget with INPUT. Its original node retains 0.002. This tighter request is not a passing stress case.
- PASS: inventory 6737 keys, 8 new/0 removals/0 duplicates; existing 36 rows/53 fields = 12 semantic+41 union-order
  notation, plus 1 top-level kind addition; all 847 prior members +9 new retained, 212 checks pass.
- PRIOR SOURCE ONLY: initial whole kernel 2000 total/1994 pass/0 fail/6 existing skips in 247284.63 ms.
- PASS: final Model/Studio types and changed lint, 0 errors; existing chat.test.ts any warnings 32, no new test any.
- PASS: one paired RUNS=7 perf, emboss 7→6 ms/engrave 6→6 ms, both B-rep fingerprints SAME; strict validity/physical 1/
  face-edge-vertex counts/sorted face+edge names/volume/centroid shape SAME. Single pair and rounded ms do not prove
  stable speedup or Studio latency improvement.
- PASS: final whole kernel2000 total/1994 pass/0 fail/6 existing skips (256904.582958 ms), Model1822/1822
  (239424.624417 ms), Studio365/365 (24200.915291 ms).
- PASS: actual Google Chrome/WebGPU1440x900/DPR1, canvas1140x900; startup and Latin36/Korean37. Latin tolerance0.002:
  emboss/refused outside placement/History edit/Undo/Redo/Save/Open/re-edit. Both Korean originals explicitly use0.01
  for 가한 emboss/engrave and Save/Open. Browser text/recipe freshness and raw volume checks pass.
- PASS: generated-tools/refusals/inventory checks and docs:68 pages/53 shots/4488 KiB/852 labels.

The original Latin emboss screenshot is `text-relief-emboss-applied.png`; Gothic reopen is
`text-relief-gothic-reopened.png`. Latin engraving and Myeongjo reopen are unchanged public shots:
`/shots/studio/features/text-relief-engrave.png` and `/shots/studio/features/text-relief-korean.png`.
Latin emboss/engrave and Myeongjo reopen were visually inspected. Gothic is browser-assertion evidence.
`validation.json` records runtime, counts, dimensions and original-copy hashes; `browser.txt` and `display.json`
record the actual run. Screenshot copy verification is artifact integrity, not functional source pinning.

## Original failures

Initial kernel load failed at profile-relief.test.mjs:196 with `SyntaxError: Invalid or unexpected token` from
an unintended join-string newline. The next run had 12/13 pass; unsupported circle/arc geometry was classified as
INPUT before CAPABILITY and reported `CadPartError: relief: profile relief needs 3..1024 line edges per loop`.
Fixing the admission order gave 13/13. The first Model type errors (TEXT_RELIEF_PICK code union and invalid-values
array inference) are quoted in D296; root fixed them and the second type check passed.

| Model focused attempt | Result | Original failing stage |
|---|---|---|
| first | 73/74 | rational operation budget, orient/inRing |
| second | 73/74 | rational operation budget, area |
| third | 73/74 | boundary/Boolean work budget, repeated nativeBoolean |
| fourth | 73/74 | boundary/Boolean work budget, covered/sameBoundary |
| fifth | 73/74 | boundary/Boolean work budget, pocketRegions |
| sixth | 73/74 | unchanged old test rerun after a wrong local edit path; not a new geometry result |
| seventh | 75/75 | default 0.01 positive fixtures plus explicit unchanged 0.002 refusal |

The exact native error fields were:

```text
error: 'n2: profile relief: Exact rational operation budget exceeded'
code: 'INPUT'
```

```text
error: 'n2: profile relief exceeds its boundary/Boolean work budget'
code: 'INPUT'
```

Logs: `/tmp/barocss-text-relief-model-focused-{first,second,third,fourth,fifth,sixth,seventh}.log`. The sixth edit
command reported `FileNotFoundError: [Errno 2] No such file or directory: 'packages/barocss-cad-model/test/text-relief-engine.test.ts'`; its native test log preserves the repeated old request.
The batch kernel candidate first passed 18/19 with `Missing expected exception.` after 64 small components became
admissible without redundant work. The corrected fixture proves 64 components, volume 11710.72, strict validity and
one physical body. A 65-component count excess and a separate 1024-edge work excess still refuse; 19/19 then pass.
Original logs: `/tmp/barocss-text-relief-kernel-focused-batch{,-second}.log`.

See `../report-text-relief-performance-2026-10-28.md` for the paired RUNS=7 result, original fingerprints, shape
checks and limits. Final receipts: `/tmp/barocss-text-relief-perf-final.log` and
`/tmp/barocss-text-relief-shape-final.log`. No source/original-font checksum baseline is used as a functional
glyph test. Bench output/content-address checks serve separate result/integrity boundaries.

The new browser flows do not exercise a later independent body or a delayed upload race. Those boundaries remain
Model fixtures/shared-controller tests and source review. Full browser/GPU matrices, native OS IME, arbitrary fonts/all glyphs, general or curved face relief, rational/smooth wrapping,
shaping/kerning/bidi/normalization, release, push and PR are not qualified. Next decision: D297.

## Final generated checks

The initial generated refusal check reported:

```text
docs/reference/_refusals.md differs from the sources: run node scripts/refusals.mjs
```

Regeneration adds only TEXT_RELIEF_PICK. The initial docs check then reported:

```text
studio/features.md: the label **Baseline X/Y** is not in the studio's sources
```

Use the actual separate labels Baseline X and Baseline Y. Final tools/refusals/inventory checks pass; docs pass
68 pages,53 shots,4488 KiB,852 labels. Original failed blocks are retained in `original-failures.txt`; the original
edit-path error is quoted above. API audit's first temporary native-branch syntax assumption failed because an
inferred optional type adds undefined; the audit script was corrected without changing the candidate/source.
`api-inventory-review.md` describes its exact scope. No push, PR or release occurred.

Original run outputs use tracked .txt copies because .log is ignored. `perf-final.txt`, `shape-final.txt`,
`docs-check.txt` and `inventory-check.txt` preserve their original bytes. validation.json durations are milliseconds.
