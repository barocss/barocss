// Compile-only selected public type consumer. No function body is invoked.
import {
  parseBaroCadPairedSurfaceMaterialBodyResult,
  readBaroCadPairedSurfaceMaterialBodyResult,
  BaroCadPairedSurfaceMaterialBodyReadError,
  BaroCadPairedSurfaceMaterialBodyDiagnosticCode,
  type BaroCadPairedSurfaceMaterialBodyResultRead,
} from '@barocss/cad-interop/paired-surface-material-body-result';
// @ts-expect-error Dedicated codec copying is internal, not an optional public export.
import {copyPairedSurfaceMaterialBodyOwnData} from '@barocss/cad-interop/paired-surface-material-body-result';
// @ts-expect-error Codec work metrics are internal, not public API types.
import type {PairedSurfaceMaterialBodyOwnCopyMetrics} from '@barocss/cad-interop/paired-surface-material-body-result';
import {
  PairedSurfaceMaterialBodyError,
  type PairedSurfaceMaterialBodyResult, type PairedSurfaceMaterialBodyReport,
  type PairedSurfaceMaterialBodyRequest, type PairedSurfaceMaterialBodyOptions,
  type Model, type Curve, type Surface, type Point, type CurveD1Result, type SurfaceD1Result,
} from '@barocss/cad';

type Read = BaroCadPairedSurfaceMaterialBodyResultRead;
type Native = PairedSurfaceMaterialBodyResult;
// Request really is public in CAD; indexed native request remains compatible.
type Request = PairedSurfaceMaterialBodyRequest;
type Rational = Native['proof']['material']['volume']['exactVolumeMM3'];
type Equal<A,B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type ExactSurfaceChecks = [
  Assert<Equal<keyof Read, "native" | "validationReport" | "profile" | "sourceText">>,
  Assert<Equal<keyof Native, "request" | "closures" | "vertices" | "edges" | "faces" | "shell" | "body" | "proof" | "observations" | "report">>,
  Assert<Equal<keyof Request, "a" | "b" | "options">>,
  Assert<Equal<keyof PairedSurfaceMaterialBodyOptions, "evaluationId" | "resultIdPrefix" | "maximumClosures" | "maximumFaces" | "maximumEdgePairs" | "maximumObservations">>,
  Assert<Equal<BaroCadPairedSurfaceMaterialBodyDiagnosticCode, "INPUT" | "JSON" | "OWNED" | "BUDGET" | "SCHEMA" | "NATIVE">>,
  Assert<Equal<keyof Read['profile'], "schema" | "version" | "nativeSchema" | "nativeVersion" | "sourceFrame" | "worldLengthUnit" | "uvLengthUnit" | "parameterFrame" | "sourceQualification" | "ownership" | "d1Representation" | "nativeRequestBytes" | "limits" | "capabilities" | "geometryScope" | "volumeUnit" | "nativeRestrictedMaterialCertificate">>,
  Assert<Equal<keyof Read['profile']['limits'], "utf8Bytes" | "utf16Units" | "values" | "depth" | "recordFields" | "arrayElements" | "stringUnits" | "keyUnits">>,
  Assert<Equal<keyof Read['profile']['capabilities'], "nativeWholeValidation" | "copiedWholeReceipt" | "renderer" | "url" | "byteInput" | "publicSerializer" | "dispose" | "sourceEdit" | "sampling" | "intersectionConstruction" | "isoCurveConstruction" | "intervalExtraction" | "faceConstruction" | "worldPointMembership" | "topologyConstruction" | "directMaterialBodyConstruction" | "directSolidCertification" | "globalError" | "manufacturing" | "persistentNaming" | "editor" | "publication">>,
  Assert<Equal<keyof PairedSurfaceMaterialBodyError['context'], "phase" | "assetIndex" | "closureIndex" | "edgeIndex" | "observationIndex" | "directCounts">>,
 ];

