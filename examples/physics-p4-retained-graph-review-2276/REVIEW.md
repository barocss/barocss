# Read-only retained-graph measurement review

Status: SOURCE_REVIEW_ONLY. No helper, allocator experiment, model, numerical,
reference, auditor, compiler or World call was made. No old source, receipt,
validator, bank or timing was changed. The completed V3 six-frame mathematical
and independent certificates remain PASS. Its fixed cost result remains the
ended COST_NO_GO; this review does not authorize a retime or baseline rerun.

## Confirmed isolated defect

The new V3 support.allocation walker uses this traversal pattern:

```
if id(value) in seen: return 0
seen.add(id(value))
children = tuple(value.items())   # for a dictionary
for child in children: visit(child)
```

Each dictionary entry becomes a NEW temporary(key,value) tuple. The walker
visits that temporary tuple and stores its ID in seen. After a recursive
dictionary traversal returns, its temporary tuples can be freed while their
IDs remain in seen. A later dictionary can allocate a different entry tuple
at a reused address. The walker then treats it as already visited and skips
the actual new key/value references below it. Real owned data is undercounted.

It also counts temporary entry tuples that are not part of the retained input
graph. Thus the result is neither a reliable upper bound nor a reliable lower
bound on actual retained ownership. Whether a particular allocator run reuses
an ID is irrelevant to the validity of an upper-bound claim. No reproduction
or new execution is needed to identify this source defect.

Root reported347708bytes for a large completed full-frame graph. That value
is a receipt of this defective traversal, not an authenticated measurement of
the full graph. Revoke explicitRetainedBytes and observedRetainedPeakBytes as
authoritative retained-size/peak measurements, and revoke any acceptance gate
whose only justification is one of those measurements. This does not assert
that actual memory exceeded the limit.

The scope is the NEW V3 support walker with seen plus temporary entry tuples.
The old independent checker walks actual dictionary keys/values directly.
The parent harness walks pending actual references. The old wrapper's items
walker has no seen-ID deduplication and can conservatively overcount temporary
tuples; it does not have this ID-reuse undercount mechanism. Those paths and
the separately reported R0 parent73880bytes are not revoked by this finding.

## Separate preallocation ledger

The JSON lexical preallocation calculation, helper-copy reservation and fixed
scratch reserve do not call allocation() and do not depend on seen IDs. Root
reported the separate PREALLOCATED+helper+SCRATCH bound32637852bytes against
the33554432-byte audit reservation. That arithmetic record is not invalidated
by this traversal defect. The final max() cannot lower that independent ledger
term merely because its observed graph term is too small.

However, retain the distinction between a RECORDED DESIGN BOUND and a measured
allocator peak. Treat the separate bound as conditional on a complete ownership
justification; do not use the revoked graph reading to prove its premises.

The JSON bound counts wire bytes, string/container/scalar tokens and dictionary
entries before JSON decoding. Its conservative coefficients must cover raw
bytes, decoder/string buffers, container spare capacity, pointers and parsed
scalar objects on the pinned Python. The helper reservation includes its six
actual JSON inputs: old bank, original full request, cold authority, immutable
kernel request, actual kernel reply and runtime-layout authority. Its small
Python-binary buffer and bounded24DOF/36row/864-entry rational matrix, proof
vectors, exact/native arithmetic and RNE temporaries need the scratch proof.
These are separate from candidate proof work and are not a process-RSS claim.

The8MiB scratch justification must also account for the new graph walker's
auxiliary seen set, Python integers holding IDs, recursion and temporary entry
tuples where applicable. The node cap200000 alone is not a proof that a seen
set plus its ID objects fits8MiB. It needs a pinned-layout/capacity bound or a
tighter fixed closed-population reservation. No numerical helper was run here
to supply that missing high-water evidence.

The source read() allocates a raw file buffer before its lexical allocation
reservation check. Therefore an unconditional claim that ALL allocations are
guarded before allocation is not established for arbitrary rejected inputs.
For the completed fixed bank, a successful later lexical bound can still
dominate that raw buffer, so this ordering issue does not itself prove an
actual overrun. A future version must reserve the raw byte buffer from its
known file size before reading it, then reserve decoding/container space.

Conclusion for the ended B evidence:

- Mathematical/physical certificates: unchanged PASS.
- Fixed performance decision: unchanged ended COST_NO_GO.
- Observed graph size/observed peak: UNQUALIFIED and revoked as memory authority.
- Separate recorded preallocation ledger: preserved as a design-bound receipt,
  conditional on complete JSON/helper/scratch/auxiliary ownership proof.
- Actual memory overflow or a fully measured allocator/RSS peak: NOT_ESTABLISHED.

## Required new-version correction

A NEW Gram validator version must traverse actual owned references. For a
dictionary, visit each actual key and value directly; never pass an entry tuple
manufactured by items() into the seen-ID walker. Lists, tuples and sets visit
their actual elements. Fraction must include its retained numerator/denominator
integers, or those must have an explicit separate conservative reservation.
Known dataclass/object storage must be included without invoking arbitrary
properties that manufacture new temporary graphs.

Keep the root graph alive and stable for the complete traversal. Put IDs of
actual retained objects in seen; do not count temporary iterator/views/entry
tuples as retained data. Account separately for the walker's own seen-ID set,
ID integers and stack before they can grow. Enforce a fixed predeclared node
and auxiliary-byte cap. Avoid claiming that post-allocation getsizeof alone
is a check-before-allocation guarantee.

Report payload retained size, observed phase checkpoints, JSON preallocation,
helper-copy bound, Fraction/operator scratch and walker auxiliary reservation
as separate quantities. A combined bound must include every live component.
The unchanged combined64MiB remains parent24+audit32+transport8, with the owned
Node worker exited before independent audit. A corrected walker is not a
permission to raise any child, parent, transport or combined limit.

Do not edit/relabel the frozen V3 source or rerun its ended B. Qualify the new
walker and its resource proof under new source pins before a future Gram
campaign. No geometry/model call or new mathematical oracle is needed to
perform this source correction; all future actual checks remain Root-owned.
