import {
  parseBaroCadSourceSurfaceKnotInsertion,
  readBaroCadSourceSurfaceKnotInsertion,
  BaroCadSourceSurfaceKnotInsertionReadError,
  BaroCadSourceSurfaceKnotInsertionDiagnosticCode,
} from '@barocss/cad-interop/source-surface-knot-insertion';
import type { BaroCadSourceSurfaceKnotInsertionRead } from '@barocss/cad-interop/source-surface-knot-insertion';
import type { SourceSurfaceKnotInsertionResult, SourceSurfaceKnotInsertionReport } from '@barocss/cad';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type Keys = Assert<Equal<keyof BaroCadSourceSurfaceKnotInsertionRead, 'native' | 'validationReport' | 'profile' | 'sourceText'>>;
type Native = Assert<Equal<BaroCadSourceSurfaceKnotInsertionRead['native'], SourceSurfaceKnotInsertionResult>>;
type Report = Assert<Equal<BaroCadSourceSurfaceKnotInsertionRead['validationReport'], SourceSurfaceKnotInsertionReport>>;
type Text = Assert<Equal<BaroCadSourceSurfaceKnotInsertionRead['sourceText'], string | null>>;
type Parse = Assert<Equal<Parameters<typeof parseBaroCadSourceSurfaceKnotInsertion>, [text: string]>>;
type Read = Assert<Equal<Parameters<typeof readBaroCadSourceSurfaceKnotInsertion>, [input: unknown]>>;
type Return = Assert<Equal<ReturnType<typeof parseBaroCadSourceSurfaceKnotInsertion>, BaroCadSourceSurfaceKnotInsertionRead>>;
type Codes = Assert<Equal<BaroCadSourceSurfaceKnotInsertionDiagnosticCode, 'INPUT' | 'JSON' | 'OWNED' | 'BUDGET' | 'SCHEMA' | 'NATIVE'>>;
declare const result: BaroCadSourceSurfaceKnotInsertionRead;
declare const error: BaroCadSourceSurfaceKnotInsertionReadError;
const exactBytes: 4194304 = result.profile.limits.utf8Bytes;
const exactValues: 1048576 = result.profile.limits.values;
const renderer: false = result.profile.capabilities.renderer;
const nativeSchema: 'barocss-source-surface-knot-insertion-report' = result.profile.nativeSchema;
const cause: unknown = error.cause;
// Same-value writes check readonly modifiers, independent of literal mismatch.
// @ts-expect-error immutable profile
result.profile.version = 0;
// @ts-expect-error immutable nested limits
result.profile.limits.utf8Bytes = 4194304;
// @ts-expect-error immutable nested capabilities
result.profile.capabilities.renderer = false;
// @ts-expect-error immutable diagnostic code
BaroCadSourceSurfaceKnotInsertionDiagnosticCode.NATIVE = 'NATIVE';
// Owned native/report remain mutable complete CAD values.
result.native.surface.controlPoints[0][0][0] = result.native.surface.controlPoints[0][0][0];
result.validationReport.version = 0;
void [exactBytes, exactValues, renderer, nativeSchema, cause];
export type PublicContract = [Keys, Native, Report, Text, Parse, Read, Return, Codes];
