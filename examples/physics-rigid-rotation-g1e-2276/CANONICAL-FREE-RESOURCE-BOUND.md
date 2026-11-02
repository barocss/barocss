# Canonical free audits: static resource envelope

STATIC_LOGICAL_BOUND_EXTENDED_TO_TWO_CLOSED_AUDITS. The existing G1c bound of
6,453 object units and 6,935,552 B applies to the two closed canonical free
audits below, within the unchanged 8,192-object and 8 MiB limits. This is a
static logical bound. It is not a Python heap/RSS observation or a new run.

The preserved reports each say 293 objects and 79,517 B. Those values come
from the old list/dict-only traversal. They omit tuple endpoints and some
locals, so they remain explicitly incomplete counter values.

## Closed DATA comparison

Read/hash/JSON/bit inspection only was used. No reference module, physical
formula, kernel, World or build was evaluated. Counts include all JSON keys
and values without deduplication, using the original correction's convention.

| Quantity | New Source and Native | Existing G1c envelope |
| --- | ---: | ---: |
| Input bytes | 4,868 each | 5,933 |
| Input JSON nodes / containers | 472 / 145 | 572 / 176 |
| Report JSON nodes | 98 each | 98 |
| Longest input/report string | 137 characters | 226 including banks |
| Largest collection | 12 | 12 |
| Reported arithmetic operations | 799 each | 839 |
| Smallest nonzero native exponent field | 1015 | 1015 |
| Nonzero native denominator bound | <=61 bits | <=61 bits |
| Saved bank integer bound | 687 bits | 687 bits |
| One input plus both bank files | 24,642 B | 25,707 B |

All 82 encoded native words per new packet are finite; every nonzero word
is normal. The exponent inspection gives the same dyadic bound used by the
old expression-size argument. Both bank files are unchanged Decimal80/120
endpoint-02 rows; their respective sizes remain 8,374 and 11,400 B.

For each graph, both new before/after state trees match the authenticated old
G1c `n01-near-unit-positive` and `s01-equal-inertia-scale` packets, except the
modelDigest/providerDigest strings. Each changed digest retains the exact
`sha256:` plus 64 lowercase hex format. Numeric state words are unchanged.
This comparison retains all identity differences rather than rewriting them.

The new case record has five fields. All five values equal the corresponding
old case values. The four removed old fields are id, halfExtentsM, massKg and
qXYZW. The physical input is the native base box, mass1, identity initial q,
spin[1,1,1] and dt120. Old N01 had a radial authored q that admitted to this
same identity; old S01 used the declared mass/length scaling. Neither authored
input is called byte-identical to the new input. Their admitted state words
and all saved numeric report fields are exactly equal to the new ones.

The comparison checked errors, integral-inertia records, operation counts,
monomial-integral counts, zero new ODE/Decimal/sqrt/trig counts and scope.
This is literal saved-DATA equality, not recomputation of those quantities.

## Unchanged bound and authorities

The old proof already counts both raw/decoded packet graphs, both parsed banks,
all 839 possible arithmetic results as simultaneously live Fraction/integer
triples, interval tuples/endpoints/constants, 1,024 scratch units and 64
arithmetic temporaries. Every relevant new shape/word/count is within that
proof's maxima. Its 2,048-bit stored integer and 4,096-bit product allowances
remain unchanged. Reuse its conservative total; do not replace it with the
smaller incomplete runtime traversal:

`2*572 + 2*276 + 3*(839+64+256) + 128+64+1024+64 = 6453 < 8192`

`6453*1024 + 64*1024 + 256*1024 = 6,935,552 B < 8,388,608 B`.

New files are under `evidence/g1e-canonical-01/`:

| File | SHA-256 |
| --- | --- |
| `source-free-reference-input.json` | `c8e87da77fe3132c871c731b747c52a78776f3dd4e8535de2b7ff85cdf1b089e` |
| `native-free-reference-input.json` | `17e363e91ed62f4baaf78c1620698a9b76591a060c9c3af3de1d85fb00e8ec09` |
| `source-free-audit.json` | `e2c35d9cd754bc5d84bb8ee4be3ae47a1f832b10dc064612eac879bcac9d73cf` |
| `native-free-audit.json` | `a2fcb64faa177b0d7a68460ac5786a3b507227141009f8de683789e3539a02c1` |

Verified predecessor authorities:

- G1c `RESOURCE-CORRECTION-03.md`: `a5185dfa539815c813373a087449d79693352df6e0177a29ff689eb4e9be80c1`.
- G1c manifest: `e945edaea9478546a7f4df82b52b0562b46cb87d0302ed5a8c1eab43f7700430`.
- Unchanged G1c reference: `91966d1e3d2fc3cabea2156dd670463faf70af811f05aecbf32d182e20590d19`.
- Bank80-02: `218a20204896a3d1940d71b652156b7410de413ad5c3ae0949d9d4022c163a35`.
- Bank120-02: `5c165d124a14c8ff11ce891ab34e01d43bcd2165bef321e892028a7bc2942e68`.

The old Source/Native N01/S01 input and report bytes/SHA values were checked
against that immutable manifest. This extension covers only the two pinned
closed canonical free audits. It adds no physical run, broader input envelope,
future-run guarantee or installed-runtime allocation claim. All first failures,
limits, physical gates and HOLDs remain. READY; STOP.