export function publicSignatures(text:string,input:unknown) {
  const exactKeys:ExactSurfaceChecks = [true,true,true,true,true,true,true,true,true];
  const parse:(value:string)=>Read = parseBaroCadPairedSurfaceMaterialBodyResult;
  const read:(value:unknown)=>Read = readBaroCadPairedSurfaceMaterialBodyResult;
  const parsed:Read = parse(text), owned:Read = read(input);
  const native:Native = parsed.native, report:PairedSurfaceMaterialBodyReport = owned.validationReport;
  const exactTextOrNull:string|null = owned.sourceText;
  const compileUnknownArray:Read = readBaroCadPairedSurfaceMaterialBodyResult([]);
  // @ts-expect-error Text API requires primitive string.
  parseBaroCadPairedSurfaceMaterialBodyResult({});
  // @ts-expect-error Byte inputs are not a text API overload.
  parseBaroCadPairedSurfaceMaterialBodyResult(new Uint8Array(0));
  // @ts-expect-error Owned admission sourceText may be null.
  const requiredText:string = owned.sourceText;
  // @ts-expect-error Read4 has no URL method.
  parsed.loadFromUrl('https://example.invalid/body');
  // @ts-expect-error Native CPU data has no disposal method.
  parsed.dispose();
  // @ts-expect-error Reader exposes no serializer method.
  parsed.serialize();
  // @ts-expect-error Reader adds no World-point membership query.
  parsed.classifyWorldPoint([0,0,0]);
  // @ts-expect-error Reader exposes no engine renderer.
  parsed.renderer.render();
  // @ts-expect-error Reader exposes no direct Body construction API.
  parsed.buildBody({});
  // @ts-expect-error Reader exposes no direct Solid certification API.
  parsed.certifySolid({});
  // @ts-expect-error Read4 has no flattened Body property; full native.body remains retained.
  void parsed.body;
  void [exactKeys,parse,read,parsed,owned,native,report,exactTextOrNull,compileUnknownArray,requiredText];
}

