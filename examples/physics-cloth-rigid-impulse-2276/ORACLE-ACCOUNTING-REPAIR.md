---
work_id: physics-cloth-rigid-impulse-2276
artifact_type: narrow-reference-owned-data-accounting-repair
status: AUTHOR_READY_STATIC_AND_NONNUMERIC_DATA_ONLY
owner_role: independent-reference-author
source_request: preserve numerical provider while proving concurrent owned-data and serialization bounds
last_updated: 2026-11-02
---

# Immutable first blocker

Commit301cb393b38b8c3bb84c83a8d76a6ca8db54f593 preserves the original oracle
SHA4115ab96c46e662942f38b90395c20de69fad6dcd49bf2cb07efd065dc04244e,
its READY receipt and STATIC-REVIEW.md. The original static NO_GO was an
unproved whole-live memory upper bound, with0 numerical calls. It is not
rewritten as PASS. Candidate/CONTRACT/CASES/STATIC-REVIEW remain untouched.

# Scope and nonnumeric check plan, recorded before checks

Only oracle.py, ORACLE-AUTHOR-READY.json and this new document are owned.
No numerical function may change: compare original and repaired source/AST
for Fraction and Decimal classes, admission, physical builders, eliminations,
invariants, condition calculation, cross-checks and accepted reference.
Keep all equations, arithmetic order, criteria and execution populations.

Permitted author checks, once the implementation is complete, are finite:

1. Parse/compile Python without evaluating the module; parse JSON/hash inputs.
   Compare the numerical function/class source spans and AST to the preserved
   Git version. Inspect import/entry boundaries.
2. Extract only the accounting, JSON size/serialization and input-DATA helper
   definitions by AST into an isolated stdlib namespace. Supply inert sentinel
   types for Fraction/Decimal/arithmetic classes. Do not import/evaluate the
   oracle module, create a fixture or construct any numerical reference type.
3. Run at most12 nonnumeric checks: ASCII/unicode/control-string wire parity
   with stdlib JSON; nested dict/list/bool/null/integer metadata parity;
   one10000-node identity-set scratch measurement; shared-root ownership;
   nested caller-root inclusion; original+encoded plain-tree coexistence;
   explicit owner release; oversize string refusal before escaping; oversize
   wire refusal before output allocation; excess graph/depth refusal; bounded
   JSON input decode; synthetic read/progress/failure-shaped DATA serialization.
   These are DATA operations, not CASES recipes, native conversions or solves.
   Record actual count/results and fail first. No benchmark, repetition or
   fixture-derived expected value is allowed.

Reference/candidate/World calls, fixture construction and Fraction/Decimal
operations remain0. Runtime math remains forbidden pending parent freeze.

# Implementation proof

DATA check01 completed groups01..10, then failed group11 on the live CLI
parser's compiled `re.Pattern` metadata. Group12 was NOT_RUN. No fixture or
numerical class was constructed. This first DATA failure is preserved here.
The narrow correction accounts the pattern's C-owned size, pattern text and
bounded group metadata. DATA check02 will repeat only failed group11 and run
previously unrun group12; it will not repeat the successful ten-group prefix.
This authoring correction adds no numerical campaign attempt.

DATA check02 actually PASSed groups11 and12, with measured reachable roots
11110 bytes and maximum preflight upper4460759 bytes for those synthetic data.
No numerical types or fixtures were constructed. Source review then identified
recursive helper-closure cycles, which could keep buffers/identity sets alive
until GC. Explicit `finally` blocks now break those cycles; path/regex layout
allowances also have explicit frozen-runtime guards. Before final READY,
DATA check03 is limited to two newly affected checks: (a) one small plain-DATA
encode/serialize/audit with cyclic GC disabled, asserting no nested helper
functions survive the completed calls; (b) actual default-help CLI metadata
plus short Path layouts and one bounded progress-shaped output. This is not a
repeat of any successful numerical prefix or the ten-group DATA prefix.

DATA check03 actually PASSed both newly affected checks. With GC disabled,
nested helper functions retained before/after were0/0, with no gc.collect call.
Default-help CLI/Path/progress DATA had measured reachable peak13323 bytes,
derived layout allowance peak32768 bytes and preflight upper4502137 bytes.
These are synthetic DATA results, not measured full-reference maxima.

