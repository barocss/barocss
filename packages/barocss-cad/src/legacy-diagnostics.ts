import type { CadAstError, CadAstDeclaration } from './source-ast.js';
import { CadSemanticError, analyzeCadAst } from './semantic-model.js';

interface LegacyFailure { code: string; detail: string; start: number; end: number }
const prefix = '@model x{version:0;length-unit:mm;';
function innerMessage(code: string, detail: string, source: string, declaration: CadAstDeclaration, offset: number): string {
  const wrapped = prefix + source.slice(declaration.range.start, declaration.range.end) + '}';
  const at = prefix.length + offset - declaration.range.start, lines = wrapped.slice(0, at).split('\n');
  return code + ' at ' + lines.length + ':' + (lines.at(-1)!.length + 1) + ': ' + detail;
}
/** Preserve old error presentation without running a second parser or lowering. */
export function legacyCadFailure(error: CadAstError, source: string, version: 0 | 1): LegacyFailure {
  let selected = error;
  if (!(error instanceof CadSemanticError) && error.completedDeclarations?.length) {
    const range = { start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 };
    // The old entry checked completed declarations immediately.
    // Recheck literal and required-field semantics without lowering geometry.
    try {
      analyzeCadAst({ kind: 'model', name: 'legacy_diagnostic', range, nameRange: { ...range }, fields: [
        { name: 'version', range: { ...range }, nameRange: { ...range }, value: { kind: 'number', value: version, range: { ...range } } },
        { name: 'length-unit', range: { ...range }, nameRange: { ...range }, value: { kind: 'identifier', value: 'mm', range: { ...range } } },
      ], declarations: error.completedDeclarations.filter(d => d.kind !== 'extrude' || !d.fields.some(f => f.name === 'curve') || !d.fields.some(f => f.name === 'vector')) }, version, source);
    } catch (prior) {
      if (!(prior instanceof CadSemanticError)) throw prior;
      if (prior.objectId !== undefined) selected = prior;
    }
  }
  if (selected instanceof CadSemanticError) {
    const start = selected.legacyRange.start;
    if (version === 1 && selected.curveDeclaration) return { code: selected.legacyCode, detail: 'Invalid curve ' + selected.curveDeclaration.id + ': ' + innerMessage(selected.legacyCode, selected.legacyDetail, source, selected.curveDeclaration, start), start, end: Math.min(source.length, start + 1) };
    const defaultEnd = ['VERSION', 'UNIT'].includes(selected.legacyCode) || selected.objectId === undefined;
    return { code: selected.legacyCode, detail: selected.legacyDetail, start, end: defaultEnd ? Math.min(source.length, start + 1) : selected.legacyRange.end };
  }
  if (version === 1 && selected.legacyCurve) return { code: selected.code, detail: 'Invalid curve ' + selected.objectId + ': ' + selected.legacyCurve.innerMessage, start: selected.range.start, end: selected.range.end };
  return { code: selected.code, detail: selected.detail, start: selected.range.start, end: selected.range.end };
}
