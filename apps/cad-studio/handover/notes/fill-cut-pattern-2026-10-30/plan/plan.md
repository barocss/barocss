# D335 source-bound proposal: finite XY reference-point fill CUT pattern

Status: PROPOSAL ONLY. Source investigation at 9229acb83c77fa56d4b1649df84e412d05e8e4df, local/cad-dev, 2026-10-30 KST. No product edits, tests, build, browser, commit or push. Only /tmp/d335-plan artifacts were written. Worktree: /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b. Inherited untracked .claude/ preserved.

## Finding and confidence

Evidence: D333 has rectangular original-tool CUT repetition; D334 has open-polyline original-tool CUT repetition. Current Model node union and API spec list linear, rectangular and curve CUT patterns plus linear/circular body patterns. A bounded search of packages and apps/cad-studio found no fill-pattern producer or command (fill-pattern/fillPattern/pattern-fill/fill pattern). The stated existing body-fill producer premise is not established at this SHA. Direct.fill is a Coons/exact surface fill, not a placement producer. Do not claim that it is a body fill pattern.

Inference (high confidence in inspected current source): the next consumer gap is a polygon mask on an explicitly finite two-axis CUT grid. Reuse the D333 original-tool loop and names. This is useful for perforating an L-shaped region without making stock copies. It does not complete general fill patterns or roadmap08.

## Recommended contract to freeze

Proposed public API:

```ts
type FillFeaturePatternRegion = {
  readonly points: readonly (readonly [number, number])[];
};
interface FillFeaturePatternOptions {
  region: FillFeaturePatternRegion;
  anchor: readonly [number, number];
  spacing: Dim; count: Dim;
  spacing2: Dim; count2: Dim;
}
// Part.fillFeaturePattern(options): this
```

Proposed Kernel feature: `{id, kind:'fill-feature-pattern', target, region, anchor, spacing, count, spacing2, count2}`. Proposed Model node: same recipe with `parent: BodyRef` instead of `id/target`. Spec command uses `region` beside `values`, as D334 path does. Node count fields are numbers. Public option Dim preserves the normal facade binding refusal for counts. Bind only spacing and spacing2 in this first profile. Region points and anchor are plain captured numeric data, not parameter containers.

