import { CadAstError } from './source-ast.js';
import type { CadModelAst, CadAstDeclaration, CadAstValue, CadSourceRange } from './source-ast.js';
import type { Curve, Surface, Point } from '../types.js';
import { validateCurve, validateSurface } from '../math.js';
import { preflightExtrusion } from '../extrusion-validation.js';
import { copyCadData } from '../data-copy.js';
import { resolveCadParameters } from '../parameter-semantics.js';
import { resolveCadFunctionParameters } from '../function-quantity-semantics.js';
import type { CadResolvedFunction, CadFunctionCallReceipt, CadFunctionWork } from '../function-quantity-semantics.js';
import type { CadResolvedParameter, CadFieldBinding, CadParameterDependency } from '../parameter-semantics.js';
export { copyCadData } from '../data-copy.js';
export type { CadResolvedParameter, CadFieldBinding, CadQuantityKind, CadParameterDependency } from '../parameter-semantics.js';
export type { CadFunctionQuantity, CadResolvedFunction, CadFunctionCallReceipt, CadFunctionWork } from '../function-quantity-semantics.js';

export type CadLiteralIRNode = { id: string; span: CadSourceRange; fieldTypes: Record<string, string> } &
  ({ kind: 'curve'; geometry: Curve } | { kind: 'surface'; geometry: Surface });
export interface CadExtrudeIRNode {
  kind: 'extrude'; id: string; inputId: string; vector: Point;
  span: CadSourceRange; referenceSpan: CadSourceRange; fieldTypes: Record<string, string>;
}
export interface CadModelIR1 {
  schema: 'barocss-cad-ir'; schemaVersion: 1; sourceVersion: 0 | 1;
  name: string; lengthUnit: 'mm'; nodes: (CadLiteralIRNode | CadExtrudeIRNode)[];
  dependencies: { fromId: string; toId: string; kind: 'curve-input'; span: CadSourceRange }[];
}
export interface CadModelIR2 {
  schema: 'barocss-cad-ir'; schemaVersion: 2; sourceVersion: 2;
  name: string; lengthUnit: 'mm'; nodes: (CadLiteralIRNode | CadExtrudeIRNode)[];
  dependencies: (CadModelIR1['dependencies'][number] | CadParameterDependency)[];
  parameters: CadResolvedParameter[]; bindings: CadFieldBinding[];
}
export interface CadModelIR3 {
  schema: 'barocss-cad-ir'; schemaVersion: 3; sourceVersion: 3;
  name: string; lengthUnit: 'mm'; nodes: (CadLiteralIRNode | CadExtrudeIRNode)[];
  dependencies: (CadModelIR1['dependencies'][number] | CadParameterDependency)[];
  parameters: CadResolvedParameter[]; bindings: CadFieldBinding[];
  functions: CadResolvedFunction[]; calls: CadFunctionCallReceipt[]; work: CadFunctionWork;
}
export type CadModelIR = CadModelIR1 | CadModelIR2 | CadModelIR3;
function raw(value: CadAstValue): unknown {
  if (value.kind === 'array') return value.items.map(raw);
  if (value.kind === 'reference') return value.id;
  if (value.kind === 'number' || value.kind === 'identifier') return value.value;
  throw new CadAstError('TYPE', 'Resolved numeric values are required', value.range);
}
const zeroRange = (): CadSourceRange => ({ start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 });
function nativeCode(message: string): string {
  if (/^Degree /i.test(message)) return 'DEGREE';
  if (/knot|domain|multiplicity/i.test(message)) return 'KNOTS';
  if (/weight/i.test(message)) return 'WEIGHTS';
  if (/at most|exceed|1e6/i.test(message)) return 'LIMIT';
  if (/three|dimension|point/i.test(message)) return 'DIMENSION';
  return 'GEOMETRY';
}
function geometryRange(d: CadAstDeclaration, message: string): CadSourceRange {
  // The original surface validator does not identify U versus V in knot errors.
  // Retain the owning declaration rather than blame the other axis's valid field.
  if (d.kind === 'surface' && (nativeCode(message) === 'DEGREE' || nativeCode(message) === 'KNOTS')) return d.range;
  const keys = nativeCode(message) === 'DEGREE' ? ['degree'] : nativeCode(message) === 'KNOTS' ? ['knots'] : /weight/i.test(message) ? ['weights'] : ['control-points'];
  return d.fields.find(f => keys.includes(f.name))?.value.range ?? d.range;
}
/** Resolve original source data and preflight every feature before any lowering. */
function analyzeGeometry(ast: CadModelAst, sourceVersion: 0 | 1 | 2 | 3): { name: string; lengthUnit: 'mm'; nodes: (CadLiteralIRNode | CadExtrudeIRNode)[]; dependencies: CadModelIR1['dependencies'] } {
  const nodes: (CadLiteralIRNode | CadExtrudeIRNode)[] = [];
  const literals = new Map<string, CadLiteralIRNode>();
  const byId = new Map(ast.declarations.map(d => [d.id, d]));
  for (const declaration of ast.declarations) {
    if (declaration.kind === 'parameter') throw new CadAstError('TYPE', 'Unresolved parameter cannot enter geometry validation', declaration.range, declaration.id);
    if (declaration.kind === 'function') throw new CadAstError('TYPE', 'Unresolved function cannot enter geometry validation', declaration.range, declaration.id);
    if (declaration.kind === 'extrude') {
      if (!declaration.fields.some(f => f.name === 'curve') || !declaration.fields.some(f => f.name === 'vector')) throw new CadAstError('FIELD', 'Extrusion requires curve and vector fields', declaration.range, declaration.id);
      continue;
    }
    const props = new Map(declaration.fields.map(f => [f.name, f]));
    const keys = declaration.kind === 'curve' ? ['type', 'degree', 'knots', 'control-points', 'weights'] : ['type', 'degree-u', 'degree-v', 'knots-u', 'knots-v', 'control-points', 'weights'];
    for (const key of keys) if (!props.has(key)) throw new CadAstError('FIELD', 'Missing field ' + key, declaration.range, declaration.id);
    if (raw(props.get('type')!.value) !== 'nurbs') throw new CadAstError('VALUE', 'Only nurbs is supported', props.get('type')!.value.range, declaration.id);
    const get = (name: string) => raw(props.get(name)!.value);
    const geometry: Curve | Surface = declaration.kind === 'curve' ? {
      kind: 'curve', id: declaration.id, degree: get('degree') as number, knots: get('knots') as number[],
      controlPoints: get('control-points') as Point[], weights: get('weights') as number[],
    } : {
      kind: 'surface', id: declaration.id, degreeU: get('degree-u') as number, degreeV: get('degree-v') as number,
      knotsU: get('knots-u') as number[], knotsV: get('knots-v') as number[],
      controlPoints: get('control-points') as Point[][], weights: get('weights') as number[][],
    };
    try { if (geometry.kind === 'curve') validateCurve(geometry); else validateSurface(geometry); }
    catch (error) { const message = (error as Error).message; throw new CadAstError(nativeCode(message), message, geometryRange(declaration, message), declaration.id); }
    const suffix = declaration.kind === 'surface' ? '[][]' : '[]';
    const fieldTypes = Object.fromEntries(keys.map(key => [key, key === 'type' ? 'geometry-kind' : key.startsWith('degree') ? 'integer' : key.startsWith('knots') ? 'dimensionless[]' : key === 'control-points' ? 'mm-point3' + suffix : 'dimensionless' + suffix]));
    const fields = { id: declaration.id, span: { ...declaration.range }, fieldTypes };
    literals.set(declaration.id, geometry.kind === 'curve' ? { ...fields, kind: 'curve', geometry } : { ...fields, kind: 'surface', geometry });
  }
  const version = ast.fields.find(f => f.name === 'version'), unit = ast.fields.find(f => f.name === 'length-unit');
  if (!version || raw(version.value) !== sourceVersion) throw new CadAstError('VERSION', 'Declared source version must match sourceVersion: ' + sourceVersion, version?.value.range ?? zeroRange());
  if (!unit || raw(unit.value) !== 'mm') throw new CadAstError('UNIT', 'length-unit: mm is required', unit?.value.range ?? zeroRange());
  if (!ast.declarations.length) throw new CadAstError('GEOMETRY', 'Model must contain geometry', zeroRange(), undefined);
  const dependencies: CadModelIR1['dependencies'] = [];
  for (const declaration of ast.declarations) {
    if (declaration.kind !== 'extrude') { nodes.push(literals.get(declaration.id)!); continue; }
    const reference = declaration.fields.find(f => f.name === 'curve'), vectorField = declaration.fields.find(f => f.name === 'vector');
    if (!reference || !vectorField) throw new CadAstError('FIELD', 'Extrusion requires curve and vector fields', declaration.range, declaration.id);
    const inputId = raw(reference.value) as string, input = byId.get(inputId), vector = raw(vectorField.value) as Point;
    if (!input || input.kind !== 'curve') {
      const detail = !input ? 'Undefined curve reference ' + inputId : 'Reference ' + inputId + ' has kind ' + input.kind + '; a curve is required';
      throw new CadAstError('REFERENCE', detail, reference.value.range, declaration.id);
    }
    const curve = literals.get(inputId)!.geometry as Curve;
    try { preflightExtrusion(curve, { id: declaration.id, vector }); }
    catch (error) { const message = (error as Error).message; throw new CadAstError(nativeCode(message), message, vectorField.value.range, declaration.id); }
    nodes.push({ kind: 'extrude', id: declaration.id, inputId, vector: copyCadData(vector), span: { ...declaration.range }, referenceSpan: { ...reference.value.range }, fieldTypes: { curve: 'curve-reference', vector: 'mm-vector3' } });
    dependencies.push({ fromId: declaration.id, toId: inputId, kind: 'curve-input', span: { ...reference.value.range } });
  }
  return { name: ast.name, lengthUnit: 'mm', nodes, dependencies };
}

