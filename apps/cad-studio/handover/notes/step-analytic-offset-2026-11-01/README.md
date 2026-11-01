---
work_id: D419
artifact_type: bounded-step-offset-qualification
status: done
owner_role: executor
source_request: "Continue the organized CAD roadmap, row 13"
last_updated: 2026-11-01
---

# Exact analytic STEP offsets — bounded profile

D419 is QUALIFIED at baseline `f2ca2cc014ce2602298c9272ee5a5a2d18e6dfe3`. The existing STEP Open path now reads one `OFFSET_SURFACE` over a direct `PLANE` or `CYLINDRICAL_SURFACE`. It uses the existing analytic patch construction. The signed distance follows the basis normal; face orientation is separate. Valid `self_intersect` T/F/U values are advisory. This is one row-13 slice, not general STEP or release acceptance. Counts, exact commands, hashes and retained failures are in [qualification.json](qualification.json).

## Admission and precision

A plane origin becomes `O + dN`; a cylinder radius becomes `R + d`. Malformed numbers, frames and Boolean/logical values are rejected. Base and resulting cylinder radii must be positive. Other bases, nested offsets, unsupported boundary families and wrapper cycles/depth remain named refusals. No radius is made positive with an absolute value.

New offset faces need a bounded analytical boundary check. Plane boundaries use lines or conics; cylinder boundaries use coaxial circle rims and axis-parallel generators. Raw LINE support/direction and conic endpoint consistency prevent vertex reconstruction or endpoint pinning from hiding a contradiction. Existing rational arithmetic then certifies the final stored edge curves: a positive-weight plane control hull, or homogeneous Bernstein bounds on squared cylinder radial distance. An uncertified case is refused. Existing non-offset geometry construction remains unchanged; new tracking is conditional on offset entities.

Independent review reproduced a candidate wrong success with small native output: raw axis `(3,4,0)` and a large cancelling offset produced a strict-valid six-face body of volume `150`, while exact fractions put the literal STEP target plane `2/5 mm` away. Its original edge tolerance was `2e-6`. The fix bounds raw-axis normalization, arithmetic residue and local orientation error with exact rationals. That bound is subtracted once from the original tolerance. If the remaining budget cannot certify the curve, the importer gives a named capability refusal. A geometry-separation claim uses the original tolerance plus the error bound, so an uncertain margin is not called invalid geometry. Exact-axis large cancellations still pass.

The predicate is a bounded edge/analytic-support proof. It does not certify every closest distance to a generated binary64 NURBS patch, arbitrary trims, complete STEP conformance or all existing analytic imports. Existing 3D-only wrapper interpretation and trim/pcurve limitations remain. No authored curve, offset, frame or tolerance is repaired or widened.

## Verification

Geometry implementation and independent mathematical/mutation/visual review used GPT-6.1 Sol High. Consumer tools and the API inventory comparison used GPT-6.1 Sol Medium. The full tier applies because new geometry is admitted. No B-rep core, public signature, schema, fitter, dependency or sample changes were made.

- Author coverage: 63 distinct tests across scoped revisions, including 58 new and 5 existing STEP tests. The final precision revision reran 7 selected tests, not the whole 63. Earlier failures remain recorded.
- Final independent checks: 54 PASS, split into 27 public-input cases and 27 private mathematical cases. The matrix includes true tilted axes, opposite face sense, distant raw LINE origins, raw tolerance equality, final pinning, continuous interiors and precision classification.
- Final mutation: 20 assertion kills, no survivor/crash/mixed/unmatched result. Nineteen detect behavior or classification changes. One absolute-radius mutation remains safely refused by another guard and changes only the expected reason; it is recorded separately.
- The earlier consumer Model tests passed 6/6 at their recorded source hashes. Final-source producer, oracle and inspector pass. Five STEP/native fixture pairs and the complete 45,607-byte native observation remain byte-identical across the precision fix. The final emitted library also passes two overlapping acceptance smoke tests.
- CAD TypeScript/library build, post-final-test Model types, scoped lint, code shape, API/docs and navigation pass. The API inventory initially fails on two union-member-order strings. Complete AST comparison and 14 canaries, independently reviewed, establish equal meaning before exactly those two strings are refreshed. The generator and public signatures are unchanged. The refusal catalog already matches.

Scalar volume comparisons require both `1e-5 mm³` absolute and `1e-9` relative error for normal fixtures. The tiny near-collapse case has a separate absolute/topology/support scope. The initial stricter `1e-7 mm³` draft assertion also fails on the matched plain cylinder; their default volumes are exactly equal. Higher quadrature does not remove that existing bias. No global mass algorithm changes. Independent support sampling keeps `1e-7 mm`, separate from the original entity admission tolerance.

The stdlib oracle has zero product imports. It checks the selected Part 21 graphs, evaluates stored rational support nets with Cox-de Boor and compares analytic literal volumes. It samples 1,113 points and detects five negative controls. Complete untrimmed supports may extend beyond the trimmed body; support coverage and physical body bounds are separate checks. This is independent bounded mathematics, not an external STEP reader or independently integrated solid certificate.

## Actual Studio

One final-product-source run passes three states: plane offset in mm; cylinder source in cm with one existing scale ×10; and nonbinding offset refusal with the exact prior cylinder document retained. The views show a 4×3×2 box and a 24×24×10 cylinder. Root and independent review accept all three images and the readable expected refusal. Existing rail overlap on the box is outside new UI layout acceptance.

All 751 frozen files match before, after and after cleanup. Page errors, console errors, file changes and downloads are zero. Context, Chrome and server close; the heavy gate is released. No worktree writes occur while Studio runs. The actual oracle uses the two accepted native observations plus three prepared advisory-flag controls. The amplified precision refusal is covered by public/facade and exact independent tests, not an additional actual UI state. After cleanup, only the oracle report keys were renamed to remove unit suffixes and declare units separately. Re-evaluating the exact actual observations passes; recursive key mapping proves identical predicates and numeric results. The original receipt and oracle output remain unchanged, and the UI is not repeated for report metadata.

## Preserved failures and remaining scope

The record retains missing-density test errors, draft mass assertions, malformed face-direction acceptance/TypeError, the raw-normal wrong success, a TypeScript narrowing failure, the independent enum lexer's initial `.CURVE_3D.` failure, and the API order mismatch. The first huge-native-coordinate witness is NOT_REPRODUCED because the existing `1e6` coordinate bound refuses it. Preflight support-height and stale-toast selector corrections are source review findings, not runtime failures.

The task OCP environment remains removed. No download, external reader installation, paid call, outbound Save/export download, full kernel/R5/RB/CI campaign, customer corpus, release or develop integration occurred. Studio types were not repeated for unchanged UI source. General offsets, B-spline fitting, cone/sphere/torus offsets, public thicken/offset operations, assemblies, presentation, PMI and UCS remain outside this profile. #2263 and research #2248 remain open; #2258 and #2266 are not closed by this work. Raw logs, fixtures, images, generated JSON and bundles stay under `/tmp`.

[ISO 10303-42 geometric representation](https://www.steptools.com/stds/smrl/data/resource_docs/geometric_and_topological_representation/sys/4_schema.htm), section 4.5.86, supplies the signed-normal and informational-flag interpretation. It is not interoperability evidence.
