# D336 source investigation: preserve direct-surface trim ownership

PROPOSAL ONLY, 2026-10-30 KST. Source base: 0e76152def0b24bb97615c4a3301ee1f8ee0a316, local/cad-dev. Worktree: /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b. D335 documentation is being assembled by root/its docs owner. That WIP was read and preserved. This investigation runs no product code, tests, builds or browser. No source edit, branch operation, dependency or schema change. Only /tmp/d336-plan planning artifacts were written. Independent oracle is Python Fraction arithmetic, not product execution.

## Outcome and ranking

The next useful roadmap08 slice is trim-loss prevention at existing direct-surface consumers, before adding optional generic surface/face editing. This is a SOURCE_CANDIDATE_NOT_REPRODUCED. Direct source omission is established; a real product defect is not yet execution-confirmed. First freeze and reproduce the current bytes, then implement only the reproduced scope.

| Rank | Current finding | Evidence class / confidence | Scope implication |
|---|---|---|---|
| 1 | Trimmed source -> Reverse / Split / Extract region / Extend hides the source and makes result objects without trims. IGES export exports support geometry only. Surface intersection likewise computes support intersections, without trim clipping. | Direct source evidence, high confidence in metadata omission; runtime NOT_RUN | Reproduce and close false-success / trim-loss boundary. Use atomic refusal where trim transport is unavailable. |
| 2 | Existing thicken and sew have core Part feature kinds and actual Studio actions, but no shared public Part facade/spec entry in current API inventory. | Confirmed absent facade consumer in inspected inventory, high confidence | Optional bounded raw snapshot facade extension. Do not rebuild current operations. |
| 3 | Exact arbitrary solid-face move/delete/replace, exact curved thicken/offset, trimmed sewing and generic trim clipping are not supplied by the inspected public production path. | Generality unsupported / no producer located, medium confidence | Would need broader algorithm or contract work; not the smallest next slice. |

D333, D334 and D335 are delivered only at recorded bounded profiles. A broader curve/fill extension has no higher source-grounded need in this investigation. Existing roadmap08 explicitly calls for preserving dual UV/trim ownership and atomic refusal; the selected candidate belongs there.

## Already present: do not report missing

- Offset face command moves a picked flat face along its normal by extracting a display-derived sketch, extruding, then union/difference. This is a bounded existing planar push/pull consumer. It is not arbitrary exact B-rep face translation. It rounds extracted display profile coordinates to1e-4 mm and does not constitute exact face surgery.
- DirectPanel supports native curve/surface editing, Trim by curve, Untrim, Extend, surface region, Split, Reverse, pole edits, affine transforms, surface Fill/Loft/Sweep, intersection curves, Thicken and Sew. Direct.Fill constructs a surface, not a placement pattern.
- Part thicken validates a raw surface, uses existing thickenSolid and returns a faceted closed body; native default40x40 grid and fold refusal remain. It does not support trim loops.
- Part sew takes2..64 raw natural-domain surfaces and joins one closed solid with existing tolerance behavior; it does not sew interior trims. Studio explicitly refuses trimmed thicken/sew before source metadata is dropped.
- Source edits are immutable DirectGeometry edits. add() preserves old source text and objects, hides old objects, and allocates new IDs. refine()/transform() preserve object identity and spread the old object metadata. Native .bcad JSON retains direct metadata; there is no need for a new schema for refusal.

## Source-grounded candidate chain

1. directOps.trimByCurve stores `{uv,keep}` on the DirectObject; its support Surface stays unchanged. directDisplay chooses trimmedMesh when that metadata is present.
2. reverseSurface/splitSurface/surfaceRegion/extendSurface pass only result geometry/name to add(). add() creates a new object without trims and hides the source. Therefore the displayed result will use the whole support branch if the operation succeeds.
3. DirectInspector protects thicken/sew with `o.trims?.length`. A result that lost this metadata bypasses that protection and can create a full-support solid.
4. directIGES filters visible objects then exports geometryOf() only. Kernel IGES emits entities126/128, not trimmed-surface entities. The UI calls the action 'The visible curves and surfaces'. Native Save and IGES export have different fidelity here.
5. surfaceIntersection ignores both objects' trim metadata, intersects support patches, then emits only world polylines. No pair of retained source UV chains is used to clip the result against both trim sets. Full trimmed-intersection support cannot be inferred from the kernel marcher alone.

These are source-derived chains, not observed application failures. The current direct tests cover untrimmed Reverse/Split/Extract and a separate trim display case; they do not cover their composition. No new failing test result is claimed.

## Recommended exact D336 freeze: trim-safe refusal boundary

