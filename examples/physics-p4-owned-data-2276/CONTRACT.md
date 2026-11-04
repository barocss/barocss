# Closed owned-data helper

AUTHOR_SOURCE_ONLY. Root runs the one fresh pure-data selftest. No old audit, physics helper, candidate, model, World, baseline, timing or browser run is authorized by this helper. Frozen V3 observed347708-byte graph measurements remain UNQUALIFIED; this new helper does not repair or replace those receipts.

## Supported runtime and ownership

Only pinned CPython3.13.5,64-bit pointers, the recorded list/int object layout and its no-deletion set growth policy are supported. This is explicit owned-data accounting, not RSS, allocator/VM/native-runtime memory or a general heap profiler. The caller freezes its input graph and retains all objects for the call; concurrent mutation is unsupported. Shared reachable atoms count once even if also held elsewhere. Code, classes and external observers are not followed implicitly.

Supported exact types are None/bool/int/float/str/bytes/bytearray, dict/list/tuple/set/frozenset, Fraction, and caller-whitelisted plain record classes. A record must directly inherit object, have a real native __dict__ descriptor, no slots and no custom __sizeof__. Its actual __dict__ is traversed. Fraction's actual numerator/denominator integers are traversed. Modules, functions, unknown records, iterators and native objects fail; they are never silently omitted. No subject property except the exact Fraction/native record dictionary is inspected. A caller-created tuple for several roots is itself an owned node.

## Exact API

`owned_size(root, *, data_reservation, allowed_record_types=(), total_limit=33554432, aux_limit=8388608, max_nodes=200000, max_depth=64, max_worklist=65, budget=None)` returns ownedBytes, uniqueNodes, maxDepth, maxWorklistUsed, auxObservedPeakBytes, auxReservedPeakBytes, combinedReservedPeakBytes and limit metadata. With budget it also reports the separately reserved controller and combinedIncludingBudgetControllerBytes.

The caller reserves data BEFORE constructing/loading that graph. data_reservation is a declared upper bound, not a measurement produced by the helper; the observed ownedBytes must fit it. No function can prevent a caller from allocating an oversized graph before invoking it. Each helper-owned growth is checked against the full declared data reservation, not just nodes discovered so far. Exact data bytes plus the conservative auxiliary peak must fit the32MiB audit ceiling. Arguments can tighten but never raise published caps.

The walker stores only ACTUAL data IDs in seen. It iterates actual dict keys, then retrieves each actual value; no synthetic item tuples enter seen. Aliases and cycles count once. maxDepth means FIRST-VISIT TRAVERSAL depth, not a longest graph path (undefined for cycles and dependent on alias discovery). The fixed worklist has at most65 slots; it never grows. Controlled frames and built-in iterators are AUX, never subject nodes.

Before seen.add, reserve the actual ID integer plus BOTH the old set and a complete possible new table. CPython3.13 no-deletion insertion uses at most next power-of-two above4*used slots (smaller growth above50000),16 bytes/entry; include full empty-set/header size. Check actual resulting set size against that predeclared table bound. Include seen-set storage, ID integer objects, fixed worklist, frame/charge pairs, iterators, Fraction/record iterator backing tuples, tiny control integers, bounded transient metadata and a64KiB fixed control allowance. Reserve2048 bytes before constructing each controlled iterator/frame. observed and conservative reserved peaks are distinct; the reserved peak includes possible resize coexistence and need not equal allocated storage. All walker auxiliary reservations fit8MiB, and data+aux fit32MiB.

## JSON and phase ledger

`JsonBudget(limit=33554432, scratch=8388608, max_documents=64)` owns a fixed slot ledger. `read_json(path,budget,expected_pin=None)` returns JsonDocument with value, actual byte/SHA pin and reservationBytes. `document.release()` clears its value and reservation. The caller MUST release all outside aliases before release; this ledger is not an alias detector. A failed load is an abort boundary: discard the failure traceback/current phase before another campaign phase, never reuse retained exception graphs as unaccounted storage.

