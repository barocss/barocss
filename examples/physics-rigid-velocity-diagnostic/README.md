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

Actual original CAD/Physics builds and strict private types exit0. Sole producer campaign exit0 at92402adde03af1c9b37619bcd105d22c497d4e3b: source, unchanged repeat and genuine compiled-helper graphs reproduce1,488accepted snapshots and10,467copied phase frames. All accepted raw bits/public fields/projectionstats/reference decisions preserve the originalOFFSETfirstfloorfailure495. Source39originalsrc/0dist vscompiled0src/21dist; privateworld/module remain source. Trace raw SHA256 is666bbb665f164c5d8bc611d54f426475b2e0f2f73a943dfe5a083d66945dbc94in allgraphs. Recorder snapshotmutation cannot change owned copies. Independent offline analysis at6ca34149 exits0, diagnosticValid=true/physicalModelGO=false; allraw/order/counts/continuity/endpoints/copy/position-only invariance and Decimal80/120 component/speed/energy precision pass.12analytic controls PASS. First analyzer237f4318 exits1 on a nonexistent summary scene-field assumption; firstINVALID log/report retained, corrected graph-schema seal357965a9, no producer/numericalthreshold change or modelrerun.

At step15/pass0, b2/b3 has a2point manifold while the previous cache has4points. Its warmstart changes b3 angularspeed .017612644 ->1.261174263rad/s; vector delta norm1.278706836rad/s. The unchanged pointresponse reduces it to~.114964862rad/s. Then b3/b4 warmstart/response changes it again. All originalpairposition/globalprojection stages preserve angular/linear/orientation fields. No singlepointfallback occurs in the traced864pair decisions. This locates the earlier b3/b4-associated symptom in a preceding b2/b3 warmstart stage. It doesnot prove a cache defect, energy law or origin of eventualfloor escape.

All raw/fullreports/sourcegraphs/compiled hashes/firstINVALID/finalanalysis/controls and manifest are retained in evidence/native-92402add/. The next justified private question is whether cross-step impulse reuse only for an identical complete manifold-ID set can pass the original fullmodelgates; no policy or model change is implemented here. No refinement/cost/Chrome/Viewer/publication follows this diagnostic.
