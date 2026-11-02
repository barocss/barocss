---
work_id: physics-world-p2-2276
artifact_type: attached-recorder-verification-report
status: locally_verified_selected_rigid_profiles
owner_role: independent-physics-algorithm-work
source_request: common World recorder; exclusive commands/time; failed-step retention and restore/continuation in source/emitted; no deploy
last_updated: 2026-11-02
---

# P2 result

Base `0c8b3be71f10bc9e39f8c8097eeaf0cfba8175ae`; branch `codex/physics-world-p2-2276`.
The common rigid World now has one advancing owner. `/replay` exports `createPhysicsRecorder(world)`,
`restorePhysicsRecording(recording,{model,options,providerDigest})`, `serializePhysicsRecording` and
`deserializePhysicsRecording`. There are no old scene/session/snapshot aliases, migration readers, alternate
Worlds or compatibility engines. Six obsolete generated replay JS/declaration files are removed during emission.
The P0 common World model/state/command/error declarations remain unchanged.

Attachment is permitted at step0 only. Direct and cached World.step calls and a second attach refuse WORLD_OWNED
before command inspection. World reads and queries remain available. Recorder disposal permanently detaches that
recorder and leaves the World alive. World disposal invalidates the recorder. An advanced World cannot acquire a
new partial history. The caller disposes both returned objects after restore. Unsupported fluid/cloth domains
remain refused by common World; their separate sole current APIs await P5.

A private WeakMap authenticates Worlds and holds their internal access. Root and replay share the same sibling
`recording-owner.js` in actual emitted/native consumption. The root bundle externalizes that file and the provider
manifest. Source manifests refresh before source builds; emitted manifests hash the final root/replay closure.
The numerical root has no CAD/parser/Viewer input. CAD remains an optional data/mapping service with explicit
current source and revision. No dependency, install/download, security setting, remote write or deployment changed.

## One transaction

Commands are copied once under the World guard. The same copy supplies numerical actions and accepted recording
frames. This prevents a changing Proxy descriptor from producing a log different from applied commands. All
command reflection and recorder lifecycle calls use the World guard, so input callbacks cannot detach, dispose,
observe or recursively advance the candidate.

Generic/domain admission comes first. The next indexed command frame and log are copied and byte-checked before
the physical candidate. Final physical state, returned copy, actual complete recording and final byte check are
prepared before shared commit. That commit contains assignments only: bodies, contacts/events, joints, CCD,
warm-start/cache/sleep state, pair diagnostics, clock, log and command count. It has no allocation or callback.

The public recorder object is also prepared inside guarded attachment **before** ownership is assigned. Disposal
clears owned log/count and World model/options references. Source assignments establish that release behavior;
there is no GC/allocator benchmark or process-OOM recovery claim.

Recording uses exactly `BCPHREC1` plus P0 canonical typed bytes. Signed zero and leading UTF-8 BOM data survive.
Limits remain512frames/4096commands, model128KiB, whole recording1MiB, depth32, nodes50000, arrays4096, records64.
Restore validates complete bounded inert data before expected identity, reconstructs an isolated World by executing
its actual commands, compares finite final numbers at the original1e-12abs/relative gate and structure/IDs exactly,
and transfers World+recorder only on success. Failed isolated candidates and codec temporary Worlds are disposed.
This is command-history reconstruction, not arbitrary checkpoint import or a cross-runtime accuracy guarantee.

## Actual results

Node22.19.0/macOS ARM64, installed TypeScript5.9.3/esbuild0.25.12/VitePress1.6.4. Heavy work uses the repository gate.
Every run has a fresh ID, selected input hashes, actual command/exit/time, raw streams and provider/effective graphs.
The180s child guard is unchanged. Native proof uses local copies and actual publishConfig maps, without bundling
root+replay together, package installation or TypeScript fallback.

| Check | Result and receipt |
|---|---|
| Final public source / actual emitted |11/11 each: `public-source-05`, `public-emitted-05`. |
| Test-only preparation faults |15/15 each: `faults-source-04`, `faults-emitted-04`. Four step phases plus attachment output, each in three rigid profiles. |
| Actual native maps, positive/negative public declarations, shared registry |PASS `native-03`; old functions/types refuse at compile time and runtime exports are absent. |
| Native CAD/replay consumer and README examples |PASS `native-03`; actual compiled CAD, 24frame restore/continue, original contactStep21, four extracted README blocks compiled/executed. |
| Ordinary rigid/replay/CAD probes |21per graph PASS in `probes-source/emitted-02`. |
| Final affected recording callers |3per graph PASS after final fixes: `records-source/emitted-01` (persistent box, dynamic fixed pair, replay). |
| Independent foundations |Five entries/21tests per graph PASS `foundation-source/emitted-01`. Original constants/oracles/gates unchanged. |
| Documentation samples |174/174 PASS `docs-samples-03`. |
| Source/publish mapping |5source/5compiled entries PASS `mapping-01`. |
| Package compile / lint |Full TypeScript emission PASS in compiled runs; source lint0errors/1build-generator console warning in `lint-03`. |
| Documentation site/build/links |Actual `docs-check-01`, `docs-build-01`, `docs-links-01` receipts; inspect their exit records separately. |

The ordinary21probe/foundation receipts name earlier P2 providers. Later fixes affect recording preparation/codec;
the final public tests, all affected recording callers and native entry checks run again on the final implementation.
No earlier receipt is silently relabelled as the final provider. Source and emitted provider identities differ.

