/** Compile-only public consumer. The verifier reads these bytes as an actual published virtual .mts. Never invoke these functions. */
import {
  parseBaroCadPairedSurfaceIntersectionBranch,
  readBaroCadPairedSurfaceIntersectionBranch,
  BaroCadPairedSurfaceIntersectionBranchReadError,
  BaroCadPairedSurfaceIntersectionBranchDiagnosticCode,
} from '@barocss/cad-interop/paired-surface-intersection-branch';
import type { BaroCadPairedSurfaceIntersectionBranchRead } from '@barocss/cad-interop/paired-surface-intersection-branch';
import type {
  PairedSurfaceIntersectionBranchRequest,
  PairedSurfaceIntersectionBranchOptions,
  PairedSurfaceIntersectionBranchResult,
  PairedSurfaceIntersectionBranchReport,
  Model, Surface, SurfaceD1Result, Point,
} from '@barocss/cad';

type Equal<A,B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type ReadFields = Assert<Equal<keyof BaroCadPairedSurfaceIntersectionBranchRead,'native'|'validationReport'|'profile'|'sourceText'>>;
type NativeFields = Assert<Equal<keyof PairedSurfaceIntersectionBranchResult,'request'|'originalModels'|'observations'|'report'>>;
type RequestFields = Assert<Equal<keyof PairedSurfaceIntersectionBranchRequest,'assets'|'seed'|'uAStations'|'options'>>;
type OptionFields = Assert<Equal<keyof PairedSurfaceIntersectionBranchOptions,'evaluationId'|'maximumStations'|'maximumCorrectionsPerStation'|'maximumTrialsPerCorrection'|'maximumSurfacePointEvaluations'|'maximumSurfaceDerivativeAttempts'>>;
type DiagnosticValues = Assert<Equal<BaroCadPairedSurfaceIntersectionBranchDiagnosticCode,'INPUT'|'JSON'|'OWNED'|'BUDGET'|'SCHEMA'|'NATIVE'>>;
type Limits = BaroCadPairedSurfaceIntersectionBranchRead['profile']['limits'];
type Capabilities = BaroCadPairedSurfaceIntersectionBranchRead['profile']['capabilities'];
type LimitFields = Assert<Equal<keyof Limits,'utf8Bytes'|'utf16Units'|'values'|'depth'|'recordFields'|'arrayElements'|'stringUnits'|'keyUnits'>>;
type CapabilityFields = Assert<Equal<keyof Capabilities,'nativeWholeValidation'|'copiedWholeReceipt'|'renderer'|'url'|'byteInput'|'publicSerializer'|'dispose'|'sourceEdit'|'sampling'|'branchTracing'|'exactTrimCurve'|'pairedPcurve'|'allBranches'|'branchIdentityBetweenStations'|'globalError'|'topology'|'body'|'solid'|'manufacturing'|'publication'>>;
type Observation = PairedSurfaceIntersectionBranchResult['observations'][number];
type Correction = Observation['corrections'][number];
type Trial = Correction['trials'][number];

