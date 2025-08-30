import { type AstNode } from "./ast";
import { parseClassName } from "./parser";
import { astCache } from "../utils/cache";
import { getUtility, getModifierPlugins } from "./registry";
import { Context } from "./context";
import { astToCss, rootToCss } from "./astToCss";
import { clearAllCaches } from "../utils/cache";

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
    delete (curr as any).nodes;
    if (node.type === "decl") {
      result.push([...path, curr]);
    } else if ((node as any).nodes && (node as any).nodes.length > 0) {
      result = result.concat(
        collectDeclPaths((node as any).nodes, [...path, curr])
      );
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
  // Log type/selector/source for each node in declPath
  // 1. Separate decl (leaf) and variant chain
  const variants = declPath.slice(0, -1);
  const decl = declPath[declPath.length - 1];

  // 2. Keep existing sort/merge (hoist) logic
  const sortedVariants = [...variants].sort(
    (a, b) => getPriority(a.type!) - getPriority(b.type!)
  );

  // Add default rule handling for decl
  // 1. If first element is decl, add rule('&', [decl])
  // 2. If rule lacks '&' while child is decl, add current rule and rule('&', [decl])
  if (sortedVariants.length === 0) {
    if (decl.type === "decl") {
      // If first element is decl, add rule('&', [decl])
      sortedVariants.push({
        type: "rule",
        selector: "&",
        source: "base",
      });
    }
  } else {
    const last = sortedVariants[sortedVariants.length - 1];
    if (
      (last.type == "at-rule" && last.name !== "property") ||
      last.type == "style-rule" ||
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
  // 3. Gather only rule nodes (consecutive rules only)
  const ruleSelectors: Partial<AstNode>[] = [];
  const nonRuleVariants: any[] = [];
  for (const v of mergedVariants) {
    if (v.type === "rule") ruleSelectors.push(v);
    else nonRuleVariants.push(v);
  }

  // 5. Compose selector and create a single rule
  let node: AstNode = { ...decl } as any;
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
    // Detailed grouped log

    // 1. Sort by sourcePriority
    const mergedBySource = Object.entries(grouped)
      .sort(
        ([a], [b]) => (sourcePriority[a] ?? 999) - (sourcePriority[b] ?? 999)
      )
      .map(([source, nodes]) => {
        const merged = mergeSelectorsBySource(source, nodes);
        return merged;
      });

    // 2. Reduce from outside→inside (pseudo is always innermost)
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

  // 6. Nest remaining variants (e.g., at-rule) outside
  for (let i = nonRuleVariants.length - 1; i >= 0; i--) {
    node = { ...nonRuleVariants[i], nodes: [node] };
  }

  return [node];
}

/**
 * extractAtRootNodes
 * Extracts at-root nodes from AST tree and returns them as an array.
 * - Input: AstNode[]
 * - Output: AstNode[]
 * - Usage: Used in parseClassToAst for at-root node extraction
 *
 * @param nodes AstNode[]
 * @param parent AstNode
 * @param atRootNodes AstNode[]
 */
function extractAtRootNodes(
  nodes: AstNode[],
  parent?: AstNode,
  atRootNodes: AstNode[] = []
) {
  for (var i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === "at-root") {
      atRootNodes.push(node);
      delete nodes[i];
    } else if (node.type === "rule" || node.type === "style-rule") {
      extractAtRootNodes(node.nodes, node, atRootNodes);
    }
  }

  if (parent) {
    (parent as any).nodes = nodes.filter(Boolean) as AstNode[];
  }
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
  ctx: Context
): AstNode[] {
  // Check AST cache first
  // Simpler cache key: className + context hash
  const contextHash = JSON.stringify({
    darkMode: ctx.config("darkMode"),
    darkModeSelector: ctx.config("darkModeSelector"),
    theme: ctx.theme,
  });
  const cacheKey = `${fullClassName}:${contextHash}`;
  if (astCache.has(cacheKey)) {
    return astCache.get(cacheKey)!;
  }

  const { modifiers, utility } = parseClassName(fullClassName);

  if (!utility) {
    console.warn(`[CSSMA] Invalid class name format: "${fullClassName}"`);
    return [];
  }

  const utilReg = getUtility().find((u) => {
    const fullClassName = utility.value
      ? `${utility.prefix}-${utility.value}`
      : utility.prefix;
    return u.match(fullClassName);
  });
  if (!utilReg) {
    const utilityName = utility.value
      ? `${utility.prefix}-${utility.value}`
      : utility.prefix;
    console.warn(`[CSSMA] Unknown utility class: "${utilityName}" in "${fullClassName}"`);
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

    if (!plugin) {
      console.warn(`[CSSMA] Unknown variant: "${variant.type}" in "${fullClassName}"`);
      continue;
    }

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
          name: (wrap as any).name || "media",
          params: (wrap as any).params!,
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

  // console.log("[parseClassToAst] ast", ast);

  // ast 에서 at-root 노드만 추출해서 ast 앞으로 추가
  // ast 내부에서는 at-root 노드를 제거
  // 재귀적으로 실행되어야 함
  const atRootNodes: AstNode[] = [];

  extractAtRootNodes(ast, undefined, atRootNodes);

  ast = [...atRootNodes, ...ast].filter(Boolean);

  // console.log("[parseClassToAst] ast", ast);
  // Cache the result
  astCache.set(cacheKey, ast);

  return ast;
}

/**
 * Clear all AST caches (mainly for testing)
 */
export function clearAstCache(): void {
  clearAllCaches();
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
  ctx: Context,
  opts?: { minify?: boolean; dedup?: boolean }
): string {
  const seen = new Set<string>();
  const allAtRootNodes: AstNode[] = [];

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

      cleanAst.forEach((node) => {
        if (node.type === "at-root") {
          allAtRootNodes.push(...node.nodes);
        }
      });

      // If style-rule already has a complete selector, do not pass baseSelector
      const hasStyleRule = cleanAst.some((node) => node.type === "style-rule");
      const css = astToCss(cleanAst, hasStyleRule ? undefined : cls, {
        minify: opts?.minify,
      }); // Conditional baseSelector

      const rootCss = rootToCss(allAtRootNodes);
      const result = `${rootCss ? `:root,:host {${rootCss}}` : ""}${css}`;

      // Debug logging for empty CSS
      if (!result || result.trim() === "") {
        console.warn("[generateCss] Empty CSS generated for class:", {
          class: cls,
          ast: cleanAst,
          hasStyleRule,
          css,
          rootCss,
          result,
        });
      }

      return result;
    })
    .join(opts?.minify ? "" : "\n");

  if (allAtRootNodes.length > 0) {
    console.log("[generateCss] All collected atRoot nodes:", allAtRootNodes);
  }

  // Debug logging for final result
  if (!results || results.trim() === "") {
    console.warn("[generateCss] Empty final result:", {
      classList,
      results,
      allAtRootNodes,
    });
  }

  return results;
}

