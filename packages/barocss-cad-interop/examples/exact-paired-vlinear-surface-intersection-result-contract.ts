// Compile-only public contract. No function in this file is called.
import {
  parseBaroCadExactPairedVLinearSurfaceIntersectionResult,
  readBaroCadExactPairedVLinearSurfaceIntersectionResult,
  BaroCadExactPairedVLinearSurfaceIntersectionReadError,
  BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode,
  type BaroCadExactPairedVLinearSurfaceIntersectionResultRead,
} from '@barocss/cad-interop/exact-paired-vlinear-surface-intersection-result';
import {
  ExactPairedVLinearSurfaceIntersectionError,
  type ExactPairedVLinearSurfaceIntersectionResult,
  type ExactPairedVLinearSurfaceIntersectionReport,
  type ExactPairedVLinearSurfaceIntersectionRequest,
  type ExactPairedVLinearSurfaceIntersectionOptions,
  type Model, type Curve, type Surface, type Point,
  type CurveD1Result, type SurfaceD1Result,
} from '@barocss/cad';

type Read = BaroCadExactPairedVLinearSurfaceIntersectionResultRead;
type Native = ExactPairedVLinearSurfaceIntersectionResult;

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type ExactSurfaceChecks = [
  Assert<Equal<keyof Read, 'native' | 'validationReport' | 'profile' | 'sourceText'>>,
  Assert<Equal<keyof Native, 'request' | 'originalModels' | 'world' | 'pcurves' | 'proof' | 'observations' | 'report'>>,
  Assert<Equal<keyof ExactPairedVLinearSurfaceIntersectionRequest, 'assets' | 'uAInterval' | 'options'>>,
  Assert<Equal<keyof ExactPairedVLinearSurfaceIntersectionOptions, 'evaluationId' | 'worldCurveId' | 'pcurveAId' | 'pcurveBId' | 'maximumObservations'>>,
  Assert<Equal<BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode, 'INPUT' | 'JSON' | 'OWNED' | 'BUDGET' | 'SCHEMA' | 'NATIVE'>>,
  Assert<Equal<keyof Read['profile'], 'schema' | 'version' | 'nativeSchema' | 'nativeVersion' | 'sourceFrame' | 'worldLengthUnit' | 'uvLengthUnit' | 'parameterFrame' | 'sourceQualification' | 'ownership' | 'limits' | 'capabilities'>>,
  Assert<Equal<keyof Read['profile']['limits'], 'utf8Bytes' | 'utf16Units' | 'values' | 'depth' | 'recordFields' | 'arrayElements' | 'stringUnits' | 'keyUnits'>>,
  Assert<Equal<keyof Read['profile']['capabilities'], 'nativeWholeValidation' | 'copiedWholeReceipt' | 'renderer' | 'url' | 'byteInput' | 'publicSerializer' | 'dispose' | 'sourceEdit' | 'sampling' | 'intersectionConstruction' | 'genericIntersection' | 'allBranchesOutsideInterval' | 'trimFace' | 'topology' | 'body' | 'solid' | 'globalError' | 'manufacturing' | 'persistentNaming' | 'editor' | 'publication'>>,
];


export function publicSignatures(text: string, unknownInput: unknown) {
  const exactSurfaceChecks: ExactSurfaceChecks = [true, true, true, true, true, true, true, true];
  void exactSurfaceChecks;
  const parse: (value: string) => Read = parseBaroCadExactPairedVLinearSurfaceIntersectionResult;
  const read: (value: unknown) => Read = readBaroCadExactPairedVLinearSurfaceIntersectionResult;
  const parsed: Read = parse(text), copied: Read = read(unknownInput);
  const exactText: string | null = parsed.sourceText;
  const result: Native = copied.native;
  const actualReport: ExactPairedVLinearSurfaceIntersectionReport = copied.validationReport;
  // unknown[] is accepted by the TypeScript unknown signature; runtime INPUT refusal is separate.
  const compileAllowedUnknown: Read = readBaroCadExactPairedVLinearSurfaceIntersectionResult([]);
  // @ts-expect-error Text parsing requires a primitive string.
  parseBaroCadExactPairedVLinearSurfaceIntersectionResult({});
  // @ts-expect-error The actual retained text is nullable for owned admission.
  const nonnullableText: string = copied.sourceText;
  void [parse, read, parsed, copied, exactText, result, actualReport, compileAllowedUnknown, nonnullableText];
}

