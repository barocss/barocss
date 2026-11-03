---
work_id: physics-canonical-contribution-2276
artifact_type: implementation-and-validation-result
status: bounded_local_pass
owner_role: independent-physics-algorithm-work
source_request: implement the Physics library and verify actual package adoption
last_updated: 2026-11-03
---

# Canonical contact contribution implementation

The actual package now captures each discrete/persistent impulse application
and consumes it once in a step-local pair accumulator. It checks finite linear
and world-origin angular impulse sums before the existing atomic World commit.
Normal and friction phases retain their actual COM/lever operands. Existing
velocity mutation expressions and ordering remain unchanged.

Changed package files: `src/contact-contribution.ts`, `src/collision.ts`,
`src/persistent-box-contact.ts`, `src/world.ts`, and the generated provider
manifest. No new public export, recording format, solver profile or legacy
compatibility path was added. Completed accumulator rows are currently
validated and discarded. This is an internal prerequisite for later qualified
contact reporting, not a new public contact-reporting capability or a claimed
physical solver improvement. Its runtime allocation/performance cost has not
been qualified.

## Actual commands and results

Root ran explicit installed Node22 through the existing heavy gate and
`examples/physics-world-p5-2276/command-run.mjs`. The runner has one170s internal
deadline inside the180s outer guard; no budget or physical tolerance was raised.

```sh
NODE22=/Users/user/.volta/tools/image/node/22.19.0/bin/node
$NODE22 examples/physics-world-p5-2276/command-run.mjs canonical-contribution-01 . \
  $NODE22 examples/physics-canonical-contribution-2276/run.mjs evidence/run-01
$NODE22 examples/physics-world-p5-2276/command-run.mjs canonical-contribution-02 . \
  $NODE22 examples/physics-canonical-contribution-2276/run.mjs evidence/run-02
```

The first run passed strict NodeNext compilation, then passed7/9 Source tests.
Two exact operand assertions expected positive zero where existing arithmetic
produces negative zero. Run01 and its generated tests remain evidence. Only
those expected signed-zero literals changed; implementation and1e-12 gate did
not change. No signed-zero normalization was added.

Run02: **PASS_BOUNDED_CANONICAL_CONTRIBUTION**, outer guard PASS, exit0,
12559.402875ms, no timeout. Actual stages:

| Boundary | Result |
| --- | --- |
| Strict NodeNext modules/declarations | PASS |
| Source tests | 9/9 PASS |
| Genuine emitted module tests | 9/9 PASS |
| Canonical package tsc/root bundle/emitted identity | PASS |
| Canonical declaration consumer/internal export exclusion | PASS |
| Baseline/Source/Native/canonical public API cohorts | PASS |

Source and Native each measured18 linear and18 moment components. Maximum
linear-impulse equation error was2.0816681711721685e-17Ns; world-origin moment
equation error was2.7755575615628914e-17Nms. Both pass the predeclared1e-12 gate.
The independent oracle uses measured momentum/spin state changes with known
unit mass and isotropic inertia1/6; explicit phase-COM/radial-arm assertions
are separate. The synthetic Hit is an application probe, not native geometry
qualification.

Three bounded public fixtures cover normal sphere contact, radial friction
and persistent multipoint warm contact. Recording, serialization,
deserialization, restoration and continued execution pass. Each baseline to
Source, Source to Native and Source to canonical comparison checks1650 numeric
leaves with Object.is, including signed zero. The only33 allowed metadata
locations per comparison are identity.providerDigest. No physical numbers,
keys or other strings are normalized. The reported12 Worlds/42 steps per
cohort are explicitly source-derived planned counts, not an observed census.

After actual applications, injected failure preserves accepted bodies,
persistent cache, time and recording; clean-control retries match. Injection
uses the existing internal prototype in Source/Native tests only. No bundled
root injection or production debug hook is claimed. Frozen inputs match after
each run; provider generation is recorded separately.

Independent source review found no blocking arithmetic or atomicity defect.
Exactly-once consumption describes the current callsites; it is not enforced
by a deduplication token or measured application census. The review also noted
avoidable final-snapshot copies and per-application allocations. They remain
an explicit unqualified cost, not a performance improvement claim.

## Remaining limits and next dependencies

Original P4 eight-box1200, whole-path performance, general contact geometry,
public STATE2/coupled reporting and this change's desktop regression remain
NOT_RUN or their preserved NO_GO. The current public persistent body cap4,
8x8 iterations, HOLDs, tolerances and all first failures remain unchanged.
No deployment, release, mobile, Studio, manufacturing or equipment work ran.
Next: qualify the accumulator's runtime cost and complete accepted-native
producer geometry before any atomic public reporting/caller cutover.

Default whitespace checking reports one blank EOF line in the frozen runner.
Its executed bytes remain unchanged. Checking with only blank-at-eof disabled
passes; this exception changes no source, numerical criterion or test result.
