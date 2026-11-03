# Stack retained-data prerequisite

Status: SOURCE_ONLY_NOT_EXECUTED. Own only this NEW folder. Root alone imports
or executes these sources. No production/reference/fixture import, numerical
helper, physics call, old selftest rerun, compiler, dependency or installation.
The old qualified owned.py and seven-group receipt stay unchanged.

Reuse the exact direct-key/value traversal, actual Fraction integer references,
identity deduplication, fixed worklist and seen-set resize reservation logic from
physics-p4-owned-data-2276/owned.py. NEW qualification adds ONLY exact Decimal
leaf sizing and an explicit exact Token type with native slots
serial/quaternion/norm. It does not supply JSON, arbitrary object introspection,
a generic memory framework, native scratch discovery or a process monitor.

## Retained graph policy

Keep the original pinned CPython3.13.5/layout guard,32MiB graph+AUX ceiling,
8MiB AUX,200000 nodes, depth64 and65 worklist slots. The caller must reserve
subject DATA before constructing it. The measured graph must fit that declared
reservation. Multi-root tuple storage is itself subject DATA. Caller graphs
must stay alive and unmodified. Unknown types fail; they are never zero-cost.

Decimal defaults to UNKNOWN/refusal. The explicit policy identifier
cpython3135-c-coefficient-v1 is admissible only under Root-reviewed pins and
the DECIMAL-PREMISE.md source/binary binding. Exact C Decimal only, no subclass.
Its sys.getsizeof charge includes the retained object/coefficient allocation.
No conversion, arithmetic, as_tuple, normalization, exponent expansion or
context flag mutation occurs in the walker. Native arithmetic temporary storage
and unrooted live frames remain UNKNOWN even when retained sizing succeeds.

Token is supplied explicitly as token_type. Require a direct object subclass,
exactly the three declared slots, native MemberDescriptorType descriptors owned
by that exact class, no dictionary/custom size/custom attribute lookup. Access
only those native member descriptors. Token subclasses and other slots objects
refuse. An unset slot refuses. No subject getter, __iter__, __repr__, equality,
hash or conversion is called. Actual prepared Token qualification is a later
Root gate; this component imports only a synthetic equivalent from its tests.

## Fixed ledger

Five fixed owners: producer, coordinator, geometry, position0, position1.
The global64MiB total includes a fixed64KiB controller reservation. Each owner
has one active byte reservation; no duplicate reserve, negative/noninteger
amount, unknown owner or unmatched release. Release requires explicit
aliases_cleared=True; it is a caller assertion, not an alias detector. Every
validation and total check occurs before mutation. A denied operation leaves
the COMPLETE ledger snapshot unchanged. No retry changes a cap or counter.

Three fixed step credits cover prepare -> proof -> archive -> contiguous
commit. Commit means the caller has completed archive persistence; entering
archive alone does not release a credit. Step IDs are consecutive1..1200.
Duplicate/out-of-order IDs, unknown IDs, skipped/repeated phases and a fourth
live credit refuse. The fixed controller also contains credit metadata.

Failure records the first OBSERVED step, stops new preparation and retains the
last contiguous accepted step and outstanding credits. It does not claim the
observed failure is the earliest physical failure. Earlier already-live steps
may still commit in order; failed/later steps may be discarded only explicitly.
Releasing resources cannot erase failure metadata or the last accepted step.
This ledger stores IDs/counters only, not payloads; callers must separately
root actual data and honor reservations BEFORE allocation.

## Fixed seven-group Root selftest

G1. Flat register-on-construction oracle for direct dict keys AND values,
shared integers, shared Fraction numerator/denominator objects, nested lists,
tuple/bytes/bytearray, aliases and a cycle. Register actual retained objects at
construction; sum sys.getsizeof over those unique registered objects. The oracle
never traverses or discovers children, never calls the tested sizing function,
and never derives expected IDs from its output. Require exact bytes and nodes.

G2. Exact Decimal cohorts1.0/1.00, signed zeros,76-digit and300-digit coefficients,
aliases and unusual finite exponents. Register each actual Decimal leaf once.
Require exact flat-oracle bytes/nodes and unchanged DecimalTuple/flags before
and after; the300-digit object's retained size must exceed the short cohort.
Tuple/flags snapshots are independent test metadata, not subject roots. This
does not claim native arithmetic scratch or all-live frame coverage.

G3. Synthetic Token strong slot links to the registered quaternion tuple and
Decimal norm, alias to the same Token, and exact oracle bytes/nodes. The caller
whitelist is required. Actual production Token is NOT_IMPORTED/NOT_QUALIFIED.

G4. Default Decimal UNKNOWN; wrong policy; Decimal subclass; unrecognized slots;
Token subclass; property/custom lookup trap; missing slot; ordinary unknown
object; unknown metaclass equality trap. Every expected refusal has a typed
reason. The11 expected refusals leave all trap counters zero. Type admission
uses identity, not a user-defined metaclass equality method.

G5. Data exact/below bound; graph+AUX exact/below bound; node and depth refusal;
invalid reservation; subject graph mutation check. Boundary sizes come from the
independent registered fixture and declared AUX result, not a physics answer.

G6. All five owners; exact64MiB boundary including64KiB controller; one byte
over; negative/int-vs-bool/float amount; unknown owner; duplicate reserve;
unmatched release; aliases not cleared; valid release/re-reserve. Every denied
operation must preserve an independent full pre-call snapshot.

G7. Three simultaneous credits in prepare/proof/archive; fourth refusal;
duplicate/out-of-order/negative/bool/unknown step; skipped/repeated phase;
early/out-of-order commit; normal contiguous commit; failure retains accepted
frontier, blocks new begin and failed-step commit; earlier in-flight commit;
explicit later discard. All refusals preserve snapshots. No actual payload,
worker, gzip, arithmetic solver or production call is used.

Authenticate PINS SHA supplied by Root, all source/binary/layout pins before
target imports and again before PASS. Internal170s, outer180s owned guard,
<=2MiB report and<=16MiB new component evidence. Fail first, no retry. Root
command uses the pinned Python executable and fresh output directory:

    python3.13 -B selftest.py FRESH_OUTPUT_DIRECTORY ROOT_REVIEWED_PINS_SHA

Root supplies the existing180s owned command guard. The selftest does not
create a second detached supervisor or implement the separate CPU adapter.

Only PASS_STACK_RETAINED_DATA_AND_FIXED_LEDGER_COMPONENTS is possible. Always
report whole64MiBBound=false, nativeTemporaries=UNKNOWN, allLiveFrames=UNKNOWN,
CPU=NOT_RUN, RSS=NOT_RUN, full1200=BLOCKED and API=false. A successful component
does not admit the pipeline. No mobile, deployment or HOLD restart.
