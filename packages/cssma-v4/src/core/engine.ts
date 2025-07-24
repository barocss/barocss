import { type AstNode } from "./ast";
import { parseClassName } from "./parser";
import { getUtility, getModifierPlugins } from "./registry";
import { CssmaContext } from "./context";
import { astToCss } from "./astToCss";

/**
 * decl-to-root path 리스트 수집 함수 (normalizeAstOrder 등에서 재사용)
 */
export type PathNode = Partial<AstNode>;
export type DeclPath = PathNode[];

/**
 * collectDeclPaths
 * AST 트리에서 decl(leaf)까지의 모든 경로(variant chain 포함)를 수집합니다.
 * - 입력: AST 노드 배열
 * - 출력: decl-to-root path(variant chain) 배열
 * - 용도: optimizeAst, declPathToAst 등에서 AST 최적화/병합을 위한 경로 추출에 사용
 *
 * @param nodes AstNode[] - AST 트리
 * @param path PathNode[] - 재그용(초기값 생략)
 * @returns DeclPath[] - decl까지의 경로(variant chain) 배열
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

// 정렬 기준: at-rule > style-rule > rule > decl, depth 우선, sibling 순서 보장
function getPriority(type: string): number {
  if (type === "at-rule") return 0;
  if (type === "style-rule") return 10;
  if (type === "rule") return 20;
  return 30; // decl
}

const sourcePriority: Record<string, number> = {
  media: 0,         // @media
  supports: 1,      // @supports
  container: 2,     // @container
  responsive: 10,   // sm:, md: 등
  group: 20,        // .group:hover &
  peer: 30,         // .peer:focus ~ &
  dark: 40,         // dark:
  universal: 50,    // :is(), :where()
  data: 60,         // [data-state=...]
  aria: 70,         // [aria-pressed=...]
  attribute: 80,    // [type=...]
  pseudo: 90,       // :hover, :focus
  base: 100,        // &
  starting: 110,    // (루트)
}

function getRulePriority(rule: Partial<AstNode>): number {
  return sourcePriority[rule.source || 'base'] || 100;
}

const mergeSelectorsBySource = (source: string, nodes: Partial<AstNode>[]) => {
  if (source === "pseudo") {
    // 안쪽→바깥 (reduce)
    return nodes.reduce((acc, sel) => {
      const selector = (sel as any).selector as string;
      if (acc === "") return selector;
      if (selector?.includes("&")) return selector.replace(/&/, acc);
      return selector + " " + acc;
    }, "");
  } else {
    // 바깥→안쪽 (reduceRight)
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
 * decl-to-root path(variant chain)를 실제 중첩 AST로 변환합니다.
 * - 입력: DeclPath(variant chain)
 * - 출력: 중첩된 AstNode[]
 * - 연속된 같은 variant(동일 key)는 병합, 바깥→안쪽 순서로 중첩
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
  const sortedVariants = [...variants].sort((a, b) => getPriority(a.type!) - getPriority(b.type!));
  const mergedVariants: typeof sortedVariants = [];
  for (const v of sortedVariants) {
    if (mergedVariants.length === 0) {
      mergedVariants.push(v);
    } else {
      const prev = mergedVariants[mergedVariants.length - 1];
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
  // 3. rule만 따로 모으기 (연속된 rule만)
  const ruleSelectors: Partial<AstNode>[] = [];
  const nonRuleVariants: any[] = [];
  for (const v of mergedVariants) {
    if (v.type === "rule") ruleSelectors.push(v);
    else nonRuleVariants.push(v);
  }

  // 5. selector 합성 및 단일 rule 생성
  let node: AstNode = { ...decl };
  let sortedRuleSelectors = [...ruleSelectors].sort((a, b) => getRulePriority(a) - getRulePriority(b));
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
      .sort(([a], [b]) => (sourcePriority[a] ?? 999) - (sourcePriority[b] ?? 999))
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
 * className(variant chain 포함)을 파싱하여 AST 트리를 생성합니다.
 * - 입력: className(string), CssmaContext
 * - 출력: AstNode[] (variant wrapping path별로 여러 root 가능)
 * - variant wrapping 구조(데카르트 곱, 중첩, sibling 등) 완벽 지원
 * - 각 variant의 wrap/modifySelector 결과를 wrappers에 쌓고, 오른쪽→왼쪽 순서로 중첩 적용
 * - 최종적으로 여러 root ast를 반환할 수 있음
 *
 * @param fullClassName string (예: 'sm:dark:hover:bg-red-500')
 * @param ctx CssmaContext
 * @returns AstNode[]
 *
 * @example
 *   const ast = parseClassToAst('sm:dark:hover:bg-red-500', ctx);
 *   // ast는 sm, dark, hover variant가 중첩된 AST 트리
 */
