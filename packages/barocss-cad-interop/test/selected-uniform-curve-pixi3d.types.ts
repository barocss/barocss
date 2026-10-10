import { BaroCADSelectedUniformCurvePixi3DLoader } from '@barocss/cad-interop/pixi3d-selected-uniform-curve';
import type { BaroCadSelectedUniformCurvePixi3DResult, BaroCadLoadTransportOptions } from '@barocss/cad-interop/pixi3d-selected-uniform-curve';
import { validateBaroCadSelectedUniformCurveSourceOptions } from '@barocss/cad-interop/native-selected-uniform-curve';
import type { BaroCadSelectedUniformCurveSourceOptions } from '@barocss/cad-interop/native-selected-uniform-curve';
import type { Curve, Model, Point } from '@barocss/cad';
import type { Container3D, Mesh3D } from 'pixi3d/pixi7';

export function parseSelected(source: string, input: unknown): BaroCadSelectedUniformCurvePixi3DResult {
  const options: BaroCadSelectedUniformCurveSourceOptions = validateBaroCadSelectedUniformCurveSourceOptions(input);
  const result = new BaroCADSelectedUniformCurvePixi3DLoader(options).parse(source);
  const root: Container3D = result.root, mesh: Mesh3D = result.mesh;
  const model: Model = result.model, curve: Curve = result.curve, samples: Point[] = result.pointsMM;
  const sourceText: string = result.source, ordinal: number = result.selectedObjectIndex, siblings: string[] = result.unrenderedObjectIds;
  const domain: [number, number] = result.domain, positions: Float32Array = result.positions;
  const nativeMetadata: number[] = result.mesh.barocss.nativeParameters;
  void [root, mesh, model, curve, samples, sourceText, ordinal, siblings, domain, positions, nativeMetadata];
  result.dispose(); return result;
}
export async function loadSelected(url: string, signal: AbortSignal): Promise<BaroCadSelectedUniformCurvePixi3DResult> {
  const options: BaroCadSelectedUniformCurveSourceOptions = { sourceVersion: 0, unitsPerMillimeter: 0.001, curveId: 'target_curve', uniformCurveDisplay: { version: 1, count: 129 } };
  const transport: BaroCadLoadTransportOptions = { signal, onProgress(event) { const bytes: number = event.loadedBytes; return bytes > 0 ? undefined : false; } };
  return new BaroCADSelectedUniformCurvePixi3DLoader(options).loadAsync(url, transport);
}
// @ts-expect-error Original selection is an ID, not a Model ordinal.
const invalidID: BaroCadSelectedUniformCurveSourceOptions = { sourceVersion: 0, unitsPerMillimeter: 0.001, curveId: 1, uniformCurveDisplay: { version: 1, count: 129 } };
// @ts-expect-error Curve display requires explicit version1.
const invalidVersion: BaroCadSelectedUniformCurveSourceOptions = { sourceVersion: 0, unitsPerMillimeter: 0.001, curveId: 'target_curve', uniformCurveDisplay: { version: 2, count: 129 } };
// @ts-expect-error Shared transport accepts no headers option.
const invalidTransport: BaroCadLoadTransportOptions = { headers: {} };
void [invalidID, invalidVersion, invalidTransport];
