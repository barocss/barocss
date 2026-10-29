# D344 immutable native quadrature diagnosis

Baseline publishedD343 c0fea1174f71fc4f9e83ac4f53978d09884e0ef1. No product edit/build/benchmark was performed for this diagnosis; current source/dist hashes are source-before.json/source-after-diagnosis.json, exactly unchanged. Inputs are the accepted D343run03 b7 native B-rep, not a reconstructed or rounded display body. Input JSON and full original native provider observations are preserved. Heavy gate RELEASED after each short serial probe. No first harness failure occurred in this phase.

## Confirmed results

Untouched production provider reproducesV6.180191251439208e-15/C[.10042170557247179,-.26839177431837347,.3456789000000001], methodquadrature. Independent strict native validity and original geometry mesh are in baseline.json. Instrumented source-bound provider agrees exactly with untouched currentdist mass. Actual branches are2wholePatch curved sides and2planar caps, meshedfalse,572side nodes. Original late body-globalcenter is[.1234567000000002,-.23456779999999977,.3456789000000001]. Native source arrays remain byte-equivalent after observation; no author or private geometry mutation.

At the SAME actual stored parameters and composite Gauss weights, independent Python Fraction arithmetic gives:

- exact quadratic/linear Bernstein bases + exactnativeP*w: V6.2781632964155324e-15,Cxy[.12345670000000014,-.23456779999999963]. Every native paired ruling has exactSu.z=0,Sv.x=Sv.y=0,Sv.z=h=2.220446049250313e-16.
- observedroundedN/D as exact rationals + exactnativeP*w: same convertedV/Cxy; maximum deviation of exactSv.z fromh5.55e-17relative, consistent with tiny basis rounding.
- observedroundedN/D + OBSERVEDproductionPw arrays, with remaining sums/quotients exact: V6.382222331984455e-15; maximumSv.z relative error2.5126%. The absolute homogeneous multiplication already perturbs the tiny height.
- OBSERVEDproductionR/Ru columns, with remaining quotient/field exact: V6.180191251439208e-15,Cxy[.10042170557247193,-.26839177431837374], reproducing the actual scalar failure and tangent bias to final floating arithmetic. MaximumSv.z relative error27.9611%. Remaining quotient rounding contributes at most1.73e-16relative at these nodes.

This establishes pre-accumulation homogeneous weighted-product and U-column-sum conditioning for the captured whole-patch fixture. It does not establish a universal root cause for every B-rep/evaluator, an exact-circle theorem, or improved central inertia.

## Oracle boundaries

oracle.py imports no CAD code. It decodes finite JSON binary64 values to exact Fraction, independently evaluates quadratic Bezier and V-linear bases at actualstored u/v, and separately treats observedbasis/Pw/R/Ru as exact inputs. All reusableproduction arrays are copied in the trace. ActualPw is observed, not assumed from another runtime. Node output trace includes actualpoint/partials/normal/weights; complete source instrumentation and esbuildmetafile are saved.

The exact reconstruction here sums sideV/X/Y at stored compositeweights. It does not certify all11fields, independent multiplication of Gauss factorweights, area sqrt, raw-to-central inertia or exact pi. The roundedπr²h guide agrees with exactnodeV within7.8e-16relative, but radial residual alone would not certify material area without winding/coverage. No such globalgeometry claim is needed for this arithmetic diagnosis. Sidewise and planarcap contributions are separately recorded in baseline.json.

## Minimal proposed correction and coordination

Root approved body-globalcenter subtraction before forming Pw, then a private localfield accumulator called directly by patchPoint using LOCALprojected coordinates. Existingworldpoint accumulate wrapper subtracts the SAMEglobalcenter for all planar/trimmed/mixed callers; fromCentre remainsonceperclosedbody. Samequadrature rules/bases/knots/method/fallback/density/error/sourcearrays. No per-face closedbody translation formula is valid for an openface contribution and none is proposed. No centroidclamp/volumefudge/newminimum/tolerance is proposed.

Owned future files: src/brep/brep-mass-quadrature.ts, test/native-quadrature-conditioning.test.mjs, test/helpers/native-quadrature-oracle.mjs, optional immutable capturedfixtureJSON. Production source remains OLD/FROZEN pending Mediumperformancebaseline completion and explicit rootedit signal. Root/Medium own benchmark/fullgates/ModelStudio/STEPconsumer and publication. Performancebench NOT_RUN here. Centralinertia/extremegeometry/sharedsurfaceD1 remain outside scope.
