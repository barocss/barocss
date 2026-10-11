/** Compile-only ordinary public type consumer. Root reads these bytes as a published virtual .mts; never invoke these functions. */
import {
  parseBaroCadTranslatedStripPlaneSplitResult,
  readBaroCadTranslatedStripPlaneSplitResult,
  BaroCadTranslatedStripPlaneSplitReadError,
  BaroCadTranslatedStripPlaneSplitDiagnosticCode,
} from '@barocss/cad-interop/translated-strip-plane-split-result';
import type { BaroCadTranslatedStripPlaneSplitResultRead } from '@barocss/cad-interop/translated-strip-plane-split-result';
import { TranslatedStripPlaneSplitError } from '@barocss/cad';
import type {
  TranslatedStripPlaneSplitResult, TranslatedStripPlaneSplitRequest,
  TranslatedStripPlaneSplitOptions, TranslatedStripPlaneSplitReport,
  QualifiedTranslatedStripBodyResult, Model, Surface,
} from '@barocss/cad';

type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
type ReadFields=Assert<Equal<keyof BaroCadTranslatedStripPlaneSplitResultRead,'native'|'validationReport'|'profile'|'sourceText'>>;
type NativeFields=Assert<Equal<keyof TranslatedStripPlaneSplitResult,'request'|'cutModel'|'proof'|'outputs'|'bindings'|'report'>>;
type RequestFields=Assert<Equal<keyof TranslatedStripPlaneSplitRequest,'body'|'cutAsset'|'options'>>;
type OptionsFields=Assert<Equal<keyof TranslatedStripPlaneSplitOptions,'evaluationId'|'maximumOutputBodies'|'maximumProducerDelegations'|'outputRecipes'>>;
type DiagnosticValues=Assert<Equal<BaroCadTranslatedStripPlaneSplitDiagnosticCode,'INPUT'|'JSON'|'OWNED'|'BUDGET'|'SCHEMA'|'NATIVE'>>;
type Output=TranslatedStripPlaneSplitResult['outputs'][number];
type FaceLineage=TranslatedStripPlaneSplitResult['bindings']['faceLineage'][number];
type EdgeLineage=TranslatedStripPlaneSplitResult['bindings']['edgeLineage'][number];
type VertexLineage=TranslatedStripPlaneSplitResult['bindings']['vertexLineage'][number];
type CutBoundaryMap=TranslatedStripPlaneSplitResult['bindings']['cut']['boundaryMaps'][number];
type NativeContext=TranslatedStripPlaneSplitError['context'];
type Limits=BaroCadTranslatedStripPlaneSplitResultRead['profile']['limits'];
type Capabilities=BaroCadTranslatedStripPlaneSplitResultRead['profile']['capabilities'];
type LimitFields=Assert<Equal<keyof Limits,'utf8Bytes'|'utf16Units'|'values'|'depth'|'recordFields'|'arrayElements'|'stringUnits'|'keyUnits'>>;
type CapabilityFields=Assert<Equal<keyof Capabilities,'nativeWholeValidation'|'copiedWholeReceipt'|'renderer'|'url'|'byteInput'|'publicSerializer'|'dispose'|'sourceEdit'|'sampling'|'bodyConstruction'|'splitOperation'|'genericSplitBody'|'arbitraryPlaneCut'|'booleanOperation'|'globalError'|'newSolid'|'manufacturing'|'persistentNaming'|'editor'|'publication'>>;

