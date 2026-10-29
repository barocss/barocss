---
work_id: gpu-material-authoring-20261029
artifact_type: architecture-proposal
status: draft
owner_role: architect
source_request: "GPU material/shader를 CSS형 언어와 TSL 같은 코드로 직접 작성하는 방법 검토"
last_updated: 2026-10-29
---

# GPU 재질 작성 경로 제안

**권고:** 기존 CSS형 `@shader`를 유지한다. 코드 작성은 같은 문법을 생성하는 작은 typed helper로 추가한다. 두 입력은 기존 `materialShader` compiler, 검증, WGSL lowering을 공유한다. 지금 새 언어, 새 패키지, 일반 graph IR 또는 renderer 교체를 시작할 근거는 없다.

이 문서는 설계 초안이다. 제품은 수정하지 않았다. 기준은 `d85558ce0031d812341d5871743f8535520eb8d4`이다. 제품 경로는 `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`이다. 넓은 소스 조사는 같은 폴더의 [source-review.md](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/research/gpu-material-authoring-20261029/source-review.md)와 source-evidence.json을 재사용했다. 아래 제품 줄 번호는 이 commit에 속한다. 이후 Viewer clipping WIP는 포함하지 않는다. build/test/browser/GPU 실행은 **NOT_RUN**이다.

## 현재 기능과 요청의 차이

**Source evidence:** 세 경로가 이미 있다. `Material` 객체로 PBR/finish/maps를 설정한다. CSS형 `@shader`로 제한된 base color 식을 작성한다. raw WGSL 선언과 식을 `Material.shader`에 연결할 수 있다. mesh setter는 기존 재질과 patch를 병합한다. 공용 진입점부터 실제 raster draw까지 연결되어 있다 (`packages/barocss-gpu/src/index.ts:269`, `src/material/material-viewer.ts:23-44`, `src/viewer/scene.ts:334-358`, `src/viewer/viewer.ts:877-931`).

CSS scene selector와 material DSL은 같은 기능이 아니다. scene stylesheet는 shape/placement/color를 다루며, `showScene`은 roughness 0.5를 사용한다. PBR maps/finish/custom shader를 모두 선언하는 통합 stylesheet는 아니다. class/inheritance/pseudo selector를 지원한다고 설명하면 안 된다 (`README.md:294-324`, `src/scene/scene-viewer.ts:82-124`).

**좁은 후속 확인 — Studio에는 이미 두 source editor가 있다.** `apps/cad-studio/src/ui/RenderPanel.tsx:376-423`의 `SourceTab`에서 `PROPS · CSS SCENE`은 재질 CSS 속성 편집기가 아니라 보조 scene source다. `applyScene`은 `compileGpu({kind:'scene',source,...sourceVersion})`으로 검증하고 성공한 문자열을 `render.scene`에 저장한다 (`:382-387`). 직접 compiler는 `packages/barocss-gpu/src/mesh/gpu-compiler.ts:35-44`에서 `parseSceneAst`→`analyzeSceneAst`를 호출한다. `src/scene/scene-front.ts:55-57`의 허용 style 필드는 `color/translate/radius/size`와 version1의 rotation/height/start/end/major-radius/minor-radius다. roughness/metallic/finish/maps/shader 필드는 이 props parser에 없다. 이 경로에서 `Unsupported style property`로 거부한다.

반면 같은 SourceTab의 `MATERIALS · @SHADER`는 이미 `materialShader(drafts[name])`로 검증하고 성공한 source를 `render.materials[name]`에 저장한다 (`RenderPanel.tsx:388-393,415-423`). Appearance 탭에는 metallic/roughness/opacity, image texture/repeat/cutout, finish/clearcoat/film 및 저장한 shader 이름 선택이 이미 있다 (`:206-245`). 이들은 `setLook`의 appearance 변경이며 props CSS parser가 처리하는 선언이 아니다. 따라서 **Studio에 CSS형 source 작성 UI나 재질 작성 수단이 없다는 주장은 하지 않는다.** 공백은 현재 scene selector가 PBR/finish/map/shader binding을 하나의 stylesheet로 선언하지 않는 점과, 각 엔진·UI 입력 경로의 의미가 분리된 점이다. GPU의 normal/roughness/metallic map 지원 전체를 이 Studio 이미지 texture control이 노출한다고도 확대하지 않는다.

**Design inference:** 필요한 첫 개선은 새 shader compiler보다 경로의 연결이다. 사용자가 색/금속/texture 설정, 절차적 색 표현, 더 낮은 수준의 WGSL 중 어느 수단이 맞는지 알 수 있어야 한다. CSS의 전체 cascade를 GPU에 이식하는 작업은 이번 요청의 최소 범위를 넘는다.

## 기존 API 예시 — 현재 공개 문법

