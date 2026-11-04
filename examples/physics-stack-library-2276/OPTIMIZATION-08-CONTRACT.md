# OPT08: exact bit count from a shorter radix representation

Status: ISOLATED_SOURCE_READY_NOT_EXECUTED. Author made no target import,
compiler/test/helper/codec/arithmetic/physics call. Only this example's new
candidate, preserved OPT07 source, fixed32 tests, runner, contract and manifest
are owned. Production strict-line.ts remains OPT07, hash
4c6cc8b397cb2095a255cd61e33c3050e07d5a4c933f5c7d9d896764d154606b.
The concurrent canonical OPT07 provider/campaign must remain immutable.

## Exact source change

candidate-strict-line-opt08.ts is an exact source copy of current OPT07 except:

1. Its type-only Body/Vec3 import points to the actual package internal-types,
   because the isolated copy lives in this example. No runtime import is added.
2. ONLY Arithmetic.checked's local bit-length expression changes from
   abs(value).toString(2).length to:

```ts
const hex = (value < 0n ? -value : value).toString(16), first = hex.charCodeAt(0);
const bits = 4*(hex.length-1) + (first <= 49 ? 1 : first <= 51 ? 2 : first <= 55 ? 3 : 4);
```

Do not change number()'s binary exponent calculation, math, square ownership,
normalization/GCD, tick/op calls, checked call count/order, limit constants,
rounding, tolerances, caches, errors, witnesses, context/row/point population or
public admission. No expected body/impulse/oracle data enters the candidate.

## Proof and exact refusal boundary

For a nonzero magnitude with L hexadecimal digits and first digit h in1..15,
the magnitude lies in [h*16^(L-1),(h+1)*16^(L-1)). Its binary width is therefore
4*(L-1)+width(h). Radix16 emits lowercase ASCII with no leading zeros. First
character codes49,50..51,52..55,56..57/97..102 correspond exactly to widths
1,2,3,4. No floating log, BigInt shift or approximate conversion is used.
Zero emits one character0(code48), and the expression deliberately returns1,
matching old toString(2).length rather than inventing a mathematical zero width.
Negative magnitude conversion is the same original absolute-value operation.

The exact bit count exists for legal AND oversized operands. Continue updating
peakIntegerBits before comparing it with16384; never clamp it or refuse merely
from a preliminary hex length. Thus16385 and20001 remain the exact recorded
oversized peaks. Every successful checked returns the identical immutable
BigInt. No rational or integer tick is added/removed: representation conversion
was and remains unticked. Every check, raw operation and guard still runs in its
old order. Complete counter/error/refusal/actual-work-admission parity with
actual OPT07 is REQUIRED, including existing stale-context direct-return quirks.
No changed resource admission is expected or authorized. Host allocation/JIT/OS
failure text is outside a deterministic arithmetic-refusal parity claim.

For B>0 bits the temporary magnitude text has ceil(B/4) characters instead ofB.
This is a representation-length identity, not measured time or heap/RSS proof.
Old profile01 recorded318707us self sample weight in checked,4621212us in make,
and5070918/5459750us under strict-line. It predates OPT01..07; it does not prove
the current percentage, total speedup, deadline fit or a new full-stack PASS.
The candidate is a small source-based cost hypothesis, with no new profiling
or retiming of ended candidates in this authoring task.

## Actual class and independent fixed32 bank

Tests obtain one actual private m through the existing TS-private context
access, then instantiate its actual constructor with no arguments. This gives
real initially-zero counters for small widths. No replacement implementation,
counter reset/write, prototype mutation, production export or test hook occurs.
The same path is used for the actual immutable canonical OPT07 baseline module.
Literal nibble widths and shift exponents are the independent oracle; the new
hex expression and old binary string formula are not used to compute expected
widths. Comparison with actual old code is additional parity evidence.