The original25 protected definitions are source-byte and AST identical to
commit301cb393b: raw_parts, ExactArithmetic, exact_record, scalar_shape,
vector_shape, classify, f_zeros, transpose, f_rotated_diagonal,
exact_physical_blocks, exact_elimination, exact_condition, exact_observables,
DecimalArithmetic, decimal_system, decimal_elimination, decimal_observables,
decimal_context, context_report, decimal_reference, numeric_leaves,
decimal_crosschecks, instantiate, check_case_relations and accepted_reference.
This covers all arithmetic, matrices, eliminations and physical assertions.
Only data ownership, input/metadata accounting, encoding and receipt plumbing
changed. Candidate/CONTRACT/CASES/static review remain immutable.

# Whole-live ownership

Accounting exists before authorization reads. Its explicit owner registry holds
immutable pin metadata, CLI parser/arguments, recipes, provenance, summary,
current raw/state/result/reply and the signed-zero comparison data. At every
audit, bounded snapshots of **all live oracle caller frames** add local roots,
including the outer exact matrices during condition/Decimal work and the
Decimal80 result during Decimal120. Function-owned closure cells are traversed;
their immutable code/globals belong to the separate source/build partition.
No frame, proxy or snapshot is retained on the Accounting instance.

The graph audit counts reachable Python allocations by sys.getsizeof; Fraction
numerator/denominator storage is included. Identity deduplication never drops a
live owner; shared integer storage within Fractions may be counted repeatedly,
which is conservative. Unknown live-owned object types refuse. Root graphs
retain the existing10000-node/depth16 limit. At most32 oracle frames and64
locals per frame are permitted. No arbitrary observer callback is introduced.
The proof is restricted to the installed CPython3.13 layout, checked before
math; it is not a cross-runtime memory or RSS claim.

Previous numerical/encoded results are released before a new fixture. On a
reference failure, traceback/cause/context ownership is cleared and current
numeric/encoded roots are released before failure receipts. Bounded error text,
pivot/detail, offending values, source pins and counts remain in the receipt.
Recursive accounting/encoding/writer closures are broken in finally blocks so
they cannot retain sets or buffers pending cyclic GC. The signed-zero control
copy is explicit and is released after its frozen comparison.

# Derived bounds, separately labelled

The reported reachable allocation sum is not called a complete measured peak.
Each check adds the following declared conservative allowances **before** the
covered allocation/phase. Their sum plus the current reachable data must fit
the unchanged8388608-byte work ceiling, or execution refuses. Separate peak
fields report reachable allocations, derived layout allowances, derived
scratch/growth and the combined preflight upper. Peaks of separate categories
need not occur at the same instant and are not added as an observed peak.

| Allowance | Bytes | Source proof |
| --- | ---: | --- |
| Audit scratch |2097152|10000 identity integers at most40B each; CPython3.13 set growth including concurrent old/new tables at most1MiB;32 local snapshots at most4096B each;32 caller-frame headers at most4096B each; up to48 traversal/generator frames at most4096B each; bounded16-level iterator/closure/list overhead fits the remainder. Runtime guards enforce nodes, locals, frame/id sizes and table size. DATA01 also checked the10000-ID table and integer-size limits. |
| Numeric growth between audits |2097152|At most512 newly retained checked Fractions at1280B each,512 Decimals at1152B each, and512 small containers/paths at1024B each totals1769472B, leaving327680B margin. This is a conservative concurrent sum, not a prediction. Justification by fixed function intervals is below. |
| Scalar-operation and small-control temporaries |131072|At most a few live8193-bit integer products/sums/divmod operands (each at most1280B), a rejected pre-check Fraction, one2048-digit Decimal tuple (under17KiB), bounded scalar strings/encoding-bound inspection, hash/I/O/control objects and short path parsing. They do not multiply by matrix dimensions: each elementary operation returns before the next. Fixed-depth small frames are also covered by the audit/frame allowance. |
| ASCII serialization |2228224|At most one1MiB exact-size bytearray and one1MiB returned bytes allocation, plus131072B for one<=32KiB escaped ASCII scalar, its<=32KiB encoding, slice-copy/headers and bounded encoder control. There is no full JSON str, UTF8 duplicate or list of full-output chunks. |

