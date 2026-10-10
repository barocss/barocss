# Private rigid position relaxation reference (#1191)

This caller-configured experiment tests one additional position-only stage after the original eight response passes. It does not extend the public Physics cap or provide a new API. Parent #1188 is adopted at8df9b338; its observed neighboring correction chain and original #1185 NO-GO remain unchanged.

The exact pre-code contract is [6095156451](https://github.com/barocss/barocss/issues/1191#issuecomment-6095156451). `frozen-hashes.json` seals the copied orchestration and separate32sweep module. Original21helper hashes and all fixture/reference thresholds are checked before bundling. Public contact metadata records the original response; private copied projection stats describe only the additional stage. Both private modules remain source when the original helpers use genuine compiled output.

## Run

Use Node22.22.0 and Python3 Decimal. Original builds require an already installed dependency checkout:

```sh
export PATH=/Users/user/.nvm/versions/node/v22.22.0/bin:$PATH
REPO_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration node examples/physics-rigid-engine-reference/build-local.mjs
pnpm exec tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck examples/physics-rigid-position-reference/reference-world.ts examples/physics-rigid-position-reference/position-relaxation.ts
python3 examples/physics-rigid-contact-reference/geometry-reference.py --self-check
node examples/physics-rigid-position-reference/runner.mjs /tmp/physics-1191-canonical
```

Runner executes the actual original two-box one-step control and three8box inputs in source, unchanged repeat and compiled-helper graphs. It captures all13little-endian Float64 components/body, sign bits, public fields, projection stats and independent80/120digit geometry. Each scene stops at its first failed accepted state. A failed base model forbids refinement/cost/Chrome or parameter tuning. A passing base alone is incomplete: frozen refinement, timing and actualChrome remain required. Node proves no Viewer screen, file or recovery flow.

## Current result

Original build and strict private types pass. The first source trial has model NO-GO in all three scenes: ALIGNED step913/7.6083s, OFFSET step495/4.125s, YAW step618/5.15s. Each first violation is a cube footprint outside the finite floor. All observed pair penetration through those failures remains below2mm; that improvement alone is not stable-stack qualification. No exact8s/last2s reference is reached, so those gates remain unexecuted. Sole root campaign exit0, measured26a4966ae1c0976637acc9a89fb2110a6e75bdbd: all9cases/6,087accepted snapshots reproduce raw fields/public metadata/projection counters/geometry/firstfailure across source, unchanged repeat and genuine compiled dependencies. Source39originalsrc/0dist; compiled0src/21dist. Private world/module stay source. Original65geometry and6two-box analytic controls pass. Actualtwo-box steps, constructor/snapshot/statcopy,10unsupported-input refusals and INVALID_STEP/INVALID_COMMAND/NUMERIC_LIMIT acceptedstate+statretention/disposal pass. Durable artifacts, full reports, raw bytes, logs, graphs, source/compiled hashes and manifest are in evidence/native-26a4966a/. Refinement, CPU timing, Chrome and Viewer are forbidden by the failed base. No tuning or product push/PR/publication.
