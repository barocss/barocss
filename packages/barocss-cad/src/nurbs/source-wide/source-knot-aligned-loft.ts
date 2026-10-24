import { compileCadModel } from '../../model-compiler.js';
import type { CadCompileResult } from '../../model-compiler.js';
import type { CadAstDeclaration, CadAstValue } from '../../language/source-ast.js';
import { validateCurve, curveDomain } from '../../core/math.js';
import { insertSourceCurveKnot } from './source-curve-knot-insertion.js';
import type { SourceCurveKnotInsertionResult } from './source-curve-knot-insertion.js';
import { buildPiecewiseRationalLoftSurface } from '../../features/piecewise-rational-loft.js';
import type { PiecewiseRationalLoftResult, PiecewiseRationalLoftReport } from '../../features/piecewise-rational-loft.js';
import type { Curve, Model } from '../../types.js';
import { same } from '../../core/structural-equality.js';
import { KernelError } from '../../core/barocss-error.js';

export const SourceKnotAlignedLoftDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', IDENTITY: 'IDENTITY', SOURCE: 'SOURCE', TARGET: 'TARGET',
  BASIS: 'BASIS', STATIONS: 'STATIONS', BUDGET: 'BUDGET', REPRESENTABILITY: 'REPRESENTABILITY',
  INSERTION: 'INSERTION', LOFT: 'LOFT', BINDING: 'BINDING', NATIVE: 'NATIVE', OWNED: 'OWNED', FILE: 'FILE',
} as const);
export type SourceKnotAlignedLoftDiagnosticCode =
  typeof SourceKnotAlignedLoftDiagnosticCode[keyof typeof SourceKnotAlignedLoftDiagnosticCode];
