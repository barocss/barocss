---
work_id: D435
artifact_type: step-sphere-representability-refusal
status: bounded-qualified
owner_role: executor
source_request: "Continue the CAD roadmap autonomously while owner sleeps"
last_updated: 2026-11-02
---

# STEP sphere dimensional loss — bounded refusal

D435 is BOUNDED QUALIFIED on rows13/16 at baseline35165905d50e0dde2e34d631d28d080a2670b8a0. Overall progress remains about43%. [qualification.json](qualification.json) records exact counts, commands, source/receipt hashes, failures and limits. Direct spherical OFFSET admission is deferred to D436.

## Reproduced wrong success

The original assessment first measured the current offset boundary: two unchanged radius.001 spheres validate strictly; six positive/negative/zero wrappers retain raw BrepError INPUT and public CadPartError CAPABILITY refusals. Eight calls to each API run once, with seven source/dist pins unchanged. This is admission measurement, not new OFFSET support or independent external-reader qualification.

Four additional plain radius1e-12 inputs use exact Fraction/Decimal STEP text transformations. Every authored positive displacement remains in the file. Directions, frames, senses and topology stay unchanged. All four raw imports and CAD-facade evaluations succeed, and strict B-rep reports remain valid. Stored results differ:

| Center in mm | Exact native control-hull rank | Old result |
| --- | ---: | --- |
| [0,0,0] | 3 | Nonconstant represented control; finite legacy properties |
| [999000,-998000,997000] | 0 | All18 face controls equalC; later mass/area GEOMETRY singular-surface error |
| [999000,0,0] | 2 | Planar image; later mass SOLID_MASS no-positive-volume error |
| [999000,-998000,0] | 1 | Line image; later mass/area GEOMETRY singular-surface error |

For the rank0 case, positive weights give H=CW, so S=C everywhere and every Jacobian is exactly zero. This is an algebraic proof from canonical native data. It is acceptance of invalid dimensional geometry, rather than a volume error of a valid solid. The centered tiny control has no new analytic mass-accuracy qualification.

## Narrow correction

The only production edit is in step-import.ts. Each generated direct-sphere patch must provide an exact affine control-hull rank3 witness before buildBrep. A rational patch lies in the affine span of its controls. A point, line or plane cannot contain a two-dimensional face of a finite-radius sphere.

The private helper subtracts exact Q(Pi)−Q(P0), then uses exact cross/scalar-triple products. It uses the existing200000-operation/8192-bit budget. Budget exhaustion gives the same unsupported-precision refusal. There is no radius/T rule, numerical epsilon, coordinate repair or tolerance increase. Rank3 is necessary representability; it does not certify universal immersion, nonfolding, trimming or positive solid volume.

Raw BrepError retains the existing INPUT/not-supported convention; the unchanged part adapter maps it to public CAPABILITY. The readable message says that the sphere would lose its three-dimensional shape at its stored coordinates. The change adds no retained cache/metadata or resident geometry format. Runtime performance benchmarking is NOT_RUN; work is bounded temporary exact arithmetic during import.

Passing constructor arithmetic remains unchanged. Whole-native JSON fingerprints for both original radius.001 controls match old and new builds, including all coordinates, knots, weights, senses, tables and tolerances. Centered radius1e-12 remains accepted, demonstrating that no radius/tolerance floor was introduced. Existing raw tolerances remain1e-7(centered) and9.9900000048e-6(far). Their sampled strict gap reports are not closest-distance certificates.

## Verification and retained failures

Sol High owns exact geometry and independent review; Sol Medium owns ordinary probes and the Studio driver. Current scoped tests pass96unique:17new,77affected STEP-offset/sphere-coverage/inversion controls and2selected existing STEP roundtrips. CAD build/types/scoped lint/code shape pass. The final message-only revision reruns17;79 unaffected successes are reused through exact literal/regexp reversal. Final Model types pass after the last test/driver edit. No B-rep core changed, so full kernel is NOT_RUN here; latest D433 remains2066PASS/0FAIL/2existingSKIP.

