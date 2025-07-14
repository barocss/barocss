import type { AstNode } from './ast';

/**
 * Converts AST nodes to CSS string.
 * Supports nested rules, at-rules, custom properties, !important, and basic deduplication.
 */
function astToCss(ast: AstNode[], indent = ''): string {
  // Basic deduplication: only keep last decl for each prop in a block
  const dedupedAst = [];
  if (Array.isArray(ast)) {
    const seenProps = new Map();
    for (let i = ast.length - 1; i >= 0; i--) {
      const node = ast[i];
      if (node.type === 'decl') {
        const key = node.prop + (node.important ? '!important' : '');
        if (seenProps.has(key)) continue;
        seenProps.set(key, true);
      }
      dedupedAst.unshift(node);
    }
  }
  return dedupedAst.map(node => {
    switch (node.type) {
      case 'decl': {
        let value = node.value;
        if (node.important) value += ' !important';
        if (node.prop.startsWith('--')) {
          return `${indent}${node.prop}: ${value};`;
        }
        return `${indent}${node.prop}: ${value};`;
      }
      case 'rule':
        return `${indent}${node.selector} {
${astToCss(node.nodes, indent + '  ')}
${indent}}`;
      case 'atrule':
        return `${indent}@${node.name} ${node.params} {
${astToCss(node.nodes, indent + '  ')}
${indent}}`;
      case 'comment':
        return `${indent}/* ${node.text} */`;
      case 'raw':
        return `${indent}${node.value}`;
      default:
        return '';
    }
  }).join('\n');
}

export { astToCss }; 