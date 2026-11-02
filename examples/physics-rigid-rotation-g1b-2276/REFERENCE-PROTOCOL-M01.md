# G1b Phase M reference protocol

Author-only; no runtime is authorized here. CLI:

`python3 -B reference-micro.py --run-id FRESH --freeze ABS --token SHA256 --out ABS_FRESH_REFERENCE_DIR`

Freeze status PARENT_AUTHORIZED_G1B_MICRO, mode G1B_M_STAGED_ONLY, phase M, runtimeAuthorized true, phaseTAuthorized false, productionActivation false, matching runId. Require complete actual repo-relative files, absolute toolFiles and actual tools.python, and approved pinned highReview. Authenticate the unchanged pure baseline classifier/reference helpers and all G1b authoring authorities before loading their definitions. No candidate/Physics import in Python.

JSONL stdin/stdout; one pending request. Input<=262144B, output<=65536B. Physical numbers use {$f64le:16lowerhex}; stepIndex and protocol counters use ordinary JSON integers. Exact reference values are {numerator:string,denominator:string}; enclosures {lo,hi}. New artifact paths are reference-output-directory-relative and must resolve beneath fresh out. The driver authenticates bytes/SHA and saved reply-0001.json through reply-0006.json against actual stdout. Metrics are opaque physical proofs; the driver checks exact status/op/ordinal/graph/case/step/count provenance.

READY is the only unsolicited line:

`{status:'READY_G1B_MICRO_REFERENCE',protocol:'G1B_MICRO_JSONL_V1',requestOrdinal:0,runId,authoritySha256,counts}`.

Before INIT, SOURCE module initialization may perform its declared3 Math.pow calls and39 weight multiplications; copy the actual deeply frozen coefficient dataset. No World exists yet. Native candidate/world modules must not be evaluated before Source physical/helper/count/dispose PASS.

Request1:

`{op:'init',authoritySha256:TOKEN,pairRaw:{model,options},sourceCoefficientsRaw:{exponents,roots,a,b,weights}}`.

The five coefficient arrays contain actual raw F64 words, including exponents. This reference certifies only those observed Source coefficients, not unobserved Native values. It creates one independent volume-integral certificate, the3 algebraic-root certificates with512fixed rational decisions each, and two positive dt240 Taylor windows at each precision. INIT PASS precedes a Source constructor.

Reply:

`{status:'PASS_G1B_MICRO_BANK',op:'init',requestOrdinal:1,counts,bank:{path,bytes,sha256},sourceGraphComplete:false}`.

Requests2..5 are exactly Source step0,Source step1,Native step0,Native step1:

`{op:'audit',graph:'source'|'native',caseId:'M01-triaxial-off-axis',stepIndex:0|1,stateRaw,initialPrivateRaw?}`.

Only step0 must include initialPrivateRaw with exactly:

`{bodyId:'rotor',inertiaDiagonalKgM2:[raw3],orientationXYZW:[raw4],cacheSnapshotSha256:64lowerhex}`.

It is one actual admitted private Body/cache observation per World, not a new public API. The orientation words must equal that World's initial public orientation, not the unnormalized caller-model words. Actual quaternion admission normalizes before Body; M's literal identity remains unchanged. Actual admitted moments are retained as observed parameter data, compared across graphs and checked for the selected finite/positive/distinct/range predicates. Geometry-derived physical L/E and the independent reference ODE still use volume-integral inertia. Differences from the observed rounded moments are reported separately, never filled from historical expected data. The cache SHA binds this observation but is not claimed equal across different graph identities.

Reply:

`{status:'PASS_G1B_MICRO_AUDIT',op:'audit',requestOrdinal,graph,caseId,stepIndex,counts,sourceGraphComplete,metrics,artifact:{path,bytes,sha256}}`.

