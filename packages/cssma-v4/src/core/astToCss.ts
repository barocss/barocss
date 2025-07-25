import { rule, type AstNode } from './ast';
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
  const indent = _indent;
  const nextIndent = _indent + '  ';

  console.log('[astToCss] input', { ast, baseSelector, minify, indent });

  // Basic deduplication: only keep last decl for each prop in a block
  let dedupedAst = [];
  if (Array.isArray(ast)) {
    const seenProps = new Map();
    for (let i = ast.length - 1; i >= 0; i--) {
      const node = ast[i];
      if (node.type === 'decl') {
        // node.important이 없으므로 안전하게 처리
        const key = node.prop;
        if (seenProps.has(key)) continue;
        seenProps.set(key, true);
      }
      dedupedAst.unshift(node);
    }
  }

  if (_indent === '' && dedupedAst.every(node => node.type === 'decl')) {
    const escBase = '.' + escapeClassName(baseSelector || '');
    if (minify) {
      const css = `${escBase} {${astToCss(dedupedAst, baseSelector, opts, nextIndent)}}`;
      console.log('[astToCss] decl-only minify', css);
      return css;
    } else {
      const css = `${escBase} {\n${astToCss(dedupedAst, baseSelector, opts, nextIndent)}\n${nextIndent}}`;
      console.log('[astToCss] decl-only pretty', css);
      return css;
    }
  }

  const result = dedupedAst.map(node => {
    switch (node.type) {
      case 'decl': {
        let value = node.value;
        // node.important이 없으므로 무시
        if (node.prop.startsWith('--')) {
          if (minify) {
            const css = `${node.prop}: ${value};`;
            console.log('[astToCss] decl custom property minify', css);
            return css;
          } else {
            const css = `${indent}${node.prop}: ${value};\n${indent}`;
            console.log('[astToCss] decl custom property pretty', css);
            return css;
          }
        } else {
          if (minify) {
            const css = `${node.prop}: ${value};`;
            console.log('[astToCss] decl minify', css);
            return css;
          } else {
            const css = `${indent}${node.prop}: ${value};\n${indent}`;
            console.log('[astToCss] decl pretty', css);
            return css;
          }
        }
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
          const css = `${indent}${selector}{${astToCss(node.nodes, baseSelector, opts, nextIndent)}}`;
          console.log('[astToCss] rule minify', css);
          return css;
        } else {
          const css = `${indent}${selector} {\n${astToCss(node.nodes, baseSelector, opts, nextIndent)}\n${indent}}`;
          console.log('[astToCss] rule pretty', css);
          return css;
        }
      }
      case 'style-rule': {
        if (minify) {
          const css = `${indent}${node.selector} {${astToCss(node.nodes, baseSelector, opts, nextIndent)}}`;
          console.log('[astToCss] style-rule minify', css);
          return css;
        } else {
          const css = `${indent}${node.selector} {\n${astToCss(node.nodes, baseSelector, opts, nextIndent)}\n${indent}}`;
          console.log('[astToCss] style-rule pretty', css);
          return css;
        }
      }
      case 'at-rule': {
        if (minify) {
          const css = `${indent}@${node.name} ${node.params}{${astToCss(node.nodes, baseSelector, opts, nextIndent)}}`;
          console.log('[astToCss] at-rule minify', css);
          return css;
        } else {
          const css = `${indent}@${node.name} ${node.params} {\n${astToCss(node.nodes, baseSelector, opts, nextIndent)}\n${indent}}`;
          console.log('[astToCss] at-rule pretty', css);
          return css;
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

  console.log('[astToCss] output', result);
  return result;
}

export { astToCss }; 