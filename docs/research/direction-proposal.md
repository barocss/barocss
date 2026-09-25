# BaroCSS 방향 제안서

작성: 2026-09-25 · 기준: `develop` @ `573c3c2` · 성격: **결정이 아니라 결정을 위한 자료**. `.ai/` 파일, PR, push는 건드리지 않았다.

출처 표기: `[K-n]`은 `.ai/STATE.yaml`의 knowledge, `[n]`은 6절의 URL 목록.
저장소 코드에 대한 주장도 고정 커밋 URL로 인용한다.

---

## 0. 요약

- 오늘의 생성형 UI 프로토콜(json-render, A2UI)은 **AI에게 구조만** 맡기고 디자인은 카탈로그 컴포넌트와 렌더러에 고정한다 [1][2][3][4].
- AI UI 플랫폼(v0, Lovable, bolt)은 코드로 **구조와 디자인을 함께** 생성하지만, 빌드 단계가 있는 고정 스택(React·Vite/Next·Tailwind·shadcn)을 전제한다 [6][7][8].
- 그래서 "구조와 디자인을 **실행 중에**, 한 번에, 가드레일 안에서 생성"하는 자리는 둘 다 비워 두고 있다.
- 빌드 방식은 실행 중에 도착하는 class를 원리상 볼 수 없다 [5]. 공식 브라우저 런타임은 개발용이다 [9]. AI가 자연스럽게 쓴 스타일은 조용히 실패하고, 에이전트는 이를 대부분 놓친다 [K10].
- 방향안 세 개를 제시한다. **A 디자인 채널**(생성 명세의 디자인을 런타임 렌더링), **B 디자인 가드레일**(생성된 디자인의 해석 결과를 검증 신호로 반환), **C 생성되는 디자인 시스템**(구조와 테마 토큰을 함께 생성해 런타임 적용).
- 가장 싼 첫 실험은 B다. BaroCSS가 이미 가진 조회 기능(`has`/`getCss`) [10]만으로, 새 코드 없이 측정할 수 있다.

---

## 1. 입력과 범위

**Vision (요지).** BaroCSS는 궁극적으로 Tailwind 대체제가 아니라, AI가 UI를 생성·이해·수정·검증하는 시대의 UI 인프라다. BaroCSS만 아는 것만, 증거가 있을 때만 맡는다 [14].

**현재 지식에서 방향에 관련된 것.**
- 수정+검증은 BaroCSS 전용 기능 없이 됐다 [K3][K5][K7][K9]. O1은 완료됐다.
- 새 UI 생성에서는 첫 시도 스타일 실패가 조용히 나오고 에이전트가 대부분 놓쳤다 [K10]. 수정 과제에서는 같은 에이전트가 모두 잡았다 [K5].
- 실패 계열을 하나씩 고치면 정확히 맞출 수 있다 [K11]. (최신 사람 지시는 이런 호환성 수정을 별도 "parity lane"으로 분리했다 [13]. 이 제안서는 그 lane을 전제로 두고 "question lane"의 방향만 다룬다.)
- 테마는 JS 설정으로 실행 중 변경할 수 있지만, 경로가 제한적이다: 색은 되고 borderRadius는 안 된다 [K6]. 설정이 통째로 교체되는 의미론이고, 프로덕션 빌드에는 경로가 없다 [K8].

**의도 기준 (사람이 정함).**
1. AI가 디자인과 구조를 한 번에, 자연스럽게 생성한다 (json-render처럼).
2. BaroCSS는 Tailwind 대체제가 아니다.
3. 빌드 단계 없이 동작한다.
4. 대상은 AI UI 생성 플랫폼으로 UI를 만드는 개발자다.
5. BaroCSS는 BaroCSS만 알거나 할 수 있는 것만 맡는다.

---

## 2. 조사 결과

### 2.1 생성형 UI 프로토콜: 구조는 AI, 디자인은 고정

