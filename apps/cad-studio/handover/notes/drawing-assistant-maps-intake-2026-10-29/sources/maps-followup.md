# Material maps: one existing browser spec

**PASS — raster와 progressive still의 normal/roughness/metallic map을 독립 reference와 비교했다.** 기존 `viewer-material-maps-browser.test.mjs`의 단일 test를 한 번 실행했다. 결과는 **1 test / 1 pass / 0 fail / 0 skip**, 약3.91초다. 기존 CSSL23, Studio6, Viewer133 및 전체 GPU suite는 반복하지 않았다.

기준은 exact `1266cdf24943acc5963bf5e346339e32c9f3da41`다. freeze 직전 GPU source dirty는 없었다. Studio WIP는 포함하지 않았다. 기존 author receipt는 committed GPU README/관련 handover notes 및 기존 source-review가 가리키는 좁은 범위에서 찾지 못했다. CPU map specs는 실제 GPU pixel proof를 대신하지 않으므로 이 미확인 standalone spec을 선택했다.

## 검사 조건과 실제 값

원본 수락 조건, 비교 tuple, scene/camera/light, sample 수와 expected/assertion을 변경하지 않았다. max와 mean은 원본 spec의 중심16×16 RGB 영역이며, `different`는 전체 RGBA 배열에서 다른 byte 수다. 원본이 캡처한 실제 GPU bytes는 2D proof canvas에 보존되고 `images.png`에 저장된다. 별도 raw RGBA binary dump를 추가한 검사는 아니다.

| 검사 | 원본 수락 조건 | 실제 결과 |
| --- | --- | --- |
| Raster normal6개 | literal geometry normal 대비 max≤1byte; geometric control과 mean>3 | reference max 모두0. control mean은13,45,11.375,39.375,11.375,9 |
| Normal profile | front/mirrored/nonuniform scale/scaled mirror/back/max-finite normalScale | 원래6개 profile 모두 PASS |
| Normal scale zero | geometric image와 different=0 | 모든6개 different0 |
| UV fallback2개 | zero/missing UV에서 geometric image와 different=0 | 두 경우 different0 |
| Roughness G128 | literal linear scalar 대비 max≤1byte | max0; 잘못된 sRGB factor와 mean31.6667>3 |
| Metallic B128 | 같은 조건 | max0; 잘못된 sRGB factor와 mean4.6667>3 |
| Shared packed G128/B64 | 같은 조건 | max0; 잘못된 sRGB factor와 mean13>3 |
| Dispose/rebind | live map은 차이>3, reference max≤1, dispose/rebind different0 | live mean13, reference max0, dispose0/rebind0 |
| Progressive6개 | 각각 mapped/plain/reference8 samples, reference max≤2byte, control mean>3 | 모두[8,8,8], reference max 모두0; control mean13,27.8633,9,30,9,29.3333 |
| 정리·오류 | 모든 texture disposed, browser/GPU errors 없음 | textureDisposedtrue, errors[] |

Progressive profile은 원본의48×32, bounces1,8samples다. Raster와 progressive 모두 사용자 API의 map binding, UV convention과 known linear-channel 의미를 이 제한된 fixture에서 확인한다. 일반적인 텍스처 크기·애니메이션·모든 조명·모든 재질 품질의 인수는 아니다. max0 관측값을 필수 오차0으로 바꾸지 않았다. 원본 tolerance1/2를 그대로 유지했다.

## 소스와 실행 바인딩

- 새 소유 snapshot은 `runtime/material-maps-1266`이다. GPU/CAD source closure, config와 원본 spec **594파일·10,935,661bytes**를 exact Git blob/SHA256으로 동결했다. 기존 snapshot·제품 dist는 사용하지 않았다. workspace gpu/cad 링크는 snapshot 내부다.
- source manifest SHA256은 `ebad36bb73a2498cfc7a4f49a4f075a8214587cde07f5c342a525c8b8a8b17a5`다. 기존 esbuild 도구로 source viewer entry를 own `dist/viewer/index.js` 하나에 bundle했다. 실제 metafile **451개 input 모두 committed snapshot source**, third-party browser inputs0, external imports0을 browser 전에 검사했다.
- 원본 spec SHA256은 `6c3ec2da920c2bcc8044e43fd10056597ce380b938b6c8604b6e72c71b04c3a5`다. 부모가 허용한 metadata-only 사본은 `418932904efb511cdba5c38e9de5c79fcb991d00866bc2ea682591b7c7f90210`이다. 같은 availability adapter의 info와 같은 browser.version 기록만 추가했다. 추가 adapter/device request는0이며, 정확한 diff와 원본 assertion 줄의 byte 동등성을 보존했다.
- Chrome 실제 버전은 `156.0.8078.48`이다. 원래 availability request에서 관측한 adapter는 Apple `metal-3`, isFallbackAdapter는 API에서 제공되지 않아 null이다. Viewer는 자신의 정상 high-performance request를 별도로 사용한다. 그 adapter 객체 identity를 가로채거나 이전 fixture의 identity를 재사용하지 않았다. launch flags/profile을 변경하거나 software fallback을 요청하지 않았다.
- 설치 없이 기존 Node22 경로, Chrome/Playwright/esbuild만 사용했다. shared heavy gate를 한 번 요청해 즉시 획득했다(load11.93). syntax/build/probe/release exit는 모두0이다. 같은 소유 shell EXIT trap이 release했다. 원래 spec의 finally는 browser.close와 server.close를 await했고 소유 test child가 exit0으로 끝났다.
- 원본이 package `test:browser` 목록에 없다는 사실은 그대로다. 이번 standalone 실행 PASS가 test 등록이나 CI 실행 완료를 뜻하지 않는다.

실행 명령은 다음 한 번이다.

```sh
/bin/sh /Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/gpu-material-maps-20261029T081949/run.sh
```

## 보존한 근거와 경계

[receipt.json](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/gpu-material-maps-20261029T081949/receipt.json)은 원본 비교값, TAP counts, 실제 metadata와 cleanup을 담는다. [test.tap](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/gpu-material-maps-20261029T081949/test.tap), source-resolution/metafile, original/metadata-only SHA·diff, input/output hashes와 exit logs도 같은 폴더에 있다. 첫 실패는 없다. 재실행·수정·tolerance 완화는 없었다.

[실제 proof PNG](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/gpu-material-maps-20261029T081949/evidence/raster-maps-nsVTXh/images.png)를 실제로 열어 normal/mirrored/scaled/back, scalar-map 대비, dispose/replacement와 progressive rows를 확인했다. 이것은 정적인 예시 그림으로 대체한 결과가 아니다.

제품/WIP·기존 review/evidence·기존 snapshot·브랜치는 수정하지 않았다. 새 문제나 제품 수정 사항은 없다. natural device failure/OOM, device recovery, driver memory, 다른 backend와 전체 Three.js parity는 **NOT_RUN**이다. 이 receipt를 재사용하고 같은 성공검사를 다시 반복하지 않는다.
