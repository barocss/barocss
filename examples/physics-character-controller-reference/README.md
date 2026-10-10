# Private query-driven character movement reference

Existing parent [#830](https://github.com/barocss/barocss/issues/830), before public [#1064](https://github.com/barocss/barocss/issues/1064). Frozen before code in6092634930, positive snap path clarification6092671506 and proof/control addendum6092784749. The actual public query is adopted at49372f48; no query dependency wait or pending-UI gate. This example adds no public controller or package/kernel code.

Eight fixed scenes: originalREST/FLAT/STEP10/SLOPE15 plus HEADROOM/TOO_HIGH15/WALL_SLIDE/SPAWN_OVERLAP. Fixedupright r.15/half.35,dt1/120/240steps,skin.002/snap.02/step.1/slope10/preview.152/down.12/slides4/queries32/assist20frames. Stepassist and stoppinggravity at a blocked steepcontact are explicit gameplay policies, not rigid force physics. Preview never commits extra requested horizontal distance. Actual queries support each committed segment, including positive-Ysnap, with atomic acceptedstate and separate rejectedattempt diagnostics.

## Modules

- fixture: frozen browser-safe sourceDTOs/startposes/requests.
- constants/query/slide/controller: small private policy/actualpublicqueries/state/lifecycle modules.
- controls: actual malformed/stale/dt/step241/copied/disposed/fresh/secondtouch/assistrequest/publicquerybound refusals plus explicitly labelled internalbudget/slide/numeric/assistcap retention.
- metrics: independent Hamilton/piecewise geometry and full241state/trajectory/predictor/queryevidence/behavior checks; no candidate import.
- campaign/entry/run: exact repeats/provenance/conditionalcostgate/data capture.
- binary/decode: completeoriginalLE/SHA/numeric-state/query/ID/error sidecars and independent fullpose/hit-witness/metric replay. Decoder imports no candidate policy/controller.

Node22, onlydeclaredlocalworkspace links. No sourcealias or customcondition. Current APIs source defaults need the standard TS transformer used by the example.

```sh
node examples/physics-character-controller-reference/setup.mjs
node examples/physics-character-controller-reference/run.mjs /tmp/character-model
node examples/physics-character-controller-reference/decode.mjs /tmp/character-model/manifest.json
```

Allseven acceptedscenes must complete240steps and pass everyfrozen gate. Onefull240stepwarmup thenthree serial240steptrials, everyp95<=8.33ms, onlyafterallnumerical/controlgates qualify; conditionalactualbrowserfollowsonlythatGO. No selective passing subset, targetretune or arbitraryterrain/controllerpublicationclaim.

## First observed result

Dirty-source firstflow has sixacceptedscenespassing and oneexpectedspawnINITIAL_OVERLAP, but WALL_SLIDEfails its exact2mmskin wallbound atframe180:X.29903810567665556>.298001. Allstatescomplete, zerooverlap and Zprogressabout1mpass; lackofpenetrationdoesnoterase the frozen skinfailure. FullmodelNO-GO, conditionaltiming/browsernotrun. Preserve firstreport and subsequent complete raw state/trace proof. Laterchanges add rejectedattemptdiagnostics/internalproofcontrols/exact8.33comparison, withoutchanging primary8inputs or movementpolicy. No new passing model is selected here.

## Canonical native result

Clean measured source `923828e3e6c2cdb4074d83a40772239b97cafbf7`, parent `dc6f5006a4603ff9729c867deae341cc9b087b13`. Node22.22.0 actual esbuild source flow resolves29 owned source files and0dist; ordinary public source query, no alias/custom condition. All new ESM modules passed Node syntax checks. No package source/build rule changed. The same seven scenes complete240steps; six pass and WALL_SLIDEfirstfails frame180 X0.29903810567665556 >0.298001. ExpectedspawnINITIAL_OVERLAP passes. Exact two-run poses and raw bytes match. Twelve control records plus copies/getters0/step241/dispose/fresh pass; internalcap/faultcases remain private controls.

Independentdecoder checks8cases,1687acceptedstate records,2364hitwitnesses and819000 complete LEbytes. Original four scene inputs are independently reconstructed from the older reference; extra scene formulas/counts and full pose/trace/metric buffers are replayed without importing the candidate. Input1488bytes SHA256 feda47adb6facf25db155ea6ae7d25451d3bc6f2c214b21b94e71c8fc6c1b1ad; output817512bytes SHA256 ee25acf34dfece215992eca012e8abaf54b8feea24184799983a0bc0b4f84b74. Canonical raw bytes equal retained working bytes; no negativezero offsets occurred.

`evidence/clean/report.json.gz` stores the complete canonical report losslessly. To replay it, copy the clean evidence into a separate temporary directory, decompress report.json.gz to report.json there, and run decode.mjs against that directory's manifest.json. The working and first dirty reports stay as history.

The frame180 requested sweep returnsnull while its final wallgap is only0.0009618943233444m. At181 the wallhit fraction0.1332839871635743 supplies a normal[-1,0,0], but safeFraction clamps0 and only Z travel commits. **Inference:** reactive skin subtraction at the first physical hit cannot reserve skin on a preceding clear move. Zero overlap, Zprogress~1m and passing stair/slope cases do not qualify the failed skin gate. ModelNO-GO; costUNMEASURED, conditionalbrowserNOTRUN, actualViewerNOTRUN, publiccontrollerNOTIMPLEMENTED. A successor requires a separate830pre-code contract; do not modify these frozen constants, inputs or first result.
