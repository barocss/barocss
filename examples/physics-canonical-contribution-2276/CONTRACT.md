# Canonical internal contact contribution

Implement actual application records and a fresh per-step pair accumulator in
the canonical package. Keep public state, admission, recorder wire, body cap4,
8x8 iterations, existing arithmetic order, tolerances and HOLDs unchanged.
This is internal application authority, not STATE2 or native boundary geometry.

Each application captures pre-application COM, actual lever arm, linear impulse
and actual arm torque for both bodies, including static reaction. Normal solve
retains its torque-axis-times-scalar operands and original angular mutation.
World-origin moment is COM cross J plus actual arm torque. Preserve nonzero
history when sums cancel. No final contact/cache/trace reconstruction.

Each canonical World step consumes each returned application once. Pair storage
is bounded by existing model pairs; application arrays live only for the current
primitive (at most two). Validate finite candidate sums before shared commit.
Failure retains accepted bodies/cache/time/recording. No new public hooks.

Qualification to author: independent momentum/spin equation deltas for discrete
normal and friction, pre/post correction COM and radial arms; persistent warm,
negative normal increment and friction reproject; cancellation, alias isolation,
static reaction; canonical World failure/retry and source/emitted state-word
parity. Root alone executes compilation, imports, tests and numerical checks.
Authoring is NOT_RUN until Root supplies receipts. Physical gates remain those
of each existing fixture; no tolerance widening is permitted.

The synthetic radial resolver Hit is an application-equation probe. Its supplied
penetration is not natural detected geometry; its unforced pair moment is not
an accepted-native geometry or World-law failure. Natural sphere/box detection
is exercised separately by the current public trajectory cohort.

The focused suite has nine tests, including persistent World failure/retry after
an accepted warm-cache step. Tests retain measured linear/moment equation-delta
maxima, component counts and the unchanged1e-12 gate in TAP and JSON receipts.
The numerical oracle is actual rigid momentum/spin state change, with known
unit mass and inertia1/6, plus phase COM orbital bookkeeping.

Root runner: explicit Node22 executes run.mjs with a NEW relative output path.
Stages: authenticate baseline205890b0e and unchanged provider closure; generate
Source identity; strict NodeNext modules/declarations; Source and Native nine
tests; actual canonical tsc/root bundle/emitted identity; declaration consumer;
four bounded trajectory cohorts (baseline overlay, Source, Native modules,
canonical bundled root). Only identity.providerDigest metadata may differ.
Every physical number uses Object.is, including signed zero; saved campaign
numbers use explicit binary64 big-endian words. No broad schema normalization.
Each cohort has three fixtures. The planned census is12 World creations and
42 accepted steps including hidden serialize/deserialize, derived from source
factory calls and loops. Receipt status is sourceDerivedPlannedNotObserved.
These counts are not instrumented or observed runtime totals.

Native prototype failure injection imports the actual emitted class used by the
emitted World. Canonical bundled-root validation is a separate API trajectory
cohort; no bundled prototype injection is claimed. Performance/browser/P4/full
geometry/public STATE2 promotion remain NOT_RUN or their previous NO_GO.

Original eight-box1200 P4 NO_GO, old failures, missing-family accepted-native
geometry, public STATE2 and uninstrumented performance remain separate limits.

The runner uses one internal170s deadline. Each child receives the floored
remaining time. The current stage is saved before each spawn. Root must bound
the outer command to180s. SHA256 file reads use one fixed64KiB buffer, including
the Node executable. Freeze runner, fixtures, both tests, this contract and the
four core sources before work; verify them after work. Generated provider
manifest hashes are separate records. Preserve the first failure. No deployment.