export function consumeNativeTypes(native:PairedSurfaceIntersectionBranchResult,report:PairedSurfaceIntersectionBranchReport):void {
  const request:PairedSurfaceIntersectionBranchRequest=native.request,options:PairedSurfaceIntersectionBranchOptions=request.options;
  const originalA:Model=native.originalModels[0],originalB:Model=native.originalModels[1];
  const surfaceA:Surface=request.assets[0].surface,surfaceB:Surface=request.assets[1].surface;
  const sourceA:string=request.assets[0].source,sourceB:string=request.assets[1].source;
  const idA:string=request.assets[0].sourceId,idB:string=request.assets[1].sourceId;
  const selectedA:PairedSurfaceIntersectionBranchReport['selections'][0]=report.selections[0],selectedB:PairedSurfaceIntersectionBranchReport['selections'][1]=report.selections[1];
  const sourceField:'request.assets.source'=selectedA.sourceField,modelField:'originalModels'=selectedB.modelField,sourceVersion:0=selectedA.sourceVersion;
  const uvA:[number,number]=request.seed.uvA,uvB:[number,number]=request.seed.uvB,station:number=request.uAStations[0];
  const observation:Observation=native.observations[0],nativeD1A:SurfaceD1Result=observation.d1A,nativeD1B:SurfaceD1Result=observation.d1B;
  const point:Point=nativeD1A.point,du:Point=nativeD1A.du,dv:Point=nativeD1A.dv;
  const worldA:Point=observation.pointA,worldB:Point=observation.pointB,normalA:Point=observation.normalEvidence.rawA,normalB:Point=observation.normalEvidence.unitB;
  const unknownOrder:['vA','uB','vB']=observation.chart.unknownOrder;
  const matrix:Point=observation.chart.jacobian[0],normalized:Point=observation.chart.normalizedMatrix[0];
  const pivot:Observation['chart']['pivots'][number]=observation.chart.pivots[0],swapped:[number,number]|null=pivot.swappedCurrentRows;
  const triangular:Point=observation.chart.upperTriangularMatrix[0],widths:[number,number,number]=observation.chart.domainWidths;
  const tangentA:Point=observation.tangentA,tangentB:Point=observation.tangentB,derivative:[number,number,number]=observation.originalParameterDerivative;
  const correction:Correction=observation.corrections[0],trial:Trial=correction.trials[0];
  const delta:[number,number,number]=correction.undampedDelta,correctionD1:SurfaceD1Result=correction.d1A;
  const solve:Correction['solve']=correction.solve,role:'newton'|'tangent'=solve.role;
  if(trial.status==='outside-domain') {
    const a:null=trial.pointA,b:null=trial.pointB,residual:null=trial.residual,armijo:null=trial.armijoLimitMM;void[a,b,residual,armijo];
  } else {
    const a:Point=trial.pointA,b:Point=trial.pointB,residual:Point=trial.residual.vectorMM,armijo:number=trial.armijoLimitMM;void[a,b,residual,armijo];
  }
  if(false) {
    native.request=request;report.stationCount=report.stationCount;native.originalModels[0].name=originalA.name;
    observation.uvA[0]=observation.uvA[0];surfaceA.controlPoints[0][0][0]=surfaceA.controlPoints[0][0][0];
    // @ts-expect-error Actual SurfaceD1 contains point/du/dv, not a synthesized normal field.
    const fakeNormal:Point=nativeD1A.normal;void fakeNormal;
  }
  void[options,originalA,originalB,surfaceA,surfaceB,sourceA,sourceB,idA,idB,selectedA,selectedB,sourceField,modelField,sourceVersion,uvA,uvB,station,nativeD1A,nativeD1B,point,du,dv,worldA,worldB,normalA,normalB,unknownOrder,matrix,normalized,pivot,swapped,triangular,widths,tangentA,tangentB,derivative,delta,correctionD1,role];
}

