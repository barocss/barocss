# G1a compile repair 02

Status: AUTHOR_READY, runtime NOT_RUN. Parent owns High review, fresh freeze, build and all numerical calls.

The original staged attempt `g1a-repair-01` is preserved at commit `322b837a4`. Its first failure is strict TSC exit1 in phase stage-build; source generation exit0 preceded it. Its actual counts are2build children,0fixture conversions,0identity digest calls,0reference starts,0World calls. No passed or failed runtime prefix is replaced. The original summary pin is `dbf7bf92eb4772b0448c3c2aacf8d22661076be9e90a365027334c900cfbf68c`.

Authorized changes only:

1. Candidate zero-return has one extra erased assertion: `[...body.angularVelocityRadps] as Vec3`. Removing the8ASCII bytes ` as Vec3` recovers the entire old3893B candidate SHA `9dbc7554c87e6eee0850fd1dfb66b2b990e78f8168cab9d0b57da20c51001bab` exactly. The copied array and every mathematical expression/operation/order remain unchanged. Source-only TypeScript AST comparison is equal after removing AsExpression wrappers. No emitted code was generated for this proof.
2. The staged strict NodeNext/ES2022 configuration uses `types:['node']` and `typeRoots:[freeze.tools.nodeTypeRoot]`. Existing strict/noEmitOnError/skipLibCheck/libES2022 settings remain. No DOM or hand-written global stub is added. TOOLCHAIN-PINS-02.json pins354actual installed tool/declaration files: original218 plus136canonical Node26.6.4/undici8.9.0 declaration/package files. Runtime remains frozen Node22. The runner requires the exact root, its realpath, node/package.json, and every354entry to equal the already-authenticated freeze tool pins. Each actual TSC --listFiles input outside staged src still needs an exact tool pin; a numerical implementation fallback remains forbidden. Temporary duplicate declaration metadata is explicitly released after preflight.
3. Build logs now retain only nonempty copied prefixes via Buffer.from. Once the existing1MiB per-child combined stdout/stderr cap is full, no view or empty log element is retained. Overflow still stops the same child. No physical count, deadline or cap changed.

The driver and plan now require the new Ready02 and repair/toolchain authorities in the fresh execution freeze. Original Ready01, contract/cases, reference/protocol/math, overlay, production source and old evidence were not edited. Expected20constructors/1688accepted/1708attempts/40reads/20disposals,1710reference requests/1708audits, and2identity DATA calls remain fixed.

Author checks, with zero provider evaluation/conversion/build/reference/World:

- Heavy gate `g1-compile-repair-02-author`: Node22 --check driver PASS. The candidate exact byte-reversal SHA check PASS. The subsequent AST-check helper failed because its signature included SourceFile.text, the entire source string, before comparing the stripped tree. Error: AssertionError ERR_ASSERTION at the deepEqual signature assertion. Gate/load output: go after0s, load12.39, slot1of3; command exit1. This is an author-check defect, not a candidate/runtime result. The tool transcript retains the failure; its large assertion output was returned truncated. No claim is made that a complete raw stderr artifact was saved.
- Heavy gate `g1-compile-repair-02-ast-correction`: only the failed AST helper and the previously unreached metadata assertions ran. Signature now records text only for identifier/literal leaves, not SourceFile.text. Candidate8-byte reversal, AST equality ignoring AsExpression, driver AST parse,354tool metadata and unchanged ledger assertions PASS. Gate/load: go after0s, load12.21, slot1of3; exit0. No emit was performed, and the passed Node syntax check was not repeated.

No numerical result is claimed. Parent must review the narrow diff and freeze a fresh `g1a-repair-02` before any build or runtime. STOP after READY.
