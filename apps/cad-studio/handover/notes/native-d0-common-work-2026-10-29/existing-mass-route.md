# Existing Part mass route — read-only source evidence

No code, probe, test, browser or qualification change. Explorer source inspection only.

Part.mass(density) in part/part-model.ts:735 is retained by outputState/makeOutput(:4446).
massPropertiesOf(:4463) prefers that kernel Part callback. A new provider registry/schema is
unnecessary. Example revolve feature(:1444) pairs an actual B-rep with a mass function but
its current revolveMassProperties rejects native SI basis; it is not the SI retention example.
features/loft.ts:196 instead returns a mass callback using solidMassFromIntegrals, consumed
by the loft Part feature(:1930). solidMassFromIntegrals in brep/solid-mass.ts:36 records the
pre-MMGS centered integrals. internal/native-si-mass-state.ts transfer(:19)/read(:30) retain
that basis; copying public MMGS properties alone cannot reconstruct it.

Document save/load(part-model.ts:1121) saves recipes and evaluates them again. Runtime mass
functions/WeakMap state are not serialized. Reconstructed output without state falls back
to B-rep mass. surfaceAreaOf(:4469) still calls brepSurfaceArea, independently of Part.mass.
Model engine/evaluate.ts:179 uses the existing kernel area result or display fallback.
Translation movedMass(:3904) retains the basis; rotation/scale need their own qualifications.

All line pointers refer to the current source at the D308 inspection window and may move.
This source route does not qualify actual wrap closedness, literal B-rep/reference mass, SI
accuracy, Part provider wiring or product acceptance. Those D306/D307 false flags stay false.