export class SourceKnotAlignedLoftError extends KernelError {
  readonly code: SourceKnotAlignedLoftDiagnosticCode;
  constructor(code: SourceKnotAlignedLoftDiagnosticCode, detail: string, cause?: unknown) {
    super(('Source knot-aligned Loft: ' + detail).slice(0, 1024),
      cause === undefined ? undefined : { cause });
    this.name = 'SourceKnotAlignedLoftError';
    this.code = code;
  }
}
type Triple<T> = [T, T, T];
type Asset = { sourceId: string; sourceVersion: 0; source: string; curveId: string };
export interface SourceKnotAlignedLoftOptions {
  evaluationId: string;
  constructionSourceId: string;
  modelName: string;
  surfaceId: string;
  constructionSectionIds: Triple<string>;
  maximumSections: 3;
  maximumAlignedUPoles: 16;
  maximumInsertionCalls: 28;
}
export interface SourceKnotAlignedLoftRequest {
  assets: Triple<Asset>;
  parametersV: Triple<number>;
  options: SourceKnotAlignedLoftOptions;
}
type SourceContext = { index: number; sourceId: string; sourceVersion: 0; source: string; model: Model };
type Insertion = { index: number; sectionIndex: number; knot: number; result: SourceCurveKnotInsertionResult };
type Multiplicity = {
  value: number;
  originalMultiplicities: Triple<number>;
  targetMultiplicity: number;
  deficits: Triple<number>;
};
type SectionPlan = { index: number; originalPoleCount: number; missingKnots: number[] };
type Plan = {
  degree: number;
  domain: [number, number];
  knots: number[];
  poleCount: number;
  multiplicities: Multiplicity[];
  sections: Triple<SectionPlan>;
  insertionCount: number;
};
type Reference = { sourceId: string; modelName: string; curveId: string; objectIndex: number };
type SectionBinding = {
  index: number;
  original: Reference;
  aligned: Reference;
  construction: Reference;
  coefficientsIdenticalToAligned: true;
};
type Bindings = {
  sections: Triple<SectionBinding>;
  output: { sourceId: string; modelName: string; surfaceId: string; objectIndex: 3 };
};
type Size = { utf16: number; utf8: number };
type InsertionCounts = {
  compileCount: number; nativeCurveValidationCount: number; domainQueryCount: number;
  coefficientInsertionCallCount: number; patchCount: number; decimalEmissionCount: number;
  observationCount: number; curveD0Count: number; curveD1AttemptCount: number;
  curveD1EvaluatedCount: number; curveD1RefusedCount: number;
};
export interface SourceKnotAlignedLoftReport {
  schema: 'barocss-source-knot-aligned-loft-report';
  version: 0;
  lengthUnit: 'mm';
  evaluationId: string;
  sectionCount: 3;
  sourceIds: Triple<string>;
  constructionSourceId: string;
  modelName: string;
  surfaceId: string;
  constructionSectionIds: Triple<string>;
  degreeU: number;
  degreeV: 1;
  domainU: [number, number];
  parametersV: Triple<number>;
  alignedUPoleCount: number;
  insertionCount: number;
  sectionInsertionCounts: Triple<number>;
  sourceSizes: { original: Triple<Size>; aligned: Triple<Size>; construction: Size };
  fileSizes: { request: Size; result: Size };
  directCounts: {
    originalCompileCount: 3; nativeCurveValidationCount: 3; domainQueryCount: 3;
    sourceInsertionCallCount: number; loftBuildCallCount: 1; constructionCopyCount: 3;
    curveD0Count: 0; curveD1AttemptCount: 0; surfaceD0Count: 0; surfaceD1AttemptCount: 0;
    rationalOperationCount: 0; childValidationCount: 0; loftValidationCount: 0;
  };
  delegatedCounts: {
    insertions: InsertionCounts;
    loft: PiecewiseRationalLoftReport['directCounts'];
    totalD0Count: number;
    totalD1AttemptCount: number;
    totalDecimalEmissionCount: number;
  };
  preservation: {
    completeOriginalSources: true; completeAlignedSources: true;
    originalModelMetadataAndSiblings: true; originalSelectedIds: true;
    alignedCommonBasis: true; constructionCopiesBitIdentical: true; parameterIdentity: true;
  };
  quality: {
    constructionOnly: true; globalShapeErrorCertified: false; globalBinary64ErrorCertified: false;
    smoothLoftCertified: false; g1g2Certified: false; topologyCertified: false; solid: false;
    manufacturingToleranceCertified: false; editorDisplayCertified: false;
    persistentTopologyBindingCertified: false; publication: false;
    ownership: 'independent-copied-cpu-data-gc';
  };
  limits: {
    maximumSections: 3; maximumDegree: 5; maximumAlignedUPoles: 16; maximumAlignedKnots: 22;
    maximumInsertionCalls: 28; maximumInsertionObservations: 662;
    maximumDelegatedD0Count: 1360; maximumDelegatedD1AttemptCount: 1339;
    maximumInsertionDecimalEmissions: 1711; maximumTotalDecimalEmissions: 2177;
    maximumModelObjects: 16; coordinateAbsMM: 10000;
    minimumWeight: 0.000001; maximumWeight: 1000000; sourceUTF16: 262144; sourceUTF8: 262144;
    maximumRequestUTF16: 2097152; maximumRequestUTF8: 2097152;
    maximumResultUTF16: 16777216; maximumResultUTF8: 16777216;
    ownValues: 4194304; ownDepth: 64; arrayElements: 8192; recordFields: 64;
    keyCharacters: 128; stringCharacters: 262144; identifierCharacters: 48;
  };
  workScope: 'direct-root-calls-and-delegated-provider-receipts-separated';
  budgetFailure: 'atomic-no-partial-source-aligned-loft';
}
export interface SourceKnotAlignedLoftResult {
  request: SourceKnotAlignedLoftRequest;
  originalSources: Triple<SourceContext>;
  alignedSections: Triple<SourceContext>;
  insertions: Insertion[];
  plan: Plan;
  loft: PiecewiseRationalLoftResult;
  bindings: Bindings;
  report: SourceKnotAlignedLoftReport;
}

