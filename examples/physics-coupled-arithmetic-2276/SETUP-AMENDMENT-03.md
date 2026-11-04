# Strict declaration setup continuation 03

Status: AUTHORED_NOT_EXECUTED. Original531seal, all original source, original01/02scripts/seal/stages/logs/results and actual materialize01 remain immutable. No candidate/test-entry/World calls occurred in either failed build.

Root build02 failed in986.774ms. TS18048 is gone. Strict declaration emission reports TS4060 at math-core.ts(6,17) and TS4058 through production/test contexts: inferred exported return exposes local private interface Variations. Root preserves complete diagnostics and result. This is a second strict typing/declaration setup failure, not an arithmetic result.

NEW math-core-03.ts changes ONLY variations' return annotation from `: Variations` to `: { readonly left: number; readonly right: number; readonly root: boolean }`. The local interface, memo Map and entire function body remain unchanged. This type annotation is erased in JS. Source-only inspection found no other local interface/type declaration in math-core.ts: its other types are imported or exported named types. No compile success is inferred from that inspection.

NEW build-03.mjs maps math-core-03.ts to stage/math-core.ts and retains existing test-entry-02.ts→stage/test-entry.ts. It verifies exactly both erased source deltas before work, plus original AUTHOR531 and new CONTINUATION-FREEZE-03. Strict/declaration/noEmitOnError/skipLibCheck=false, Source/Native entry graphs, consumer, actual shared-core binding, all counter/physics/tolerance/precision/cap checks remain unchanged. Actual new stage-source hashes and continuationPin are explicit in result/provider; no old identity is reused.

Root authenticates original+continuation03/provider before EVERY unchanged runner/parity command, reuses materialize01, and resumes with build-03.mjs build-03. Subsequent command IDs and production13/full-counter raw equality→production parity→separate private52 first-failure order remain as PURE-PROTOCOL, replacing build-01/build-02 with build-03. Source failure leaves Native/unreached controls NOT_RUN. First01/02setup failures are never overwritten or relabeled.

Author performed syntax/hash/source-text checks only. No compiler, materializer, math, audit, reference, decoder, World or browser execution occurred. Runtime promotion remains BLOCKED until actual required checks and host qualification.
