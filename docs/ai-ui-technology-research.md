# AI 생성 UI와 BaroCSS: 기술 조사 및 2주 PoC

조사일: 2026-09-23. 저장소 코드 기준: `4462645`(Core·Pulse·Mirror·Ship 변경 전 독립 worktree). 이 문서는 기술 선택을 위한 제안이다. 벤치마크 결과나 사용자 수요를 주장하지 않는다. 제품 가격과 API는 바뀔 수 있으므로 도입 시 링크를 다시 확인한다.

## 1. 목표와 현재 코드

목표는 모델이 새 UI와 클래스를 만들 때, 빌드 단계 없이 CSS를 적용하고 결과를 즉시 미리 보는 것이다. BaroCSS는 UI 생성기 자체가 아니다. 현 코드는 다음 역할을 가진다.

| 층 | 현재 역할 | PoC 접점 |
| --- | --- | --- |
| `@barocss/kit` | 클래스 파싱, AST, CSS 생성. `createContext`, `generateCssRules`를 공개한다. | 클래스별 CSS 생성 결과와 미지원 결과 확인. |
| `@barocss/browser` | `MutationObserver`로 DOM 클래스 변경을 찾고 CSS를 `<style>`에 넣는다. `BrowserRuntime`이 `addClass`, `observe`, `updateConfig`, `destroy`를 제공한다. | 렌더된 UI의 클래스 적용. Pulse 작업 후 공개 API 확정. |
| `@barocss/server` | DOM 없이 클래스 입력의 CSS를 생성한다. | SSR 또는 검증 경로의 후보. |

근거: [kit 엔트리](../packages/barocss/src/index.ts), [엔진](../packages/barocss/src/core/engine.ts), [브라우저 런타임](../packages/barocss-browser/src/browser-runtime.ts), [DOM 감지기](../packages/barocss-browser/src/change-detector.ts), [서버 런타임](../packages/barocss-server/src/index.ts), [설정 타입](../packages/barocss/src/core/context.ts).