const CODE = SourceKnotAlignedLoftDiagnosticCode;
function check(condition: boolean, code: SourceKnotAlignedLoftDiagnosticCode,
  detail: string): asserts condition {
  if (!condition) throw new SourceKnotAlignedLoftError(code, detail);
}
function delegated<T>(action: () => T, code: SourceKnotAlignedLoftDiagnosticCode,
  detail: string): T {
  try { return action(); }
  catch (cause) { throw new SourceKnotAlignedLoftError(code, detail, cause); }
}
function record(input: unknown, fields: string[],
  code: SourceKnotAlignedLoftDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), code,
    'An own record is required');
  const data = input as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    code, 'Exact own fields are required');
  return data;
}
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT;
  const budget = owned ? CODE.OWNED : CODE.BUDGET;
  let remaining = 4194304;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 64, budget, 'Own value or depth limit exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      check(Number.isFinite(value), code, 'Finite own numbers are required');
      return value;
    }
    if (typeof value === 'string') {
      check(value.length <= 262144, budget, 'Own string limit exceeded');
      return value;
    }
    check(typeof value === 'object' && !ancestors.has(value), code, 'Acyclic own data is required');
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      code, 'Plain own-data prototypes are required');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(value);
    check(keys.length <= (array ? 8193 : 64), budget, 'Own field limit exceeded');
    check(keys.every(key => typeof key === 'string' && key.length <= 128 &&
      'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable)),
    code, 'Getters, symbols and hidden fields are refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= 8192,
        budget, 'Own array limit exceeded');
      check(keys.length === length + 1, code, 'Dense arrays without extra fields are required');
      result = Array.from({ length }, (_, index) => {
        check(Object.hasOwn(descriptors, String(index)), code, 'Sparse arrays are refused');
        return copy(descriptors[String(index)].value, depth + 1);
      });
    } else {
      result = Object.fromEntries((keys as string[]).map(key =>
        [key, copy(descriptors[key].value, depth + 1)]));
    }
    ancestors.delete(value);
    return result;
  };
  return copy(input, 0);
}
function sourceSize(source: string): Size {
  const size = { utf16: source.length, utf8: new TextEncoder().encode(source).length };
  check(size.utf16 <= 262144 && size.utf8 <= 262144, CODE.BUDGET,
    'Complete Source0 exceeds262144 UTF16 units or UTF8 bytes');
  return size;
}
/** Count compact native JSON with original signed zeros and exactly one newline. */
function fileSize(input: unknown, limit = 16777216): Size {
  let utf16 = 0, utf8 = 0;
  const encoder = new TextEncoder();
  const append = (text: string): void => {
    utf16 += text.length;
    utf8 += encoder.encode(text).length;
    check(utf16 <= limit && utf8 <= limit, CODE.FILE,
      'Complete aggregate JSON exceeds its UTF16 or UTF8 limit');
  };
  const visit = (value: unknown): void => {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') {
      append(JSON.stringify(value));
    } else if (typeof value === 'number') {
      check(Number.isFinite(value), CODE.FILE, 'Finite JSON numbers are required');
      append(Object.is(value, -0) ? '-0' : JSON.stringify(value));
    } else if (Array.isArray(value)) {
      append('[');
      value.forEach((item, index) => { if (index) append(','); visit(item); });
      append(']');
    } else {
      check(value !== null && typeof value === 'object', CODE.FILE, 'Complete own JSON data is required');
      append('{');
      Object.entries(value).forEach(([key, item], index) => {
        if (index) append(',');
        append(JSON.stringify(key));
        append(':');
        visit(item);
      });
      append('}');
    }
  };
  visit(input);
  append('\n');
  return { utf16, utf8 };
}
function compile(source: string, stage: string): Extract<CadCompileResult, { ok: true }> {
  const result = delegated(() => compileCadModel(source, { sourceVersion: 0 }), CODE.SOURCE,
    'Actual ' + stage + ' complete Source0 compilation failed');
  if (!result.ok) throw new SourceKnotAlignedLoftError(CODE.SOURCE,
    'Actual ' + stage + ' complete Source0 compilation refused', result);
  return result;
}

