import { rule, type AstNode } from "./ast";
import { parseClassName } from "./parser";
import { getUtility, getModifierPlugins, escapeClassName } from "./registry";
import { CssmaContext } from "./context";
import { ParsedModifier } from "./parser";
import { astToCss } from "./astToCss";

// Variant chain 적용 (with compounds/arbitrary support)
function applyVariantChain(
  baseSelector: string,
  baseAST: AstNode[],
  variantChain: ParsedModifier[],
  context: CssmaContext,
  plugins: ReturnType<typeof getModifierPlugins>,
  fullClassName: string
) {
  console.log('[applyVariantChain] input:', { baseSelector, baseAST, variantChain, fullClassName });
  let selector = baseSelector;
  let ast = baseAST;
  let wrappers: Array<{
    type: "at-rule" | "style-rule" | "rule";
    params?: string;
    selector?: string;
  }> = [];

  for (let i = 0; i < variantChain.length; i++) {
    const variant = variantChain[i];
    const plugin = plugins.find((p) => p.match(variant.type, context));
    console.log(`[applyVariantChain] variant:`, variant, 'plugin:', plugin);
    if (!plugin) continue;

    // AST handler 우선 적용
    if (plugin.astHandler) {
      ast = plugin.astHandler(ast, variant, context, variantChain, i);
      console.log(`[applyVariantChain] astHandler applied, ast:`, ast);
      continue;
    }

    // selector 변환 및 wrapping 정책
    if (plugin.modifySelector) {
      const result = plugin.modifySelector({
        selector,
        fullClassName,
        mod: variant,
        context,
        variantChain,
        index: i,
      });
      console.log(`[applyVariantChain] modifySelector result:`, result);
      if (typeof result === "object" && result) {
        if ("selector" in result) selector = result.selector;
        // wrappingType/atRule이 있으면 wrappers에 추가
        if (result.wrappingType === "at-rule" && result.params) {
          wrappers.push({ type: "at-rule", params: result.params });
        } else if (result.wrappingType === "style-rule") {
          wrappers.push({ type: "style-rule", selector });
        } else if (result.wrappingType === "rule") {
          wrappers.push({ type: "rule", selector });
        }
        // flatten/override 등 추가 정책도 필요시 처리
      } else if (typeof result === "string") {
        console.log(`[applyVariantChain] modifySelector result is string, result:`, result);
        selector = result;
      }
    }
  }

  // wrappers를 바깥→안쪽 순서로 AST에 적용
  for (let i = wrappers.length - 1; i >= 0; i--) {
    const wrap = wrappers[i];
    console.log(`[applyVariantChain] wrapping:`, wrap);
    if (wrap.type === "at-rule") {
      ast = [
        {
          type: "at-rule",
          name: "media",
          params: wrap.params!,
          nodes: Array.isArray(ast) ? ast : [ast],
        },
      ];
    } else if (wrap.type === "style-rule") {
      ast = [
        {
          type: "style-rule",
          selector: wrap.selector!,
          nodes: Array.isArray(ast) ? ast : [ast],
        },
      ];
    } else if (wrap.type === "rule") {
      ast = [
        {
          type: "rule",
          selector: wrap.selector!,
          nodes: Array.isArray(ast) ? ast : [ast],
        },
      ];
    }
    console.log(`[applyVariantChain] after wrapping, ast:`, ast);
  }

  if (wrappers.length === 0 && Array.isArray(ast) && ast.length === 1 && ast[0].type === "rule") {
    ast[0].selector = selector;
  }

  console.log('[applyVariantChain] final ast:', ast);
  return ast;
}

/**
 * decl-to-root path 리스트 수집 함수 (normalizeAstOrder 등에서 재사용)
 */
export type PathNode = Partial<AstNode>;
export type DeclPath = PathNode[];
export function collectDeclPaths(
  nodes: AstNode[] = [],
  path: PathNode[] = []
): DeclPath[] {
  let result: DeclPath[] = [];
  for (const node of nodes) {
    const curr = { ...node };
    delete curr.nodes;
    if (node.type === "decl") {
      result.push([...path, curr]);
    } else if (node.nodes && node.nodes.length > 0) {
      result = result.concat(collectDeclPaths(node.nodes, [...path, curr]));
    }
  }
  return result;
}

