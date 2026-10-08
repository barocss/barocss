# Physics release gate: native preparation

Date: 2026-10-08. Source: committed PHYS-12 gate runner `fe6737cff28346fd9c68a441f15d6f44e61819ce`, built on native PHYS-11 `307650f4519fe01b5eb48cdd4312f996d30effc4`. [Exact JSON output](release-gate-native-2026-10-08.json).

| Check | Native result |
| --- | --- |
| Frozen offline install and CAD, GPU, interop, Viewer, Physics builds | Pass |
| Eleven compiled Physics/CAD probes | Pass |
| Fixed fall/impact/stack/joint/CCD/replay criteria | Pass |
| Broad-phase 32-body/120-step candidate calls | Direct 29,760; AABB 960; accepted contacts matched |
| One-run scale on macOS 15.6.1 arm64 / Node 22.22.0 | Direct 33.656166 ms; AABB 21.437708 ms; both below the 1000 ms stop threshold |
| Offline independent tarball consumer | Pass: root, CAD proxy and replay imports; three declarations; proxy contact step 21 |
| Actual WebGL Viewer | Earlier native PHYS-10 [screen and revision proof](../../physics-cad-scene/evidence/checkpoint.md) |

The measured `heapUsed` changes are in the JSON report. They include garbage collection and do not measure total allocation. The temporary npm cache was isolated because the user's existing npm cache had an ownership error; no user cache permissions were changed.

**Decision:** `nativePreparationPassed:true`; `releaseCandidate:false`. The Integration task must adopt PHYS-10 and PHYS-11, run this gate at one merged head, and repeat the Viewer check there. No tag, version change or npm publication was made.
