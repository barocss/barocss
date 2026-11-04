# General continuous rotation: actual results

Status: **PASS for the profiles below**, on the owned worktree branch
`codex/physics-world-p5-2276`, after base8a24d6f778133b460ece7a0220d5db747debe121.
This replaces the G1e one-step whitelist; it does not complete the whole engine.
Existing HOLD, NO_GO, physical tolerances and initial failure records remain.

## Implementation

- `world.ts`: apply J once, drive motors once, integrate continuous world torque or free rotation, validate both candidate outputs, retain atomic commit/recorder ownership.
- `rigid-free-rotation.ts`: actual momentum scaling, repeated principal moments, zero spin, principal-axis flow and a priori conditioning subdivisions (cap64). The27 stages and4 Newton updates are unchanged.
- `rigid-forced-rotation.ts`: general positive principal moments, affine world momentum, modified midpoint2/4/6/8 with endpoint smoothing and order-eight extrapolation. Raw stage quaternions; normalize complete extrapolated substeps only.
- `validation.ts`: replace enclosing-sphere capsule proxy with uniform cylinder/hemisphere COM moments about local Y.
- Remove `rotation-support.ts`; retain only generic result checks in `rotation-validation.ts`. No compatibility engine, public mode switch, runtime dependency or download.

The common model's previous mass/dimension/dt ranges remain. A valid model does
not guarantee every step meets finite work or conditioning limits. In particular,
forced `dt*(norm(LpostJ)+dt*norm(tau))/Imin` must be at most8 for the64-subdivision
budget. Zero-torque isotropic flow still uses the existing10-radian movement
limit. A refusal preserves accepted state and recording; no silent fallback.

## Executed evidence

Source and canonical compiled root/replay each executed31 Worlds and3925
accepted steps (including one internal restore step),2 refused operations and1
restore. Source independent audits passed before Native import. All captured
endpoint states and grid/long-frame hashes matched after checking each graph's
own provider identity. This is same-runtime reproducibility, separately audited
for physical accuracy. No cross-runtime determinism claim.

The23-case matrix covers nine mass/length scalings (mass2^-19/1/2^19kg;
length factors1/512,1,1024), three transported frames, all three box symmetry
axes, free sphere/capsule/cube, zero spin, three forced primitives and arbitrary
J. Each runs12 accepted steps. An independent Fraction volume/geometry audit
checks invariants; six free symmetric-top/isotropic cases also use analytic
solutions, and two forced isotropic cases use independent rational series/work.
The forced capsule has L/norm checks only; its phase/work is NOT_RUN.

| Forced grid,0.1s | Maximum R-entry error | Maximum omega error,rad/s | Work error,J |
| --- | --- | --- | --- |
| 1/60s,6steps | 1.0192389676273351e-16 | 2.293152060380117e-15 | 7.236429027230797e-17 |
| 1/120s,12steps | 1.4177421422513466e-16 | 1.7677975304825666e-15 | 6.06757800673103e-17 |
| 1/240s,24steps | 3.072917619865794e-16 | 2.2981056249741508e-15 | 1.2529410099940696e-16 |

Reference: independent p/R/work ODE, directed80/120 Taylor32, full degree64
defect. Six common physical times receive q/R/omega/work checks (18 matched
frames per graph); L and norm are checked at all45 supplied grid frames. Four
authenticated historical seed windows are reused, with44new windows,
25,910,094new Decimal operations, peak1,535,448logical bytes/6357objects including
fixed transient reserve. Reference execution16.114s; source/native campaign6.022s.
Logical storage is not process RSS. All errors are below the old1e-11 floor;
three-grid comparison therefore establishes no empirical order.

Long free triaxial rotation:3600steps at1/120s (30s). At32 independently audited
samples, max L-component error2.0380054543513612e-14Nms; energy error
2.6638946068656046e-14J; squared-q norm error4.498738060363376e-16. Every public
frame is included in the Source/Native parity hashes. Long-time phase is NOT_RUN.
Large-mass/length matrix cases use the unchanged relative E/L bound, not the
small body's absolute2e-12 gate; their absolute maxima are in raw audit JSON.

All old gates remain: qnorm²1e-12; E/L/work1e-12+1e-12*max(1,|actual|,|expected|);
trajectory1e-11+1e-12*|reference|; reference width1e-24. The fixed campaign
contract was written before execution. No contact iteration count changed.

Known NUMERIC_LIMIT and an injected unexpected solver Error preserve state/log.
Recovery, one-frame recording, restore, and a further accepted step match a
fresh two-step control on both graphs. This tests actual continuation, not a
one-step horizon refusal.

Strict NodeNext root/replay declarations, canonical bundled root and positive/
negative type consumer PASS. Original compiled rotation, oriented-collider and
broadphase probes PASS without changing their inputs or criteria. Physics docs
samples, documentation check, VitePress build and built-link/snippet/evidence
check PASS. Full CAD SDK/all-subpath build and release-gate closure are NOT_RUN.

## First failures remain

The former capsule proxy produced actual world-L error0.004422625739232428Nms
against2e-12 after12free steps. The raw pair/before/after and independent exact
audit remain in `evidence/capsule-baseline-01`. Wrapper success means the expected
failure was recorded; its physical status is PHYSICAL_NO_GO. Corrected free
capsule phase, omega and invariants pass in `evidence/general-01`.

Build02 failed on a mismatched forced-helper export name. Its original output
is in `build-failure-02` and its command receipt remains FAIL. The first exact
capsule audit failed serializing a large rational under Python's default
integer-string limit. The exact failed script is retained in
`first-failure-inputs/invariants-01.py`; large rational output now uses exact
hex fields. No Python security limit, tolerance or decision was changed.
All original G1/G1e/P3/P4 failure directories remain unchanged.

## Commands and next dependencies

Node22.19.0 and installed Python3.13.5 only; tool hashes/aliases are checked by
`build/build.mjs`. All executions use the existing heavy lane and180s
`examples/physics-world-p5-2276/command-run.mjs` guard. Exact argv, exit status,
stdout/stderr and cleanup receipts are under its `evidence/general-*` folders.

```sh
node examples/physics-general-rotation-2276/build/build.mjs
python3 -B examples/physics-general-rotation-2276/reference-general.py --build-bank --input examples/physics-general-rotation-2276/study.json --output FRESH_BANK.jsonl
node examples/physics-general-rotation-2276/run.mjs --run-id FRESH_ID --freeze examples/physics-general-rotation-2276/EXECUTION-FREEZE-02.json --token FROZEN_SHA256
node examples/physics-scene/rotation-probe.mjs
node examples/physics-scene/oriented-colliders-probe.mjs
node examples/physics-scene/broadphase-probe.mjs
# In apps/library-docs:
node samples/run.mjs physics
node scripts/check-docs.mjs
node node_modules/vitepress/bin/vitepress.js build docs
# At repository root:
node examples/physics-motion-docs-2276/check-site.mjs
```

Frozen inputs are immutable; a fresh run needs fresh output paths. The saved
bank can be reused without reintegrating the independent ODE. Build outputs
and provider snapshots are evidence, not public compatibility implementations.

Next: nonidentity forced frames/anisotropic capsule work and phase references,
then joint/motor/contact composition and G2 exact rounded-corner CCD, before
new coupled/P4 claims. Original8-box NO_GO, persistent-box4-body limit and
connected-mechanism limits remain. Browser/product proof is NOT_RUN. Studio,
manufacturing and equipment HOLDs remain. No deployment, release, machine
validation or manufacturing-safety claim follows.