| | 구조 | 디자인 | 스트리밍 |
|---|---|---|---|
| **json-render** (Vercel Labs) | AI가 카탈로그(Zod 스키마) 안에서 평면 JSON 명세 생성: `type`, `props`, `children` [1] | 명세에서 AI가 스타일(className·style·토큰)을 정하는 방법이 문서에 없음. 디자인은 등록된 컴포넌트 구현(shadcn 36종)에 고정 [1][2] | 조각 단위 점진 렌더링 [1] |
| **A2UI** (Google) | 에이전트가 추상 컴포넌트 트리 + 데이터를 JSONL로 스트리밍 [3] | "에이전트는 무엇을, 렌더러는 어떻게 보일지". 에이전트는 시각 스타일 대신 `usageHint`(h1, body 등) 같은 의미 힌트만 준다. 선택적 `theme` 필드는 있지만 기본 카탈로그는 쓰지 않는다 [4] | 스트리밍 우선 [3] |

공통점: 가드레일(허용된 컴포넌트만)과 예측 가능성을 위해 **디자인 결정을 AI에게서 빼앗는다** [1][3][4]. 의도 기준 1의 "디자인과 구조를 한 번에"는 이 설계가 의도적으로 포기한 부분이다.

### 2.2 AI UI 플랫폼: 구조+디자인을 코드로, 대신 빌드와 고정 스택

- **v0**: React 코드를 생성하고, shadcn/ui와 Tailwind로 스타일을 입힌다. 디자인 시스템은 CSS 변수(globals.css 토큰)와 Registry(컴포넌트·블록·토큰 맥락 제공)로 연결한다 [6].
- **Lovable**: React·TypeScript·Vite·Tailwind·shadcn/ui 스택이 고정이다. 스타일은 Tailwind 유틸리티 class로만 쓰고, 별도 CSS 파일이나 CSS-in-JS는 쓰지 않는다 [7].
- **bolt.new**: 브라우저 안 WebContainer에서 npm install과 Vite를 돌려 미리보기를 만든다. 생성물은 React + Vite + Tailwind 코드다 [8].

공통점: 디자인은 **class 문자열로 구조와 함께** 생성된다(의도 기준 1과 형태는 같음). 하지만 표시하려면 빌드 도구(Vite/Next)가 돌아야 하고 [7][8], 생성된 디자인이 의도대로 적용됐는지 검증하는 장치는 문서에 없다 [6][7][8].

### 2.3 생성된 스타일이 실패하는 곳

1. **빌드 방식은 실행 중에 도착하는 class를 못 본다.** Tailwind는 소스 파일을 평문으로 스캔해 "완전한 class 이름"만 생성한다. 동적으로 만든 이름은 생성되지 않으며, 해법은 완전한 이름을 쓰거나 `@source inline()`으로 미리 목록화하는 것이다 [5]. json-render나 A2UI처럼 명세가 실행 중에 도착하면, 빌드 시점에는 그 class가 소스에 없다.
2. **빌드 없는 공식 경로는 개발 전용이다.** "The Play CDN is designed for development purposes only, and is not intended for production." [9]
3. **생성할 때 스타일이 조용히 실패하고, 에이전트는 이를 놓친다.** 자연스러운 생성 3섹션에서 첫 시도 무음 실패가 8건이었고, 에이전트가 스스로 잡은 건 1건이었다. 나머지 7건은 "완료" 보고 아래 출하됐다 [K10]. 규칙이 비었거나, 정의되지 않은 변수를 참조하거나, 규칙이 아예 없는 class들이다 [K4].
4. **대조: 수정 과제에서는 에이전트가 스스로 잡았다.** 같은 에이전트가 기존 요소를 고칠 때는 17건의 무효 class를 모두 computed style로 잡았다 [K5]. 실패를 알아채는 능력은 "무엇을 확인할지 알 때" 작동한다. 생성에서는 확인할 대상이 너무 많다 [K10].
5. **실행 중 테마 경로의 한계.** 설정으로 색 토큰을 추가하면 새 class가 생긴다 [K6][K7][K9]. 반면 radius 같은 네임스페이스는 class 생성으로 이어지지 않는다 [K6]. 설정은 통째로 교체되고, 프로덕션 번들에는 경로가 없다 [K8].