export function consumeNative(native:TranslatedStripPlaneSplitResult,report:TranslatedStripPlaneSplitReport):void {
  const request:TranslatedStripPlaneSplitRequest=native.request,options:TranslatedStripPlaneSplitOptions=request.options;
  const original:QualifiedTranslatedStripBodyResult=request.body,first:Output=native.outputs[0],second:Output=native.outputs[1];
  const below:QualifiedTranslatedStripBodyResult=first.body,above:QualifiedTranslatedStripBodyResult=second.body;
  const originalModel:Model=original.models[0].model,belowModel:Model=below.models[0].model,aboveModel:Model=above.models[1].model,cutModel:Model=native.cutModel;
  const cutSurface:Surface=request.cutAsset.surface,cutSource:string=request.cutAsset.source,cutSourceId:string=request.cutAsset.sourceId;
  const outputIndex:0|1=first.index,side:'below-y'|'above-y'=first.side,maximumOutputs:2=options.maximumOutputBodies,maximumDelegations:22=options.maximumProducerDelegations;
  const bodySource:string=below.models[0].source,bodySourceId:string=below.models[0].sourceId,bodySourceVersion:0=below.models[0].sourceVersion;
  const originalBodyId:string=native.bindings.original.bodyId,cutRef=native.bindings.cut.source;
  const sourceField:typeof cutRef.sourceField=cutRef.sourceField,component:0|1|null=cutRef.componentIndex,objectId:string=cutRef.objectId,objectIndex:number=cutRef.objectIndex,modelName:string=cutRef.modelName;
  const face:FaceLineage=native.bindings.faceLineage[0],edge:EdgeLineage=native.bindings.edgeLineage[0],vertex:VertexLineage=native.bindings.vertexLineage[0],map:CutBoundaryMap=native.bindings.cut.boundaryMaps[0];
  const faceSource:string=face.original.support.sourceId,outputComponent:0|1|null=face.outputs[0].support.componentIndex;
  const parameterScale:string=map.parameterScale.numerator,parameterOffset:string=map.parameterOffset.numerator,denominator:string=map.parameterScale.denominator;
  const edgeScale:string=edge.outputs[0].nativeParameterScale.numerator,edgeSourceField:typeof edge.original.curve.sourceField=edge.original.curve.sourceField;
  const opposite:true=map.oppositeEffectiveUses,pointEqual:true=vertex.pointBitsEqual,world:number=vertex.output.world[0];
  const lowerY:string=native.proof.intervals.outputs[0].lowerY.numerator,upperY:string=native.proof.intervals.outputs[1].upperY.numerator;
  const actualVolume:string=native.proof.volume.actualOutputExactVolumeMM3[0].numerator,residual:string=native.proof.volume.conservationResidual.numerator;
  const volumeUnit:'mm3'=report.volumeUnit,materialConserved:true=report.quality.inputMaterialConserved,restrictedSplit:true=report.quality.restrictedSplitCertified,genericSplit:false=report.quality.genericSplitBody;
  const count:2=report.outputBodyCount,vertices:8=report.outputCounts[0].vertexCount,faces:6=report.outputCounts[1].faceCount,uses:24=report.outputCounts[0].useCount;
  if(false) {
    native.request=request;native.outputs[0].side=native.outputs[0].side;
    below.models[0].source=below.models[0].source;original.models[0].model.name=originalModel.name;
    report.evaluationId=report.evaluationId;report.outputBodyCount=report.outputBodyCount;
  }
  void[options,original,below,above,originalModel,belowModel,aboveModel,cutModel,cutSurface,cutSource,cutSourceId,outputIndex,side,maximumOutputs,maximumDelegations,bodySource,bodySourceId,bodySourceVersion,originalBodyId,sourceField,component,objectId,objectIndex,modelName,faceSource,outputComponent,parameterScale,parameterOffset,denominator,edgeScale,edgeSourceField,opposite,pointEqual,world,lowerY,upperY,actualVolume,residual,volumeUnit,materialConserved,restrictedSplit,genericSplit,count,vertices,faces,uses];
}