1. Plane: world XY, fixed orientation. Translation only, offset `[i*spacing,j*spacing2,0]`. No axis fields or frame mapping in this profile.
2. Region: one simple closed straight polygon, supplied as 3..16 distinct finite binary64 XY vertices without a repeated endpoint. Each coordinate is within native +/-10000 mm. Closure is implicit. Reuse qualifyNativePlanarLoopV1 unchanged: its 16-vertex cap is native, not newly invented. Both windings and concavity are admitted. Refuse zero edges, repeated vertices, backtracking, zero area, nonadjacent crossing/touch/overlap. Refuse holes, islands, multiple regions, curves and extra fields. No repair, sampling, rounding or epsilon expansion.
3. Anchor: an explicitly authored XY reference point within native +/-10000 mm. It need not be a cutter center, mass center or bounding-box center. Do not derive it from part-model bounds(), which samples upright arcs and uses curve control hulls. Suggested UI label: `Reference X`, `Reference Y`; hint: `The region tests these reference points. A cut may cross the region boundary.`
4. Counts: each safe integer 1..64; safe product <= CadPartLimits.copies (64), checked BEFORE polygon masking. Counts describe candidate columns and rows including original index (0,0), not the retained cut count. No bounding-box auto grid; no loops proportional to region extent / spacing. At most64 candidate cells, at most63 mask checks, at most63 extra Boolean cuts. A huge requested candidate rectangle refuses even if a thin polygon would retain one point. This deliberately reuses D333's work bound.
5. Public spacings: finite positive, <=10000 mm. Core can retain D333's signed nonzero spacing contract with absolute value<=10000, if root chooses exact D333 parity; document that difference. Do not add a new cumulative-offset limit that D333 does not have. Grid products are bounded and finite.
6. Deterministic order: outer j=0..count2-1, inner i=0..count-1; skip (0,0). Calculate each represented binary64 offset once, exactly as D333. Test the translated reference as an exact rational sum of authored anchor and that represented offset. Compose existing exactPoint2FromXY/exactOrient2 predicates; no Number conversion of the sum is needed. This avoids silently rounding a half/fractional reference onto or off the boundary. Predicate results refer to represented inputs, not physical uncertainty. If a simpler represented-number `anchor + offset` contract is selected instead, state it explicitly and add boundary-nextafter evidence; do not call it an exact affine reference.
7. Mask: inside OR exactly on boundary admits the candidate. Boundary uses exact orientation zero plus closed coordinate intervals; winding/parity uses half-open Y crossings. Existing exact point-in-cycle / profile-relief winding patterns provide the algorithm. Do not use geom2.insideRing or sampled curved-arrangement pointInPolygon for topology admission. This is a reference-point mask. It neither proves full cutter containment nor clips cutter geometry to the polygon.
8. Source: invoke existing cutSource even for a one-cell or zero-added-placement result. Target remains a current active unsuppressed direct difference, one nonempty solid. Reuse original tool parts, join once only when an admitted extra cell needs them, and subtract translated tools sequentially from the retained seed. Preserve complete source history. Empty tools and translated tools missing stock keep existing Boolean semantics. Existing overlapping cuts are allowed as union-of-removed-material, not counted-volume assumptions.
9. Original cut: retained unconditionally even when its anchor is outside the mask. Never recreate or mask it. One candidate, zero admitted additional cells, or empty original tool returns the same seed semantic geometry/names. Validate recipe and source before no-op return.
10. Stable names: unchanged seed tags; translated tools get D333 suffix `@i,j`. Use original grid indices, never compact retained indices. Removing a masked cell cannot rename other cells. Use string suffixes to retain transform callbacks. Names, parent references, raw region snapshot and anchor survive native Save/Open without a schema bump. Raw byte identity is a separate claim from semantic document equality.

## Region lifetime choice

Recommended first profile: inline region snapshot. The public API takes points. Studio offers eligible current closed XY straight sketches as region input, then captures their resolved numeric line starts in the new feature. Creation and reselecting a region both state `Region snapshot`; edits of the original sketch do not alter a previously accepted fill feature. The feature editor can choose a new snapshot and edit grid/reference values. This makes region ownership self-contained while source CUT references and grid names remain stable. The saved node owns copied points; mutating caller arrays cannot change it. Reject unsupported constrained/unresolved, framed, curved, holed or multi-region sources rather than silently discarding semantics. A plain L-shaped authored sketch is sufficient for the actual flow.

Alternative if root requires associative region edits: `RawRegion | {objectId}` on a closed direct straight curve. Reuse D334 base-only direct-source resolution, semantic input key, current-command direct context, candidate Worker and preflight-before-source-loss at every placement/flatten/copy/revision/Open seam. D334's current validators only recognize curve-feature-pattern, so all such recognizers must include fill consumers. Do not add an objectId branch only at compile time. The change is larger and adds live Delete/Move/Stretch qualification. Neither the current integer-XY face helper nor a new ownership engine is needed. Do not implement both lifetime models speculatively.

## Bounded implementation map after root choice

- Kernel helper: one placement/mask adapter near features/curve-cut-pattern.ts; reuse exact qualifier and planar-arrangement predicates. No general Boolean/region engine.
- part/part-model.ts: feature union + operation using cutSource/D333 loop, no-op validation order, deterministic string suffix. No producer body copies.
- api/spec.ts, api/part.ts, api/kernel.ts, api/index.ts: options/spec/method/command/binding exports.
- Model engine/doc.ts, part.ts, migrate.ts and wire/parse admission: node kind, structural/mask checks, source validation, conversion, active-parent checks, native retention. Keep suppressed-feature policy consistent with neighboring profiles and explicitly test malformed suppressed native inputs.
- Model app commands/editFields, api/studio.ts/index.ts and chat feature registration: actual command, fields, editable count and spacings, region snapshot picker; raw/API/chat paths must reach the same admission.
- Studio uses existing preview/candidate/apply ownership. Snapshot mode needs no new direct-source dependency epoch. Actual invalid edit must keep accepted document, Undo stack and displayed geometry unchanged.
- Focused tests follow D333/D334 names/history/mutation/refusal patterns. Use existing receipts for unaffected ownership paths; do not broaden evidence claims.