export function completeMaterialBody(read:Read) {
  const native:Native = read.native, report:PairedSurfaceMaterialBodyReport = read.validationReport;
  const request:PairedSurfaceMaterialBodyRequest = native.request;
  const indexedRequest:Native['request'] = request;
  const options:PairedSurfaceMaterialBodyOptions = request.options;
  const closuresCap:4 = options.maximumClosures, facesCap:6 = options.maximumFaces;
  const pairsCap:12 = options.maximumEdgePairs, observationsCap:24 = options.maximumObservations;
  const parentA:Native['request']['a'] = request.a, parentB:Native['request']['b'] = request.b;
  const sectionA:Native['request']['a']['request']['section'] = parentA.request.section;
  const sectionB:Native['request']['b']['request']['section'] = parentB.request.section;
  const originalA:Model = sectionA.originalModels[0], originalB:Model = sectionB.originalModels[1];
  const surfaceA:Surface = sectionA.request.assets[0].surface, surfaceB:Surface = sectionB.request.assets[1].surface;
  const sourceA:string = sectionA.request.assets[0].source, sourceB:string = sectionB.request.assets[1].source;
  const trimmedA:Model = parentA.world.model, trimmedB:Model = parentB.world.model;
  const uvA:Curve = sectionA.pcurves.a.curve, uvB:Curve = sectionB.pcurves.b.curve;
  const closure:Native['closures'][number] = native.closures[0];
  const closureRole:'yMin'|'zMin'|'xMin'|'xMax' = closure.role;
  const lowCurve:Curve = closure.lowCurve;
  const ruled:Native['closures'][number]['ruled'] = closure.ruled;
  const ruledModel:Model = ruled.model;
  const faceBundle:Native['closures'][number]['face'] = closure.face;
  const faceIds:Native['closures'][number]['faceIds'] = closure.faceIds;
  const closureSource:string = closure.world.source, closureSourceId:string = closure.world.sourceId;
  const closureVersion:0 = closure.world.sourceVersion, closureModel:Model = closure.world.model;
  const vertex:Native['vertices'][number] = native.vertices[0];
  const vertexWorld:Point = vertex.world;
  const members:Native['vertices'][number]['members'] = vertex.members;
  const edge:Native['edges'][number] = native.edges[0];
  const edgeCurve:Curve = edge.curve, edgeRange:[number,number] = edge.parameterRange;
  const curveRef:Native['edges'][number]['curveRef'] = edge.curveRef;
  const curveSourceField:string = curveRef.sourceField, curveModelField:string = curveRef.modelField;
  const curveObjectId:string = curveRef.objectId, curveObjectIndex:number = curveRef.objectIndex;
  const use:Native['edges'][number]['uses'][number] = edge.uses[0];
  const sense:'forward'|'reverse' = use.sense;
  const localOrigin:Native['edges'][number]['uses'][number]['origin'] = use.origin;
  const localFaceKind:'a'|'b'|'closure' = localOrigin.face.kind;
  const localClosureIndex:number|null = localOrigin.face.closureIndex;
  const localUseId:string|null = localOrigin.useId;
  const localCurve:Curve = localOrigin.localCurve, localInterval:[number,number] = localOrigin.interval;
  const parameterMap:Native['edges'][number]['uses'][number]['parameterMap'] = use.parameterMap;
  const canonicalDomain:[number,number] = parameterMap.canonicalDomain;
  const localDomain:[number,number] = parameterMap.localDomain;
  const offset:Rational = parameterMap.offset, scale:Rational = parameterMap.scale;
  const endpointParameters:[number,number] = parameterMap.localEndpointParameters;
  const endpointResiduals:[Rational,Rational] = parameterMap.endpointResiduals;
  const entireCurveResiduals:Rational[][] = parameterMap.wholeCurveResiduals;
  const mapProofDegree:4 = parameterMap.proofDegree;
  const face:Native['faces'][number] = native.faces[0];
  const faceRole:'roof'|'side'|'yMin'|'zMin'|'xMin'|'xMax' = face.role;
  const support:Surface = face.support, supportRef:Native['faces'][number]['supportRef'] = face.supportRef;
  const loop:Native['faces'][number]['loop'] = face.loop;
  const loopUses:Native['faces'][number]['loop']['uses'] = loop.uses;
  const body:Native['body'] = native.body, shell:Native['shell'] = native.shell;
  const shellClosed:true = shell.closed, shellOriented:true = shell.oriented;
  const bodyClosed:true = body.closed, solid:true = body.solid, restricted:true = body.restrictedSolidCertified;
  const materialCertificateId:string = body.materialCertificateId;
  const schema:'barocss-paired-surface-material-body' = report.schema, version:0 = report.version;
  const vertexCount:8 = report.vertexCount, edgeCount:12 = report.edgeCount, faceCount:6 = report.faceCount;
  const loopCount:6 = report.loopCount, useCount:24 = report.useCount, edgePairCount:12 = report.edgePairCount;
  const vertexLinkCount:8 = report.vertexLinkCount, freeBoundary:0 = report.freeBoundaryCount;
  const noMasterModel:false = report.flattenedMasterModelProduced;
  const direct:PairedSurfaceMaterialBodyReport['directCounts'] = report.directCounts;
  const inherited:PairedSurfaceMaterialBodyReport['inheritedCounts'] = report.inheritedCounts;
  const realRootD0:number = direct.curveD0AttemptCount, delegations:number = direct.constructorDelegationCount;
  const newD1:0 = direct.curveD1AttemptCount, newSurfaceD0:0 = direct.surfaceD0AttemptCount;
  const newSurfaceD1:0 = direct.surfaceD1AttemptCount, newCompilation:0 = direct.sourceCompilationCount;
  const trueRestrictedSolid:true = report.quality.restrictedSolid;
  const trueManifold:true = report.quality.manifold, trueOccupiedRegion:true = report.quality.sourceDefinedOccupiedRegion;
  const falseGenericBoolean:false = report.quality.genericBoolean;
  const falseGeneralProperties:false = report.quality.generalCurvedSolidProperties;
  const volumeUnit:'mm3' = report.volumeUnit, lengthUnit:'mm' = report.lengthUnit, uvUnit:'dimensionless' = report.uvLengthUnit;
  const nativeRequestCap:8388608 = report.limits.requestBytes, nativeResultCap:16777216 = report.limits.resultBytes;
  // Supplied native and independent actual Report remain mutable; literal qualifiers stay constrained.
  native.request.options.maximumObservations = native.request.options.maximumObservations;
  native.closures[0].world.source = native.closures[0].world.source;
  native.edges[0].uses[0].parameterMap.offset.numerator = native.edges[0].uses[0].parameterMap.offset.numerator;
  native.body.solid = native.body.solid;
  report.maximumObservedEndpointGapMM = report.maximumObservedEndpointGapMM;
  report.quality.restrictedSolid = report.quality.restrictedSolid;
  // @ts-expect-error Public CAD Request requires both complete parent images.
  const missingParents:Request = {options};
  // @ts-expect-error Native Options selected cap is exactly4 closures.
  options.maximumClosures = 5;
  // @ts-expect-error Native true Solid is retained; it is not false generic operator metadata.
  native.body.solid = false;
  // @ts-expect-error Native true restricted certification cannot be downgraded as a false capability.
  report.quality.restrictedSolid = false;
  // @ts-expect-error Native supplied genericBoolean remains false.
  report.quality.genericBoolean = true;
  // @ts-expect-error NativeResult10 stores qualified Source worlds under parents/closures, no flattened root World.
  void native.world;
  // @ts-expect-error This full Body operation has no membership query list.
  void request.queries;
  void [indexedRequest,closuresCap,facesCap,pairsCap,observationsCap,originalA,originalB,surfaceA,surfaceB,sourceA,sourceB,
    trimmedA,trimmedB,uvA,uvB,closureRole,lowCurve,ruledModel,faceBundle,faceIds,closureSource,closureSourceId,closureVersion,
    closureModel,vertexWorld,members,edgeCurve,edgeRange,curveSourceField,curveModelField,curveObjectId,curveObjectIndex,sense,
    localFaceKind,localClosureIndex,localUseId,localCurve,localInterval,canonicalDomain,localDomain,offset,scale,endpointParameters,
    endpointResiduals,entireCurveResiduals,mapProofDegree,faceRole,support,supportRef,loopUses,shellClosed,shellOriented,bodyClosed,
    solid,restricted,materialCertificateId,schema,version,vertexCount,edgeCount,faceCount,loopCount,useCount,edgePairCount,vertexLinkCount,
    freeBoundary,noMasterModel,inherited,realRootD0,delegations,newD1,newSurfaceD0,newSurfaceD1,newCompilation,trueRestrictedSolid,
    trueManifold,trueOccupiedRegion,falseGenericBoolean,falseGeneralProperties,volumeUnit,lengthUnit,uvUnit,nativeRequestCap,nativeResultCap,missingParents];
}

