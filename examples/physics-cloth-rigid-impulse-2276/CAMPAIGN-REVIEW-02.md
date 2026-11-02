---
work_id: physics-cloth-rigid-impulse-2276
artifact_type: narrow-repair-final-source-review
status: APPROVED_FOR_FROZEN_FINITE_EXECUTION
owner_role: independent-physics-algorithm-review
source_request: verify only R1 R2 R3 repairs and preserve prior satisfied source approvals
last_updated: 2026-11-02
---

# Decision

**APPROVED_FOR_FROZEN_FINITE_EXECUTION.** R1, R2 and R3 are resolved in the
exact repaired providers below. This approves source readiness for the one
declared finite campaign after the parent creates its explicit fresh execution
freeze. It does not authorize an unpinned run or claim any physical/runtime
PASS. No numerical call has occurred in this review.

The review inspected the minimal diff from27736b631, the new repair/plan/READY,
the tool-pin manifest and current provider hashes. It did not repeat successful
syntax, AST, parent strict noEmit, tool compilation or other satisfied checks.
No provider, authority, plan or READY was edited. This new document is the only
output. Module evaluations, fixture/native conversions, Fraction/Decimal
calculations, builds, reference/candidate/validator/World calls were all0.

The original CAMPAIGN-STATIC-REVIEW NO_GO remains unchanged. This review records
its source repairs rather than rewriting that first finding as a former PASS.

# R1 resolution: bounded traversal ownership

`native-validate.py:56` now uses the class-owned static `WorkingBound._visit`.
Recursion resolves through the class, with no nested recursive closure or
per-check self-reference retaining an old `seen` set. At `native-validate.py:104`,
`check()` uses `finally` to update its peak then clear the identity set and
scratch dictionary, release root/last-root references and delete scratch
containers. Both successful and refused traversal paths release that storage.

The traversal explicitly precharges its own live storage inside the existing
8MiB limit. Before an identity enters the set, the calculation includes the
existing and incoming ID integer sizes, scratch dictionary, active recursive
frames and5 times the current set allocation. The latter covers old-table
plus at-most4x new-table growth on the frozen CPython layout. After insertion,
actual set/ID/frame storage remains charged together with accumulated payload
and the separate1MiB fixed physical/encoding allowance. A50000-node cap no
longer silently assumes the traversal fits in that fixed1MiB allowance. The
depth32/node50000 and8MiB limits are unchanged. Any traversal precharge failure
still stops the current validator and the whole candidate prefix.

The three physical-validation helper closures are instantiated once for this
single request/process. Their captured decoded before/after/ideal/check data
is included in the final full-root precharge before `validate()` returns. The
existing per-object weights cover the live values and their future packed/
JSON/bytes representations through output serialization; fixed helper/cell/
frame metadata stays in the1MiB control allowance. They create no repeated
per-component identity-set retention. The corrected per-check walker removes
the repeated lifetime defect identified in R1. The final full-root charge and
the main result/serialization charge remain required before output.

This accepts the documented finite logical owned-payload envelope. Actual
full-validator maxima remain NOT_RUN. It does not claim measured interpreter
or tool heap, process RSS or OS-page storage.

# R2 resolution: exact approved target and scale

Exactly two physical call sites changed:

- `native-validate.py:331` calls
  `gate('reportMinusStateImpulse.'+name,reported,actual)` for the independently
  state-derived point/rigid/angular impulse target.
- `native-validate.py:337` calls `gate('reportedEnergy.'+key,reported,actual)`
  for independently derived before/after energy and dissipation.

Both now use the existing exact component rule
`abs(reported-target)<=e+e*abs(target)`, `e=1/10^12`, in the field's SI unit.
The target is the independently recomputed actual-state value. Report-to-ideal
and state-to-ideal checks stay in place. True P/L balances, attachment residual
and energy/work/objective identities keep the approved corresponding ideal
before/after scale. No formula, sign, unit, tolerance literal, clamp, solver,
case or call count changed. R2 is resolved without weakening any gate.

# R3 resolution: durable prefix and unknown work

`impulse-run.mjs:114` changes the reference total to null/UNKNOWN when an
oracle PID is observed. Zero means NOT_STARTED only when no oracle process
started. A completed normal oracle restores23 authoritative requests.

`recoverOraclePrefix()` at `impulse-run.mjs:141` first checks the saved
pre-spawn authorization and oracle source/input pins. Captured original
summary/progress receipts must be bounded ordinary files in the fresh owned
oracle directory. Original bytes and SHA pins are retained; a raw copy is
made without JSON reserialization when the evidence budget permits it.
Secondary read/authentication/copy failures are recorded separately.