Name: `D336 — Refuse operations that would discard direct surface trims`.

Do not add a Part feature or a general trim engine for this repair. Keep public method signatures, source format and native JSON fields unchanged. A surface-only metadata boundary belongs to current directOps/directIGES/surfaceIntersection APIs and DirectPanel; inventing a solid Part verb would misstate the operation.

- Before allocation/native work, inspect the selected DirectObject(s), not just geometryOf(). Resolve each requested object exactly once; missing/ambiguous IDs must refuse. For this bounded repair, known valid direct surfaces with a nonempty trim list are the positive refusal profile. Do not silently turn malformed trim metadata into no trims; narrowly validate containers if needed at the changed seam.
- Reverse surface, Split surface, Extract region and Extend surface: when selected surface has nonempty trims, throw existing typed Model refusal (recommended `DIRECT_TRIM`, if root adds a dedicated existing-union code; otherwise use a suitable existing code) with a short instruction: `This operation does not preserve surface trims yet. Untrim the surface first.` The operation must not allocate a source, hide/change an object, select a nonexistent result, add an Undo entry, dirty the accepted document, or change witness solid mass.
- Intersect surfaces: if either selected surface has nonempty trims, refuse before the native support-intersection call. Say that trimmed intersections are not supported. Do not return a support curve as if it were the trimmed material intersection. This is a pair-of-UV ownership boundary, not a new marcher.
- IGES export: if any VISIBLE selected surface has nonempty trims, refuse the entire export before bytes are returned or a download occurs. Use existing `IGES_EXPORT`, with an explanation that this writer exports whole NURBS curves/surfaces and cannot preserve trims. Hidden trimmed sources do not block exporting unrelated visible untrimmed objects. Do not silently omit a trimmed object or export its support under the same label.
- Explicit Untrim remains the intentional way to remove trims, as one undoable edit. After Untrim, all existing untrimmed operations and raw IGES writer continue with their current contracts. Undo restores exact original trim arrays, object IDs, source references and hidden flags.
- Existing parameterization-preserving Insert knot / Raise degree, pole edit and affine transform paths are not automatically disabled. Their trim metadata is carried by object spread/refine. Do not broaden the repair to a generalized validity proof without evidence.
- Native .bcad Save/Open must preserve direct objects, trims, keep flags, hidden originals and sources semantically. No new schema, migration default, dependency, new limit or general engine.
- Keep exact current source/native limits for untrimmed calls. A refusal guard adds no new geometry admission cap.

This is a useful existing-consumer repair even though it adds no new admitted geometry. It prevents source loss and preserves the already explicit thicken/sew refusal boundary. It is not completion of general trim/extend/surface modeling or arbitrary face editing.

## Functional alternative, only if root selects it

A bounded trim-preserving Reverse can reuse native reverseSurfaceAxis parameter provenance: selected coordinate maps by `a+(b-t)`, the other stays unchanged; domains are retained. Transport each UV point and preserve loop `keep`, loop order and point order. Native degree1..3,2..16 poles per axis/256 total and local1e-7 point/relativeD1 observations already exist.

This is larger than a guard: native reflection is not a blanket exact-roundtrip certificate for arbitrary represented UV samples. Projected trim loops contain floating UVs. A plain `a+b-t` can overflow/cancel/round; changing the surface while retaining unchanged UV loops is also wrong. Any supported transport needs a representability/binding contract and atomic refusal before publication. Double reversal is not a promised bitwise identity in the native report. Sampled trim meshes are not exact B-rep faces. Do not claim dual-UV trimmed sewing, full material membership, solid mass or global trim fidelity from a few vertex checks. For this reason guard-first is the smaller defensible D336 proposal.

## Independent geometry / mass / names oracle

See independent-oracle.py and independent-oracle.json. Arithmetic uses no CAD, display, trim, projection, reversal or IGES implementation.

Support plane:

```text
S(u,v) = [20+5u, -11+5v, 3]
u in[-2,6], v in[1,7]
control net = [[[10,-6,3],[10,24,3]],[[50,-6,3],[50,24,3]]]
degrees1x1; knotsU[-2,-2,6,6]; knotsV[1,1,7,7]; unit weights
```

Asymmetric hole UV rectangle[-1,1]x[2,4] -> world[15,25]x[-1,9] atz3. Support area1200, hole area100. Keep outside: area1100 and area centroid[340/11,104/11,3]. Keep inside: area100 and centroid[20,4,3]. The non-unit, non-zero-based domain catches accidental `1-u` mapping. For a future supported reverse: U map4-u sends hole to[3,5]x[2,4], V map8-v sends it to[-1,1]x[4,6], with the same world hole.