export function completeProofAndObservations(native:Native) {
  const proof:Native['proof'] = native.proof;
  const correspondence:Native['proof']['correspondence'][number] = proof.correspondence[0];
  const wholeCurvePair:true = correspondence.exactWholeWorldImage, effectiveUses:true = correspondence.oppositeEffectiveUses;
  const vertexLink:Native['proof']['vertexLinks'][number] = proof.vertexLinks[0];
  const germs:Native['proof']['vertexLinks'][number]['germs'] = vertexLink.germs;
  const connected:true = vertexLink.connected, degreeTwo:true = vertexLink.degreeTwo;
  const material:Native['proof']['material'] = proof.material;
  const profile:Native['proof']['material']['profile'] = material.profile;
  const images:Native['proof']['material']['faceImages'] = material.faceImages;
  const image:Native['proof']['material']['faceImages'][number] = images[0];
  const cubeRestriction:'t=1'|'s=1'|'s=0'|'t=0'|'u=uMin'|'u=uMax' = image.cubeRestriction;
  const chartVariables:['u','s']|['u','t']|['s','t'] = image.chartVariables;
  const nativeUVPower:Rational[][][] = image.nativeUVPower;
  const actualImage:Rational[][][] = image.actualCartesian, expectedImage:Rational[][][] = image.expectedCartesian;
  const residuals:Rational[][][] = image.residuals;
  const originalSupport:Surface = image.originalSupport;
  const firstDegree:4 = image.proofDegrees.first, secondDegree:1 = image.proofDegrees.second;
  const exactImage:true = image.wholeImageEqual, unchangedUses:true = image.storedLocalUsesUnchanged;
  const outwardAxis:'x'|'y'|'z' = image.outward.axis, outwardSign:-1|1 = image.outward.sign;
  const outwardMinimum:Rational = image.outward.minimumAbsolute;
  const cube:Native['proof']['material']['cubeMap'] = material.cubeMap;
  const uDomain:[number,number] = cube.domain.u, sDomain:[0,1] = cube.domain.s, tDomain:[0,1] = cube.domain.t;
  const inverse:'u=X;s=(Y-lowY)/heightY(u);t=(Z-lowZ)/heightZ(u,s)' = cube.inverse;
  const injective:true = cube.globallyInjective;
  const heightsY:Rational[] = cube.heightYBernstein, heightsZ:Rational[][] = cube.heightZBernstein;
  const jacobian:Rational[][] = cube.jacobianBernstein;
  const minimumHeightY:Rational = cube.minimumHeightY, minimumHeightZ:Rational = cube.minimumHeightZ, minimumJacobian:Rational = cube.minimumJacobian;
  const volume:Native['proof']['material']['volume'] = material.volume;
  const exactVolume:Rational = volume.exactVolumeMM3, integrand:Rational[] = volume.integrandBernstein;
  const volumeDegree:8 = volume.degree, unit:'mm3' = volume.unit;
  const integrationResidual:Rational = volume.integrationResidual;
  const numerator:string = exactVolume.numerator, denominator:string = exactVolume.denominator;
  const occupied:true = material.sourceDefinedOccupiedRegion, outward:true = material.outwardMaterial;
  const storedRestricted:true = material.restrictedSolidCertified;
  const use = native.edges[0].uses[0];
  if (use.origin.pcurve.kind === 'native-curve') {
    const curve:Curve = use.origin.pcurve.curve;
    // @ts-expect-error Curve branch has no native-line endpoint tuple.
    void use.origin.pcurve.uv0;
    void curve;
  } else {
    const domain:[number,number] = use.origin.pcurve.domain, uv0:[number,number] = use.origin.pcurve.uv0, uv1:[number,number] = use.origin.pcurve.uv1;
    // @ts-expect-error Line branch has no native Curve object.
    void use.origin.pcurve.curve;
    void [domain,uv0,uv1];
  }
  const observation:Native['observations'][number] = native.observations[0];
  const canonical:Point = observation.canonicalPoint, vertexWorld:Point = observation.vertexWorld;
  const local:Native['observations'][number]['local'][number] = observation.local[0];
  const localPoint:Point = local.point, localParameter:number = local.parameter;
  const inheritedCurve:CurveD1Result = native.request.a.request.section.observations[0].world.d1;
  const inheritedSurface:SurfaceD1Result = native.request.b.request.section.observations[0].surfaceB.d1;
  const taggedSurface = native.request.a.observations[0].surface.d1;
  if (taggedSurface.status === 'evaluated') {const du:Point = taggedSurface.value.du;void du;}
  const inheritedChain:Point|null = native.request.b.observations[0].chain;
  // @ts-expect-error Body operation endpoint observations have no added D1 packet.
  void observation.d1;
  // @ts-expect-error Body operation endpoint observations have no normals.
  void observation.normal;
  // @ts-expect-error Actual inherited SurfaceD1 has no normal.
  void inheritedSurface.normal;
  // @ts-expect-error Full material volume is nested under proof.material.volume, not proof.volume.
  void proof.volume;
  void [wholeCurvePair,effectiveUses,germs,connected,degreeTwo,profile,cubeRestriction,chartVariables,nativeUVPower,actualImage,
    expectedImage,residuals,originalSupport,firstDegree,secondDegree,exactImage,unchangedUses,outwardAxis,outwardSign,outwardMinimum,
    uDomain,sDomain,tDomain,inverse,injective,heightsY,heightsZ,jacobian,minimumHeightY,minimumHeightZ,minimumJacobian,
    exactVolume,integrand,volumeDegree,unit,integrationResidual,numerator,denominator,occupied,outward,storedRestricted,
    canonical,vertexWorld,localPoint,localParameter,inheritedCurve,inheritedChain];
}

