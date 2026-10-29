# D344 — native whole-patch quadrature conditioning

Status: **BOUNDED_QUALIFIED**. Actual run-02 and root's scoped visual review passed. The documentation structural gate passes; normal publication follows this document commit.

D344 repairs the observed volume and tangent-centroid error for an accepted translated native cylinder with cap levels `0.3456789` and `0.34567890000000023`. It changes integration arithmetic, while retaining the native geometry, names, topology, control points and mesh. The actual Studio target-only flow now passes real mouse selection, Offset, default STEP download, Undo/Redo, native Save and fresh Open. The first run failed on an overstrict metadata-box assertion and remains preserved; this is not a clean first-run PASS.

The published baseline is `c0fea1174f71fc4f9e83ac4f53978d09884e0ef1`. The initial local source checkpoint is `fbf8a7afb555ee7302bd3c6a6ed9e034a9a8b51a`, covering seven implementation/test/tool paths. Test-contract follow-up `28a80e8695a92e92e5e50f6a5d34c569a02c0e5f` changes two overlapping verification files, leaving seven distinct implementation paths in total. Normal push follows this document commit, with exact remote verification performed by root. Remote CI and release remain NOT_RUN.

## Problem and bounded cause

The unchanged native BRep has one solid, one closed shell, four faces, six edges and four vertices. Its two curved sides use whole-patch quadrature; two planar caps use the planar path. The observed run uses 572 side Gauss nodes and no meshed fallback.

The old provider returns volume `6.180191251439208e-15` and centroid `[0.10042170557247179, -0.26839177431837347, 0.3456789000000001]`. The normal coordinate alone appears plausible, while the tangent coordinates are wrong.

Independent exact arithmetic at the actual stored nodes separates the conditioning layers:

| Layer | Volume |
| --- | ---: |
| Independent exact native basis and products | 6.2781632964155324e-15 |
| Observed basis with exact native products | 6.2781632964155324e-15 |
| Observed world homogeneous products; remaining sums exact | 6.382222331984455e-15 |
| Observed world U-column sums; remaining arithmetic exact | 6.180191251439208e-15 |

The last layer also reproduces the tangent-centroid bias. The observed normal derivative has relative error up to about 27.96% in this captured fixture. These results locate a pre-accumulation loss in absolute homogeneous products and column sums. They do not diagnose every NURBS, trimmed surface, fallback route or mass defect.

## Change

Whole-patch integration subtracts the existing single body-global centre before forming weighted native poles. Projected local coordinates enter a private local field accumulator directly. Existing world-coordinate callers subtract the same body centre through their wrapper. For the captured no-rest path, `fromCentre` reconstructs the combined closed-body total once. Existing meshed/rest total, squared and cubed group conversions remain unchanged; this is not a claim of one call on every path.

The change preserves native poles, weights, knots, domains, names, topology, bounds and the entire stored mesh. It preserves quadrature nodes, degree rules, basis arithmetic, classifiers, geometric policy, fallback, method labels, density, units, errors, cache policy, API shape, schema and dependencies. It adds no per-face origin conversion, geometry rewrite, minimum thickness, new tolerance, centroid clamp or volume factor.

## Verification matrix

| Evidence | Result and boundary |
| --- | --- |
| Old registered counterexample suite | 6 PASS, 5 FAIL of 11; preserved before product edits |
| New registered Kernel suite | 11 PASS |
| Related Kernel checks | 81 PASS: 65 mass/area checks and 16 explicit SI/boundary checks |
| Root full Kernel | 2,336 PASS, 0 FAIL, 6 existing SKIP; 2,342 total |
| Kernel build, types, narrow lint, code-shape | PASS |
| New Model STEP consumers | 2 PASS: actual Offset command result and ordinary target |
| Related existing Model tests | 23 PASS; selected STEP, units, cache, MMGS, mass and native mass wire checks |
| Model full types and new-test lint | PASS; no lint warnings |
| Studio types, Vite and driver lint | PASS; existing Vite warnings and one console lint warning retained |
| API inventory, agent tools and refusals | Root reports PASS; 0 added, 0 removed, 0 existing shape changes |
| Independent numerical/source review | Diagnosis and shared-origin contract PASS; pre-implementation scope only |
| Final implementation review | PASS for frozen source `696ec924…`; no blocking finding |
| Actual Studio STEP browser | run-02 PASS; root reviewed four images as scoped UI-presence evidence |
| Metadata-box follow-up | Focused 2 PASS, Model types and narrow test/driver checks PASS; prior unchanged source gates reused |
| Document gate and push | PENDING |
| Full Model, broad Studio suite, remote CI, release | NOT_RUN for this delivery |

The focused and related counts overlap the full Kernel suite and must not be added into a new total. The registered oracle reconstructs V/X/Y over stored native Gauss nodes with independent rational arithmetic. It does not certify exact π, exact integration, all 11 integral fields, area square roots, central inertia, all finite inputs or every fallback provider.

The candidate native observation is volume `6.278163296415527e-15` and centroid `[0.12345669999999997, -0.23456779999999938, 0.3456789000000001]`, method `quadrature`. Full input and mesh equality are checked on stored data as well as recorded hashes.

## STEP consumer

Actual Studio `Export STEP` sends the document to the worker, which calls `exportStudioStep`. The Model passes BReps to Kernel `exportStep`; it supplies no upright mass result or nativeMassWire override. Default geometric validation properties call `brepMassProperties(brep, 1)` and `brepSurfaceArea`.

