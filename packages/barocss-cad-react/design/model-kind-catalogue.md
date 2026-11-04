# All Model storage kinds: proposed React mapping

Source-only catalogue. Native declaration fields are quoted, not a JSON passthrough API. Structural and non-Model domains are in component-catalogue.md. Existing adapter evidence remains bounded; no new exports are created.

## Sketch/Profile family (`sketch`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:358`.
- State: PARTIAL. Output: profile.
- Native fields: `| ({ kind: 'sketch'; profile: 'rectangle'; min: [Dim, Dim]; max: [Dim, Dim] } & OnPlane)`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: Rectangle/Circle/Polygon expose three closed-profile producers in the current D504 adapter; loop/band, constraints, plane/face association and other SketchNode fields remain outside its React inputs. Polygon has selected width-60/80 pentagon native/Worker/Viewer/Studio evidence, not a general outline certificate.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Extrude (`extrude`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:383`.
- State: ADAPTER. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'extrude'; sketch: number; height: Dim; from?: Dim; draft?: number; made?: Made }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: Current Extrude/Revolve/Union/Difference/Translate/Rotate lower these existing nodes. Revolve adds selected rectangle/y-axis/omitted-origin 90/180/360 actual evidence; broader parameters remain outside physical qualification. Native limits and finite evidence remain separate.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Revolve (`revolve`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:385`.
- State: ADAPTER. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'revolve'; sketch: number; axis: 'x' | 'y'; origin?: [Dim, Dim]; angle: number; /** Any direction in the sketch plane (a picked edge), instead of its X or Y. */ dir?: [number, number]; made?: Made }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: Current Extrude/Revolve/Union/Difference/Translate/Rotate lower these existing nodes. Revolve adds selected rectangle/y-axis/omitted-origin 90/180/360 actual evidence; broader parameters remain outside physical qualification. Native limits and finite evidence remain separate.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Union (`union`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:400`.
- State: ADAPTER. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'union'; left: BodyRef; right: BodyRef; made?: Made }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: Current Extrude/Revolve/Union/Difference/Translate/Rotate lower these existing nodes. Revolve adds selected rectangle/y-axis/omitted-origin 90/180/360 actual evidence; broader parameters remain outside physical qualification. Native limits and finite evidence remain separate.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Difference (`difference`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:402`.
- State: ADAPTER. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'difference'; parent: BodyRef; tool: BodyRef; made?: Made }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: Current Extrude/Revolve/Union/Difference/Translate/Rotate lower these existing nodes. Revolve adds selected rectangle/y-axis/omitted-origin 90/180/360 actual evidence; broader parameters remain outside physical qualification. Native limits and finite evidence remain separate.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Translate (`translate`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:386`.
- State: ADAPTER. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'translate'; parent: BodyRef; offset: [Dim, Dim, Dim] }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: Current Extrude/Revolve/Union/Difference/Translate/Rotate lower these existing nodes. Revolve adds selected rectangle/y-axis/omitted-origin 90/180/360 actual evidence; broader parameters remain outside physical qualification. Native limits and finite evidence remain separate.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Rotate (`rotate`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:388`.
- State: ADAPTER. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'rotate'; parent: BodyRef; axis: Axis; angle: number; pivot?: [Dim, Dim, Dim]; made?: Made }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: Current Extrude/Revolve/Union/Difference/Translate/Rotate lower these existing nodes. Revolve adds selected rectangle/y-axis/omitted-origin 90/180/360 actual evidence; broader parameters remain outside physical qualification. Native limits and finite evidence remain separate.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Sweep (`sweep`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:410`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'sweep'; sketch: number; path: ({ kind: 'straight'; length: Dim } | { kind: 'bend'; radius: Dim; angle: number; toward: 'x' | '-x' | 'y' | '-y' })[] }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current component export. A bridge needs explicit profile/path/section/source/refusal contracts; existing backend is not missing.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## SweepCurve (`sweep-curve`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:412`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'sweep-curve'; sketch: number; name: string; path: { degree: number; knots: number[]; controlPoints: [number, number, number][]; weights: number[] }; routeBundleMember?: { bundleId: string; memberId: string } }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current component export. A bridge needs explicit profile/path/section/source/refusal contracts; existing backend is not missing.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Loft (`loft`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:415`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'loft'; sections: LoftSection[]; smooth?: boolean; from?: number[]; /** World-mm seam controls, copied on authoring and passed to the kernel unchanged. */ guide?: LoftInput['guide'] }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current component export. A bridge needs explicit profile/path/section/source/refusal contracts; existing backend is not missing.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Intersection (`intersect`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:401`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'intersect'; left: BodyRef; right: BodyRef }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current component export. Preserve existing output cardinality and body/reference identity before adding a bridge.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Mirror (`mirror`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:389`.
- State: UNEXPOSED. Output: resource/solid-set.
- Native fields: `| { kind: 'mirror'; parent: BodyRef; plane: 'xy' | 'xz' | 'yz' }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current component export. Preserve existing output cardinality and body/reference identity before adding a bridge.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Scale (`scale`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:391`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'scale'; parent: BodyRef; factor: number; pivot?: [Dim, Dim, Dim] }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current component export. Preserve existing output cardinality and body/reference identity before adding a bridge.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Split (`split`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:408`.
- State: UNEXPOSED. Output: resource/solid-set.
- Native fields: `| { kind: 'split'; parent: BodyRef; at: Dim; axis: Axis; normal?: [number, number, number] }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current component export. Preserve existing output cardinality and body/reference identity before adding a bridge.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Separate (`separate`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:652`.
- State: UNEXPOSED. Output: resource/solid-set.
- Native fields: `| { kind: 'separate'; parent: BodyRef }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current component export. Preserve existing output cardinality and body/reference identity before adding a bridge.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## LinearPattern (`linear-pattern`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:392`.
- State: UNEXPOSED. Output: resource/solid-set.
- Native fields: `| { kind: 'linear-pattern'; parent: BodyRef; axis: Axis; spacing: Dim; count: number }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current array/pattern component. Counts, placement, skipped occurrences and identity need a defined adapter contract.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## CircularPattern (`circular-pattern`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:399`.
- State: UNEXPOSED. Output: resource/solid-set.
- Native fields: `| { kind: 'circular-pattern'; parent: BodyRef; axis: Axis; angle: number; count: number; pivot?: [Dim, Dim, Dim]; /** Authored Z spread; absent on legacy patterns. */ span?: number }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current array/pattern component. Counts, placement, skipped occurrences and identity need a defined adapter contract.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## LinearFeaturePattern (`linear-feature-pattern`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:394`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'linear-feature-pattern'; parent: BodyRef; axis: Axis; spacing: Dim; count: number }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: Reference/selection-driven feature patterns require their own producer and ownership contract; existing typed refusal boundaries stay.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## FillFeaturePattern (`fill-feature-pattern`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:395`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'fill-feature-pattern'; parent: BodyRef; region: FillFeaturePatternRegion; anchor: readonly [number, number]; spacing: Dim; count: number; spacing2: Dim; count2: number }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: Reference/selection-driven feature patterns require their own producer and ownership contract; existing typed refusal boundaries stay.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## CurveFeaturePattern (`curve-feature-pattern`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:396`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'curve-feature-pattern'; parent: BodyRef; path: CurveFeaturePatternPath; spacing: Dim; count: number }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: Reference/selection-driven feature patterns require their own producer and ownership contract; existing typed refusal boundaries stay.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## RectangularFeaturePattern (`rectangular-feature-pattern`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:397`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'rectangular-feature-pattern'; parent: BodyRef; axis: Axis; spacing: Dim; count: number; axis2: Axis; spacing2: Dim; count2: number }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: Reference/selection-driven feature patterns require their own producer and ownership contract; existing typed refusal boundaries stay.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Thread (`thread`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:430`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'thread'; diameter: number; pitch: number; center: [number, number]; seat: number; length?: number; hex?: { across: number; height: number; internal?: true }; form?: 'helical' | 'faceted'; made?: Made }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No React selection-based finishing component. Edge/face source authority, rematch/refusal and current native support must be addressed; no fake handle/query is available.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Shell (`shell`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:432`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'shell'; parent: BodyRef; thickness: Dim; open: string[] }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No React selection-based finishing component. Edge/face source authority, rematch/refusal and current native support must be addressed; no fake handle/query is available.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Chamfer (`chamfer`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:434`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'chamfer'; parent: BodyRef; edges: string[]; distance: Dim }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No React selection-based finishing component. Edge/face source authority, rematch/refusal and current native support must be addressed; no fake handle/query is available.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Draft (`draft`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:639`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'draft'; parent: BodyRef; faces: string[]; angle: number; pull?: Axis | '-x' | '-y' | '-z'; neutral?: Dim }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No React selection-based finishing component. Edge/face source authority, rematch/refusal and current native support must be addressed; no fake handle/query is available.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## FullRound (`full-round`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:641`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'full-round'; parent: BodyRef; faces: string[]; along?: 'x' | 'y' }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No React selection-based finishing component. Edge/face source authority, rematch/refusal and current native support must be addressed; no fake handle/query is available.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## FaceFillet (`face-fillet`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:643`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'face-fillet'; parent: BodyRef; faces: [string, string]; radius: Dim }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No React selection-based finishing component. Edge/face source authority, rematch/refusal and current native support must be addressed; no fake handle/query is available.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## FaceThread (`face-thread`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:645`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'face-thread'; parent: BodyRef; face: string; pitch: number; diameter?: number; length?: number; end?: '+' | '-'; relief?: number; clearance?: number; hand?: 'left' }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No React selection-based finishing component. Edge/face source authority, rematch/refusal and current native support must be addressed; no fake handle/query is available.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## SplitFace (`split-face`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:647`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'split-face'; parent: BodyRef; face: string; pull: [number, number, number]; names?: string[] }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No React selection-based finishing component. Edge/face source authority, rematch/refusal and current native support must be addressed; no fake handle/query is available.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Fillet (`fillet`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:649`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'fillet'; parent: BodyRef; edges: string[]; radius: Dim; radii?: { at: [number, number, number]; radius: Dim; atEnd?: true }[]; section?: FilletSection }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No React selection-based finishing component. Edge/face source authority, rematch/refusal and current native support must be addressed; no fake handle/query is available.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Hole (`hole`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:660`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'hole'; parent: BodyRef; center: [Dim, Dim]; radius: Dim; axis?: Axis; side?: 'min' | 'max'; depth?: Dim; thread?: string; pattern?: HolePattern;`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No React selection-based finishing component. Edge/face source authority, rematch/refusal and current native support must be addressed; no fake handle/query is available.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Rib (`rib`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:404`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'rib'; parent: BodyRef; min: [Dim, Dim, Dim]; max: [Dim, Dim, Dim] }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current component or portable font/face-selection adapter. Backend/model declarations do not automatically expose these inputs.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## RectangularRelief (`rectangular-relief`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:406`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'rectangular-relief'; parent: BodyRef; min: [Dim, Dim]; max: [Dim, Dim]; depth: Dim; mode: 'emboss' | 'engrave' }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current component or portable font/face-selection adapter. Backend/model declarations do not automatically expose these inputs.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## TextSolid (`text`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:83`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `export interface TextNode { kind: 'text'; text: string; font: FontSource; size: Dim; height: Dim; tolerance: number; tracking?: Dim; plane?: DocPlane }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current component or portable font/face-selection adapter. Backend/model declarations do not automatically expose these inputs.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## TextRelief (`text-relief`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:85`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `export interface TextReliefNode { kind: 'text-relief'; parent: BodyRef; faces: [string]; text: string; font: FontSource; size: Dim; at: [Dim, Dim]; depth: Dim; mode: 'emboss' | 'engrave'; tolerance: number; tracking?: Dim }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current component or portable font/face-selection adapter. Backend/model declarations do not automatically expose these inputs.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## CylindricalWrap (`cylindrical-wrap`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:216`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `export interface CylindricalWrapNode { kind: 'cylindrical-wrap'; parent: BodyRef; faces: [string]; rectangle: { u: [number, number]; v: [number, number] }; height: Dim }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current component or portable font/face-selection adapter. Backend/model declarations do not automatically expose these inputs.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## StepImport (`import`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:418`.
- State: UNEXPOSED. Output: resource/solid-set.
- Native fields: `| { kind: 'import'; name: string; step: string; solids?: number }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No source-file/mesh/import component. File/blob ownership, IO, provenance and display-vs-native authority remain separate.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## MeshBody (`mesh`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:424`.
- State: UNEXPOSED. Output: resource/solid-set.
- Native fields: `| { kind: 'mesh'; name: string; unit: string; positions?: number[]; indices?: number[]; blob?: { positions: string; indices: string }; /** 'facets' (imports from F0 on): mesh regions; absent: one planar face per flat group, as before. */ representation?: 'facets'; /** A mesh in several closed pieces (facets only): each its own body, b<k>_part<j>. */ pieces?: number; /** Its repair (M3, D47): a recorded step over the original arrays, which stay. */ repair?: MeshRepairRecord; /** Where it crosses itself (not repaired; Booleans refuse it): how often, and up to 64 places. */ crossings?: { count: number; at: [number, number, number][] }; /** 'infill' (AM7b, O60): a print infill inside an exact body — in the mass and 3MF, left out of STEP. */ role?: 'infill' }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No source-file/mesh/import component. File/blob ownership, IO, provenance and display-vs-native authority remain separate.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Decimate (`decimate`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:658`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'decimate'; parent: BodyRef; ratio?: number; triangles?: number; maxError?: number; featureAngle?: number }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No source-file/mesh/import component. File/blob ownership, IO, provenance and display-vs-native authority remain separate.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## SheetBase (`sheet-base`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:441`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| ({ kind: 'sheet-base'; sketch: number; thickness: Dim; bendRadius: Dim; reverse?: boolean } & SheetK)`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current sheet component. Manufacturing and independently held workflows are not activated by a JSX adapter.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## SheetContour (`sheet-contour`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:442`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| ({ kind: 'sheet-contour'; path: [Dim, Dim][]; plane?: DocPlane; side: 'left' | 'right'; width: Dim; thickness: Dim; bendRadius: Dim } & SheetK)`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current sheet component. Manufacturing and independently held workflows are not activated by a JSX adapter.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## SheetCornerRelief (`sheet-corner-relief`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:448`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'sheet-corner-relief'; parent: BodyRef; edges: [string]; shape: 'square' | 'round'; size: Dim }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current sheet component. Manufacturing and independently held workflows are not activated by a JSX adapter.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## SheetFlange (`sheet-flange`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:449`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'sheet-flange'; parent: BodyRef; edges: [string]; length: Dim; angle?: number; bendRadius?: Dim; measure?: 'outer' | 'inner' | 'tangent'; position?: 'material-inside' | 'material-outside' | 'bend-outside'; offsets?: [Dim, Dim]; relief?: { kind: 'rectangular' | 'obround'; width: Dim; depth: Dim } | { kind: 'none' } }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current sheet component. Manufacturing and independently held workflows are not activated by a JSX adapter.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Skeleton (`skeleton`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:463`.
- State: UNEXPOSED. Output: datum-graph.
- Native fields: `| { kind: 'skeleton'; points: [Dim, Dim, Dim][]; segments: [number, number][]; name?: string; /** FRg (O122): its 3D constraints (frames/sketch3d.ts), a length's, distance's or angle's value a number or a parameter (O140); its points stored solved. */ constraints?: BoundConstraint3D[] }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current structural graph component. These existing Model records are not ordinary React wrapper functions.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Frame (`frame`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:468`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'frame'; follows?: FrameFollows; points: [Dim, Dim, Dim][]; segments: ModelFrameSegment[]; bends?: ModelFrameBend[]; section: MemberSection; anchor?: FrameAnchor; offset?: [Dim, Dim]; roll?: number; mirror?: boolean; up?: [number, number, number]; overrides?: FrameOverride[]; corners?: FrameCorners; trims?: FrameTrim[]; estimates?: string[] }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current structural graph component. These existing Model records are not ordinary React wrapper functions.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## FrameMember (`frame-member`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:469`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'frame-member'; section: MemberSection; start: [Dim, Dim, Dim]; end: [Dim, Dim, Dim]; anchor?: FrameAnchor; offset?: [Dim, Dim]; roll?: number; up?: [number, number, number]; estimates?: string[] }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current structural graph component. These existing Model records are not ordinary React wrapper functions.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## BandSurface (`band-surface`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:477`.
- State: UNEXPOSED / GATED. Output: surface.
- Native fields: `| { kind: 'band-surface'; version: 1; a: BandSide; b: BandSide; flip?: true }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current component. In particular #2258 public-thicken/fitter and #2266 widening remain held; this inventory releases neither gate.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Thicken (`thicken`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:478`.
- State: UNEXPOSED / GATED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'thicken'; name: string; surface: { degreeU: number; degreeV: number; knotsU: number[]; knotsV: number[]; controlPoints: [number, number, number][][]; weights: number[][] }; thickness: Dim; side?: 'normal' | 'reverse' | 'both' }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current component. In particular #2258 public-thicken/fitter and #2266 widening remain held; this inventory releases neither gate.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Subd (`subd`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:635`.
- State: UNEXPOSED / GATED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'subd'; name: string; cage: { positions: number[]; faces: number[][]; creases?: [number, number][] }; mirror?: 'x' | 'y' | 'z' }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current component. In particular #2258 public-thicken/fitter and #2266 widening remain held; this inventory releases neither gate.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Sew (`sew`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:637`.
- State: UNEXPOSED / GATED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'sew'; names: string[]; surfaces: { degreeU: number; degreeV: number; knotsU: number[]; knotsV: number[]; controlPoints: [number, number, number][][]; weights: number[][] }[]; tolerance?: number }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current component. In particular #2258 public-thicken/fitter and #2266 widening remain held; this inventory releases neither gate.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## LibraryPart (`library`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:501`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'library'; name: string; library: CadLibraryOrigin; prefix: string; features: CadPartFeature[]; outputs: string[]; interfaces: CadLibraryInterface[]; warnings: string[];`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Rack (`rack`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:510`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'rack'; module: Dim; teeth: number; faceWidth: Dim; height: Dim; thicknessReduction?: Dim; origin: [number, number]; angle?: number; from?: number; mesh?: RackMesh; generator: 'spur-rack@0' | 'spur-rack@1'; rootFillet?: Dim }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## InternalGear (`internal-gear`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:516`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'internal-gear'; module: Dim; helixAngle?: number; hand?: 'right' | 'left'; teeth: number; faceWidth: Dim; rim: Dim; profileShift?: number; thicknessReduction?: Dim; center: [number, number]; from?: number; rotation?: number; generator: 'internal-gear@0' | 'internal-gear@1';`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## BevelGear (`bevel-gear`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:529`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'bevel-gear'; module: Dim; teeth: number; mateTeeth: number; shaftAngle?: number; faceWidth: Dim; bore?: Dim; thicknessReduction?: Dim; center: [number, number]; from?: number; rotation?: number; mesh?: BevelMesh; generator: 'bevel-gear@0';`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## WormWheel (`worm-wheel`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:546`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'worm-wheel'; module: Dim; starts: number; diameter: Dim; hand: 'right' | 'left'; teeth: number; faceWidth: Dim; bore?: Dim; thicknessReduction?: Dim; center: [number, number]; from?: number; rotation?: number; generator: 'worm-wheel@0' }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Spring (`spring`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:556`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'spring'; type?: 'extension' | 'torsion'; wire: Dim; diameter: Dim; activeCoils: number; pitch?: Dim; freeLength?: Dim; hand: 'right' | 'left'; ends?: 'open' | 'closed' | 'closed-ground'; shearModulus?: number; shearModulusEstimate?: boolean; load?: number;`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Cam (`cam`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:566`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'cam'; follower: 'roller' | 'flat'; motion?: 'translating' | 'oscillating'; base: number; roller?: number; offset?: number; pivotDistance?: number; armLength?: number; faceOffset?: number;`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Sprocket (`sprocket`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:575`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'sprocket'; row: string; teeth: number; tip: number; width: number; seat?: number; bore?: number; center: [number, number]; from?: number; rotation?: number; generator: 'sprocket@0' }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Pulley (`pulley`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:576`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'pulley'; row: string; teeth?: number; diameter?: number; grooves?: number; width?: number; crown?: number; bore?: number; center: [number, number]; from?: number; rotation?: number; generator: 'pulley@0' }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Belt (`belt`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:577`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'belt'; row: string; wheels: [number, number]; rounding?: 'whole' | 'even'; generator: 'belt@0' }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Coupling (`coupling`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:578`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'coupling'; row: string; center: [number, number]; from?: number; rotation?: number; generator: 'coupling@0' }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Shaft (`shaft`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:584`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'shaft'; steps: { diameter: Dim; length: Dim; fillet?: number; undercut?: { width: number; depth: number }; grooves?: { diameter: number; width: number; at: number }[]; keyseats?: { width: number; depth: number; length: number; offset: number; ends?: 'square' | 'end-mill' | 'disc'; cutterRadius?: number; angle?: number }[] }[];`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## OringGland (`oring-gland`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:603`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'oring-gland'; parent: BodyRef; face: string; gland: 'piston' | 'rod' | 'face'; ring: string; diameter: number; width: number; at?: number; depth?: number; center?: [number, number, number]; seal?: number; sealClass?: string; grooveClass?: string }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Oring (`oring`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:604`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'oring'; gland: number }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## ConnectorOpening (`connector-opening`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:611`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'connector-opening'; parent: BodyRef; face: string; row: string; center: [number, number, number]; rotation?: number }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## ConnectorBody (`connector-body`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:612`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'connector-body'; opening: number }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Gusset (`gusset`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:619`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'gusset'; frame: number; point: number; members?: [number, number]; along?: 1 | -1; legs: [number, number]; thickness: number; clip?: number; offset?: number }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## EndCap (`end-cap`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:620`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'end-cap'; frame: number; member: number; end: 'start' | 'end'; fit: 'over' | 'inset'; thickness: number }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Bearing (`bearing`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:621`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'bearing'; row: string; shaft: number; step: number; against: 'start' | 'end'; housing?: number; housingRef?: BearingHousingRef; shaftClass?: string; housingClass?: string }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Key (`key`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:622`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'key'; shaft: number; keyseat: number; height: number; width?: number; length?: number; ends?: 'round' | 'square'; hub?: number }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Keyway (`keyway`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:623`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'keyway'; parent: BodyRef; face: string; width: number; depth: number; angle?: number }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## RetainingRing (`retaining-ring`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:624`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'retaining-ring'; shaft: number; groove: number; thickness: number; outerDiameter: number; /** The user's ring row it is checked against (O139); none: an estimate. */ row?: string }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Pin (`pin`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:625`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'pin'; shaft: number; hole: number; diameter?: number; length?: number; fit?: boolean }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Worm (`worm`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:626`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'worm'; starts: number; form: 'ZI' | 'ZA'; length: Dim; bore?: Dim; thicknessReduction?: Dim; mesh: BevelMesh; generator: 'worm@0' }`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.

## Gear (`gear`)

- Source: `packages/barocss-cad-model/src/engine/doc.ts:627`.
- State: UNEXPOSED. Output: solid (conditional on native admission).
- Native fields: `| { kind: 'gear';`
- React inputs: Use the typed native fields in declaration, replacing numeric sketch index with ProfileRef and BodyRef with SolidRef. Named edge/face lists require owner/version-bound selection refs, not strings or mesh indices. See catalogue family override.
- Boundary: No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries.
- Implementation: packages/barocss-cad-react/src/compiler.ts + components.tsx + index.ts; split new domain modules only when used
- Proof gap: Every unexposed entry requires types/compiler/real ReactDOM, existing native operation, current Worker/Viewer and returned Studio Open evidence before export is counted as delivered. Existing ADAPTER entries keep finite D495/D497/D499 scope.
