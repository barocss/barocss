# D342 Offset command source handoff

SOURCE_READY_RUNTIME_NOT_RUN. Baseline8adbbbfa5515b76769f6adc9412f65c017b7ec38. Own exactly profileCommands.ts Offset-only wiring and new offset-face-native.test.ts. No generic faceSketch/faceProfile/planeOfFace/Extrude or High nativeOffsetFace.ts edits.

Build consumes frozen resolveNativeOffsetFace/validateNativeOffsetDistance, appends owned native sketch, then calls unchanged Extrude.build with only the new sketch selected and original current bodies. Handles use the same helper/frame; UI unsupported errors return no handles. Cheap availability checks one selected plane/nonfacet face and unique body key without native geometry work. Hint declares bounded straight right-prism/cylinder caps.

Unsupported errors use existing VALUE (High/root corrected proposed nonexistent FACE_PROFILE); identity BAD_REFERENCE and distance FACE_DISTANCE remain. No new enum/dependency/schema/API.

Prepared command tests: six signed native box caps times inward/outward, translated/fractional endpoints and exact binary64 endpoint volume/centroid, one native closed solid/strict check/all intended native support planes/no exposed old cap; native polygon, integer cylinder, draft/distance/collapse atomic refusal, stale/malformed/merged identities, source/selection ownership, Save/Open+reedit+reopen, repeated current-cap result or explicit bounded VALUE refusal, and unrelated newer sketch selection. A changed/stale display context may refuse BAD_REFERENCE; any successful result must still match native authority. Repeat path reports actual admitted/refused outcome and claims no general repeated-operation closure.

Tests use independent endpoint rational arithmetic/polygon Green/cylinder analytic guides; native topology/mass evidence is checked separately. No production predicate generates expected geometry. Static git diff --check PASS; all runtime/types/lint/build NOT_RUN pending root grant after High helper checks.

Pre-runtime frozen-profile correction: after distance validation the command now passes structuredClone(profile.sketch) to withNode. New regression changes/restores authored nested native plane and boundary arrays and changes a fresh file-opened plane, proving the frozen factory object does not enter mutable recipes. Mixed face+body/vertex/direct negative build contexts added; authoritative helper now owns these guards. Runtime remains NOT_RUN; source refrozen.

## Runtime and retained edge boundary

First focused5files:58tests,54PASS4FAIL0SKIP. Raw logs preserved. Unnormalized test rational zero endpoints produced denominator overflow and Number NaN; gcd normalization fixed the oracle. Translated rounded max-minus-min was not exact cap equality; exact untranslatedh5/-5 now verifies collapse refusal. No production fix. Command repair21PASS and final strict stale/repeat contracts21PASS; Modeltypes/narrowlintPASS. Unaffected37 tests passed first run and were not repeated. Twelve signed-cap exact endpoint/native mass/supportplane/count/ref diagnostics are in signed-cap-native-oracle.json.

Actual stale display is BAD_REFERENCE refusal and now required. Actual repeated currentcap is admitted native one-solid fractional geometry and now required. These are fixed source assertions rather than permanent correct-or-refuse choices.

Root separately required the translated nearfull edge to remain classified. Dedicated probe confirms positive stored/intended residual2.22e-16 yet build/evaluateDoc success with strict native invalid sliver/self-touch faces and Model centroid outside retained interval. This is OPEN_INVALID_NATIVE_SUCCESS, not a passed profile. Full nearfull-result.json/first.log retained. Root/High/reviewer notified; no hidden minimum or tolerance/product correction by Model worker. Gate released holdernone. checks-interim.json reflects the open edge.

Finalguard affected run63cases:61PASS2FAIL0SKIP. New polygon/circle nearfull FACE_DISTANCE atomic refusal+.001retry bothPASS. The new guard regresses ordinary translatedbox negativeX/negativeY cap outward2.125, previously valid: prospective target stored-cap-level binding refuses. Tests are not weakened. Raw focused-guard-final.log retained. Root/High/reviewer notified for owned helper correction. Types/lint after guard NOT_RUN because focused failure stopped script. Gate released holdernone. guard-final-result.json records this open regression; no final pass/freeze claim. Root style explicit body-count loop is included in hashes.json.

## Binding fix final runtime

High corrected prospective native target endpoint binding without changing tolerances or adding a minimum. Final full affected5file run64/64PASS0FAIL0SKIP; Modeltypes/narrowownedlintPASS. binding-final-* logs preserve this distinct run; prior54/58 and61/63 failure logs remain. Nearfull polygon/circle integration now requires atomic FACE_DISTANCE and valid0.001retry; ordinary12signedcases including negativeX/Y outward pass again. Gate released; command/test source frozen and hashes updated. checks-final.json records completion of bounded Model checks, not browser/product qualification.
