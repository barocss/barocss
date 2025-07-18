import { rule, type AstNode } from './ast';
import { parseClassName } from './parser';
import { getUtility, getModifierPlugins, escapeClassName } from './registry';
import { CssmaContext } from './context';
import { ParsedModifier } from './parser';

// AST에서 가장 안쪽 rule의 selector를 덮어쓰는 재귀 함수
function setInnermostRuleSelector(ast: any, selector: string): any {
  if (Array.isArray(ast)) {
    return ast.map(node => setInnermostRuleSelector(node, selector));
  }
  if (ast.type === 'rule') {
    // 더 안쪽에 rule/at-rule이 있으면 재귀, 없으면 selector 덮어쓰기
    if (ast.nodes && ast.nodes.some((n: any) => n.type === 'rule' || n.type === 'at-rule')) {
      return { ...ast, nodes: setInnermostRuleSelector(ast.nodes, selector) };
    } else {
      return { ...ast, selector };
    }
  }
  if (ast.type === 'at-rule' && ast.nodes) {
    // at-rule의 nodes에 at-rule이 있으면, 그 at-rule의 nodes에 selector를 덮어쓰고, 바깥 at-rule의 nodes에도 at-rule이 남아 있도록 flatten하지 않음
    return { ...ast, nodes: setInnermostRuleSelector(ast.nodes, selector) };
  }
  return ast;
}

// Variant chain 적용 (with compounds/arbitrary support)
function applyVariantChain(
  baseSelector: string,
  baseAST: AstNode[],
  variantChain: ParsedModifier[],
  context: CssmaContext,
  plugins: ReturnType<typeof getModifierPlugins>,
  fullClassName: string
) {
  let selector = baseSelector;
  let ast = baseAST;
  let prevPlugin: any = null;

  // --- wrap은 오른쪽→왼쪽(variantChain.length-1→0) 순서로 적용 ---
  for (let i = variantChain.length - 1; i >= 0; i--) {
    const variant = variantChain[i];
    
    const plugin = plugins.find(p => p.match(variant.type, context));
    
    if (!plugin) {
      continue;
    }
    
    if (plugin.wrap) {
      ast = plugin.wrap(Array.isArray(ast) ? ast : [ast], variant, context);
    }
    
    prevPlugin = plugin;
  }

  // --- selector 변환은 왼쪽→오른쪽(0→variantChain.length-1) 순서로 적용 ---
  selector = baseSelector;
  prevPlugin = null;
  const escapedClassName = escapeClassName(fullClassName);
  for (let i = 0; i < variantChain.length; i++) {
    const variant = variantChain[i];
    
    const plugin = plugins.find(p => p.match(variant.type, context));
    
    if (!plugin) {
      continue;
    }
    

    if (
      prevPlugin &&
      prevPlugin.compounds &&
      prevPlugin.compounds.includes(variant.type)
    ) {
      selector = plugin.modifySelector
        ? plugin.modifySelector({ selector, fullClassName: escapedClassName, mod: variant, context })
        : selector;
    } else {
      selector = plugin.modifySelector
        ? plugin.modifySelector({ selector, fullClassName: escapedClassName, mod: variant, context })
        : selector;
    }
    
    prevPlugin = plugin;
  }
  // selector를 ast의 가장 안쪽 rule에 반영
  ast = setInnermostRuleSelector(ast, selector);
  
  return { className: escapedClassName, selector, ast };
}

/**
 * Applies a class name string to produce AST nodes.
 * @param fullClassName e.g. 'hover:bg-red-500 sm:focus:text-blue-500'
 * @param ctx CssmaContext (must be created via createContext(config))
 * @returns AstNode[]
 */
export function applyClassName(fullClassName: string, ctx: CssmaContext): AstNode[] {
  // 1. Parse className → { modifiers, utility }
  const { modifiers, utility } = parseClassName(fullClassName);
  
  if (!utility) {
    return [];
  }
  
  // 2. Find matching utility handler
  const utilReg = getUtility().find(u => {
    // Reconstruct the full className for matching
    const fullClassName = utility.value ? `${utility.prefix}-${utility.value}` : utility.prefix;
    return u.match(fullClassName);
  });
  
  if (!utilReg) {
    return [];
  }

  // Handle negative values by prepending '-' to the value
  let value = utility.value;
  if (utility.negative && value) {
    value = '-' + value;
  }

  let baseAst = utilReg.handler(value!, ctx, utility, utilReg) || [];

  // decl만 반환된 경우 rule로 감싸기
  if (baseAst.length > 0 && baseAst.every(n => n.type === 'decl')) {
    baseAst = [rule('&', baseAst)];
  }
  // 3. Apply variant chain using plugin system (with compounds/arbitrary)
  const { className: finalClassName, selector, ast } = applyVariantChain(
    '&',
    baseAst,
    modifiers,
    ctx,
    getModifierPlugins(),
    fullClassName
  );

  // --- variant가 없으면 decl만 반환, 있으면 AST 그대로 반환 ---
  if (!modifiers || modifiers.length === 0) {
    // ast가 rule 하나이고, 그 안에 decl만 있으면 decl만 반환
    if (Array.isArray(ast) && ast.length === 1 && ast[0].type === 'rule' && Array.isArray(ast[0].nodes) && ast[0].nodes.every(n => n.type === 'decl')) {
      return ast[0].nodes;
    }
    // ast가 at-rule(container 등) 하나이고, 그 안에 rule이 있고 decl만 있으면 flatten하지 않고 그대로 반환
    if (Array.isArray(ast) && ast.length === 1 && ast[0].type === 'at-rule') {
      return ast;
    }
  }
  
  return ast;
}

export { applyVariantChain };

/**
 * Example usage:
 *
 * import { applyClassName, createContext } from './engine';
 *
 * const config = {
 *   theme: { colors: { red: { 500: '#f00' } } }
 * };
 * const ctx = createContext(config);
 * const ast = applyClassName('bg-red-500', ctx);
 * // ast will use ctx.theme('colors', 'red', 500) for color resolution
 */