// 정렬 기준: at-rule > style-rule > rule > decl, depth 우선, sibling 순서 보장
function getPriority(type: string): number {
  if (type === "at-rule") return 0;
  if (type === "style-rule") return 10;
  if (type === "rule") return 20;
  return 30; // decl
}

/**
 * DeclPath (decl-to-root path 한 줄)을 variant 정렬, 병합(hoist)하여 중첩 AST로 변환
 * @param declPath DeclPath (단일 path)
 * @returns AstNode[] (중첩 AST)
 */
export function declPathToAst(declPath: DeclPath): AstNode[] {
  if (!declPath || declPath.length === 0) return [];
  // 1. decl(leaf)와 variant chain 분리
  const variants = declPath.slice(0, -1);
  const decl = declPath[declPath.length - 1];
 
  const sortedVariants = [...variants].sort((a, b) => getPriority(a.type) - getPriority(b.type));
  // 3. 연속된 같은 variant(동일 key) 병합 (at-rule: name+params, rule/style-rule: selector)
  const mergedVariants: typeof sortedVariants = [];
  for (const v of sortedVariants) {
    if (mergedVariants.length === 0) {
      mergedVariants.push(v);
    } else {
      const prev = mergedVariants[mergedVariants.length - 1];
      // at-rule: name+params, rule/style-rule: selector
      const isSame = v.type === prev.type && (
        (v.type === 'at-rule' && prev.type === 'at-rule' && v.name === prev.name && v.params === prev.params) ||
        ((v.type === 'rule' || v.type === 'style-rule') && v.selector === (prev as any).selector)
      );
      if (!isSame) {
        mergedVariants.push(v);
      }
      // else: skip(merge)
    }
  }
  // 4. 중첩 AST 생성 (바깥→안쪽)
  let node: AstNode = { ...decl };
  for (let i = mergedVariants.length - 1; i >= 0; i--) {
    node = { ...mergedVariants[i], nodes: [node] };
  }
  return [node];
}

/**
 * Applies a class name string to produce AST nodes.
 * @param fullClassName e.g. 'hover:bg-red-500 sm:focus:text-blue-500'
 * @param ctx CssmaContext (must be created via createContext(config))
 * @returns AstNode[]
 */