export function frozenProfile(read:Read) {
  const p:Read['profile'] = read.profile;
  const scalar_schema: "barocss-paired-surface-material-body-result-ingestion" = p.schema;
  // @ts-expect-error Frozen scalar schema rejects a same-value write.
  p.schema = p.schema;
  const scalar_version: 0 = p.version;
  // @ts-expect-error Frozen scalar version rejects a same-value write.
  p.version = p.version;
  const scalar_nativeSchema: "barocss-paired-surface-material-body" = p.nativeSchema;
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
  const scalar_parameterFrame: "original-a-u-v-b-u-v-and-material-u-s-t" = p.parameterFrame;
  // @ts-expect-error Frozen scalar parameterFrame rejects a same-value write.
  p.parameterFrame = p.parameterFrame;
  const scalar_sourceQualification: "six-separate-qualified-face-images-model-8-3-5-with-full-parents-and-closures" = p.sourceQualification;
  // @ts-expect-error Frozen scalar sourceQualification rejects a same-value write.
  p.sourceQualification = p.sourceQualification;
  const scalar_ownership: "independent-copied-cpu-data-gc" = p.ownership;
  // @ts-expect-error Frozen scalar ownership rejects a same-value write.
  p.ownership = p.ownership;
  const scalar_d1Representation: "inherited-tagged-and-direct-parent-no-new-body-d1" = p.d1Representation;
  // @ts-expect-error Frozen scalar d1Representation rejects a same-value write.
  p.d1Representation = p.d1Representation;
  const scalar_nativeRequestBytes: 8388608 = p.nativeRequestBytes;
  // @ts-expect-error Frozen scalar nativeRequestBytes rejects a same-value write.
  p.nativeRequestBytes = p.nativeRequestBytes;
  const scalar_geometryScope: "one-paired-curved-material-body-six-exact-qualified-boundary-images" = p.geometryScope;
  // @ts-expect-error Frozen scalar geometryScope rejects a same-value write.
  p.geometryScope = p.geometryScope;
  const scalar_volumeUnit: "mm3" = p.volumeUnit;
  // @ts-expect-error Frozen scalar volumeUnit rejects a same-value write.
  p.volumeUnit = p.volumeUnit;
  const scalar_nativeRestrictedMaterialCertificate: "retained-native-true" = p.nativeRestrictedMaterialCertificate;
  // @ts-expect-error Frozen scalar nativeRestrictedMaterialCertificate rejects a same-value write.
  p.nativeRestrictedMaterialCertificate = p.nativeRestrictedMaterialCertificate;
  const scalarValues:readonly ["barocss-paired-surface-material-body-result-ingestion", 0, "barocss-paired-surface-material-body", 0, "authored-xyz-no-axis-conversion", "mm", "dimensionless", "original-a-u-v-b-u-v-and-material-u-s-t", "six-separate-qualified-face-images-model-8-3-5-with-full-parents-and-closures", "independent-copied-cpu-data-gc", "inherited-tagged-and-direct-parent-no-new-body-d1", 8388608, "one-paired-curved-material-body-six-exact-qualified-boundary-images", "mm3", "retained-native-true"] = [p.schema, p.version, p.nativeSchema, p.nativeVersion, p.sourceFrame, p.worldLengthUnit, p.uvLengthUnit, p.parameterFrame, p.sourceQualification, p.ownership, p.d1Representation, p.nativeRequestBytes, p.geometryScope, p.volumeUnit, p.nativeRestrictedMaterialCertificate];
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
  const limitsValues:readonly [16777216, 16777216, 4194304, 64, 64, 8192, 262144, 128] = [p.limits.utf8Bytes, p.limits.utf16Units, p.limits.values, p.limits.depth, p.limits.recordFields, p.limits.arrayElements, p.limits.stringUnits, p.limits.keyUnits];
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
  const capabilities_directMaterialBodyConstruction: false = p.capabilities.directMaterialBodyConstruction;
  // @ts-expect-error Frozen capabilities.directMaterialBodyConstruction rejects a same-value write.
  p.capabilities.directMaterialBodyConstruction = p.capabilities.directMaterialBodyConstruction;
  const capabilities_directSolidCertification: false = p.capabilities.directSolidCertification;
  // @ts-expect-error Frozen capabilities.directSolidCertification rejects a same-value write.
  p.capabilities.directSolidCertification = p.capabilities.directSolidCertification;
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
  const capabilitiesValues:readonly [true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false] = [p.capabilities.nativeWholeValidation, p.capabilities.copiedWholeReceipt, p.capabilities.renderer, p.capabilities.url, p.capabilities.byteInput, p.capabilities.publicSerializer, p.capabilities.dispose, p.capabilities.sourceEdit, p.capabilities.sampling, p.capabilities.intersectionConstruction, p.capabilities.isoCurveConstruction, p.capabilities.intervalExtraction, p.capabilities.faceConstruction, p.capabilities.worldPointMembership, p.capabilities.topologyConstruction, p.capabilities.directMaterialBodyConstruction, p.capabilities.directSolidCertification, p.capabilities.globalError, p.capabilities.manufacturing, p.capabilities.persistentNaming, p.capabilities.editor, p.capabilities.publication];
  void [scalarValues,limitsValues,capabilitiesValues,scalar_schema, scalar_version, scalar_nativeSchema, scalar_nativeVersion, scalar_sourceFrame, scalar_worldLengthUnit, scalar_uvLengthUnit, scalar_parameterFrame, scalar_sourceQualification, scalar_ownership, scalar_d1Representation, scalar_nativeRequestBytes, scalar_geometryScope, scalar_volumeUnit, scalar_nativeRestrictedMaterialCertificate, limits_utf8Bytes, limits_utf16Units, limits_values, limits_depth, limits_recordFields, limits_arrayElements, limits_stringUnits, limits_keyUnits, capabilities_nativeWholeValidation, capabilities_copiedWholeReceipt, capabilities_renderer, capabilities_url, capabilities_byteInput, capabilities_publicSerializer, capabilities_dispose, capabilities_sourceEdit, capabilities_sampling, capabilities_intersectionConstruction, capabilities_isoCurveConstruction, capabilities_intervalExtraction, capabilities_faceConstruction, capabilities_worldPointMembership, capabilities_topologyConstruction, capabilities_directMaterialBodyConstruction, capabilities_directSolidCertification, capabilities_globalError, capabilities_manufacturing, capabilities_persistentNaming, capabilities_editor, capabilities_publication];
}

