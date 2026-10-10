# Rigid response velocity diagnostic (#1197)

Parent1191 is adopted at63aeed09; its three modelNO-GO results remain unchanged. This experiment copies the caller-configured privateworld and only records phases. It changes no solver/publiccap/API/material/order. Pre-code freeze6095298824 seals the world, recorder and unchanged position module hashes in frozen-hashes.json.

Only OFFSET acceptedsteps14/15/16 receive traces. Each has36pairs*8passes*4phasecopies plus11checkpoints, exactly3489frames/graph. Intermediatecontacts/events are empty placeholders; actual hit/manifold/previous-currentcache metadata is separate. No-hit and combinedfallback paths are explicitly labelled. Recorder copies/freeze its data and accepts no caller callback.

The root producer checks all496originalaccepted OFFSET states/raw13LEFloat64components/signbits/projectionstats/firstfloorfailure495 against immutable1191data across source/repeat/genuinecompiledhelpergraphs. The privateinstrumentation remains source in bothgraphs. Independent offlineanalysis reads copies only; event location is not proof of eventualescape origin or defective force/material response. PhysicalModelGO remainsfalse.

## Run

```sh
export PATH=/Users/user/.nvm/versions/node/v22.22.0/bin:$PATH
REPO_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration node examples/physics-rigid-engine-reference/build-local.mjs
pnpm exec tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck examples/physics-rigid-velocity-diagnostic/instrumented-world.ts examples/physics-rigid-velocity-diagnostic/trace.ts examples/physics-rigid-velocity-diagnostic/position-relaxation.ts
node examples/physics-rigid-velocity-diagnostic/run.mjs /tmp/physics-1197-canonical
python3 examples/physics-rigid-velocity-diagnostic/phase-analysis.py /tmp/physics-1197-canonical
```

## Current result

UNMEASURED. Original affectedbuild passes. Stricttypes/actualcampaign/offlineanalysis are recorded after execution. No refinement/cost/Chrome/Viewer/publication follows this diagnostic.