export function applyClassName(
  fullClassName: string,
  ctx: CssmaContext
): AstNode[] {
  console.log('[applyClassName] input:', fullClassName);
  // 1. Parse className → { modifiers, utility }
  const { modifiers, utility } = parseClassName(fullClassName);
  console.log('[applyClassName] parsed:', { modifiers, utility });

  if (!utility) {
    console.log('[applyClassName] no utility, return []');
    return [];
  }

  // 2. Find matching utility handler
  const utilReg = getUtility().find((u) => {
    // Reconstruct the full className for matching
    const fullClassName = utility.value
      ? `${utility.prefix}-${utility.value}`
      : utility.prefix;
    return u.match(fullClassName);
  });
  console.log('[applyClassName] utilReg:', utilReg);
  if (!utilReg) {
    console.log('[applyClassName] no utilReg, return []');
    return [];
  }
  // Handle negative values by prepending '-' to the value
  let value = utility.value;
  if (utility.negative && value) {
    value = "-" + value;
  }
  let baseAst = utilReg.handler(value!, ctx, utility, utilReg) || [];
  console.log('[applyClassName] baseAst:', baseAst);
  // decl만 반환된 경우 rule로 감싸기
  if (baseAst.length > 0 && baseAst.every((n) => n.type === "decl")) {
    baseAst = [rule("&", baseAst)];
    console.log('[applyClassName] wrapped baseAst:', baseAst);
  }
  // 3. Apply variant chain using plugin system (with compounds/arbitrary)
  const ast = applyVariantChain(
    "&",
    baseAst,
    modifiers,
    ctx,
    getModifierPlugins(),
    fullClassName
  );
  console.log('[applyClassName] after applyVariantChain:', ast);
  // --- variant가 없으면 decl만 반환, 있으면 AST 그대로 반환 ---
  if (!modifiers || modifiers.length === 0) {
    // ast가 rule 하나이고, 그 안에 decl만 있으면 decl만 반환
    if (
      Array.isArray(ast) &&
      ast.length === 1 &&
      ast[0].type === "rule" &&
      Array.isArray(ast[0].nodes) &&
      ast[0].nodes.every((n) => n.type === "decl")
    ) {
      console.log('[applyClassName] no modifiers, rule with decls:', ast[0].nodes);
      return ast[0].nodes;
    }
    // ast가 at-rule(container 등) 하나이고, 그 안에 rule이 있고 decl만 있으면 flatten하지 않고 그대로 반환
    if (Array.isArray(ast) && ast.length === 1 && ast[0].type === "at-rule") {
      console.log('[applyClassName] no modifiers, at-rule:', ast);
      return ast;
    }
  }
  if (ast === undefined) {
    console.log('[applyClassName] applyVariantChain returned undefined, return []');
    return [];
  }
  console.log('[applyClassName] return ast:', ast);
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

/**
 * 여러 className을 받아 각각의 유틸리티 CSS를 생성한다.
 * @param classList string (예: 'bg-red-500 text-lg hover:bg-blue-500')
 * @param ctx CssmaContext
 * @param opts { minify?: boolean, dedup?: boolean }
 * @returns string (여러 CSS 블록이 join된 결과)
 */
export function generateUtilityCss(
  classList: string,
  ctx: CssmaContext,
  opts?: { minify?: boolean; dedup?: boolean }
): string {
  const seen = new Set<string>();
  return classList
    .split(/\s+/)
    .filter((cls) => {
      if (!cls) return false;
      if (opts?.dedup) {
        if (seen.has(cls)) return false;
        seen.add(cls);
      }
      return true;
    })
    .map((cls) => {
      const ast = applyClassName(cls, ctx);
      // decl만 반환되면 rule로 감싸기
      const isDeclOnly =
        Array.isArray(ast) &&
        ast.length > 0 &&
        ast.every((n) => n.type === "decl");
      const astForCss = isDeclOnly ? [rule("&", ast)] : ast;
      const css = astToCss(astForCss, cls, { minify: opts?.minify });
      console.log(
        "[generateUtilityCss] className:",
        cls,
        "\nAST:",
        JSON.stringify(astForCss, null, 2),
        "\nCSS:",
        css
      );
      return css;
    })
    .join(opts?.minify ? "" : "\n");
}

/**
 * declPathToAst 결과 리스트(AstNode[][])를 받아, 같은 at-rule(name, params) 등은 하나로 합치고 그 아래는 sibling으로 분리하는 방식으로 최종 AST 트리를 반환
 * @param astList AstNode[][]
 * @returns AstNode[] (최적화된 AST)
 */
export function mergeAstTreeList(astList: AstNode[][]): AstNode[] {
  // AstNode[][] → DeclPath[]
  const declPaths: DeclPath[] = astList.map(ast => {
    // declPathToAst는 항상 [rootNode] 형태
    const path: AstNode[] = [];
    let node = ast[0];
    while (node) {
      path.push({ ...node, nodes: undefined });
      if (node.nodes && node.nodes.length === 1) node = node.nodes[0];
      else break;
    }
    return path;
  });
  // 재그 병합
  function merge(declPaths: DeclPath[], depth = 0): AstNode[] {
    if (declPaths.length === 0) return [];
    if (declPaths[0].length === depth + 1) {
      // 모두 decl만 남음
      return declPaths.map(path => path[depth]);
    }
    // 현재 depth의 variant(type+key)로 그룹핑
    const groupMap = new Map<string, DeclPath[]>();
    for (const path of declPaths) {
      const node = path[depth];
      let key = node.type;
      if (node.type === 'at-rule') key += ':' + node.name + ':' + node.params;
      else if (node.type === 'rule' || node.type === 'style-rule') key += ':' + node.selector;
      else key += ':' + JSON.stringify(node);
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(path);
    }
    // 각 그룹별로 재그 병합
    const result: AstNode[] = [];
    for (const group of groupMap.values()) {
      const node = group[0][depth];
      const children = merge(group, depth + 1);
      result.push(children.length
        ? { ...node, nodes: children }
        : { ...node }
      );
    }
    return result;
  }
  return merge(declPaths, 0);
}

/**
 * applyClassName 결과 AST를 clean한 최종 AST 트리로 변환
 * @param ast AstNode[] (applyClassName 결과)
 * @returns AstNode[] (최적화된 AST)
 */
export function buildCleanAst(ast: AstNode[]): AstNode[] {
  const declPaths = collectDeclPaths(ast);
  const astList = declPaths.map(declPathToAst);
  return mergeAstTreeList(astList);
}