현재 제약도 설계 입력이다. `README.md`의 “95%+”와 “완전 Tailwind 호환”은 이 저장소의 측정 결과로 입증되지 않았다. Tailwind v4는 설정과 유틸리티 의미가 바뀌었으므로 기준 버전을 고정해야 한다([공식 업그레이드 안내](https://tailwindcss.com/docs/upgrade-guide)). 코어에는 전역 캐시와 실패 캐시가 있다. 현 브라우저 코드에서는 `applyParseResults`가 결과를 `cache`에 기록하지 않으므로 `getCss`와 `getClasses`를 PoC의 관측 수단으로 가정하면 안 된다. `updateConfig`는 기존 parser를 다시 만들지 않는다. `ServerRuntime.generateCss`는 빈 결과에서 `result[0].css`를 읽을 수 있다. Core와 Pulse 작업에서 이 경로를 수정·검증 중이다. 이 문서는 해당 구현을 변경하지 않는다.

Mirror 작업의 **초기 표본**은 Tailwind CSS 4.1.13을 정확히 고정하고 클래스 15개를 비교했다. CSS 구조 일치 8개, 구조 차이 6개, 미지원 1개(`mask-linear-from-50%`)다. 구조 차이에는 값이 같을 수 있는 변수·표기 차이와 의미 차이가 섞여 있다. 특히 `hover:block`에는 Tailwind의 `@media (hover: hover)` 조건이 빠진다. 이 15개는 호환율 모집단이 아니다. 재현 방법과 판정은 Mirror의 `packages/barocss/docs/tailwind-compatibility.md`에 있다. 해당 문서는 별도 worktree에서 작성 중이므로 통합 후 경로를 확인해야 한다.

## 2. 평가 기준

우선순위는 BaroCSS 목표에 맞췄다. 실시간 응답(25%), 생성 품질(20%), Tailwind 기준 클래스 호환(15%), 보안(15%), 통합 난도(10%), 이식성(10%), 비용(5%)이다. 이 가중치는 제품 판단이며 실측값이 아니다. 아래의 “높음/중간/낮음”도 문서로 확인한 기능에 대한 정성 평가다. 지연·품질·호환율은 PoC에서 측정한다.

| 선택지 | 실시간 응답 | 생성 품질 범위 | Tailwind/BaroCSS 연결 | 보안 | 통합 난도 | 이식성 | 비용 구조 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **A. 자체 제한 UI JSON + 모델 구조화 출력 + BaroCSS** | 부분 결과 적용을 설계할 수 있음 | 등록한 컴포넌트 범위로 제한 | 클래스 배열을 직접 검증·적용 | 코드 실행 없이 경계 설정 가능 | 중간 | 스키마와 렌더러를 분리하면 높음 | 모델 토큰 + 자체 운영 |
| **B. `json-render`의 자체 카탈로그 + BaroCSS** | JSONL patch 스트림 지원 | 카탈로그 범위로 제한 | 기본 shadcn 묶음 대신 BaroCSS용 렌더러 필요 | 카탈로그/액션 제한 제공. 클래스 검증은 별도 | 중간 | React 외 Vue·Svelte 등 지원 | Apache-2.0 패키지 + 모델 토큰 |
| **C. v0/Bolt 방식의 코드 생성 + 격리 실행** | 코드 생성·빌드·미리보기 지연을 측정해야 함 | 임의 앱까지 넓음 | 생성 코드의 클래스와 설정을 추출·검증해야 함 | 별도 실행 격리 필요 | 높음 | 생성 스택·샌드박스에 종속 | 모델/API + 실행 시간/라이선스 |

**추천: A.** BaroCSS가 가장 잘하는 일은 새 클래스에 즉시 CSS를 붙이는 것이다. A는 그 접점을 직접 검증하고, 자유 형식 코드의 실행 문제를 PoC 범위에서 제거한다. B는 스키마 편집·스트림 처리 개발량이 커질 때 비교할 대안이다. C는 사용자가 실제로 임의 앱 생성과 코드 편집을 원한다는 근거가 생긴 뒤 검토한다. 이 추천은 설계 추론이다. 아직 속도나 품질 우위를 측정하지 않았다.

## 3. 기술별 확인 사항

### 3.1 프롬프트 → UI 코드

- [v0 Model API](https://v0.dev/docs/v0-model-api)는 텍스트·이미지 입력과 스트리밍 코드 생성을 제공한다. [Platform API](https://v0.dev/docs/v0-platform-api/chats/chats.create)는 프로젝트 내 채팅 생성을 제공한다. Model API 문서는 베타 및 유료 플랜/사용량 과금을 명시한다. v0 출력은 특정 웹 스택에 맞춘 코드이므로 BaroCSS 클래스 사용을 강제하거나 결과를 안전하게 실행하는 단계가 별도로 필요하다.
- [Bolt 오픈소스 저장소](https://github.com/stackblitz/bolt.new)에는 프롬프트·파일 수정·미리보기 흐름의 참고 구현이 있다. 저장소는 MIT다. 실행 기반인 [WebContainer API](https://developer.stackblitz.com/platform/api/webcontainer-api)는 브라우저에서 Node 앱을 실행한다. [StackBlitz 약관](https://stackblitz.com/terms-of-service)은 상용 WebContainer 사용에 활성 플랜 또는 별도 라이선스가 필요하다고 한다. 오픈소스 Bolt 코드의 MIT와 실행 서비스 라이선스는 구분해야 한다.
- 모델 제공자는 한 곳으로 고정할 이유가 없다. [OpenAI 구조화 출력](https://developers.openai.com/api/docs/guides/structured-outputs), [Gemini 구조화 출력](https://ai.google.dev/gemini-api/docs/structured-output), [AI SDK의 구조화 출력](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)을 PoC 후보로 둔다. 가격은 [OpenAI](https://developers.openai.com/api/docs/pricing), [Gemini](https://ai.google.dev/gemini-api/docs/pricing)의 입력·출력 토큰 및 제한에 따라 달라진다. 현재 단가를 코드나 계획의 고정값으로 두지 않는다.

비용 기록식은 `(입력 토큰 × 입력 단가 + 출력 토큰 × 출력 단가) / 1,000,000 + 실행 환경 비용`이다. 모델 API는 상용 서비스이며 각 공급자의 키·계정·약관에 종속된다. AI SDK는 공급자 교체를 돕지만 SDK와 공급자별 어댑터 의존성이 추가된다. PoC에서 직접 API 한 개와 AI SDK 사용을 개발량 기준으로 비교한다.
AI SDK 자체의 라이선스는 [Apache-2.0](https://github.com/vercel/ai/blob/main/LICENSE)이다. 모델 호출 요금과 SDK 라이선스는 서로 다른 항목이다.

### 3.2 구조화 UI 스키마·AST

- [json-render](https://github.com/vercel-labs/json-render)는 정의한 컴포넌트·액션 카탈로그로 모델 출력을 제한하고, JSON spec 및 patch 스트리밍을 렌더링한다. React, Vue, Svelte 등 렌더러가 있으며 Apache-2.0이다. BaroCSS가 필수인 PoC라면 기본 `@json-render/shadcn`의 Tailwind 구성에 의존하지 말고 자체 카탈로그를 만든다.
- [AI SDK `Output.object`](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)는 스키마 검증 결과를 제공한다. 문서는 스트리밍 도중의 **부분 객체는 아직 스키마 검증을 통과하지 못할 수 있다**고 명시한다. 따라서 patch나 노드 하나를 완성·검증한 뒤에만 화면에 반영한다.
- 자체 UI 스키마는 kit의 **CSS AST와 다른 형식**이다. UI JSON을 kit AST로 직접 넘기는 결합은 피한다. UI 노드의 클래스 문자열만 공개 CSS API에 넘긴다.

### 3.3 Figma·디자인 → 코드

- [Figma MCP](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server)는 컴포넌트, 변수, 레이아웃 등 디자인 맥락을 에이전트에 제공한다. [Code Connect](https://developers.figma.com/docs/code-connect/)는 Figma 컴포넌트와 저장소 컴포넌트를 매핑한다. 이는 디자인 입력 경로이며 런타임 CSS 생성기 자체는 아니다.
- [MCP 접근·호출 제한](https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/)은 좌석과 플랜에 따른다. Code Connect UI의 [지원 플랜](https://developers.figma.com/docs/code-connect/code-connect-ui-setup/)도 별도다. PoC의 필수 경로로 넣으면 Figma 계정·디자인 파일·권한에 종속된다. 2주 PoC에서는 보조 입력 한 건만 선택적으로 비교한다.
- [Figma 가격](https://www.figma.com/pricing/)은 좌석·플랜별로 달라진다. MCP의 읽기 호출 제한과 Code Connect 권한을 별도로 확인한다. Figma 자료의 재사용 권한은 해당 파일 권한에 따른다.

### 3.4 에이전트의 미리보기·수정 루프

- [Playwright 시각 비교](https://playwright.dev/docs/test-snapshots)는 렌더 결과의 회귀 검증에 적합하다. [agent-browser](https://github.com/vercel-labs/agent-browser)는 브라우저 조작·스냅샷을 위한 Apache-2.0 CLI다. 둘 다 UI 생성 모델을 대신하지 않는다.
- 실험 루프: `생성 → 스키마 검증 → 렌더 → BaroCSS 적용 → 스크린샷/DOM/오류 기록 → 모델에 실패 요약 전달 → 최대 1회 수정`. 수정 효과와 추가 토큰 비용을 따로 기록한다. DOM이나 페이지 텍스트는 모델에 전달할 때 신뢰하지 않는 자료로 취급한다.

### 3.5 실시간 스타일과 실행 경계

- [UnoCSS 런타임](https://unocss.dev/integrations/runtime)은 DOM 변경을 보고 브라우저에서 CSS를 만든다. 비교 대상으로 유용하지만 기본 Wind3 preset이므로 Tailwind v4와 동일하다고 가정하지 않는다. Tailwind [Play CDN](https://v3.tailwindcss.com/docs/installation/play-cdn)은 공식 문서상 개발용이다.
- 클래스도 안전한 입력이라고 가정하면 안 된다. CSS의 [`url()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/url_function)은 외부 자원을 읽을 수 있다. PoC에서는 임의 값(`[ ... ]`), URL, 미등록 variant, 사용자 제공 CSS/HTML/JS를 거부한다. 이후 필요가 확인되면 값별 검증과 네트워크 정책을 추가한다.
- 제한된 JSON은 등록된 요소·속성·행동 ID로만 렌더한다. 텍스트는 텍스트 노드로 출력한다. `innerHTML`, `eval`, 임의 import, 모델이 쓴 이벤트 핸들러는 사용하지 않는다. 링크와 이미지 URL은 허용 출처를 검사한다. 실행 코드가 꼭 필요해지면 별도 출처의 sandbox iframe 또는 원격 격리 환경을 검토한다. 같은 출처 iframe에 `allow-scripts`와 `allow-same-origin`을 함께 주는 방식은 [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)이 경고한다. [E2B](https://e2b.dev/pricing)는 격리 실행을 제공하지만 초 단위 실행 비용과 플랜 비용이 든다.

## 4. PoC 인터페이스

이 형식은 **제안**이며 0.0.4 공개 API 변경 요구가 아니다.

```ts
type UiNode = {
  id: string;
  component: 'Stack' | 'Text' | 'Button' | 'Card' | 'Image';
  props: Record<string, string | boolean>; // 컴포넌트별 허용 키만 통과
  classes: string[]; // 검증한 BaroCSS 클래스만 통과
  children: UiNode[];
};
type Request = { prompt: string; themeId: string; viewport: 'mobile' | 'desktop' };
type Result = {
  tree: UiNode;
  renderedPreview: string; // 미리보기 식별자 또는 URL
  css: string;
  errors: Array<{ nodeId: string; code: string; detail: string }>;
  timingsMs: { firstValidNode: number; firstStyleReady: number; complete: number };
  usage: { inputTokens: number; outputTokens: number; estimatedUsd: number };
};
```

모델 출력은 서버에서 스키마와 최대 크기·깊이·노드 수를 검사한다. 각 클래스는 정책 검사 뒤 kit 생성 결과가 비어 있지 않은지 확인한다. 미지원 클래스는 `UNSUPPORTED_CLASS` 오류로 돌려주고 해당 클래스만 제외한다. 렌더러는 등록된 컴포넌트만 쓴다. 브라우저 어댑터는 Pulse의 최종 공개 API가 정해진 뒤 연결한다. 생성 CSS는 kit의 결과와 브라우저에 적용된 규칙을 각각 기록해 차이를 찾는다. 모델 API 키는 서버에 둔다.

## 5. 피할 결합과 의존성

1. **모델 출력 ↔ DOM 직접 삽입:** 자유 HTML/JS를 렌더러에 넣지 않는다. URL과 클래스도 입력 검증을 거친다.
2. **특정 모델·SDK ↔ BaroCSS 코어:** 모델 호출은 별도 어댑터에 둔다. `kit`에는 모델 패키지를 추가하지 않는다.
3. **UI JSON ↔ kit 내부 AST:** 공개 클래스/CSS API로 연결한다. CSS AST 내부 형태에 UI 생성기가 종속되지 않는다.
4. **Figma·v0·WebContainer ↔ 기본 런타임:** 이들은 선택 입력 또는 개발 도구다. 계정, 요금, 라이선스가 기본 CSS 동작을 막아서는 안 된다.
5. **Tailwind 호환 주장 ↔ 생성 성공:** 스키마 유효성과 시각적·CSS 의미 일치는 별도로 측정한다. Mirror가 고정한 Tailwind 버전과 fixture를 사용한다.

## 6. 2주 실험 계획과 판정

| 기간 | 작업 | 확인할 증거 |
| --- | --- | --- |
| 1~2일 | UI 스키마, 5개 컴포넌트, 허용 클래스 부분집합, 20개 프롬프트·기준 화면을 고정 | 입력·기대 동작·버전이 기록된 fixture |
| 3~5일 | 모델 A 한 개의 구조화 출력, 안전 렌더러, BaroCSS 어댑터, 오류 목록 | 프롬프트→스타일 적용 화면 재현 |
| 6~7일 | 20개 입력을 3회씩 실행. 생성 CSS와 Tailwind 기준 비교. 미지원 클래스 분류 | 원시 결과, 성공/실패 이유, 버전, 비용 |
| 8~10일 | 수정 루프 1회와 Playwright 화면·상호작용 검사 | 수정 전후 품질·지연·비용 |
| 11~12일 | `json-render` 자체 카탈로그를 같은 입력 5개에 연결해 개발량·스트림 안정성 비교 | 구현 시간, 오류·중단 처리 비교 |
| 13~14일 | 결과 검토. Figma 입력은 권한이 있으면 1개 화면만 추가 | A/B 선택 또는 보류 근거 |

**사전 성공 기준(목표, 실측 아님):** 20개 fixture × 3회에서 스키마 검증 통과율 ≥95%; 미지원·거부 클래스 100%가 오류 목록에 표시; 금지된 HTML/JS/URL 입력 10개가 모두 차단; 첫 스타일 준비 시각(`firstStyleReady`)의 p95 ≤3초(테스트 환경·모델·네트워크를 함께 기록); 기준 화면의 주요 구조·텍스트·반응형 검사는 ≥80% 통과; 모델 호출당 토큰과 USD 추정 비용 기록 누락 0건. 지연 목표를 넘거나 품질 목표를 못 채우면 실패 원인을 모델 생성, CSS 호환, 렌더러, 네트워크로 나눠 본다. 수치 목표는 제품 가설이며 현재 성능이 아니다.

**측정 정의 정정:** `firstStyleReady`는 렌더된 노드의 예상 `getComputedStyle()` 값과 가시성이 브라우저에서 처음 확인된 시각이다. 이는 스타일이 적용된 상태를 뜻하며 실제 화면에 픽셀이 표시된 시각을 뜻하지 않는다. [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)은 다시 그리기 전에 실행된다. [`PerformancePaintTiming`](https://developer.mozilla.org/en-US/docs/Web/API/PerformancePaintTiming)의 FP/FCP는 초기 페이지 paint 지표이므로 동적으로 추가한 노드의 첫 styled paint를 직접 측정하는 지표로 쓰지 않는다. 화면 확인은 별도 [Playwright CSS 검사](https://playwright.dev/docs/actionability)와 [스크린샷](https://playwright.dev/docs/api/class-page)으로 기록한다. 백그라운드 탭에서는 rAF가 중단될 수 있으므로 측정 탭을 전경으로 고정한다. 이는 앞선 문서와 Discussion #69 댓글에서 쓴 “첫 스타일 프레임”보다 좁고 재현 가능한 측정 정의다.

## 7. 기존 작업과 결정 대기

- **Mirror:** Tailwind 기준 버전·fixture·미지원 클래스를 받아 허용 클래스 집합을 정한다.
- **Mirror 초기 답변:** 4.1.13 기준으로 구조가 일치한 표본 8개는 `block`, `hidden`, `overflow-hidden`, `text-center`, `bg-red-500`, `bg-[#ff0000]`, `grid-cols-2`, `field-sizing-content`다. 이 목록만으로 완전한 UI를 만들 수 없으므로 PoC 시작 전 필요한 클래스를 더 측정한다. `bg-[#ff0000]` 같은 임의 값은 구조 일치와 별개로 PoC의 보안 정책에 따라 거부한다.
- **Core:** 클래스 유효성·미지원 신호와 컨텍스트 격리 보장을 확인한다.
- **Pulse:** browser/server의 최종 공개 호출 방식, CSS 추출·오류 관측, 설정 변경·종료 동작을 확인한다.
- **Ship:** 배포 export 경로와 패키지 설치 예제를 확인한다.
- **Ship 답변:** pack 기준 ESM 경로는 `@barocss/browser`, `@barocss/server`, `@barocss/kit`이다. `browser`와 `server`는 `kit`을 설치 의존성으로 둔다. CDN 후보는 `@barocss/browser@latest/dist/cdn/barocss.js`다. 실제 PoC는 `latest` 대신 고정 버전을 사용한다.
- **PM:** 이 PoC를 0.0.4 릴리스 후보와 별도 트랙으로 둔다. 사용자 수요 검증이나 임의 코드 생성 범위는 PM 판단 후 확장한다.

위 네 작업의 답변을 받기 전에는 제안 인터페이스를 확정된 구현 계약으로 취급하지 않는다.

GitHub 기록: [AI UI Discussion #69](https://github.com/barocss/barocss/discussions/69)와 [PoC 측정 계약 보충 댓글](https://github.com/barocss/barocss/discussions/69#discussioncomment-18560506). 별도 PoC 실행 Issue는 PM의 범위 결정 뒤 중복을 확인하고 만든다.
