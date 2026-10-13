import {
  parseBaroCadPairedSurfaceMaterialBodyWorldPointsResult,
  readBaroCadPairedSurfaceMaterialBodyWorldPointsResult,
  BaroCadPairedSurfaceMaterialBodyWorldPointsDiagnosticCode,
  BaroCadPairedSurfaceMaterialBodyWorldPointsReadError,
} from '@barocss/cad-interop/paired-surface-material-body-world-points-result';
import type {BaroCadPairedSurfaceMaterialBodyWorldPointsResultRead} from '@barocss/cad-interop/paired-surface-material-body-world-points-result';
import type {PairedSurfaceMaterialBodyWorldPointResult,PairedSurfaceMaterialBodyWorldPointReport} from '@barocss/cad';

function typeContract(text:string, input:unknown):void {
  const parsed:BaroCadPairedSurfaceMaterialBodyWorldPointsResultRead =
    parseBaroCadPairedSurfaceMaterialBodyWorldPointsResult(text);
  const owned:BaroCadPairedSurfaceMaterialBodyWorldPointsResultRead =
    readBaroCadPairedSurfaceMaterialBodyWorldPointsResult(input);
  const native:PairedSurfaceMaterialBodyWorldPointResult = parsed.native;
  const report:PairedSurfaceMaterialBodyWorldPointReport = owned.validationReport;
  const request:PairedSurfaceMaterialBodyWorldPointResult['request'] = native.request;
  const query:PairedSurfaceMaterialBodyWorldPointResult['request']['queries'][number] = request.queries[0]!;
  const position: [number,number,number] = query.pointMM;
  const value:'mm' = parsed.profile.worldLengthUnit;
  const diagnostic:'NATIVE' = BaroCadPairedSurfaceMaterialBodyWorldPointsDiagnosticCode.NATIVE;
  const error:Error = new BaroCadPairedSurfaceMaterialBodyWorldPointsReadError(diagnostic, 'test');
  void [report,position,value,error];

  // @ts-expect-error external Reader cannot mutate frozen metadata
  parsed.profile.schema = 'other';
  // @ts-expect-error external Reader cannot rewrite nested capability constants
  parsed.profile.capabilities.nativeWholeValidation = false;
  // @ts-expect-error no automatic file/byte loading API
  parsed.loadAsync('model.json');
  // @ts-expect-error Result4 has no invented root schema
  native.schema;
  // @ts-expect-error an XYZ query must be a 3-tuple
  const badXYZ: typeof query.pointMM = [0,1];
  void badXYZ;
}
void typeContract;