## Independent geometry and mass oracle

independent-oracle.py uses only Python Fraction and stock-minus-disjoint-prisms arithmetic. It does not import production CAD, polygon winding or placement functions. The L is independently represented as the union of two rectangles. independent-oracle.json contains exact fractions and cell/name/corner expectations.

Stock: [0,60] x [0,40] x [0,10], volume24000. Original rectangular through cutter: [7,10] x [6,11] x [0,10], volume150. Original reference [8.5,8.5]. Region vertices: [[4,4],[52,4],[52,20],[28,20],[28,36],[4,36]]. Grid spacing12 by10, count4 by3. Expected cells: all four columns in rows0/1, only columns0/1 in row2. Ten cuts total, nine additional, volume22500. Centroid [4559/150,607/30,5] = [30.393333333333334,20.233333333333334,5]. Retained stock bounds unchanged. Stable side names `tool.side0..3` plus suffixes for each additional admitted cell. Masked @2,2 and @3,2 must be absent; all expected cut corners and unique face names must exist. Require one valid closed solid and checkBrep. The reference at [32.5,18.5] is admitted while its cutter extends to y21 outside the L at x>28: this is an intentional full-tool-containment counterexample.

SpacingY12 edit: eight cuts, volume22800, centroid [61/2,765/38,5]. NotchX16 region replacement: nine cuts, volume22650, centroid [9159/302,6127/302,5]. No extra placements or count1x1: seed23850, centroid [9583/318,6383/318,5], unchanged names. Use D334 independent mass/centroid tolerance1e-7 for native UI observations; focused numeric tests may retain their existing relative tolerance. Equal volume alone never proves mask readiness: check cell positions/names and independent centroid.

Additional discriminating cases: reversed winding same cells/names; exact boundary anchor admitted; one-ULP inside/outside classification; fractional and half coordinates without rounding; candidate rectangle64 admitted and65+ refused before filtering; tiny positive spacing no automatic enumeration; bow-tie, self-touch, repeated vertex/backtrack and zero area refuse; holes/curves/extra fields refuse; count binding PARAMETER_UNBINDABLE; stale/suppressed/non-CUT/split/consumed parent refusal; caller data immutable; tool-size/source-position changes recompute CUT geometry while explicit reference anchor remains authored; empty tool and no-placement preserve seed.

## Minimum actual Studio flow, after focused qualification

One browser and serial contexts; pin source capsule before/after; no edits during run. Author stock and original CUT through existing commands, author one closed six-point straight XY L sketch, select the current subtract result, open Fill cut pattern, choose Region snapshot, reference8.5/8.5, spacing12/10, count4/3. Preview ten authored holes and independent mass/centroid. Refuse candidate product>64 and bad region without accepted mutation. Cancel, reopen, Apply, Undo/Redo, Save/New/fresh Open, reopen editable feature. Edit spacing2 to12; verify eight holes and independent centroid. Replace region with notch16 snapshot; verify nine holes plus stable surviving names, Undo/Redo, Save/fresh Open and editable fields. Explicitly show snapshot source edits do not change the accepted feature. If live alternative is chosen, replace that step with current direct Move/Stretch and consumed Delete refusal through the existing candidate Worker. Retain first product/driver failures and report prefix/tail boundaries as D334 does; do not label separate resumed segments a clean whole-flow PASS.

## Exact source evidence (paths relative to this worktree)

