---
work_id: physics-cloth-rigid-impulse-2276
artifact_type: private-operator-actual-results
status: PASS_PRIVATE_INSTANTANEOUS_REDUCED_OPERATOR_ONLY
owner_role: independent-physics-algorithm-work
source_request: record one frozen campaign and its remaining roadmap dependencies
last_updated: 2026-11-02
---

# Private cloth–rigid impulse precursor

The frozen `impulse-01` campaign passed on 2026-11-02. The outer guard recorded
20.361506 seconds, normal pipe EOF, process close and no remaining owned process
group. The campaign recorded no first failure. [RESULTS-01.json](RESULTS-01.json)
contains exact saved errors, bounds, quantities, case locations and artifact
SHA256 values. This README and that result file were written after the run;
they add no candidate, reference, build or World call.

The qualified operation is one instantaneous, contact-free velocity projection
between a finite unpinned cloth point and an off-COM rigid anchor. Position,
orientation and time do not advance. The plants are the 13 literal reduced
cases in [CASES.json](CASES.json), not the full 289-vertex P5 sheet. Public
dynamic cloth mixtures remain unsupported. Full-sheet material, contact,
trajectory, dt-refinement and public P6a coupling are unqualified.

## Actual finite ledger

| Work | Actual result |
|---|---|
| Independent reference | 23 requests: 13 accepted plants and 10 refusal classifications |
| Exact reference factorizations | 13 full 12×12 Fraction KKT solves and 13 condition-only Schur inversions: 26 total |
| Decimal reference | 13 independent full KKT solves at 80 digits and 13 at 120 digits: 26 total |
| Global native fixture conversion | 23 literal inputs, once each; fault inputs reuse case 03 |
| Source candidate | 25 entries: 13 returns, 10 preflight refusals, 2 marker throws; 15 direct 3×3 solves |
| Genuine emitted candidate | Same 25-entry population and 15 solves |
| Total candidate | 50 entries, 26 returns, 20 preflight refusals, 4 expected marker throws, 30 solves, 0 unexpected throws |
| Actual-state audits | 26 separate validator processes; 98 saved checks each, 2,548 total; 0 validator solves or new reference requests |
| Direct children | 1 native esbuild, 1 TypeScript emit, 1 oracle and 26 validators: 29 total |
| World / CAD / recorder / trajectory | 0 calls |

Both graphs passed input preservation, detached output ownership and unchanged
nonvelocity raw-bit checks. All four injected errors preserved marker object
identity and returned no half pair. Each normal candidate return passed its
physical audit before the next candidate call. Native calls started after the
complete source population passed. There was no warmup, retry, precision
escalation, extra recovery call or gate change.

## Independent physical comparisons

The candidate uses a condensed 3×3 direct solve. The oracle independently builds
nine physical velocity variables and three multipliers into a full 12×12 KKT
system. Its separate Decimal builder/elimination cross-checks the exact result.
The Schur inverse measures conditioning only; it does not supply the expected
solution. The validator decodes actual binary64 words to Fraction and recomputes
momentum, angular momentum about origin zero, kinetic energy, impulse work,
relative velocity and state-derived reactions without a solve or oracle import.

The frozen component bound is `e + e*abs(target)`, with `e = 1/10^12` in the
quantity's SI unit. Ideal comparisons use the independent ideal target;
report/state consistency uses the independently state-derived target. True
balance/work invariants use `e + e*max(1, abs(beforeIdeal), abs(afterIdeal))`.
Existing contact, replay, cloth and earlier numerical gates are unchanged.

Selected saved maxima follow. The absolute-error maximum and largest gate
fraction in a row can come from different components. The JSON retains both
locations. Gate fractions are dimensionless fractions of that row's separately
scaled bound, not a combined accuracy score.

| Quantity | Unit | Maximum absolute error | Largest fraction of its gate |
|---|---|---:|---:|
| Point linear velocity vs ideal | m/s | 8.189069e-16 | 6.595728e-4 |
| Rigid COM velocity vs ideal | m/s | 7.900091e-16 | 7.583693e-4 |
| Rigid angular velocity vs ideal | rad/s | 1.187166e-14 | 8.789647e-3 |
| Reported point impulse vs ideal | N·s | 7.900091e-16 | 7.583693e-4 |
| Reported rigid angular impulse vs ideal | N·m·s | 1.110223e-17 | 1.057355e-5 |
| Reported final relative velocity vs ideal | m/s | 1.265654e-14 | 1.265654e-2 |
| Recomputed final relative velocity | m/s | 1.264960e-14 | 6.324802e-3 |
| Linear momentum balance | kg·m/s | 3.469447e-17 | 1.734723e-5 |
| Angular momentum balance | kg·m²/s | 2.428613e-17 | 1.214306e-5 |
| Recomputed final kinetic energy vs ideal | J | 2.369980e-17 | 1.857419e-5 |
| Impulse work minus kinetic-energy change | J | 0 | 0 |

