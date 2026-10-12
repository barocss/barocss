// Run as a new Node process against a matching built @barocss/cad workspace.
import { readFileSync } from 'node:fs';
import { cad } from '@barocss/cad';
const filename = process.argv[2];
if (!filename) throw new Error('Pass a complete authored v2 JSON filename');
const rebuilt = cad.document.prismV2.parse(readFileSync(filename, 'utf8'));
const retained = rebuilt.chamfer.split.negative;
if (retained.kind !== 'solid') throw new Error('Expected finished selected component');
console.log(JSON.stringify({
  revision: rebuilt.document.revision,
  finishedSolidId: retained.solid.report.solidId,
  finishedVolumeMM3: retained.solid.certificate.volumeMM3,
  selectedParentSolidId: rebuilt.chamferResolution.parent.solidId,
  resolutionPolicy: rebuilt.chamferResolution.policy,
}, null, 2));