아래는 문서의 wave source이다. 기존 triangle `mesh`가 있다고 가정한다. 이번에 실행하지 않았다 (`packages/barocss-gpu/README.md:714-765`).

```ts
import { materialShader } from '@barocss/gpu';
const result = materialShader(`
@shader #wave {
  @uniform time: float(0,2,0);
  @fragment {
    color: mix(#204080,#E08020,sin(time*1.5707963267948966)*0.5+0.5);
  }
}`, { time: 1 });
if (result.ok) mesh.material = { shader: result.shader };
// 실패하면 diagnostics를 표시하고 기존 재질을 유지한다.
```

이것은 shader 전체 교체가 아니다. 결과는 linear vec3 base color이며 기존 색/texture와 곱해지고 기존 PBR 조명을 거친다. 고정 vertex stage와 임의 fragment 전체 출력은 구분해야 한다 (`src/viewer/shaders/surface.ts:9-52,379,570`).

## 최소 설계: 두 작성 방식, 한 compiler

1. CSS source와 named uniform 입력을 현재처럼 기본 저장·교환 경로로 둔다. 현재 parser의 `@let`, bounded `@fn`, math, repeating UV를 먼저 문서화한다. 제한은 source 64 KiB, 4096 tokens, 16 scalar uniforms, 256 expanded nodes, depth 16이다. 기존 budget을 builder가 우회하면 안 된다 (`src/material/mesh-material.ts:75-102,183-250,303-341`).
2. 선택적 TS/JS helper는 초기에는 현재 허용된 float/color 연산과 base-color output만 만든다. canonical DSL source를 생성하고 **현재 `materialShader`를 호출**한다. 별도 parser/optimizer/backend를 만들지 않는다. IR은 공개되어 있지만 validator가 source를 재compile하고 비교하므로 임의 graph를 직접 lower하는 경로로 바꾸지 않는다 (`src/material/mesh-material.ts:416-445`).
3. builder의 type check는 편의 기능이다. 실제 수락은 기존 compiler가 결정한다. 생성한 UTF-16 source 구간을 builder의 node/name에 대응시켜 오류를 작성 위치로 돌려준다. raw source 사용자는 현재 source diagnostics를 그대로 받는다.
4. PBR/finish/maps는 기존 `Material` 객체와 patch 경로를 쓴다. shader builder가 같은 이름의 다른 PBR 모델을 만들지 않는다. shader output slot은 현재 base color로 제한한다고 명시한다. roughness/normal/vertex slot은 구현 전 노출하지 않는다.

### 미구현 설계 예시 — 현재 API가 아님

아래 `shaderCode`, `uniformFloat`, `mix`, `hex`, chain 메서드는 제안 이름이다. 배포된 함수로 사용할 수 없다. 마지막 compiler 호출만 기존 API이다.

```ts
const code = shaderCode('wave');
const time = code.uniformFloat('time', { min: 0, max: 2, default: 0 });
code.color(mix(hex('#204080'), hex('#E08020'),
  time.mul(1.5707963267948966).sin().mul(0.5).add(0.5)));
const result = materialShader(code.toCSS(), { time: 1 });
```

초기 완료 조건은 CSS 직접 작성과 helper 작성이 같은 canonical source 의미·uniform layout·오류·budget을 갖는 것이다. 일반 JS callback, 무제한 loop 또는 Three TSL의 `Fn` 전체를 지원한다는 뜻이 아니다. 직접 AST 입력은 source 생성의 한계가 실제 workload로 확인될 때만 재검토한다.

## 적용, 갱신, 오류와 자원 수명

**현재:** shader params는 frame마다 다시 읽고 값이 바뀌면 GPU buffer를 갱신한다. host가 값과 frame을 관리하고 `viewer.requestRender()`를 호출한다. 자동 time clock은 없다. code cache는 shader 객체 identity를 사용하므로 code 변경은 새 shader 객체로 적용해야 한다. 같은 객체의 expression/declarations를 바꾸는 hot reload는 보장되지 않는다 (`src/viewer/scene.ts:345-358`, `src/viewer/viewer.ts:884-887,911-929`).

**제안:** code descriptor와 host-owned uniform 배열을 구분한다. named uniform helper는 기존 layout을 찾아 배열 값만 갱신한다. 범위를 명확히 유지한다. 현재 `materialShader` convenience 입력은 선언 범위로 clamp하고, strict binding validator는 nonfinite/out-of-range를 거부한다. 새 helper에서 두 정책을 몰래 하나로 바꾸지 않는다. 기존 cache를 먼저 쓴다. cache 확장이 필요하면 code뿐 아니라 backend/ABI/UV/resource layout을 구분하고 실제 compile metric으로 효과를 확인한다.