### 2.4 BaroCSS가 이미 가진 것 (새로 만들기 전에 확인)

- **브라우저 런타임** [10]:
  - `observe()`: MutationObserver로 DOM 변화를 감시한다. 실행 중에 추가되는 class를 처리한다.
  - `addClass()`
  - `has(cls)` / `getCss(cls)`: class별 해석 결과를 조회한다.
  - `getAllCss()`: 현재 생성된 전체 CSS를 꺼낸다.
  - `updateConfig()`: 테마를 교체한다.
- **서버 런타임** [11]: `parseClass()`, `generateCss()`, `generateCssForClasses()`로 class 목록을 서버에서 CSS로 바꾼다.
- **`jsonToAst` / `generateCssFromJson`** [12]: 구조화된 JSON 스타일 입력(`utility.name/value/arbitrary…`)을 CSS로 바꾼다. 주석에 "AI 모델이 생성하기 쉽게 설계"라고 되어 있다. 이를 쓰는 시나리오의 증거는 없다. 같은 처지였던 `astToJson`의 전례가 있다 [K2].

### 2.5 종합: 비어 있는 자리

| | 구조를 AI가 | 디자인을 AI가 | 빌드 없이 | 디자인 가드레일 |
|---|---|---|---|---|
| json-render / A2UI [1][3][4] | 예 | 아니오(고정/힌트) | 예(런타임 렌더러) | 해당 없음(디자인 고정) |
| v0 / Lovable / bolt [6][7][8] | 예(코드) | 예(class) | 아니오(Vite/Next) | 문서상 없음 |
| 공식 브라우저 런타임 [9] | - | class 해석 | 예, 단 개발 전용 | 없음 |

의도 기준 1+3을 동시에 만족하는 조합은 표에 없다. 기준 5 관점에서 BaroCSS가 줄 수 있는 후보는 "실행 중 class → 규칙 해석"과 "테마 의미론"이다. 둘 다 BaroCSS 엔진 안에 있는 지식이다 [10][11][K6].

**방향이 아닌 것 (기준 5로 제외).**
- BaroCSS 자체 UI 명세·카탈로그 포맷: json-render와 A2UI가 이미 맡고 있다 [1][3].
- 브라우저가 이미 주는 최종 스타일 확인(computed style): 에이전트가 이미 쓴다 [K5].

---

## 3. 방향안

평가 표기: ● 강하게 충족 · ◐ 부분 · ○ 약함/위험. 근거 없는 평가는 넣지 않았다.

### 방향안 A: 디자인 채널

**한 줄.** 생성형 UI 명세가 구조(컴포넌트)와 함께 디자인(유틸리티 class 또는 토큰)을 싣고, BaroCSS가 그 디자인을 빌드 없이 실행 중에 렌더링한다. json-render/A2UI 같은 카탈로그 렌더러의 "디자인 입력 통로"가 된다.

| 기준 | 평가 | 근거 |
|---|---|---|
| 1 디자인+구조 한 번에 | ● | 구조는 카탈로그, 디자인은 같은 명세의 class/토큰. 지금 프로토콜이 고정한 부분을 연다 [1][4] |
| 2 대체제 아님 | ◐ | 역할은 "GenUI의 디자인 통로"지만, 겉으로는 "실행 중 Tailwind"로 보이기 쉽다. Tailwind 문법은 입구일 뿐이라는 선을 지켜야 한다 |
| 3 빌드 없음 | ● | 실행 중 도착하는 class는 빌드 스캔이 못 본다 [5]. BaroCSS 런타임은 DOM 변화를 감시해 처리한다 [10] |
| 4 대상 개발자 | ◐ | 카탈로그형 GenUI를 쓰는 개발자에겐 직접 맞다. 코드 생성형 플랫폼(v0 등)은 이미 빌드가 있어 필요가 덜하다 [6][7][8] |
| 5 BaroCSS만의 것 | ◐ | 실행 중 class→CSS 해석은 BaroCSS의 일이다 [10]. 하지만 공식 브라우저 런타임도 개발용으로 같은 일을 한다 [9]. 고유성은 프로덕션 품질이나 B·C와의 결합에서 나온다 |

