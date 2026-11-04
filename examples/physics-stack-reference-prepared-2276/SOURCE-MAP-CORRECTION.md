# Preserved first probe and decoder census correction

Root's actual probe01 executed one ALIGNED16 world request. Its entire physical
reply exactly equals the immutable original reply. The driver subsequently
failed its own assertion decodeRequests==432. That assertion was incorrect;
the failed driver, original contract and actual receipt remain unchanged.
No physical tolerance or byte-parity requirement changes.

Source-only review explains the correct scope. signed-closure-world/reference.py
compact_pair at188 calls signed-separation-reference/reference.py fresh_query
at143 directly. fresh_query performs Float64 scalar rotation/bases and does NOT
call admitted_query_body. The latter helper at95 contains SAT.decode_body but
is used by the separate public query function at268–274, which compact_pair
never invokes. This is not a separate-module-identity issue.

On this original world path, SAT.evaluate_precision decodes two bodies at each
of80/120 precision for each of72 PRE/HYP pair calls:288 wrapped decode requests.
Two raw/normalized modes give288 SAT calls and two basis calls each give576.
The old432 upper bound is conservative, but its scalar-admission derivation is
wrong. Actual computation/hit counts depend on operands/context;34/254 decode
and68/508 basis are observations, not universal admission criteria.

A data-only retained-probe review verifies unchanged reply bytes, source-backed
288/288/576 call scope, old432/576 conservative entry bounds and restoration.
No new numerical call is required. It does not relabel the failed guard PASS.
The planned twelve-group suite can follow this physical-parity proof. Original
source, candidate, test bank, Python pins, counters, tolerances and all earlier
failures remain unchanged.