export function actualErrors(publicError:BaroCadPairedSurfaceMaterialBodyReadError,nativeError:PairedSurfaceMaterialBodyError) {
  const code:BaroCadPairedSurfaceMaterialBodyDiagnosticCode = publicError.code;
  const nativeCode:PairedSurfaceMaterialBodyError['code'] = nativeError.code;
  const context:PairedSurfaceMaterialBodyError['context'] = nativeError.context;
  const phase:PairedSurfaceMaterialBodyError['context']['phase'] = context.phase;
  const assetIndex:0|1|null = context.assetIndex;
  const closureIndex:number|null = context.closureIndex, edgeIndex:number|null = context.edgeIndex, observationIndex:number|null = context.observationIndex;
  const directCounts:PairedSurfaceMaterialBodyError['context']['directCounts'] = context.directCounts;
  const attemptedDelegations:number = directCounts.constructorDelegationCount;
  const publicCause:unknown = publicError.cause, nativeCause:unknown = nativeError.cause;
  const diagnostics:readonly ['INPUT','JSON','OWNED','BUDGET','SCHEMA','NATIVE'] = [
    BaroCadPairedSurfaceMaterialBodyDiagnosticCode.INPUT,BaroCadPairedSurfaceMaterialBodyDiagnosticCode.JSON,
    BaroCadPairedSurfaceMaterialBodyDiagnosticCode.OWNED,BaroCadPairedSurfaceMaterialBodyDiagnosticCode.BUDGET,
    BaroCadPairedSurfaceMaterialBodyDiagnosticCode.SCHEMA,BaroCadPairedSurfaceMaterialBodyDiagnosticCode.NATIVE,
  ];
  const wrapped = new BaroCadPairedSurfaceMaterialBodyReadError('NATIVE','compile-only',nativeError);
  // @ts-expect-error Public read error code is readonly even for same-value write.
  publicError.code = publicError.code;
  // @ts-expect-error Actual native error code is readonly even for same-value write.
  nativeError.code = nativeError.code;
  // @ts-expect-error Actual native context reference is readonly.
  nativeError.context = nativeError.context;
  // @ts-expect-error Frozen merged Diagnostic const rejects same-value write.
  BaroCadPairedSurfaceMaterialBodyDiagnosticCode.INPUT = BaroCadPairedSurfaceMaterialBodyDiagnosticCode.INPUT;
  // @ts-expect-error Public Diagnostic union has exactly six codes.
  const badCode:BaroCadPairedSurfaceMaterialBodyDiagnosticCode = 'INVALID';
  // @ts-expect-error This material Body context has observationIndex, not queryIndex.
  void context.queryIndex;
  // @ts-expect-error Error prefix counts are numbers, not guaranteed failed zero work.
  const failedZero:0 = directCounts.curveD0AttemptCount;
  void [code,nativeCode,phase,assetIndex,closureIndex,edgeIndex,observationIndex,attemptedDelegations,
    publicCause,nativeCause,diagnostics,wrapped,badCode,failedZero];
}