**기존 증거.** 지지: [K10] 생성 스타일 정확성이 실제 문제다. [K11] 계열별 정확도는 맞출 수 있다. 약화: [K4][K10] 현재 해석 갭이 있으면, 이 통로로 들어온 디자인이 조용히 깨진다. parity lane이 선행 조건이다.

**만들기 전 첫 실험.** json-render 카탈로그 컴포넌트에 `className` prop을 허용하고 LLM이 구조와 className을 한 번에 담은 명세를 생성할 때, 그 class 중 몇 %가 BaroCSS 런타임에서 의도대로 적용되는가? 같은 명세를 모르는 빌드 Tailwind에서는 몇 %가 누락되고, 공식 브라우저 런타임과는 어떻게 다른가? 기존 코드만으로 측정한다(json-render 예제 + BaroCSS 스크립트 태그).

### 방향안 B: 디자인 가드레일

**한 줄.** json-render가 구조를 스키마로 보증하듯, BaroCSS가 생성된 디자인의 해석 결과를 돌려준다. 어떤 class가 무엇으로 해석됐는지, 해석되지 않았는지, 테마 밖인지를 알려서, AI나 플랫폼이 첫 시도에서 스스로 고치게 한다.

| 기준 | 평가 | 근거 |
|---|---|---|
| 1 디자인+구조 한 번에 | ◐ | 생성 자체가 아니라 "한 번에 생성한 디자인이 첫 시도에 맞게" 만드는 쪽이다. 생성의 품질 조건 |
| 2 대체제 아님 | ● | Tailwind 흉내가 아니라 BaroCSS 엔진이 아는 해석 정보를 내보내는 일이다 |
| 3 빌드 없음 | ● | 실행 중 조회(`has`/`getCss`)로 동작한다 [10] |
| 4 대상 개발자 | ● | 플랫폼 결과물의 무음 실패가 사용자에게 곧 "깨진 UI"다. 생성에서 7/8이 놓쳐졌다 [K10] |
| 5 BaroCSS만의 것 | ◐ | "이 class가 어떤 규칙이 되는가, 테마 안인가"는 엔진 지식이다 [10][K6]. 다만 최종 스타일은 브라우저 computed style로도 확인되고, 에이전트는 수정 과제에서 이미 그렇게 했다 [K5]. 작업 가설 "시각 검증은 브라우저/에이전트 몫"과 충돌한다 |

**기존 증거.** 지지: [K10] 생성에서 7/8을 놓쳤다. [K4] 실패가 조용하다. 반박/약화: [K5] 확인 대상을 알면 에이전트가 스스로 잡는다. [K3] 수정 과제는 BaroCSS 도움이 필요 없었다.

**만들기 전 첫 실험.** E-007과 같은 생성 과제·배우·프롬프트를 쓰되, 생성 직후 에이전트에게 페이지의 모든 class에 대한 BaroCSS 해석 결과를 보여준다. 해석 안 됨, 빈 규칙, 정의되지 않은 변수 참조를 표시한다. 새 코드 없이 기존 `has()`/`getCss()` [10]로 만든 스크립트다. 이때 첫 시도 무음 실패 수가 E-007의 8건 중 7건 [K10]보다 줄어드는가? 브라우저 computed style만 요약해 보여준 대조군과 비교해, 기준 5(BaroCSS만의 정보인가)를 가른다.

### 방향안 C: 생성되는 디자인 시스템