export function completeNative(read: Read) {
  const native: Native = read.native;
  const report: ExactPairedVLinearSurfaceIntersectionReport = read.validationReport;
  const request: ExactPairedVLinearSurfaceIntersectionRequest = native.request;
  const options: ExactPairedVLinearSurfaceIntersectionOptions = request.options;
  const maximumObservations: 5 = options.maximumObservations;
  const interval: [number, number] = request.uAInterval;
  const modelA: Model = native.originalModels[0], modelB: Model = native.originalModels[1];
  const selectedA: Surface = request.assets[0].surface, selectedB: Surface = request.assets[1].surface;
  const sourceA: string = request.assets[0].source, sourceB: string = request.assets[1].source;
  const sourceIdA: string = request.assets[0].sourceId, sourceIdB: string = request.assets[1].sourceId;
  const world: Curve = native.world.curve, worldSource: string = native.world.source;
  const worldModel: Model = native.world.model, version: 0 = native.world.sourceVersion;
  const a: Native['pcurves']['a'] = native.pcurves.a, b: Native['pcurves']['b'] = native.pcurves.b;
  const uvA: Curve = a.curve, uvB: Curve = b.curve;
  const uvFrame: 'original-native-uv' = a.coordinateSystem;
  const dimensionless: 'dimensionless' = b.lengthUnit;
  const embeddedZero: 0 = a.embeddedZ;
  const parameterFrame: 'original-a-u' = b.parameterFrame;
  const supportA: Native['pcurves']['a']['support'] = a.support;
  const assetIndex: 0 | 1 = supportA.assetIndex;
  const qualifiedSource: string = supportA.sourceField, qualifiedModel: string = supportA.modelField;
  const objectIndex: number = supportA.objectIndex, modelName: string = supportA.modelName;
  const domains: Native['pcurves']['b']['support']['nativeDomains'] = b.support.nativeDomains;
  const proof: Native['proof'] = native.proof;
  const proofSchema: 'barocss-exact-paired-vlinear-surface-intersection' = proof.schema;
  const proofVersion: 0 = proof.version, commonDegree: 4 = proof.commonDegree;
  const profiles: Native['proof']['profiles'] = proof.profiles;
  const cartesian: Native['proof']['profiles'][number]['originalCartesian'] = profiles[0].originalCartesian;
  const ubMap: Native['proof']['originalUB'] = proof.originalUB;
  const originalVA: Native['proof']['originalVA'] = proof.originalVA;
  const originalVB: Native['proof']['originalVB'] = proof.originalVB;
  const worldCoefficients: Native['proof']['worldCartesian'] = proof.worldCartesian;
  const coefficientsA: Native['proof']['pcurveACartesian'] = proof.pcurveACartesian;
  const coefficientsB: Native['proof']['pcurveBCartesian'] = proof.pcurveBCartesian;
  const residualsA: Native['proof']['residualsA'] = proof.residualsA;
  const residualsB: Native['proof']['residualsB'] = proof.residualsB;
  const chartGaps: Native['proof']['chartGaps'] = proof.chartGaps;
  const determinant: Native['proof']['fixedUJacobianDeterminant'] = proof.fixedUJacobianDeterminant;
  const observations: Native['observations'] = native.observations;
  const observation = observations[0];
  const worldD0: Point = observation.world.d0, worldD1: CurveD1Result = observation.world.d1;
  const uvAD1: CurveD1Result = observation.pcurveA.d1, uvBD1: CurveD1Result = observation.pcurveB.d1;
  const surfaceAD1: SurfaceD1Result = observation.surfaceA.d1, surfaceBD1: SurfaceD1Result = observation.surfaceB.d1;
  const derivative: Point = worldD1.derivative;
  const pointA: Point = surfaceAD1.point, du: Point = surfaceAD1.du, dv: Point = surfaceBD1.dv;
  const chainA: Point = observation.chainA, chainB: Point = observation.chainB;
  const residuals: Native['observations'][number]['residuals'] = observation.residuals;
  const reportSchema: 'barocss-exact-paired-vlinear-surface-intersection-report' = report.schema;
  const reportVersion: 0 = report.version;
  const namespaceSelections: ExactPairedVLinearSurfaceIntersectionReport['selections'] = report.selections;
  const binding: ExactPairedVLinearSurfaceIntersectionReport['worldSourceBinding'] = report.worldSourceBinding;
  const zeroWorldIndex: 0 = binding.objectIndex;
  const actualCounts: ExactPairedVLinearSurfaceIntersectionReport['directCounts'] = report.directCounts;
  const originalCompileCount: 2 = actualCounts.originalSourceCompileCount;
  const directObservationCount: 5 = actualCounts.observationCount;
  const nativeAttemptCap: 50 = report.limits.maximumNativeObservationAttempts;
  const conversionCap: 45 = report.limits.maximumFinalCoordinateConversions;
  const observedConversions: number = report.rationalCounts.floatConversions;
  const sourceSizes: ExactPairedVLinearSurfaceIntersectionReport['sourceSizes'] = report.sourceSizes;
  const fileSizes: ExactPairedVLinearSurfaceIntersectionReport['fileSizes'] = report.fileSizes;
  const exact: true = report.quality.exactStoredCoefficientBinding;
  const noTrim: false = report.quality.trimFaceProduced, noSolid: false = report.quality.solid;
  const noGeneric: false = report.quality.genericIntersection, noOutside: false = report.quality.allBranchesOutsideInterval;
  // Native and separate actual report are independently mutable data.
  native.world.source = native.world.source;
  native.request.options.maximumObservations = native.request.options.maximumObservations;
  native.pcurves.a.curve.controlPoints[0][0] = native.pcurves.a.curve.controlPoints[0][0];
  native.observations[0].surfaceA.d1.du[0] = native.observations[0].surfaceA.d1.du[0];
  report.maximumObservedPointGapMM = report.maximumObservedPointGapMM;
  report.quality.solid = report.quality.solid;
  // @ts-expect-error Native direct D1 has no tagged status or refusal packet.
  void observation.world.d1.status;
  // @ts-expect-error Direct SurfaceD1 has no normal field.
  void surfaceAD1.normal;
  // @ts-expect-error This family has no nullable successful SurfaceD1.
  native.observations[0].surfaceA.d1 = null;
  // @ts-expect-error Native success cannot acquire a Solid qualification.
  report.quality.solid = true;
  // @ts-expect-error The full paired result has no Surface band/Face topology root.
  void native.faces;
  // @ts-expect-error Native source version is exactly0.
  native.world.sourceVersion = 1;
  void [maximumObservations, interval, modelA, modelB, selectedA, selectedB, sourceA, sourceB, sourceIdA,
    sourceIdB, world, worldSource, worldModel, version, uvA, uvB, uvFrame, dimensionless, embeddedZero,
    parameterFrame, assetIndex, qualifiedSource, qualifiedModel, objectIndex, modelName, domains,
    proofSchema, proofVersion, commonDegree, cartesian, ubMap, originalVA, originalVB, worldCoefficients,
    coefficientsA, coefficientsB, residualsA, residualsB, chartGaps, determinant, worldD0, uvAD1, uvBD1,
    surfaceBD1, derivative, pointA, du, dv, chainA, chainB, residuals, reportSchema, reportVersion,
    namespaceSelections, zeroWorldIndex, originalCompileCount, directObservationCount, nativeAttemptCap,
    conversionCap, observedConversions, sourceSizes, fileSizes, exact, noTrim, noSolid, noGeneric, noOutside];
}

