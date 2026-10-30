# D344 native quadrature conditioning repair

## Delivery and scope

Source FROZEN, gate RELEASED. Base publishedD343c0fea1174f71fc4f9e83ac4f53978d09884e0ef1. Owned files/hashes are owned-sha256.json. Product change is limited to src/brep/brep-mass-quadrature.ts. New registered test, independent arithmetic helper and accepted native coefficient fixture are the only other owned repository changes. Medium owns perf-bench.mjs and its measurements. Root owns full Kernel/API/STEP/Model/Studio/publication. No commit/push by this owner.

Full Kernel build PASS; registered11 PASS; relevant mass/area65 PASS plus nativeSI/boundary16 PASS; Kernel type-check PASS; narrow ESLint PASS; code-shape check PASS. Old registered baseline6PASS5FAIL is preserved. Full Kernel suite/actual STEP/Model/browser/performance candidate are NOT_RUN by this owner and must not be inferred from these focused gates.

## Immutable diagnosis

See diagnosis.md and diagnosis-sha256.json for the frozen old-source trace/oracle capsule. Actual accepted run03b7 strict native geometry reproduces old raw quadratureV6.180191251439208e-15,C[.10042170557247179,-.26839177431837347,.3456789000000001]. Actualbranches=2wholePatch+2planar, meshedfalse,572side Gauss nodes. Temporary source-bound instrumentation agrees exactly with untouched publisheddist provider.

Independent exact arithmetic at actualstored parameters/weights separates four layers: exactbasis/nativeP*w and observedbasis/nativeP*w bothV6.2781632964155324e-15; observedPw with exactcolumn sumsV6.382222331984455e-15; observedR/Ru with exactquotient/fieldsV6.180191251439208e-15 and actualtangentC bias. Actualnormal derivative error reaches27.9611%. This confirms absolutehomogeneous product/columnsum conditioning before accumulation for this fixture, rather than deficient quadrature node count. The oracle does not certify exactintegration, exactpi, all11fields, area sqrt or centralinertia. Reviewer read-only numerical/source assessment is separate under /tmp/d344-review.

## Product algorithm

All faces retain ONE body-globalintegrationorigin. Native poles are read unchanged; wholepatch Pw now stores(P-centre)*w before Ucolumn sums. The resulting projected LOCALpoint goes directly into a private localfield accumulator. Existing worldpoint accumulate is a wrapper subtracting the samebodycentre for planar/trimmed/facet callers. fromCentre still runs once on the closedbody total. No perfaceorigin translation formula is used.

Quadrature Gauss nodes/degree/rules/basis/derivative/cross/fallback/area expressions/method/density/error/options remain unchanged. There is no geometryrewrite, tolerance/minimum, clamp, volume correction factor, new public API/schema/dependency or sharedSurfaceD1 change. Removing the old globalpoint3 scratch is private and follows from directly passing local scalars. No new callbacks/allocation are introduced in the hot sample loop.

## Correctness evidence

Candidate nativeV6.278163296415527e-15,C[.12345669999999997,-.23456779999999938,.3456789000000001], methodquadrature. candidate-observation.json records mass/area/check/full mesh and confirms nativeinput unmodified. Every mesh stored scalar/record equals the old baseline and strictcheck is exactly equal. Name/count/endpoint/control-point geometry is unchanged. Geometry equality is checked on full data, not established from a checksum alone.

The independent registered oracle uses exact binary64 rational arithmetic, independent quadratic/linear Bernstein bases, all stored native poles/positiveweights/nativefacesenses, and fixed13x11Gauss nodes/weights. It validates572ruledsamples and reconstructs sideV/X/Y. Public registered tests require tinyrelativevolume accuracy versus this native stored-node authority and all3centroid axes, strictactualnormalinterval, exactnativeownership, wholePatch2/meshedfalse, reflected and cardinal X/Y orientation (including tangentC, notVonly), exact normalrecentercontrol,4ordinary intervals, density refusal and explicit tessellation fallback. Roundedpi is a separate guide, not an exact rational nativecircle theorem. Centralinertia/universalextremes are not claimed.

## Gates and retained first outputs

- registered-baseline-first.log/exit:11tests,6PASS5FAIL against unchanged oldbuiltD343. Captured/identity/reflection and X/Ytangent failures; ordinary/recenter/options controls PASS.
- candidate-build-harness-first.log: first invocation used wrongcwd and failed to locate scripts/tool.mjs; no tests ran. Actual subsequent script uses absolute package cwd, set-e, clearsdist and cleanbuilds candidate.
- candidate-build-first.log: fullbuild exit0. Emitteddist830606c3e8f1c28501188566a987b1caf71d0bbefecc9733b121794a51f86e57 contains localPw and directlocalfield path; source696ec924bc4f1d7b74862533676af5e4c0b8a2a284a8a249ea7007dade4c8ed5.
- candidate-focused-first.log:11PASS0FAIL, no test weakening or candidate test repair required.
- candidate-related-first.log:65PASS0FAIL across actual existing mass/pole/polyhedral/tessellated/prismatic files. The command also named nonexistent native-si-mass.test.mjs, which Node did not execute; this is not SIcoverage.
- candidate-si-boundary.log: explicit existing native-si-boundary and quadrature-boundary-distance,16PASS0FAIL.
- candidate-types-first.log/candidate-lint-first.log: exit0, no diagnostics.
- candidate-code-shape.log: PASS, no hotpattern count increase.
- candidate-observation.log: a diagnostic comparison failed on typedarray-vs-JSONobject representation; no product failure. candidate-observation-second.log compares identical JSON-normalized stored values and PASS, with full output retained. Initial shell lacked set-e and still ran code-shape after diagnosticfailure; finalgate uses set-e and the corrected observation succeeded independently. No product/test tolerance was changed for this harness issue.

Frozen mass19ec118c… and cap17f2b70b… sources remain unchanged. Medium benchmarkscript37d81a207f097d7cb35d859200db64f716d0c38d30ed8a79b3d79e60ab4c39a9 remains unchanged by this owner. OLDperformance baseline preceded the product edit. No performance claim is made here; root/Medium compare the matched candidate separately.