1–16. All16 hexadecimal leading digits, including canonical zero. Fixed radix
positions q=0,1,15,255,4095, both signs, and filled lower hexadecimal positions
for every nonzero high digit. Independent literal widths are
[1,1,2,2,3,3,3,3,4,4,4,4,4,4,4,4]. Zero stays1 at every nominal position.
17. Fixed power boundaries k=0,1,3,4,7,8,15,16,31,32,52,53,63,64,255,256,
1023,1024,4095,4096,8191,8192,16382,16383; ±2^k has k+1 bits and
±(2^k-1) has max(1,k). Each uses a fresh real Arithmetic.
18. ±(2^16384-1) passes with exact peak16384 and zero work deltas.
19–21. +2^16384, -2^16384 and2^20000+7 refuse with exact peaks16385,16385,
20001, before any rational/integer tick.
22. Repeated0,15,-16,1,255,-256,0 checks preserve exact monotonic peaks and zero
operation counters.
23–24. Oversized raw numerator precedes denominator-zero refusal; oversized
denominator precedes zero-numerator shortcut. Both retain exact16385 peaks.
25. 2^8192 squared numerator refuses before invalid denominator multiplication;
rational1/integer1/peak16385 is independently required.
26. Raw make(12,-18) gives-2/3, rational0/integer9/peak5. Three Euclidean
remainders12%18,18%12,12%6 plus original sign/base/quotient ticks give9.
27. IEEE decode ±0, ±minimum subnormal, minimum normal and maximum finite.
Independent exact fractions and literal output words; from(-0) retains OLD
canonical positive-zero rational/number behavior. Complete counters match old.
28. Independent ties-to-even words near1 and signed underflow at±2^-1075.
29. Prior actual16385-bit refusal: direct checked(-1), make(0), integer-unit
guard, old nonunit make and OPT07 sumSquare resume behavior remain exact old.
30. Actual200001 neg attempts exhaust rational work; next from refuses before
decoding. Direct checked(0) remains unticked with exact old stale behavior.
31. Actual make(55,89) loops, each successful call14 ticks. Attempt142858 fails
at integer2000001/peak7; direct checked remains unticked and nonzero unit make
retains old integer guard. No counter mutation.
32. Exactly142857 actual make(55,89) calls consume1999998 ticks. Unit mul uses
the last2 ticks and passes; next product refuses at2000001. Counters and actual
admission exactly match old; no artificial prefill or cap mutation.

## Root execution and later adoption

Root may run pinned Node22 arithmetic-opt08-run.mjs with a fresh
arithmetic-opt08-* receipt ID under the existing owned outer180s guard; inner170s,
bounded2MiB tool outputs, no retries. It compiles the ISOLATED candidate to real
Native modules and separately bundles Source, then executes exactly32 tests in
each against actual canonical-opt07-01 JS, b4b9b84f02cd42d3f8a974ebdcaa959aa5f9c652900c41fba483793706c2708e.
Package metadata remains7ef765dcf000a0b45dd74495e60243e16516506e730afa024fc7f32b11222330.
The runner pins production OPT07 and the isolated candidate and snapshots all
source/tool/contract/baseline inputs before and after. It is not a package
adoption or physical test, and never edits production or imports examples into
production. No new cap, dependency or timing policy is introduced.

Only after Root's explicit adoption decision may the exact checked-function
patch be applied to production. The type-only relocation is NOT part of that
patch. Before any OPT08 full cost campaign: retained OPT07/06/05/old32/26/25/16
arithmetic and boundary19 tests, fresh complete Source/Native physical prefix
word/payload parity, canonical build and frozen provider, and current complete
runner/source authentication are still required. Keep old tests/receipts/source
snapshots immutable. A new adopted-source runner/receipt must explicitly bind
that later production graph; this isolated runner must not be silently retuned.
No full1200, public World/API, recorder, strict64/RSS, desktop, release, remote
publish or HOLD resumption follows from this proposal or fixed arithmetic bank.