/** All references/quantities/native inputs resolve before any derived lowering. */
export function analyzeCadAst(ast: CadModelAst, sourceVersion: 0 | 1 | 2 | 3, _source: string): CadModelIR {
  if (sourceVersion === 3) {
    const resolved = resolveCadFunctionParameters(ast);
    const geometry = analyzeGeometry(resolved.ast, 3);
    const dependencies = [...geometry.dependencies, ...resolved.dependencies].sort((a, b) => a.span.start - b.span.start);
    return { schema: 'barocss-cad-ir', schemaVersion: 3, sourceVersion: 3, ...geometry, dependencies,
      parameters: resolved.parameters, bindings: resolved.bindings, functions: resolved.functions,
      calls: resolved.calls, work: resolved.work };
  }
  if (sourceVersion !== 2) {
    const geometry = analyzeGeometry(ast, sourceVersion);
    return { schema: 'barocss-cad-ir', schemaVersion: 1, sourceVersion, ...geometry };
  }
  const resolved = resolveCadParameters(ast);
  const geometry = analyzeGeometry(resolved.ast, 2);
  const dependencies = [...geometry.dependencies, ...resolved.dependencies].sort((a,b) => a.span.start - b.span.start);
  return { schema: 'barocss-cad-ir', schemaVersion: 2, sourceVersion: 2, ...geometry, dependencies,
    parameters: resolved.parameters, bindings: resolved.bindings };
}
