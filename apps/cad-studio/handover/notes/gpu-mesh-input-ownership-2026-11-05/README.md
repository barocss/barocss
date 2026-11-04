---
work_id: D524
artifact_type: bounded-renderer-cache-fix
status: done-with-explicit-native-reachability-limit
owner_role: executor
last_updated: 2026-11-05
---

# D524 — Compare owned mesh inputs before GPU reuse

Priority P0-R04, rows06/20/32. Parent `4784149ebddd7502e61a8f2a74c893de9ce0560a`. [Roadmap](../../roadmap.md) · [Qualification](qualification.json).

## Failure and native reachability

The actual GpuRenderer with a recording Viewer reproduces stale creation-time geometry after changed index, normal, edge coordinate, face/edge mapping, unsampled-position and rounded-position inputs. Key, counts and bounds stay fixed. The initial30-case original run has2 PASS/28 FAIL. After High review adds six sharing-enabled cases, the original36-case run has2 PASS/34 FAIL. Copied arrays and in-place mutations both fail the old sampled-signature guard. Two more final positive/lifecycle controls make38 new cases; no claim that all38 ran against the original producer.

Root separately runs original actual desktop Studio: public Box64×32×8, same-key extrude Distance8→12, body/face/straight-edge mouse selection, Undo/Redo and clear. It passes. Full real inputs, prepared Geometry data and actual vertex/index queue writeBuffer calls are observed through transparent delegated callbacks; the tool never submits synthetic geometry or invokes renderer setters itself. No changed full input under an equal legacy signature is observed. The selected native flow is NOT_REPRODUCED_IN_THIS_FLOW; broader native collision reachability stays UNKNOWN. Controlled input failure is not presented as a native user-operation reproduction.

## Correction and sharing boundary

Only private gpuRenderer.ts changes. Root and instance caches compare owned positions, normals, indices, faceOfVertex, edgeLines, edgeOfSegment, bounds and body key. Unchanged calls compare values without allocating a new full snapshot. Root key pools only shortlist candidates; exact values decide reuse. New resource sets own their uploaded-input snapshot, so a caller's later in-place mutation cannot rewrite the saved comparison input. Current face-name/colour metadata still uses the existing painting path.

A changed body also excludes its own previous shared Shape, matched by body key through reorder. Otherwise make-new-before-drop could immediately join the old shape through G10's rounding tolerance. Shape.ref uses the same owned snapshot, with no second array copy. Unchanged siblings retain their resources and final users dispose them once. Existing cross-instance movedCopy topology and numerical tolerances are unchanged. A changed owner cannot rejoin its immediately previous upload; cross-instance approximate rigid-copy sharing remains allowed. This is not blanket byte-exact upload equality for every copy.

## Verification

Tier SMALL. Ordinary implementation/tests use GPT-6.1 Sol Medium. Difficult sharing/tolerance judgment and final source review use GPT-6.1 Sol High, APPROVED with no blocking cache/lifecycle finding. High performs no execution; root owns all runs.

PASS:38 new controlled tests plus3 existing instance-pose/G10 and6 D514 selection-edge tests,47 total/0 FAIL/0 cancelled/0 skipped. Matrix covers seven changed inputs for roots/instances, copied/mutated buffers, unchanged copied geometry and sibling retention, selected face mapping, six sharing-enabled sub-tolerance edits, reordered edited bodies, immutable shared reference input and dispose-once cleanup. Studio types, final Model types after the last test edit, driver/observer syntax and diff pass.

Root reruns the identical actual Studio driver after correction. All9 states retain identical full native inputs to their original counterparts. Current native geometry, selection and history pass. Each run records7 setBodies calls and40 actual vertex/index writeBuffer calls. These are the observed selected-flow counts, not a broad performance benchmark. Both292-path capsules remain unchanged through cleanup; the only producer delta is gpuRenderer.ts. Page/console errors, worktree changes and downloads are zero. Context, Chrome and Vite close. Root views original03/06 and fixed04/06/09 PNGs.

FAIL retained: the original controlled stale-reuse assertions, including the six later sharing cases. There is no failed actual native execution in this item. The native smoke passes before and after the bounded contract repair, and does not reproduce a sampled-signature collision.

NOT_RUN/UNKNOWN: broader native collision reachability, GPU memory readback, physical/numerical geometry oracle, general performance/memory certificate, actual curved/placed-instance collision GUI, cosmetic-thread alias policy, whole-kernel, production build, CI, mobile, release and develop integration. Public APIs, B-rep and tolerances are unchanged. Whole CAD/core remains NOT_MEASURED. Next MAIN D525/P0-R05 repairs current-owner GPU recovery feedback; D517's candidate still requires its startup/notice-ownership gaps fixed and must not overwrite this renderer correction.

## Commands and custody

From apps/cad-studio with Node22.19.0. All heavy execution is serial under gate.sh acquire heavy60 and released on exit. Freeze every worktree writer throughout actual Studio. Use fresh external output directories.

```sh
TEST_CONCURRENCY=1 node scripts/test.mjs mesh-reuse-ownership
TEST_CONCURRENCY=1 node scripts/test.mjs mesh-reuse-ownership instance-pose selection-edge
pnpm --filter @barocss/cad-studio-app run type-check
pnpm --filter @barocss/cad-model run type-check
node --check test/mesh-reuse-current-studio-browser.mjs
node --check test/readonlymeshobserver.mjs
D524_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node test/mesh-reuse-current-studio-browser.mjs /tmp/barocss-d524-studio-before01
D524_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node test/mesh-reuse-current-studio-browser.mjs /tmp/barocss-d524-studio-fixed01
git diff --check
```

qualification.json pins raw logs, receipts and reviewed screenshots by SHA256. Raw files remain outside Git. Snapshot and hash custody is separate from numerical correctness; the native observer explicitly records the old signature as a decision function, not an independent geometry oracle.
