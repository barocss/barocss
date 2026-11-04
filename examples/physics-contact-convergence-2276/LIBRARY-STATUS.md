# 물리 라이브러리 완료 상태: NOT COMPLETE

현재 결과는 제한된 모델과 프로파일의 로컬 검증이다. 범용 물리 엔진, 일반 CAD 동역학, 제품 통합 완료를 뜻하지 않는다. 이 문서는 소스와 작은 결과 receipt만 읽은 감사다. 새 World·reference·compiler·browser 실행은 없다.

## 구현·검증 범위

| 구간 | 현재 판단 | 코드·증거와 남은 경계 |
| --- | --- | --- |
| P0–P2: 공통 World·rigid recording | 선택 범위의 로컬 PASS 이력 | `packages/barocss-physics/src/world.ts`, `src/types.ts`, `src/model-admission.ts`, `src/replay.ts`. 단일 clock/commit, typed refusal, 소유 상태·log 유지와 제한된 restore/continue가 검증됐다. 모든 프로파일의 재검증 또는 임의 checkpoint 복원을 뜻하지 않는다. Recorder512frame/1MiB 한계는 유지된다. |
| P3: hinge | 선택된 disjoint profile만 PASS | `src/disjoint-hinge/stage.ts`와 `packages/barocss-physics/ROADMAP.md`의 P3 기록. 일반 연결 관절망·제어·역사적 모든 runtime 차이까지 닫힌 것은 아니다. |
| P4: 여덟 상자 | stationary8만 별도 PASS; moving8은 NO_GO | `src/stack/prepare-step.ts`, `src/stack/stationary-normal.ts`, `src/stack/stationary-profile.ts`; `examples/physics-stack-stationary-world-2276/RESULTS.md`. 원래3scene×1200의 정지 평형과 public/desktop 경로를 통과했다. 여덟 물체 낙하·붕괴나 일반 회전·마찰 동역학에 전용할 수 없다. |
| 현재2/3상자 접촉 | dt 시험 PASS; 장기3상자 NO_GO | `src/stack/frictionless-island.ts`, `src/stack/geometry.ts`; 이 폴더의 `evidence/dt-03/result.json`, `evidence/long-02/result.json`. 아래 실제 카운터를 따른다. 기존 persistent bodycap4, direct/zero-material 범위다. |
| P5: cloth/fluid | 고정 visual profile의 공통 World 경로만 PASS | `src/domain/cloth.ts`, `src/domain/fluid.ts`, `src/cloth/`, `src/fluid/`; ROADMAP의 P5b_DONE_BOUNDED_LOCALSELECTED. 동적 rigid 반작용·일반 mesh·공학 CFD 정확도·완전한 제품 closure는 아니다. |
| P6a | private 순간 impulse leaf만 PASS | 공통 `src/world.ts`의 domain 경계와 ROADMAP의 P6a/G5. 공개 cloth–rigid coupling, 실제 trajectory/contact/work/dt 검증과 typed mixed endpoint가 남았다. |
| P6b / P7 | OPEN / NOT_SUPPORTED | fluid–rigid 물리 coupling, 연결 mechanism과 actuator/control 검증은 미완료다. CAD-model의 FK/IK·운동 재생을 동적 World 검증으로 간주하지 않는다. |
| P8: 제품·장비 | HOLD | Studio·제조·장비·로봇 제품 통합과 측정 기반 검증은 별도다. 기존 HOLD를 해제하지 않는다. |

`src/...`는 위 표에서 `packages/barocss-physics/src/...`를 뜻한다. ROADMAP의 과거 P4 NO_GO 기록은 새 stationary8 결과로 삭제하거나 재분류하지 않는다. 각 증거는 자기 모델·기간·그래프 범위에만 적용한다.

## 현재 접촉 캠페인의 실제 결과

