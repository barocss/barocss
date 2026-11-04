# Pure command timeout continuation 02

Status: AUTHORED_NOT_EXECUTED. The original AUTHOR-FREEZE-01, its400 pins, original scripts, bank01 and failed build01 remain unchanged.

Root's actual data bank01 passed in668.05275ms with zero candidate/World calls. Its bank is5818bytes, SHA256 `58371a5b250845a664fbc501e7f4f13d93d98cf191e33a94afede7bc16b6a514`. Build01 then failed in427.329583ms before any compiler/helper/World call. Its original result has commands[], candidateCalls0 and WorldCalls0. Node rejected a floating spawnSync timeout: `ERR_OUT_OF_RANGE`, unsigned integer required, received179978.814708. This is a command-setup failure, not a kernel/physics failure. The complete original result and stack remain under evidence/build-01.

The only timeout change is in NEW build-pure-02.mjs and run-pure-02.mjs. Each affected spawn computes `Math.floor(180000 - elapsedMilliseconds)`, refuses when the result is not positive, and passes that integer to spawnSync. It never rounds up, resets the original command deadline or substitutes1ms after expiry. Both compiler/bundler spawns and the pure runner's audit spawn use that rule. maxBuffer, captured output, all work/precision/physics gates and the original180s limit remain unchanged.

Build02 authenticates original author pins and new CONTINUATION-FREEZE-02 pins before work. It copies the exact already prepared build01 stage into a fresh output, checking every copied byte against the continuation seal. It copies the original math-manifest byte-for-byte and proves the same source/entry digest. Only generated compiler path settings change from build01 to build02 output locations. No compiler command was paid in build01; build02 starts the first actual strict compile. Source sources, static/dynamic helper bytes, entry exports and import paths remain unchanged.

CONTINUATION-FREEZE-02 binds the original author file and all400 inputs, unchanged actual bank01, complete failed stage/config/manifest/result, new02scripts/protocol and original bank/build guards. Build result and provider-pins explicitly carry BOTH originalAuthorPin and continuationPin. Runner02 authenticates both seals, build result, provider pins and unchanged bank before import. It cannot claim the old author seal alone covers the new scripts.

Root command sequence, each under the existing guard:

```
node examples/physics-coupled-dynamic-2276/build-pure-02.mjs build-02
node examples/physics-coupled-dynamic-2276/run-pure-02.mjs bank-01 build-02 source-01 source
node examples/physics-coupled-dynamic-2276/run-pure-02.mjs bank-01 build-02 native-01 native
python3 -B examples/physics-coupled-dynamic-2276/pure-parity.py source-01 native-01 parity-01
```

Do not regenerate bank01. Stop before the next command on the first unexpected failure. All original per-input audits and fixed refusal literals remain unchanged. A full pass still requires11coupled +2directstatic calls,13top-level/underlying-static calls per graph; partial actual counts remain partial. World calls remain zero. General arithmetic banks remain NOT_RUN and runtime World promotion remains BLOCKED. Author checks are syntax and hash/file reads only; no compiler, decoder, math, reference, audit, World or browser is executed by the author.
