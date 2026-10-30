# D306 formal one-pad reference mass — 2026-10-29

Runtime 2ab2f6a67b2ce03f0c993fa0cb257703c0341f98 adds a private reference calculation only. No Part mass provider,
Model/API/Studio wrap command, physical closed-solid qualification or literal stored-B-rep
mass is added. Original07->08->09 remains unchanged.

## Exact target and returned Number audit

The reference is the formal native circle cylinder C(R,z0,z1) union one ideal scale2 annular
sector. A fresh current-source adapter derives R, actual quarter coefficients and original
UV domains from the actual Part. Endpoint polar rays use those exact stored homogeneous
quadratic coefficients; they are not assumed to be textbook quarter-circle angles. One
strict interior no-hole UV rectangle supplies its exact affine source-Z interval.

Signed outward fixed128 intervals enclose pi, endpoint angles/cosines/sines and all10 raw
moments[V,X,Y,Z,XX,YY,ZZ,XY,XZ,YZ].24 alternating atan terms at<=1/5 include the positive
x^49/49 tail. At most3 exact tangent-subtraction reductions suffice; Machin's pi/2 identity
and guarded integer square-root normalization avoid Math trig as authority. Source moments
use the formal circle; pad radial factors are3R^2/2,7R^3/3,15R^4/4. Added volume lower>0.

Moments use source-midheight coordinates before existing solidMassFromIntegrals performs
the actual MMGS Number calculation. Returned centroid is translated; retained native mass
basis transfers unchanged. Every returned volume/mass/centroid/inertia Number is audited
against the exact interval target, including density/1000 and all Number rounding. Mandatory
positive finite per-scalar absolute error budgets refuse rather than widen. Positive mass
and diagonal inertia cannot underflow; the existing density*1000 SI intermediate must remain
finite. Native SI accuracy stays false; this is no global SI-reader repair.

Representation metadata is explicitly selectedQuarterRadial and selectedQuarterOuterRadial,
not a global source bound. The latter is exactly twice the former. Both remain excluded
from mass-evaluation error; reference-to-actual-solid mass transfer is not proved here.

## Ledger and independent verification

One200k/8192-bit/1048576-work ledger imports actual source q+direct cost once. Source work
is carrier.work+q.operations+q.gcdSteps+q.floatSearchSteps; carrier direct work is already in
carrier.work. Local q operations/GCD/float-search, direct and structural work are added.
check() and the receipt share totalWork(). Independent review found the first draft omitted
local/source work categories; the corrected source was applied before the first build.
The source adapter has no remaining-budget input and validates current producer B-rep with
legacy Number routines. Accepted cumulative counts fit the cap, but this is not an instruction
count for its reconstruction or sampled checker. No source cap or entity tolerance increases.

Independent256-bit/160-term atan and pi/4=atan(1/2)+atan(1/3) oracle, generic expanded
Bernstein endpoint evaluation and complex Laurent angular integration test all10 source,
pad and total moments plus every public scalar. Density conversion, negativeZ, asymmetric
V, translation, exact centered zeros, diagonal rays, malformed/getter/alias/source changes,
budget tightening and overflow/underflow are included. No source-checksum unit test.

Node22.19.0 first build/lint/code-shape pass. First focused24/24 passes (446.519541ms).
Whole kernel2154 total/2148 pass/0 fail/6 existing skips passes (248076.145209ms).
Tools/refusals/unchanged API SCOPED_PASS/docs68pages/53shots/4488KiB/852labels pass.

The standard separate U[1/16,5/16]xV[1/4,3/4], R10/H30/Z0 request uses40919 operations
(source11544, rational26369, direct3006),69733work,1153bits. Its formal volume is
11244.548522905354 and density1 mass11.244548522905355; exact errors are in the receipt.
The distinct negativeZ=-7, U[.1,.4]xV[.2,.7], density7.85 request uses52029 operations,
89192work,1153bits. These are separate requests. Native position binding is not included.
The D305 standard native179831 plus mass local29375 would exceed200000 even before new
reference work; no combined-budget acceptance is claimed or hidden retry added.

Existing D305 full native result/counts match, including all64-bit Number values. Model/
Studio/types/browser/performance NOT RUN for D306; latest whole consumers/types remain
D299901b4ce45. No push/PR/release. Next D307 measures a fixed128 midpoint conversion
optimization with the required perf-bench before/after and full receipt bit preservation;
then actual closed-reference/global closure and cumulative integration remain necessary.

One evidence script first omitted its destination environment variable and reported an
ERR_INVALID_ARG_TYPE from writeFileSync(undefined). The two formal mass requests had already
completed successfully; only the native-prefix evidence write failed. The unchanged script
with its explicit destination passed. The original diagnostic is retained adjacent.
