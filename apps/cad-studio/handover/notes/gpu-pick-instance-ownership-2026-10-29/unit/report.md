# D324 / #2237 final CPU regression receipt

Base: `a5d1acfa7e6834951819eaaeeaf6da314cae9b8f`.
Runtime: Node `v22.19.0`; working directory `packages/barocss-gpu` in the assigned worktree.
The final gate waited 152 seconds for load admission, then ran one GPU emit/CPU/lint bundle and was released.

## Result and unique counts

**Final normal CPU runner: 357 PASS / 0 FAIL / 0 SKIPPED**, normal exit 0 (7,598.5 ms). TAP has 343 top-level tests plus 14 nested cases. The 47 explicitly listed files include the new affected file exactly once. Its 15 new cases are TAP top-level cases 242–256. Existing cases contribute 342; the new cases contribute 15. There was no separate 15-case rerun.

The earlier original baseline remains **1 PASS / 1 FAIL / 0 SKIPPED**, exit 1. Its two behaviors overlap the final unchanged/shrink regression coverage; do not add them to the 357 unique final cases. The only product failure observed by this worker was the preserved original TypeError. No fixture, emit or lint failure occurred in the final bundle.

## Commands and raw originals

Commands used the Node22 PATH and heavy gate `d324-gpu-cpu-final`:

1. `node ../../node_modules/typescript/bin/tsc -p tsconfig.build.json`: **exit 0**, `final-emit.log` (empty). This both type-checks and emits the current GPU package. The preexisting CAD dist was reused; no CAD/kernel rebuild ran.
2. `node --run test`: **exit 0**, `cpu-final.log` (unchanged). This executes the package's actual explicitly registered CPU test script, including the new file once, rather than a hand-selected replacement list. The listed tests contain no native-browser launch path. No package browser script was invoked.
3. `node ../../node_modules/eslint/bin/eslint.js src/viewer/viewer.ts src/viewer/scene.ts tests/pick-instance-readback.test.mjs`: **exit 0**, `final-lint.log` (empty).

`final-exits.txt` records all exits. The original baseline emit/TypeError logs and `baseline-test.mjs` remain unchanged, with details in `baseline-report.md`. No original failure was overwritten. `git diff --check` for package registration exits 0.

## Behavior covered by the new tests

Real pickNow CPU reconstruction, Camera, Geometry and public Mesh operations are used. Captured GPU payload is mesh17, instance1, triangle0/face71, and expected world point `[0.25,0.25,0]`. Device transport/draw/visibility/prepareCamera preparation are stubbed. The real sceneMoved prototype is retained.

- A delayed unchanged control preserves point/depth/face/triangle/instance metadata.
- Matrix replacement, reorder, shrink, instance removal, mesh removal, nonempty clear and instance ABA return null instead of mixing old depth/instance ID with current metadata.
- Camera translation, public clip change and base transform preserve their existing stale-result guards.
- Invalid instance input, prior-buffer release failure, already-null instances, detached mesh changes and absent removal retain the valid current hit.
- Every stale request is unmapped exactly once; diagnostics record two maps/six mapped-range reads/two unmaps across original and stale reads. Original accepted metadata and old matrices remain unchanged. Shrink then successfully reuses the same read buffer for a current instance0 hit with totals three maps/nine reads/three unmaps.

The Object.create fixture initializes the actual constructor's private revision to zero and manually attached slot to zero; construction begins detached at slot-1 as real Mesh does. It never increments or overrides revision/guard decisions. Existing mock constructors were also exercised by the normal package CPU runner with no new failure.

## Runner and API boundary

Only the package's existing CPU test filename list changed: `tests/pick-instance-readback.test.mjs` is explicitly registered. Other scripts, dependencies and lockfiles are unchanged. The existing root recursive test and release workflow package-test paths now select this regression through that script. Remote CI was not run here.

High owns runtime changes in viewer.ts/scene.ts; this worker did not modify them. Root separately reviewed the existing @internal sceneMoved optional argument's three inventory exposures and updated only that expected delta. This receipt does not claim a new public entrypoint.

## Source binding and remaining proof

`final-source-sha256.txt` and `final-dist-sha256.txt` bind the run. Post-run hashes were checked unchanged:

- viewer.ts: `1c1df2143fe714569fe40b7aa27e6772faca9f44c9c50a9cca56194467b052a8`.
- scene.ts: `f7e17275a2efb6c8b9d5bf73c89e61902f94a9f01541476ce07c79baf59954d5`.
- affected test: `471f03427c52724fca953434e2db52bbb32267a16b658222c0f40ebc217fed5b`.
- package.json: `bdbb24facbd051018037667576248c75b7a3c0bd8713d22c2375f14794f21fb1`.

Hashes are evidence binding, not acceptance oracles. Actual GPU/browser timing, rendered pixels, Viewer construction and the D324 selected public pick-wrapper browser flow remain separate consumer evidence and were **NOT_RUN by this worker**. Consumer harness syntax/lint were not mixed into this bundle. No commit/push, native browser run or other worker's source edit was made. Source and test are stable for the consumer freeze.
