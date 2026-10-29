# GPU004 CSS materialShader + live uniform 복구

**PASS_BOUNDED_PUBLIC_CSS_UNIFORM_RECOVERY**. exact `1bc963c317eae13b284350076c4e5ee73d3feea4`의 새 immutable snapshot에서 한 profile을 한 번 실행했다. guard/syntax/build/browser/probe/release exit는 모두0이며 firstfailure는 없다. assertion45개와 capture4개는 한 profile의 관측이다. 독립45 tests로 집계하지 않는다.

## 실행 전 고정 계약

기존 public CSS wave recipe를 verbatim 재사용했다. shader source SHA256은 `ca3bb1fe61fc750169cd2808860278d54a107ac1f6f769038c0ce9d565be48a4`이다. current source의 material-viewer:23–44는 CSS→기존 compiler→sRGB literal decode→WGSL을 제공한다. scene:334–358,455–465는 material patch에서 shader ref를 유지하고 같은 params의 frame별 변경을 읽는다. compiler factory의 shader 객체와 host Float32Array를 붙인 accepted wrapper는 다르다. wrapper와 aliases는 한 번 freeze했고 params만 mutable이다. 이 차이는 실행 전에 기록했다. materialShader1회, material patch1회이며 loss 후 재compile/재할당하지 않았다.

기대색은 관측 결과로 맞추지 않았다. 기존 recipe와 동일한 white-base/unlit/doubleSided geometry/camera/fit 및 public `environment:{toneMapping:'none',exposure:1,ambient:0}`를 사용했다. current surface:565–570의 unlit linear 곱, lights:227–256의 exposure/tone-map/미설정 effect off, output:119–125의 linear→sRGB 경로를 먼저 확인했다. 독립 sRGB decode→linear mix→exposure1/no-tone-map→encode oracle은 time0의 ratio0.5/linearRGB `[0.37992402656824, 0.13356497924397126, 0.1151521718549959]` → RGBA `[166,102,95,255]`, time1의 ratio1 → `[224,128,32,255]`다. color<=2, recovery channel<=3, point<=0.05 및 covered>1000을 실행 전에 고정했다. geometry에 faces71/72와 pick 관측을 추가했으며 shader는 UV/geometry에 의존하지 않는다.

## 실제 연속성

| 단계 | time | 실제 세 interior RGBA | covered pixels |
|---|---:|---|---:|
| before0 | 0 | [166,102,95,255] | 6084 |
| before1 | 1 | [224,128,32,255] | 6084 |
| after1 | 1 | [224,128,32,255] | 6084 |
| after0 | 0 | [166,102,95,255] | 6084 |

각 단계는 requestRender→완료 frame→새 mapped capture→GPU pick을 수행하고 raw 상태를 assertion 전에 저장했다. corner는 모두 `[16,24,32,255]`다. baseline time0→1의 방향 delta `[58,26,-63,0]`이 통과한 뒤에만 existing owned-logical-device hook을 정확히1회 호출했다. oldDevice.lost reason=destroyed, normal onRecover1회, deviceLosses0→1, replacement distinctDevice=true, ready=true, recoveryCleared=true였다. callback 뒤 새 frame/capture를 수행했다.

before1/after1의65536 raw bytes는 동일하고 최대 channel delta0이다. 원래 ShaderMaterial wrapper·동일 Float32Array·Mesh·Geometry identity가 네 단계 모두 유지됐다. loss 뒤 같은 params를 **0으로 다시 갱신**하자 delta `[-58,-26,63,0]`으로 기대색이 돌아왔다. 마지막 화면만 유지한 결과와 구분된다. raw uniformBuffer 접근/patch는 없다. pipeline creation count는 측정하지 않았다.

양쪽 GPU pick은 원래 Mesh/Geometry, instance=null, triangle0, face71을 유지한다. 모든 stage의 point는 `[0.2328007847880108,7.962675475472604e-7,0.07760026159600361]`이며 target `[0.25,0,0.1]`에서 원래0.05 공차 안이다. recovery point delta는 `[0,0,0]`이다. Geometry는 disposed=false이고 원래 mesh1개를 유지했다. replacement mesh를 만들지 않았다.

## source·실행·cleanup

명령은 `/bin/sh /Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/gpu-004-css-recovery-20261029T102421/run.sh`이다. Node22.19.0/Chrome156.0.8078.48/DPR1, default WebGPU 한 profile이다. old owned GPUDevice.adapterInfo에서 apple/metal-3를 읽었다. 별도 metadata용 adapter/device 요청은 없다. 새 device identity는 직접 비교했으나 replacement adapterInfo와 fallback identity는 UNKNOWN이다.

snapshot2237개 파일의 SHA256/Git blob을 대조했다. workspace 링크2개는 snapshot 내부다. actual esbuild 입력548개는 product547({'barocss-gpu': 134, 'barocss-cad': 413})+own fixture1이며 third-party browser source0/external runtime imports0이다. actual input audit가 browser 전에 통과했다. installed esbuild/Playwright는 도구로만 사용했다. mutable product source/dist escape가 없고 제품/이전 증거를 변경하지 않았다.

source-manifest SHA256 `fb3b826b3bf4f8f970f6909fcaca59d76be7ba579a6788556c6b5e3abacc8662`; acceptance SHA256 `67fe7e07ea3839df7e73244e7a62ca9f90c6d28beb02a52b02978bdb96bdacb7`. 실행 뒤 acceptance/harness hash가 그대로다. shader source, lowered expression, source/dependency/input/output hash, event order, actual values와 raw RGBA/PNG는 run 폴더에 보존했다. 네 실제 PNG를 직접 열어 brown→orange→orange→brown을 확인했다. 수락은 raw mapped pixels로 판정했다.

onError/recoveryErrors/page/console errors는 모두 빈 배열이다. 소유 Viewer.dispose 뒤 ready=false/deviceNull=true, page/context/browser/server CLOSED, wrapper wait/probe0/release0이다. 다른 프로세스/탭/서버는 변경하지 않았다. 끝에서 observed HEAD `1bc963c317eae13b284350076c4e5ee73d3feea4`, dirty `?? .claude/`다.

이번 수락은 **Core custom CSS shader + live uniform의 지원 logical-device-loss 복구**다. maps/instancing/full PBR/SDK-App UI/자연 driver failure/OOM/VRAM/performance/Three.js parity는 NOT_RUN이다. GPU003 basic profile과 기존 CSS23 batch를 반복하지 않았다. 강제 recovery-failure 주입/native·prototype·adapter override/softwarefallback/retry도 없다. logical-device loss는 명시된 test hook으로 주입한 것이며 자연 장애가 아니다.

다음 checkpoint는 부모가 이 제한된 custom CSS gate PASS를 기존 material recovery 항목에 반영하는 것이다. 나머지 resource/SDK profile은 별도 증거가 필요하다. 이번 profile을 수정하거나 재실행하지 않는다.

[원본 receipt](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/gpu-004-css-recovery-20261029T102421/receipt.json) · [verification](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/gpu-004-css-recovery-20261029T102421/verification.json) · [artifact manifest](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/gpu-004-css-recovery-20261029T102421/artifact-manifest.json)
