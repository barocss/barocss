// Compile-only public type consumer. No function in this file is invoked.
import {
  parseBaroCadPairedSurfaceUVFaceClassificationResult,
  readBaroCadPairedSurfaceUVFaceClassificationResult,
  BaroCadPairedSurfaceUVFaceClassificationReadError,
  BaroCadPairedSurfaceUVFaceClassificationDiagnosticCode,
  type BaroCadPairedSurfaceUVFaceClassificationResultRead,
} from '@barocss/cad-interop/paired-surface-uv-face-classification-result';
import {
  PairedSurfaceUVFaceClassificationError,
  type PairedSurfaceUVFaceResult, type PairedSurfaceUVFaceReport,
  type PairedSurfaceUVFaceQuery, type PairedSurfaceUVFaceOptions,
  type Model, type Surface, type Curve, type Point, type CurveD1Result, type SurfaceD1Result,
} from '@barocss/cad';

type Read = BaroCadPairedSurfaceUVFaceClassificationResultRead;
type Native = PairedSurfaceUVFaceResult;
// The native Request is private. This indexed type consumes the actual exported Result.
type Request = Native['request'];
type Rational = Native['proof']['supports'][number]['uMap']['offset'];
type Equal<A,B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type ExactSurfaceChecks = [
  Assert<Equal<keyof Read, "native" | "validationReport" | "profile" | "sourceText">>,
  Assert<Equal<keyof Native, "request" | "classifications" | "proof" | "report">>,
  Assert<Equal<keyof Request, "a" | "b" | "queries" | "options">>,
  Assert<Equal<keyof PairedSurfaceUVFaceQuery, "queryId" | "assetIndex" | "u" | "v">>,
  Assert<Equal<keyof PairedSurfaceUVFaceOptions, "evaluationId" | "maximumQueries">>,
  Assert<Equal<BaroCadPairedSurfaceUVFaceClassificationDiagnosticCode, "INPUT" | "JSON" | "OWNED" | "BUDGET" | "SCHEMA" | "NATIVE">>,
  Assert<Equal<keyof Read['profile'], "schema" | "version" | "nativeSchema" | "nativeVersion" | "sourceFrame" | "worldLengthUnit" | "uvLengthUnit" | "parameterFrame" | "sourceQualification" | "ownership" | "membershipScope" | "d1Representation" | "nativeRequestBytes" | "limits" | "capabilities">>,
  Assert<Equal<keyof Read['profile']['limits'], "utf8Bytes" | "utf16Units" | "values" | "depth" | "recordFields" | "arrayElements" | "stringUnits" | "keyUnits">>,
  Assert<Equal<keyof Read['profile']['capabilities'], "nativeWholeValidation" | "copiedWholeReceipt" | "renderer" | "url" | "byteInput" | "publicSerializer" | "dispose" | "sourceEdit" | "sampling" | "intersectionConstruction" | "isoCurveConstruction" | "intervalExtraction" | "faceConstruction" | "worldPointMembership" | "topologyConstruction" | "body" | "solid" | "globalError" | "manufacturing" | "persistentNaming" | "editor" | "publication">>,
 ];

export function publicSignatures(text:string,input:unknown) {
  const exactKeys: ExactSurfaceChecks = [true,true,true,true,true,true,true,true,true];
  const parse: (value:string) => Read = parseBaroCadPairedSurfaceUVFaceClassificationResult;
  const read: (value:unknown) => Read = readBaroCadPairedSurfaceUVFaceClassificationResult;
  const parsed: Read = parse(text), owned: Read = read(input);
  const native: Native = parsed.native, report: PairedSurfaceUVFaceReport = owned.validationReport;
  const exactOrNull: string|null = owned.sourceText;
  // unknown[] is compile-valid input; runtime INPUT refusal remains separately proved.
  const unknownArray: Read = readBaroCadPairedSurfaceUVFaceClassificationResult([]);
  // @ts-expect-error Public parsing requires a primitive string.
  parseBaroCadPairedSurfaceUVFaceClassificationResult({});
  // @ts-expect-error Byte input has no overload.
  parseBaroCadPairedSurfaceUVFaceClassificationResult(new Uint8Array(0));
  // @ts-expect-error Public parser has no optional constructor/default argument.
  parseBaroCadPairedSurfaceUVFaceClassificationResult(text, {});
  // @ts-expect-error Owned sourceText is nullable.
  const nonnullable: string = owned.sourceText;
  // @ts-expect-error CPU Read has no disposal API.
  parsed.dispose();
  // @ts-expect-error CPU Read has no URL transport method.
  parsed.loadFromUrl('https://example.invalid/input');
  // @ts-expect-error CPU reader adds no source-edit operator.
  parsed.edit({});
  void [exactKeys,parse,read,parsed,owned,native,report,exactOrNull,unknownArray,nonnullable];
}