The Node consumer uses the actual existing Offset command with `-5.00009` on the translated radius-3, height-5.00009 source. It exports a target-only document so a 420-mm³ witness cannot hide the tiny contribution. Default STEP metadata agrees with the independent native-node reference. Units are millimetres, square millimetres and cubic millimetres. The writer uses round-trippable number strings. Strict STEP import preserves one closed solid, four faces, names and both exact native cap levels in these tested fixtures.

Imported native mass is observed separately. It uses the whole-patch route for these fixtures and agrees in volume, with separately recorded centroid rounding. This is a scoped readback result, not a general STEP migration or a claim that every imported trimmed/fallback provider is repaired. Run-02 proves the actual mouse, Offset Apply, toolbar export/download, Undo/Redo, native Save and fresh Open flow within the target-only case below.

## Performance observation

The same frozen benchmark bytes use Node 22.19.0, three warm-up batches, seven measured batches and 32 fresh BReps per batch. Setup and cloning occur outside the timer. Every measured object has a fresh quadrature-cache identity. Timing includes the mass-call loop, result-array allocation and one receipt store. The per-query figure is batch median divided by 32.

| Case | Baseline per query | Candidate per query | Local median change |
| --- | ---: | ---: | ---: |
| Ordinary | 0.37814715625 ms | 0.3775859375 ms | −0.15% |
| Tiny | 0.32841275 ms | 0.3481745 ms | +6.02% |

One seven-sample pair does not establish statistical significance, a performance acceptance threshold, UI latency or tail behavior. No speed improvement is claimed. Accuracy takes priority in this bounded repair. Raw samples, original failures and exact input equality remain in the performance capsule.

## Provenance and retained first observations

Core source: quadrature `696ec924bc4f1d7b74862533676af5e4c0b8a2a284a8a249ea7007dade4c8ed5`; unchanged mass provider `19ec118c7f6096f738d246e5ca46095b42dd9bf7f67e341bcc6f735690141eac`; unchanged cap producer `17f2b70b5ecbe0b1ab7912636d780fa1594469804f4af7fb48365212bc802f5a`; frozen benchmark `37d81a207f097d7cb35d859200db64f716d0c38d30ed8a79b3d79e60ab4c39a9`.

The old 6-PASS/5-FAIL correctness result is retained. Separate harness observations include an initial wrong build working directory, a typed-array versus JSON comparison mismatch, a nonexistent SI test name that provided no coverage, an initial benchmark syntax command with a duplicated relative path, and an existing unused benchmark constant found by lint. Each was classified and corrected without changing geometry, test tolerances or the product claim. The final baseline was repeated with the exact final benchmark bytes before candidate comparison. The final Node STEP stage had no first runtime failure. Actual run-01 failed before mouse selection, Offset or tiny export. The downloaded ordinary STEP had metadata box max Z `5.345768900000001`, while its authored native cap and strict imported geometry retained `5.3457689`. High's actual-file probe and the independent box review show a sampled/golden-extremum bound expanded by one floating-point step. Exact metadata-box equality to a cap plane was the wrong oracle. Only the new Model test and browser driver changed: metadata bounds must be finite and ordered, strictly enclose all native vertices and normal endpoints, and expand outward in the normal direction by no more than the existing `CadNumericPolicy.linearTolerance` (`1e-7`). Native/imported cap levels, four-ULP interval, strict closure/counts/names and volume/centroid assertions stay exact or retain their original reference tolerances. No Core, STEP writer, quadrature or benchmark change followed this failure. The first file, failure, image and source checkpoint remain preserved.

## Actual run-02 result

Root's final flow receipt reports one Chrome, two serial contexts, ten observations, four native reads, three actual STEP exports and one native Save, producing four downloads and one native file. It includes one real mouse pick and one real Offset, Undo/Redo and fresh native Open. These observation counts are not test counts.

The tiny downloaded metadata is volume `6.278163296415527e-15`, centroid `[0.12345670000000014, -0.23456779999999966, 0.3456789000000001]`. Tiny export and fresh-Open export metadata are exactly equal as parsed semantic values. The native and imported cap levels remain exactly `[0.3456789, 0.34567890000000023]`, with four strict-valid faces and stable names. The tiny metadata box max Z is `0.3456789000000003`, a legitimate one-step outward enclosure rather than the authored cap plane.

Root viewed original STEP, Offset preview, tiny STEP and fresh-Open STEP images. Their scoped PASS shows UI presence and action; images and rounded labels cannot prove four-ULP thickness or native scalar accuracy. The independent downloaded metadata and strict geometry readback supply those separate checks. Page errors, console errors and watched source changes are zero. Initial subset 14 expanded to 978 frozen inputs, and frozen/after/cleanup hashes match. All owned contexts, browser and server closed.

See the [Kernel receipt](kernel/receipt.md), [causal diagnosis](kernel/diagnosis.md), [performance report](perf/comparison.ko.md), [Model verification](model/verification.ko.md), [implementation review](review/implementation-review.md), [box proof](step-box/receipt.md) and [root product/visual review](root/flow-review-run02.json). Raw logs and diffs retain their original bytes as deterministic gzip; [provenance](source-provenance.json) maps temporary paths to stored files and verifies decoded hashes. The top-level [manifest](artifact-manifest.json) excludes only itself; nested manifests are included.

The bounded native quadrature defect is qualified. The document commit and normal push follow staged artifact verification. Ordinary remaining item 08 is next; High's `/tmp/d345-plan` work is a source-only plan, not an implementation. Its actual open gap must be decided from evidence. D344 does not complete all of item 16 or every native quadrature path. Item 09 follows 08; Electron item 15 remains queued.