**한 줄.** AI가 구조와 함께 그 UI의 디자인 시스템(색·radius·간격·글꼴 토큰)까지 한 번에 생성하고, BaroCSS가 실행 중에 적용해 토큰이 곧 사용 가능한 class가 되게 한다.

| 기준 | 평가 | 근거 |
|---|---|---|
| 1 디자인+구조 한 번에 | ● | 개별 스타일을 넘어 디자인 언어 자체를 구조와 함께 생성한다. v0도 디자인 시스템을 CSS 토큰/Registry로 다룬다 [6] |
| 2 대체제 아님 | ● | 초점이 "생성된 테마 → 실행 중 class 의미론"이다 |
| 3 빌드 없음 | ◐ | 실행 중 `updateConfig`로 색 토큰은 된다 [K6][K9]. 설정이 교체되는 의미론이고, 프로덕션 번들에는 경로가 없다 [K8] |
| 4 대상 개발자 | ◐ | 브랜드와 디자인 시스템은 플랫폼 개발자의 실제 요구다 [6]. 하지만 shadcn 테마는 CSS 변수만으로도 바뀐다 [6] |
| 5 BaroCSS만의 것 | ◐ | "토큰이 어떤 class를 생성하는가"는 BaroCSS 테마 의미론이다 [K6]. CSS 변수만 바꾸는 테마는 브라우저로 충분하다 [6]. 고유성은 새 토큰 이름이 새 class가 되는 경우(예: `bg-brand`)에 한정된다 [K6][K7] |

**기존 증거.** 지지: [K7][K9] 에이전트가 실행 중 테마 토큰을 추가하고 사용하는 데 성공했다(3/3). 제약: [K6] radius 등은 경로가 없고, `{DEFAULT}` 색 객체는 예외를 낸다. [K8] 설정 교체와 프로덕션 경로 부재. 미해결 U6은 어떤 테마 네임스페이스가 class 생성을 이끄는가다.

**만들기 전 첫 실험.** 에이전트가 한 번의 생성에서 UI와 테마 토큰 세트(색·radius·spacing·font)를 함께 만들고 기존 `updateConfig`로 적용할 때, 토큰 중 의도대로 class로 쓰이는 비율을 잰다. 같은 결과를 CSS 변수만으로, BaroCSS 테마 없이 얻을 수 있는 비율도 잰다. 두 비율의 차이가 기준 5의 답이다.

---

## 4. 비교 요약

| | A 디자인 채널 | B 디자인 가드레일 | C 생성되는 디자인 시스템 |
|---|---|---|---|
| 1 | ● | ◐ | ● |
| 2 | ◐ | ● | ● |
| 3 | ● | ● | ◐ |
| 4 | ◐ | ● | ◐ |
| 5 | ◐ | ◐ | ◐ |
| 첫 실험 비용 | 중(json-render 예제 구성) | **낮음(기존 조회 API + E-007 재사용)** | 중 |
| 새 코드 필요(측정 단계) | 없음 | 없음 | 없음 |

세 안은 배타적이지 않다. A는 통로, B는 그 통로의 품질, C는 그 통로에 실리는 디자인 언어다. 기준 5가 모두 ◐인 것이 핵심 불확실성이다. **"BaroCSS만의 것"은 아직 어느 안에서도 증명되지 않았다.**

## 5. 편향 점검

이 세션은 한때 BaroCSS를 공식 브라우저 런타임의 대체제로 틀지었다가 철회했다 [15]. 각 안이 그 틀로 미끄러질 수 있는 지점을 적는다.
- **A:** "빌드 없는 Tailwind"로 축소되기 쉽다. 가치의 근거를 공식 런타임과의 속도·크기 경쟁이 아니라 "GenUI 명세의 디자인 통로"에 둬야 한다.
- **B, C:** 첫 실험의 대조군이 Tailwind가 아니라 "브라우저·에이전트만으로"다. 기준 5를 직접 겨냥한다.
- **parity lane:** Tailwind 4.1.13을 기준으로 삼는 것은 AI가 이미 아는 문법을 정확히 알아듣기 위한 기본 조건이지, 제품 경계가 아니다 [13][14].

