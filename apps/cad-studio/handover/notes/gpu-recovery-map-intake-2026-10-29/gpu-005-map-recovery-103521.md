# GPU005 shared packed data-map raster 복구

**PASS_BOUNDED_PACKED_DATA_MAP_RESOURCE_RECOVERY**, exact `86c7aff39593484b60f64de6130ad2c38a693695`. 기존 spec의 shared packed roughnessG128/metallicB64 raster row 하나를 새 immutable snapshot에서 한 번 실행했다. 새 profile의 assertion28개와 capture4개는 한 실행의 관측이다. 과거 GPU28 suite나 전체 map spec을 다시 실행한 것이 아니다.

## 실행 전 고정 profile

기존 `packages/barocss-gpu/tests/viewer-material-maps-browser.test.mjs` SHA256 `6c3ec2da920c2bcc8044e43fd10056597ce380b938b6c8604b6e72c71b04c3a5`는 이전1266 receipt의 원본 spec과 같다. metadata-only diff는 availability adapter 기록만 추가한 과거 증거로 읽었고 이번 실행에 적용하지 않았다.

동일 public camera `[0,0,8]`/orthographic, canvas128×96, antialias=false/pixelRatio1, 원래 camera fit 준비와 position 복원, identity-transform geometry/normals/UV를 사용했다. light는 direction[-0.4,-0.2,-1]/intensity0.4, environment는 ambient0.15/sky white/ground#151515/toneMapping none다. base color#9f5533/roughness0.9/metallic0.65/doubleSided를 유지했다. 단일1×1 RGBA `[7,128,64,255]` ImageTexture를 srgb:false/mipmaps:false/nearest로 생성해 두 슬롯에 공유했다. literal reference는 roughness `0.45176470588235296`, metallic `0.1631372549019608`다. 잘못 sRGB decode한 independent negative control은 각각 `0.19427445010250935`, `0.0333251479431281`다.

원래 reference center16×16 RGB 최대오차<=1byte, wrong-sRGB 평균차>3byte를 그대로 고정했다. recovery 비교는 별도 whole RGBA max<=3, point 전후 component delta<=0.05다. 원래 spec에 GPU pick 정확도 oracle이 없으므로 절대 worldpoint 정확도 수락은 추가하지 않았다.

현재 public `scene.ts:107–125`의 ImageTexture는 source/options를 보존하며 device loss 뒤 upload를 지원한다고 명시한다. `viewer.ts:836–870`의 createTexture/mapGroup은 같은 logical Texture와 다른 device를 처리한다. `scene.ts:455–471`은 linear data map을 요구하고 같은 map ref를 유지한다. active Material을 재할당하지 않으려고 동일 Geometry를 공유하는 별도 hidden literal-reference/wrong-control mesh를 만들고 visibility만 바꿨다. 이는 원래 scalar reference의 같은 geometry/material/lighting 수치조건을 유지한다. faces71/72와 pick 관측만 추가했다. active normalized Material·Texture·Mesh·Geometry ref를 캡처해 검사한다.

## 실제 결과

| 관측 | baseline | recovery 뒤 |
|---|---:|---:|
| map vs literal, center768 RGB channels max/mean | 0 / 0 | 0 / 0 |
| map vs wrong sRGB, 같은 ROI max/mean | 17 / 13 | 17 / 13 |
| map vs wrong, 전체49152 RGBA different bytes | 9900 | 9900 |
| active centerRGBA | [117,72,55,255] | [117,72,55,255] |

literal/wrong/active baseline의 실제 frame·mapped capture와 active GPU pick을 수행한 뒤에만 hook을 호출했다. oldDevice.lost reason=destroyed, normal onRecover1회, loss count0→1, distinct new device=true/ready=true/recoveryCleared=true였다. 그 뒤 새 frame과 mapped capture를 수행했다. before/after **전체128×96×4=49152 bytes는 동일**, max channel delta0이다. 원래 reference의 중심 RGB ROI와 이 전체 RGBA 비교를 혼동하지 않았다.

