import type { AstNode } from './ast';
import { escapeClassName } from './registry';

/**
 * Converts AST nodes to CSS string.
 * Supports nested rules, at-rules, custom properties, !important, and basic deduplication.
 * @param ast AST nodes
 * @param baseSelector (optional) className (점 없이, e.g. 'my-btn')
 * @param opts { minify?: boolean }
 */
function astToCss(
  ast: AstNode[],
  baseSelector?: string,
  opts?: { minify?: boolean },
  _indent = ''
): string {
  const minify = opts?.minify;
  const indent = minify ? '' : _indent;
  const nextIndent = minify ? '' : _indent + '  ';

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
      case 'rule': {
        let selector = node.selector;
        if (baseSelector) {
          const escBase = '.' + escapeClassName(baseSelector);
          if (selector && selector.includes('&')) {
            selector = selector.replace(/&/g, escBase);
          } else if (!selector.startsWith(escBase)) {
            selector = selector.split(',').map(sel => {
              sel = sel.trim();
              if (sel.startsWith(':') || sel.startsWith('::')) {
                return escBase + sel;
              } else {
                return escBase + (sel.startsWith('.') ? '' : ' ') + sel;
              }
            }).join(', ');
          }
        }
        if (minify) {
          return `${indent}${selector}{${astToCss(node.nodes, baseSelector, opts, nextIndent)}}`;
        } else {
          return `${indent}${selector} {\n${astToCss(node.nodes, baseSelector, opts, nextIndent)}\n${indent}}`;
        }
      }
      case 'style-rule': {
        if (minify) {
          return `${indent}${node.selector} {${astToCss(node.nodes, baseSelector, opts, nextIndent)}}`;
        } else {
          return `${indent}${node.selector} {\n${astToCss(node.nodes, baseSelector, opts, nextIndent)}\n${indent}}`;
        }
      }
      case 'at-rule': {
        if (minify) {
          return `${indent}@${node.name} ${node.params}{${astToCss(node.nodes, baseSelector, opts, nextIndent)}}`;
        } else {
          return `${indent}@${node.name} ${node.params} {\n${astToCss(node.nodes, baseSelector, opts, nextIndent)}\n${indent}}`;
        }
      }
      case 'comment':
        return minify ? '' : `${indent}/* ${node.text} */`;
      case 'raw':
        return `${indent}${node.value}`;
      default:
        return '';
    }
  }).filter(Boolean).join(minify ? '' : '\n');
}

export { astToCss }; 