export function consumeRead(text:string,input:unknown):BaroCadTranslatedStripPlaneSplitResultRead {
  const parsed:BaroCadTranslatedStripPlaneSplitResultRead=parseBaroCadTranslatedStripPlaneSplitResult(text),owned:BaroCadTranslatedStripPlaneSplitResultRead=readBaroCadTranslatedStripPlaneSplitResult(input);
  const native:TranslatedStripPlaneSplitResult=parsed.native,report:TranslatedStripPlaneSplitReport=parsed.validationReport,sourceText:string|null=parsed.sourceText,ownedText:string|null=owned.sourceText;
  const profile:BaroCadTranslatedStripPlaneSplitResultRead['profile']=parsed.profile;
  const scalar_schema:'barocss-translated-strip-plane-split-result-ingestion'=profile.schema;void scalar_schema;
  const scalar_version:0=profile.version;void scalar_version;
  const scalar_nativeSchema:'barocss-translated-strip-plane-split'=profile.nativeSchema;void scalar_nativeSchema;
  const scalar_nativeVersion:0=profile.nativeVersion;void scalar_nativeVersion;
  const scalar_sourceFrame:'authored-xyz-no-axis-conversion'=profile.sourceFrame;void scalar_sourceFrame;
  const scalar_lengthUnit:'mm'=profile.lengthUnit;void scalar_lengthUnit;
  const scalar_parameterFrame:'retained-original-curve-and-surface-domains-with-dimensionless-uv'=profile.parameterFrame;void scalar_parameterFrame;
  const scalar_sourceQualification:'retained-source-field-component-index-and-original-model-selection'=profile.sourceQualification;void scalar_sourceQualification;
  const scalar_ownership:'independent-copied-cpu-data-gc'=profile.ownership;void scalar_ownership;
  const limit_utf8Bytes:12582912=profile.limits.utf8Bytes;void limit_utf8Bytes;
  const limit_utf16Units:12582912=profile.limits.utf16Units;void limit_utf16Units;
  const limit_values:4194304=profile.limits.values;void limit_values;
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
  const capability_bodyConstruction:false=profile.capabilities.bodyConstruction;void capability_bodyConstruction;
  const capability_splitOperation:false=profile.capabilities.splitOperation;void capability_splitOperation;
  const capability_genericSplitBody:false=profile.capabilities.genericSplitBody;void capability_genericSplitBody;
  const capability_arbitraryPlaneCut:false=profile.capabilities.arbitraryPlaneCut;void capability_arbitraryPlaneCut;
  const capability_booleanOperation:false=profile.capabilities.booleanOperation;void capability_booleanOperation;
  const capability_globalError:false=profile.capabilities.globalError;void capability_globalError;
  const capability_newSolid:false=profile.capabilities.newSolid;void capability_newSolid;
  const capability_manufacturing:false=profile.capabilities.manufacturing;void capability_manufacturing;
  const capability_persistentNaming:false=profile.capabilities.persistentNaming;void capability_persistentNaming;
  const capability_editor:false=profile.capabilities.editor;void capability_editor;
  const capability_publication:false=profile.capabilities.publication;void capability_publication;
  if(false) {
    // Unknown read input admits arrays at compile time; runtime INPUT rejection is tested by the verifier.
    readBaroCadTranslatedStripPlaneSplitResult([]);
    native.report.evaluationId=native.report.evaluationId;report.evaluationId=report.evaluationId;
    // @ts-expect-error Parse accepts only primitive string input.
    parseBaroCadTranslatedStripPlaneSplitResult({});
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
    // @ts-expect-error Capability bodyConstruction is deeply readonly; same-value write.
    profile.capabilities.bodyConstruction=profile.capabilities.bodyConstruction;
    // @ts-expect-error Capability splitOperation is deeply readonly; same-value write.
    profile.capabilities.splitOperation=profile.capabilities.splitOperation;
    // @ts-expect-error Capability genericSplitBody is deeply readonly; same-value write.
    profile.capabilities.genericSplitBody=profile.capabilities.genericSplitBody;
    // @ts-expect-error Capability arbitraryPlaneCut is deeply readonly; same-value write.
    profile.capabilities.arbitraryPlaneCut=profile.capabilities.arbitraryPlaneCut;
    // @ts-expect-error Capability booleanOperation is deeply readonly; same-value write.
    profile.capabilities.booleanOperation=profile.capabilities.booleanOperation;
    // @ts-expect-error Capability globalError is deeply readonly; same-value write.
    profile.capabilities.globalError=profile.capabilities.globalError;
    // @ts-expect-error Capability newSolid is deeply readonly; same-value write.
    profile.capabilities.newSolid=profile.capabilities.newSolid;
    // @ts-expect-error Capability manufacturing is deeply readonly; same-value write.
    profile.capabilities.manufacturing=profile.capabilities.manufacturing;
    // @ts-expect-error Capability persistentNaming is deeply readonly; same-value write.
    profile.capabilities.persistentNaming=profile.capabilities.persistentNaming;
    // @ts-expect-error Capability editor is deeply readonly; same-value write.
    profile.capabilities.editor=profile.capabilities.editor;
    // @ts-expect-error Capability publication is deeply readonly; same-value write.
    profile.capabilities.publication=profile.capabilities.publication;
  }
  void[native,report,sourceText,ownedText];return parsed;
}

export function consumeError(error:unknown):unknown {
  if(error instanceof BaroCadTranslatedStripPlaneSplitReadError) {
    const code:BaroCadTranslatedStripPlaneSplitDiagnosticCode=error.code,cause:unknown=error.cause;
    const diagnostic_INPUT:'INPUT'=BaroCadTranslatedStripPlaneSplitDiagnosticCode.INPUT;void diagnostic_INPUT;
    const diagnostic_JSON:'JSON'=BaroCadTranslatedStripPlaneSplitDiagnosticCode.JSON;void diagnostic_JSON;
    const diagnostic_OWNED:'OWNED'=BaroCadTranslatedStripPlaneSplitDiagnosticCode.OWNED;void diagnostic_OWNED;
    const diagnostic_BUDGET:'BUDGET'=BaroCadTranslatedStripPlaneSplitDiagnosticCode.BUDGET;void diagnostic_BUDGET;
    const diagnostic_SCHEMA:'SCHEMA'=BaroCadTranslatedStripPlaneSplitDiagnosticCode.SCHEMA;void diagnostic_SCHEMA;
    const diagnostic_NATIVE:'NATIVE'=BaroCadTranslatedStripPlaneSplitDiagnosticCode.NATIVE;void diagnostic_NATIVE;
    if(false) {
      // @ts-expect-error Diagnostic code is readonly; same-value write.
      error.code=error.code;
      // @ts-expect-error Diagnostic constant is readonly; same-value write.
      BaroCadTranslatedStripPlaneSplitDiagnosticCode.NATIVE=BaroCadTranslatedStripPlaneSplitDiagnosticCode.NATIVE;
    }
    if(cause instanceof TranslatedStripPlaneSplitError) {
      const actual:TranslatedStripPlaneSplitError=cause,context:NativeContext=actual.context,stage:NativeContext['stage']=context.stage,component:0|1|null=context.componentIndex;
      const originalValidation:number=context.directCounts.originalBodyValidationCount,construction:number=context.codecCounts.splitConstructionCount,nestedCause:unknown=actual.cause;
      return[code,stage,component,originalValidation,construction,nestedCause];
    }
    return[code,cause];
  }
  return null;
}
export type ContractShapes=[ReadFields,NativeFields,RequestFields,OptionsFields,DiagnosticValues,LimitFields,CapabilityFields];
