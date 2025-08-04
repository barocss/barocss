import { rule, type AstNode } from "./ast";
import { parseClassName } from "./parser";
import { astCache } from "../utils/cache";
import { getUtility, getModifierPlugins } from "./registry";
import { CssmaContext } from "./context";
import { astToCss, rootToCss } from "./astToCss";

/**
 * decl-to-root path collection function (reused in normalizeAstOrder, etc.)
 */
export type PathNode = Partial<AstNode>;
export type DeclPath = PathNode[];

/**
 * collectDeclPaths
 * Collects all paths from AST tree to decl(leaf) (including variant chains).
 * - Input: AST node array
 * - Output: decl-to-root path(variant chain) array
 * - Usage: Used for path extraction for AST optimization/merging in optimizeAst, declPathToAst, etc.
 *
 * @param nodes AstNode[] - AST tree
 * @param path PathNode[] - Recursive use (initial value omitted)
 * @returns DeclPath[] - Array of paths to decl (variant chains)
 */
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

// Sort criteria: at-rule > style-rule > rule > decl, depth first, sibling order preserved
function getPriority(type: string): number {
  if (type === "at-root") return -1;
  if (type === "at-rule") return 0;
  if (type === "style-rule") return 10;
  if (type === "rule") return 20;
  return 30; // decl
}

const sourcePriority: Record<string, number> = {
  media: 0, // @media
  supports: 1, // @supports
  container: 2, // @container
  responsive: 10, // sm:, md: etc.
  group: 20, // .group:hover &
  peer: 30, // .peer:focus ~ &
  dark: 40, // dark:
  universal: 50, // :is(), :where()
  data: 60, // [data-state=...]
  aria: 70, // [aria-pressed=...]
  attribute: 80, // [type=...]
  pseudo: 90, // :hover, :focus
  base: 100, // &
  starting: 110, // (root)
};

function getRulePriority(rule: Partial<AstNode>): number {
  return sourcePriority[rule.source || "base"] || 100;
}

const mergeSelectorsBySource = (source: string, nodes: Partial<AstNode>[]) => {
  if (source === "pseudo") {
    // Inside → outside (reduce)
    return nodes.reduce((acc, sel) => {
      const selector = (sel as any).selector as string;
      if (acc === "") return selector;
      if (selector?.includes("&")) return selector.replace(/&/, acc);
      return selector + " " + acc;
    }, "");
  } else {
    // Outside → inside (reduceRight)
    return nodes.reduceRight((acc, sel) => {
      const selector = (sel as any).selector as string;
      if (acc === "") return selector;
      if (selector?.includes("&")) return selector.replace(/&/, acc);
      return selector + " " + acc;
    }, "");
  }
};

/**
 * declPathToAst
 * Converts decl-to-root path(variant chain) to actual nested AST.
 * - Input: DeclPath(variant chain)
 * - Output: Nested AstNode[]
 * - Consecutive same variants (same key) are merged, nested in outside→inside order
 *
 * @param declPath DeclPath
 * @returns AstNode[]
 */