## 6. 출처

1. json-render README (vercel-labs/json-render): https://github.com/vercel-labs/json-render
2. json-render 공식 사이트: https://json-render.dev/
3. A2UI 소개: https://a2ui.org/introduction/what-is-a2ui/
4. A2UI Theming & Styling: https://a2ui.org/guides/theming/
5. Tailwind CSS: Detecting classes in source files: https://tailwindcss.com/docs/detecting-classes-in-source-files
6. v0와 디자인 시스템 (Vercel Academy, v0 Docs): https://vercel.com/academy/ai-sdk/ui-with-v0 , https://v0.app/docs/design-systems-legacy , https://www.mindstudio.ai/blog/what-is-vercel-v0
7. Lovable 기술 스택: https://www.lowcode.agency/blog/lovable-tech-stack , https://vibe-eval.com/guides/lovable-tech-stack/
8. bolt.new와 WebContainers: https://github.com/stackblitz/bolt.new , https://posthog.com/newsletter/inside-bolt-dot-new
9. Tailwind CSS Play CDN: https://tailwindcss.com/docs/installation/play-cdn
10. BaroCSS BrowserRuntime (`observe`, `addClass`, `has`, `getCss`, `getAllCss`, `updateConfig`): https://github.com/barocss/barocss/blob/573c3c2/packages/barocss-browser/src/browser-runtime.ts
11. BaroCSS ServerRuntime (`parseClass`, `generateCss`, `generateCssForClasses`): https://github.com/barocss/barocss/blob/573c3c2/packages/barocss-server/src/index.ts
12. BaroCSS `jsonToAst` / `generateCssFromJson`: https://github.com/barocss/barocss/blob/573c3c2/packages/barocss/src/core/jsonToAst.ts
13. `STATE.human_directives` (parity lane / question lane): https://github.com/barocss/barocss/blob/573c3c2/.ai/STATE.yaml
14. `VISION.md`: https://github.com/barocss/barocss/blob/573c3c2/.ai/VISION.md
15. 방향 틀 철회 PR: https://github.com/barocss/barocss/pull/130 → https://github.com/barocss/barocss/pull/132 , https://github.com/barocss/barocss/pull/134

---

## 7. 사람이 결정해야 할 질문

1. **어떤 생성 방식을 대상 흐름으로 볼 것인가?** 카탈로그형 명세(json-render/A2UI처럼 JSON이 실행 중 도착)인가, 코드 생성형(v0/Lovable처럼 React 코드)인가? A는 전자에서만 강하다.
2. **"디자인을 생성한다"의 형태는?** 유틸리티 class 문자열, 구조화 JSON(`jsonToAst` [12]), 테마 토큰 세트 중 무엇인가, 혹은 조합인가?
3. **가드레일의 범위는?** 해석 결과를 알려주기(B)까지인가, 테마 밖 값을 막거나 고치기까지인가?
4. **프로덕션에서의 모습은?** 런타임을 그대로 쓰는가, 실행 중 만들어진 CSS를 정적 파일로 꺼내 쓰는가(`getAllCss` [10], 서버 런타임 [11])?
5. **첫 실험 순서.** B(가장 싸고, 기준 5를 직접 검증)부터 할 것인가? B가 "BaroCSS만의 정보가 아니다"로 끝나면, A와 C의 기준 5 평가도 함께 낮춰야 하는가?
6. **parity lane과의 관계.** 방향이 정해질 때까지 호환성 수정(parity lane)을 계속할 것인가, 선택한 방향이 쓰는 class 계열로 좁힐 것인가?
7. **O3(스타일 출처 설명)의 위치.** B와 겹친다. O3를 B로 흡수할 것인가, 따로 둘 것인가?