The largest individual gate fraction was `0.012656542480726785` for reported
final relative velocity in case `10-small-inertia-bound`. The maximum independent
Schur infinity condition was exactly `2049`, below the frozen `4096` limit.
The largest stored scaled Decimal80/120 discrepancy was
`4.8100195185426154847104749512036434612882e-78` against `1e-60`.
The largest Decimal120/Fraction discrepancy was `1.68e-118` against `1e-100`.
These values describe this finite reduced plant only.

## Raw bits and input rounding

All 13 accepted source/native output pairs matched byte-for-byte in the saved
raw-word representation: 793 binary64 words per graph, including 33 negative
zero words per graph. This raw equality is separate from the physical
reference gates. Fraction treats both zero signs as numerical zero and does
not predict a computed zero sign. Authored `3/5` rotation rounding and every
other native-minus-ideal input difference are recorded separately in the result
JSON. No matrix or state normalization was applied.

## Actual resource and timing records

| Recorded scope | Peak or bytes | Frozen limit |
|---|---:|---:|
| Candidate owned-payload/serialization charge | 7,722,080 B | 8,388,608 B |
| Validator owned live/serialization charge | 5,595,123 B | 8,388,608 B |
| Reference preflight owned upper charge | 6,522,758 B | 8,388,608 B |
| Reference measured reachable owned peak | 558,187 B | Separate measured subtotal |
| Combined oracle/campaign evidence, excluding build | 1,995,988 B | 8,388,608 B |
| Isolated source/native build files | 42,011 B | 16,777,216 B |

The oracle wall time was 2.820177041 seconds; the campaign recorded
20.315993166 seconds and the outer guard 20.361505875 seconds. No termination
signal or cleanup delay was needed. The outer controller receipts occupy a
separate 9,253 bytes. Resource charges are the reviewed logical owned-data and
serialization envelope, not measured compiler/interpreter/tool heap or process
RSS. Nonconcurrent phase peaks are not summed as a simultaneous memory peak.
CPU time and baseline speed were not measured. No performance or hardware
qualification follows from these wall times.

## Recorded command and provenance

This command was executed once under the parent's heavy gate. These IDs are
already used; this is a historical command, not an instruction to rerun it.

```sh
/Users/user/.volta/tools/image/node/22.19.0/bin/node \
  examples/physics-world-p5-2276/command-run.mjs impulse-campaign-01 . \
  /Users/user/.volta/tools/image/node/22.19.0/bin/node \
  examples/physics-cloth-rigid-impulse-2276/impulse-run.mjs \
  --run-id impulse-01 \
  --freeze /Users/user/Documents/ChatGPT/barocss-physics-motion-2276/examples/physics-cloth-rigid-impulse-2276/EXECUTION-FREEZE-01.json \
  --token 511b332d26a4a8875ac785d71076a0111236f71db8d45759474ca05861b89eff \
  --authorize-impulse-campaign
```

The saved [execution freeze](EXECUTION-FREEZE-01.json),
[campaign summary](evidence/impulse-01/summary.json),
[oracle summary](evidence/impulse-01-oracle/summary.json) and
[outer guard](../physics-world-p5-2276/evidence/impulse-campaign-01/result.json)
are pinned in `RESULTS-01.json`, together with all 23 reference replies,
26 validator receipts, raw outputs, input files, command logs and generated
provider files. The source and native providers came from the same frozen
candidate plus the reviewed observation overlays. Native execution used the
actual isolated TypeScript output with no source fallback.

## Preserved failures and next dependencies

The initial oracle accounting NO_GO and provider remain preserved at
`301cb393b`. The Pattern-metadata DATA failure and its narrow correction remain
in [ORACLE-ACCOUNTING-REPAIR.md](ORACLE-ACCOUNTING-REPAIR.md). The original runner
and three-finding static NO_GO remain at `27736b631` and `105769198`; the
[repair](RUNNER-REPAIR-02.md) and [new review](CAMPAIGN-REVIEW-02.md) preserve that
boundary. The post-run DATA extractor first assumed 99 checks per validator;
actual receipts contain 98. That metadata failure is recorded in the results,
as is a corrected CamelCase angular-impulse unit tag. No campaign value,
physical gate or provider was changed by this extraction.

The parent's G1 whole-roadmap gap audit and serial ROADMAP update remain the
next integration step. P6a still needs its public coupling profile/schema,
full-sheet and pin reactions, position/contact residuals, once-only exchange
and substep timing, compliance/work and dt-refined trajectories. P6b needs a
calibrated fluid mass/pressure plant; P7 needs connected nonlinear dynamics and
actuator/control gates. P4 remains NO_GO. P5's bounded migration remains closed
with its explicit rendering-SDK product boundary. The complete required
roadmap, public dynamic mixtures and whole-roadmap merge conditions remain
pending; this private operator result does not close those dependencies.
