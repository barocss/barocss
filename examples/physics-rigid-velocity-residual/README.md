# Held-row contact velocity residual (#1209)

This private offlineconsumer measures contact-row residuals from adopted1197data. It doesnotstep a world orchange a solver. Original1191and1204failedmodels remainNO-GO. Selecteddata isoriginalOFFSETstep15,b2/b3andb3/b4,passes0–7.

residual_math.py defines the rigid pointvelocity equation, heldnormalrow, tangentspeed/complementarity and exact velocity/geometry decomposition in caller-selectedDecimalprecision. analyze.py consumes originalraw117LEFloat64components/frame, metadata and hashmanifest; it reuses the sealedoldphaseinput validator and preserves originalfirstINVALID/finalPASS. EqualrecordedpointIDs areobservedlabels, notpersistentfeaturecertificates.

Run withPython3:

```sh
python3 examples/physics-rigid-velocity-residual/residual_math.py --self-check
python3 examples/physics-rigid-velocity-residual/analyze.py /tmp/physics-1209-canonical
```

The observer seals hashes before the actualrun. Everylocal/held/translated/refreshedterm is compared atDecimal80/120 within1e-25. It reports rawclosing values and1e-10descriptiveband, not a newphysicalqualitytarget. New/removedpoints andfallbacklimits stayexplicit. Data/resultparity requires all3oldsource/repeat/compiled-helperarchives. No newCAD/Physicsworldbuild/numericalsimulation/Viewer/fileproof.

Actualrootarchivedinputflow at36723a7b exits0: allthreeoldarchivegraphs/data/raw/order/endpointgates andnewrowresultparitypass.51kinematicanalyticcontrolsPASS, allDecimal80/120row/decompositiontermsagree<=1e-25.16selectedpairvisits/52localrows/44matchedrefreshrows pergraph.2,938closing-held-frameobservations include repeatedsame-rowstates; theyare notuniqueevents. Localnormalcomplementaritymaximum1.356918815e-5m/s is anobservation, not a newsolverGO.

Named b2/b3pointb2:1:1:0 afterresponse(step15/pass0) hasu=+9.255459713e-6m/s. Holdingthatrow, neighboringb3/b4warmstartmakesu=-.3645946871; neighborresponseendsat-.05222741137. Theirtranslated-armcontributions atthoseframes are~4.34e-19 and-2.96e-20m/s, respectively. Thisdirectlyidentifiesneighborvelocitychange before anyfreshrow geometry isused. Itdoesnotcertify a solvednormalconstraint, force accuracy, or eventualescapeorigin.

A matchedb3/b4point1pass5→6fresh-row comparison hasvelocityTerm=-.09192187761m/s andgeometryTerm=+.07518889276, total=-.01673298485, identityerror4e-121. MixedgeometrycontributionunderrecordedIDmatchingis measurable; equalIDs are notprovedpersistentfeatures. Allheldrows remaininvariant atposition-onlyphases. No guarded1204causaltransfer/newworld/modelquality/refinement/cost/Chrome/Viewer/productbuild. PhysicalModelGO=false.

Fullnewmathoutput/log/controls/namedrows/provenance/hashmanifest are in evidence/native-36723a7b. Originalinput/firstINVALID/finalPASSremainin adopted1197files. No productpush/PR/publication.