export function consumeRead(text:string,input:unknown):BaroCadPairedSurfaceIntersectionBranchRead {
  const parsed:BaroCadPairedSurfaceIntersectionBranchRead=parseBaroCadPairedSurfaceIntersectionBranch(text);
  const owned:BaroCadPairedSurfaceIntersectionBranchRead=readBaroCadPairedSurfaceIntersectionBranch(input);
  const native:PairedSurfaceIntersectionBranchResult=parsed.native,report:PairedSurfaceIntersectionBranchReport=parsed.validationReport;
  const sourceText:string|null=parsed.sourceText,ownedText:string|null=owned.sourceText,profile:BaroCadPairedSurfaceIntersectionBranchRead['profile']=parsed.profile;
  const profile_schema:'barocss-paired-surface-intersection-branch-ingestion'=profile.schema;void profile_schema;
  const profile_version:0=profile.version;void profile_version;
  const profile_nativeSchema:'barocss-seeded-paired-surface-intersection-branch'=profile.nativeSchema;void profile_nativeSchema;
  const profile_nativeVersion:0=profile.nativeVersion;void profile_nativeVersion;
  const profile_sourceFrame:'authored-xyz-no-axis-conversion'=profile.sourceFrame;void profile_sourceFrame;
  const profile_lengthUnit:'mm'=profile.lengthUnit;void profile_lengthUnit;
  const profile_parameterFrame:'original-native-u-v-domains'=profile.parameterFrame;void profile_parameterFrame;
  const profile_sourceQualification:'retained-asset-index-source-field-and-original-model-selection'=profile.sourceQualification;void profile_sourceQualification;
  const profile_ownership:'independent-copied-cpu-data-gc'=profile.ownership;void profile_ownership;
  const limit_utf8Bytes:4194304=profile.limits.utf8Bytes;void limit_utf8Bytes;
  const limit_utf16Units:4194304=profile.limits.utf16Units;void limit_utf16Units;
  const limit_values:1048576=profile.limits.values;void limit_values;
  const limit_depth:64=profile.limits.depth;void limit_depth;
  const limit_recordFields:64=profile.limits.recordFields;void limit_recordFields;
  const limit_arrayElements:8192=profile.limits.arrayElements;void limit_arrayElements;
  const limit_stringUnits:262144=profile.limits.stringUnits;void limit_stringUnits;
  const limit_keyUnits:128=profile.limits.keyUnits;void limit_keyUnits;
  const capability_nativeWholeValidation:true=profile.capabilities.nativeWholeValidation;void capability_nativeWholeValidation;
  const capability_copiedWholeReceipt:true=profile.capabilities.copiedWholeReceipt;void capability_copiedWholeReceipt;
  const capability_renderer:false=profile.capabilities.renderer;void capability_renderer;
  const capability_url:false=profile.capabilities.url;void capability_url;
  const capability_byteInput:false=profile.capabilities.byteInput;void capability_byteInput;
  const capability_publicSerializer:false=profile.capabilities.publicSerializer;void capability_publicSerializer;
  const capability_dispose:false=profile.capabilities.dispose;void capability_dispose;
  const capability_sourceEdit:false=profile.capabilities.sourceEdit;void capability_sourceEdit;
  const capability_sampling:false=profile.capabilities.sampling;void capability_sampling;
  const capability_branchTracing:false=profile.capabilities.branchTracing;void capability_branchTracing;
  const capability_exactTrimCurve:false=profile.capabilities.exactTrimCurve;void capability_exactTrimCurve;
  const capability_pairedPcurve:false=profile.capabilities.pairedPcurve;void capability_pairedPcurve;
  const capability_allBranches:false=profile.capabilities.allBranches;void capability_allBranches;
  const capability_branchIdentityBetweenStations:false=profile.capabilities.branchIdentityBetweenStations;void capability_branchIdentityBetweenStations;
  const capability_globalError:false=profile.capabilities.globalError;void capability_globalError;
  const capability_topology:false=profile.capabilities.topology;void capability_topology;
  const capability_body:false=profile.capabilities.body;void capability_body;
  const capability_solid:false=profile.capabilities.solid;void capability_solid;
  const capability_manufacturing:false=profile.capabilities.manufacturing;void capability_manufacturing;
  const capability_publication:false=profile.capabilities.publication;void capability_publication;
  if(false) {
    // Unknown-owned input accepts arrays in the type system; the runtime INPUT guard is tested separately.
    readBaroCadPairedSurfaceIntersectionBranch([]);
    native.report.stationCount=native.report.stationCount;report.stationCount=report.stationCount;
    // @ts-expect-error Parse accepts only primitive string input.
    parseBaroCadPairedSurfaceIntersectionBranch({});
    // @ts-expect-error Profile scalar schema is readonly; same-value write.
    profile.schema=profile.schema;
    // @ts-expect-error Profile scalar version is readonly; same-value write.
    profile.version=profile.version;
    // @ts-expect-error Profile scalar nativeSchema is readonly; same-value write.
    profile.nativeSchema=profile.nativeSchema;
    // @ts-expect-error Profile scalar nativeVersion is readonly; same-value write.
    profile.nativeVersion=profile.nativeVersion;
    // @ts-expect-error Profile scalar sourceFrame is readonly; same-value write.
    profile.sourceFrame=profile.sourceFrame;
    // @ts-expect-error Profile scalar lengthUnit is readonly; same-value write.
    profile.lengthUnit=profile.lengthUnit;
    // @ts-expect-error Profile scalar parameterFrame is readonly; same-value write.
    profile.parameterFrame=profile.parameterFrame;
    // @ts-expect-error Profile scalar sourceQualification is readonly; same-value write.
    profile.sourceQualification=profile.sourceQualification;
    // @ts-expect-error Profile scalar ownership is readonly; same-value write.
    profile.ownership=profile.ownership;
    // @ts-expect-error Limit utf8Bytes is deeply readonly; same-value write.
    profile.limits.utf8Bytes=profile.limits.utf8Bytes;
    // @ts-expect-error Limit utf16Units is deeply readonly; same-value write.
    profile.limits.utf16Units=profile.limits.utf16Units;
    // @ts-expect-error Limit values is deeply readonly; same-value write.
    profile.limits.values=profile.limits.values;
    // @ts-expect-error Limit depth is deeply readonly; same-value write.
    profile.limits.depth=profile.limits.depth;
    // @ts-expect-error Limit recordFields is deeply readonly; same-value write.
    profile.limits.recordFields=profile.limits.recordFields;
    // @ts-expect-error Limit arrayElements is deeply readonly; same-value write.
    profile.limits.arrayElements=profile.limits.arrayElements;
    // @ts-expect-error Limit stringUnits is deeply readonly; same-value write.
    profile.limits.stringUnits=profile.limits.stringUnits;
    // @ts-expect-error Limit keyUnits is deeply readonly; same-value write.
    profile.limits.keyUnits=profile.limits.keyUnits;
    // @ts-expect-error Capability nativeWholeValidation is deeply readonly; same-value write.
    profile.capabilities.nativeWholeValidation=profile.capabilities.nativeWholeValidation;
    // @ts-expect-error Capability copiedWholeReceipt is deeply readonly; same-value write.
    profile.capabilities.copiedWholeReceipt=profile.capabilities.copiedWholeReceipt;
    // @ts-expect-error Capability renderer is deeply readonly; same-value write.
    profile.capabilities.renderer=profile.capabilities.renderer;
    // @ts-expect-error Capability url is deeply readonly; same-value write.
    profile.capabilities.url=profile.capabilities.url;
    // @ts-expect-error Capability byteInput is deeply readonly; same-value write.
    profile.capabilities.byteInput=profile.capabilities.byteInput;
    // @ts-expect-error Capability publicSerializer is deeply readonly; same-value write.
    profile.capabilities.publicSerializer=profile.capabilities.publicSerializer;
    // @ts-expect-error Capability dispose is deeply readonly; same-value write.
    profile.capabilities.dispose=profile.capabilities.dispose;
    // @ts-expect-error Capability sourceEdit is deeply readonly; same-value write.
    profile.capabilities.sourceEdit=profile.capabilities.sourceEdit;
    // @ts-expect-error Capability sampling is deeply readonly; same-value write.
    profile.capabilities.sampling=profile.capabilities.sampling;
    // @ts-expect-error Capability branchTracing is deeply readonly; same-value write.
    profile.capabilities.branchTracing=profile.capabilities.branchTracing;
    // @ts-expect-error Capability exactTrimCurve is deeply readonly; same-value write.
    profile.capabilities.exactTrimCurve=profile.capabilities.exactTrimCurve;
    // @ts-expect-error Capability pairedPcurve is deeply readonly; same-value write.
    profile.capabilities.pairedPcurve=profile.capabilities.pairedPcurve;
    // @ts-expect-error Capability allBranches is deeply readonly; same-value write.
    profile.capabilities.allBranches=profile.capabilities.allBranches;
    // @ts-expect-error Capability branchIdentityBetweenStations is deeply readonly; same-value write.
    profile.capabilities.branchIdentityBetweenStations=profile.capabilities.branchIdentityBetweenStations;
    // @ts-expect-error Capability globalError is deeply readonly; same-value write.
    profile.capabilities.globalError=profile.capabilities.globalError;
    // @ts-expect-error Capability topology is deeply readonly; same-value write.
    profile.capabilities.topology=profile.capabilities.topology;
    // @ts-expect-error Capability body is deeply readonly; same-value write.
    profile.capabilities.body=profile.capabilities.body;
    // @ts-expect-error Capability solid is deeply readonly; same-value write.
    profile.capabilities.solid=profile.capabilities.solid;
    // @ts-expect-error Capability manufacturing is deeply readonly; same-value write.
    profile.capabilities.manufacturing=profile.capabilities.manufacturing;
    // @ts-expect-error Capability publication is deeply readonly; same-value write.
    profile.capabilities.publication=profile.capabilities.publication;
  }
  void[native,report,sourceText,ownedText];return parsed;
}

