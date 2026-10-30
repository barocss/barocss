# D327 robot export/controller and inspector extraction

Status: source ready for main App integration and High source-only review. Types/lint/tests/native flows are **NOT_RUN by this worker**. No App, existing robot/kernel modules, runtime dependencies or lifecycle protocols were changed by this worker.

Fixed source `1266cdf24943acc5963bf5e346339e32c9f3da41` ranges are recorded in [contract.json](contract.json). `useRobotExports` owns joint-tree/readiness/link-inertia/link-mass calculations, the existing motion-error notice, world-placed identity part resolver/loop closures and URDF/MJCF/SDF/USD exports. `RobotInspector` consumes six domain props: controller, the existing useJoints return object, loop context, chosen motion result, video service and document-change guard/undo/dispatch service. No App type imports or cycle exist, and no dozens-of-callbacks UI protocol was invented.

App retains its original useJoints call position, subscriptions/stores, loop context, chosen-motion calculation, motion-contact effect, central dispatch refs and visible condition. Main integrates the hook before useJoints and uses the returned stable reportMotionError in the same call. The inspector receives the exact existing motion object, so it does not create a second motion hook or subscription.

Calculation memo dependencies, instance source readiness checks and identity placements stay as written. Original export refusal codes/messages, notes, robot.urdf/robot.xml/robot.sdf/USDA filenames, source sidecars and zip promise timing stay unchanged. The view's save/base guards still call canChangeDocument, pushUndo, setDoc and setDirty in their original order; rejected setDoc does not advance the selected motion. Existing waypoint/workspace/path/video handlers were copied without algorithm changes. Null-tree controller actions/view no-op only where the original App's panel condition already prevented invocation.

No new async ownership fix, motion support, geometry algorithm or unsupported export capability is claimed. Source-only review and later scoped root validation are separate from native/product proof. No heavy command, browser, test, commit or push was run by this worker.
