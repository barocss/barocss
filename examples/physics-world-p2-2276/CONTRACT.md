---
work_id: physics-world-p2-2276
artifact_type: recorder-ownership-and-transaction-contract
status: ready_for_build
owner_role: independent-physics-algorithm-work
source_request: attach recorder to common World; exclusive commands/time; source/emitted failure retention and reconstruction; no deploy
last_updated: 2026-11-02
---

# P2 scope and fixed gates

Base0c8b3be71f10bc9e39f8c8097eeaf0cfba8175ae, branchcodex/physics-world-p2-2276.
P0 recording/types/MIGRATION are authoritative. One genuine common World, attachment at step0 only, one exclusive
advancing recorder. Direct/cached World.step refuses WORLD_OWNED before command inspection; reads/queries remain
accepted-state operations. Second attach refuses WORLD_OWNED. Recorder disposal detaches permanently without
owning World disposal. World disposal invalidates recorder. Advanced World cannot acquire a new recording history.
No World wrappers, monkeypatched stepping, alternate solver, public bypass token or old service/schema alias.

Prepare command/log allocations, physical candidate, returned copy, final recording state/byte budget before a
nonthrowing shared commit of physical state/caches/time/log. No callback/allocation inside that commit. Generic
injected preparation exceptions and typed command/numeric/budget refusals retain accepted World/log/cache
continuation. No public fault-injection API. Test-only source transforms must be explicitly marked and recorded.

Public replay exports become createPhysicsRecorder(world), restorePhysicsRecording(recording,expected),
serializePhysicsRecording and deserializePhysicsRecording. Recording stores P0 model/options/identity,
consecutive1-based indexed command frames and finalState. No old scene/session/snapshot reader or factory remains.
BCPHREC1+canonical typed encoding preserves signed zero. Keep512frames/4096commands, model128KiB/recording1MiB,
codecdepth32/node50000/array4096/record64 bounds, exact identity and original1e-12abs/relative final comparison.
Restore validates complete bounded shape before expected identity, reconstructs an isolated World, compares final
state, transfers both World+attached recorder only on success; dispose isolated candidate on failure.

CAD adapter already separates numerical data/binding; preserve it and independently recheck off-origin90degree
[160,-80,0]mm at1e-6mm, admission1e-9m and stale exact source/revision. Root graph must stay free of CAD/Viewer.
Change active replay consumers atomically, preserve P0/P1a/P1b and numerical contracts/archives as named historical
checkpoints. Fluid/cloth remain unsupported in common recorder until P5 actual closure. No new solver law/support,
physical tolerance/iteration change, dependency/download/security/cost change, remote write or deployment.

Verify ordinary public source and actual compiled public modules separately, plus native publish-map/declarations,
negative old API/types, ownership lifecycle, copied data/-0, invalid/boundary/impossible codec/log/identity inputs,
repeated runs, stateful persistent contact and large sleeping continuation. Independent ballistic and CAD gates
remain. Inject failures before output/log preparation after candidate calculation and compare next accepted steps
against an unaffected same-provider control, including contact/event/cache behavior. Record actual providers,
commands/exits, numerical errors, first failures and unsupported bounds. Fresh run IDs;180s child guard unchanged.
HOLDs, original two-hinge/eight-box NO_GO and all first failures remain. Command exit0 is not a physical GO.