export function consumeError(error:unknown):unknown {
  if(error instanceof BaroCadPairedSurfaceIntersectionBranchReadError) {
    const code:BaroCadPairedSurfaceIntersectionBranchDiagnosticCode=error.code,cause:unknown=error.cause;
    const diagnostic_INPUT:'INPUT'=BaroCadPairedSurfaceIntersectionBranchDiagnosticCode.INPUT;void diagnostic_INPUT;
    const diagnostic_JSON:'JSON'=BaroCadPairedSurfaceIntersectionBranchDiagnosticCode.JSON;void diagnostic_JSON;
    const diagnostic_OWNED:'OWNED'=BaroCadPairedSurfaceIntersectionBranchDiagnosticCode.OWNED;void diagnostic_OWNED;
    const diagnostic_BUDGET:'BUDGET'=BaroCadPairedSurfaceIntersectionBranchDiagnosticCode.BUDGET;void diagnostic_BUDGET;
    const diagnostic_SCHEMA:'SCHEMA'=BaroCadPairedSurfaceIntersectionBranchDiagnosticCode.SCHEMA;void diagnostic_SCHEMA;
    const diagnostic_NATIVE:'NATIVE'=BaroCadPairedSurfaceIntersectionBranchDiagnosticCode.NATIVE;void diagnostic_NATIVE;
    if(false) {
      // @ts-expect-error Error code is readonly; same-value write.
      error.code=error.code;
      // @ts-expect-error Diagnostic constant is readonly; same-value write.
      BaroCadPairedSurfaceIntersectionBranchDiagnosticCode.NATIVE=BaroCadPairedSurfaceIntersectionBranchDiagnosticCode.NATIVE;
    }
    return[code,cause];
  }
  return null;
}
export type ContractShapes=[ReadFields,NativeFields,RequestFields,OptionFields,DiagnosticValues,LimitFields,CapabilityFields];
