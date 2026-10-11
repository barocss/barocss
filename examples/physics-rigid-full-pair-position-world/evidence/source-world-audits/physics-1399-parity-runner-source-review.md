# #1399 parity runner source review

SOURCE ONLY. Read PARITY-CONTINUATION-CONTRACT.md at root's before-code b48ff15f and parity-runner.mjs. No source edit, import, parser/AST, control, model, reference, World, build or test execution.

## Concrete blocker sent to root

`parity-runner.mjs:46` saves the fresh nine-start result, then unconditionally compares its JSON bytes with the old successful source start. This comparison runs before the `start.kernelGO` branch at48. A valid resolved numerical refusal from runNineStart (`kernelGO=false`, numerical NO-GO disposition) therefore becomes AssertionError/EXECUTION_FAILURE instead of the recorded numerical disposition. Handle that physical nine-start failure before successful-start parity comparison, stop its World stage and preserve its first result. Keep the successful JSON byte gate unchanged. No law, coefficient, tolerance, budget or input change is needed. A noncompleted flow must not claim complete nine-flow parity.

## Aligned source facts

- Lines18–23 fetch both immutable manifests from Git, check their literal SHA256, then compare every artifact's bytes/length/hash against its Git blob before physical imports.
- Source control receipts and source-repeat controls compare their persisted decoded bytes at24. Source/repeat controls are reused; no source graph or completed source-repeat control API is called again.
- Source nine-row GO and three source summaries are reused at25–26. Fresh canonical JSON/raw/summary names are hardlinks to the authenticated completed files. No canonical path is written or truncated.
- Graph loop41 contains only source-repeat and compiled-dependencies. Repeat runs its missing nine-row start and three World prefixes. Compiled runs its controls, nine-row start and three prefixes once.
- Control/start success comparison uses exact JSON.stringify Buffer bytes against stored decoded JSON, not native deep equality against JSON-erased signed zeros. It does not alter native result/raw frame bits.
- Source-repeat bundle hash is checked against the authenticated literal source bundle before import. The compiled helper path remains governed by the unchanged original bundle audit.
- Lines32–39 check fresh source/emitted provenance, all current emitted paths/bytes/hashes, original ledger identity and its full entries, and original actual build/successful-types identities. No build/type call is introduced.
- Original partial and completed source trace bytes are included in the main budget base141448108. Parity mode passes source evidence to the unchanged writer. Per-record LF/raw Buffer comparisons, final EOF/count/hash checks occur before full alias hardlinks; new thin receipt data is counted separately.
- Fixed storage29 counts device+inode across old partial, completed continuation, initial failure and new output. Hardlinks count once; identical distinct files count separately. The candidate save adds its own bytes. The summary labels newly compressed JSON separately from whole unique fixed storage and logical alias bytes remain per-report.
- Safe diagnostic extraction protects unknown primitive/getter failures. Reference processes are fresh for each missing graph and closed in finally. There is no reference optimum cache or state import.

No other concrete source/API/storage blocker was found in the requested scope. This is not execution or fullWorld qualification evidence. Existing physical source failures remain immutable.

## Final source follow-up

Root repaired the blocker before execution. Line46 now compares successful start bytes only when kernelGO is true; a saved valid numerical refusal keeps its own disposition and does not enter that graph's World stage. Summary complete-parity flag now requires all three nine-start gates and all nine reports. The remaining compiled gate still executes once under root's selected missing-stage order. No remaining concrete blocker in this source review. No code or controls ran during review.