export function parseClassToAst(
  fullClassName: string,
  ctx: CssmaContext
): AstNode[] {
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
      const result = plugin.modifySelector({ selector, fullClassName, mod: variant, context: ctx, variantChain: modifiers, index: i });
      if (typeof result === "string" && result.includes("&")) {
        wrappers.push({ type: "rule", selector: result });
      } else if (typeof result === "object" && result.selector) {
        const wrappingType = result.wrappingType || "rule";
        wrappers.push({ type: wrappingType, selector: result.selector, flatten: result.flatten, source: result.source });
      } else if (Array.isArray(result)) {
        for (const r of result) {
          const wrappingType = r.wrappingType || "rule";
          wrappers.push({ type: wrappingType, selector: r.selector, source: r.source, flatten: r.flatten });
        }
      }
    }
  }

  // wrappers를 N→0(오른쪽→왼쪽) 순서로 중첩
  for (let i = wrappers.length - 1; i >= 0; i--) {
    const wrap = wrappers[i];

    if (wrap.type === "wrap") {
      ast = ((wrap as any).items as AstNode[]).map(item => ({ ...item, nodes: Array.isArray(ast) ? ast : [ast] }));
    } else if (wrap.type === "style-rule") {
      ast = [{ type: "style-rule", selector: wrap.selector!, source: wrap.source, nodes: Array.isArray(ast) ? ast : [ast] }];
    } else if (wrap.type === "at-rule") {
      ast = [{ type: "at-rule", name: wrap.name || "media", params: wrap.params!, source: wrap.source, nodes: Array.isArray(ast) ? ast : [ast] }];
    } else if (wrap.type === "rule") {
      ast = [{ type: "rule", selector: wrap.selector!, source: wrap.source, nodes: Array.isArray(ast) ? ast : [ast] }];
    }
  }
  return ast;
}

/**
 * generateCss
 * 여러 className을 받아 각각의 유틸리티 CSS를 생성합니다.
 * - 입력: classList(string), CssmaContext, 옵션
 * - 출력: string (여러 CSS 블록이 join된 결과)
 * - 내부적으로 parseClassToAst → optimizeAst → astToCss 순으로 처리
 * - dedup, minify 등 옵션 지원
 *
 * @param classList string (예: 'bg-red-500 text-lg hover:bg-blue-500')
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
      const css = astToCss(cleanAst, cls, { minify: opts?.minify });

      return css;
    })
    .join(opts?.minify ? "" : "\n");
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
): Array<{ cls: string; ast: any; css: string }> {
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
      const css = astToCss(cleanAst, cls, { minify: opts?.minify });
      return { cls, ast: cleanAst, css };
    });
}

/**
 * mergeAstTreeList
 * declPathToAst 결과 리스트(AstNode[][])를 받아, 같은 at-rule(name, params) 등은 하나로 합치고 그 아래는 sibling으로 분리하는 방식으로 최종 AST 트리를 반환합니다.
 * - 입력: AstNode[][] (여러 decl-to-root path의 중첩 AST)
 * @returns AstNode[]
 * - 용도: optimizeAst에서 최종 AST 병합/최적화에 사용
 *
 * @param astList AstNode[][]
 * @returns AstNode[]
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
      return declPaths.map(path => path[depth]) as AstNode[];
    }
    // 현재 depth의 variant(type+key)로 그룹핑
    const groupMap = new Map<string, DeclPath[]>();
    for (const path of declPaths) {
      const node = path[depth];
      let key = node.type;
      if (node.type === 'at-rule') key += ':' + node.name + ':' + node.params;
      else if (node.type === 'rule' || node.type === 'style-rule') key += ':' + node.selector;
      else key += ':' + JSON.stringify(node);
      if (!groupMap.has(key!)) groupMap.set(key!, []);
      groupMap.get(key!)!.push(path);
    }
    // 각 그룹별로 재그 병합
    const result: AstNode[] = [];
    for (const [key, group] of groupMap.entries()) {
      const node = group[0][depth];
      const children = merge(group, depth + 1);   
      result.push(children.length
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
 * parseClassToAst 등에서 생성된 AST를 decl-to-root path 기반으로 최적화된 AST 트리로 병합/정리합니다.
 * - 입력: AstNode[] (parseClassToAst 결과)
 * - 출력: 최적화된 AST 트리(AstNode[])
 * - 내부적으로 collectDeclPaths, declPathToAst, mergeAstTreeList를 사용
 * - variant wrapping 구조(중첩, sibling, 병합 등)를 모두 반영
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