Every initial/accepted state receives an immediate exact-rational observed-state audit and validated trajectory comparison. After Source step1 the reply has sourceGraphComplete:true only after all reference physical gates. The driver additionally verifies its actual helper/ownership/count gates and disposes Source before Native constant evaluation. Read Native's own actual3 roots/a/b/27weights, compare every F64 word to the certified Source dataset, and stop without a Native World on mismatch. This DATA equality transfers the already-certified authority; no extra oracle/status request is permitted. The driver preserves this actual Native constant receipt; Python does not claim to observe it itself. Native initial audit is accepted only after the reference's Source-complete boundary.

Request6 `{op:'finish'}` after both Worlds are disposed. Reply:

`{status:'PASS_G1B_MICRO_FINISH',op:'finish',requestOrdinal:6,sourceGraphComplete:true,counts,bank,summary:{path,bytes,sha256}}`.

Reference exits0; driver closes stdin and requires EOF+close exit0. Exactly6requests,7stdout lines including READY,4state audits,2private observations,1bank initialization,0status/warmup/extra recovery requests. The reference's finish summary is explicitly before committing the sixth reply; its returned packet records durable request-return count6. Driver-received counts remain separate.

On failure emit at most one `{status:'FAIL_G1B_MICRO_REFERENCE',op,requestOrdinal,counts,firstFailure,artifact?}`, retain progress and first-failure proof where bounded, exit1 and do not process another request. Startup failure goes to stderr with FAIL_G1B_MICRO_REFERENCE_STARTUP. Missing/in-flight replies are UNKNOWN with the last durable prefix, never fabricated0. EOF before finish fails.

Work remains within frozen8MiB reference DATA,16MiB combined evidence and64MiB logical campaign, with170s internal/4s cleanup/180s outer. Parent/driver counts full shared artifacts and requires source-before-native. Reference reports actual rational/Decimal operations,4order32 Taylor windows, full-degree64 residual certification, algebraic512*3 decisions and observed state audits. No trig, Newton, linear solve, candidate, Physics or World call occurs in this reference. Reference Taylor integration is explicitly counted as integration. Compact full certificates include actual Context flags/settings, tube/Lipschitz/remainder/width bounds and coefficient-tree hashes; no giant duplicate coefficient matrices are persisted for each state. All current raw/decoded/interval/result/encoded roots and serialization overlap must pass the source ownership proof before READY.

Phase T, principal-bank reuse, new cases, higher order/precision/iteration/resource limits and public activation are outside this module/protocol. Source admission normalization correction is respected. Parent owns runtime and classification.

Reference ownership proof: all freeze/canonical raw+decoded pairs, source coefficient words/values/proofs, exact geometry/initial vector/diagonal, complete retained bank/initial/private metrics, current line/packet/reply/response, current interval coefficients/terms/field/residual/range/endpoint/certificate, observable extraction and full current physical proof are registered roots. The baseline working-bound traversal/scalar/ASCII encoder reserve is2MiB; initialization precharges another1MiB for at most2048 live Decimal endpoints*384B,1024 small containers/references*128B and131072B scalar/frame/Context/hash scratch. Rounded endpoints have<=120digits; interval literals here have at most native-geometry/time coefficient size. Degree64 residual coefficients stream one12-vector at a time, not a retained65x12 array. Every coefficient append and final simultaneous root/encoding state is checked within8MiB. Incoming JSON decode is lexically precharged before parsing; prior transport roots are released before the next read.

Bank and six replies/physical proof files use an8MiB reference-evidence subcap within the shared16MiB campaign total; the driver measures the combined actual total. Failed-prefix proof has a reserved bounded record. These are logical owned/serialization/source-derived allowances, not process/tool-heap/RSS measurements. No reference module imports or invokes candidate/Physics code. The sole imported numerical definitions are authenticated unchanged baseline cuboid-integral/rational-rotation/actual-state invariant functions, with only their operation-ceiling adapter. The new Taylor construction and defect/Picard certificate do not call candidate midpoint/Cayley/Newton code.
