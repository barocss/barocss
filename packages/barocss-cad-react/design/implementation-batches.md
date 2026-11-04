# Dependency-ordered implementation batches

Implementation proceeds in dependency order, with file ownership and source freezes coordinated with the main CAD roadmap. Root retains Git, the heavy-run gate, whole-worktree GUI write freeze, and main CAD roadmap. Ordinary implementation/tests use Sol Medium; complex Boolean/B-rep/tolerance or geometry judgement goes through root to Sol High. Never run mobile.

## B1: implemented selected case — closed Polygon producer

Add one useful closed-profile producer before selections/finishing. This is not the complete domain design. Polygon takes points and optional ProfileRef; it emits existing SketchNode polygon without new geometry math. It works as an Extrude/Revolve child or Definitions ref. Preserve current Rectangle/Circle and Extrude.profile API. Native closed-loop validity remains authoritative.

Owned implementation scope after release: cad-react src/compiler.ts, components.tsx, index.ts; new focused polygon tests and API type fixture; new Polygon example and inspector only if required by root's single integrated driver. Coordinate shared files with D499 owner before writing. Root/docs owner integrates docs page, component table/sidebar and changed snippets after code/API freeze.

Acceptance:

1. Type/real ReactDOM/compiler checks: dense finite points; native budget 3..1024; too few/too many/NaN/sparse values refuse; optional/forward profile ref; wrong-kind/cross-scope/duplicate/cycle and mixed input remain refused; wrapper/state/keys work. No silent close-point removal or tolerance change.
2. Mounted keyed reorder retains feature IDs and links; invalid update retains prior immutable compiled Doc and retires freshness. Recovery to valid props resubmits as required. Existing 44 controlled cases are reused unless changed seams require affected rerun.
3. Existing native polygon Extrude uses a declared pentagonal plate at width60 then80 then Reset60. Independent exact polygon area, centroid, volume and bounds use source coordinates, not mesh. Root requests Sol High for this geometry oracle/audit. A concave straight polygon is a separate bounded native case if selected; no full profile admission follows.
4. Same props checkpoints must bind current Worker request/native result/mass/Viewer frame owner. Preserve pixel/frame and world-geometry distinctions. Exact Reset document opens in root Studio with public Frame all. Persisted public numeric re-edit is a separate future lifecycle requirement, not part of this selected proof. Reuse eligible saved evidence only at exact Doc/source closure.
5. One component page includes actual exported props, child/ref examples, output kind, native budget/refusal, defaults/units and measured scope. Typecheck its real code fences, check/build docs once, review desktop route once. No release/download.

B1 has 57 controlled tests, package/API types and lint PASS, selected convex width-60/80 pentagon native/Worker/Viewer proof, invalid recovery and exact returned-document Studio Open. The separate settled-error UI case adds no physical binding. Persisted Studio re-edit/project lifecycle and other outline classes are not qualified by this slice. D509 implements the bounded B2 Loop/Profile slice; its selected evidence is separate from B1.

## B2: explicit line/arc Loop and Profile slots

D509 implements Loop with keyed LineSegment/ArcSegment and Profile with exactly one Outer plus optional Voids. Lower only consumed descriptors to existing loop/holes storage. Regions and arbitrary planes remain proposed/unexported, not part of this slice. Do not use the sampled Studio nesting classifier as new geometry authority. Keep explicit slot identities and sideTags generated from declared segment identity only where native tag budgets can be met; otherwise refuse selection capability instead of claiming stable edges.

D509 acceptance: ordered descriptor/ref grammar, dense own child arrays, staged atomic IDs/no orphan sketches, old exact lowerings, current props/invalid retention/recovery/Reset and the selected four-line/full-circle-void Extrude case. Generic annular/convenience producers, holed Revolve, additional regions and Sweep/Loft are not new physical certificates. Recorded Studio Open/F and its fresh Worker binding pass for the selected document at that source checkpoint. High handles containment/contact questions; do not repair them in React. Add each functional component page and sidebar entry in the same batch.

## B3: bounded Hole and ordinary body operations