A silently untrimmed result has area1200 and centroid[30,9,3]. If it is thickened2 along+Z, full-support volume is2400; a mathematical extruded holed region would be2200. The EXPECTED PRODUCT RESULT for trimmed thicken is REFUSAL, not either solid:2200 is only a discriminating geometric counterexample and not a request to implement trimmed thicken.

Direct trimmed surfaces are open and have no occupied-volume mass. Mark their solid mass NOT_APPLICABLE. Do not invent a mass PASS. Use one separate accepted Box witness [80,-3,1]..[92,4,6]: volume420, centroid[86,1/2,7/2]. Every refusal, Undo/Redo and native file step must preserve its volume, centroid, bounds and exact face names from the same accepted feature ID. For direct identity, assert full object/source/geometry IDs, names, trim loop arrays/keep flags and hidden flags, not only surface mesh area.

For guard-only D336 the strongest oracle is exact accepted-document equality before/after every refused action plus no Undo entry and no download. Existing display area is sampled; retain its current bounded tolerance rather than presenting it as exact material certification. Public Trim by curve uses160 projected samples; compare its saved actual UV loop directly and keep arithmetic rectangle as the independent intended-shape oracle. A small metadata fixture with the exact rectangle isolates transport/loss from projection approximation.

## Minimal actual Studio flow

After D335 push, root freezes exact source bytes. First run one focused immutable baseline probe: import the plane + closed asymmetric rectangle through existing source entry; Trim outside, then try Reverse (or direct export), and capture whether the current visible trim is lost. If not reproduced, keep the source candidate open and do not mark a defect fixed merely from code edits.

For repair qualification, one browser with serial contexts:

1. Create the separate Box witness with existing command. Import the support plane and a closed rectangle through existing .barocad/Make curves path. Apply Trim by curve Keep outside. Capture actual object IDs, UV loops, source text, visible hole, sampled area, witness mass and document state.
2. Attempt Reverse U, Split, Extract region, Extend and surface intersection. Each must refuse without accepted document/selection/Undo or witness-mass mutation. Use one second crossing support plane for intersection; no native intersection execution should occur after the trim guard.
3. Attempt Export IGES. Verify no download and the explicit trim-fidelity refusal. Native Save/New/fresh Open must retain the hole, exact IDs/names/loop metadata and witness mass.
4. Explicit Untrim; one Undo restores the original UV list and hole. Redo removes trims. Now a selected untrimmed Reverse and IGES export/import remain usable. Restore the original native file and repeat one refusal to prove file admission preserves the boundary.
5. Keep inside is a second focused metadata case (and optional short UI case if it changes actual ownership behavior), not a separate wide product campaign. Hidden trimmed original + visible unrelated untrimmed geometry must still export.

All six refusal seams are parallel cases, but use the same bounded fixture/actual state. Reuse unaffected prior owner/Stop receipts; no full suites or general surface-matrix claim. Retain first product and driver failures and resumed-prefix boundaries.

## Bounded change map after reproduction

- packages/barocss-cad-model/src/engine/direct.ts: shared selected-surface trim guard before Reverse/Split/Region/Extend/Intersection/IGES; preserve source/name/ID semantics. Do not replace native algorithms.
- packages/barocss-cad-model/src/engine/refusal.ts: only if a dedicated code is selected. Existing IGES_EXPORT remains.
- apps/cad-studio/src/ui/DirectPanel.tsx: existing error path already catches directOps errors; add accurate disabled/hint state only if it clarifies support and can use the same eligibility helper. Do not create a second admission policy in JSX.
- Tests: focused direct composition/refusal/native file checks; actual Studio driver. Any source-local fixture reproduction must be retained as pre-fix evidence. No broad API inventory changes unless an exported helper is intentionally added.
- Existing DirectInspector thicken/sew rejection and Kernel operations remain; do not add a new raw thicken/sew facade in the same repair.

## Exact source references