export function completeNative(read:Read) {
  const native: Native = read.native, report: PairedSurfaceUVFaceReport = read.validationReport;
  const request: Request = native.request, options: PairedSurfaceUVFaceOptions = request.options;
  const evaluationId: string = options.evaluationId, maximumQueries:16 = options.maximumQueries;
  const query: PairedSurfaceUVFaceQuery = request.queries[0];
  const queryId:string = query.queryId, assetIndex:0|1 = query.assetIndex;
  const u:number = query.u, v:number = query.v;
  // Number types retain runtime -0 as data; only actual Object.is execution proves its bit.
  const signedZero:number = -0;
  const a:Native['request']['a'] = request.a, b:Native['request']['b'] = request.b;
  const sectionA:Native['request']['a']['request']['section'] = a.request.section;
  const sectionB:Native['request']['b']['request']['section'] = b.request.section;
  const originalA:Model = sectionA.originalModels[0], originalB:Model = sectionB.originalModels[1];
  const surfaceA:Surface = sectionA.request.assets[0].surface, surfaceB:Surface = sectionB.request.assets[1].surface;
  const sourceA:string = sectionA.request.assets[0].source, sourceB:string = sectionB.request.assets[1].source;
  const worldA:Model = a.world.model, worldB:Model = b.world.model;
  const worldCurve:Curve = sectionA.world.curve, uvA:Curve = sectionA.pcurves.a.curve, uvB:Curve = sectionB.pcurves.b.curve;
  const isoA:Native['request']['a']['isoCurves'] = a.isoCurves;
  const intervalB:Native['request']['b']['intervals'] = b.intervals;
  const loopsA:Native['request']['a']['loops'] = a.loops;
  const usesB:Native['request']['b']['loops'][number]['uses'] = b.loops[0].uses;
  const facesA:Native['request']['a']['faces'] = a.faces, facesB:Native['request']['b']['faces'] = b.faces;
  const classRow:Native['classifications'][number] = native.classifications[0];
  const window:'outside'|'interior'|'boundary' = classRow.window;
  const boundaries:('u-min'|'u-max'|'v-min'|'v-max')[] = classRow.windowBoundaries;
  const relation:'below'|'on'|'above'|'not-applicable' = classRow.cutRelation;
  const face:Native['classifications'][number]['faces'][number] = classRow.faces[0];
  const faceId:string = face.faceId, sourceId:string = face.sourceId, surfaceId:string = face.surfaceId;
  const region:'below-cut'|'above-cut' = face.region, orientation:'forward'|'reverse' = face.orientation;
  const material:'inside'|'outside'|'boundary' = face.classification;
  const support:Native['proof']['supports'][number] = native.proof.supports[0];
  const reference:Native['proof']['supports'][number]['reference'] = support.reference;
  const refAsset:0|1 = reference.assetIndex, objectIndex:number = reference.objectIndex;
  const sourceField:'request.a.request.section.request.assets[0].source'|'request.b.request.section.request.assets[1].source' = reference.sourceField;
  const modelField:'request.a.request.section.originalModels[0]'|'request.b.request.section.originalModels[1]' = reference.modelField;
  const supportWindow:Native['proof']['supports'][number]['window'] = support.window;
  const supportUA:[number,number] = support.originalUAInterval;
  const uMap:Native['proof']['supports'][number]['uMap'] = support.uMap;
  const offset:Rational = uMap.offset, scale:Rational = uMap.scale;
  const vCoefficients:Native['proof']['supports'][number]['vCoefficients'] = support.vCoefficients;
  const supportedFaceIds:[string,string] = support.faceIds;
  const supportOrientations:['forward'|'reverse','forward'|'reverse'] = support.orientations;
  const proofSchema:'barocss-paired-surface-uv-face-classification-proof' = native.proof.schema;
  const completeParent:true = native.proof.sameCompletePairedParent;
  const sharedWorld:true = native.proof.unchangedSharedWorldCurve;
  const originalFrames:true = native.proof.preservedOriginalParameterFrames;
  const reportSchema:'barocss-paired-surface-uv-face-classification' = report.schema, reportVersion:0 = report.version;
  const queryCount:number = report.queryCount;
  const assetQueryCounts:[number,number] = report.assetQueryCounts;
  const windowCounts:PairedSurfaceUVFaceReport['windowCounts'] = report.windowCounts;
  const relationCounts:PairedSurfaceUVFaceReport['relationCounts'] = report.relationCounts;
  const faceCounts:PairedSurfaceUVFaceReport['faceCounts'] = report.faceCounts;
  const direct:PairedSurfaceUVFaceReport['directCounts'] = report.directCounts;
  const inherited:PairedSurfaceUVFaceReport['inheritedCounts'] = report.inheritedCounts;
  const parentCalls:number = direct.parentValidationCount, quarticCalls:number = direct.quarticEvaluationCount;
  const newCurveD0:0 = direct.curveD0Count, newCurveD1:0 = direct.curveD1Count;
  const newSurfaceD0:0 = direct.surfaceD0Count, newSurfaceD1:0 = direct.surfaceD1Count;
  const newCompilation:0 = direct.sourceCompilationCount, newFloatConversion:0 = direct.rationalFloatConversionCount;
  const nativeRequestCap:8388608 = report.limits.requestBytes, nativeResultCap:16777216 = report.limits.resultBytes;
  const policy:PairedSurfaceUVFaceReport['numericPolicy'] = report.numericPolicy;
  const noTolerance:false = policy.toleranceUsed, noProjection:false = policy.pointProjectionPerformed;
  const uvMembership:true = report.quality.exactUVFaceMembershipCertified;
  const worldMembership:false = report.quality.worldPointMembershipCertified;
  const occupied:false = report.quality.occupied3DMaterialCertified, solid:false = report.quality.solid;
  // Mutable independent native and actualReport data: same-value assignments remain valid.
  native.request.queries[0].u = native.request.queries[0].u;
  native.request.a.world.source = native.request.a.world.source;
  native.classifications[0].faces[0].classification = native.classifications[0].faces[0].classification;
  native.proof.queries[0].cutSign = native.proof.queries[0].cutSign;
  report.queryCount = report.queryCount;
  report.quality.worldPointMembershipCertified = report.quality.worldPointMembershipCertified;
  // @ts-expect-error Required native options cannot be omitted.
  native.request.options = undefined;
  // @ts-expect-error Native selected maximumQueries is the exact cap16.
  options.maximumQueries = 17;
  // @ts-expect-error Asset namespace is 0|1, not arbitrary index2.
  query.assetIndex = 2;
  // @ts-expect-error Original UV query has no World-X coordinate field.
  void query.x;
  // @ts-expect-error Native Result4 has no direct World packet root.
  void native.world;
  // @ts-expect-error Native UV membership has no Body root.
  void native.body;
  // @ts-expect-error This native layer adds no D1 observation packet.
  void native.observations;
  // @ts-expect-error Native supplied false World qualification cannot be upgraded.
  report.quality.worldPointMembershipCertified = true;
  // @ts-expect-error Native supplied false occupied material qualification cannot be upgraded.
  report.quality.occupied3DMaterialCertified = true;
  void [evaluationId,maximumQueries,queryId,assetIndex,u,v,signedZero,originalA,originalB,surfaceA,surfaceB,sourceA,sourceB,
    worldA,worldB,worldCurve,uvA,uvB,isoA,intervalB,loopsA,usesB,facesA,facesB,window,boundaries,relation,faceId,sourceId,
    surfaceId,region,orientation,material,refAsset,objectIndex,sourceField,modelField,supportWindow,supportUA,offset,scale,
    vCoefficients,supportedFaceIds,supportOrientations,proofSchema,completeParent,sharedWorld,originalFrames,reportSchema,
    reportVersion,queryCount,assetQueryCounts,windowCounts,relationCounts,faceCounts,inherited,parentCalls,quarticCalls,
    newCurveD0,newCurveD1,newSurfaceD0,newSurfaceD1,newCompilation,newFloatConversion,nativeRequestCap,nativeResultCap,
    noTolerance,noProjection,uvMembership,worldMembership,occupied,solid];
}

