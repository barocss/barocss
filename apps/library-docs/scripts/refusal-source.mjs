// Read refusal literals and the authoritative code array without executing package sources.
const CODE = /^[A-Z][A-Z0-9_]{3,}$/;
const BUILDERS = new Map([['refusal', [0, 1]], ['problem', [0, 1]], ['coded', [0, 1]], ['kernelRefusal', [1, 2]]]);

export function readRefusalSource(ts, file, text) {
  const literals = [], declared = [];
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const literalText = node => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text
    : ts.isTemplateExpression(node) ? node.head.text + node.templateSpans.map(span => `…${span.literal.text}`).join('') : null;
  const visit = node => {
    const value = literalText(node);
    if (value !== null) literals.push(value);
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const slots = BUILDERS.get(node.expression.text);
      if (slots && node.arguments.length > slots[1]) {
        const code = literalText(node.arguments[slots[0]]), said = literalText(node.arguments[slots[1]]) ?? '…';
        if (code && CODE.test(code) && !said.startsWith(`[${code}]`)) literals.push(`[${code}] ${said}`);
      }
    }
    if (ts.isVariableDeclaration(node) && node.name.getText(sf) === 'CAD_ERROR_CODES') {
      let array = node.initializer;
      while (array && (ts.isAsExpression(array) || ts.isParenthesizedExpression(array) || ts.isSatisfiesExpression(array))) array = array.expression;
      if (array && ts.isArrayLiteralExpression(array)) for (const item of array.elements) {
        const code = literalText(item);
        if (code && CODE.test(code)) declared.push(code);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { literals, declared };
}
