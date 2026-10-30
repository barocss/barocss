# D342 Offset Apply selection repair

Root가 보고한 run01 경계: native/public/Studio mass numeric PASS, 실제 flow FAIL. 성공 Apply에서 body order가 [targetb1,witnessb3]→[witnessb3,targetb6]로 바뀌었는데 이전 index selection0/5가 남아 witness를 선택했습니다. Run01 receipt/artifact는 수정하지 않았습니다. 이 문서는 후속 source 수정 기록입니다.

허가된 수정 파일:

- apps/cad-studio/src/App.tsx: 성공 Offset face의 commit(next)가 true를 반환한 직후, preview body publish 전에 setSelection(emptySel)를 호출합니다. 다른 명령의 selection 정책은 그대로입니다. Cancel/refusal은 이 줄에 도달하지 않습니다.
- 같은 apply 경로의 기존 Thicken/Sew captured commandDoc guard에 Offset face를 추가했습니다. 불일치 시 commit하지 않고 'Start Offset face again on the current body and face.'를 표시합니다. 기존 surfaces hint는 그대로입니다.
- apps/cad-studio/test/offset-face-native-browser.mjs: 모든 실제 Offset Apply 뒤 faces/edges/bodies/vertices가 비었는지 기존 read-only hook으로 검사합니다. actual body order에서 selected index를 key로 해석해 witness alias 여부도 기록합니다. Timeout 시에도 실제 selection/bodyOrder/selectedBodyKeys를 남깁니다. 기존 drafted refusal selection 보존 검사는 유지합니다. Undo/Redo는 exact recipe 증거이며 original face pick 복원을 주장하지 않는다는 범위를 receipt에 명시했습니다.

Source-bound 판단: commandDoc는 evaluated nodes/parameters/rollback + current direct sources로부터 useMemo로 생성합니다. Preview values/body upload 자체는 이 identity를 바꾸지 않습니다. 기존 qualified Thicken/Sew의 guard를 같은 위치에서 재사용할 수 있습니다. 이 판단은 source inspection이며 새 stale-state product 실행 증거는 아닙니다.

`node --check`: PASS. 새 App/types/build/lint/browser: NOT_RUN. Root가 관련 checks와 run02를 수행합니다. 조건을 복제하는 별도 unit test는 추가하지 않았습니다. 실제 driver postcondition이 회귀 검증입니다.

SHA256:

- App.tsx: fe299d25d6fe83b7063b6a9399162cdfa79bba22d6bb038b6edcc8bdbf215a69
- offset-face-native-browser.mjs: 2991a7f485f940fc7aa764c76ff43f64589687f8f25f573c54ee6fcf596d6d7d

정확한 diff는 selection-repair.diff에 저장했습니다. 제 source 수정은 위 hash로 종료했습니다. 다른 Model/Kernel/docs 파일은 수정하지 않았습니다. 커밋·푸시 없음.
