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
