import { rule, styleRule, type AstNode } from "./ast";
import { escapeClassName } from "./registry";

/**
 * Converts AST nodes to CSS string
 * @param ast { AstNode[] } - Array of AST nodes to convert
 * @param baseSelector { string } - Base selector for nested rules (e.g., ".parent" for ".parent .child")
 * @param opts { minify?: boolean } - Options for CSS generation
 * @param _indent { string } - Current indentation level for pretty formatting
 */
function astToCss(
  ast: AstNode[],
  baseSelector?: string,
  opts?: { minify?: boolean },
  _indent = ""
): string {
  const minify = opts?.minify;
  const indent = _indent;
  const nextIndent = _indent + "  "; // 🔧 다음 레벨 들여쓰기: 현재 + 2칸

  // Note: 캐시는 상위 레벨(IncrementalParser)에서 이미 처리되므로 여기서는 제거

  // Debug logging for empty AST
  if (!ast || ast.length === 0) {
    console.warn('[astToCss] Empty AST received:', { ast, baseSelector, minify });
    return '';
  }

  // 🔍 중복 제거 로직: CSS 속성 선언(decl)의 중복만 제거
  // 
  // 📋 동작 원리:
  // 1. 역순으로 순회 (마지막에 정의된 속성이 우선)
  // 2. decl 타입만 중복 체크 (rule, at-rule은 중복 체크 안함)
  // 3. 속성명(prop)으로 중복 판단
  // 
  // ⚠️ 현재 한계점:
  // - rule, at-rule 등은 중복 체크하지 않음
  // - background.ts에서 @supports + decl 두 개 반환 시 중복 제거 안됨
  // - 이로 인해 CSS 출력에서 중복 규칙이 나타날 수 있음
  let dedupedAst = [];
  if (Array.isArray(ast)) {
    const seenProps = new Map(); // 🔍 이미 본 속성명을 기록하는 Map
    
    // 🔄 역순 순회: 마지막에 정의된 속성을 우선적으로 유지
    // 예: [color: red, color: blue] → [color: blue]만 유지
    for (let i = ast.length - 1; i >= 0; i--) {
      const node = ast[i];
      
      if (node.type === "decl") {
        // 🎯 CSS 속성 선언 노드 처리
        // node.important이 없으므로 안전하게 처리
        const key = node.prop; // 속성명 (예: "color", "background-color")
        
        // 🔍 중복 속성 발견 시 건너뛰기
        if (seenProps.has(key)) {
          continue; // 이미 본 속성이면 건너뛰기
        }
        
        // 📝 새로운 속성 기록
        seenProps.set(key, true);
      }
      
      // 🔄 결과 배열에 노드 추가 (역순 순회이므로 unshift로 원래 순서 유지)
      dedupedAst.unshift(node);
    }
  }

  // 🎨 중복 제거된 AST로 CSS 문자열 생성
  const result = dedupedAst
    .map((node) => {
      switch (node.type) {
        case "decl": {
          // 📝 CSS 속성 선언 처리 (예: color: red;)
          let value = node.value;
          
          // node.important이 없으므로 무시
          if (node.prop.startsWith("--")) {
            // 🎨 CSS 커스텀 속성 처리 (예: --primary-color: #007bff;)
            if (minify) {
              const css = `${node.prop}: ${value};`;
              // console.log("[astToCss] decl custom property minify", css);
              return css;
            } else {
              const css = `${indent}${node.prop}: ${value};`;
              // console.log("[astToCss] decl custom property pretty", css);
              return css;
            }
          } else {
            // 🎨 일반 CSS 속성 처리 (예: color: red;)
            if (minify) {
              const css = `${node.prop}: ${value};`;
              // console.log("[astToCss] decl minify", css);
              return css;
            } else {
              const css = `${indent}${node.prop}: ${value};`;
              // console.log("[astToCss] decl pretty", css);
              return css;
            }
          }
        }
        case "rule": {
          // 🔧 중첩 규칙 처리 (예: .parent .child { ... })
          // 
          // 📋 baseSelector 처리 로직:
          // 1. baseSelector가 있으면: ".parent .child" 형태로 결합
          // 2. baseSelector가 없으면: ".child" 형태로 단독 처리
          // 3. & 기호가 있으면 baseSelector로 치환
          // 4. 가상 선택자(:hover 등)는 baseSelector 뒤에 붙임
          let selector = node.selector;
          
          if (baseSelector) {
            // 🔍 baseSelector가 있는 경우: 중첩 규칙 생성
            const escBase = "." + escapeClassName(baseSelector); // baseSelector를 클래스 형태로 변환
            
            if (selector && selector.includes("&")) {
              // 🎯 & 기호가 있는 경우: baseSelector로 치환
              // 예: "&:hover" → ".parent:hover"
              selector = selector.replace(/&/g, escBase);
            } else if (!selector.startsWith(escBase)) {
              // 🔍 baseSelector로 시작하지 않는 경우: 앞에 추가
              selector = selector
                .split(",") // 쉼표로 구분된 여러 셀렉터 처리
                .map((sel) => {
                  sel = sel.trim();
                  
                  if (sel.startsWith(":") || sel.startsWith("::")) {
                    // 🎯 가상 선택자: baseSelector 뒤에 직접 붙임
                    // 예: ":hover" → ".parent:hover"
                    return escBase + sel;
                  } else {
                    // 🎯 일반 선택자: baseSelector와 공백으로 구분
                    // 예: ".child" → ".parent .child"
                    return escBase + (sel.startsWith(".") ? "" : " ") + sel;
                  }
                })
                .join(", ");
            }
          }
          
          // 🎨 CSS 규칙 생성
          if (minify) {
            const css = `${indent}${selector}{${astToCss(
              node.nodes, // 🔄 하위 노드들 재귀 처리
              baseSelector, // 🔄 baseSelector 전달 (중첩 규칙에서 사용)
              opts,
              nextIndent
            )}}`;
            // console.log("[astToCss] rule minify", css);
            return css;
          } else {
            const css = `${indent}${selector} {\n${astToCss(
              node.nodes, // 🔄 하위 노드들 재귀 처리
              baseSelector, // 🔄 baseSelector 전달 (중첩 규칙에서 사용)
              opts,
              nextIndent
            )}${indent}}`;
            // console.log("[astToCss] rule pretty", css);
            return css;
          }
        }
        case "style-rule": {
          // 🎯 스타일 규칙 처리: 완전한 셀렉터를 가진 최상위 규칙
          // 
          // 📋 baseSelector 처리:
          // - 현재: baseSelector를 그대로 전달
          // - 문제점: 하위에 rule이 있을 때 baseSelector가 올바르게 처리되지 않을 수 있음
          // - 예시: .bg-white/60 { .nested { ... } } → .bg-white/60 .nested { ... }
          if (minify) {
            const css = `${indent}${node.selector} {${astToCss(
              node.nodes, // 🔄 하위 노드들 재귀 처리
              baseSelector, // 🔄 baseSelector 전달 (하위 rule에서 사용)
              opts,
              nextIndent
            )}}`;
            // console.log("[astToCss] style-rule minify", css);
            return css;
          } else {
            const css = `${indent}${node.selector} {\n${astToCss(
              node.nodes, // 🔄 하위 노드들 재귀 처리
              baseSelector, // 🔄 baseSelector 전달 (하위 rule에서 사용)
              opts,
              nextIndent
            )}${indent}}`;
            // console.log("[astToCss] style-rule pretty", css, JSON.stringify(node, null, 2));
            return css;
          }
        }
        case "at-rule": {
          // 📋 @규칙 처리: @media, @supports 등
          // 
          // 📋 baseSelector 처리:
          // - @규칙 내부의 노드들에게 baseSelector 전달
          // - 중첩된 규칙들이 올바른 셀렉터를 가질 수 있도록 함
          // - 예시: @media (min-width: 768px) { .parent .child { ... } }
          const shouldUseBaseSelector = node.name !== 'supports'; // Added logic for @supports
          if (minify) {
            const css = `${indent}@${node.name} ${node.params}{${astToCss(
              node.nodes, // 🔄 @규칙 내부 노드들 재귀 처리
              shouldUseBaseSelector ? baseSelector : undefined, // Conditional baseSelector
              opts,
              nextIndent
            )}}`;
            // console.log("[astToCss] at-rule minify", css);
            return css;
          } else {
            const css = `${indent}@${node.name} ${node.params} {\n${astToCss(
              node.nodes, // 🔄 @규칙 내부 노드들 재귀 처리
              shouldUseBaseSelector ? baseSelector : undefined, // Conditional baseSelector
              opts,
              nextIndent
            )}${indent}}`;
            // console.log("[astToCss] at-rule pretty", css);
            return css;
          }
        }
        case "comment":
          // 💬 CSS 주석 처리 (minify 모드에서는 제거)
          return minify ? "" : `${indent}/* ${node.text} */`;
        case "raw":
          // 📝 원시 CSS 코드 처리 (그대로 출력)
          return `${indent}${node.value}`;
        default:
          console.warn('[astToCss] Unknown node type:', node);
          return "";
      }
    })
    .filter(Boolean) // 🔍 빈 문자열 제거
    .join(minify ? "" : "\n"); // 🔗 노드들을 연결 (minify: 공백 없음, pretty: 줄바꿈)

  // Add trailing newline for consistency with expected format
  const finalResult = result + (minify ? "" : "\n");
  
  // Debug logging for empty result
  if (!finalResult || finalResult.trim() === '') {
    console.warn('[astToCss] Empty result generated:', { 
      ast, 
      baseSelector, 
      minify, 
      result, 
      finalResult,
      dedupedAst 
    });
  }
  
  return finalResult;
}

function rootToCss(nodes: AstNode[]): string {
  // console.log("[rootToCss] input", { nodes });
  return nodes
    .map((node) => {
      const list: string[] = [];

      if (node.type === "decl") {
        list.push(`${node.prop}: ${node.value};`);
      } else if (node.type === "at-rule") {
        list.push(`@${node.name} ${node.params} {
${node.nodes.map((node) => {
  // console.log("[rootToCss] node", node);
  if (node.type === "decl") {
    return `${node.prop}: ${node.value};`;
  }
})
.join("\n")}
}`
        );
      }

      return list.join("\n");
    })
    .join("\n");
}

export { astToCss, rootToCss };