export function frozenProfile(read: Read) {
  const p: Read['profile'] = read.profile;
  const schema: "barocss-exact-paired-vlinear-surface-intersection-result-ingestion" = p.schema;
  const version: 0 = p.version;
  const nativeSchema: "barocss-exact-paired-vlinear-surface-intersection-report" = p.nativeSchema;
  const nativeVersion: 0 = p.nativeVersion;
  const sourceFrame: "authored-xyz-no-axis-conversion" = p.sourceFrame;
  const worldLengthUnit: "mm" = p.worldLengthUnit;
  const uvLengthUnit: "dimensionless" = p.uvLengthUnit;
  const parameterFrame: "original-a-u" = p.parameterFrame;
  const sourceQualification: "original-source-id-asset-index-and-model-object-index" = p.sourceQualification;
  const ownership: "independent-copied-cpu-data-gc" = p.ownership;
  const scalarValues: readonly ["barocss-exact-paired-vlinear-surface-intersection-result-ingestion", 0, "barocss-exact-paired-vlinear-surface-intersection-report", 0, "authored-xyz-no-axis-conversion", "mm", "dimensionless", "original-a-u", "original-source-id-asset-index-and-model-object-index", "independent-copied-cpu-data-gc"] = [p.schema, p.version, p.nativeSchema, p.nativeVersion, p.sourceFrame, p.worldLengthUnit, p.uvLengthUnit, p.parameterFrame, p.sourceQualification, p.ownership];
  // @ts-expect-error Frozen profile schema rejects a same-value write.
  p.schema = p.schema;
  // @ts-expect-error Frozen profile version rejects a same-value write.
  p.version = p.version;
  // @ts-expect-error Frozen profile nativeSchema rejects a same-value write.
  p.nativeSchema = p.nativeSchema;
  // @ts-expect-error Frozen profile nativeVersion rejects a same-value write.
  p.nativeVersion = p.nativeVersion;
  // @ts-expect-error Frozen profile sourceFrame rejects a same-value write.
  p.sourceFrame = p.sourceFrame;
  // @ts-expect-error Frozen profile worldLengthUnit rejects a same-value write.
  p.worldLengthUnit = p.worldLengthUnit;
  // @ts-expect-error Frozen profile uvLengthUnit rejects a same-value write.
  p.uvLengthUnit = p.uvLengthUnit;
  // @ts-expect-error Frozen profile parameterFrame rejects a same-value write.
  p.parameterFrame = p.parameterFrame;
  // @ts-expect-error Frozen profile sourceQualification rejects a same-value write.
  p.sourceQualification = p.sourceQualification;
  // @ts-expect-error Frozen profile ownership rejects a same-value write.
  p.ownership = p.ownership;
  // @ts-expect-error Frozen nested limit object cannot be replaced, even with itself.
  p.limits = p.limits;
  // @ts-expect-error Frozen nested capability object cannot be replaced, even with itself.
  p.capabilities = p.capabilities;
  const limit_utf8Bytes: 4194304 = p.limits.utf8Bytes;
  // @ts-expect-error Frozen limit utf8Bytes rejects a same-value write.
  p.limits.utf8Bytes = p.limits.utf8Bytes;
  const limit_utf16Units: 4194304 = p.limits.utf16Units;
  // @ts-expect-error Frozen limit utf16Units rejects a same-value write.
  p.limits.utf16Units = p.limits.utf16Units;
  const limit_values: 1048576 = p.limits.values;
  // @ts-expect-error Frozen limit values rejects a same-value write.
  p.limits.values = p.limits.values;
  const limit_depth: 64 = p.limits.depth;
  // @ts-expect-error Frozen limit depth rejects a same-value write.
  p.limits.depth = p.limits.depth;
  const limit_recordFields: 64 = p.limits.recordFields;
  // @ts-expect-error Frozen limit recordFields rejects a same-value write.
  p.limits.recordFields = p.limits.recordFields;
  const limit_arrayElements: 8192 = p.limits.arrayElements;
  // @ts-expect-error Frozen limit arrayElements rejects a same-value write.
  p.limits.arrayElements = p.limits.arrayElements;
  const limit_stringUnits: 262144 = p.limits.stringUnits;
  // @ts-expect-error Frozen limit stringUnits rejects a same-value write.
  p.limits.stringUnits = p.limits.stringUnits;
  const limit_keyUnits: 128 = p.limits.keyUnits;
  // @ts-expect-error Frozen limit keyUnits rejects a same-value write.
  p.limits.keyUnits = p.limits.keyUnits;
  const limitValues: readonly [4194304, 4194304, 1048576, 64, 64, 8192, 262144, 128] = [p.limits.utf8Bytes, p.limits.utf16Units, p.limits.values, p.limits.depth, p.limits.recordFields, p.limits.arrayElements, p.limits.stringUnits, p.limits.keyUnits];
  const capability_nativeWholeValidation: true = p.capabilities.nativeWholeValidation;
  // @ts-expect-error Frozen capability nativeWholeValidation rejects a same-value write.
  p.capabilities.nativeWholeValidation = p.capabilities.nativeWholeValidation;
  const capability_copiedWholeReceipt: true = p.capabilities.copiedWholeReceipt;
  // @ts-expect-error Frozen capability copiedWholeReceipt rejects a same-value write.
  p.capabilities.copiedWholeReceipt = p.capabilities.copiedWholeReceipt;
  const capability_renderer: false = p.capabilities.renderer;
  // @ts-expect-error Frozen capability renderer rejects a same-value write.
  p.capabilities.renderer = p.capabilities.renderer;
  const capability_url: false = p.capabilities.url;
  // @ts-expect-error Frozen capability url rejects a same-value write.
  p.capabilities.url = p.capabilities.url;
  const capability_byteInput: false = p.capabilities.byteInput;
  // @ts-expect-error Frozen capability byteInput rejects a same-value write.
  p.capabilities.byteInput = p.capabilities.byteInput;
  const capability_publicSerializer: false = p.capabilities.publicSerializer;
  // @ts-expect-error Frozen capability publicSerializer rejects a same-value write.
  p.capabilities.publicSerializer = p.capabilities.publicSerializer;
  const capability_dispose: false = p.capabilities.dispose;
  // @ts-expect-error Frozen capability dispose rejects a same-value write.
  p.capabilities.dispose = p.capabilities.dispose;
  const capability_sourceEdit: false = p.capabilities.sourceEdit;
  // @ts-expect-error Frozen capability sourceEdit rejects a same-value write.
  p.capabilities.sourceEdit = p.capabilities.sourceEdit;
  const capability_sampling: false = p.capabilities.sampling;
  // @ts-expect-error Frozen capability sampling rejects a same-value write.
  p.capabilities.sampling = p.capabilities.sampling;
  const capability_intersectionConstruction: false = p.capabilities.intersectionConstruction;
  // @ts-expect-error Frozen capability intersectionConstruction rejects a same-value write.
  p.capabilities.intersectionConstruction = p.capabilities.intersectionConstruction;
  const capability_genericIntersection: false = p.capabilities.genericIntersection;
  // @ts-expect-error Frozen capability genericIntersection rejects a same-value write.
  p.capabilities.genericIntersection = p.capabilities.genericIntersection;
  const capability_allBranchesOutsideInterval: false = p.capabilities.allBranchesOutsideInterval;
  // @ts-expect-error Frozen capability allBranchesOutsideInterval rejects a same-value write.
  p.capabilities.allBranchesOutsideInterval = p.capabilities.allBranchesOutsideInterval;
  const capability_trimFace: false = p.capabilities.trimFace;
  // @ts-expect-error Frozen capability trimFace rejects a same-value write.
  p.capabilities.trimFace = p.capabilities.trimFace;
  const capability_topology: false = p.capabilities.topology;
  // @ts-expect-error Frozen capability topology rejects a same-value write.
  p.capabilities.topology = p.capabilities.topology;
  const capability_body: false = p.capabilities.body;
  // @ts-expect-error Frozen capability body rejects a same-value write.
  p.capabilities.body = p.capabilities.body;
  const capability_solid: false = p.capabilities.solid;
  // @ts-expect-error Frozen capability solid rejects a same-value write.
  p.capabilities.solid = p.capabilities.solid;
  const capability_globalError: false = p.capabilities.globalError;
  // @ts-expect-error Frozen capability globalError rejects a same-value write.
  p.capabilities.globalError = p.capabilities.globalError;
  const capability_manufacturing: false = p.capabilities.manufacturing;
  // @ts-expect-error Frozen capability manufacturing rejects a same-value write.
  p.capabilities.manufacturing = p.capabilities.manufacturing;
  const capability_persistentNaming: false = p.capabilities.persistentNaming;
  // @ts-expect-error Frozen capability persistentNaming rejects a same-value write.
  p.capabilities.persistentNaming = p.capabilities.persistentNaming;
  const capability_editor: false = p.capabilities.editor;
  // @ts-expect-error Frozen capability editor rejects a same-value write.
  p.capabilities.editor = p.capabilities.editor;
  const capability_publication: false = p.capabilities.publication;
  // @ts-expect-error Frozen capability publication rejects a same-value write.
  p.capabilities.publication = p.capabilities.publication;
  const capabilityValues: readonly [true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false] = [p.capabilities.nativeWholeValidation, p.capabilities.copiedWholeReceipt, p.capabilities.renderer, p.capabilities.url, p.capabilities.byteInput, p.capabilities.publicSerializer, p.capabilities.dispose, p.capabilities.sourceEdit, p.capabilities.sampling, p.capabilities.intersectionConstruction, p.capabilities.genericIntersection, p.capabilities.allBranchesOutsideInterval, p.capabilities.trimFace, p.capabilities.topology, p.capabilities.body, p.capabilities.solid, p.capabilities.globalError, p.capabilities.manufacturing, p.capabilities.persistentNaming, p.capabilities.editor, p.capabilities.publication];
  void [scalarValues, limitValues, capabilityValues, schema, version, nativeSchema, nativeVersion, sourceFrame, worldLengthUnit, uvLengthUnit, parameterFrame, sourceQualification, ownership, limit_utf8Bytes, limit_utf16Units, limit_values, limit_depth, limit_recordFields, limit_arrayElements, limit_stringUnits, limit_keyUnits, capability_nativeWholeValidation, capability_copiedWholeReceipt, capability_renderer, capability_url, capability_byteInput, capability_publicSerializer, capability_dispose, capability_sourceEdit, capability_sampling, capability_intersectionConstruction, capability_genericIntersection, capability_allBranchesOutsideInterval, capability_trimFace, capability_topology, capability_body, capability_solid, capability_globalError, capability_manufacturing, capability_persistentNaming, capability_editor, capability_publication];
}

