# Root-only preparation and fresh campaign commands

The author did not execute these commands. Actual authority preparation has its own Root receipt. Do not mutate prepare-authority.py while its Root command runs. All output targets are exclusive; preserve any failure and use an explicit new revision rather than overwrite evidence.

Qualified actual inputs for this revision are newlibrary run-02 and canonical-stationary-02/reviewed-provenance.json. Rejected canonical01 remains historical and is not an input. Provider digest uses declared provider-only ordered compact JSON; every helper is separately authenticated. Actual canonical28-module emission-parity.json and AST-copy guard are required inputs. Original old complete723 PINS remains immutable and is copied into the NEW folder baseline.

```sh
python3 examples/physics-stack-stationary-complete-2276/prepare-authority.py \
  --run examples/physics-stack-stationary-library-2276/evidence/run-02 \
  --canonical examples/physics-stack-stationary-library-2276/evidence/canonical-stationary-02/reviewed-provenance.json

python3 examples/physics-stack-stationary-complete-2276/prepare-pins.py \
  --run examples/physics-stack-stationary-library-2276/evidence/run-02 \
  --canonical examples/physics-stack-stationary-library-2276/evidence/canonical-stationary-02/reviewed-provenance.json \
  --base-pins examples/physics-stack-complete-2276/PINS.json
```

Root runs both with the pinned Python executable under its command guard/heavy-IO gate. Authority output is AUTHORITY.json. The pin builder writes baseline byte copies, explicit INPUT-SELECTION.json, new PINS.json and SOURCE-SEAL.json. No solver, World, reference, build or compression operation occurs in the pin builder; only the authority builder performs bounded gzip DECODE of actual own record pieces. Signed-zero ALLword digests are actual live Source/Native report evidence, not inferred from JSON0.

The pin builder omits old canonical-opt providers, runtime-opt future frames, old library run goldens, old pipeline authority PINS and ended codec folders by explicit filter lists; INPUT-SELECTION records each old pin and reason. Original refs/tools/unchanged components retain exact old expected hashes. A changed old pin is never silently refreshed. Only explicit canonical.sources matched to actual run02 frozen-before/after may replace an old source pin. New qualified runtime/helper/checker/word/actual-source/receipt paths are then added explicitly.

After Root verifies all pins and seals, use the printed PINS SHA and fresh output directories:

```sh
# Use the exact pinned Python path from PINS.json, not a substituted interpreter.
PINNED_PYTHON examples/physics-stack-stationary-complete-2276/run.py prefix FRESH_PREFIX_OUT REVIEWED_PINS_SHA
PINNED_PYTHON examples/physics-stack-stationary-complete-2276/run.py full FRESH_FULL_OUT REVIEWED_PINS_SHA FRESH_PREFIX_OUT
```

These final lines are invocation templates, not executable qualification claims. Full refuses unless the exact new profile/source/PINS prefix passed all48 steps and three clean owners. No old QR or runtime05 golden enters new production. All caps, time boundaries, full raw RPC/JSON/ALLword evidence, first-failure rules and API NOT_RUN stay unchanged.