export function declPathToAst(declPath: DeclPath): AstNode[] {
  if (!declPath || declPath.length === 0) return [];
  // declPath 각 node의 type/selector/source 로그
  // 1. decl(leaf)와 variant chain 분리
  const variants = declPath.slice(0, -1);
  const decl = declPath[declPath.length - 1];
  // 2. 기존 정렬/병합(hoist) 로직 유지
  const sortedVariants = [...variants].sort(
    (a, b) => getPriority(a.type!) - getPriority(b.type!)
  );

  // decl 에 기본 rule 처리 추가
  // 1. 처음 요소가 decl 이면 rule('&', [decl]) 추가
  // 2. rule 이 & 를 가지지 않는데 하위가 decl 이면 현재 rule 에 , rule('&', [decl]) 추가
  if (sortedVariants.length === 0) {
    sortedVariants.push({
      type: "rule",
      selector: "&",
      source: "base",
    });
  } else {
    const last = sortedVariants[sortedVariants.length - 1];
    if (
      (last.type == "at-rule" && last.name !== "property") ||
      (last.type == "style-rule") ||
      (last.type === "rule" && last.selector?.includes("&") === false)
    ) {
      // console.log("[declPathToAst] add rule", last);
      sortedVariants.push({
        type: "rule",
        selector: "&",
        source: "base",
      });
    }
  }

  const mergedVariants: typeof sortedVariants = [];
  for (const v of sortedVariants) {
    if (mergedVariants.length === 0) {
      mergedVariants.push(v);
    } else {
      const prev = mergedVariants[mergedVariants.length - 1];
      const isSame =
        v.type === prev.type &&
        ((v.type === "at-rule" &&
          prev.type === "at-rule" &&
          v.name === prev.name &&
          v.params === prev.params) ||
          ((v.type === "rule" || v.type === "style-rule") &&
            v.selector === (prev as any).selector));
      if (!isSame) {
        mergedVariants.push(v);
      }
      // else: skip(merge)
    }
  }
  // 3. rule만 따로 모으기 (연속된 rule만)
  const ruleSelectors: Partial<AstNode>[] = [];
  const nonRuleVariants: any[] = [];
  for (const v of mergedVariants) {
    if (v.type === "rule") ruleSelectors.push(v);
    else nonRuleVariants.push(v);
  }

  // 5. selector 합성 및 단일 rule 생성
  let node: AstNode = { ...decl };
  let sortedRuleSelectors = [...ruleSelectors].sort(
    (a, b) => getRulePriority(a) - getRulePriority(b)
  );
  if (sortedRuleSelectors.length > 0) {
    const grouped = sortedRuleSelectors.reduce((acc, rule) => {
      const key = rule.source || "base";
      if (!acc[key]) acc[key] = [];
      acc[key].push(rule);
      return acc;
    }, {} as Record<string, Partial<AstNode>[]>);
    // grouped 상세 로그

    // 1. sourcePriority 기준으로 정렬
    const mergedBySource = Object.entries(grouped)
      .sort(
        ([a], [b]) => (sourcePriority[a] ?? 999) - (sourcePriority[b] ?? 999)
      )
      .map(([source, nodes]) => {
        const merged = mergeSelectorsBySource(source, nodes);
        return merged;
      });

    // 2. 바깥→안쪽 순서로 reduce (pseudo가 항상 가장 안쪽)
    let acc = "";
    for (let i = 0; i < mergedBySource.length; i++) {
      const sel = mergedBySource[i];
      if (acc === "") acc = sel;
      else if (sel.includes("&")) acc = sel.replace(/&/, acc);
      else acc = sel + " " + acc;
    }
    const finalSelector = acc;
    node = { type: "rule", selector: finalSelector, nodes: [node] };
  }

  // 6. 나머지 variant(예: at-rule) 바깥에서 중첩
  for (let i = nonRuleVariants.length - 1; i >= 0; i--) {
    node = { ...nonRuleVariants[i], nodes: [node] };
  }
  return [node];
}

/**
 * parseClassToAst
 * Parses className(including variant chain) to generate AST tree.
 * - Input: className(string), CssmaContext
 * - Output: AstNode[] (multiple roots possible for variant wrapping path)
 * - Perfectly supports variant wrapping structure (Cartesian product, nesting, siblings, etc.)
 * - Accumulates wrappers in wrappers and applies them from right to left.
 * - Can return multiple root asts.
 *
 * @param fullClassName string (e.g., 'sm:dark:hover:bg-red-500')
 * @param ctx CssmaContext
 * @returns AstNode[]
 *
 * @example
 *   const ast = parseClassToAst('sm:dark:hover:bg-red-500', ctx);
 *   // ast is an AST tree with sm, dark, hover variants nested
 */
