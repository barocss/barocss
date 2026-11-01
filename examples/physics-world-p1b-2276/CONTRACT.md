---
work_id: physics-world-p1b-2276
artifact_type: public-api-cutover-and-verification-contract
status: ready_for_build
owner_role: independent-physics-algorithm-work
source_request: atomically migrate public World and root/replay/CAD callers to P0 without compatibility engines; no deployment
last_updated: 2026-11-02
---

# P1b public cutover

Base: `0be1dffb8b7dce2be2571990d895c7e8301f9349`. Branch: `codex/physics-world-p1b-2276`.
The frozen P0 design is authoritative. The canonical public factory takes `(PhysicsModel,WorldOptions)`, exposes
getModel/getState/step(commands)/query/dispose and returns the P0 state. The old config/signature/types/query methods
are removed. There is no alternate constructor, old-World instantiation, overload, compatibility converter or fallback.
Direct internal primitive parsing is reused; it constructs numeric records, not an old World. P5 domain factories
remain their sole current API until P5; P1b admits no fluid/cloth data in the common World.

Existing HOLD, two-hinge NO_GO, original8-box NO_GO, numerical errors, caps, first failures and fixed180s process
limits remain. Source edits are confined to the independent Physics package, required example/tool inputs and docs.
No Studio/Viewer SDK implementation, existing worker resume, dependency/lock install, remote write or deployment.
Actual Viewer display and hardware/measurement validation remain NOT_RUN.

## Indivisible source changes

- Public model/options/types/state, one internal runtime owner, exact required fields, IDs/references/units/profile
  admission, digest identities and typed error details. New physical support is not inferred from the type schema.
- Canonical replay scene now owns explicit model/options/identity; the sole current replay service uses the same
  new root. Old scene/snapshot shape is refused, not migrated. P2 attachment/factory rename is not implied.
- A bounded binary snapshot codec is required now to preserve signed zero when new exact model identity meets
  recording. Its new magic is BCPHSNP1; raw JSON is not a wire protocol. Scene128KiB/snapshot1MiB are explicit new
  byte limits, distinct from historical JSON code-unit limits. Original512frame/4096command/1e-12 comparison stays.
- CAD adapter returns new body/collider/source binding, exact stale-source checks and unchanged off-origin mapping.
  Root graph contains no CAD parser; CAD entry consumes an actual separately compiled/source CAD provider.
- Move reduced pendulum to the independent reference example, retaining its equations and original results. Keep
  capsule query/controller as separate geometric utilities. They do not own a common-World physical body.
- Update current root/replay/CAD data authors, public probes, source loader/build mappings and docs together. A
  local model-data helper authors P0 records; it accepts no old body/config shape and creates no World.
- Historical evidence, provider freezes and numerical data are immutable. API-only wiring in current mathematical
  tests retains original formulas, physical constants and thresholds; ledger links original source hashes/parent.
  Old P0/P1a validation runners remain historical at their own source checkpoint, never a new runtime fallback.

## Evidence fixed before qualification

Public tests assert no old root creation/step/query/pendulum path, copied model/state, error cursor and continuation,
dense plain finite data, SI-only units, global entity/collider ownership, unchanged4/32/64body limits, unsupported
domain refusal, tagged accepted-state queries and disposal. Numerical gates reuse the original ballistic refinement
<0.083m and1.99–2.01, force/impulse1e-12, velocity1e-11 and original off-origin1e-9m/1e-6mm bounds. No solver tuning.

Canonical encoding must match the seven frozen P0 byte/digest vectors and independent Node SHA-256 at padding
boundaries. Signed-zero/key-order/array-order and bounded malformed codec cases are tested independently of physics.
Provider manifests are generated from actual source graph or final emitted root/replay graph, excluding the manifest
itself. Final root bundle imports its sibling manifest externally; hashing a prebundle file cannot qualify the final
bundle. No caller-supplied provider identity or stale source alias is accepted as emitted proof.

Run selected source and actual emitted API tests,21ordinary rigid/replay/CAD probes and the existing independent
foundation tests separately. Emitted proof requires actual publish-map paths, own compiled Physics JS and compiled
CAD JS; no silent source fallback. Source and emitted have distinct provider identities. Native staged manifests
use actual publishConfig maps with installed local artifacts only; no network installation or npm publication.

Each fresh run records command, UTC time, exit/signal, bounded180s child timeout, raw output, input/effective hashes
and metadata. Stop at first failure and use a new run ID after a correction. Do not overwrite failed receipts. Type
definitions, compiled closure, actual public consumption, numerical checks, current product adoption and measured
validation are separate outcomes. A plausible animation or repeated bytes do not establish physical accuracy.

## Completion

All affected package entry types build; source/emitted/native public consumers pass; documentation samples, links
and build pass; current caller ledger has no unclassified root config usage. No old public overload or numeric dt
step remains. Source/emitted consumer graphs and mathematical wiring deltas are reviewable. Known failed physical
profiles and any incomplete wider campaign remain visible; this slice cannot declare the full engine complete.
