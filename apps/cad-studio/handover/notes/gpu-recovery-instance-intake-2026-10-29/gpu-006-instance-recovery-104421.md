# GPU006 two-instance 복구와 public reorder

**PASS_BOUNDED_TWO_INSTANCE_RECOVERY_PUBLIC_REORDER**, exact `5168183e88c29d70468628b18bb91e5f7a10dbda`. 한 profile·한 guard·한 build/GPU 실행이다. assertion43개와 capture3개는 한 profile의 관측이다. D324 delayed-readback schedule이나 기존 CPU/native/success batch를 반복하지 않았다.

## 실행 전 source 계약

D324 기존 `tests/pick-instance-readback-browser.test.mjs:85–103,109,129–134`의 geometry/camera/material/두 translation/오른쪽 pick target을 재사용했다. source SHA256 `5939c7d77118ecceaacfa99c76bdd9fd7b1a63eeec65c447bc880d41490d8213`는 d855 driver와 같다. 이번 fixture에는 native mapAsync/Promise hold 또는 prototype wrapper가 없다. baseline의 두 위치를 확인하기 위해 같은 방식의 왼쪽 target도 추가했다.

canvas320×240/DPR1/viewport800×600, camera position[0,0,6]/target0/upY, background#202020, unlit doubleSided #ff4020 삼각형 positions[-0.4,-0.35,0;0.4,-0.35,0;0,0.45,0]/face71이다. translation 순서는 처음[-0.8,0,0],[0.8,0,0]이고, 한 번의 reorder 뒤 반대다. 두 target의 원래 D324 색 predicate R>G+80, face71/triangle0와 finite point/depth를 고정했다. recovery fullRGBA max<=3, point 전후 component delta<=0.05는 accepted Core 정책이다. 새 절대 worldpoint 정확도 oracle은 만들지 않았다.

`scene.ts:176–197,286–287,317–327`에서 packInstances는 입력16개 값을 owned Float64Array matrix와 packed CPU data로 복사한다. 입력 object/array identity가 보존된다는 계약은 없다. public setInstances는 승인된 새 state를 할당하고 render를 요청한다. public instanceCount와 실제 GPU pick index가 행동 수락 근거다. owned matrices/data는 **@internal CPU state를 읽기만 한 구현 증거**로 구분했다. 이 접근을 public snapshot API나 공개 reference identity 보장으로 부르지 않는다. GPU buffer/device 필드를 직접 읽거나 patch하지 않았다.

## 실제 순서와 결과

| 단계 | logical translation order | 왼쪽 GPU instance | 오른쪽 GPU instance |
|---|---|---:|---:|
| baseline | -0.8, +0.8 | 0 | 1 |
| recovery 뒤, setter 전 | -0.8, +0.8 | 0 | 1 |
| public setInstances1회 뒤 | +0.8, -0.8 | 1 | 0 |

각 단계는 새 frame→mapped capture→두 public GPU pick을 수행했다. 두 선언 위치의 pixel은 모두 `[255,64,32,255]`, corner는 `[32,32,32,255]`다. public instanceCount는2이고 원래 Material/Mesh/Geometry가 유지됐다. Geometry는 disposed=false다.

baseline이 모두 유효한 뒤 supported hook을 정확히1회 호출했다. oldDevice.lost reason=destroyed, normal onRecover1회, deviceLosses0→1, distinctDevice=true/ready=true/recoveryCleared=true였다. callback 다음 새 frame/capture에서 원래 instances 순서/owned CPU matrices·136 packed bytes/두 pick index를 확인했다. 이 시점까지 setInstances 추가호출0, material reassign0이다. `recovery-continuity-proved-before-reorder` checkpoint 뒤에만 public setInstances를 한 번 호출했다. Mesh/Geometry를 다시 만들지 않았다.

before/after/reordered의 전체320×240×4=307200 mapped RGBA bytes는 모두 동일하며 max delta0이다. 같은 두 red placements/default instance color를 순서만 바꿨으므로 pixels가 동일한 것은 예상된 결과다. **갱신의 주된 대조는 fresh GPU pick index `[0,1]→[1,0]`**와 새 logical matrix 순서다. 정지 화면만으로 update 성공을 추정하지 않았다.

왼쪽 point는 `[-0.7916351938838435,-0.009099255102113114,4.975408472310373e-7]`, 오른쪽은 `[0.7916351938838438,-0.009099255102113114,4.975408472310373e-7]`, depth는 모두0.778640627861023이다. face71/triangle0/동일 Mesh·Geometry와 finite3D point/depth를 확인했다. recovery 및 reorder의 각 point delta는 모두0이다. pixel-center 양자화를 포함한 절대 target 정확도를 수락하는 결과는 아니다.

## 고정 source·실행·cleanup

명령: `/bin/sh /Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/gpu-006-instance-recovery-20261029T104421/run.sh`. Node22.19.0/Chrome156.0.8078.48, default WebGPU 단일 profile이다. old owned GPUDevice.adapterInfo는 apple/metal-3다. 별도 metadata용 adapter/device 요청은 없고 replacement adapterInfo/fallback identity는 UNKNOWN이다.

snapshot2237개 파일의 SHA256/Git blob, 내부 workspace links2개를 대조했다. actual bundle inputs452개는 GPU38/CAD413/own fixture1이며 third-party browser inputs0/external imports0이다. actual metafile/input hash audit가 browser 전에 통과했고 mutable product source/dist escape가 없다. source-manifest SHA256 `c814d6465b07da011ad7c772f767c2da295686e0a1f1a70c8936cd91152dbf65`; acceptance SHA256 `4f9119564ce39d4e859e6b00da441ea463f28e29130b5a4902a8bc6eaf9cbe1a`. 실행 뒤 acceptance/harness는 그대로다.

guard acquire heavy30은 즉시 exit0, syntax-browser0/syntax-runner0/probe0/release0이다. finite whole-attempt deadline120초 안에 끝났다. raw perstage는 assertion 및 다음 단계 전에 저장했다. firstfailure가 없고 page/console diagnostics/recoveryErrors가 비어 있다. 세 실제 PNG를 직접 열어 두 red triangles를 확인했다. source/code/command/output hashes, input state, events와 원래 공차는 run 폴더에 있다.

소유 Viewer.dispose 뒤 ready=false/deviceNull=true, page/context/browser/server CLOSED, wrapper wait/probe/release0이다. 다른 탭/서버/프로세스는 변경하지 않았다. 끝 observed HEAD `5168183e88c29d70468628b18bb91e5f7a10dbda`, dirty `?? .claude/`다. 제품/WIP/이전 snapshot/증거를 변경하지 않았다.

수락은 두 translation만의 instance resource 복구와 한 번의 public same-count reorder다. D324 delayed race, matrix scale/reflection/normal-map/shader/PBR 조합, general instancing, SDK/App, 자연 driver failure/OOM/VRAM/performance 및 pipeline/native allocation count는 NOT_RUN이다. logical-device loss는 지원 test hook으로 주입했으며 자연 장애 증거가 아니다. 실패 뒤 수정·retry/override/softwarefallback은 없다.

다음 checkpoint는 부모가 이 bounded instance gate PASS를 기존 resource 항목에 반영하는 것이다. 다른 geometry/resource/SDK profile은 별도 증거로 유지한다. 이번 fixture를 수정하거나 재실행하지 않는다.

[receipt](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/gpu-006-instance-recovery-20261029T104421/receipt.json) · [verification](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/gpu-006-instance-recovery-20261029T104421/verification.json) · [artifact manifest](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/gpu-006-instance-recovery-20261029T104421/artifact-manifest.json)
