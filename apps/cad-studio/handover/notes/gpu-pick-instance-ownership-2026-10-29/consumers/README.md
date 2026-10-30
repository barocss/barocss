# D324 actual native GPU pick readback

The first actual run passed: **1 selected browser test, 6 verification groups, 0 failures, 0 skips**, exit 0. This ran Chrome 156.0.8078.48 on the actual Apple/metal-3 WebGPU adapter at DPR1. The existing Node22 syntax receipt was reused; the changed harness lint also passed once. No build was repeated: the producer's final emit=0 receipt and exact fresh source/dist hashes are linked by [source-profile.json](native-first/source-profile.json), and those four hashes were rechecked unchanged after execution.

The public Core Viewer rendered a real one-triangle Geometry with face71 and two Mesh instances in each fresh scene. Actual red capture pixels and public GPU pick of instance1/triangle0/face71 established the positive control before every hold.

| Verification group | Held actual GPU pick | Next actual public GPU pick |
| --- | --- | --- |
| Unchanged | Original instance1 hit retained | instance1, face71 |
| Matrix replacement | null | New second translation, instance1 |
| Reorder | null | Right triangle now instance0 |
| Shrink | null | Remaining instance0 |
| setInstances(null) | null | Base triangle, instance null |
| Mesh removal | null | Actual replacement mesh, instance1 |

The test-only wrapper called original native GPUBuffer.mapAsync with its original receiver and arguments and waited for the native Promise to fulfill. Only the fulfilled return for one armed `pick read` buffer of size768 and READ mode was held. Native getMappedRange/unmap forwarded their original values. No queue submission, draw, ID, depth, readback bytes or returned pick result was mocked or changed. Native buffer unmap was observed exactly once after each delayed pick and twice after the following successful public pick reused it.

Six verification groups belong to one selected test; they are not six unique browser tests. These are native timing/render/public-wrapper results, separate from the producer's delayed CPU/mock tests and its preserved baseline TypeError. This consumer did not run a native before-fix baseline. Cleanup counts do not measure driver bytes, VRAM, performance or OOM behavior.

See [validation.json](validation.json), [raw first native log](native-first.txt), [actual receipt and trace](native-first/receipt.json) and [exact driver capsule](native-first/pick-instance-readback-browser.test.mjs.gz). Both actual PNGs were directly inspected: two red triangles remain correctly drawn in the initial positive control and after replacing the removed mesh. Raw hit points and depths are retained in the receipt, with finite-value assertions.

All six owned Viewers were disposed, then the owned context/browser/server closed. Runner PID49501 exited and the heavy gate had no holder after exit. An unrelated pre-existing Chrome renderer was left unchanged. No production source change, new dependency, commit or push was performed by this consumer. Other browsers/adapters/DPR, native device loss, ABA and wider matrix/full-suite execution remain **NOT_RUN** here. Runtime/test source remains frozen for root qualification.