export function parseClassToAst(
  fullClassName: string,
  ctx: CssmaContext
): AstNode[] {
  // Check AST cache first
  const cacheKey = `${fullClassName}:${JSON.stringify(ctx.theme)}`;
  if (astCache.has(cacheKey)) {
    // console.log('[parseClassToAst] Cache hit for', fullClassName);
    return astCache.get(cacheKey)!;
  }

  const { modifiers, utility } = parseClassName(fullClassName);

  if (!utility) {
    return [];
  }

  const utilReg = getUtility().find((u) => {
    const fullClassName = utility.value
      ? `${utility.prefix}-${utility.value}`
      : utility.prefix;
    return u.match(fullClassName);
  });
  if (!utilReg) {
    return [];
  }

  let value = utility.value;
  if (utility.negative && value) value = "-" + value;
  let ast = utilReg.handler(value!, ctx, utility, utilReg) || [];

  let wrappers = [];
  let selector = "&";
  for (let i = 0; i < modifiers.length; i++) {
    const variant = modifiers[i];
    const plugin = getModifierPlugins().find((p) => p.match(variant.type, ctx));
    if (!plugin) continue;
    if (plugin.wrap) {
      const items = plugin.wrap(variant, ctx);
      wrappers.push({
        type: "wrap",
        items: items,
      });
      continue;
    }
    if (plugin.modifySelector) {
      const result = plugin.modifySelector({
        selector,
        fullClassName,
        mod: variant,
        context: ctx,
        variantChain: modifiers,
        index: i,
      });
      if (typeof result === "string" && result.includes("&")) {
        wrappers.push({ type: "rule", selector: result });
      } else if (typeof result === "object" && result.selector) {
        const wrappingType = result.wrappingType || "rule";
        wrappers.push({
          type: wrappingType,
          selector: result.selector,
          flatten: result.flatten,
          source: result.source,
        });
      } else if (Array.isArray(result)) {
        wrappers.push({
          type: "wrap",
          items: result.map((r) => ({
            type: r.wrappingType || "rule",
            selector: r.selector,
            source: r.source,
            flatten: r.flatten,
          })),
        });
      }
    }
  }

  // Nest wrappers in N→0 (right→left) order
  for (let i = wrappers.length - 1; i >= 0; i--) {
    const wrap = wrappers[i];

    if (wrap.type === "wrap") {
      ast = ((wrap as any).items as AstNode[]).map((item) => ({
        ...item,
        nodes: Array.isArray(ast) ? ast : [ast],
      }));
    } else if (wrap.type === "style-rule") {
      ast = [
        {
          type: "style-rule",
          selector: wrap.selector!,
          source: wrap.source,
          nodes: Array.isArray(ast) ? ast : [ast],
        },
      ];
    } else if (wrap.type === "at-rule") {
      ast = [
        {
          type: "at-rule",
          name: wrap.name || "media",
          params: wrap.params!,
          source: wrap.source,
          nodes: Array.isArray(ast) ? ast : [ast],
        },
      ];
    } else if (wrap.type === "rule") {
      ast = [
        {
          type: "rule",
          selector: wrap.selector!,
          source: wrap.source,
          nodes: Array.isArray(ast) ? ast : [ast],
        },
      ];
    }
  }

  // Cache the result
  astCache.set(cacheKey, ast);
  // console.log('[parseClassToAst] Cache miss, generated AST for', fullClassName);

  return ast;
}

/**
 * generateCss
 * Takes multiple classNames and generates CSS for each, joining them.
 * - Input: classList(string), CssmaContext, options
 * - Output: string (result of joining multiple CSS blocks)
 * - Processes internally parseClassToAst → optimizeAst → astToCss in sequence
 * - Supports options like dedup, minify
 *
 * @param classList string (e.g., 'bg-red-500 text-lg hover:bg-blue-500')
 * @param ctx CssmaContext
 * @param opts { minify?: boolean, dedup?: boolean }
 * @returns string
 *
 * @example
 *   const css = generateCss('sm:dark:hover:bg-red-500 sm:focus:bg-blue-500', ctx);
 */
export function generateCss(
  classList: string,
  ctx: CssmaContext,
  opts?: { minify?: boolean; dedup?: boolean }
): string {
  const seen = new Set<string>();
  const allAtRootNodes: AstNode[] = []; // atRoot 노드들을 수집
  
  const results = classList
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
      const ast = parseClassToAst(cls, ctx);
      const cleanAst = optimizeAst(ast);
      
      // atRoot 노드들을 수집
      cleanAst.forEach((node) => {
        if (node.type === 'at-root') {
          allAtRootNodes.push(...node.nodes);
          // console.log('[generateCss] Found atRoot nodes for', cls, node.nodes);
        }
      });
      
      const css = astToCss(cleanAst, cls, { minify: opts?.minify });

      const rootCss = rootToCss(allAtRootNodes);

      return `${rootCss ?  `:root,:host {${rootCss}}` : ''}${css}`;
    })
    .join(opts?.minify ? "" : "\n");
  
  // 수집된 atRoot 노드들 로그 출력
  if (allAtRootNodes.length > 0) {
    console.log('[generateCss] All collected atRoot nodes:', allAtRootNodes);
  }
  
  return results;
}