**현재:** source compile 실패는 stateless result이다. caller가 실패 결과를 적용하지 않아야 last-good가 유지된다. Studio는 source draft를 따로 보관하고 compile 성공 후에만 `render.materials`를 갱신한다 (`apps/cad-studio/src/ui/RenderPanel.tsx:389-393`). GPU validation/pipeline/allocation 실패까지 transactional swap을 보장하는 public API는 확인되지 않았다. `showScene` parse 실패 보존과 GPU 자원 실패 rollback을 혼동하면 안 된다.

**제안:** 다음 구현은 먼저 준비·검증한 재질만 현재 revision에 적용하고, 늦게 끝난 이전 compile은 폐기한다. 실패한 staging 자원은 해제하고 accepted 재질과 화면을 유지한다. 이는 새 수락 조건이며 현재 보장이라는 주장은 아니다. raw WGSL의 onError 호출만으로 이 조건을 만족했다고 볼 수 없다.

Material 자체는 dispose하는 resource class가 아니다. ImageTexture/Geometry/Viewer/PathTraceSession에는 별도 수명이 있다. Mesh.remove/dispose는 per-mesh params buffer를 해제하고 shader pipeline은 Viewer cache에 남는다 (`packages/barocss-gpu/src/viewer/viewer.ts:768-785,877-931,2220-2246`; `src/viewer/scene.ts:118-125,251-257,412`). builder는 이 자원들을 숨겨 소유하지 않는다. replace/remove/dispose와 shared texture를 각 owner의 계약으로 유지해야 한다. device recovery 후 동일 pixels는 아직 별도 검증 항목이다.

## 보존 가능한 문서와 backend 계약

현재 Studio의 source draft/accepted source 구조를 재사용한다. 제안 저장 내용은 canonical DSL source, named scalar 값, 기존 material 값과 stable host asset/material 참조이다. JS closure, GPUDevice, pipeline, buffer handle 또는 객체 identity는 저장하지 않는다. helper가 만든 DSL을 보존하면 material 의미는 재구성할 수 있지만 원래 JS 작성 코드를 그대로 복원하는 것은 아니다. 별도 graph 문서 포맷은 지금 추가하지 않는다. texture asset 참조와 uniform 값의 실제 host 저장 지원은 별도 확인이 필요하다.

raw WGSL escape는 유지하되 **raster base-color hook**으로 표시한다. 버전·입출력 ABI·허용 binding을 문서화한 descriptor만 저장 대상으로 삼는다. 임의 shader stage 또는 다른 backend로 자동 이식되는 source라고 약속하지 않는다.

| 대상 | 현재 확인 | 설계에서 명시할 경계 |
| --- | --- | --- |
| GPU raster/WebGPU | CSS adapter와 raw WGSL base color가 실제 draw에 연결 | 이 경로부터 코드 helper를 지원한다. |
| WebGL2 | GPU 패키지 WebGL renderer 제거, GLSL lowering은 CPU 출력 (`README.md:175-195`) | GLSL 출력 존재를 runtime fallback으로 표시하지 않는다. Studio 자체 fallback은 별도 소비 경로다. |
| Pathtrace | 표준 material/maps snapshot, custom `m.shader`는 거부 (`src/viewer/pathtrace-scene.ts:22`) | CSS/코드/raw custom shader parity를 약속하지 않는다. |
| Vertex/custom post | 고정 vertex, 내장 post 설정 있음; public 임의 pass graph 없음 | 지원하지 않는 target은 적용 전에 구체 진단으로 거부한다. |

## Three TSL을 직접 쓸지

Three TSL은 typed node와 uniform/Fn 연산뿐 아니라 geometry/material/renderer/backend 문맥을 NodeBuilder가 사용한다. WGSL/GLSL builder와 update 단계도 포함한다. BaroCSS에 그대로 연결하려면 binding, stage, frame update, resource ownership을 옮기는 adapter가 필요하다. **설계 판단:** 단순 WGSL 문자열 생성 도구처럼 가져오는 것은 적합하지 않다. 의존성 크기나 성능 비용은 측정하지 않았다. [공식 TSL 문서](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language).

