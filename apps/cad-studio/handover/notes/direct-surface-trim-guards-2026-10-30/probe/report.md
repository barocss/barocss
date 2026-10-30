# D336 immutable pre-fix reproduction

Status: SIX SOURCE CONSUMERS CONFIRMED. This is programmatic Model/direct-source execution, not a browser/Studio flow.

Exact source HEAD before and after: `1fb2d11e9e4713bac3bfbc1131fc45302aa558f3`. Node: `/Users/user/Library/pnpm/nodejs/22.19.0/bin/node`, v22.19.0. Gate acquired under `d336-prefixed-probe`, then released by shell EXIT trap; subsequent gate show reported `holder: none`. Runtime exit0. No source, repository test or repository script edits. Only `/tmp/d336-probe` and `/tmp/d336-plan` artifacts were written. Before/after listed496 input hashes all match, including bundled source inputs and four UI/refusal source witnesses. Git status is unchanged: only inherited untracked `.claude/`. This is a listed-input attestation, not a whole repository/browser graph claim.

## Fixture and independent oracle

Own source, no user document: nonunit parameter plane `S(u,v)=[20+5u,-11+5v,3]`, u[-2,6],v[1,7], world support[10,50]x[-6,24]. Exact own trim metadata: keep outside, UV rectangle[-1,1]x[2,4], world hole[15,25]x[-1,9]. Analytic kept area1100 and area centroid[340/11,104/11,3]. Public `directOps.trimByCurve` is separately exercised and returns one loop with160 UV samples. The six main composition cases use the exact authored metadata fixture to isolate material ownership from projection approximation.

Existing directDisplay material mesh before operations: area1100.0813802331686, area centroid[30.90835273127176,9.453775916211143,3],7698 triangles. Differences from analytic values come from existing sampled trim clipping; no exact display-area claim is made. Independent oracle is in `/tmp/d336-plan/independent-oracle.py` and JSON. `fixture.barocad`, fixture JSON and public producer output are retained here.

| Consumer | Actual result | Independent discriminant | Classification |
|---|---|---|---|
| Reverse U | returned; new visible obj_4 has0trims; area1200.0000000000032, centroid[30,9,3] | should preserve1100 material if supported, or refuse | CONFIRMED visible result loses trim |
| Split U at2 | returned; two new visible objects have0trims; areas600+600 | lower should retain500 after the100-area hole, upper600, or refuse | CONFIRMED visible results lose trim |
| Region U[-1,3],V[1.5,5.5] | returned; new visible object has0trims; area400, centroid[25,6.5,3] | kept region area300, centroid[80/3,22/3,3], or refuse | CONFIRMED visible result loses trim |
| Extend u-max by5 | returned; new visible object has0trims; area1350, centroid[32.5,9,3] | existing100-area hole should remain:1250, centroid[33.5,9.4,3], or refuse | CONFIRMED visible result loses trim |
| directIGES | returned810bytes, entity128; actual public importIGESFile reimport has0trims, area1200, centroid[30,9,3] | original material1100; export must retain trim or refuse | CONFIRMED export/import geometry loss; conclusion uses reimport geometry, not entity count alone |
| surfaceIntersection | returned1curve atx20,z3;12 emitted segments overlap the removed hole; total overlapping Y length9.999999999999998 | curve must exclude hole interior y(-1,9), or refuse | CONFIRMED support-only curve crosses removed material |

For Reverse/Split/Region/Extend, the original object remains present WITH its trim and becomes hidden. There is no permanent source-object deletion. The defect is the new visible material result and its loss of trim metadata. Exact original fixture JSON stays unchanged in all calls.

Every checked witness Model evaluation retains volume420.0000000000001, centroid[85.99999999999996,0.4999999999999998,3.5], bounds[80,-3,1]..[92,4,6], stable keyb1 and names n1.side0..3,n1.bottom,n1.top. This proves the own fixture's unrelated accepted solid is unchanged by these programmatic calls, not browser Undo/file ownership.

## Thicken scope

The actual DirectInspector original-trim refusal versus new-result allowance was NOT executed. There is no shared public Model thicken command/facade; invoking private UI callbacks or passing a raw Surface to Kernel thicken would not prove that Model/Studio behavior. `thickenStudioConsumer` is explicitly NOT_PROVEN in results.json. Source remains clear: DirectInspector.ts25 checks trim metadata before snapshotting; trim-free result would pass that particular check. Do not present this source chain as runtime proof of a successful Studio thickening action.

## Minimal accepted guard contract

No new refusal enum or API is needed:

- Reverse, Split, Region, Extend: existing `DIRECT_VALUE`.
- surfaceIntersection: existing `DIRECT_INTERSECT`.
- directIGES: existing `IGES_EXPORT`.

A small internal helper may take the existing resolved DirectObject, action label and existing code. On nonempty trims it throws before native calls, ID/source allocation and add(). An explicit malformed non-array trim container should refuse rather than be treated as no trims; an empty array can retain ordinary whole-surface semantics. Do not erase, silently ignore or clip loops. Do not globally forbid parameterization-preserving refine/affine paths.

Apply the IGES guard to visible surfaces only, after the existing visible inventory and before writer invocation. A hidden trimmed original must not block unrelated visible untrimmed export. Apply the intersection guard to both selected inputs before native intersection. Do not claim dual-UV clipping is implemented.

DirectPanel.run at27-29 already catches synchronous directOps refusal before onChange/commitDirect. Intersections use that same run path. App.tsx1977-1979 already wraps await loadDirect, directIGES and downloadBytes in try/catch; a synchronous typed export refusal after loadDirect stays in that catch and no download is called. This is SOURCE_INSPECTED, browser error handling NOT_RUN. Retain actual browser no-page-error evidence for the later qualification flow.

## Evidence and limits

- results.json: all programmatic cases, input states, meshes, witness results and NOT_PROVEN thicken field.
- runtime.log: complete verbatim call logs. No probe failure occurred. Successful unsafe calls are retained as the pre-fix defect evidence.
- build.log: retained esbuild output; no source/dependency rebuild was run.
- *-result.json: full returned direct source/object payloads.
- trimmed-export.igs and iges-reimport.json: actual writer bytes and public reimport payload.
- public-trim-producer.json: actual public projection producer output.
- capsule-before.json / capsule-after.json: current HEAD/status and listed496 SHA256 inputs.
- entry.ts/build.mjs/run.sh/capsule.mjs: reproducible temporary harness.

Browser/Studio flow, native .bcad Save/Open, Undo/Redo, no-download DOM observation, real thicken allowance, real natural Boolean failure, full suites and remote status are NOT_RUN/NOT_PROVEN here. No tolerance/geometry optimization, dependency, schema or UV-remapping change was made. Root can now dispatch the bounded guard implementation and an independent review.