원래 Texture는 roughnessMap/metallicMap의 같은 객체이며 두 단계 모두 disposed=false다. active Material·Mesh·Geometry도 같은 객체였다. Texture public creation1회, active Material reassign0회이며 loss 뒤 createTexture/rebind를 하지 않았다. 이 call count는 fixture의 public 호출 기록이며 native allocation/pipeline count가 아니다.

baseline/after GPU pick은 원래 Mesh/Geometry, instance=null, triangle0, face71, finite point/depth다. point는 `[0.2729776756996517,-0.2729776756996517,0]`, depth0.5였고 전후 point delta는 `[0,0,0]`이다. pick target은 사전에 정한 world[0.25,-0.25,0]의 projected CSS 좌표이며 pixel-center 양자화를 인정한다. 절대 target 정확도 검사를 새로 만들거나 geometry 정확도 수락으로 확대하지 않는다.

## 실행·source·cleanup

명령: `/bin/sh /Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/gpu-005-map-recovery-20261029T103521/run.sh`. Node22.19.0, Chrome156.0.8078.48/DPR1, default WebGPU 한 profile이다. actual old owned GPUDevice.adapterInfo는 apple/metal-3였다. 별도 metadata용 adapter/device 요청은 없다. replacement adapterInfo/fallback identity는 UNKNOWN이다. supported internal `viewer.ts:2223–2226` hook은 소유 logical device만 해제하며 자연 장애나 physical GPU 조작이 아니다.

guard acquire heavy30은 즉시 exit0, browser/runner syntax0, build/input audit0, probe0, release0이다. stage raw JSON을 assertion/다음 단계 전에 저장했다. firstfailure가 없고 diagnostic/recoveryError/page/console error는 빈 배열이다. 실패 뒤 수정·재실행, softwarefallback/native·prototype·adapter override, forced recovery-failure는 없다.

snapshot2237개 파일의 SHA256/Git blob과 내부 workspace links2개를 대조했다. actual esbuild inputs452개는 GPU38/CAD413/own fixture1이며 third-party browser inputs0/external runtime imports0이다. browser 전에 actual metafile을 manifest와 대조했고 mutable source/dist escape가 없다. source-manifest SHA256 `b7a9fc7aba58ae9bbb31682dc9a7a884ee6df634a2e39aecfeef264af01310de`, acceptance SHA256 `c9b71263c3e3a62f211fa6f535ba35ba636032e1846b9b4c249869c45ec9521f`다. 실행 뒤 acceptance/harness는 동일하다. 모든 source/입력/출력 hash는 manifest에 있다.

실제 PNG4개를 열었다. reference/before/after는 같은 갈색 quad이며 wrong control은 더 어두웠다. 수락은 화면 인상 대신 raw mapped bytes/ROI 수치로 판정했다. cleanup에서 소유 Viewer.dispose 뒤 ready=false/deviceNull=true/originalTextureDisposed=true, page/context/browser/server CLOSED, wrapper wait/probe/release0을 확인했다. 다른 탭/서버/프로세스는 변경하지 않았다. 끝 observed HEAD `86c7aff39593484b60f64de6130ad2c38a693695`, dirty `?? .claude/`다.

제품·기존 증거·snapshot 변경은 없다. 이번 한 profile은 maps-specific Core 복구 증거다. 다른 map/normal map/full PBR/progressive/dynamic Texture update/instancing/SDK-App UI/자연 driver failure/OOM/VRAM/performance/Three.js parity는 NOT_RUN이다. 완료된 CSS45/basicGPU003/API9 또는 전체 map suite를 반복하지 않았다.

다음 checkpoint는 부모가 packed map Core recovery PASS를 기존 material-resource 항목에 반영하는 것이다. 다른 resource profile은 별도 증거로 남긴다. 이번 fixture를 수정하거나 다시 실행하지 않는다.

[receipt](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/gpu-005-map-recovery-20261029T103521/receipt.json) · [verification](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/gpu-005-map-recovery-20261029T103521/verification.json) · [artifact manifest](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/gpu-005-map-recovery-20261029T103521/artifact-manifest.json)
