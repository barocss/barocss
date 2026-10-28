# Bounded profile-relief performance — 2026-10-28

Status: one local paired comparison on runtime checkpoint `62069bbd1`. Fixed-case B-rep fingerprints and shape
records are unchanged. Rounded median of seven runs is emboss 7→6 ms and engrave 6→6 ms. This does not establish a stable speedup
or improved Studio latency. Final whole suites and actual Chrome/WebGPU relief flows pass; their evidence is separate from this benchmark.

## Fixed workloads and method

Script: packages/barocss-cad/scripts/perf-bench.mjs. Cases: profile-relief-emboss and profile-relief-engrave.
Each native document uses a 40x30 rectangle extruded 10, a 20x10 rectangular component at [10,10]–[30,20], one exact
p.top face, depth 3, clearance 0.25, then the requested mode. These are synthetic native profile cases, not a Korean
font or Studio latency benchmark. Their analytic base±ink*depth references are 12600/11400 mm³; the final shape/volume comparison is SAME for both fixed cases.

RUNS=7. The script evaluates each case seven times, sorts elapsed evaluation times, and reports the middle value
rounded to integer milliseconds. Fingerprinting runs after each timed evaluation. There is no separate warmup in
this script. The B-rep JSON fingerprint is the first 16 hex digits of SHA-256, including vertex/curve/surface/name
data; it is not an original-font checksum. New cases were added for this change. Final runtime source is `62069bbd1`. The baseline kernel source corresponds to `acead9d16`; the two benchmark cases were uncommitted script additions.
No measurement-time build manifest or hardware/load snapshot was saved. Later metadata in
`text-relief-2026-10-28/machine-later.json` records Apple M3 Max/14 logical CPUs/36 GiB, arm64 Darwin24.6.0 and Node22.19.0;
it was captured after the benchmark during whole-suite validation, not as simultaneous load telemetry. Task heavy
work was serialized under the lane gate; other host workload was not recorded. Required runtime is Node 22.19.0; a measurement must run without another heavy task. Whole-suite validation must not overlap a final benchmark run.

Before receipts: /tmp/barocss-text-relief-perf-before.{log,json}; baseline shape receipt:
/tmp/barocss-text-relief-shape-before-batch.json. Final receipts: /tmp/barocss-text-relief-perf-final.log and /tmp/barocss-text-relief-shape-final.log.
The shape command has its own timing output; those numbers are not mixed into the native evaluation medians below.

| Case | Before median7 | After median7 | Change | Before fingerprint | Final fingerprint |
|---|---:|---:|---:|---|---|
| profile-relief-emboss |7 ms|6 ms|-14.3% of rounded medians|09a6c59c60709781|09a6c59c60709781|
| profile-relief-engrave |6 ms|6 ms|0.0% of rounded medians|e00ff354203f64ff|e00ff354203f64ff|

The script retains rounded medians, not the individual timing series. At this short duration, rounded medians
alone cannot support a precise percentage improvement claim. Do not infer end-to-end Studio or Korean-font performance.

## What changed without increasing limits

- Exact orientation reuses existing homogeneous predicates and a request-local binary64 point cache.
- Dyadic area and straight-boundary 3D volume sum integers at a common power-of-two denominator before one rational
  reduction. They preserve finite-input exactness while avoiding repeated rational GCDs.
- Directed-endpoint multisets provide a linear boundary-match path; split/merge cases retain exact coverage checks.
- Emboss constructs admitted slabs directly with zero Booleans. Engrave batches components in one planar difference.
  Complete oriented frontier equality proves the source-minus-ink boundary, including counters; volume audit is
  additional evidence and does not replace this geometric boundary check.

The existing numeric/work/count/bit limits remain unchanged. Support against actual material and the selected cap,
strict boundary clearance, component separation, bottom web/raised seat, one physical solid and strict validity
are retained. The fixed-output comparison passes. A broader performance improvement still needs repeated paired runs and
finer timing data; it is not established by this one pair.

## Equivalence and correctness gate

| Check | Final status |
|---|---|
| Both fixed-case B-rep fingerprints vs before |SAME|
| Strict validity and one physical body |SAME/PASS|
| Face/edge/vertex counts and sorted face/edge names |SAME|
| Volume and centroid shape comparison |SAME|
| Separate complete mass-property bit-string comparison |NOT CLAIMED; supplied receipts cover B-rep/shape|
| Oriented frontier and source/ink containment checks |final focused 19/19 and Model 75/75 pass|
| Final whole kernel/Model/Studio |1994/0/6 skips;1822/1822;365/365 PASS|

Acceptance requires bit-identical results, or an explicit reviewed shape comparison preserving validity, counts,
names and volume with passing tests. A matching source hash, one scalar volume or a green process exit does not
replace those checks. API readonly output types do not prevent a caller that forces mutation.

## Observed capacity and refusals are distinct from timing

The final focused Model 75/75 admits Nanum Gothic and Nanum Myeongjo 가한, both modes, em 10/at [5,5]/depth 2/tolerance 0.01.
Myeongjo engraving at 0.002 still refuses the unchanged 1m work limit with INPUT and retains node 0.002. This is not a
successful tighter stress case or an automatically relaxed tolerance. The kernel 64-component positive fixture
has volume 11710.72 and one strict-valid body; 65 components and a separate 1024-edge work request refuse.

Initial Model attempts first/second exhausted rational work, third repeated nativeBoolean work, fourth exact
coverage work and fifth pocketRegions work. All were 73/74; sixth reran the old test after a wrong edit path. The
seventh run explicitly uses 0.01 for admitted Korean fixtures and adds the separate 0.002 refusal, passing 75/75.
See D296 and notes/text-relief-2026-10-28 for the original error fields/logs. The initial whole kernel 1994/0/6
predates the final helper and must not be presented as final-source qualification.

## Interpretation

This single pair records a 1 ms decrease in rounded emboss median and no rounded engrave change. Individual
sample timings are not retained here. Integer rounding and runtime variation prevent an inference of stable
throughput improvement. Both fixed-case fingerprints and the reviewed shape record are unchanged, so this pair
supports those output-preservation checks. It says nothing about end-to-end Studio latency or the tighter Korean
stress request. Final whole suites and actual browser startup/flows36/37 pass; they are separate from this benchmark.
Actual Latin36 and Korean37 are qualified separately at0.002/0.01 respectively. Complete browser/GPU/native IME,
arbitrary fonts and release remain outside this benchmark and are not qualified by it.
