import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileConstruction, evaluateCurveD1, evaluateSurfaceD1 } from '../../packages/barocss-cad/dist/index.js';

const [outputPath] = process.argv.slice(2);
if (!outputPath) throw new Error('Usage: node derivative-demo.mjs output-report.json');
const source = readFileSync(new URL('./extruded-asymmetric.css', import.meta.url),'utf8');
const compiled = compileConstruction(source), feature = compiled.constructions[0];
const curve = compiled.model.objects.find(object => object.id === feature.inputId);
const surface = compiled.model.objects.find(object => object.id === feature.outputId);
const samples = [2,2.5,3.5,7].map(u => ({u,v:.5,curve:evaluateCurveD1(curve,u),surface:evaluateSurfaceD1(surface,u,.5)}));
let exactKnotError;
try { evaluateSurfaceD1(surface,3,.5); } catch(error) { exactKnotError=error.message; }
if(!exactKnotError) throw new Error('Expected exact C0 knot refusal');
const report = {units:'mm per original dimensionless knot parameter',feature,
  degree:curve.degree,knots:curve.knots,samples,exactKnot:{u:3,error:exactKnotError},
  limitations:'Zero tangents are valid. No normal normalization, regularity or solid claim.'};
writeFileSync(resolve(outputPath),JSON.stringify(report,null,2)+'\n');
console.log(resolve(outputPath));
