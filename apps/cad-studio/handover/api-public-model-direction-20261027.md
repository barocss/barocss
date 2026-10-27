# 공개 모델 API 구조: 설계 방향과 이행 조건

기준 소스: 공통 `4175ca4083f96c3b964fd910bbe50b9d7d98a43c`. 공통 로드맵 16, 기존 단일 작업 `API-PUBLIC-MODEL-CONTRACT-01`의 설계 기록이다. 별도 실행 큐가 아니다. 현재 API를 변경한 결과나 새 실행 PASS가 아니다.

## 확정한 설계 방향

1. 사용자가 편집하고 저장하는 설계 원본은 CAD Model 문서로 정한다. 현 구현의 `StudioDoc` / `barocss-cad-model`을 출발점으로 쓴다. 이력·매개변수·재료·구성·조립·도면을 계산용 문서로 덮어쓰지 않는다. `StudioDoc`이라는 타입 이름은 현재 사실이며, 이름을 바꾸는 것만으로 구조 문제가 해결되지는 않는다.
2. 일반 모델링의 권장 진입점은 CAD Model의 `part()`와 `assembly()`다. box·hole·gear 등을 패키지 선택 때문에 나누게 하지 않는다. 이미 Model Part가 공통 Part를 상속하고 gear 등을 추가하므로 같은 typed core/command 경로를 확장한다. 현재 Model에 없는 결과 메서드는 지원 차이를 명시하고 정확한 후속 범위로 정한다.
3. 커널은 독립 계산 계층으로 유지한다. 저수준 B-rep/기하 함수와 기존 kernel Part는 독립 소비자와 기존 import를 위해 보존한다. 사용자 설계의 또 다른 동등 원본으로 권장하지 않는다. 커널에 Model 의존을 넣거나 기하 알고리즘을 중복 작성하지 않는다.
4. Model → 커널 표현 → 평가 결과 → mesh → GPU scene/viewer는 원본과 파생 결과의 관계다. 변환한 커널 문서로 원본 편집 문서를 대체하지 않는다. 현재 `toPartDocument`는 원본 전체의 무손실 왕복 계약이 아니다. scene이 원본을 자동 추종한다는 계약도 아직 없다.
5. Part뿐 아니라 Sketch/참조·Assembly·결과/출력·GPU/Viewer까지 같은 설계 원칙을 적용한다. 메서드 이름만 같게 만든 뒤 계약이 같다고 쓰지 않는다.

## 기능별로 먼저 정할 계약

| 경계 | 반드시 정할 내용 | 현재 주의점 |
|---|---|---|
| 모델링/Sketch/편집 | 지원 명령·옵션, 이력, 대상 body/occurrence, 선택 참조, 매개변수와 suppression, 실패 시 원본 보존 | 공통 이름도 바인딩과 지원 범위가 다르다. B-rep 참조와 표시 mesh 선택을 혼용하지 않는다. |
| Part/Assembly | 기준 문서 format, part-local/world frame, 안정 ID, 재료·구성·관절 입력 | 현 assembly()는 Model Part를 받는다. 두 part() 이름을 합쳐도 자동 호환이 생기지 않는다. |
| mass/mesh/STEP/STL/도면/제조 출력 | 입력·단위, 재료/밀도 출처, 반환 타입, body key, 오류, 손실과 지원 프로필 | 현 Model Part에는 STL 메서드가 없다. 커널과 Model의 mass/선택/출력 계약을 같다고 쓰지 않는다. |
| Model → GPU/Viewer | 문서 revision, 평가/메시 revision, body/occurrence ID와 변환, 취소·오류·늦은 결과 거부, 갱신 시점 | 기본은 명시적인 snapshot/refresh다. 자동 동기화는 별도 기능으로 구현·완료해야 한다. GPU는 같은 모델을 재해석하지 않는다. |
| 파일/API 호환 | 기존 import·format·버전·ID·typed 오류·선택/출력 키 보존, 명시 import/export 및 손실 보고 | 자동 역변환이나 완전 왕복은 약속하지 않는다. 기존 파일과 저수준 API의 즉시 삭제·폐기 없음. |

