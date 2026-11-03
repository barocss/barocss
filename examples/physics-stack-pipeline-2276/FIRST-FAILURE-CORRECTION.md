# Prefix01 control12 expectation correction

Root's actual prefix-01 stopped in fixed synthetic control12. Numerical calls
were0. Preserve evidence/prefix-01 unchanged. No physical failure is inferred.

The test first observed step3 fail, then marked step1 as an unresolved failure.
It incorrectly expected verified(2) to succeed. The contract requires stopping
dispatch/qualification after the newly observed earlier failure. Window.canResolve
correctly denied step2. Its implementation remains byte-identical; no gate,
credit, numeric criterion, resource bound or production/helper source changed.

Only group12 expectations change, retaining18 groups. The corrected first
scenario requires verified(2) to throw, preserve its prior slot state and leave
contiguous acceptance0 with earliest failure UNKNOWN. A second scenario retains
the original control01 behavior: firstObserved3, step1 marked unknown without a
new failure, and step2 verified but never archived or accepted across the gap.

Before editing, all frozen source/PINS/contract/seal and prefix01/control01 guard
receipts were saved in baseline/prefix-01-frozen-source-and-receipts.tar.gz,
SHA256 5aefaa86a81a48941039c1ed40a6d7a72bdba8d528783be4486d8e73e65a74c9.
All23 archived file contents were read back and matched exact byte counts and hashes.
The original seal1415bd22aa03574fe53d88ab565a168f7d536d672c1e5a5dde64ab00fe806856
is retained under baseline/prefix-01 together with its member index.

The earlier controls01 PASS sources were reconstructed exactly from the small
subsequent edits and verified against their originally declared hashes before
writing baseline/controls-01-pass: protocol5b7fddfa8e604bee32c88c998b2741bcd24edef4168e66bf85a0263994583efd,
controls f40abfec388007969dab51cc6589ef14fbec168bf0988c39140caf7e5ffc79ef.
These nested files preserve original import bytes for traceability, not a new
execution entry. No historical result or failure receipt was overwritten.

Author verification was source/archive/hash IO only. No imports, provider math,
compiler or tests were run. Root must use a new prefix-02 ID after reviewing the
new seal and rerun all18 controls before any numerical calls. Full1200, API,
complete64MiB DATA, CPU and RSS qualification remain unchanged and false/unknown.
