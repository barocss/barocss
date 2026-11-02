# G2 corner capture: narrow ordinary re-review 02

Status: **NO_GO_RETAINED_LOG_BOUND**. One repair-introduced resource blocker remains. The four original review01 mechanisms are now present.

Reviewed `corner-capture.mjs`: 12988B, SHA256 `5307d781076d0d5993bbab9d9cd25d01523494c375b8960993b08cdf2069cb2a`. Author receipt02: 1599B, SHA256 `ced77e2b5f82596f13c9ec652b58bc9fdaf884c690c57a0a02ec0b68f51a7c79`. The author receipt's source byte/SHA pin matches the inspected file.

At lines140–141, the handler retains `bytes.subarray(...)` in `logs` for every received chunk. After capturedBytes reaches32768, it still appends zero-length views. A Buffer view retains its original ArrayBuffer; a partial or zero-length view can therefore retain a full incoming chunk. Repeated overflow chunks also grow the logs array until the bounded cleanup finishes. The captured-byte counter does not bound this retained data to32768B, so the stated log/working-payload bound is not established for the overflow failure path.

Narrow repair: retain a copied Buffer only when the remaining capacity and copied length are positive, for example `Buffer.from(bytes.subarray(0, remaining))`. Once no capacity remains, do not append another element. Keep observedBytes and overflow reporting, the same TERM/KILL cleanup, original failure, call population, and physical gates unchanged. No overflow test or numerical execution is requested by this source review.

The original findings are otherwise resolved in source:

- Lines104–109 require source witness status and graph, bind its input and capture pins exactly to the native freeze, and authenticate the source capture and input before decoding.
- Lines90–93 require absolute actual Node/esbuild paths with mandatory byte/SHA records, in addition to authenticating every supplied tool pin.
- Lines121–161 retain command/PID/exit/signal/EOF/spawn/pipe/timeout/overflow observations for failed builds, and preserve a failed-command receipt. TERM,500ms KILL, and1500ms fallback bound the inner wait. Incomplete close/EOF fails; the parent owns whole-group cleanup.
- Lines174–184 check the30s phase deadline directly before each counted helper call, including after progress writes.

Input/profile, physical gates, helper population, own-source/own-dist closure restrictions, native source-witness gate, and0World scope remain as in review01. The native graph remains actual emitted helper modules rebundled for capture, not public-root integration. High geometry/witness review is separate.

This was read/hash/metadata inspection only. No syntax check was repeated. No provider module, fixture conversion, build, helper, reference, or World call ran. Only this review file was written. Review01, source history, all G1 files, and all capture/provider files remain unchanged. **STOP: parent review and a new frozen repaired revision are required before runtime.**
