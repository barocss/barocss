# Support and validation boundaries

The package is private experimental workspace source, version `0.0.0-experimental`. Current code accepts more parameter combinations than have independent actual geometry evidence. Keep declaration support, controlled tests, real Worker/Viewer behavior and native physical accuracy separate.

## React admission

Use `admission="synchronous"` for ordinary synchronous components, props, hooks, Fragments and keyed arrays. Current controlled tests cover normal registration, references, reorder, invalid retention, lifecycle cleanup and StrictMode replay. The compiler never calls a user function to guess its geometry.

Portaled geometry and directly supplied unsupported async builtins refuse. A wrapper can hide an internal Suspense boundary whose fallback happens to leave a valid smaller model. The ordinary DOM registry cannot universally detect that hidden intent. Internal Suspense, Offscreen and async transitions remain unsupported, even when hidden by a wrapper. Resolve async inputs outside the complete Part before mounting it. There is no general whole-intent atomicity guarantee or custom reconciler.

## Geometry and references

The prior supported sources are Rectangle/Circle/Polygon profiles; the D509 candidate adds Loop/Profile with explicit Outer/Voids and segment descriptors, alongside, profile-based Extrude/Revolve, Union/Difference composition and existing Model Translate/Rotate nodes. Typed refs and Definitions reuse outputs within one Part. Profiles and solids have different kinds. Child and ref input are exclusive. IDs track supported mounted identities and keys, not persistent source-code identity after reload.

No native face/UV producer, arbitrary region/open-wire source, face query, sketch-constraint graph, surface extrusion, general topology picking or source-to-saved-document reconnection is exposed by this API. The backend may have capabilities that this package does not expose. The React layer adds no Boolean, transform, B-rep, numerical-tolerance or renderer algorithm.

## API inputs versus measured states

| Capability | Current source contract | Independent actual scope |
|---|---|---|
| Bracket props | Ordinary component prop updates | Original width80→100→80 example |
| Rotate | Existing x/y/z axis, finite angle with absolute value≤3600; optional finite pivot | W80 bracket, Z90°/Z180°, explicit origin pivot |
| Translate | Three finite coordinates, explicit indexed checks | dx30/50 with y40,z5, after that rotation |
| Revolve | Closed profile child/ref; required sketch x/y axis, finite angle in `(0,360]`, optional finite2D origin | Rectangle `[10,20]..[20,50]`, y axis, omitted origin,90°/180°/360° and public Reset90° |
| Polygon | One closed ordered profile; 3..1024 dense finite coordinate pairs; optional ProfileRef; native outline validity remains authoritative | Selected convex pentagon widths 60/80, height 8; public invalid recovery, Reset and returned-document Studio Open pass |
| Source restore | Supported mounted identity/key reuse | Exact original/returned finite example Doc/frame |
| Studio handoff | Existing document reader/normalization | Public Open of the exact returned actual document |

No general arbitrary-angle, arbitrary-width, arbitrary-component, full parameter-domain or inertia-accuracy certificate follows. Native sampling is finite. Worker mesh bounds/frame pixels are consumer observations, not a replacement for original native B-rep geometry.

Polygon adds no repair or tolerance rules. The native length, area, simplicity and contact limits still decide whether a declared outline can produce a solid. A valid points array does not certify a valid native outline. D504 measures only a convex pentagonal plate at widths 60 and 80 mm, with omitted plane/from and an extrusion distance of 8 mm. That selected native/Worker/Viewer/Studio proof passes; broader outlines remain outside it.

## Current evidence

The D495 checkpoint records24 unique controlled tests, package/API types, lint and final Model types PASS. Three actual browser states, one public Studio Open and two new native captures/two physical-oracle runs plus two exact 80 subproof reuses bind four current consumers. Original test fixture/type and Studio preflight failures remain in its record.

The D497 transform checkpoint has 34 controlled tests, package/API types and lint PASS. Actual A/B/C/returned-A and public Studio Open pass at the selected profile. Three native captures and three independent physical-oracle runs plus two exact-A subproof reuses bind five current consumers. The retained budgets are absolute volume1e-6mm³, density1 mass1e-9g, centroid/bounds1e-8mm and carriers1e-7mm. No numerical budget is weakened for the React path. High final saved-data review passes 7959 hash/cardinal-arithmetic checks, separate from the 34 product tests. Maximum world-volume error is 4.37e-11 mm³ and centroid error is 7.11e-14 mm; the retained limits are unchanged.

The first pre-inspector transform run recorded ready revisions1,2,3,5: two return-control edits retired an intermediate declaration. The current inspector uses a public Reset that batches initial values. Its selected Transform ready revisions/requests are1,2,3,4; Width records1,2,3. These observations do not promise one Worker request per prop change or qualify every intermediate state.