- **현재 production:** `src/stack/face-contact.ts` SHA `c164a34d6245cf52a3f13274439eb6bb2dad471a47344e92aa1c30e5c94c99b6`의 projected-polygon correction guide를 채택했다. Source provider는 `sha256:bdff69b55d4effb0deda83bb1dfc298e82f17578e0c3dec127e5ca66a03fee00`, 실제 Native는 `sha256:ea44ebf2cd364b917b3c063a2393a13dd1d4b918dc9333c47fe0cf33eee7cb58`다. Hook·공차·point key·16회 한계는 바꾸지 않았다.
- **새 PASS:** geometry03은 그래프당42 geometry 호출/3 reference/20 regression/32 원래 point row의 숫자 비트를 검증했다. Build03의5개 compiler/generator 명령, tensor private02의20호출/13reference, public API02의8World/212단계/8reference, post-initial01의16패킷/48자세, post-regression01의7World/82 accepted(4 replay 포함)/4 typed refusal이 실제 PASS다. Build PREPARED 자체는 물리 PASS가 아니다.
- **DT03 PASS:** 그래프당6World/840 accepted/840 independent-passed/14 reply, 두·세 상자60/120/240Hz matchedT1s의 전체 상태·숫자 비트가 일치한다. Smooth precontactT.1의 위치·에너지 비율만 `[1.99,2.01]`을 적용한다. 충돌 시각·불연속 속도에는 같은 비율을 강요하지 않는다.
- **새 LONG02 NO_GO:** Source-three의490번째 시도가 `NUMERIC_LIMIT: frictionless island: fresh post contact normal feasibility`로 거부됐다. accepted owner489/time4.075가 유지됐다. Source는2World/1002 attempts/1001 accepted지만 독립 검증·비교는896이다. Native는2World/896 accepted/896 independent-passed다. 각 그래프 reply는9개다.
- **현재 장기 자격:** 두512·세384는 두 그래프 모두 독립 검증과 전체 비트 비교가 끝났다. Source-three385..489는 관측만 됐다. Native385 이후나490 거부는 추정하지 않는다. Full512/512 화면·full checkpoint15는 NOT_RUN이며, 별도 prefix가 이를 대체하지 않는다.
- **역사 보존:** 원래 LONG01의479 strict-witness NO_GO와 owner478 유지, 첫 compile/분류/observer/HiDPI/probe 오류는 남아 있다. Geometry 수리의 production 채택과 새479 통과 관측은385..489 전체 World의 독립 물리 PASS를 뜻하지 않는다.

장기 시험은 direct World다. Recorder를 사용하지 않았고 restore도0회다. 이 결과를512단계 recording/restore 증거로 바꾸지 않는다.

## 실제 Viewer 적용과 HiDPI

`scene/display.mjs`는 실제 `@barocss/viewer`의 `setPackets`, `applyMotionFrame`, `readPixels`와 workspace GPU 경로를 사용한다. Physics는 qualified canonical Native다. 공통 clock과 step 소유자는 Worker의 public World이며 Viewer는 accepted pose만 받는다.

- Low-DPI `contact-viewer-prefix-01`: 실제 PASS,3World/896 accepted. 두512·세384의9개 window 전체 JSON/숫자 비트가 paid Native와 일치하고 실제 GPU 픽셀이 바뀌었다.
- HiDPI01: 실제 DPR wait timeout으로 실패했다. 별도0World probe는 CLI context의 screenshot이 CDP DPR2를 기본1로 되돌림을 관측했다. 원래 probe wrapper의 기대 status 문자열 오류도 보존했다. 저장 PNG 감사의 PASS가 그 외부 FAIL을 덮지 않는다.
- **HiDPI02 실제 PASS:** `contact-viewer-hidpi-02`는 37.133004708s, sourceIntegrity true, firstFailure null, owned context closed다. 같은3World/896 accepted와9개 Native window capture를 통과했다. 두 case의 실제 DPR1→2 및 세 desktop 크기에서 density 검사10개가 통과했다. 1280 viewport의 CSS1230×656은 backing2460×1312/scale2, 1440은2777×1510/scale약1.997844, 1920은2894×1448/scale약1.548001이다. 기존4MP 제한을 유지한다. 관측 sample의 changed pixels는1275/1422, 최종1920 조건의 실제 native readback은16762048B, 전체 proof는7369187B다. Root는 실제3840×2160 flight20 screenshot을 확인했다. 이는 검증된512/384 prefix의 화면 완료이며, 원래512/512 또는479 수리 완료가 아니다.

- **새 current-provider HiDPI 실제 PASS:** `contact-viewer-current-hidpi-01`은36.100715s,3World/896 accepted,9개 새 Native window capture,10개 DPR 검사,0errors, owned context closed/sourceIntegrity true다. Backing2460×1312/2777×1510/2894×1448와4MP 한계를 유지했다. Proof는 final receipt 전7371685B다. Root가 실제3840×2160 long-three20 PNG를 확인했다. 이것은 새 provider의 두512·세384 prefix PASS이며 원래 full512/512나490 수리 완료가 아니다.

