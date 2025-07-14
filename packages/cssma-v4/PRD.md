# PRD (Product Requirements Document)

## 프로젝트 개요

cssma-v4는 Tailwind CSS와 유사한 방식의 유틸리티 클래스 기반 CSS 파서 및 변환기입니다. 입력된 클래스명 문자열을 파싱하여, 미리 등록된 유틸리티/모디파이어만 AST로 변환하고, 이를 CSS 코드로 출력합니다. 확장성과 안전성, 그리고 테마 기반 동적 값 지원을 목표로 합니다.

## 주요 목표

1. **등록 기반 파싱 및 Registry 시스템**
   - 오직 registry에 등록된 유틸리티/모디파이어만 파싱 및 변환
   - registry는 유틸리티/모디파이어의 이름, 매칭 함수, 변환 핸들러, 설명 등 메타데이터를 포함하는 객체의 배열로 구성
   - 미등록 문법(클래스명)은 무시하거나 파싱 결과에 포함되지 않음
   - 유틸리티/모디파이어는 객체 형태로 registry에 명시적으로 등록/해제 가능
   - registry 기반 파싱 원칙: 등록된 prefix, 패턴, modifier만 인식하며, 그 외는 일절 파싱하지 않음

2. **Tailwind CSS 호환성 및 확장성**
   - Tailwind CSS의 주요 유틸리티/모디파이어 패턴을 지원
   - 임의값(`bg-[red]`), 커스텀 프로퍼티(`bg-(--my-bg)`) 등 동적 문법 지원
   - 새로운 유틸리티/모디파이어는 registry에 등록만 하면 즉시 사용 가능 (핫플러그 확장성)
   - registry를 통한 플러그인/외부 확장 지원

3. **AST 기반 변환 및 후처리**
   - 파싱 결과를 AST(Abstract Syntax Tree)로 변환
   - AST는 CSS 변환, 후처리, 분석, 최적화 등에 활용 가능
   - 중첩 규칙, at-rule, deduplication, !important, custom property 등 지원

4. **테마/컨텍스트 기반 동적 값 지원**
   - theme/config/context를 통해 색상, spacing 등 동적 값 지원
   - 테마 값이 없을 경우 fallback 처리
   - 테마/프리셋 확장 및 병합 지원

5. **동적 등록/해제 및 플러그인 시스템**
   - 유틸리티/모디파이어 동적 등록/해제 지원 (런타임에 registry 조작 가능)
   - 플러그인 형태로 외부 확장 가능 (외부 패키지에서 registry에 유틸리티/모디파이어 추가)
   - registry의 일관성, 충돌 방지, 동적 관리 API 제공

6. **테스트 및 문서화**
   - 등록/해제, 미등록, 임의값, 커스텀 프로퍼티 등 모든 케이스를 테스트로 보장
   - 실제 사용 예시, 통합 테스트, 문서화까지 포함

## AST 타입/구조 명세

- 모든 파싱 결과는 AST(Abstract Syntax Tree) 노드로 반환
- AST 노드 타입 예시:
  ```ts
  type AstNode =
    | { type: 'decl'; prop: string; value: string }
    | { type: 'atrule'; name: string; params: string; nodes: AstNode[] }
    | { type: 'rule'; selector: string; nodes: AstNode[] }
    | { type: 'comment'; text: string }
    | { type: 'raw'; value: string };
  ```
- 각 노드 생성 함수 제공: `decl()`, `atrule()`, `rule()`, `comment()`, `raw()`
- AST는 중첩, at-rule, 커스텀 프로퍼티, !important, deduplication 등 CSS의 모든 구조를 표현 가능해야 함

## Registry 엔트리 타입/필드 명세

- 유틸리티/모디파이어 각각 별도의 배열(`utilityRegistry`, `modifierRegistry`)로 관리
- 각 엔트리 예시:
  ```ts
  interface UtilityRegistration {
    name: string;
    match: (className: string) => boolean;
    handler: (value: string, ctx: CssmaContext, token: any, options: UtilityRegistration) => AstNode[] | undefined;
    description?: string;
    category?: string;
  }
  interface ModifierRegistration {
    name: string;
    type: string;
    match: (mod: any) => boolean;
    handler: (nodes: AstNode[], mod: any, ctx: CssmaContext) => AstNode[];
    selector?: (mod: any) => string;
    atrule?: (mod: any) => { name: string; params: string };
    description?: string;
    sort?: number;
  }
  ```
- 런타임에 동적으로 추가/삭제/조회 가능
- 중복 방지, 충돌 처리, 일관성 보장

## 파서/엔진의 에러 처리 정책

- 파싱 실패/미등록/핸들러 예외 발생 시 빈 배열([]) 반환 (에러 throw 금지)
- registry의 match/handler에서 예외 발생 시 내부적으로 무시하고, 결과에 포함하지 않음
- 파싱 불가/미지원 문법은 결과에서 완전히 제외

## 플러그인 시스템의 확장 범위

- registry 조작(유틸리티/모디파이어 동적 등록/해제) 외에도,
  - context/theme 확장
  - AST 후처리(예: postcss 플러그인처럼 AST 변환)
  - 파서/엔진 래핑(커스텀 파서/엔진 주입)
  - 외부 preset/theme 병합
- 플러그인 개발을 위한 공식 API/가이드 제공

## 성능/테스트/문서화 목표

- 대량 클래스 파싱, AST 변환의 성능 기준: 10,000개 클래스 파싱 시 1초 이내
- TypeScript strict mode 100% 지원, public API에 타입 명시
- 테스트 커버리지 90% 이상, mutation test 등 품질 기준
- 문서화: registry 구조, AST 타입, context 사용법, 확장/플러그인 가이드, 예제 코드, 구조 다이어그램 등 제공

## 세부 요구사항

- [ ] Tailwind CSS의 주요 유틸리티(색상, spacing, border, layout 등) 지원
- [ ] 주요 modifier(hover, focus, sm, md 등) 지원
- [ ] 임의값, 커스텀 프로퍼티, 음수값 등 동적 문법 지원
- [ ] theme/config/context 병합 및 확장 지원
- [ ] AST → CSS 변환 시 중첩, deduplication, !important 등 지원
- [ ] 플러그인/외부 확장성 보장
- [ ] 테스트 커버리지 90% 이상
- [ ] 문서화 및 사용 예시 제공 