Only regular immutable input files up to2MiB are supported. Before open/read, reserve2*statSize raw headroom, two64KiB encoding/hash/view headroom blocks, fixed metadata, existing retained reservations and phase scratch. Allocate ONE fixed stat-sized bytearray only after reservation. Read directly into successive memoryview slices no larger than64KiB; never extend or resize the raw buffer. Require the initial descriptor size, complete byte count and final descriptor/path sizes to equal the original stat size. Growth/truncation is a typed failure; do not read a larger source or an extra sentinel byte. Check actual bytes and optional original hash. Never use unbounded read-after-stat. No byte beyond2MiB is read. Source pin covers actual original bytes; JSON strings/integers/Float64 signed zero are not normalized.

After raw capture, scan lexical token/depth bounds BEFORE json.loads. Reserve256 bytes per syntax token plus8*raw bytes (decoder text/decoded strings) plus64KiB; raw/chunk storage remains separately reserved until decode completes. The rule covers closed CPython container growth, pair-hook lists/tuples and temporary duplicate-detection dictionaries. Max100000 syntax tokens, depth64, integer lexeme16 characters, float lexeme64 characters; reject duplicate keys/nonfinite numbers. These are explicit admission/resource limits, not a new physics tolerance. Existing retained documents plus decode/raw/scratch reservations must fit32MiB at every check. Budget metadata and document slots have a separate fixed allowance. The raw hash uses64KiB updates.

`budget.walk_phase()` and `budget.kernel_helper_phase(extra_retained_bound)` are mutually exclusive with read phases. Passing budget to owned_size automatically enters the walk phase and accounts controller storage separately. A helper phase reserves the SAME8MiB scratch for a caller-declared closed old-kernel working bound; it does not allocate or invoke that kernel. No walker seen/worklist is live in that phase. No simultaneous8MiB walker plus8MiB kernel allowance is claimed. Generated retained helper results need their own declared retained bound before a later phase. Caller reservation proofs remain required; the API does not discover hidden native/helper allocations.

The enclosing integration keeps parent24MiB + this audit32MiB + transport/encoding/hash8MiB =64MiB. The helper's32MiB includes its phase scratch. No RSS or old corrected-memory PASS is claimed.

## Frozen selftest census

One Root-only command, internal170s/external180s,2MiB report, below16MiB retained test files, no physics calls. Exact seven groups, fail first:

1. Independent FLAT register-on-construction oracle:1200 unrelated nested dictionaries,48 chain links,16 big-integer Fractions,8 explicit records, tuple/set/frozenset/byte leaves, aliases and a cycle. Register actual record dictionaries and Fraction integer references explicitly. Sum unique registered actual objects with getsizeof; do not walk or discover children in the oracle. Exact owned byte/ID equality, visited depth50 and worklist50 are required. Registry and input graphs are separate; auxiliary frames are not oracle nodes.
2. Below/at/above declared data, total and auxiliary budgets; exact/below unique-node and visited-depth caps; worklist rejection. The dynamic boundary values are actual oracle bytes and the measured declared auxiliary upper bound from group1, never physics data.
3. Five unsupported root types plus invalid module whitelist and missing record approval.
4. Original JSON byte/hash/metadata equality including signed-zero bits and exact0/1 and1/1 text, release ledger and below/at/above aggregate reservations.
5. Six malformed fixtures: duplicate key,17-character integer, infinite float, NaN, depth65 and incomplete syntax.
6. Three files at2MiB−1,2MiB,2MiB+1; the first two preserve `[0]`, the last refuses before raw reading.
7. Fixed document-slot rejection and mutually exclusive read/walk/kernel scratch phases, then a valid budget-bound walk.

Authenticate exact Root-reviewed PINS SHA, source/runtime/tool pins before tests and again before PASS. PASS only means these pure-data fixtures pass. It does not prove a future full-validator working-bound proof, any physics result, old re-audit, algorithm cost or original1200-step budget.