The new inspector has seven fresh ready UI consumers across the two examples. Public collapse/reopen,1200 ms idle, functional Reset, current owners, real Ready status, right280px panel,10:7 canvas aspect and no document overflow pass. The seven current whole documents bind seven saved native physical subproofs at unchanged eligible producer source; this UI-only step runs zero new native captures or physical oracles. The saved UI audit passes 20132 hash/ownership/arithmetic checks, separate from product test counts. Its first binder stopped on descriptive statusTimer wording; saved-only correction preserves that FAIL without browser/native replay.

Global translation with automatic fit yields identical A/B pixels in this measurement. A fresh visible frame, matching owners and correct world geometry are required. Some retained Studio palette occlusion remains outside a full fit/raster-precision claim. Mesh display authority is approximate; native Face/UV authority is not added.

The D499 Revolve checkpoint has 44 unique controlled tests, package/API types and lint PASS. The original test run passed 43 and stopped one test on duplicate sibling keys in its two-profile fixture. Assigning only the second fixture key uniquely preserves validation order and its intended cardinality expectation; that named test then passes. The prior 43 passes are reused, not rerun as 44 new executions.

Four selected GUI states and public Studio Open pass. Collapse/reopen and 1200 ms idle preserve document/checkpoints/requests/owners/frame. Three current native captures plus two exact 90° subproof reuses bind five fresh consumers. Native output mass and independent B-rep mass, trimmed physical bounds and the partial/full closure contracts are checked at relative volume 1e-9 and absolute centroid/boundary/normal 1e-9. The full 360° state is a genus 1 annular tube with no radial end caps;90°/180° are genus 0 partial solids. This is not general x-axis/Circle/nonzero-origin/angle or downstream-operation qualification. Final independent saved-data audit passes 41014 saved checks plus five post-write 64-hex document checks, separate from 44 product tests.

## Packaging and operations

There is no npm publication, portable engine implementation, standalone packaged Worker or distribution output at this checkpoint. The package manifest declares the existing React19.2.3 peer environment. The consumer owns engine construction, exclusive evaluation use, mass provenance, Worker URL/CSP/cache setup and borrowed-resource cleanup. Internal application helpers and Studio imports are not public package exports.

No mobile validation, PDF/export convenience, standards/manufacturing acceptance, full-kernel/baseline suite, browser CI, deployment or release is claimed here. A documentation category is not publication of the package or site. Existing project HOLDs and physical proof boundaries remain in force.

## Polygon checkpoint

The package has 57 controlled tests, package/API-example types and lint PASS. The current positive sequence is width 60 → 80 → blank-input refusal → valid 80 recovery → Reset 60, with four Ready GUI observations. The exact returned document opens through public Studio Open and Frame all. Two native captures and three exact-document subproof reuses bind five positive consumers, including that Studio observation. These are not five native captures.

The selected convex pentagon is `[[0,0],[width,0],[width,50],[10,50],[0,40]]`, extruded by 8 mm. At widths 60 and 80, independent areas are 2950 and 3950 mm², volumes 23600 and 31600 mm³, and centroid Z is 4 mm. Each native result has seven faces, fifteen edges, ten vertices, genus 0 and thirty observed pcurves. Separate output mass and actual B-rep integration satisfy unchanged relative-volume and absolute centroid/boundary/pcurve/D1/normal budgets of 1e-9. Maximum relative volume error is 2.303e-16 and centroid error is 1.422e-14 mm. This is finite native evidence, not an inertia, arbitrary-outline, concave-polygon, Polygon-Revolve or all-75-kinds certificate.

The immediate invalid-input capture retained the previous frame but sampled the inspector before it settled from Ready. A separate public UI observation waits for Error, retains the visible finite-coordinate alert and previous frame, and submits no extra native request. Its two Ready states are antecedents only: it adds zero physical captures, oracles, reuses or consumer bindings. Its first self-pin/private-tmp alias preflight stopped before any browser or output; a corrected expected-hash config preserved the code and original evidence. The primary integrated flow passed on its first execution.

All 24 actual Markdown examples pass type checking against the current API. The widened ProfileHandle contract was checked for the complete program, including the two new Polygon examples. This is separate from native physical qualification. D504 had 20 pages and 13 logical components. The D509 source candidate has 26 pages and19 logical elements: six operation adapters, five profile producers, two segment descriptors and six structural elements. New docs/type/runtime proof is NOT_RUN. The 75-kind table is source inventory, not completion.

## D509 source candidate

Loop and Profile are additional closed-profile producers in the proposed source candidate; Outer/Voids provide explicit single-loop slots, and LineSegment/ArcSegment provide exact ordered Loop descriptors. Regions, arbitrary plane/face inputs, constraints and Sweep/Loft adapters remain unexported. Extrude.profile and old primitive lowerings remain compatible. Revolve holes retain their existing operation-specific native admission, with no new physical qualification. No universal containment/contact repair or refusal is promised. New execution is NOT_RUN. Part denotes one declared logical Model result, which can contain multiple native pieces; refs do not select a connected piece.