- apps/cad-studio/handover/roadmap.md:78 — remaining08 asks actual curve/fill consumer gap, not repeated body copies.
- apps/cad-studio/handover/decisions.md:16489-16522 — D333 contract and bounded evidence.
- apps/cad-studio/handover/decisions.md:16524-16569 — D334 contract, live ownership and retained execution limits.
- packages/barocss-cad/src/part/part-model.ts:725 — native copies64, length10000 and points1024 limits.
- packages/barocss-cad/src/part/part-model.ts:1044-1057 — original difference source, activity, one solid, original tool dependencies.
- packages/barocss-cad/src/part/part-model.ts:1904-1924 — D333 count-product bound, original seed, row-major loop and stable @i,j string suffix.
- packages/barocss-cad/src/part/part-model.ts:1926-1936 — D334 original tool reuse and no-op behavior.
- packages/barocss-cad/src/part/part-model.ts:897-906 — bounds uses sampled rings/control points; unsuitable generic exact cutter-center claim.
- packages/barocss-cad/src/exact-proof/native-planar-loop-qualification-v1.ts:34-100 — native3..16 finite binary64 simple loop qualification, concavity/winding and refusals.
- packages/barocss-cad/src/exact-proof/exact-binary64-orientation-v1.ts:1-5,54-77 — exact represented-number orientation, no tolerance/design-intent claim.
- packages/barocss-cad/src/brep/planar-arrangement.ts:148-156,245-251 — exact parity reference and exported rational point/orientation primitives.
- packages/barocss-cad/src/features/profile-relief.ts:113-137 — existing exact winding composition.
- packages/barocss-cad/src/sketch/xy-polygon-region.ts:107-126 — alternative native integer-only3..63 certificate; unnecessary integer restriction for recommended profile.
- packages/barocss-cad/src/planar-solids/xy-polygon-planar-face.ts:40-41,74-84 — alternative face helper carries3..12 cap and integer query restriction; avoid building a face for a mask.
- packages/barocss-cad/src/api/spec.ts:39-44,80-87,186-198 — current pattern command/options and path spec seams; no fill producer in this inventory.
- packages/barocss-cad/src/api/part.ts:198-207 — current body/CUT pattern facade surface.
- packages/barocss-cad-model/src/engine/doc.ts:329-335,225-259 — Model inventory, D333 saved/nested admission.
- packages/barocss-cad-model/src/engine/part.ts:135-138,562-568 — conversion and active source admission before gone-parent pass-through.
- packages/barocss-cad-model/src/app/commands.ts:156-164,787-818 — current CUT selection guard and actual D333/D334 command fields.
- packages/barocss-cad-model/src/app/editFields.ts:556-568 — actual editable D333/D334 node fields.
- packages/barocss-cad-model/src/sketch/loops.ts:19-32,116-124 — closed concave straight outlines become line loops; line-start extraction seam.
- packages/barocss-cad-model/src/engine/geom2.ts:6-13 — floating even-odd helper has no boundary contract; not selected for exact admission.
- packages/barocss-cad-model/src/engine/direct.ts:181-212 — Direct.fill constructs a surface, not a body fill placement producer.
- packages/barocss-cad-model/src/engine/curveFeaturePattern.ts:52-81,122-155 — live source identity, base-only restrictions and affected consumer detection if associative alternative is chosen.
- apps/cad-studio/src/app/directCurveCandidate.ts:6-32 — semantic input key/current command direct context/candidate Worker/context preflight seams for live alternative.
- packages/barocss-cad/test/rectangular-cut-pattern.test.mjs:37-46,115-147 — existing cell corner/name, empty/no-op and parent refusal patterns.

## Risks and proof limits

1. Public naming must say reference-point fill, not full cutter containment. No clipped tools, edge clearance, optimal packing, holes, curved boundaries, arbitrary frames or automatic infinite fill are claimed.
2. Snapshot semantics must be visible at creation/edit. An apparently live region picker without this wording would misrepresent source ownership.
3. Reusing the finite-binary64 qualifier requires a small shared mask adapter. It is not an existing exported general polygon material API. Do not claim the current source already has a complete fill consumer.
4. Exact mask decisions do not certify subsequent Boolean geometry; retain actual asymmetric mass/cell/name evidence and atomic Boolean failure behavior. No real natural Boolean failure has been executed here.
5. The oracle artifact is arithmetic planning evidence, not a Kernel/Model/Studio runtime PASS. Runtime/build/browser remain NOT_RUN in this investigation.
