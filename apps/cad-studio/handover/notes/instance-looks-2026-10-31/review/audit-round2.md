# Independent audit, round 2, FULL tier: instance looks (roadmap 10 ①)

Verdict: **CHANGES_REQUIRED** (one finding)

## 1. Round-1 probes against the current code
- `probe.test.ts`: 13 of 13 pass. All the round-1 defects are fixed: split side held, merge held, freshness goes stale, bundle mass and materials, robot link mass, Open refusals, face check.
- `probe2.test.ts`: the p2 test still fails. That is my probe's fault, not the code's: it reads `looksOf`, which keeps the part's own face names for the panel. Through `looksOnFold`, the API that drawing and 3MF use, the colour reaches the folded faces of p1 and p2 (probe3 F1 passes).
- Repo tests: cad-model 24/24, studio 9/9.

## 2. Side effects
**Byte-identity:** I ran HEAD's sources (from `git archive`) and the current sources over 48 fixture `.bcad` documents with no looks. The documents came from studio test fixtures, cad-model samples and tests, and barocss-cad conformance. 454 outputs compared, 0 differ. The outputs were:
- modelInput and materialInput digests
- bomView, deriveBom and bomResult
- materialsOf
- each massResult
- checkAssembly
- for the 10 robots: inertia, URDF and MJCF

Scripts: `digest.ts`, `head.json`, `now.json`.

**Held keys:**
- On every part document in the corpus (96), `lookKeysOf` equals the keys evaluation produces (K1).
- Geometry-only revisions hold nothing: bracket to rev B, nested-mate to rev B, instance-looks to rev B (K3).

## Finding
**MEDIUM — false hold with a suppressed feature.** `lookKeysOf` (`assembly/looks.ts:176`) is built on `leafBodies`, which ignores `suppressed`. Take a revision that adds a suppressed `union(n3, n1)`. Evaluation still gives bodies b1 and b3, but `lookKeysOf` gives only {b3}. So the override on b1 is reported as held when offered and after accept, even though it still renders. That is a wrong result in the listing and the toast; no data is lost. Probe: probe3 K2.

Fix: skip suppressed nodes in `lookKeysOf`, both what they consume and what they make. A suppressed solid feature would otherwise be counted as a body, which is the opposite error.

## Follow-up only (it fails the same way at HEAD)
`massResult` and `materialsOf` for a sub-assembly occurrence fail with "the part has no body" (N1). So nested material overrides cannot yet reach the bundle. This is not a regression.

## 3. Mutations
Each mutant is made in a scratch copy (`mut/`, `mutate.sh`, `mutant-*.diff` / `.out`) and run against cad-model instance-looks.test.ts. The unmutated baseline passes 24/24.

| Mutant | Killed by |
|---|---|
| a1 freshness digest ignores looks | the freshness stale test |
| a2 `partDoc` without looks | the bundle-vs-BOM test |
| b robot `partsOf` uses `i.doc` | the robot link-mass test |
| c held check back to node existence | the split-side test and the merge test |
| d `looksOnFold` returns `looksOf` | the nested face colours test |
| e Open material-id check off | the Open refusal test |

All six are killed.
