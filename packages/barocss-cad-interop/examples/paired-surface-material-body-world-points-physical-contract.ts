// Physical emitted declaration consumer: the import resolves to dist/*.d.ts,
// not the Interop source entrypoint. No runtime invocation.
import {
  parseBaroCadPairedSurfaceMaterialBodyWorldPointsResult as parse,
  readBaroCadPairedSurfaceMaterialBodyWorldPointsResult as read,
  BaroCadPairedSurfaceMaterialBodyWorldPointsReadError,
} from '../dist/paired-surface-material-body-world-points-result.js';
import type {
  BaroCadPairedSurfaceMaterialBodyWorldPointsResultRead,
} from '../dist/paired-surface-material-body-world-points-result.js';
import type {
  PairedSurfaceMaterialBodyWorldPointResult,
  PairedSurfaceMaterialBodyWorldPointReport,
} from '@barocss/cad';

function emittedContract(text: string, data: unknown) {
  const packet: BaroCadPairedSurfaceMaterialBodyWorldPointsResultRead = parse(text);
  const own: BaroCadPairedSurfaceMaterialBodyWorldPointsResultRead = read(data);
  const native: PairedSurfaceMaterialBodyWorldPointResult = packet.native;
  const report: PairedSurfaceMaterialBodyWorldPointReport = own.validationReport;
  const xyz: [number, number, number] = native.request.queries[0]!.pointMM;
  const units: 'mm' = packet.profile.worldLengthUnit;
  const failure: Error = new BaroCadPairedSurfaceMaterialBodyWorldPointsReadError('NATIVE', 'test');
  void [report, xyz, units, failure];

  // @ts-expect-error emitted profile must expose literal readonly fields
  packet.profile.sourceFrame = 'changed';
  // @ts-expect-error emitted nested capabilities must be readonly
  packet.profile.capabilities.renderer = true;
  // @ts-expect-error no byte/URL loader is exported through the Read4 packet
  packet.loadAsync('asset.json');
  // @ts-expect-error native Result4 has no root schema
  native.schema;
}
void emittedContract;
