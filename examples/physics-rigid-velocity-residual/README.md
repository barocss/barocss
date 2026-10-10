# Held-row contact velocity residual (#1209)

This private offlineconsumer measures contact-row residuals from adopted1197data. It doesnotstep a world orchange a solver. Original1191and1204failedmodels remainNO-GO. Selecteddata isoriginalOFFSETstep15,b2/b3andb3/b4,passes0–7.

residual_math.py defines the rigid pointvelocity equation, heldnormalrow, tangentspeed/complementarity and exact velocity/geometry decomposition in caller-selectedDecimalprecision. analyze.py consumes originalraw117LEFloat64components/frame, metadata and hashmanifest; it reuses the sealedoldphaseinput validator and preserves originalfirstINVALID/finalPASS. EqualrecordedpointIDs areobservedlabels, notpersistentfeaturecertificates.

Run withPython3:

```sh
python3 examples/physics-rigid-velocity-residual/residual_math.py --self-check
python3 examples/physics-rigid-velocity-residual/analyze.py /tmp/physics-1209-canonical
```

The observer seals hashes before the actualrun. Everylocal/held/translated/refreshedterm is compared atDecimal80/120 within1e-25. It reports rawclosing values and1e-10descriptiveband, not a newphysicalqualitytarget. New/removedpoints andfallbacklimits stayexplicit. Data/resultparity requires all3oldsource/repeat/compiled-helperarchives. No newCAD/Physicsworldbuild/numericalsimulation/Viewer/fileproof.

Currentresult UNMEASURED. Native result/evidence are recordedafter actualexecution. No productpush/PR/publication.
