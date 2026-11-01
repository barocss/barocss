# P5 common World domain transition

Current checkpoint: source and native legacy failure baselines reproduced.
P5 implementation and public domain admission are not complete. Existing HOLD,
original8-box NO_GO, original hinge failure, tolerances and first receipts stay.

`SCOPE-CONTRACT.md` and `MIGRATION-PLAN.json` define the proposed direct cutover
of21 active leaf callers. No compatibility factory, second clock or hidden
Domain World is part of the target. Source inspection confirms Float64Array
storage in both current kernels; preserve it and their arithmetic order.

The parent froze `BASELINE-CONTRACT.md`, `BASELINE-PROVIDERS.json` and the runner
before runtime. An incorrect child-dispatch name was found and repaired during
static review before the freeze or any numerical call. The parent freeze records
that boundary. All1376 listed provider/authority files were authenticated.

Commands ran with installed Node22 under the existing heavy gate, in order:

```sh
$NODE22 examples/physics-world-p5-2276/baseline.mjs --run-id baseline-source-01 --graph source --authorize-baseline
$NODE22 examples/physics-world-p5-2276/baseline.mjs --run-id baseline-emitted-01 --graph emitted --authorize-baseline
```

Both runs reproduce five known post-commit preparation failures: cloth, plain
fluid, XSPH fluid, CAD inner-fluid copy and CAD outer return-copy. Each exact
synthetic Error escapes after cursor0 becomes1. The accepted state equals an
unfailed control's step1, and continuation equals its step2. This is evidence
of an atomicity gap, **not** successful rollback, real OOM or new physical accuracy.
All five complete case records match across source/native graphs exactly,
including recorded raw little-endian Float64 bytes and diagnostics.

Per graph:14 actual constructors (2cloth,8fluid,4CAD wrappers),28 actual step
method entries,20 numerical commits (4cloth solver and16PBF calls),20 public
step attempts/15returns,5 known throws and10 successful top-level cleanups.
Combined:28 constructors,56 method entries,40 commits,10 known failures. Four
common-profile create attempts per graph also refuse before domain-shape parsing.
Those outer-only inputs do not prove validity of a complete future domain model.
`baseline-results.json` contains receipt hashes and actual counters.

Both groups closed with pipe EOF and no remaining owned process group. No
runtime deadline, output limit, tolerance or physical bound was raised. The
source graph is an isolated test overlay; native execution uses copied actual
unbundled dist files and a native CAD resolver, without source fallback. Captured
old providers under evidence are historical test operands, not a product
compatibility path. Production sources remain unchanged at this checkpoint.

Next: extract clock-free candidate kernels, compare their outputs against these
captured states, prove candidate ownership and measure canonical model sizes.
Then perform one public World/API/caller/export/docs cutover. Domain recording
requires its unchanged128KiB model/1MiB record limits and closure gate or explicit
tested profile refusal. P4/P6/P7 remain separate dependencies. Develop merge waits
for the whole required roadmap. No push, deployment, release or equipment claim.