export function completeProofAndParentD1(native:Native) {
  const proof:Native['proof']['queries'][number] = native.proof.queries[0];
  const queryUV:[Rational,Rational] = proof.queryUV;
  const method:'outside-window'|'natural-v-boundary'|'exact-affine-quartic' = proof.method;
  const signs:Native['proof']['queries'][number]['boundSigns'] = proof.boundSigns;
  const sign:-1|0|1 = signs.uMinimum;
  const originalUA:Rational|null = proof.originalUA, normalized:Rational|null = proof.normalizedParameter;
  const cut:Rational|null = proof.cutValue, difference:Rational|null = proof.vMinusCut;
  const cutSign:-1|0|1|null = proof.cutSign;
  const tableau:Rational[][] = proof.deCasteljau;
  const echoedClassification:Native['classifications'][number] = proof.classification;
  if (cut !== null) {const numerator:string = cut.numerator, denominator:string = cut.denominator;void [numerator,denominator];}
  // @ts-expect-error Outside/natural-boundary witnesses may retain originalUA null.
  const requiredOriginalUA:Rational = proof.originalUA;
  // @ts-expect-error Cut sign may be null; it is not universally numeric.
  const requiredSign:-1|0|1 = proof.cutSign;
  // @ts-expect-error Rational UV proof has no World XYZ point field.
  void proof.point;
  const parentA = native.request.a, parentB = native.request.b;
  const directCurve:CurveD1Result = parentA.request.section.observations[0].world.d1;
  const directSurface:SurfaceD1Result = parentB.request.section.observations[0].surfaceB.d1;
  const parentDerivative:Point = directCurve.derivative, parentDu:Point = directSurface.du;
  const taggedCurve = parentA.observations[0].world.d1, taggedSurface = parentB.observations[0].surface.d1;
  if (taggedCurve.status === 'evaluated') {const derivative:Point = taggedCurve.value.derivative;void derivative;}
  else {const reason:string = taggedCurve.reason, nativeErrorName:string = taggedCurve.nativeErrorName;
    // @ts-expect-error Refused parent Face D1 has no successful value:null.
    void taggedCurve.value;
    void [reason,nativeErrorName];}
  if (taggedSurface.status === 'evaluated') {const value:SurfaceD1Result = taggedSurface.value;const dv:Point = value.dv;
    // @ts-expect-error Actual native SurfaceD1 has no normal.
    void value.normal;
    void dv;}
  else {const reason:string = taggedSurface.reason, nativeErrorName:string = taggedSurface.nativeErrorName;void [reason,nativeErrorName];}
  const parentChain:Point|null = parentA.observations[0].chain;
  // @ts-expect-error Tagged parent Face chain remains nullable without runtime qualification.
  const requiredChain:Point = parentA.observations[0].chain;
  // @ts-expect-error Direct intersection CurveD1 is not a tagged union.
  void directCurve.status;
  void [queryUV,method,sign,originalUA,normalized,cut,difference,cutSign,tableau,echoedClassification,
    requiredOriginalUA,requiredSign,parentDerivative,parentDu,parentChain,requiredChain];
}

