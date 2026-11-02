# G1c resource correction 03

STATIC_LOGICAL_BOUND_ESTABLISHED_FOR_CLOSED_16_AUDITS. The saved physical PASS
and deterministic parity remain valid at their original finite scope. This
additive note corrects the resource interpretation only. No source, old report,
contract, design, first failure or runtime artifact was changed. No physical
reference, module, World, build or numerical campaign was run again.

The old reported 85,892 B and 326 objects are incomplete counter values.
`reference-frame.py` traverses list/dict containers but treats interval tuples
as scalar values; it misses their endpoint Fractions and some retained locals.
Those numbers must not be called the complete peak. They are not heap/RSS
measurements. The conservative bound below uses the same existing 8 MiB and
8,192-object limits; it is a static upper bound, not a replacement observation.

## Closed DATA checks

Read/hash/JSON-structure inspection authenticated the 16 saved input packets
and 16 PASS reports through `EVIDENCE-MANIFEST-02.json`. Both bank rows match
`EXECUTION-FREEZE-02.json`. Inspection imported no reference code and evaluated
no physical invariant or trajectory. JSON node counts below include every
container, every key occurrence and every scalar occurrence, without deduplication.

| Closed DATA quantity | Maximum / value |
| --- | ---: |
| One input packet | 5,933 B; 572 JSON nodes; 176 containers |
| Bank 80 endpoint 02 | 8,374 B; 276 JSON nodes |
| Bank 120 endpoint 02 | 11,400 B; 276 JSON nodes |
| One closed report | 98 JSON nodes |
| Longest inspected key/value string | 226 characters |
| Largest inspected collection | 12 entries |
| Saved bank numerator/denominator integer | 687 bits |
| Nonzero encoded F64 denominator upper bound | 61 bits |
| Actual arithmetic counts per audit | 799, 815 or 839 |

The actual arithmetic maximum is 839, not 831. The composite report's sum
13,056 remains unchanged. The F64 bound follows from the saved words' smallest
nonzero exponent field 1015. All nonzero saved words are normal finite values.

Authorities:

- Evidence manifest SHA-256: `e945edaea9478546a7f4df82b52b0562b46cb87d0302ed5a8c1eab43f7700430`.
- Immutable reference SHA-256: `91966d1e3d2fc3cabea2156dd670463faf70af811f05aecbf32d182e20590d19`.
- Bank 80 SHA-256: `218a20204896a3d1940d71b652156b7410de413ad5c3ae0949d9d4022c163a35`.
- Bank 120 SHA-256: `5c165d124a14c8ff11ce891ab34e01d43bcd2165bef321e892028a7bc2942e68`.

## Object and scalar bound

Count every returned arithmetic result as a new Fraction plus two integers,
even when the implementation reuses an object or releases it immediately.
Both parsed banks are counted together to cover replacement during loading.
Raw and decoded packet graphs are both counted in full. A decoded F64 wrapper
has at most the same three units as Fraction/numerator/denominator. At most
32 retained interval tuples contain 64 endpoint Fractions across both
precisions; allow 64 tuples to cover discarded sign-transform intermediates.

The fixed loops create fewer than 256 other explicit Fraction constants:
18 power seeds, 3 geometry-sum seeds, 36 physical-sum seeds, 5 gate/error
constants, 32 width constants and 128 endpoint-gate constants total 222.
The 64 interval constructors and their 128 parsed integer arguments are
counted separately. Counted negations and absolute values already occur
inside the 839-operation maximum.

Reserve 1,024 additional units for non-Fraction scratch containers, iterator/
generator records, the traversal set and its integer keys, report metadata,
paths and bounded encoding metadata. This exceeds the fixed target/physical/
geometry loop containers, the old maximum 326 traversal identities and the
98-node report combined. Reserve another 64 units for simultaneous arithmetic
temporaries. Thus even counting all arithmetic results over time as live:

    2*572 + 2*276 + 3*(839 + 64 + 256)
      + 128 + 64 + 1024 + 64 = 6453 < 8192

For the fixed physical expressions, q and native inputs are dyadic with at
most 61 denominator bits. Homogeneous R has a shared squared-norm denominator
with fewer than 128 bits. Cuboid integration, R-transformed L/E and their
residuals stay below 1,024 bits. Combining a physical component with a saved
687-bit endpoint stays below that bound. The widest generic subtraction of
two bank endpoints needs at most 1,374 denominator bits. Use 2,048 bits for
each stored numerator/denominator and 4,096 bits for integer product scratch.
These are expression bounds, not newly computed physical results.

## Byte conclusion

A 1 KiB charge per object-count unit covers each stored Fraction and its
integer payloads, the <=226-character strings, and amortized container edges
and metadata. The logical Fraction allowance is at most
128+(2048+2048)/8 = 640 B. Add another 1 KiB for each of the 64 arithmetic
temporary units, allowing a temporary Fraction with 4,096-bit endpoints.
An additional 256 KiB covers simultaneous bounded input/bank read buffers,
JSON parsing and <=64 KiB report/encoding copies. The actual input plus both
bank files total only 25,707 B; this reserve does not depend on repeating an audit.

    6453*1024 + 64*1024 + 256*1024
      = 6,935,552 B < 8,388,608 B

This establishes the original logical reference envelope for these closed
16 audits despite the incomplete old counter. It does not establish an actual
Python heap/RSS peak, installed engine allocation, a broader input range or
future-run resource success. The old counter remains preserved and explicitly
qualified. All physical gates, resource limits, HOLDs and original first
failures remain unchanged. READY; STOP.