function id(value: unknown): asserts value is string {
  check(typeof value === 'string' && value.length <= 48 &&
    /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'ASCII ID1..48 is required');
}
function triple<T>(value: T[]): Triple<T> {
  check(value.length === 3, CODE.BINDING, 'Exactly three ordered entries are required');
  return value as Triple<T>;
}
function selectedCurve(context: SourceContext, curveId: string): { curve: Curve; objectIndex: number } {
  const objectIndex = context.model.objects.findIndex(object => object.id === curveId);
  const curve = context.model.objects[objectIndex];
  check(curve !== undefined && curve.kind === 'curve', CODE.TARGET,
    'Selected original ID must identify an actual literal Curve');
  return { curve, objectIndex };
}
function coefficientBits(curve: Curve): unknown {
  return { kind: curve.kind, degree: curve.degree, knots: curve.knots,
    controlPoints: curve.controlPoints, weights: curve.weights };
}
function preflightWriterArrays(source: string, declaration: CadAstDeclaration, curve: Curve): void {
  for (const field of ['knots', 'control-points', 'weights']) {
    const fields = declaration.fields.filter(value => value.name === field);
    check(fields.length === 1 && fields[0].value.kind === 'array', CODE.TARGET,
      'Required insertion arrays must be directly authored');
    const node = fields[0].value;
    check(!source.slice(node.range.start, node.range.end).includes('/*'), CODE.TARGET,
      'Comments inside required insertion array ranges are refused');
    const bind = (value: CadAstValue, expected: number | number[], start: number, end: number): void => {
      check(Number.isInteger(value.range.start) && Number.isInteger(value.range.end) &&
        value.range.start >= start && value.range.start < value.range.end && value.range.end <= end,
      CODE.BINDING, 'Selected original AST numeric range is invalid');
      if (Array.isArray(expected)) {
        check(value.kind === 'array' && value.items.length === expected.length, CODE.TARGET,
          'Actual insertion array counts must match native coefficients');
        value.items.forEach((item, index) => bind(item, expected[index], value.range.start, value.range.end));
      } else {
        check(value.kind === 'number', CODE.TARGET, 'Required insertion leaves must be numeric literals');
        const lexeme = source.slice(value.range.start, value.range.end);
        check(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(lexeme) &&
          Object.is(Number(lexeme), value.value) && Object.is(value.value, expected), CODE.BINDING,
        'Required original source/AST/native bits disagree');
      }
    };
    const values = field === 'knots' ? curve.knots : field === 'weights' ? curve.weights : curve.controlPoints;
    check(node.items.length === values.length && node.range.start >= declaration.range.start &&
      node.range.end <= declaration.range.end && node.range.start >= 0 && node.range.end <= source.length,
    CODE.BINDING, 'Required array must bind actual declaration and source bounds');
    node.items.forEach((item, index) => bind(item, values[index], node.range.start, node.range.end));
  }
}
function unionPlan(curves: Triple<Curve>, domains: Triple<[number, number]>): Plan {
  const first = curves[0], degree = first.degree, domain = domains[0];
  check(curves.every(curve => curve.degree === degree) && domains.every(value => same(value, domain)),
    CODE.BASIS, 'All selected original degree and domain bits must agree');
  check(Number.isFinite(domain[1] - domain[0]) && domain[1] > domain[0], CODE.BASIS,
    'Full original U span must be finite and positive');
  const leftClamp = first.knots.slice(0, degree + 1);
  const rightClamp = first.knots.slice(first.controlPoints.length);
  check(curves.every(curve => same(curve.knots.slice(0, degree + 1), leftClamp) &&
    same(curve.knots.slice(curve.controlPoints.length), rightClamp)), CODE.BASIS,
  'Original endpoint clamp slots must agree bit for bit');
  const classes: { value: number; counts: Triple<number> }[] = [];
  curves.forEach((curve, sectionIndex) => {
    for (const value of curve.knots.slice(degree + 1, curve.controlPoints.length)) {
      let entry = classes.find(item => item.value === value);
      if (entry === undefined) { entry = { value, counts: [0, 0, 0] }; classes.push(entry); }
      check(Object.is(entry.value, value), CODE.BASIS, 'Numeric-equal knot donors must agree in represented bits');
      entry.counts[sectionIndex]++;
    }
  });
  classes.sort((a, b) => a.value < b.value ? -1 : a.value > b.value ? 1 : 0);
  const multiplicities: Multiplicity[] = classes.map(entry => {
    const targetMultiplicity = Math.max(...entry.counts);
    check(targetMultiplicity <= degree, CODE.BASIS, 'Union knot multiplicity exceeds degree');
    return { value: entry.value, originalMultiplicities: entry.counts, targetMultiplicity,
      deficits: triple(entry.counts.map(count => targetMultiplicity - count)) };
  });
  const interior = multiplicities.flatMap(item => Array<number>(item.targetMultiplicity).fill(item.value));
  const knots = [...leftClamp, ...interior, ...rightClamp];
  const poleCount = degree + 1 + interior.length;
  check(poleCount <= 16 && knots.length <= 22, CODE.BUDGET,
    'Complete union basis exceeds unchanged Loft U16/knots22 capacity');
  const sections = triple(curves.map((curve, index): SectionPlan => ({
    index, originalPoleCount: curve.controlPoints.length,
    missingKnots: multiplicities.flatMap(item => Array<number>(item.deficits[index]).fill(item.value)),
  })));
  const insertionCount = sections.reduce((sum, section) => sum + section.missingKnots.length, 0);
  check(sections.every(section => section.originalPoleCount + section.missingKnots.length === poleCount) &&
    insertionCount <= 2 * interior.length && insertionCount <= 2 * (15 - degree) && insertionCount <= 28,
  CODE.BUDGET, 'Actual donor union insertion bound is inconsistent');
  return { degree, domain, knots, poleCount, multiplicities, sections, insertionCount };
}
function guardPrefix(request: SourceKnotAlignedLoftRequest, originalSources: Triple<SourceContext>,
  alignedSections: Triple<SourceContext>, insertions: Insertion[], plan: Plan): void {
  // Full repeated source and child occurrences are charged; no partial public result is returned.
  const prefix = { request, originalSources, alignedSections, insertions, plan };
  snapshot(prefix);
  fileSize(prefix);
}