Three NodeMaterial은 color/position 같은 slot과 vertex/fragment 전체 교체를 나눈다. 이 구분은 참고할 수 있지만 BaroCSS가 이미 그 slot을 지원한다는 뜻은 아니다. [공식 NodeMaterial 문서](https://threejs.org/docs/pages/NodeMaterial.html).

Three WebGPURenderer는 TSL을 통해 WebGPU와 WebGL2 fallback을 지원하며 ShaderMaterial/RawShaderMaterial/onBeforeCompile를 지원하지 않는다. 따라서 Three의 기존 raw shader를 가져오는 방식과 TSL 통합도 같은 선택지가 아니다. [공식 WebGPURenderer 안내](https://threejs.org/manual/pages/webgpurenderer).

| 선택 | 이점 | 비용·결정 |
| --- | --- | --- |
| 기존 CSS만 정리 | 가장 작음. 문서와 현재 compiler 재사용 | 코드 자동완성/조합 요구는 일부 남음. 즉시 시작 가능. |
| 얇은 native typed helper → 기존 DSL | CSS와 코드 모두 사용. compiler/진단/한계 공유 | 제한된 연산만 지원. **권고하는 다음 작은 변경.** |
| Three TSL 직접 adapter | 넓은 node 생태계 | renderer 문맥/자원/stage/backend 호환 비용. 현재 요구에는 큼. 별도 실험 없이는 채택하지 않음. |

## 비용 순서와 최소 완료 조건

비용은 상대 순서다. 기간·성능 추정은 아니다. roadmap 번호는 기존 항목 연결이며 이번에 완료 상태를 바꾸지 않는다.

| 순서·사용 작업 | 현재 지원/공백 | 최소 완료 조건·기존 gate |
| --- | --- | --- |
| 1. 금속과 반투명 표시 | PBR/finish/clearcoat/film/maps/opacity 있음. 물리 유리의 IOR/transmission/thickness 없음 | 실제 public recipe, 기능표, 단위/range/색공간 설명. 반투명과 굴절 유리를 구분. G15a/b, G15-accept. 물리 유리는 별도 범위·비용. |
| 2. 시간으로 바뀌는 wave | float uniform+host frame 지원, 자동 clock 없음 | 동일 코드로 두 uniform 값의 pixels 변화; invalid source 미적용 시 accepted material 유지. code 재compile 없음은 별도 승인된 metric으로 확인. G18.2/G18.3. 기존 성공 receipt는 source/runtime binding을 확인해 재사용. |
| 3. 코드에서 같은 wave 작성 | public typed builder 없음 | 얇은 helper와 CSS가 같은 의미·layout·진단·budget. canonical source roundtrip. 위 한 workload부터 SDK sample/Studio 소비 경로까지 연결. R7.5b material ID facade를 재사용. |
| 4. UV+texture | PBR maps와 repeating UV 있음. sampler-profile compiler는 있으나 `materialShader` 연결 없음 | 필요한 sampler bridge만 추가. asset resolve, UV convention, binding 오류, 공유 texture/remove/dispose를 검증. CPU lowering만으로 Viewer 지원 수락 금지. G18.2 및 material-shader/SDK 소비 gate. |
| 5. 일반 noise 무늬 | bounded DSL 일반 noise 없음; raw helper 구현 가능 | 우선 raw base-color로 workload 충족 여부 확인. 부족할 때만 bounded noise 함수와 진단/비용 상한 추가. 임의 node graph 불필요. |
| 6. vertex 변형 | public slot 없음 | 별도 설계. 위치뿐 아니라 normal/bounds/shadow/picking 일관성과 CAD 원본 geometry와 표시의 의미를 명시. fragment API 이름 변경으로 해결 불가. SDK/Studio 소비와 별도 gate 필요. |
| 7. custom postpass | AO/contact/AgX/grading/vignette/bloom/DoF 등 내장 효과 있음 | 우선 내장 설정으로 목적 달성 확인. 임의 pass가 꼭 필요하면 format/resize/read-write/order/disposal 계약부터. G15d와 연결하되 optional G15d.4 temporal accumulation과 혼동 금지. |

기존 roadmap 출처는 `apps/cad-studio/handover/roadmap.md:1201-1215`(G15), `:1316`(R7.5b), `apps/cad-studio/handover/decisions-gpu.md:875-914`(G18.2), `:917-928`(G18.3)이다. R2c 파일 분리는 authoring 기능 gate가 아니다. experimental compute G25도 custom material/pass graph와 별개다.

## 다음 checkpoint와 남은 범위

현재 단계의 산출물은 source 기반 초안이다. 새 API 적정 범위, 실제 shader compile 비용, texture streaming, 자연 device loss 복구와 backend별 동등성은 **미확인**이다. 이 검토로 전체 GPU/상업 CAD PASS를 내리지 않는다.

다음 checkpoint는 기존 wave 한 개를 기준으로 CSS→공개 materialShader→mesh patch→uniform frame 변경의 고정 source/native pixel 증거를 먼저 대조하는 것이다. 현재 browser spec은 raw WGSL hot params를 검사하며 CSS compiler 호출을 포함하지 않는다. 역사적 G18.2 결과를 현재 commit 전체 PASS로 승격하지 않는다. 기존 receipt가 이 정확한 경로를 충족하지 않을 때만 같은 작은 실제 경로의 부족한 증거를 채운다. 그 뒤에 typed helper를 같은 compiler의 두 번째 입력으로 구현한다. 새 harness나 실행은 이번 cycle에 하지 않았다.