export function actualErrorTypes(publicError: BaroCadExactPairedVLinearSurfaceIntersectionReadError,
  nativeError: ExactPairedVLinearSurfaceIntersectionError) {
  const code: BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode = publicError.code;
  const nativeCode: ExactPairedVLinearSurfaceIntersectionError['code'] = nativeError.code;
  const nativeContext: ExactPairedVLinearSurfaceIntersectionError['context'] = nativeError.context;
  const phase: ExactPairedVLinearSurfaceIntersectionError['context']['phase'] = nativeContext.phase;
  const assetIndex: 0 | 1 | null = nativeContext.assetIndex;
  const stationIndex: number | null = nativeContext.stationIndex;
  const actualPrefixCounts: ExactPairedVLinearSurfaceIntersectionError['context']['directCounts'] = nativeContext.directCounts;
  const attemptedSourceCompiles: number = actualPrefixCounts.originalSourceCompileCount;
  const publicCause: unknown = publicError.cause, nativeCause: unknown = nativeError.cause;
  const diagnosticValues: readonly ['INPUT','JSON','OWNED','BUDGET','SCHEMA','NATIVE'] = [
    BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode.INPUT,
    BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode.JSON,
    BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode.OWNED,
    BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode.BUDGET,
    BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode.SCHEMA,
    BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode.NATIVE,
  ];
  const wrapped = new BaroCadExactPairedVLinearSurfaceIntersectionReadError(
    BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode.NATIVE, 'compile-only', nativeError);
  // @ts-expect-error Public error code is readonly, including a same-value write.
  publicError.code = publicError.code;
  // @ts-expect-error Actual native error code is readonly, including a same-value write.
  nativeError.code = nativeError.code;
  // @ts-expect-error Actual native context reference is readonly; nested values keep their actual type.
  nativeError.context = nativeError.context;
  // @ts-expect-error Merged const DiagnosticCode is frozen/readonly.
  BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode.INPUT = BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode.INPUT;
  // @ts-expect-error Diagnostic union contains only the exact six public codes.
  const badCode: BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode = 'INVALID';
  // @ts-expect-error Error constructor also rejects an unsupported public code.
  new BaroCadExactPairedVLinearSurfaceIntersectionReadError('INVALID', 'compile-only');
  void [code, nativeCode, phase, assetIndex, stationIndex, attemptedSourceCompiles,
    publicCause, nativeCause, diagnosticValues, wrapped, badCode];
}
