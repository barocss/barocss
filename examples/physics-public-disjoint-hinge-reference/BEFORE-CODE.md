# Selected internal saved-phase slice

Author base: 0daa834559886213ffee9922381f9d90f00a501d. Mathematical authority:
f40123da0eedb19245688557f865e1beb09d47ef. Physics source is unchanged between them.
The selected Saved-Phase-Qualification-Contract revision is
c9745175fa3a3eb816bcddde21c942c47582a6bd. Saved-Reference-Contract and
Selected-Preparation remain binding; the later phase seam resolves qualification.

## Ownership and transfer

Only new `packages/barocss-physics/src/disjoint-hinge/{types,errors,measure,pose,rows,linear-solver,projection,report,postcontact}.ts`
and the selected harness files in this directory are owned. Public exports,
World, admission, other packages, historical examples, root and lockfiles are untouched.

- types: already parsed directed local A/B tuple, immutable rest origin, original
  global body indexes and caller joint input index; internal output/report shapes
- errors: five selected NUMERIC_LIMIT messages using the existing PhysicsError
  class; original linear/data guards copied, no catch/relabel bridge
- measure: original velocity diagnostics measurement and original pose measurement
- pose: original coupled pose arithmetic after private admission; parsed input
  replaces private config/carrier; original rest origin replaces config midpoint
- rows and linear-solver: original row, scale, solve and certificate arithmetic
- projection: one pose and one velocity composition; parsed DTO replaces admission
- report: original reciprocal-then-scale A/B correction, B report and strict .01 cap;
  existing own-data/copy helpers remain internal here, without observer machinery
- postcontact: Z0 then Z1 projection/report exactly once each; caller-index writeback
  into detached copies, complete output returned only after both pairs and cap guards

No private constructor, dt/carrier bridge, observer whitelist or example import is
transferred into the package. No arithmetic regrouping, zero normalization, changed
pivot/condition/residual threshold, extra pose/solve, or public solver-proof API.
Transfer source bytes and allowed differences are recorded in transfer-ledger.json.

## Fixed inputs

RENAME maps pairA0/pairB0/pairA1/pairB1 to zLeft/aRight/yLeft/bRight and
hinge0/hinge1 to jointZulu/jointAlpha. PERMUTE body order is [3,0,1,2], inverse
[1,2,3,0], joint order [1,0]. Directed endpoints and canonical Z0/Z1 order remain.
FIRST/LIMIT/FINAL use authenticated original source cursors 0/196/1199 and saved
POSTCONTACT frames. FIRST's historical angular impulse is independent-reference
input provenance only, never a new public command. Receipt is exactly 34958 bytes,
SHA256 b28355cac28b45d9c35639968196f386f4b2fe51dc063897bf52c1b9ab8e3cd4.

## Execution admission, bounds and stopping

No numerical execution is admitted by this file alone. Before trials, freeze the
actual complete source/provider closure, compile through CAD/Physics owned
build:library scripts using Node22/pnpm9, check strict types, freeze emitted closure
and inspect transfer differences independently. Genuine compiled entry is emitted
Physics dist/disjoint-hinge/postcontact.js; no source factory substitution.

Budget: SOURCE6 + compiled6 internal phase calls; projection/report24 each;
Angular/motor/FREE/contact/World0. Cold positive6 + schema negative2 once,
derive12/at_precision24, compiled extra IPC0. Every actual attempt/completion is
recorded, never filled from maxima. First mismatch, unresolved, unknown exception,
resource/storage failure or exhausted budget stops the prefix. No extra campaign
or solver call fills historical nulls. Shared fixed/control storage32MiB and
separate emergency8MiB remain within the selected424MiB overall plan.

Independent authentication, input mapping, derive80/120, precision, expected physical
gates and historical bank correspondence precede any new actual access. Complete
RETURN requires exact outer8/reference6/metrics8/checks21, all numerical/physical
conjunctions and exact bank bits including signed zero. Genuine partial values and
failure classifications survive; no fabricated native certificates or work fields.

Passing this slice qualifies the named internal mapping only. Public admission,
public1200 source/repeat/compiled and Viewer remain later work. This file records
intent before code, not an execution result.

## Authored harness process/storage admission

The saved bank is extracted once with selected spans only and can be reused by its
exact byte hash in source-freeze.json. A fresh run owns one32MiB fixed directory
and a separate8MiB failure reserve. Per JSONL request input<=256KiB,
stdout<=2MiB, stderr<=128KiB, process lifetime<=300s; an exhausted guard is an
execution failure, never a changed physical tolerance. Raw streams/exit/signal
and reached prefix are retained. Counts sidecars record observed derive and
at_precision attempts/completions; controls must record zero.

Compiled comparison uses one separate DATA-only file process per case, no extra
reference JSONL IPC. Its command is `python3 actual-compare.py --source-request
<SOURCE-request> --source-reply <SOURCE-reply> --actual <compiled-actual> --output
<compiled-comparison>`. Only frozen saved expected data and measurement/comparison
code are used; derive/precision/pose/solve are not invoked. Count these six DATA
processes explicitly rather than claiming zero operating-system processes.
