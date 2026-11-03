# Strict consumer setup continuation 02

Status: AUTHORED_NOT_EXECUTED. Original eight TS files, author531 seal, original build script/stage/config/logs/result, independent bank/reference files and actual materialize01 output remain unchanged.

Root materialize01 passed in206.604ms. First build01 failed in611.587ms in its first actual strict compile. TS18048 at test-entry.ts:74 reports callback-local core as possibly undefined. No candidate/test-entry/World call occurred. This is a preserved strict typing setup failure, not an arithmetic result.

NEW test-entry-02.ts changes only `map(value=>core.parsed(...))` to `map(value=>core!.parsed(...))`. The assertion is erased by TypeScript and expresses the existing initialized-core control flow. No formula, runtime guard, admission, expectation, operation/counter price, cap or precision changes. The original test-entry.ts remains intact. A source-text identity assertion in new build-02.mjs verifies exactly this one-token delta before work.

NEW build-02.mjs authenticates all original AUTHOR-FREEZE-01 inputs and CONTINUATION-FREEZE-02 inputs. It copies test-entry-02.ts to the fresh stage's logical test-entry.ts path; all other source paths/bytes and strict/consumer/source/entry-graph checks stay unchanged. Both result and provider-pins record original authorPin AND new continuationPin. The stage math manifest binds actual new test source bytes, so it does not pretend the original author covers that added file.

Root reuses actual materialize01 bank/result without regeneration. The old run-production/run-tests/parity files remain unchanged. Root must authenticate the continuation seal/provider and original author before EVERY subsequent guarded command; those unchanged runners authenticate the original author and actual generated provider files themselves. Root's extra continuation check is mandatory, not an assumed old-author guarantee.

Resume:

```
node examples/physics-coupled-arithmetic-2276/build-02.mjs build-02
node examples/physics-coupled-arithmetic-2276/run-production.mjs build-02 production-source-01 source
node examples/physics-coupled-arithmetic-2276/run-production.mjs build-02 production-native-01 native
python3 -B examples/physics-coupled-arithmetic-2276/production-parity.py production-source-01 production-native-01 production-parity-01
node examples/physics-coupled-arithmetic-2276/run-tests.mjs materialize-01 build-02 production-parity-01 arithmetic-source-01 source
node examples/physics-coupled-arithmetic-2276/run-tests.mjs materialize-01 build-02 production-parity-01 arithmetic-native-01 native
python3 -B examples/physics-coupled-arithmetic-2276/test-parity.py arithmetic-source-01 arithmetic-native-01 arithmetic-parity-01
```

Each command retains original180s/16MiB bounds. First failure stops later commands. Production13/cap16 and separate private52/cap64 remain unchanged;65pergraph is reported only after actual completion. No runtime promotion follows setup success. Author checks are source text, syntax and hashes only: no compiler, materializer, core math, audit, reference, decoder, World or browser execution.