/**
 * 여러 클래스명을 받아 dedup/filter 후 최적화된 결과를 객체 배열로 반환합니다.
 * - 각 객체: { cls, ast, css }
 * - minify, dedup 옵션 지원
 * - 각 클래스별로 astToCss(cleanAst, cls, opts) 적용
 * @param classList string (공백 구분)
 * @param ctx CssmaContext
 * @param opts { minify?: boolean; dedup?: boolean }
 * @returns Array<{ cls: string; ast: AstNode[]; css: string }>
 */
export function generateCssRules(
  classList: string,
  ctx: CssmaContext,
  opts?: { minify?: boolean; dedup?: boolean }
): Array<{ cls: string; ast: any; css: string; rootCss: string }> {
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
      const ast = parseClassToAst(cls, ctx);
      const cleanAst = optimizeAst(ast);

      const allAtRootNodes: AstNode[] = [];
      cleanAst.forEach((node) => {
        if (node.type === 'at-root') {
          allAtRootNodes.push(...node.nodes);
          // console.log('[generateCss] Found atRoot nodes for', cls, node.nodes);
        }
      });

      const css = astToCss(cleanAst, cls, { minify: opts?.minify });
      // console.log('[generateCssRules] css', cls);
      const rootCss = rootToCss(allAtRootNodes);
      return { cls, ast: cleanAst, css, rootCss };
    });
}

/**
 * mergeAstTreeList
 * Takes a list of declPathToAst results (AstNode[][]), merges same at-rule(name, params) etc., and returns the final AST tree.
 * - Input: AstNode[][] (nested ASTs of multiple decl-to-root paths)
 * @returns AstNode[]
 * - Usage: Used in optimizeAst for final AST merging/optimization
 *
 * @param astList AstNode[][]
 * @returns AstNode[]
 */
export function mergeAstTreeList(astList: AstNode[][]): AstNode[] {
  // AstNode[][] → DeclPath[]
  const declPaths: DeclPath[] = astList.map((ast) => {
    // declPathToAst always returns [rootNode]
    const path: AstNode[] = [];
    let node = ast[0];
    while (node) {
      path.push({ ...node, nodes: undefined });
      if (node.nodes && node.nodes.length === 1) node = node.nodes[0];
      else break;
    }
    return path;
  });
  // Recursive merge
  function merge(declPaths: DeclPath[], depth = 0): AstNode[] {
    if (declPaths.length === 0) return [];
    if (declPaths[0].length === depth + 1) {
      // All decls remain
      return declPaths.map((path) => path[depth]) as AstNode[];
    }
    // Group by variant(type+key) at current depth
    const groupMap = new Map<string, DeclPath[]>();
    for (const path of declPaths) {
      const node = path[depth];
      let key = node.type;
      if (node.type === "at-rule") key += ":" + node.name + ":" + node.params;
      else if (node.type === "rule" || node.type === "style-rule")
        key += ":" + node.selector;
      else key += ":" + JSON.stringify(node);
      if (!groupMap.has(key!)) groupMap.set(key!, []);
      groupMap.get(key!)!.push(path);
    }
    // Recursive merge for each group
    const result: AstNode[] = [];
    for (const [key, group] of groupMap.entries()) {
      const node = group[0][depth];
      const children = merge(group, depth + 1);
      result.push(
        children.length
          ? { ...node, nodes: children as AstNode[] }
          : { ...node }
      );
    }
    return result;
  }
  const merged = merge(declPaths);
  return merged;
}
/**
 * optimizeAst
 * Merges/organizes AST generated by parseClassToAst into an optimized AST tree based on decl-to-root path.
 * - Input: AstNode[] (result of parseClassToAst)
 * - Output: Optimized AST tree (AstNode[])
 * - Uses collectDeclPaths, declPathToAst, mergeAstTreeList internally
 * - Reflects all variant wrapping structures (nesting, siblings, merging, etc.)
 *
 * @param ast AstNode[]
 * @returns AstNode[]
 */
export function optimizeAst(ast: AstNode[]): AstNode[] {
  const declPaths = collectDeclPaths(ast);
  const astList = declPaths.map(declPathToAst);
  const merged = mergeAstTreeList(astList);

  return merged;
}
