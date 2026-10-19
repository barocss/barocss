// The runs of a DXF conformance case (conformance/r11b/<case>/case.json): its document under each of its
// option sets. An option set may say `"withoutSolidHatches": true` (R12 has no HATCH: the same document less them)
// or name its own `"documentFile"`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function caseRuns(c, dir) {
  const read = file => JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const base = c.input.document ?? read(c.input.documentFile);
  return c.input.options.map(({ withoutSolidHatches, documentFile, ...options }) => ({
    options,
    document: documentFile ? read(documentFile) : withoutSolidHatches ? { ...base, entities: base.entities.filter(e => !(e.type === 'hatch' && e.fill.kind === 'solid')) } : base,
    withoutSolidHatches: !!withoutSolidHatches,
  }));
}