/** Align three complete source branches through public insertion, then build a real rational Loft. */
export function buildSourceKnotAlignedLoft(input: SourceKnotAlignedLoftRequest): SourceKnotAlignedLoftResult {
  const data = record(snapshot(input), ['assets', 'parametersV', 'options']);
  const settings = record(data.options, ['evaluationId', 'constructionSourceId', 'modelName', 'surfaceId',
    'constructionSectionIds', 'maximumSections', 'maximumAlignedUPoles', 'maximumInsertionCalls']);
  for (const field of ['evaluationId', 'constructionSourceId', 'modelName', 'surfaceId']) id(settings[field]);
  check(settings.maximumSections === 3 && settings.maximumAlignedUPoles === 16 &&
    settings.maximumInsertionCalls === 28, CODE.BUDGET, 'Complete fixed wrapper budgets3/16/28 are required');
  check(Array.isArray(settings.constructionSectionIds) && settings.constructionSectionIds.length === 3,
    CODE.IDENTITY, 'Three explicit construction section IDs are required');
  settings.constructionSectionIds.forEach(id);
  check(new Set([...settings.constructionSectionIds, settings.surfaceId]).size === 4, CODE.IDENTITY,
    'Three construction Curves and Surface must have distinct IDs in the new Model');
  check(Array.isArray(data.assets) && data.assets.length === 3, CODE.BUDGET,
    'Exactly three ordered complete source assets are required');
  data.assets.forEach(raw => {
    const asset = record(raw, ['sourceId', 'sourceVersion', 'source', 'curveId']);
    id(asset.sourceId); id(asset.curveId);
    check(asset.sourceVersion === 0, CODE.VERSION, 'Every original asset must be literal Source0');
    check(typeof asset.source === 'string', CODE.INPUT, 'Every complete original source is required');
  });
  const request = data as unknown as SourceKnotAlignedLoftRequest;
  const options = request.options;
  check(new Set(request.assets.map(asset => asset.sourceId)).size === 3 &&
    request.assets.every(asset => asset.sourceId !== options.constructionSourceId), CODE.IDENTITY,
  'Three original source IDs and the new construction source ID must be distinct');
  check(Array.isArray(request.parametersV) && request.parametersV.length === 3 &&
    request.parametersV.every(value => typeof value === 'number' && Number.isFinite(value)), CODE.STATIONS,
  'Exactly three ordered finite V stations are required');
  const v = request.parametersV;
  check(v[1] > v[0] && v[2] > v[1] && Number.isFinite(v[1] - v[0]) &&
    Number.isFinite(v[2] - v[1]) && Number.isFinite(v[2] - v[0]), CODE.STATIONS,
  'All adjacent and full V spans must be finite and strictly positive');
  const requestSize = fileSize(request, 2097152);
  const originalSizes = triple(request.assets.map(asset => sourceSize(asset.source)));
  const compiled = triple(request.assets.map(asset => compile(asset.source, 'original')));
  const originalSources = triple(compiled.map((result, index): SourceContext => ({
    index, sourceId: request.assets[index].sourceId, sourceVersion: 0,
    source: request.assets[index].source, model: result.model,
  })));
  const selected = triple(originalSources.map((context, index) => selectedCurve(context, request.assets[index].curveId)));
  const curves = triple(selected.map(value => value.curve));
  const domains = triple(curves.map(curve => {
    check(curve.degree >= 1 && curve.degree <= 5 && curve.controlPoints.length >= curve.degree + 1 &&
      curve.controlPoints.length <= 16 && curve.controlPoints.every(point =>
        point.every(value => Math.abs(value) <= 10000)), CODE.BUDGET,
    'Original selected sections must fit degree1..5/U16/10000mm');
    delegated(() => validateCurve(curve), CODE.NATIVE, 'Actual selected original Curve validation refused');
    return delegated(() => curveDomain(curve), CODE.NATIVE, 'Actual selected original domain query refused');
  }));
  const plan = unionPlan(curves, domains);
  selected.forEach((value, index) => {
    const declarations = compiled[index].ast.declarations.filter(item => item.id === value.curve.id);
    const nodes = compiled[index].ir.nodes.filter(item => item.id === value.curve.id);
    check(declarations.length === 1 && declarations[0].kind === 'curve' && nodes.length === 1 &&
      nodes[0].kind === 'curve' && same(nodes[0].geometry, value.curve) &&
      same(nodes[0].span, declarations[0].range), CODE.BINDING, 'Actual original source/AST/IR binding is required');
    if (plan.sections[index].missingKnots.length > 0) {
      preflightWriterArrays(request.assets[index].source, declarations[0], value.curve);
    }
  });
  const alignedSections = snapshot(originalSources) as Triple<SourceContext>;
  const insertions: Insertion[] = [];
  guardPrefix(request, originalSources, alignedSections, insertions, plan);
  for (const section of plan.sections) {
    for (const knot of section.missingKnots) {
      guardPrefix(request, originalSources, alignedSections, insertions, plan);
      const previous = alignedSections[section.index];
      const result = delegated(() => insertSourceCurveKnot({ source: previous.source, sourceVersion: 0,
        curveId: request.assets[section.index].curveId, knot, maximumObservations: 128 }), CODE.INSERTION,
      'Actual complete-source single insertion refused');
      check(result.request.source === previous.source && same(result.originalModel, previous.model) &&
        result.curve.id === request.assets[section.index].curveId &&
        result.provenance.selectedObjectIndex === selected[section.index].objectIndex, CODE.BINDING,
      'Actual insertion must continue its complete preceding source branch');
      const expectedModel = snapshot(previous.model) as Model;
      expectedModel.objects[selected[section.index].objectIndex] = result.curve;
      check(same(result.model, expectedModel) && result.curve.degree === plan.degree &&
        same(result.report.domain, plan.domain), CODE.BINDING,
      'Actual source branch must preserve full sibling/metadata/ID/domain bits');
      alignedSections[section.index] = { index: section.index, sourceId: previous.sourceId,
        sourceVersion: 0, source: result.source, model: result.model };
      insertions.push({ index: insertions.length, sectionIndex: section.index, knot, result });
      guardPrefix(request, originalSources, alignedSections, insertions, plan);
    }
  }
  check(insertions.length === plan.insertionCount, CODE.BINDING, 'Actual insertion call count disagrees with union plan');
  const aligned = triple(alignedSections.map((context, index) =>
    selectedCurve(context, request.assets[index].curveId)));
  aligned.forEach(value => check(value.curve.degree === plan.degree &&
    value.curve.controlPoints.length === plan.poleCount && same(value.curve.knots, plan.knots), CODE.BINDING,
  'All actual aligned sections must have exact common native basis')); 
  const constructionCopies = triple(aligned.map((value, index): Curve => {
    const copy = snapshot(value.curve) as Curve;
    copy.id = options.constructionSectionIds[index];
    check(same(coefficientBits(copy), coefficientBits(value.curve)), CODE.BINDING,
      'Explicit construction copy must change only its new context ID');
    return copy;
  }));
  const loft = delegated(() => buildPiecewiseRationalLoftSurface(constructionCopies, request.parametersV, {
    surfaceId: options.surfaceId, modelName: options.modelName, maximumSections: 15, maximumUPoles: 16,
    maximumPointObservations: 87, maximumDerivativeObservations: 87,
  }), CODE.LOFT, 'Actual independently weighted common-basis rational Loft refused');
  check(loft.model.objects.length === 4 && loft.surface.id === options.surfaceId &&
    loft.model.name === options.modelName && same(loft.parametersV, request.parametersV) &&
    same(loft.surface.knotsU, plan.knots) && same(loft.report.domains.u, plan.domain), CODE.BINDING,
  'Actual new Loft context must retain the requested construction identities and native basis');
  loft.sections.forEach((curve, index) => check(same(curve, constructionCopies[index]), CODE.BINDING,
    'Actual compiled construction section must preserve every explicit copy bit'));
  const bindings: Bindings = {
    sections: triple(aligned.map((value, index): SectionBinding => ({
      index,
      original: { sourceId: originalSources[index].sourceId, modelName: originalSources[index].model.name,
        curveId: curves[index].id, objectIndex: selected[index].objectIndex },
      aligned: { sourceId: alignedSections[index].sourceId, modelName: alignedSections[index].model.name,
        curveId: value.curve.id, objectIndex: value.objectIndex },
      construction: { sourceId: options.constructionSourceId, modelName: loft.model.name,
        curveId: loft.sections[index].id, objectIndex: index }, coefficientsIdenticalToAligned: true,
    }))),
    output: { sourceId: options.constructionSourceId, modelName: loft.model.name,
      surfaceId: loft.surface.id, objectIndex: 3 },
  };
  const insertionCounts: InsertionCounts = {
    compileCount: 0, nativeCurveValidationCount: 0, domainQueryCount: 0,
    coefficientInsertionCallCount: 0, patchCount: 0, decimalEmissionCount: 0,
    observationCount: 0, curveD0Count: 0, curveD1AttemptCount: 0,
    curveD1EvaluatedCount: 0, curveD1RefusedCount: 0,
  };
  for (const insertion of insertions) {
    const counts = insertion.result.report.directCounts;
    insertionCounts.compileCount += counts.originalCompileCount + counts.candidateCompileCount;
    insertionCounts.nativeCurveValidationCount += counts.nativeCurveValidationCount;
    insertionCounts.domainQueryCount += counts.domainQueryCount;
    insertionCounts.coefficientInsertionCallCount += counts.coefficientInsertionCallCount;
    insertionCounts.patchCount += counts.patchCount;
    insertionCounts.decimalEmissionCount += counts.decimalEmissionCount;
    insertionCounts.observationCount += counts.observationCount;
    insertionCounts.curveD0Count += counts.curveD0Count;
    insertionCounts.curveD1AttemptCount += counts.curveD1AttemptCount;
    insertionCounts.curveD1EvaluatedCount += counts.curveD1EvaluatedCount;
    insertionCounts.curveD1RefusedCount += counts.curveD1RefusedCount;
  }
  const loftCounts = loft.report.directCounts;
  const totalD0Count = insertionCounts.curveD0Count + loftCounts.curvePointEvaluationCount +
    loftCounts.surfacePointEvaluationCount;
  const totalD1AttemptCount = insertionCounts.curveD1AttemptCount + loftCounts.surfaceDerivativeEvaluationCount;
  const totalDecimalEmissionCount = insertionCounts.decimalEmissionCount + loftCounts.decimalEmissionCount;
  check(insertionCounts.compileCount === 2 * insertions.length &&
    insertionCounts.coefficientInsertionCallCount === insertions.length &&
    insertionCounts.patchCount === 3 * insertions.length && insertionCounts.observationCount <= 662 &&
    insertionCounts.curveD0Count === 2 * insertionCounts.observationCount &&
    insertionCounts.curveD1AttemptCount === 2 * insertionCounts.observationCount &&
    insertionCounts.curveD1EvaluatedCount + insertionCounts.curveD1RefusedCount === insertionCounts.curveD1AttemptCount &&
    insertionCounts.decimalEmissionCount <= 1711 && totalDecimalEmissionCount <= 2177 &&
    loftCounts.curvePointEvaluationCount === 21 && loftCounts.surfacePointEvaluationCount === 15 &&
    loftCounts.surfaceDerivativeEvaluationCount === 15 && loftCounts.basisEvaluationCount === 12 &&
    totalD0Count <= 1360 && totalD1AttemptCount <= 1339, CODE.BINDING,
  'Actual delegated work must match complete bounded insertion and three-section Loft receipts');
  const report: SourceKnotAlignedLoftReport = {
    schema: 'barocss-source-knot-aligned-loft-report', version: 0, lengthUnit: 'mm',
    evaluationId: options.evaluationId, sectionCount: 3,
    sourceIds: triple(request.assets.map(asset => asset.sourceId)),
    constructionSourceId: options.constructionSourceId, modelName: loft.model.name, surfaceId: loft.surface.id,
    constructionSectionIds: options.constructionSectionIds, degreeU: plan.degree, degreeV: 1,
    domainU: plan.domain, parametersV: request.parametersV, alignedUPoleCount: plan.poleCount,
    insertionCount: insertions.length,
    sectionInsertionCounts: triple(plan.sections.map(section => section.missingKnots.length)),
    sourceSizes: { original: originalSizes, aligned: triple(alignedSections.map(context => sourceSize(context.source))),
      construction: sourceSize(loft.source) },
    fileSizes: { request: requestSize, result: { utf16: 0, utf8: 0 } },
    directCounts: {
      originalCompileCount: 3, nativeCurveValidationCount: 3, domainQueryCount: 3,
      sourceInsertionCallCount: insertions.length, loftBuildCallCount: 1, constructionCopyCount: 3,
      curveD0Count: 0, curveD1AttemptCount: 0, surfaceD0Count: 0, surfaceD1AttemptCount: 0,
      rationalOperationCount: 0, childValidationCount: 0, loftValidationCount: 0,
    },
    delegatedCounts: { insertions: insertionCounts, loft: loftCounts,
      totalD0Count, totalD1AttemptCount, totalDecimalEmissionCount },
    preservation: {
      completeOriginalSources: true, completeAlignedSources: true, originalModelMetadataAndSiblings: true,
      originalSelectedIds: true, alignedCommonBasis: true, constructionCopiesBitIdentical: true,
      parameterIdentity: true,
    },
    quality: {
      constructionOnly: true, globalShapeErrorCertified: false, globalBinary64ErrorCertified: false,
      smoothLoftCertified: false, g1g2Certified: false, topologyCertified: false, solid: false,
      manufacturingToleranceCertified: false, editorDisplayCertified: false,
      persistentTopologyBindingCertified: false, publication: false,
      ownership: 'independent-copied-cpu-data-gc',
    },
    limits: {
      maximumSections: 3, maximumDegree: 5, maximumAlignedUPoles: 16, maximumAlignedKnots: 22,
      maximumInsertionCalls: 28, maximumInsertionObservations: 662,
      maximumDelegatedD0Count: 1360, maximumDelegatedD1AttemptCount: 1339,
      maximumInsertionDecimalEmissions: 1711, maximumTotalDecimalEmissions: 2177,
      maximumModelObjects: 16, coordinateAbsMM: 10000, minimumWeight: 0.000001, maximumWeight: 1000000,
      sourceUTF16: 262144, sourceUTF8: 262144, maximumRequestUTF16: 2097152, maximumRequestUTF8: 2097152,
      maximumResultUTF16: 16777216, maximumResultUTF8: 16777216,
      ownValues: 4194304, ownDepth: 64, arrayElements: 8192, recordFields: 64,
      keyCharacters: 128, stringCharacters: 262144, identifierCharacters: 48,
    },
    workScope: 'direct-root-calls-and-delegated-provider-receipts-separated',
    budgetFailure: 'atomic-no-partial-source-aligned-loft',
  };
  const result: SourceKnotAlignedLoftResult = {
    request, originalSources, alignedSections, insertions, plan, loft, bindings, report,
  };
  let stable = false;
  for (let pass = 0; pass < 8; pass++) {
    const measured = fileSize(result);
    if (same(measured, report.fileSizes.result)) { stable = true; break; }
    report.fileSizes.result = measured;
  }
  check(stable, CODE.FILE, 'Complete aggregate result size metadata did not settle within8 passes');
  return snapshot(result) as SourceKnotAlignedLoftResult;
}

/** Reconstruct once from the full original request, including every real provider operation. */
export function validateSourceKnotAlignedLoft(input: SourceKnotAlignedLoftResult): SourceKnotAlignedLoftReport {
  const owned = record(snapshot(input, true), ['request', 'originalSources', 'alignedSections', 'insertions',
    'plan', 'loft', 'bindings', 'report'], CODE.OWNED) as unknown as SourceKnotAlignedLoftResult;
  let expected: SourceKnotAlignedLoftResult;
  try { expected = buildSourceKnotAlignedLoft(owned.request); }
  catch (cause) {
    throw new SourceKnotAlignedLoftError(CODE.OWNED,
      'Complete source alignment and Loft reconstruction refused', cause);
  }
  check(same(owned, expected), CODE.OWNED,
    'Owned sources, union, branch chain, bindings, Loft, counts, quality or aggregate sizes changed');
  return snapshot(expected.report, true) as SourceKnotAlignedLoftReport;
}
