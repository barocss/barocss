# D343 actual Studio consumer preparation

새 driver apps/cad-studio/test/prismatic-mass-stability-browser.mjs 준비 완료. `node --check`: PASS. 이 driver의 bundle/Studio/API/브라우저/oracle 실행은 NOT_RUN입니다. Model 단계의 actual corrected Z 소비자 증거는 /tmp/d343-model/receipt.md에 별도로 있습니다.

Driver SHA256:7facd870e00f61fe2f524f1111342cc5cf3a1aee192e9b67d61feeaf56f9c686. 소스 수정은 이 hash로 종료했습니다. D342 production helper와 App은 수정하지 않았습니다.

Root source freeze 및 API/Studio gate 이후 고정 worktree apps/cad-studio에서 실행합니다. 첫 실패를 보존하려면 새 run 디렉터리를 사용합니다.

```sh
D343_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' /Users/user/Library/pnpm/nodejs/22.19.0/bin/node test/prismatic-mass-stability-browser.mjs /tmp/d343-studio/run-01
```

Public Model API가 r3/H5.00009 translated cylinder at[.1234567,−.2345678,.3456789]와 witness420 시드를 만듭니다. 실제 Top view, read-only __studioScreenOf, 실제 mouse click으로 원래 top cap을 선택합니다. Existing Offset face HUD에 정확한 문자열−5.00009를 입력하고 preview가 통과할 때만 Apply합니다. No document/selection authoring hook.

Actual generated sketch/extrude/difference raw nodes를 기록합니다. height5.00009/from−5.00009, sketch plane normal coordinate가 원래 native cap과 같은지 exact equality로 확인합니다. 기존 source prefix는 변경되면 안 됩니다. 성공 Apply의 geometry picks는 비어야 하고 witness alias가 없어야 합니다.

독립 stdlib Fraction oracle는 ORIGINAL native endpoint + represented request의 one-rounding target으로 expected interval을 만듭니다. Captured case는 실제 lo.3456789/hi.34567890000000023와 gap1/4503599627370496를 정확히 요구합니다. Native geometry strict1solid/1closed shell, cap normal CP exact levels, 전체 normal CP interval, 원래 tangent boundary footprint를 별도로 검사합니다. Native geometry는 mass scalar만으로 판단하지 않습니다.

Kernel massPropertiesOf(actual Model partSnapshot output), public Part, actual evaluateDoc, actual Studio __studioBodies raw mass는 모두 finite positive volume 및 EXACT closed-interval normal centroid를 요구합니다. Exact Fraction midpoint와8midpoint-ulp bound를 비교합니다. Volume은 roundedπR²storedGap guide이며 exactπ가 아닙니다. UI body는 actual native key/ref와 동일 recipe hash로 매핑합니다. Witness key/names420·중심도 유지합니다. Provider queries는 source document를 바꾸면 안 됩니다.

Native B-rep quadrature는 따로 기록하고 method/relative-volume-difference/scope를 남깁니다. 이 provider의 tiny relative volume/centroid는 longitudinal repair의 정확도 주장에 넣지 않으며 nativequad mass로 잘못된 false failure를 만들지 않습니다.

실제 Undo/Redo, Save/fresh Open, exact recipe/native/public names 재구축과 corrected raw mass를 재확인합니다. 별도 fresh context에서 visible ordinary translated cylinder Offset+2 control을 수행합니다. X/Y rotated composition은 이 browser PASS 범위 밖입니다. Model 분류에서는 guard ACCEPTED 후0native output을 기록했으므로 guard pass를 실제 body 성공으로 간주하지 않습니다.

Chrome1개/serial contexts, D343_SOURCE_FROZEN pre-generation gate, initial subset/full bundle input counts, explicit virtual-stdin exclusion+saved source/hash, watcher/errors/downloads/failure capture/cleanup capsule을 유지합니다. Native raw read는 첫 geometry/provider assertion 전에 파일로 보존합니다.

Tiny thickness는 Float32/camera pixel로 분해할 수 없습니다. 스크린샷은 실제 UI/accepted state/renderer presence만 증명합니다. Interval은 native endpoints와 raw Model/public centroid로 판단합니다. Root screenshot review는 별도입니다. Central inertia/2D Green/overflow/subnormal/general providers/global mass accuracy는 주장하지 않습니다.

## Actual-result command wiring 최종 통합 후

Driver hash7facd870…은 변경하지 않았습니다. Profile command는 이제 기존 Extrude candidate 생성 뒤 새 High 소유 validateNativeOffsetResult를 통과한 경우에만 반환합니다. 최종 Model83PASS/types/narrowlint PASS이며 gate는 root API/Studio에 넘겼습니다. API/Studio/browser는 아직 NOT_RUN입니다.

후속 blocker 수정으로 helper 전체 SHA는096d95ed…가 됐습니다. 초기 D343 mass 단계의 dcd035d… byte-equal 증거는 그 시점의 별도 기록이며 최종 helper 전체 byte-equal 주장으로 쓰지 않습니다. 브라우저 initial/full source capsule이 최종 helper와 wiring source를 실제로 캡처합니다. Core 두 공식 변경과 기존 prospective distance proof의 범위를 혼동하지 않습니다.