export type GenerateCssRulesResult = {
  cls: string;
  ast: AstNode[];
  css: string;
  cssList: string[];
  rootCss: string;
  rootCssList: string[];
};

/**
 * Returns an array of optimized results for multiple class names with dedup/filter.
 * - Each object: { cls, ast, css }
 * - Supports minify, dedup options
 * - Applies astToCss(cleanAst, cls, opts) per class
 * @param classList string (space-separated)
 * @param ctx CssmaContext
 * @param opts { minify?: boolean; dedup?: boolean }
 * @returns Array<{ cls: string; ast: AstNode[]; css: string }>
 */
export function generateCssRules(
  classList: string,
  ctx: Context,
  opts?: { minify?: boolean; dedup?: boolean }
): Array<GenerateCssRulesResult> {
  const seen = new Set<string>();
  const options = {
    minify: opts?.minify,
    dedup: opts?.dedup,
  };
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
      // console.log("[generateCssRules] cls", cls);
      const ast = parseClassToAst(cls, ctx);
      const cleanAst = optimizeAst(ast);

      // console.log("[generateCssRules] cleanAst", cleanAst);

      const allAtRootNodes: AstNode[] = cleanAst
        .filter(
          (node) => node.type === "at-root" && !node.source
        )
        .map((node) => node.nodes)
        .flat();
      const allCleanAst: AstNode[] = cleanAst.filter(
        (node) =>
          node.type !== "at-root" ||
          (node.type === "at-root" && node.source)
      );


      let cssList = [];
      for (const node of allCleanAst) {
        if (node.type === "at-root") {
          node.nodes.forEach((node) => {
            const css = astToCss([node], "", options);
            cssList.push(css);
          });
        } else {
          const css = astToCss([node], cls, options);
          cssList.push(css);
        }
      }
      // console.log('[generateCssRules] css', cls);
      let rootCssList = [];
      for (const node of allAtRootNodes) {
        const css = rootToCss([node]);
        rootCssList.push(css);
      }
      // console.log("[generateCssRules] rootCss", rootCssList, allAtRootNodes);
      return {
        cls,
        ast: allCleanAst,
        css: cssList.join(options.minify ? "" : "\n"),
        cssList,
        rootCss: rootCssList.join(options.minify ? "" : "\n"),
        rootCssList,
      };
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
      path.push({ ...node, nodes: undefined } as any);
      if ((node as any).nodes && (node as any).nodes.length === 1)
        node = (node as any).nodes[0];
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
          ? ({ ...node, nodes: children as AstNode[] } as any)
          : ({ ...node } as any)
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
  // console.log("[optimizeAst] ast", ast);
  const declPaths = collectDeclPaths(ast);
  // console.log("[optimizeAst] declPaths", declPaths);
  const astList = declPaths.map(declPathToAst);
  // console.log("[optimizeAst] astList", astList);
  const merged = mergeAstTreeList(astList);
  // console.log("[optimizeAst] merged", merged);

  return merged;
}