## 이행 순서

1. Docs의 현행 전체 API 조사와 Kernel/Model 검토를 합쳐 메서드/옵션/결과/오류/파일의 차이 표를 닫는다. 공개 패키지와 실제 소비자를 빠뜨리지 않는다. 이는 소스 조사이며 실행 PASS가 아니다.
2. 기존 import를 유지하면서 권장 사용자 진입점과 원본/파생 경계를 문서·예제에 명시한다. 이름 alias를 추가하더라도 기존 런타임 format과 실제 이력을 바꾸지 않는다. 명칭 정리만으로 전체 과제를 완료 처리하지 않는다.
3. 기능 공백과 계약 차이를 한 기능씩 정상 child commit으로 해결한다. 기존 기반과 command를 재사용하고 필요한 영향 확인·실제 파일/소비·제품 통합을 한 배치로 닫는다. 현재 공통03의 준비된 소스와 과거 근거는 소급 변경하지 않는다.
4. 호환 어댑터나 명시적 이관이 필요한 경우 지원 가능한 범위와 손실을 먼저 고정한다. 기존 공개 진입점의 폐기나 파일 형식 교체는 별도 명시 범위·호환 근거 없이 실행하지 않는다.

Root는 API 설계·계약 중재·정확 통합을 맡는다. 기존 Kernel 담당은 Model/커널 구현을 맡는다. GPU 담당은 공통 렌더링, Outer/Viewer 담당은 소비 UI, Docs 담당은 실제 계약과 예제를 맡는다. 각 담당은 기존 정상 branch를 사용한다. 새 엔진·DSL·Work·의존성 설치나 중단된 packaging/Physics 작업의 재개는 이 결정에 포함되지 않는다.

## 현재 소스 근거

- `packages/barocss-cad-model/src/api/part.ts`: `StudioPart extends Part<StudioDoc>`, Model 전용 gear/loft, Model format 검사.
- `packages/barocss-cad-model/src/api/studio.ts`: 기존 command·참조·평가를 사용하는 Model backend.
- `packages/barocss-cad-model/src/engine/part.ts:358`: `toPartDocument`; 끝에서 커널용 parameters/features를 반환한다.
- `packages/barocss-cad/src/api/kernel.ts:93`: 일부 facade 명령의 `UNAVAILABLE`와 Model 진입점 안내.
- `packages/barocss-cad-model/src/api/assembly.ts`, `packages/barocss-gpu/src/api/scene.ts`: Model Part와 mesh 기반 scene의 현재 경계. Docs의 전체 조사 결과로 상세 차이 표를 보강한다.

확정 범위는 위 설계 방향이다. 메서드별 최종 옵션/반환/alias·어댑터·호환 이관 범위와 실제 구현은 아직 완료되지 않았다.

## 공개 패키지 합침에 대한 현재 의견

사용자에게 한 가지 권장 진입점을 주는 것과 배포 패키지를 물리적으로 합치는 것은 다른 결정이다. 먼저 CAD Model API를 기본 사용자 진입점으로 만들고 kernel→model 내부 의존은 유지한다. 현재 `cad-model/api`가 이 역할을 할 수 있으므로 물리적 통합은 기능 보강의 선행 조건이 아니다.

장기적으로 공개 이름을 `cad`로 수렴하는 안도 비교한다. 다만 CAD 루트가 Model을 바로 역참조하면 순환 의존이 생길 수 있고, 서로 다른 exports/NodeNext·Bundler 소비, 두 part()/format/instanceof와 기존 하위 import 호환을 함께 다뤄야 한다. 별도 저수준 계층·명시 alias·단계적 이관과 현재 배포 분리 유지의 비용을 비교한 뒤 결정한다. 물리적 합침이나 영구 분리는 아직 확정하지 않았다. 패키지/설정/중단 hook 작업을 이 의견으로 재개하지 않는다.