- apps/cad-studio/handover/roadmap.md:78 — D333/D334/D335 bounded profiles; remaining08 owns trim/reference/atomic-refusal requirements.
- packages/barocss-cad-model/src/app/profileCommands.ts:95-111 — current planar Offset face through Extrude/Boolean.
- packages/barocss-cad-model/src/app/faceProfile.ts:1-12,59-94 — display-derived profile and rounding; not exact generic face surgery.
- apps/cad-studio/src/ui/DirectPanel.tsx:14-29,54-78,145-185 — current public UI surface operations and error funnel.
- packages/barocss-cad-model/src/engine/direct.ts:12-20,37-41 — trim metadata belongs to DirectObject, separately from support geometry.
- packages/barocss-cad-model/src/engine/direct.ts:81-100 — add() creates trim-free result objects; trimByCurve stores UV loops on source object.
- packages/barocss-cad-model/src/engine/direct.ts:131-146 — Split/Region/Reverse do not pass trim metadata.
- packages/barocss-cad-model/src/engine/direct.ts:214-230 — Extend samples/refits support, then creates a trim-free result.
- packages/barocss-cad-model/src/engine/direct.ts:249-258,286-288 — transforms/duplicate preserve object fields by spread; distinguish these from add().
- packages/barocss-cad-model/src/engine/direct.ts:356-382 — support-only intersection and world polyline conversion; no dual trim clipping.
- packages/barocss-cad-model/src/engine/direct.ts:422-467 — hidden filter, trim-aware display cache and trimmed vs full support mesh branch.
- packages/barocss-cad-model/src/engine/direct.ts:507-514 — visible objects exported as support geometry only.
- apps/cad-studio/src/App.tsx:1977-1979 — actual IGES download path and refusal catch.
- packages/barocss-cad/src/io/iges.ts:119-143 — writer admits curves/surfaces and emits126/128, no trimmed surface entity.
- packages/barocss-cad-model/src/engine/trim.ts:1-11,37-60,69-91,126-134 — UV loop contract,160 projected samples, keep semantics, sampled display clipping.
- apps/cad-studio/src/ui/DirectInspector.tsx:22-37 — current thicken/sew reject trims before raw snapshots.
- packages/barocss-cad/src/part/part-shell.ts:16-29 — existing Part thicken admission and typed fold/geometry mapping.
- packages/barocss-cad/src/brep/thicken-solid.ts:1-21,25-61 — faceted default40 grid, current normal/side/fold semantics.
- packages/barocss-cad/src/part/part-mesh.ts:54-66 — existing Part sew2..64/tolerance<=1 and raw surfaces.
- packages/barocss-cad/src/brep/sew-solid.ts:1-6,19-24,84-105,140-163 — natural-edge sewing/tolerance and named closed body output.
- packages/barocss-cad-model/src/engine/doc.ts:407-408,566-567 — existing snapshot thicken/sew nodes.
- packages/barocss-cad-model/src/engine/part.ts:174,291 — Model-to-Part adapters already present.
- packages/barocss-cad-model/src/app/editFields.ts:532 — current thicken thickness editor.
- packages/barocss-cad/src/api/spec.ts:29-51; packages/barocss-cad/src/api/part.ts:140-226 — current shared facade inventory does not include thicken/sew.
- packages/barocss-cad/src/nurbs/surfaces/surface-axis-reversal.ts:34-39,62-69,192-246,300-315 — actual native UV maps, current bounds, unchanged domains and limited observations; no global/double-reversal-bit certificate.
- packages/barocss-cad/src/nurbs/curves/curve-reversal.ts:79-90 — guarded floating reflection; cannot casually replace with a+b-t.
- packages/barocss-cad-model/src/engine/container.ts:24-35,87 — native full document JSON and actual reader.
- packages/barocss-cad-model/src/engine/migrate.ts:27-77 — current read spreads authored document/direct data; no trim-specific repair applied.
- apps/cad-studio/src/App.tsx:787-805,839-853 — central commitDirect/carryOver and Undo ownership; current routine direct refusal can occur before commit.
- packages/barocss-cad-model/test/direct.test.ts:58-79,248-269 — existing untrimmed surface tests and separate trim tests; composition coverage absent in these tests.

## Proof boundary

Source inspection only. No product/runtime defect reproduced. No Kernel/Model/Studio test or browser run. Independent area/centroid/mass arithmetic is PLANNING. Next owner action is one focused pre-fix reproduction after the D335 push; only then choose the exact repair scope. Full solid-face editing, trimmed thickening/sewing, exact offset, surface packing, dual-UV clipped intersections, real geometry failure/recovery, remote CI/release and whole08 remain unqualified.


## Immutable pre-fix execution follow-up

At1fb2d11e9e4713bac3bfbc1131fc45302aa558f3, all six source consumers now reproduce underNode22.19.0. See `/tmp/d336-probe/report.md`, results.json and before/after496-input capsules. Original objects retain trims while hidden; new visible result/export/intersection loses material semantics. Existing codes DIRECT_VALUE / DIRECT_INTERSECT / IGES_EXPORT suffice. The former SOURCE_CANDIDATE_NOT_REPRODUCED classification is superseded only for these six own-fixture programmatic cases. Studio/browser/thicken allowance and native .bcad remain NOT_RUN/NOT_PROVEN. Gate released. No source changes.