The integer bound follows CPython integer digit allocation with at most4096
stored bits;1280B includes the Fraction wrapper and both integers.8193-bit
operation products are scalar temporaries. A Decimal coefficient with at most
2048 digits needs fewer than1152B including its object/limbs; a tuple exposing
those digits is an operation temporary, not512 simultaneous digit tuples.

Fixed numeric intervals in the unchanged source establish the512-per-category
growth bound: initial admission/full mass/Jacobian/KKT preparation uses fewer
than512 retained Fraction leaves; one12x13 elimination pivot changes at most
156 cells plus a few scalar operands; post-KKT observables/physical inverse
mass/Schur preparation remain below512 new leaves before the condition audit;
one Decimal builder uses fewer than256 retained leaves and one Decimal pivot
at most156 cells; post-solve invariants/residuals use fewer than256 new leaves.
Cross-check leaf/path tuple lists and context reports remain below512 small
containers/strings. Maximum small container rows are13 values and the flattened
comparison lists remain under64 entries. Discarded intermediate values are
not retained between operations. There is no new arithmetic, loop or callback
inside these intervals. A failed checked operation stops immediately; its one
oversized result is covered by scalar temporary allowance, not admitted as512
stored objects. Existing4096/8192/8193-bit and2048-digit guards stay unchanged.

Path/Context/regex/I/O layouts have separate per-owned-object derived charges,
not fabricated sys.getsizeof measurements: Path16KiB with at most1024 total raw
characters/32 parts; Context4KiB for fixed signal state; CLI regex16KiB with
at most1024 pattern characters/64 groups; I/O8KiB buffer allowance. CPython
guards make these restrictions explicit. These are resource guards, with no
change to physical admission or numerical tolerances. Actual source/provider
paths and CLI metadata are the parent-frozen inputs.

# Input decoding and output encoding

Each read precharges two bounded input-byte buffers plus8KiB, reads no more
than the stat size+1 through unbuffered I/O, and refuses growth. Before stdlib
JSON decode,128 times input bytes plus64KiB covers decoded text, scalar token
objects, list/dict slots and object-pair-hook tuples. The128B/input-byte
envelope exceeds the worst short-token/container density on the pinned
CPython layout; even an empty container consumes at least two input bytes,
and an object pair needs key/colon/value syntax. Character payload, Unicode
width and duplicate-key pair staging are included. Input bytes already held
are separate reachable roots. This precharge can refuse a large/unknown
authorization file before decoding; the existing fixed recipe remains pinned.
After decode the whole actual parsed graph is a live root before any math.

Reference encoding preflights an additional retained-tree bound while the full
original result is still owned. Each Fraction encoding charges1024B plus both
integer string lengths. Each Decimal encoding charges1024B plus value/digit
string lengths. Each list charges128+16*length; each dict128+72*length, then
its children. This covers new dict/list capacities, strings and scalar metadata;
borrowed original metadata is already rooted. Numeric-to-string inspection has
the scalar temporary allowance before it runs. Only representation changes;
no solve, arithmetic criterion or precision changes.

The JSON writer first computes the exact ensure_ascii wire length through a
bounded plain-data traversal. It refuses a scalar above32KiB or an artifact
above1MiB **before** allocating the output buffer or escaping that scalar. It
then emits bounded ASCII chunks into an exact-size bytearray and returns
bytes. String escaping uses the installed stdlib encoder; observed wire parity
in DATA checks is explicit. Progress/stdout cap8192B; all stored artifacts and
the reserved failure/summary path retain the8MiB evidence limit. Final receipt
serialization is precharged with an extra64KiB for its bounded metric updates.
No prior result is reread or recomputed for accounting.

# Remaining gate

Numerical ledger remains23requests,13 exact12x12 solves,13 exact3x3 condition
inverses,13 Decimal80 and13 Decimal120 solves. Limits remain reference work8MiB,
reference evidence8MiB,campaign64MiB,170s internal/180s external. Actual full
reference maxima and all physical results remain NOT_RUN. Parent must review
the repaired source and independent runner, then freeze and authorize the
single declared campaign. A new resource or physical failure still stops;
none of these derived envelopes may be raised after observing a failure.
