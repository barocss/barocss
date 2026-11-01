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

## Input precision and native static-operand checkpoint

Before candidate execution, source review found that the original fluid
smoothing radius is `1.8 * 0.05`, whose binary64 value is0.09000000000000001.
The authored recipe's literal0.09 differs by one bit. The frozen recipe stays;
`KERNEL-CLARIFICATION-01.json` explicitly selects the unchanged original exported
constant for new fixture data. No kernel, physical tolerance or field-normalizing
compatibility path changes. Candidate/model construction was still NOT_RUN at
this finding. Future public admission/docs must use the selected exact value.

A suspected shelf rounding difference was checked independently. The original
adapter subtracts integer millimetres before conversion, so both300mm half-spans
produce the literal0.15m. `KERNEL-CLARIFICATION-02.json` records the source proof.
A separate, pre-frozen native operand run then made exactly one public
`admitCadSurfaceProxy` call using captured unbundled native providers. It passed
exact source bounds[200,200,100]..[500,200,400]mm, center[0.35,0.2,0.25]m and
half-extents[0.15,0.01,0.15]m, including captured F64LE bits. It made zero World
or candidate calls. Its nested compiler call follows from the frozen admission
source; only the public admission attempts/returns were directly counted.

```sh
$NODE22 examples/physics-world-p5-2276/static-input-run.mjs static-input-guard-01 static-input-01
```

`static-input-results.json` pins that actual receipt. This is operand provenance;
it does not qualify active contact response. The captured first two fluid steps
have zero obstacle hits and cannot supply that proof. Original later active-hit
receipts remain historical authority, not new common-World observations.

`kernel-implementation-freeze-01.json` freezes private-stage recipes before
implementation. New domain stages remain unexported and public admission remains
pending P5b. The author's early `tsc --noEmit` exited0 without the required heavy
gate. It is reported as ungated compile-only evidence, not a gated verification;
no emission, model construction or kernel call ran in that check. Later actual
source/native campaigns require the normal guard and frozen provider graph.

`baseline-review.json` also records the whole-baseline whitespace-check failure:
a preserved native CAD declaration has inherited trailing whitespace. Its bytes
are exact old provider operands and were retained. Authored-scope whitespace
checks pass; the inherited failure is not relabeled.
