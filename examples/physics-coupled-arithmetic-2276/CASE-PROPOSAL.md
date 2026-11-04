# Complete literal arithmetic proposal 01

Status: ORIGINAL_DESIGN_PROPOSAL_NOT_EXECUTED. The independent reference author subsequently expanded this33-row proposal to52 rows in `../physics-coupled-arithmetic-reference-2276/bank.json`, including outside-only roots, direct numeric RNE/overflow and the mandatory raised-limit admission. That separately frozen independent bank/gold is the final execution authority. This document preserves the complete initial proposal and its rationale; it is not a claim that33 or52 calls ran. Root required the unchanged13-call production protocol/cap16 and the separate52-call private protocol/cap64 to use independent fresh processes and separate censuses.

No target impulse or numerical expected vector is supplied to production. Coefficient tuples are ascending powers; all unspecified resource limits are unchanged production limits. Each row uses a fresh context, initializes q0 then q1, and retains actual counters. Rational string fields require an explicit denominator, including /1 for integers. Result tags below identify required distinctions for review; independent factor/RNE reasoning remains the oracle, not source self-comparison.

## Polynomial/shared-classifier rows:11

| ID | Literal input | Purpose |
|---|---|---|
| P01 | Q=(-1,2,0), H=(1) | Trim degree; unique exact dyadic1/2. |
| P02 | Q=(-3,16,-16), H=(-1/2,1) | Negative-leading derivative/divisor; roots1/4,3/4; reject negative-H root and select3/4. |
| P03 | Q=(1,-4,4), H=(1) | Repeated root; actual DYNAMIC_MULTIPLE_ROOT_UNQUALIFIED. |
| P04 | Q=(0,1), H=(1) | Simple endpoint0; actual endpoint refusal. |
| P05 | Q=(-1,1), H=(1) | Simple endpoint1; actual endpoint refusal. |
| P06 | Q=(105,-1408,5504,-8192,4096), H=(-3/4,1) | Product(8s-1)(8s-3)(8s-5)(8s-7): all4 dyadic roots, only7/8 admissible. |
| P07 | Q=(3,-16,16), H=(1) | Both roots admissible; actual ambiguity refusal. |
| P08 | Q=(-1,2), H=(-1) | Negative H at sole root; actual no-admissible-root refusal. |
| P09 | Q=(-1,2), H=(-1,2) | H=0 at exact dyadic root; actual zero-normal-root refusal. |
| P10 | Multiply(0,0,0,1) by(0,0,1) | Actual degree5 multiplication guard, not physical-profile refusal. |
| P11 | Q=(1), H=(1) | Actual constant-polynomial Sturm refusal. |

Generic classifier uses the SAME sturm/isolate/H code as production. Production's physical endpoint-existence sign rule is not imposed on this private literal-polynomial entry; that rule is still unchanged in production.

## Shared RNE interval rows:12

Each singleton below is the closed interval[x,x]. The private result must distinguish proved value from unresolved cell and preserve raw IEEE words including signed zero.

| ID | Exact interval/input | Purpose |
|---|---|---|
| R01 | singleton1 | Ordinary exact value. |
| R02 | singleton(1+2^-53) | Even lower normal midpoint. |
| R03 | singleton(1+3*2^-53) | Odd lower/even upper normal midpoint. |
| R04 | singleton(1-2^-54) | Rounding at lower side of binade1. |
| R05 | singleton2^-1074 | Minimum subnormal. |
| R06 | singleton2^-1075 | Positive zero midpoint. |
| R07 | singleton(-2^-1076) | Strict negative underflow, require negative-zero word. |
| R08 | singleton(-2^-1075) | Negative zero midpoint. |
| R09 | singleton(2^-1022-2^-1075) | Subnormal/normal transition midpoint. |
| R10 | singleton0 | Exact rational zero, canonical positive-zero word. |
| R11 | [-2^-1076,2^-1076] | Unproved zero sign: shared present must return null. |
| R12 | [1+2^-54,1+3*2^-54] | Crosses normal RNE cell midpoint: return null. |

## Real resource guards:8

| ID | Explicit lower limit and actual operations | Required guard |
|---|---|---|
| B01 | rationals=0; initialize | DYNAMIC_RATIONAL_WORK_LIMIT. |
| B02 | integerOps=1; initialize | DYNAMIC_INTEGER_WORK_LIMIT; denied attempted charge retained. |
| B03 | gcdSteps=0; initialize | DYNAMIC_GCD_WORK_LIMIT at q1 normalization. |
| B04 | bits=8; initialize then parse256/1 | DYNAMIC_EXACT_BIT_LIMIT. |
| B05 | bits=8; initialize then checked integer16*16 | DYNAMIC_PRODUCT_BIT_LIMIT before product allocation. |
| B06 | bits=8; initialize then checked integer1<<8 | DYNAMIC_SHIFT_BIT_LIMIT before shift allocation. |
| B07 | subdivisions=0; initialize then classify Q=(-1,3), H=(1) | Actual first midpoint DYNAMIC_SUBDIVISION_LIMIT. |
| B08 | exponent=1; initialize then classify Q=(-1,3), H=(1) | Actual exponent2 DYNAMIC_DYADIC_EXPONENT_LIMIT. |

No physical input admission is involved in these rows. The test entry must not synthesize a reason: it calls the named actual core operation and catches the resulting refusal. Other limits remain default so an unrelated profile or resource check does not take precedence. Independent audit checks that successful preceding operations and denied-attempt counts match the declared sequence.

## Invalid lower-limit admission:2

| ID | Request | Required boundary |
|---|---|---|
| L01 | integerOps=262145 | Reject raised limit BEFORE context creation. |
| L02 | integerOps=-1 | Reject invalid limit BEFORE context creation. |

These two rows prove only test-configuration admission. They must be labeled NO_CONTEXT and must not count as exercised arithmetic exhaustion. No maximum may be raised through a test request. Unknown keys, noninteger values and initialExponent overrides are rejected by the same exact-key admission, but are NOT_RUN unless a separately frozen future bank adds them.

The unchanged production protocol remains the original3physical inputs,8already-frozen negative controls and2direct static checks, cap16. The final independently authored52-row private arithmetic bank is a separate fresh test-entry protocol, cap64. Stop on the first unexpected result and leave unreached rows NOT_RUN; report each actual census separately. No additional World or dynamic physics step is proposed.