Independent baseline8PASS. Four mutants are detected: skip guard, accept rank2, round differences before exact conversion, and use an epsilon rank. Three are clean assertion-only kills. The epsilon mutant has two assertion failures and one typed INPUT wrong refusal of an expected-success rank3 control. The strict mutation runner records FAIL/exit70 for these mixed failure codes; that failure is preserved. There are no survivors or module crashes. The record does not call all four assertion-only kills.

The initial old-dist regression run is10PASS/7FAIL: six intended clean missing-refusal assertions plus one incorrect new test expectation for mm-only document validation (INPUT versus existing FORMAT). The expectation alone is corrected from source; the corrected case passes separately on old dist. Old successes and physical prefails are reused. The v2 pre-acquire attempt is NOT_RUN_RESOURCE_BUSY on a foreign physics lease; that lease is untouched and the next fresh authorized attempt passes. No numerical budget is widened.

## Actual Studio

One final-source run passes four states: open the qualified original radius.001 centered sphere; then try the exact rank0, rank2 and rank1 inputs. All three real Model read/reply pairs report CAPABILITY with matched IDs/revisions. Each shows the readable precision reason and confirms that the part is unchanged. No unexpected-kernel prefix appears.

The original one-node document, exact STEP text/name, adopted native Float64 arrays/IDs, matched accepted source/deferred mass patch, public camera and all six Float64/Float32 matrix byte arrays, meshes and effects remain exactly equal within the run. Seven queried fields are preserved; optional volumeBasis remains undefined, so historical raw JSON presence is not claimed. The displayed native mesh remains552vertices/1024triangles/1mergedface/0displayedges; raw B-rep topology is separately2faces/2edges/2vertices.

All330 frozen/after/cleanup hashes match. All54 as-executed inputs and46 passive runtime bodies are independently checked. Only the Node flow-helper route is absent as a browser module. Page/console errors, source changes and downloads are zero. Context, Chrome and server close, and the sole heavy gate is released. Root views all four images; independent review accepts the actual source/refusal/retention evidence. Full error layout and workspace presentation remain the owner's deferred [row15 discussion](../../roadmap-rows/15.md).

Final actual receipt is fcd2f2ce…; independent final review3d742f47… and auditc7240e98…. Sourcea1e6f956…, test47ba9907… and fixture6019eefa… are sealed. Original diagnostic STEP/B-rep arrays, logs, screenshots, source copies and mutant TAP remain under /tmp/barocss-d435-*.

## Commands and remaining scope

Use Node22.19.0 and one owned heavy gate with global idle/load<40 and sole-own-holder/load<40 admission. Browser runs freeze the whole worktree through cleanup. From packages/barocss-cad:

```sh
node scripts/tool.mjs build
node --test --test-concurrency=1 test/step-sphere-representability.test.mjs
node --test --test-concurrency=1 test/step-offset.test.mjs test/step-sphere-coverage.test.mjs test/brep-inversion-conditioning.test.mjs
node scripts/tool.mjs type-check
```

Final driver command from the worktree, with existing PW_DIR/CHROME and CAD_STUDIO_CHAT_PORT=52391:

```sh
SPHERE_PRECISION_SOURCE_FROZEN=1 node /tmp/barocss-d435-probe/sphere-precision-refusal-browser.mjs /tmp/barocss-d435-probe/studio-run01 /tmp/barocss-d435-probe/studio-refusal-cases.json /tmp/barocss-d435-probe/studio-source-manifest.json
```

This guard covers generated direct-sphere patches only. Generic B-rep validation, other STEP surface families and all positive-rank3 geometry are not newly certified. Spherical OFFSET stays refused pending D436's separate continuous boundary/admission proof. Existing D419 plane/cylinder offsets, public signatures, mass, core, Model/GPU/Studio product source, schema and dependencies are unchanged. #2263/#2258/#2266/#2248 remain open within their broader scope. No OCP reinstall/download, paid call, customer corpus, full CI, develop integration or release is included.