A final summary is accepted as authoritative only with matching run ID,
authorization hash, input pins and bounded count protocol. Otherwise original
progress supplies durable lower bounds. Actual totals and in-flight work stay
UNKNOWN; a partial or unreadable progress file cannot become a final PASS or
invented zero. Missing both receipts leaves spawned counts unavailable.

The main catch stores the original campaign failure before recovery and keeps
it unchanged (`impulse-run.mjs:282`). Recovery failures have their own fields.
Recovery reads and hashes evidence only; it starts no process, reference,
candidate, conversion or retry. No later candidate graph/case can run through
this failure path. R3 is resolved.

# Unchanged prior approval boundary

The minimal source diff leaves candidate and oracle providers, mathematical
call loops, observation overlays, fixture/fault population, report mapping,
first-failure stopping, numerical equations, criteria and budgets unchanged.
The full independent reference remains12x12 Fraction KKT plus separately
counted conditioning and independently built Decimal80/120 KKT. Native audits
continue to derive I/P/L/energy/work from actual F64-as-Fraction state and
perform0 linear solves. Raw ownership, signed-zero preservation, marker object
identity and source/native complete-output bit parity remain exact gates.

The permitted finite campaign remains23 reference requests/26 exact
factorizations/26 Decimal solves;23 global native fixture conversions; source
and emitted graphs with25 attempts each;50 total candidate attempts/30
condensed solves/26 immediate audits;29 direct child starts including the two
build processes. Source must fully PASS before native calls. There are no
warmups, retries, recovery solves or extra graphs. Every physical/resource/
unknown failure stops before a later candidate call.

The budgets remain8MiB reference work,8MiB candidate/validator logical work,
16MiB source/build,8MiB combined evidence and64MiB whole declared owned-data
envelope.170s work/180s outer group and existing bounded cleanup stay unchanged.
No process/tool heap or RSS claim is added. Parent reports the empty evidence
base now exists as DATA preparation. The parent's separate candidate strict
noEmit prerequisite PASS involved0 mathematical calls and was not repeated.
It does not replace the campaign's single actual native emit.

TOOLCHAIN-PINS-01 records the installed Node22/Python3.13.5, actual root Mach-O
esbuild, TypeScript shim and `_tsc.js`, plus physical/logical standard-library
paths. Extra standard declarations pinned in the manifest are not claimed
executed. The campaign's actual compiler --listFiles subset must still match
the frozen toolFiles before any reference call. The parent must carry this
manifest's exact paths/pins and the reviewed source closure into the new
execution freeze. No tool or library is executed by this review.

# Reviewed hash closure

Paths use this example directory. Earlier unchanged authority/tool/provider
hashes remain recorded in CAMPAIGN-STATIC-REVIEW.md and the manifests below.

| File | SHA256 |
| --- | --- |
| impulse-run.mjs |a0ace9403124294433cbe345ab465c6772dc0649a708d4eb2f13ad8fe2d65585|
| native-validate.py |b67f5ae8b6f5b8b9efe389c1dcb72771b68108bc039cba0b2295d1cc63210094|
| RUNNER-PLAN.json |baf07b5973eb8daccc475cf494c761151540008649a08b602b859de83705d1d6|
| RUNNER-REPAIR-02.md |3d006073a7adc32a812ca55169e545b9a87b9deaf1086887ce4e3d7ce31d5949|
| RUNNER-AUTHOR-READY.json |37c8efb94d13120c14f43f5bbdfafffcbca52ff3fe1dd81c660124b253c58424|
| TOOLCHAIN-PINS-01.json |58a817574356fbdd448ae79b60273cc4f4e290bfad93feacfdb72f332d628383|
| candidate.ts |7901dc4240098da03bb2dea3f353be37c8d8e34c7d31303f19c8950813721106|
| oracle.py |9b7d801cabad49db972b6a06f4a30f191a54c1f1ac26fc49ea73e19d409a42f5|
| CONTRACT.md |7e11f247a8287d5713bdba8f18a3a36fba2abf3602a39cfcd5663461974a05a6|
| CASES.json |f2de2962270fc9fc4910844325d52eb7a2b373f9c3ac884455a53340b4d87d90|
| CAMPAIGN-STATIC-REVIEW.md |29cf7511c6b79ebee8e427c50fd732e9ffd56018a359d5243612ed4cf6a4aa7c|

# Scope after this approval

Full numerical/resource outcomes remain NOT_RUN. The parent must create fresh
IDs and the explicit complete execution freeze before the unchanged single
campaign. A later failed prefix cannot be repeated or tuned under this
approval. Public coupling/schema, full-sheet/pin reactions, contact, dt-refined
trajectories, calibrated P6b fluid coupling and P7 connected mechanisms remain
outside this operator proof. P4 NO_GO and its ended third cache slice, prior
first failures/HOLDs and whole-roadmap integration pending remain unchanged.
