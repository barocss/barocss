# D324 CPU regression expansion (not yet executed)

Original baseline source is preserved in `baseline-test.mjs`, with its SHA256 in `baseline-source-sha256.txt`. `baseline.log` and its failure remain unchanged.

The current affected test expands to 15 meaningful cases through actual pickNow and public scene mutations:

- Unchanged delayed readback.
- Replacement, reorder, shrink, instance removal, mesh removal, nonempty clear, and instance ABA.
- Camera translation, public clip change and base mesh transform guards.
- Failed instance validation, already-null setter, detached-object mutation/absent removal, and prior-buffer release failure.

Every rejected stale read checks cleanup, unchanged previous accepted hit metadata and retained original matrix values. Shrink also follows refusal with a new current instance-0 read on the same mock buffer. Benign and failed operations must retain a valid current hit. These are not counter-only tests.

The Object.create fixture now initializes the actual constructor's private `pickSceneRevision` to zero and gives the manually attached mesh slot0. Construction still starts detached at slot-1, as real Mesh does. Actual Viewer.sceneMoved is retained; no mock writes/increments a generation or forces the new guard's decision. Public setInstances supplies its own actual callback argument. A separate detached Mesh keeps slot-1. GPU transport, draw and visibility preparation remain stubbed, so native GPU, Viewer constructor, public pick queue and browser/pixel proof remain separate.

Only the explicit CPU test filename list in `packages/barocss-gpu/package.json` is changed; the new file is inserted after mesh-instance-atomicity. Other scripts, dependencies and lockfiles stay unchanged. The existing recursive root/release package-test paths will select this filename after registration; remote CI has not run here.

Execution waits for High's final source report and root's serialized approval. No additional build/test has run since the baseline receipt.