Viewer의 centered box proxy3/4개, 명시적 RHYup binding, metres→mm 한 번과 `.001` scene scale, fresh Viewer/no assembly override 범위다. 공개 pose/packet corner와 실제 픽셀을 검사했으며 private GPU Float32 buffer를 측정했다고 주장하지 않는다. CAD native provenance와 접촉 marker 지원은 없다. HiDPI의 native backing은 DPR/4MP/4096 제한을 따르며640×360은 실제 native 픽셀의 관측용 sample이다.

이 `@barocss/viewer` host는 CAD Studio가 사용하는 `@barocss/gpu`의 별도 Viewer host와 같지 않다. Studio 적용 PASS가 아니다. CAD React 작업은 다른 소유 범위이므로 이 감사에서 검사하거나 판정하지 않았다.

## 공개 API와 증거 구분

`packages/barocss-physics/package.json`은 `0.0.0-experimental`이며 공개 package entry는 root, `/cad-proxy`, `/replay`의3개다. 로컬 `publishConfig`·dist·타입 생성은 새 배포 또는 공개 registry 검증이 아니다. 이 작업의 publish/release/deploy는 NOT_RUN이다.

| 증거 | 입증하는 것 | 입증하지 않는 것 |
| --- | --- | --- |
| 소스 감사 | 실제 admission/호출/소유 경계 | 실행 결과·수치 정확도 |
| 독립 Fraction/Decimal/geometry reference | 고정 모델·dt·기간의 물리 gate | 임의 질량/형상/접촉의 정확도 |
| Strict Source와 실제 canonical compile/runtime | 실제 export/의존성/타입·실행 경로와 같은 알고리즘의 비트 일치 | 독립 물리 정답 자체 |
| public API·record/refusal 시험 | 선택된 World/clock/log/restore 계약 | 일반 checkpoint·모든 프로파일 |
| 실제 데스크톱 Viewer/GPU | 해당 host의 accepted pose와 렌더링 | Studio·React·일반 assembly 통합 |
| 실제 GPU 장치 관측 | 화면 경로의 하드웨어 실행 | 제조·장비·로봇 힘/접촉 예측의 실측 검증 |

## 다음 우선순위

1. 새490 fresh-post-contact normal feasibility 거부를 해결한다. 479 geometry 수리는 채택됐지만, 원래 조건의 Source/Native/public/full 장기 gate는 아직 통과하지 못했다.
2. **완료된 bounded 화면 gate 유지:** 새 provider의 실제 Viewer·current HiDPI는 두512/세384 prefix에서 PASS다. 490 수리 후 확장할 경우 새 수치·public·Viewer 증거가 필요하다. 원래 전체512/512 완료로 바꾸지 않는다.
3. Unequal mass, tilted contact, 마찰, rotating/moving8을 각각 고정 입력·독립 gate로 확장한다. 기존 PASS를 일반화하지 않는다.
4. G3의 COM·principal/full-tensor·frame·parallel-axis·collider-offset 계약을 먼저 닫고 일반 CAD import/contact를 다룬다. 현재 anisotropic tensor는 primitive-COM에서 유도한 값이며 임의 CAD full-tensor 입력 API가 아니다.
5. 필요한 접촉 leaf를 바탕으로 연결 mechanism/control과 실제 물리 domain coupling을 검증한다. 승인된 제품 범위와 실측 gate 없이 Studio/장비/제조 HOLD를 해제하지 않는다.

완료율이나 완료일은 산정하지 않는다. 현재 결론은 **제한된 실험에 사용할 수 있으나, 물리 라이브러리 전체는 미완료**다.

## 현재 실패 진단

실제490 capture 감사는 거부 직전 closing velocity −1.0932118170260969e-7m/s를 확인했다. 원래1e-10 한계를 넘으므로 roundoff-only로 분류하지 않는다. 저장된384..489 진단에서는478 normal-direction error1.0310569142331814e-12가1e-12를 넘었고,488 rest velocity .04905m/s·angular velocity .0981rad/s,489 position error4.089e-4m가 관측됐다. 따라서 원인은490보다 앞설 수 있다. 이 데이터 감사의 independentTrajectoryAdded는0이며 두512·세384 자격을 넓히지 않는다.