Hole numeric center/radius/axis/side/depth uses existing Model fields and no selection. One ordinary blind through lifecycle can be adapted from main D498 exact source semantics; React native/current Viewer evidence is still new. Intersect/Scale need operation-specific logical-output and native-piece capability checks. Mirror/Split/Separate/body patterns wait for an audited named-output cardinality and SolidSet/SelectBody contract. One logical output can contain multiple native pieces; a named-output set must not be inferred from that count, and no first-output shortcut is allowed. Counterbore is explicit ordered recipe, Countersink existing field; tapped positive stays blocked on person-loaded data without starting a download/data task.

## B4: sketch authoring and constraints

Build local entity token/segment identity, then Wire/Point/Line/Arc/Polyline/Construction, then explicit ProfileResult, then current solver-rule adapters and existing metadata. Use existing helpers instead of new constraint or sampling algorithms. Preserve unsolved/conflicting/degenerate state, solver errors, construction exclusion, source IDs and public reopen behavior. Selected real constraint-driven prop changes must reach current Viewer and returned Studio project; stored outline metadata alone is not solver proof.

## B5: datum and native selection bridge, finishing

Explicit datums first; same-owner native face/edge descriptors next, including result-version capture and existing signature/held/rematch integration. Audit actual Studio planar-face authoring path before FaceExtrude. Native topology query requires a supported engine port; it must not be inferred from render meshes. Then add Chamfer/Fillet/Shell/Draft one bounded operation at a time. High reviews stale/rematched selection semantics and native geometry. No FaceUV/general stability claim. Each operation has invalid retained geometry and post-Open selection/re-edit proof.

## B6: Sweep/Loft and patterns

Ordered Straight/Bend path, typed sections and explicit copy/frame semantics precede operations. Operation-specific profile capabilities stay enforced. Add current body occurrence sets before feature patterns; feature pattern sources must satisfy current native node/refusal rules. Native array output identities, skip and reorder behavior require proof. NURBS breadth remains held.

## B7: static assemblies

PartDefinition/Instance roots, definition revision and explicit accept/dismiss, occurrence paths, static origin-plane mates, native analytic mate refs, pending/freedom/problems, then instance patterns/cuts/BOM/steps. Keep radians in existing stored joint settings separate; no new Motion/Physics. Test shared definition update, unchanged occurrence placement/looks, cyclic definition refusal and stale mate retention; actual current Viewer plus own project Open/re-edit. Reuse main D456–D459/D493 only as prior backend evidence, not new React proof.

## B8: drawings and resources/view controllers

DrawingDocument with exact source revision/scope, Sheet/View and annotations before sections/details/BOM/revision workflows. Add person-supplied resource controllers with explicit ownership/cancel/content identity, then staged whole-model input transaction and optional view controllers. Validate native source→current SVG and saved project bindings independently of display Viewer. Existing PDF mismatch stays deferred; no screenshot/golden weakening, export/download, schema or release widening.

## Status reporting

For each batch report source/type/controlled tests, native physical oracle, current Worker/Viewer, Studio Open/project and docs separately as PASS/FAIL/NOT_RUN. Do not count stored kinds as completed components. User function components are unlimited; built-in capability is counted only when an actual implemented exported component has its own admitted input/output contract and evidence.

D509 checkpoint: D509 implements Loop, LineSegment, ArcSegment, Profile, Outer and Voids. The existing thirteen logical elements remain; the package now has nineteen. The 76 source-checkpoint controls (65 reused with unchanged inputs and 11 newly run), package/API types, lint and four semantic mutation controls pass. The selected all-six SegmentedProfiledPlate passes four original Viewer states and native proof. Returned-document Studio Open/F and the separate compound-metadata consumer pass at their saved source checkpoints. Current-source Studio continuation and fresh documentation verification are recorded separately from geometry evidence.

Loop and Profile produce closed-profile data. Outer/Voids and LineSegment/ArcSegment are structural descriptors, not extra native features. Extrude.profile, old Rectangle/Circle/Polygon lowerings and staged identities remain compatible. Exact circle conversion uses the existing helper with no sampling. Regions, arbitrary plane/face inputs, constraints and Sweep/Loft adapters remain unexported. Holed Revolve keeps its own native admission and remains physically unqualified by this Extrude case. No universal contact/containment repair or refusal is promised. Part remains one logical Model result that can contain multiple native pieces.
