import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileConstruction, tessellateSurface, exportIGES } from '../../packages/barocss-cad/dist/index.js';

// File access belongs to this host, never to model declarations.
const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath) throw new Error('Usage: node construction-demo.mjs source.css output-directory');
const source = readFileSync(resolve(sourcePath), 'utf8');
const compiled = compileConstruction(source);
const feature = compiled.constructions[0];
if (!feature) throw new Error('The demonstration requires an extrusion');
const surface = compiled.model.objects.find(object => object.id === feature.outputId);
const preview = tessellateSurface(surface, { countU: 17, countV: 9, revision: 505 });
const exchange = exportIGES(compiled.model, [feature.outputId]);
const output = resolve(outputPath);
mkdirSync(output, { recursive: true });
const json = value => JSON.stringify(value, null, 2) + '\n';
for (const [name, bytes] of Object.entries({
  'source.css': source, 'construction.json': json(compiled),
  'packet.json': json(preview.packet), 'preview-report.json': json(preview.report),
  'surface.iges': exchange.iges, 'export-report.json': json(exchange.report),
})) writeFileSync(resolve(output, name), bytes);
console.log(json({ inputId: feature.inputId, outputId: feature.outputId, output }));
