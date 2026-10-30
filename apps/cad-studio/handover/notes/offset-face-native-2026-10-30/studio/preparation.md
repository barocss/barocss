# D342 Offset face actual browser preparation

준비 완료. `node --check`: PASS. 제품 빌드·테스트·브라우저·독립 oracle 실행: NOT_RUN.

소유 repo 파일은 `apps/cad-studio/test/offset-face-native-browser.mjs` 하나입니다. `/tmp/d342-studio`에는 준비 스크립트와 독립 Fraction oracle 원본을 저장했습니다. 제품 소스, 기존 driver, docs 수정 없음. 커밋·푸시 없음.

Root가 모든 source writer를 중지하고 동결한 뒤 고정 worktree의 `apps/cad-studio`에서 실행합니다. 재시도는 새 run 디렉터리로 첫 실패를 보존합니다.

```sh
D342_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' /Users/user/Library/pnpm/nodejs/22.19.0/bin/node test/offset-face-native-browser.mjs /tmp/d342-studio/run-01
```

게이트는 generation 전에 검사합니다. Chrome은1개이며 fresh context를 순서대로 만들고 닫습니다. Public Model API만 시드를 만듭니다. 작성 행위는 실제 UI만 사용합니다.

실제 선택과 편집:

- `Views` group의 `Top` 버튼을 누릅니다.
- 공개 native/document read에서 얻은 top-cap 중심을 기존 read-only `__studioScreenOf`로 투영합니다. 실제 `page.mouse.click`을 수행합니다. 실제 `__studioSelection.selection`의 body/face index가 관측한 현재 native/display identity와 일치해야 합니다.
- `__studioSelectFace`/`__studioPickFace` 등 mutation hook은 사용하지 않습니다.
- 실제 command palette에 `Offset face`를 입력하고 `Offset` 수치를 지정합니다. 기존 HUD preview/Apply/Cancel을 사용합니다.
- 기존 added extrusion의 History editor에서 `Distance`를3으로 바꾸고 기존 `Distance parameter` 컨트롤을 `offsetDistance`에 연결합니다. 이 parameter3은 원래 public seed에 있습니다. 새 geometry/binding 계약을 추가하지 않습니다.
- 원본 height parameter5와 모든 prefix node/reference는 그대로 유지해야 합니다. 새 profile은 owned snapshot이며 live association을 주장하지 않습니다.

시드와 흐름:

1. Fractional box20.00003×10×5 at[.1234567,-.2345678,.3456789], witness420 at[80,-3,1]. `height` binding5와 `offsetDistance` parameter3을 포함합니다.
2. 실제 top-face Offset+2 preview/Apply/Undo/Redo, native geometry 검증, Save/fresh Open, 실제 top-face 재선택을 수행합니다. Top과 Iso screenshot을 남깁니다.
3. 기존 added extrusion Distance3+기존 parameter binding 편집, Save/fresh Open, native recipe/refnames/field 재편집 확인을 수행합니다.
4. 원래 시드에서 Offset−1을 실제 수행하고 native geometry를 검사합니다.
5. Public API로 만든 drafted extrusion5°는 먼저 실제 source Distance5→6 편집으로 Undo marker를 만듭니다. 실제 cap Offset2는 preview refused/Apply disabled이어야 합니다. 현재 문서·선택 보존, Cancel, Undo가 직전 source edit를 복구하는지 확인합니다. 정상 fractional seed를 다시 열어 유효 Offset2를 재시도합니다.
6. Integer cylinderR3,H5 top+2를 실제 수행합니다. Native1solid/1shell 및 roundedπ·9·7 mass guide/centroid를 검사합니다. Exactπ 또는 generic curved qualification은 주장하지 않습니다.

Native 증거:

- 실제 saved/current StudioDoc를 공개 Part, partBreps, evaluateDoc, Core brepMassProperties/brepSurfaceArea/checkBrep 경로로 읽습니다. Native 전체 B-rep와 public/native face names를 별도 JSON으로 저장합니다. 검사 실패 전 raw reader stdout/stderr도 저장합니다.
- `brep.bodies`의 actual kind와 `brep.shells`를 세어1native solid/1closed shell을 검사합니다. 존재하지 않는 `solids` 필드를 추정하지 않습니다.
- 독립 Python oracle은 production import0입니다. 원본 actual stored native endpoints와 represented distance를 Fraction으로 계산합니다. Volume/centroid/bounds/area뿐 아니라 모든 native face의 boundary vertices와 surface control poles가 의도한6support plane 중 하나에 있어야 합니다. 이전 cap이 exposed ledge로 남으면 거절합니다. Zero-area/duplicate boundary face도 검사합니다.
- Coplanar provenance partition은 허용하므로8V12E6F를 가정하지 않습니다. Linear/mass 허용오차1e-7, total surface area1e-6입니다.
- Witness420, 중심[86,.5,3.5], key/native/public names는 모든 context에서 같아야 합니다. Offset body key는 실제 새 Boolean feature를 따라 기록합니다.

Sourcecapsule은 initial subset과 full bundle input 수를 구분합니다. 가상 stdin은 disk input에서 제외하고 정확한 source/hash를 저장합니다. Source watcher, runtime/console errors, downloads, failure screenshots와 cleanup 후 capsule을 보존합니다.

Receipt는 `NATIVE_NUMERIC_AND_ACTUAL_UI_FLOW`, `ROOT_MUST_VIEW_SCREENSHOTS`를 유지합니다. Numeric/native 성공은 root의 image 검토를 대신하지 않습니다. 다른 signed caps, repeated Offset closure, generic draft/curved support는 별도 focused-test 범위입니다.

## First-browser mass-proof amendment and lint fix

Driver source SHA256: `8887c714ae387c3c07c9c3a9022a3c659a5819d49671a9042cf22a5f746b991e`.

`node --check`: PASS. 새 oracle/pipeline/browser runtime은 NOT_RUN입니다. 이 hash로 제 source 수정을 종료했습니다. Narrow ESLint 재검사는 Model 담당에게 전달했습니다.

独립 Fraction box oracle는 같은 ORIGINAL native endpoint + represented distance 기대값에 대해 세 경로의 volume/centroid를 각각 검사합니다.

1. Native Core `brepMassProperties`.
2. 공개 `Part.body(actualKey).mass({density:1})`.
3. 실제 Studio `__studioBodies()`의 accepted Model mass.

Studio 경로는 fresh/massReady, actual native body key 하나, witness stable key 하나를 확인합니다. Native reader가 읽은 recipe hash와 현재 accepted recipe hash가 같아야 합니다. UI의 반올림된 표시 문자열이나 preview mesh 수치를 정밀도 oracle로 사용하지 않습니다. UI target/witness raw state와 native ref를 별도 파일·receipt에 남깁니다. 관찰 후 accepted recipe가 같아야 합니다.

이 검사는 Apply/Redo/fresh Open/reedit/final reopen/inward/retry의 모든 boxGeometry 호출에 적용합니다. Witness의 public Part와 실제 Studio mass도420/중심[86,.5,3.5]를 검사합니다.

Integer cylinder도 같은 rounded analyticπ·9·7 / 중심[0,0,3.5] guide를 Native Core/public Part/실제 Studio 경로에 각각 적용합니다. Exactπ certificate는 아닙니다.

Narrow lint의 unused `dismissNotice`를 삭제했습니다. 기존 `oldHeight`는 실제 Distance 값 변경을 확인하는 assertion에 사용합니다. 기존 console warning은 유지합니다. 다른 repo 파일 수정 없음.