Fault injection changes only test bundle copies. It records both original and effective hashes, and does not export
a runtime fault hook. The injected module retains ordinary metadata only to drive continuation comparisons; that
metadata is not proof that instrumented bytes equal the ordinary provider. Its15cases are separate from ordinary
public API execution. Generic thrown preparation exceptions are tested; actual host OOM/process termination is not.

## Numerical boundary and retention measurements

The candidate block from `const next = bodies.map(copyBody)` through immediately before prepared publicState is
byte-identical to the base: SHA-256 `61354821c82a45be90538f723bbd3430c8ae7700bea0cd2fe7e9a3707f8dd026`.
Admission, ownership, recording and public serialization lie outside that slice; static equality alone is not a test.
No solver iteration, physical tolerance or numerical law changed.

- Ballistic t=1s errors at dt1/60,1/120,1/240s:0.08174999999999999,0.04087500000000688,
  0.020437499999998554m. Ratios1.9999999999996632 and2.000000000000478 pass coarse83mm and1.99–2.01 gates.
  Velocity uses original1e-11m/s. These are analytical comparison errors, separate from repeatability.
- CAD90degree off-origin display translation is `[160,-80.00000000000001,0]`mm, maximum error1.4211e-14mm against
  `[160,-80,0]`mm at the original1e-6mm gate. Proxy span gate remains1e-9m; both exact source and revision refusals pass.
- Persistent contact history is reconstructed after24steps; subsequent20steps agree exactly with the source
  recorder/control. Large profile reconstructs180steps with **six sleeping bodies**, then matches20steps after wake.
- Injected frame preflight, output preparation, final recording encoding and precommit failures retain state/log
  exactly and match the next20accepted steps against an unaffected same-provider control. Attachment output
  failure leaves an initial World unowned and permits a successful new attachment.

All of these qualify selected software/history behavior. No new contact-geometry, stable-stack, mechanism or
hardware acceptance follows. Original public two-hinge and eight-box NO_GO remain. The prior three-box OFFSET/YAW
settling NO_GO, strict192row geometry proof, selected16step prefixes and incomplete308step result retain their
original providers and limits. No full1200step eight-box result is newly run here. Physics/Studio/manufacturing
HOLDs and all original errors/first failures remain. Full Viewer/Studio flows and measured machine agreement are
NOT_RUN. No equipment control or manufacturing safety claim is made.

## Preserved first failures and bounded gaps

`wire-boundary-source-01`:10PASS/1FAIL. A valid model revision beginning U+FEFF could save but not load, because
TextDecoder removed the initial BOM. Fixed with `ignoreBOM:true`; final public source/emitted each pass11/11.
The original failed TAP and input/provider snapshot remain.

`attach-boundary-source-01`:12PASS/3FAIL. A test-only exception before public recorder return-object construction
left World ownership assigned. New attachment then failed WORLD_OWNED. Object preparation now precedes assignment;
final fault source/emitted each pass15/15. Failed raw outputs and original effective modules remain.

Earlier source inspection also found command double-read, post-dispose log/options retention, incorrect error
operation/domain and postcandidate frame preparation. Those candidates and successful earlier tests stay in their
named run archives. They were corrected before final qualification. The initial large continuation fixture produced
zero sleeping bodies; its receipt is not sleep evidence. The final fixture uses the existing ordinary probe floor
and asserts at least five sleeping bodies before continuation; it observes six. No physical error gate was widened.

`final-manifest.json` names changed files/parent hashes, unmodified historical Git blobs, numerical kernel comparison
and the actual root dependency boundary. P0/P1a/P1b and original numerical evidence remain byte-identical. Current
caller mapping is in `migration-callers.json`; final hashes supersede its author-time hashes in the final manifest.
Historical P0/P1a/P1b replay runners require their complete named checkpoints; they are not current aliases.
Bounded literal-import inventory does not prove arbitrary eval/computed import strings or external consumers.

Provider/stage copies are stored in `provider.tar.gz`/`stage.tar.gz`. Each adjacent archive manifest verifies every
file hash before the loose generated copy is removed. Extract beside the archive to recover receipt paths. Failed
archives and raw logs are not overwritten. Any raw diagnostic whitespace is preserved rather than normalized.

## Reproduce and next dependencies

Use installed Node22 and the repository heavy-lane gate; choose fresh lower-case run IDs:

```sh
node examples/physics-world-p2-2276/run.mjs source fresh-source-01
node examples/physics-world-p2-2276/run.mjs emitted fresh-emitted-01
node examples/physics-world-p2-2276/run.mjs fault-source fresh-fault-source-01
node examples/physics-world-p2-2276/run.mjs fault-emitted fresh-fault-emitted-01
node examples/physics-world-p2-2276/run.mjs records-source fresh-records-source-01
node examples/physics-world-p2-2276/run.mjs records-emitted fresh-records-emitted-01
node examples/physics-world-p2-2276/native.mjs fresh-native-01
node apps/library-docs/samples/run.mjs
```

P3 must define/admit/verify supported multi-joint mechanisms before public activation. P4 still needs the original
contact/stack exit under unchanged execution/error gates. P5 must move each domain's candidate/hidden-state
ownership and prove its actual recording closure or refuse it. P1-wide allocation/cost and broader phase/host fault
campaigns remain separate. P2 does not qualify them or the whole engine. No push, merge, publication or deployment.
