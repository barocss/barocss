# G1e public adoption: static source review

READY_FOR_CANONICAL_FREEZE. No source/contract mismatch was found in the
reviewed implementation. Canonical runtime and recording checks remain NOT_RUN
by this reviewer. This is a static review, not a production-accuracy PASS.

Reviewed `PUBLIC-SUPPORT-CONTRACT.md` and these package sources:

| Source | SHA-256 |
| --- | --- |
| `world.ts` | `e4ba184c874489b32e6259b99efa30d390397f281a50c4d7997194f2e0e076b6` |
| `rotation-support.ts` | `a9bba3019d2fe8ea69a224b45cb1d8977e7179537b890cbc5085d75db78002c9` |
| `rigid-free-rotation.ts` | `eacabe276ccaec2cf0cb7eade73f57320ca69ef287104fc4b71da3e36651f0c5` |
| `rigid-forced-rotation.ts` | `9a9bc36bdee55abdea81fc1e3eb7ed11786f880c8ca9080b0e5ea83f90d70c76` |

## Support and mathematical dispatch

`admitRotationSupport` runs after ordinary model, collider, joint and binding
parsing. It classifies a dynamic noncube by unequal geometric half extents.
Rounded equal inertia cannot move unequal geometry into the old cube path.
All other dynamic noncubic boxes must pass the explicit one-body dt120 rotor
predicate or refuse INVALID_CONFIG. A static/kinematic box does not trigger
the new predicate. Domain admission returns no rigid bodies and keeps its
existing separate path.

The rotor predicate checks the declared numeric mass, primitive-COM inertia,
native extents, gravity, position, linear speed, world spin, profile, broad
phase, topology and admitted identity orientation. `parseBody` normalizes q
before this check. Positive radial near-unit inputs therefore reach the same
numeric identity pose; negative identity and other admitted poses refuse.
No body ID, collider ID, model revision or source-binding label selects math.

The accepted identity-local collider is already enforced by normal admission.
Its single-body/direct topology creates no pair. Restitution and friction
therefore cause no reaction in this leaf. Bindings remain validated inert
provenance. IDs and labels still appear in public identity/output/recording;
their different values must remain in saved evidence when testing renaming.
They are not erased or used to find a numerical fixture.

Both copied kernel bodies match their qualified private files byte for byte
after the first comment line; static `cmp` returned zero for each comparison.
World's rotor impulse preparation applies J once and uses zero torque there.
JT then reconstructs post-J L and integrates the declared continuous world
torque with the qualified fixed two-halfstep map. A nonnull forced result
short-circuits the free call. Forced guard failures throw, rather than return
null. Empty/J return null from the zero-torque selector and use S8. If no
qualified result exists, World refuses; it has no old anisotropic fallback.

The unchanged nonrotor branch retains its original impulse/torque expressions
and geometric orientation advance. Thus spheres, true geometric cubes and
the declared capsule proxy keep their earlier discretization. This does not
claim new continuous-forcing accuracy for those old classes.

## Commands, horizon and transaction

Lifecycle, recording ownership and existing resource checks still run first.
Normal command parsing retains dense/schema/target/duplicate checks. The rotor
policy then permits only empty, exact J, or exact J plus exact tau, addressed
to the admitted body ID. Command order within JT does not change that set.
Schema-valid zero forces, torque alone, other vectors and extra command kinds
refuse INVALID_COMMAND. Command validation precedes the horizon check, so an
invalid later command still refuses as a command before the physical horizon.

An otherwise supported second step refuses NUMERIC_LIMIT before recording
frame preparation, body copying or physical work. The one-step horizon follows
accepted stepIndex, so refused attempts do not consume it. q/omega preparation
and validation use copied candidate bodies. Existing movement/norm guards and
the shared allocation-before-commit sequence remain. Unknown exceptions are
not caught or replaced by the new code. No new accepted-state cache, World,
public option or compatibility reader was added.

Replay still constructs the same public World, attaches its owner and replays
the accepted prefix through that World. It does not bypass the support rule.
Provider identity is still checked before reconstruction. Actual identity
regeneration, replay success and atomic failure behavior require execution.

## Remaining canonical checks

Freeze the final actual source closure and regenerate source/emitted provider
manifests. Verify genuine canonical root/replay builds and strict declarations;
old provider identity must refuse. The historical staged micro is not evidence
that these new canonical artifacts have executed.

Audit canonical J/JT against the paid G1e bank and empty motion against its
paid free target. Verify renamed IDs/metadata by exact physical-word comparison
with the qualified base while retaining every actual identity field. Check
selected sphere/cube compatibility, original unsupported anisotropic/CCD/CAD
inputs, parsed command refusals, second-step refusal, record/reconstruct/refused
continuation, and injected precommit preservation. Keep ordinary package and
instrumented fault evidence separate. Run the affected documentation/example
checks and preserve old first failures, tolerances and HOLDs.

This reviewer performed static reads, source comparison and document checks
only. No module, World, reference arithmetic, numerical case or build ran.
No canonical adoption PASS, merge, push or deploy follows from this review.
READY; STOP.
