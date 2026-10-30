# D325 actual display/CPU clipping baseline and final validation

The first current-source baseline reproduced the product mismatch on `d85558ce0031d812341d5871743f8535520eb8d4`. The one selected safe-contract test **failed**, with **0 pass, 1 fail, 0 skip**, exit1. This is `BASELINE_REPRODUCED_PRODUCT_FAIL`, not a repaired-product PASS or a setup failure. Node22 syntax and owned harness lint passed first.

| Public requested clip | Actual covered pixels | Center RGBA | Public SDK CPU pick |
| --- | --- | --- | --- |
| near0.01 / far100 control | 9600 | [51,138,201,255] | audit/audit_patch, distanceScene6 |
| near7 / far100 | 9600 | [51,138,201,255] | null |
| near0.01 / far5 | 9600 | [51,138,201,255] | null |

All three native observations, PNGs and both mismatch records were written before safe assertions. The original failure is `near-excludes: CPU-excluded square must also be absent from actual display / 9600 !== 0`. The far mismatch is independently retained even though Node stops at the first assertion. Historical coverage/color values were not used as current PASS constants. These newly observed coverage/center equalities do not establish whole pixel-byte equality.

Actual SDK source was bundled once with esbuild and served over loopback to Chrome WebGPU/DPR1. [Source profile](baseline-first/source-profile.json) retains the exact driver gzip and four critical source hashes; [receipt](baseline-first/receipt.json) records the single bundle hash/input count, actual browser/adapter and raw public hit. Sources were rechecked unchanged after execution. No production patch or result/pixel/GPU manipulation was used.

The original square is a public authored `setPackets` fixture, not a user sample file or Studio UI-generated document. Public `setView`, `readPixels` and CPU `pick` were used. Internal GPU pick remains **NOT_RUN**. The control center hits a shared triangle edge and the public API correctly marks that original hit approximate/ambiguous; distanceScene6 and ref remain valid. No private Core camera far was recorded, so no JSON-null/Infinity inference is made.

See [raw first failure](baseline-first.txt), [baseline-validation.json](baseline-validation.json) and the three actual PNGs under `baseline-first/`. All three PNGs were directly inspected: the same blue square remains visible in both excluded cases. Owned Viewer/context/browser/server closed, runner PID11098 exited, and the gate had no holder after exit. The baseline scope ended here. Final repair and selected boundaries are qualified separately below. Other browser/adapter/DPR and full suites remain **NOT_RUN** by this consumer. No production repair, commit or push was performed by this consumer.

## Final source-bound native validation

The final expanded native run passed on its first execution: **1 selected test, 0 failures, 0 skips**, exit0. This selected test contains twelve SDK observations and the separate Core GPU groups; these are not additional unique tests. Source/driver hashes were verified immediately before and after execution. [Final source profile](final-first/source-profile.json) binds exact driver gzip and six critical source hashes; [final raw receipt](final-first/receipt.json) binds the single source-esbuild bundle and raw observations.

| SDK observation, at both scales | Covered | Public CPU pick |
| --- | --- | --- |
| Control near0.01/far100 | 9600 | depth6 hit |
| Excluded near7/far100 | 0 | null |
| Excluded near0.01/far5 | 0 | null |
| Closed near6/far12 | 9600 | depth6 hit |
| Closed near3/far6 | 9600 | depth6 hit |
| Restored control | 9600 | depth6 hit |

The original literal ±1 square used mmToSceneUnit1. A separately created Viewer used literal ±1000 coordinates with mmToSceneUnit0.001 and identical scene-unit camera clipping/depth6. The results qualify these closed interval boundaries and restoration at both scales; they do not assert whole-frame byte identity. Every sample/PNG was retained before SDK assertions.

A public Core Viewer then rendered a real face71 triangle with duplicate identical instance transforms. Its automatic original pick retained first instance0. Manual near3/far6 returned **original raw depth0**, face71, triangle0, instance0. Thus the actual finite far-plane hit was not confused with background and the equal-instance draw-order identity remained intact. Automatic far was observed as string `Infinity` with `farFinite:false`; it was not inferred from JSON null.

The native pending-camera group held only the fulfilled return of the original native GPUBuffer.mapAsync for the selected pick buffer. Toggling only autoClip left near3/far6 unchanged. The delayed public GPU pick returned null and unmapped once; restoring manual mode yielded a fresh depth0/face71/instance0 pick and second unmap. No pixel/readback bytes, IDs, depths, submissions, draw commands or hit results were fabricated. Native wrappers were restored during cleanup.

See [final-validation.json](final-validation.json) and [raw final log](final-first.txt). Three representative final PNGs were directly inspected: near-excluded background, scaled exact-far blue square and Core exact-far red triangle. All thirteen final PNGs remain under `final-first/`. SDK/Core Viewers, owned context/browser/server closed; runner PID68402 exited and gate had no holder.

This final supported SDK path has no enabled depth effects. Unsupported-effect/refusal browser cases, full cap/probe/mask/postprocessing combinations, native two-square search, other browser/adapter/DPR and whole suites remain **NOT_RUN** by this consumer. Root owns wider qualification. Original baseline failure and first harness lint failure remain unchanged alongside the successful final preflight and native evidence.
