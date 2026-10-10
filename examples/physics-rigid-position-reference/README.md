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

UNMEASURED. Original build and strict private types pass before the first trial. Native result and durable evidence will be recorded below after actual execution. No product push/PR/publication.