export function frozenProfile(read:Read) {
  const p:Read['profile'] = read.profile;
  const scalar_schema: "barocss-paired-surface-uv-face-classification-result-ingestion" = p.schema;
  // @ts-expect-error Frozen scalar schema rejects a same-value write.
  p.schema = p.schema;
  const scalar_version: 0 = p.version;
  // @ts-expect-error Frozen scalar version rejects a same-value write.
  p.version = p.version;
  const scalar_nativeSchema: "barocss-paired-surface-uv-face-classification" = p.nativeSchema;
  // @ts-expect-error Frozen scalar nativeSchema rejects a same-value write.
  p.nativeSchema = p.nativeSchema;
  const scalar_nativeVersion: 0 = p.nativeVersion;
  // @ts-expect-error Frozen scalar nativeVersion rejects a same-value write.
  p.nativeVersion = p.nativeVersion;
  const scalar_sourceFrame: "authored-xyz-no-axis-conversion" = p.sourceFrame;
  // @ts-expect-error Frozen scalar sourceFrame rejects a same-value write.
  p.sourceFrame = p.sourceFrame;
  const scalar_worldLengthUnit: "mm" = p.worldLengthUnit;
  // @ts-expect-error Frozen scalar worldLengthUnit rejects a same-value write.
  p.worldLengthUnit = p.worldLengthUnit;
  const scalar_uvLengthUnit: "dimensionless" = p.uvLengthUnit;
  // @ts-expect-error Frozen scalar uvLengthUnit rejects a same-value write.
  p.uvLengthUnit = p.uvLengthUnit;
  const scalar_parameterFrame: "original-a-u-v-and-original-b-u-v" = p.parameterFrame;
  // @ts-expect-error Frozen scalar parameterFrame rejects a same-value write.
  p.parameterFrame = p.parameterFrame;
  const scalar_sourceQualification: "original-a-and-b-source-id-model-object-index-with-full-complementary-parents-retained" = p.sourceQualification;
  // @ts-expect-error Frozen scalar sourceQualification rejects a same-value write.
  p.sourceQualification = p.sourceQualification;
  const scalar_ownership: "independent-copied-cpu-data-gc" = p.ownership;
  // @ts-expect-error Frozen scalar ownership rejects a same-value write.
  p.ownership = p.ownership;
  const scalar_membershipScope: "original-complementary-a-and-b-face-windows" = p.membershipScope;
  // @ts-expect-error Frozen scalar membershipScope rejects a same-value write.
  p.membershipScope = p.membershipScope;
  const scalar_d1Representation: "parent-face-tagged-intersection-direct-no-new-d1" = p.d1Representation;
  // @ts-expect-error Frozen scalar d1Representation rejects a same-value write.
  p.d1Representation = p.d1Representation;
  const scalar_nativeRequestBytes: 8388608 = p.nativeRequestBytes;
  // @ts-expect-error Frozen scalar nativeRequestBytes rejects a same-value write.
  p.nativeRequestBytes = p.nativeRequestBytes;
  const scalarValues: readonly ["barocss-paired-surface-uv-face-classification-result-ingestion", 0, "barocss-paired-surface-uv-face-classification", 0, "authored-xyz-no-axis-conversion", "mm", "dimensionless", "original-a-u-v-and-original-b-u-v", "original-a-and-b-source-id-model-object-index-with-full-complementary-parents-retained", "independent-copied-cpu-data-gc", "original-complementary-a-and-b-face-windows", "parent-face-tagged-intersection-direct-no-new-d1", 8388608] = [p.schema, p.version, p.nativeSchema, p.nativeVersion, p.sourceFrame, p.worldLengthUnit, p.uvLengthUnit, p.parameterFrame, p.sourceQualification, p.ownership, p.membershipScope, p.d1Representation, p.nativeRequestBytes];
  // @ts-expect-error Frozen limits object cannot be replaced even with itself.
  p.limits = p.limits;
  const limits_utf8Bytes: 16777216 = p.limits.utf8Bytes;
  // @ts-expect-error Frozen limits.utf8Bytes rejects a same-value write.
  p.limits.utf8Bytes = p.limits.utf8Bytes;
  const limits_utf16Units: 16777216 = p.limits.utf16Units;
  // @ts-expect-error Frozen limits.utf16Units rejects a same-value write.
  p.limits.utf16Units = p.limits.utf16Units;
  const limits_values: 4194304 = p.limits.values;
  // @ts-expect-error Frozen limits.values rejects a same-value write.
  p.limits.values = p.limits.values;
  const limits_depth: 64 = p.limits.depth;
  // @ts-expect-error Frozen limits.depth rejects a same-value write.
  p.limits.depth = p.limits.depth;
  const limits_recordFields: 64 = p.limits.recordFields;
  // @ts-expect-error Frozen limits.recordFields rejects a same-value write.
  p.limits.recordFields = p.limits.recordFields;
  const limits_arrayElements: 8192 = p.limits.arrayElements;
  // @ts-expect-error Frozen limits.arrayElements rejects a same-value write.
  p.limits.arrayElements = p.limits.arrayElements;
  const limits_stringUnits: 262144 = p.limits.stringUnits;
  // @ts-expect-error Frozen limits.stringUnits rejects a same-value write.
  p.limits.stringUnits = p.limits.stringUnits;
  const limits_keyUnits: 128 = p.limits.keyUnits;
  // @ts-expect-error Frozen limits.keyUnits rejects a same-value write.
  p.limits.keyUnits = p.limits.keyUnits;
  const limitsValues: readonly [16777216, 16777216, 4194304, 64, 64, 8192, 262144, 128] = [p.limits.utf8Bytes, p.limits.utf16Units, p.limits.values, p.limits.depth, p.limits.recordFields, p.limits.arrayElements, p.limits.stringUnits, p.limits.keyUnits];
  // @ts-expect-error Frozen capabilities object cannot be replaced even with itself.
  p.capabilities = p.capabilities;
  const capabilities_nativeWholeValidation: true = p.capabilities.nativeWholeValidation;
  // @ts-expect-error Frozen capabilities.nativeWholeValidation rejects a same-value write.
  p.capabilities.nativeWholeValidation = p.capabilities.nativeWholeValidation;
  const capabilities_copiedWholeReceipt: true = p.capabilities.copiedWholeReceipt;
  // @ts-expect-error Frozen capabilities.copiedWholeReceipt rejects a same-value write.
  p.capabilities.copiedWholeReceipt = p.capabilities.copiedWholeReceipt;
  const capabilities_renderer: false = p.capabilities.renderer;
  // @ts-expect-error Frozen capabilities.renderer rejects a same-value write.
  p.capabilities.renderer = p.capabilities.renderer;
  const capabilities_url: false = p.capabilities.url;
  // @ts-expect-error Frozen capabilities.url rejects a same-value write.
  p.capabilities.url = p.capabilities.url;
  const capabilities_byteInput: false = p.capabilities.byteInput;
  // @ts-expect-error Frozen capabilities.byteInput rejects a same-value write.
  p.capabilities.byteInput = p.capabilities.byteInput;
  const capabilities_publicSerializer: false = p.capabilities.publicSerializer;
  // @ts-expect-error Frozen capabilities.publicSerializer rejects a same-value write.
  p.capabilities.publicSerializer = p.capabilities.publicSerializer;
  const capabilities_dispose: false = p.capabilities.dispose;
  // @ts-expect-error Frozen capabilities.dispose rejects a same-value write.
  p.capabilities.dispose = p.capabilities.dispose;
  const capabilities_sourceEdit: false = p.capabilities.sourceEdit;
  // @ts-expect-error Frozen capabilities.sourceEdit rejects a same-value write.
  p.capabilities.sourceEdit = p.capabilities.sourceEdit;
  const capabilities_sampling: false = p.capabilities.sampling;
  // @ts-expect-error Frozen capabilities.sampling rejects a same-value write.
  p.capabilities.sampling = p.capabilities.sampling;
  const capabilities_intersectionConstruction: false = p.capabilities.intersectionConstruction;
  // @ts-expect-error Frozen capabilities.intersectionConstruction rejects a same-value write.
  p.capabilities.intersectionConstruction = p.capabilities.intersectionConstruction;
  const capabilities_isoCurveConstruction: false = p.capabilities.isoCurveConstruction;
  // @ts-expect-error Frozen capabilities.isoCurveConstruction rejects a same-value write.
  p.capabilities.isoCurveConstruction = p.capabilities.isoCurveConstruction;
  const capabilities_intervalExtraction: false = p.capabilities.intervalExtraction;
  // @ts-expect-error Frozen capabilities.intervalExtraction rejects a same-value write.
  p.capabilities.intervalExtraction = p.capabilities.intervalExtraction;
  const capabilities_faceConstruction: false = p.capabilities.faceConstruction;
  // @ts-expect-error Frozen capabilities.faceConstruction rejects a same-value write.
  p.capabilities.faceConstruction = p.capabilities.faceConstruction;
  const capabilities_worldPointMembership: false = p.capabilities.worldPointMembership;
  // @ts-expect-error Frozen capabilities.worldPointMembership rejects a same-value write.
  p.capabilities.worldPointMembership = p.capabilities.worldPointMembership;
  const capabilities_topologyConstruction: false = p.capabilities.topologyConstruction;
  // @ts-expect-error Frozen capabilities.topologyConstruction rejects a same-value write.
  p.capabilities.topologyConstruction = p.capabilities.topologyConstruction;
  const capabilities_body: false = p.capabilities.body;
  // @ts-expect-error Frozen capabilities.body rejects a same-value write.
  p.capabilities.body = p.capabilities.body;
  const capabilities_solid: false = p.capabilities.solid;
  // @ts-expect-error Frozen capabilities.solid rejects a same-value write.
  p.capabilities.solid = p.capabilities.solid;
  const capabilities_globalError: false = p.capabilities.globalError;
  // @ts-expect-error Frozen capabilities.globalError rejects a same-value write.
  p.capabilities.globalError = p.capabilities.globalError;
  const capabilities_manufacturing: false = p.capabilities.manufacturing;
  // @ts-expect-error Frozen capabilities.manufacturing rejects a same-value write.
  p.capabilities.manufacturing = p.capabilities.manufacturing;
  const capabilities_persistentNaming: false = p.capabilities.persistentNaming;
  // @ts-expect-error Frozen capabilities.persistentNaming rejects a same-value write.
  p.capabilities.persistentNaming = p.capabilities.persistentNaming;
  const capabilities_editor: false = p.capabilities.editor;
  // @ts-expect-error Frozen capabilities.editor rejects a same-value write.
  p.capabilities.editor = p.capabilities.editor;
  const capabilities_publication: false = p.capabilities.publication;
  // @ts-expect-error Frozen capabilities.publication rejects a same-value write.
  p.capabilities.publication = p.capabilities.publication;
  const capabilitiesValues: readonly [true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false] = [p.capabilities.nativeWholeValidation, p.capabilities.copiedWholeReceipt, p.capabilities.renderer, p.capabilities.url, p.capabilities.byteInput, p.capabilities.publicSerializer, p.capabilities.dispose, p.capabilities.sourceEdit, p.capabilities.sampling, p.capabilities.intersectionConstruction, p.capabilities.isoCurveConstruction, p.capabilities.intervalExtraction, p.capabilities.faceConstruction, p.capabilities.worldPointMembership, p.capabilities.topologyConstruction, p.capabilities.body, p.capabilities.solid, p.capabilities.globalError, p.capabilities.manufacturing, p.capabilities.persistentNaming, p.capabilities.editor, p.capabilities.publication];
  void [scalarValues,limitsValues,capabilitiesValues,scalar_schema, scalar_version, scalar_nativeSchema, scalar_nativeVersion, scalar_sourceFrame, scalar_worldLengthUnit, scalar_uvLengthUnit, scalar_parameterFrame, scalar_sourceQualification, scalar_ownership, scalar_membershipScope, scalar_d1Representation, scalar_nativeRequestBytes, limits_utf8Bytes, limits_utf16Units, limits_values, limits_depth, limits_recordFields, limits_arrayElements, limits_stringUnits, limits_keyUnits, capabilities_nativeWholeValidation, capabilities_copiedWholeReceipt, capabilities_renderer, capabilities_url, capabilities_byteInput, capabilities_publicSerializer, capabilities_dispose, capabilities_sourceEdit, capabilities_sampling, capabilities_intersectionConstruction, capabilities_isoCurveConstruction, capabilities_intervalExtraction, capabilities_faceConstruction, capabilities_worldPointMembership, capabilities_topologyConstruction, capabilities_body, capabilities_solid, capabilities_globalError, capabilities_manufacturing, capabilities_persistentNaming, capabilities_editor, capabilities_publication];
}

