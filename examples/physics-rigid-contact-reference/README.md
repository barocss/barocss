# Private eight-box contact reference

Issue #1185. Base: `38cab806709d99568ec2b64e70b39ffbe1900ff6`.
Measured source: `9c4192e7ae6ae8795181f55055aadd98155f47b1`.
This is a private experiment. It does not extend the public Physics profile.

## Actual result: model NO-GO

The only private admission change is the persistent-body cap from four to nine.
The existing contact and response algorithms, eight outer passes, eight point
iterations, materials, order and caller configuration are unchanged.
All three fixtures fail the frozen 2 mm independent pair penetration gate at
accepted step 6 (0.05 s):

| Fixture | Independent maximum pair penetration |
| --- | --- |
| ALIGNED | 2.110962872 mm |
| OFFSET | 2.240780274 mm |
| YAW | 2.246556736 mm |

The source run, unchanged source repeat and compiled-dependency run agree on
all accepted public fields, raw Float64 hashes and first failure decisions.
Each case preserves seven snapshots, including the initial and failing states.
All 63 saved snapshots were decoded again from raw little-endian Float64 bytes
and checked through the independent Decimal geometry observer. Its 65 analytic
controls pass; 432 reported contacts pass finite/ID/unit-normal/nonnegative
impulse checks. Contact force accuracy is unqualified. The raw replay does not
rerun the engine. JSON sign loss at zero is not a raw bit comparison.

Original affected Physics build passes on Node 22.22.0. Source graph uses 39
original source modules and zero dist modules. The compiled-dependency graph
uses zero original source and 21 emitted dist modules. The copied private world
is still source in both graphs; this is not a compiled public candidate export.

Each trial stops at its first quality failure. Ten seconds, settling, refinement,
CPU timing and Chrome/Viewer gates were not completed. A base quality failure
prohibits the later campaigns under the frozen contract. No general engine GO,
public cap/API, parameter retune or publication follows from this result.

## Reproduce

Use Node 22 and real workspace dependencies. The parent admission reference has
`examples/physics-rigid-engine-reference/build-local.mjs` for its documented
local CAD type-dependency lease. Do not substitute type declarations. Build the
original CAD and Physics packages before selecting compiled dependencies.

```sh
pnpm --filter @barocss/physics build:library
python3 examples/physics-rigid-contact-reference/geometry-reference.py --self-check
node examples/physics-rigid-contact-reference/run.mjs /tmp/physics-1185-rerun
python3 examples/physics-rigid-contact-reference/verify-evidence.py /tmp/physics-1185-rerun
```

The raw verifier is specific to this retained NO-GO. It is not a generic future
pass verifier. The runner requires further frozen refinement/cost/browser work
if all base trials pass; base success alone never qualifies the whole model.

## Evidence and next question

`evidence/native-9c4192e7/` contains actual raw states, full copied public states,
observer results, original build and campaign logs, import graphs, analytic/raw
replay checks and SHA256 inventory. The source dependencies and copied world
hash are checked before bundling. `geometry-reference.py` imports no producer.

The cause is not established by this first failure. A next private diagnostic
must observe unchanged solver phases and pair corrections, and prove its final
states equal this frozen original candidate before drawing a scheduling or
manifold conclusion. Public implementation needs a separately measured model GO.