export function actualErrors(publicError:BaroCadPairedSurfaceUVFaceClassificationReadError,nativeError:PairedSurfaceUVFaceClassificationError) {
  const code:BaroCadPairedSurfaceUVFaceClassificationDiagnosticCode = publicError.code;
  const nativeCode:PairedSurfaceUVFaceClassificationError['code'] = nativeError.code;
  const context:PairedSurfaceUVFaceClassificationError['context'] = nativeError.context;
  const phase:PairedSurfaceUVFaceClassificationError['context']['phase'] = context.phase;
  const assetIndex:0|1|null = context.assetIndex, queryIndex:number|null = context.queryIndex;
  const directCounts:PairedSurfaceUVFaceClassificationError['context']['directCounts'] = context.directCounts;
  const parentAttempts:number = directCounts.parentValidationCount;
  const failedSamplerAttempts:number = directCounts.curveD0Count;
  const publicCause:unknown = publicError.cause, nativeCause:unknown = nativeError.cause;
  const diagnostics:readonly ['INPUT','JSON','OWNED','BUDGET','SCHEMA','NATIVE'] = [
    BaroCadPairedSurfaceUVFaceClassificationDiagnosticCode.INPUT,BaroCadPairedSurfaceUVFaceClassificationDiagnosticCode.JSON,
    BaroCadPairedSurfaceUVFaceClassificationDiagnosticCode.OWNED,BaroCadPairedSurfaceUVFaceClassificationDiagnosticCode.BUDGET,
    BaroCadPairedSurfaceUVFaceClassificationDiagnosticCode.SCHEMA,BaroCadPairedSurfaceUVFaceClassificationDiagnosticCode.NATIVE,
  ];
  const wrapped = new BaroCadPairedSurfaceUVFaceClassificationReadError('NATIVE','compile-only',nativeError);
  // @ts-expect-error Public read error code is readonly even for same-value write.
  publicError.code = publicError.code;
  // @ts-expect-error Native error code is readonly even for same-value write.
  nativeError.code = nativeError.code;
  // @ts-expect-error Native context reference is readonly; exact indexed fields stay intact.
  nativeError.context = nativeError.context;
  // @ts-expect-error Frozen merged Diagnostic const rejects same-value write.
  BaroCadPairedSurfaceUVFaceClassificationDiagnosticCode.INPUT = BaroCadPairedSurfaceUVFaceClassificationDiagnosticCode.INPUT;
  // @ts-expect-error Diagnostic union contains exact six public codes only.
  const badCode:BaroCadPairedSurfaceUVFaceClassificationDiagnosticCode = 'INVALID';
  // @ts-expect-error Native failures use actual asset/query context, no edgeIndex.
  void context.edgeIndex;
  // @ts-expect-error Native failures use actual asset/query context, no observationIndex.
  void context.observationIndex;
  // @ts-expect-error Error prefix counts are numbers; do not claim failed work is literal zero.
  const failedZero:0 = directCounts.curveD0Count;
  void [code,nativeCode,phase,assetIndex,queryIndex,parentAttempts,failedSamplerAttempts,
    publicCause,nativeCause,diagnostics,wrapped,badCode,failedZero];
}
