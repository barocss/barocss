export * from './types.js';
export { MAX_SAMPLES, validateCurve, validateSurface, validateModel, curveDomain, surfaceDomain, evaluateCurve, evaluateSurface, sampleCurve, sampleSurface } from './math.js';
export * from './iges.js';
export * from './packet.js';
export * from './preview.js';
export * from './extrusion.js';
export * from './derivatives.js';
export * from './boundary.js';
export * from './face.js';
export * from './adjacency.js';
export * from './orthogonal-adjacency.js';
export * from './box-shell.js';
export * from './box-solid.js';

export { compileCadModel } from './model-compiler.js';
export type { CadCompileOptions, CadCompileResult, CadDiagnostic, CadModelIR, CadModelAst, CadSourceRange } from './model-compiler.js';
export type { SourceSpan, ExtrusionConstruction } from './construction-types.js';
export type { CadModelIR1, CadModelIR2, CadResolvedParameter, CadFieldBinding, CadQuantityKind, CadParameterDependency } from './model-compiler.js';
export type { CadExpression } from './model-compiler.js';
export { buildXYProfile } from './xy-profile.js';
export type { XYPoint, XYProfileRequest, XYProfileReport, XYProfileResult } from './xy-profile.js';
export { buildXYArc } from './xy-arc.js';
export type { XYArcRequest, XYArcReport, XYArcResult } from './xy-arc.js';
export { buildAxisRectangleExtrusion } from './axis-rectangle-extrusion.js';
export type { AxisRectangleExtrusionRequest, AxisRectangleExtrusionConstruction, AxisRectangleExtrusionResult } from './axis-rectangle-extrusion.js';
export { evaluateAxisRectangleFeatureDocument, editAxisRectangleFeatureDocument, serializeAxisRectangleFeatureDocument } from './axis-rectangle-feature-document.js';
export type { AxisRectangleFeatureDocumentV0, AxisRectangleFeatureDocumentResult, AxisRectangleParameterEdit } from './axis-rectangle-feature-document.js';
export { solveXYLinearSketch } from './xy-linear-sketch.js';
export type { XYLinearSketchDocumentV0, XYLinearSketchResult, XYLinearSketchConstraint, XYLinearSketchDiagnostic } from './xy-linear-sketch.js';
export type { XYLinearSketchDocumentV1, XYLinearSketchConstraintV1, XYLinearSketchResultV1, XYLinearSketchDimensionReport } from './xy-linear-sketch.js';
export { buildXYPolygonRegion, validateXYPolygonRegion } from './xy-polygon-region.js';
export type { XYPolygonRegionRequest, XYPolygonRegionResult, XYPolygonRegionReport } from './xy-polygon-region.js';
export { tessellateXYPolygonRegion } from './xy-polygon-preview.js';
export type { XYPolygonPreviewOptions, XYPolygonPreviewVertexSource, XYPolygonPreviewReport, XYPolygonPreviewResult } from './xy-polygon-preview.js';
export { buildXYPolygonPrismPreview } from './xy-polygon-prism-preview.js';
export type { XYPolygonPrismPreviewRequest, XYPolygonPrismPreviewConstruction, XYPolygonPrismPreviewRole, XYPolygonPrismPreviewReport, XYPolygonPrismPreviewResult } from './xy-polygon-prism-preview.js';
export { evaluateXYPolygonPrismDocument, updateXYPolygonPrismDocument, serializeXYPolygonPrismDocument, parseXYPolygonPrismDocument } from './xy-polygon-prism-document.js';
export type { XYPolygonPrismDocumentV0, XYPolygonPrismDocumentOptions, XYPolygonPrismDocumentUpdate, XYPolygonPrismDocumentEvaluation, XYPolygonPrismDocumentResult } from './xy-polygon-prism-document.js';
export { buildXYPolygonPlanarFace, validateXYPolygonPlanarFaceBundle, classifyXYPolygonPlanarFacePoint } from './xy-polygon-planar-face.js';
export type { XYPolygonPlanarFaceOptions, XYPolygonPlanarFaceBundle, XYPolygonPlanarFaceReport, XYPolygonPlanarFaceResult, XYPolygonPlanarFacePointResult } from './xy-polygon-planar-face.js';
export { buildXYPolygonPrismShell, validateXYPolygonPrismShell } from './xy-polygon-prism-shell.js';
export type { XYPolygonPrismShellOptions, XYPolygonPrismShell, XYPolygonPrismShellReport, XYPolygonPrismShellResult, XYPolygonPrismCapFace, XYPolygonPrismLateralFace, XYPolygonPrismQualifiedUse } from './xy-polygon-prism-shell.js';
export { tessellateXYPolygonPrismShell } from './xy-polygon-prism-shell-preview.js';
export type { XYPolygonPrismShellPreviewOptions, XYPolygonPrismShellFaceRange, XYPolygonPrismShellEdgePath, XYPolygonPrismShellEdgeProvenance, XYPolygonPrismShellPreviewReport, XYPolygonPrismShellPreviewResult } from './xy-polygon-prism-shell-preview.js';
export { queryXYPolygonPrismShellRay } from './xy-polygon-prism-ray-query.js';
export type { XYPolygonPrismShellRayQueryOptions, XYPolygonPrismShellRayHit, XYPolygonPrismShellCoplanarFace, XYPolygonPrismShellRayQueryReport, XYPolygonPrismShellRayQueryResult } from './xy-polygon-prism-ray-query.js';
export { buildXYPolygonPlanarFaceWithHole, validateXYPolygonPlanarFaceWithHoleBundle, classifyXYPolygonPlanarFaceWithHolePoint } from './xy-polygon-planar-face-hole.js';
export type { XYPolygonPlanarFaceWithHoleOptions, XYPolygonPlanarFaceWithHoleBundle, XYPolygonPlanarFaceWithHoleReport, XYPolygonPlanarFaceWithHoleResult, XYPolygonPlanarFaceWithHolePointResult } from './xy-polygon-planar-face-hole.js';
export { tessellateXYPolygonPlanarFaceWithHole } from './xy-polygon-planar-face-hole-preview.js';
export type { XYPolygonHoleFacePreviewOptions, XYPolygonHoleRational, XYPolygonHolePreviewCorner, XYPolygonHolePreviewSlab, XYPolygonHolePreviewEdgeProvenance, XYPolygonHoleFacePreviewReport, XYPolygonHoleFacePreviewResult } from './xy-polygon-planar-face-hole-preview.js';
export { buildXYPolygonPrismShellWithHole, validateXYPolygonPrismShellWithHole } from './xy-polygon-prism-shell-hole.js';
export type { XYPolygonPrismShellWithHoleOptions, XYPolygonPrismShellWithHole, XYPolygonPrismShellWithHoleReport, XYPolygonPrismShellWithHoleResult, XYPolygonPrismHoleCapFace, XYPolygonPrismHoleWallFace } from './xy-polygon-prism-shell-hole.js';
export { tessellateXYPolygonPrismShellWithHole } from './xy-polygon-prism-shell-hole-preview.js';
export type { XYPolygonPrismHoleShellPreviewOptions, XYPolygonPrismHoleShellFaceRange, XYPolygonPrismHoleShellEdgePath, XYPolygonPrismHoleShellEdgeProvenance, XYPolygonPrismHoleShellPreviewReport, XYPolygonPrismHoleShellPreviewResult } from './xy-polygon-prism-shell-hole-preview.js';
export { evaluateXYPolygonPrismHoleDocument, updateXYPolygonPrismHoleDocument, serializeXYPolygonPrismHoleDocument, parseXYPolygonPrismHoleDocument } from './xy-polygon-prism-hole-document.js';
export type { XYPolygonPrismHoleDocumentV0, XYPolygonPrismHoleDocumentOptions, XYPolygonPrismHoleDocumentUpdate, XYPolygonPrismHoleDocumentEvaluation, XYPolygonPrismHoleDocumentReport, XYPolygonPrismHoleDocumentResult } from './xy-polygon-prism-hole-document.js';
export { queryXYPolygonPrismShellWithHoleRay } from './xy-polygon-prism-shell-hole-ray-query.js';
export type { XYPolygonPrismHoleShellRayQueryOptions, XYPolygonPrismHoleShellRayFaceRole, XYPolygonPrismHoleShellRayEdgeReference, XYPolygonPrismHoleShellRayHit, XYPolygonPrismHoleShellCoplanarFace, XYPolygonPrismHoleShellRayQueryReport, XYPolygonPrismHoleShellRayQueryResult } from './xy-polygon-prism-shell-hole-ray-query.js';
export { evaluateXYSketchDocument, updateXYSketchDocument, serializeXYSketchDocument, parseXYSketchDocument } from './xy-sketch-document.js';
export type { XYSketchAuthoredPoint, XYSketchProfileIntent, XYSketchDocumentV0, XYSketchDocumentEdit, XYSketchPointBinding, XYSketchEvaluatedProfile, XYSketchDocumentReport, XYSketchDocumentResult } from './xy-sketch-document.js';

export { evaluateWorkplaneSketchDocument, updateWorkplaneSketchDocument, validateWorkplaneSketchDocument, serializeWorkplaneSketchDocument, parseWorkplaneSketchDocument, WorkplaneSketchDocumentError, WorkplaneSketchDocumentDiagnosticCode } from './workplane-sketch-document.js';
export type { WorkplaneSketchFrame, WorkplaneSketchDocumentV0, WorkplaneSketchDocumentEdit, WorkplaneSketchDocumentReport, WorkplaneSketchDocumentResult } from './workplane-sketch-document.js';
export { evaluateXYArcSketchDocument, updateXYArcSketchDocument, serializeXYArcSketchDocument, parseXYArcSketchDocument } from './xy-arc-sketch-document.js';
export type { XYArcSketchRadius, XYArcSketchProfileIntent, XYArcSketchDocumentV0, XYArcSketchDocumentEdit, XYArcSketchCurvePointBinding, XYArcSketchBindings, XYArcSketchEvaluatedProfile, XYArcSketchDocumentReport, XYArcSketchDocumentResult } from './xy-arc-sketch-document.js';
export { buildXYCirclePlanarFace, validateXYCirclePlanarFaceBundle, classifyXYCirclePlanarFacePoint } from './xy-circle-planar-face.js';
export type { XYCircleFaceProfile, XYCirclePlanarFaceOptions, XYCirclePlanarFaceBundle, XYCirclePlanarFaceReport, XYCirclePlanarFaceResult, XYCirclePlanarFacePointResult } from './xy-circle-planar-face.js';
export { tessellateXYCirclePlanarFace } from './xy-circle-planar-face-preview.js';
export type { XYCirclePlanarFacePreviewOptions, XYCirclePlanarFaceEdgePath, XYCirclePlanarFaceEdgeProvenance, XYCirclePlanarFacePreviewReport, XYCirclePlanarFacePreviewResult } from './xy-circle-planar-face-preview.js';
export { buildXYCirclePrismShell, validateXYCirclePrismShellBundle } from './xy-circle-prism-shell.js';
export type { XYCirclePrismShellOptions, XYCirclePrismShellUse, XYCirclePrismShellBundle, XYCirclePrismShellReport, XYCirclePrismShellResult } from './xy-circle-prism-shell.js';
export { tessellateXYCirclePrismShell } from './xy-circle-prism-shell-preview.js';
export type { XYCirclePrismShellPreviewOptions, XYCirclePrismWallPanel, XYCirclePrismShellFaceRange, XYCirclePrismShellEdgePath, XYCirclePrismShellEdgeProvenance, XYCirclePrismShellPreviewReport, XYCirclePrismShellPreviewResult } from './xy-circle-prism-shell-preview.js';
export { evaluateXYCirclePrismDocument, updateXYCirclePrismDocument, serializeXYCirclePrismDocument, parseXYCirclePrismDocument } from './xy-circle-prism-document.js';
export type { XYCirclePrismDocumentV0, XYCirclePrismDocumentPatch, XYCirclePrismDocumentReport, XYCirclePrismDocumentResult } from './xy-circle-prism-document.js';
export { evaluateSketchCircleFeatureGraph, updateSketchCircleFeatureGraph, editSketchCircleFeatureGraphFeatures, editSketchCircleFeatureGraphParameters, serializeSketchCircleFeatureGraph, parseSketchCircleFeatureGraph } from './sketch-circle-feature-graph.js';
export type { SketchCircleLengthDefinition, SketchCircleLengthParameter, SketchCircleGraphFeature, SketchCircleFeatureGraphV0, SketchCircleFeatureGraphEdits, SketchCircleFeatureOperation, SketchCircleFeatureLifecycleEdits, SketchCircleParameterOperation, SketchCircleParameterLifecycleEdits, SketchCircleResolvedParameter, SketchCircleFeatureBindings, SketchCircleEvaluatedFeature, SketchCircleFeatureGraphReport, SketchCircleFeatureGraphResult } from './sketch-circle-feature-graph.js';
export { evaluateSketchRectangleFeatureGraph, updateSketchRectangleFeatureGraph, editSketchRectangleFeatureGraphFeatures, editSketchRectangleFeatureGraphParameters, serializeSketchRectangleFeatureGraph, parseSketchRectangleFeatureGraph } from './sketch-rectangle-feature-graph.js';
export type { SketchRectangleLengthDefinition, SketchRectangleLengthParameter, SketchRectangleGraphFeature, SketchRectangleFeatureGraphV0, SketchRectangleFeatureGraphEdits, SketchRectangleFeatureOperation, SketchRectangleFeatureLifecycleEdits, SketchRectangleParameterOperation, SketchRectangleParameterLifecycleEdits, SketchRectangleResolvedParameter, SketchRectangleFeatureBindings, SketchRectangleEvaluatedFeature, SketchRectangleFeatureGraphReport, SketchRectangleFeatureGraphResult } from './sketch-rectangle-feature-graph.js';
export { evaluateDrivenSketchCircleFeatureGraph, updateDrivenSketchCircleFeatureGraph, editDrivenSketchCircleFeatureGraphParameters, editDrivenSketchCircleFeatureGraphProfiles, serializeDrivenSketchCircleFeatureGraph, parseDrivenSketchCircleFeatureGraph } from './driven-sketch-circle-feature-graph.js';
export type { DrivenCircleRadiusDefinition, DrivenXYArcProfileIntent, DrivenXYArcSketchDocumentV0, DrivenSketchCircleFeatureGraphV1, DrivenSketchCircleFeatureGraphEdits, DrivenSketchCircleParameterLifecycleEdits, DrivenSketchCircleProfileOperation, DrivenSketchCircleProfileLifecycleEdits, DrivenCircleProfileDimension, DrivenCircleRadiusBindings, DrivenSketchCircleFeatureGraphReport, DrivenSketchCircleFeatureGraphResult } from './driven-sketch-circle-feature-graph.js';
export { buildZAxisRevolvedSurface } from './z-axis-revolved-surface.js';
export type { ZAxisRevolvedSurfaceOptions, ZAxisRevolvedSurfaceConstruction, ZAxisRevolveBoundaryObservation, ZAxisRevolvedSurfaceReport, ZAxisRevolvedSurfaceResult } from './z-axis-revolved-surface.js';
export { evaluateZAxisRevolveFeatureDocument, updateZAxisRevolveFeatureDocument, serializeZAxisRevolveFeatureDocument, parseZAxisRevolveFeatureDocument } from './z-axis-revolve-document.js';
export type { ZAxisRevolveFeatureDocumentV0, ZAxisRevolvePoleEdit, ZAxisRevolveFeatureDocumentEdits, ZAxisRevolveFeatureDocumentReport, ZAxisRevolveFeatureDocumentResult } from './z-axis-revolve-document.js';
export { tessellateZAxisRevolvedSurface } from './z-axis-revolve-preview.js';
export type { ZAxisRevolvePreviewOptions, ZAxisRevolvePreviewPanel, ZAxisRevolveBoundaryRole, ZAxisRevolveBoundaryPath, ZAxisRevolveBoundaryProvenance, ZAxisRevolvePreviewReport, ZAxisRevolvePreviewResult } from './z-axis-revolve-preview.js';
export { buildCompatibleRuledSurface } from './compatible-ruled-surface.js';
export type { CompatibleRuledSurfaceOptions, CompatibleRuledSurfaceConstruction, CompatibleRuledSurfaceObservation, CompatibleRuledSurfaceReport, CompatibleRuledSurfaceResult } from './compatible-ruled-surface.js';
export { insertCurveKnot } from './curve-knot-insertion.js';
export type { CurveKnotInsertionOptions, CurveKnotUnchangedPole, CurveKnotUnchangedKnot, CurveKnotInsertionStep, CurveKnotInsertionProvenance, CurveKnotInsertionReport, CurveKnotInsertionResult } from './curve-knot-insertion.js';
export { editSurfaceControlNet } from './surface-control-net.js';
export type { SurfacePoleField, SurfacePoleEdit, SurfaceControlNetEdits, SurfacePoleEditProvenance, SurfaceControlNetReport, SurfaceControlNetResult } from './surface-control-net.js';
export { insertSurfaceKnot } from './surface-knot-insertion.js';
export type { SurfaceKnotInsertionOptions, SurfaceKnotUnchangedPole, SurfaceKnotInsertionStrip, SurfaceKnotInsertionProvenance, SurfaceKnotGridCount, SurfaceKnotInsertionReport, SurfaceKnotInsertionResult } from './surface-knot-insertion.js';
export { extractSurfaceIsoCurve } from './surface-isocurve.js';
export type { SurfaceIsoCurveOptions, SurfaceIsoCurveBasis, SurfaceIsoCurveContribution, SurfaceIsoCurvePole, SurfaceIsoCurveProvenance, SurfaceIsoCurveReport, SurfaceIsoCurveResult } from './surface-isocurve.js';
export { splitSurfaceAtParameter } from './surface-parameter-split.js';
export type { SurfaceParameterSplitOptions, SurfaceSplitPoleMapping, SurfaceSplitKnotMapping, SurfaceSplitChildProvenance, SurfaceSplitRefinementProvenance, SurfaceSplitSharedCoefficients, SurfaceParameterSplitProvenance, SurfaceParameterSplitReport, SurfaceParameterSplitResult } from './surface-parameter-split.js';
export { splitCurveAtParameter } from './curve-parameter-split.js';
export type { CurveParameterSplitOptions, CurveSplitPoleMapping, CurveSplitKnotMapping, CurveSplitChildProvenance, CurveSplitRefinementProvenance, CurveSplitSharedCoefficient, CurveParameterSplitProvenance, CurveParameterSplitReport, CurveParameterSplitResult } from './curve-parameter-split.js';
export { editCurveControlPolygon } from './curve-control-polygon.js';
export type { CurvePoleField, CurvePoleEdit, CurveControlPolygonEdits, CurvePoleEditProvenance, CurveControlPolygonD1Evaluation, CurveControlPolygonD1Observation, CurveControlPolygonReport, CurveControlPolygonResult } from './curve-control-polygon.js';
export { elevateBezierCurveDegree } from './bezier-curve-degree-elevation.js';
export type { BezierCurveDegreeElevationOptions, BezierCurveElevatedInteriorPole, BezierCurveElevationKnot, BezierCurveDegreeElevationProvenance, BezierCurveDegreeD1Evaluation, BezierCurveDegreeD1Observation, BezierCurveDegreeElevationReport, BezierCurveDegreeElevationResult } from './bezier-curve-degree-elevation.js';
export { elevateSurfaceBezierAxisDegree } from './surface-bezier-axis-degree-elevation.js';
export type { SurfaceBezierAxisDegreeElevationOptions, SurfaceBezierAxisEndpointMapping, SurfaceBezierAxisDegreeStrip, SurfaceBezierAxisDegreeElevationProvenance, SurfaceBezierAxisD1Evaluation, SurfaceBezierAxisD1Observation, SurfaceBezierAxisDegreeElevationReport, SurfaceBezierAxisDegreeElevationResult } from './surface-bezier-axis-degree-elevation.js';
export { buildRationalRuledSurface } from './rational-ruled-surface.js';
export type { RationalRuledSurfaceOptions, RationalRuledSurfaceConstruction, RationalRuledSurfaceObservation, RationalRuledCurveD1Evaluation, RationalRuledSurfaceD1Evaluation, RationalRuledSurfaceD1Observation, RationalRuledSurfaceReport, RationalRuledSurfaceResult } from './rational-ruled-surface.js';
export { buildDegreeMatchedBezierRuledSurface } from './degree-matched-bezier-ruled.js';
export type { DegreeMatchedBezierRuledOptions, DegreeMatchedBezierSectionProvenance, DegreeMatchedBezierRuledProvenance, DegreeMatchedBezierPointObservation, DegreeMatchedBezierD1Evaluation, DegreeMatchedBezierD1Observation, DegreeMatchedBezierSectionReport, DegreeMatchedBezierRuledReport, DegreeMatchedBezierRuledResult } from './degree-matched-bezier-ruled.js';
export { buildOwnPlateCircularHole, validateOwnPlateCircularHoleBundle } from './own-plate-circular-hole.js';
export type { OwnPlateCircularHoleRequest, OwnPlateCircularHoleUse, OwnPlateCircularHoleLoop, OwnPlateCircularHoleFace, OwnPlateCircularHoleEdge, OwnPlateCircularHoleBundle, OwnPlateCircularHoleReport, OwnPlateCircularHoleResult } from './own-plate-circular-hole.js';
export { tessellateOwnPlateCircularHole, validateOwnNativeFaceMesh, validateOwnPlateHolePreviewContext } from './own-plate-circular-hole-preview.js';
export type { OwnPlateHolePreviewContext, OwnPlateHolePreviewOptions, OwnPlateHolePreviewFaceProvenance, OwnPlateHolePreviewReport, OwnPlateHolePreviewResult, OwnNativeFaceMesh, OwnNativeFaceMeshChunk } from './own-plate-circular-hole-preview.js';
export { intersectXYCirclePrismWallWithPlane, validateXYCirclePrismPlaneIntersection } from './own-plane-cylinder-intersection.js';
export type { XYCirclePrismPlaneIntersectionOptions, XYCirclePrismPlaneBindings, PlaneCylinderCurveD1State, PlaneCylinderSurfaceD1State, PlaneCylinderIntersectionObservation, PlaneCylinderHomogeneousSpan, XYCirclePrismPlaneIntersectionReport, XYCirclePrismPlaneSection, XYCirclePrismPlaneDisjoint, XYCirclePrismPlaneIntersectionResult } from './own-plane-cylinder-intersection.js';
export { intersectFiniteXYCirclePrismWallWithPlane, validateFiniteXYCirclePrismPlaneIntersection } from './own-plane-cylinder-clipped.js';
export type { FinitePlaneCylinderEquation, FinitePlaneCylinderBoundaryEvent, FinitePlaneCylinderEndpointApproximation, FinitePlaneCylinderPiece, FiniteXYCirclePrismPlaneIntersectionReport, FiniteXYCirclePrismPlaneIntersectionResult } from './own-plane-cylinder-clipped.js';
export type { FinitePlaneCylinderOriginalDerivativeGuard } from './own-plane-cylinder-clipped.js';
export { intersectBezierCurveWithAffinePlaneSurface, validateBezierCurveAffinePlaneIntersection } from './own-curve-plane-intersection.js';
export type { BezierCurveAffinePlaneIntersectionOptions, BezierCurveAffinePlaneIntersectionReport, BezierCurveAffinePlaneIntersectionResult, BezierCurvePlanePointEvent, CurveAffinePlaneAxes, CurvePlaneD1State } from './own-curve-plane-intersection.js';
export { intersectCurveWithAffinePlaneSurface, validateCurveAffinePlaneIntersection } from './own-multispan-curve-plane.js';
export { intersectCurveWideWithAffinePlaneSurface, validateWideCurveAffinePlaneIntersection, WideCurveAffinePlaneIntersectionError, WideCurveAffinePlaneIntersectionDiagnosticCode } from './curve-wide-plane-intersection.js';
export type { WideCurveAffinePlaneIntersectionOptions, WideCurveAffinePlaneIntersectionReport, WideCurveAffinePlaneIntersectionResult } from './curve-wide-plane-intersection.js';
export type { CurveAffinePlaneIntersectionOptions, CurveAffinePlaneSpan, CurvePlaneSpanContribution, CurvePlaneSideObservation, CurvePlanePointEvent, CurveAffinePlaneIntersectionReport, CurveAffinePlaneIntersectionResult } from './own-multispan-curve-plane.js';
export { clipCurvePlaneCoincidentIntervals, validateCurvePlaneCoincidentClip } from './own-coincident-plane-clip.js';
export type { PlaneClipBoundary, CurvePlaneCoincidentClipOptions, PlaneClipBoundaryContribution, PlaneClipContact, PlaneClipSpan, PlaneClipEndpointApproximation, PlaneClipBindingObservation, PlaneClipUVSplitProvenance, PlaneClipPiece, CurvePlaneCoincidentClipReport, CurvePlaneCoincidentClipResult } from './own-coincident-plane-clip.js';
export { intersectCoplanarCurveWithLineSegment, validateCoplanarCurveLineIntersection } from './own-curve-line-intersection.js';
export type { CoplanarCurveLineIntersectionOptions, CurveLineUVSplitProvenance, CurveLineRootContribution, CurveLineBinding, CurveLineSideObservation, CurveLinePointEvent, CurveLineBoundaryContribution, CurveLineOverlapContact, CurveLineSpan, CurveLineEndpointApproximation, CurveLineOverlapObservation, CurveLineOverlapPiece, CoplanarCurveLineIntersectionReport, CoplanarCurveLineIntersectionResult } from './own-curve-line-intersection.js';
export { clipCurveWithConvexLineLoop, validateConvexLineLoopClip } from './own-convex-loop-clip.js';
export type { ConvexNativeLineLoop, ConvexLineLoopClipOptions, ConvexLoopUVSplitProvenance, ConvexLoopContactContribution, ConvexLoopClipContact, ConvexLoopClipSpan, ConvexLoopEndpointApproximation, ConvexLoopBoundaryBinding, ConvexLoopPieceObservation, ConvexLoopClipPiece, ConvexLineLoopClipReport, ConvexLineLoopClipResult } from './own-convex-loop-clip.js';
export { buildConvexPlanarFace, validateConvexPlanarFace, classifyConvexPlanarFaceUV } from './own-convex-planar-face.js';
export type { ConvexPlanarFaceLoop, ConvexPlanarFaceOptions, ConvexPlanarFaceVertex, ConvexPlanarFaceEdge, ConvexPlanarFaceUse, ConvexPlanarFaceTopology, ConvexPlanarFacePcurve, ConvexPlanarFaceBinding, ConvexPlanarFaceReport, ConvexPlanarFaceResult, ConvexPlanarFaceBoundaryClassification, ConvexPlanarFaceUVClassification } from './own-convex-planar-face.js';
export { intersectConvexPlanarFaces, validateConvexPlanarFaceIntersection } from './own-convex-planar-face-intersection.js';
export type { ConvexPlanarFaceIntersectionOptions, ConvexFaceSupportUVMap, ConvexFaceIntersectionConstraint, ConvexFaceIntersectionContributor, ConvexFaceIntersectionEndpoint, ConvexFaceIntersectionBinding, ConvexFaceIntersectionSegment, ConvexFaceIntersectionPoint, ConvexPlanarFaceIntersectionReport, ConvexPlanarFaceIntersectionResult } from './own-convex-planar-face-intersection.js';
export { buildConvexPlanarFaceWithHoles, validateConvexPlanarFaceWithHoles, classifyConvexPlanarFaceWithHolesUV } from './own-convex-planar-face-holes.js';
export type { ConvexPlanarFaceWithHolesLoop, ConvexPlanarFaceWithHolesOptions, ConvexPlanarLoopRole, ConvexPlanarHoleVertex, ConvexPlanarHoleEdge, ConvexPlanarHoleUse, ConvexPlanarHolePcurve, ConvexPlanarHoleBinding, ConvexPlanarFaceHoleTopology, ConvexHoleContainmentEvidence, ConvexHolesSeparationEvidence, ConvexPlanarFaceWithHolesReport, ConvexPlanarFaceWithHolesResult, ConvexPlanarHoleBoundaryClassification, ConvexPlanarFaceWithHolesUVClassification } from './own-convex-planar-face-holes.js';
export { intersectConvexPlanarFacesWithHoles, validateConvexPlanarFaceWithHolesIntersection } from './own-convex-planar-face-holes-intersection.js';
export type { ConvexPlanarFaceWithHolesIntersectionOptions, HoleFaceIntersectionConstraint, HoleFaceLoopInterval, HoleFaceExcludedInterval, HoleFaceExcludedUnion, HoleFacePointObservation, HoleFaceIntersectionContributor, HoleFaceIntersectionEndpoint, HoleFaceIntersectionSegment, HoleFaceIntersectionPoint, HoleFaceBoundaryContact, ConvexPlanarFaceWithHolesIntersectionReport, ConvexPlanarFaceWithHolesIntersectionResult } from './own-convex-planar-face-holes-intersection.js';
export { tessellateConvexPlanarFaceWithHoles, validateConvexPlanarFaceWithHolesMesh } from './own-convex-planar-face-holes-preview.js';
export type { ConvexHoleMeshVertex, ConvexHoleMeshBoundaryPath, ConvexHoleMeshEdgeUse, ConvexHoleMeshTriangulation, ConvexPlanarFaceWithHolesMeshReport, ConvexPlanarFaceWithHolesMeshResult } from './own-convex-planar-face-holes-preview.js';
export { queryConvexPlanarFaceWithHolesRay, validateConvexPlanarFaceWithHolesRay } from './own-convex-planar-face-holes-ray.js';
export type { ConvexPlanarFaceWithHolesRayQuery, ConvexPlanarFaceWithHolesRayPolicy, ConvexPlanarFaceWithHolesRaySupport, ConvexPlanarFaceWithHolesRayCandidate, ConvexPlanarFaceWithHolesRayBoundary, ConvexPlanarFaceWithHolesRayHit, ConvexPlanarFaceWithHolesRayStatus, ConvexPlanarFaceWithHolesRayReason, ConvexPlanarFaceWithHolesRayReport, ConvexPlanarFaceWithHolesRayResult } from './own-convex-planar-face-holes-ray.js';
export { sampleCurveAdaptive, validateAdaptiveCurveSamples } from './curve-adaptive-sampling.js';
export type { AdaptiveCurveSamplingOptions, AdaptiveCurveSample, AdaptiveCurveObservation, AdaptiveCurveSegment, AdaptiveCurveSplitOperation, AdaptiveCurveSamplingReport, AdaptiveCurveSamplingResult } from './curve-adaptive-sampling.js';
export { joinCurves, validateJoinedCurveResult } from './curve-join.js';
export type { CurveJoinOptions, CurveJoinD1State, CurveJoinKnotMapping, CurveJoinProvenance, CurveJoinObservation, JoinedCurveReport, JoinedCurveResult } from './curve-join.js';
export { reverseCurve, validateReversedCurveResult, CurveReversalError } from './curve-reversal.js';
export { CurveReversalDiagnosticCode } from './curve-reversal.js';
export type { CurveReversalOptions, CurveReversalD1State, CurveReversalKnotMapping, CurveReversalProvenance, CurveReversalObservation, CurveReversalGuardObservation, ReversedCurveReport, ReversedCurveResult } from './curve-reversal.js';
export { extractCurveInterval, validateExtractedCurveInterval, CurveIntervalExtractionError, CurveIntervalExtractionDiagnosticCode } from './curve-interval-extraction.js';
export type { CurveIntervalExtractionOptions, CurveIntervalExtractionD1State, CurveIntervalBoundaryChoice, CurveIntervalSplitOperation, CurveIntervalExtractionProvenance, CurveIntervalExtractionObservation, CurveIntervalExtractionGuardObservation, ExtractedCurveIntervalReport, ExtractedCurveIntervalResult } from './curve-interval-extraction.js';
export { extractSurfaceRegion, validateExtractedSurfaceRegion, SurfaceRegionError, SurfaceRegionDiagnosticCode } from './surface-region.js';
export type { SurfaceRegionOptions, SurfaceRegionDomain, SurfaceRegionD1State, SurfaceRegionBoundaryChoice, SurfaceRegionSplitOperation, SurfaceRegionProvenance, SurfaceRegionObservation, SurfaceRegionGuardObservation, ExtractedSurfaceRegionReport, ExtractedSurfaceRegionResult } from './surface-region.js';
export { refineCurveWide, validateWideCurveRefinement, WideCurveRefinementError, WideCurveRefinementDiagnosticCode } from './curve-wide-refinement.js';
export type { WideCurveInsertionRequest, WideCurveRefinementOptions, WideCurveRefinementD1State, WideCurveHomogeneousPole, WideCurveRefinementOperation, WideCurveRefinementProvenance, WideCurveRefinementObservation, WideCurveRefinementGuardObservation, WideCurveRefinementReport, WideCurveRefinementResult } from './curve-wide-refinement.js';
export { reverseSurfaceAxis, validateReversedSurfaceAxis, SurfaceAxisReversalError, SurfaceAxisReversalDiagnosticCode } from './surface-axis-reversal.js';
export type { SurfaceAxisReversalOptions, SurfaceAxisReversalDomain, SurfaceAxisReversalD1State, SurfaceAxisReversalStrip, SurfaceAxisReversalCoefficientMapping, SurfaceAxisReversalProvenance, SurfaceAxisReversalObservation, SurfaceAxisReversalGuardObservation, ReversedSurfaceAxisReport, ReversedSurfaceAxisResult } from './surface-axis-reversal.js';
export { sampleCurveWideAdaptive, validateWideAdaptiveCurveSamples, WideAdaptiveCurveSamplingError, WideAdaptiveCurveSamplingDiagnosticCode } from './curve-wide-adaptive-sampling.js';
export type { WideAdaptiveCurveSamplingOptions, WideAdaptiveCurveSample, WideAdaptiveCurveD1State, WideAdaptiveCurveExtractionLevel, WideAdaptiveCurveSpan, WideAdaptiveCurveObservation, WideAdaptiveCurveSegment, WideAdaptiveCurveSplitOperation, WideAdaptiveCurveSamplingReport, WideAdaptiveCurveSamplingResult } from './curve-wide-adaptive-sampling.js';
export { extractCurveBezierSpans, validateCurveBezierSpans, CurveBezierSpanExtractionError, CurveBezierSpanExtractionDiagnosticCode } from './curve-bezier-spans.js';
export type { CurveBezierSpanExtractionOptions, CurveBezierSpan, CurveBezierSpanD1State, CurveBezierSpanObservation, CurveBezierSpanEndpoint, CurveBezierSpanExtractionReport, CurveBezierSpanExtractionResult } from './curve-bezier-spans.js';
export { createCadDocument, serializeCadDocument, parseCadDocument, validateCadDocumentResult, CadDocumentError, CadDocumentDiagnosticCode } from './cad-document.js';
export type { CadDocumentUnits, CadDocumentSourceAsset, CadDocumentBody, CadDocumentV1, CadDocumentCompiledAsset, CadDocumentBodyBinding, CadDocumentReport, CadDocumentResult } from './cad-document.js';
export { createCadGeometryReference, resolveCadGeometryReference, rebindCadGeometryReference, queryCadDocumentPoint, convertCadDocumentPoint, validateCadDocumentPoint, validateCadFrameConversion, CadReferenceError, CadReferenceDiagnosticCode } from './cad-document-reference.js';
export type { CadGeometryReferenceInput, CadGeometryReferenceV0, CadGeometryReferenceResult, CadGeometryRebindResult, CadDocumentPointQuery, CadDocumentPointResult, CadFrameConversionOptions, CadFrameConversionResult, CadReferenceReport, CadFrameConversionReport } from './cad-document-reference.js';
export { inspectCadDocumentCompatibility, migrateCadDocument, validateCadDocumentMigration, CadDocumentCompatibilityError, CadDocumentCompatibilityDiagnosticCode } from './cad-document-compatibility.js';
export type { CadDocumentCompatibilityInput, CadDocumentMigrationOptions, CadDocumentCompatibilityEntry, CadDocumentCompatibilityReport, CadDocumentMigrationMapping, CadDocumentMigrationResult } from './cad-document-compatibility.js';

export { getCadDocumentExportCapabilities, inspectCadDocumentExport, exportCadDocument, validateCadDocumentExport, CadDocumentExportError, CadDocumentExportDiagnosticCode } from './cad-document-export.js';
export type { CadDocumentExportCapability, CadDocumentExportSelection, CadDocumentExportOptions, CadDocumentExportMapping, CadDocumentExportReport, CadDocumentExportResult } from './cad-document-export.js';

export { intersectCubicBezierCurveWithAffinePlaneSurface, validateCubicBezierCurveAffinePlaneIntersection, CubicCurveAffinePlaneIntersectionError, CubicCurveAffinePlaneIntersectionDiagnosticCode } from './own-cubic-curve-plane-intersection.js';
export type { CubicCurveAffinePlaneIntersectionOptions, CubicCurveAffinePlaneIntersectionReport, CubicCurveAffinePlaneIntersectionResult, CubicCurvePlaneRootEvidence } from './own-cubic-curve-plane-intersection.js';

export { intersectCubicCurveWideWithAffinePlaneSurface, validateWideCubicCurveAffinePlaneIntersection, WideCubicCurveAffinePlaneIntersectionError, WideCubicCurveAffinePlaneIntersectionDiagnosticCode } from './curve-wide-cubic-plane-intersection.js';
export type { WideCubicCurveAffinePlaneIntersectionOptions, WideCubicCurveAffinePlaneSpan, WideCubicCurveAffinePlaneIntersectionReport, WideCubicCurveAffinePlaneIntersectionResult } from './curve-wide-cubic-plane-intersection.js';

export { editCurveControlPolygonWide, validateWideCurveControlPolygonEdit, WideCurveControlPolygonEditError, WideCurveControlPolygonEditDiagnosticCode } from './curve-wide-control-polygon.js';
export type { WideCurveControlPolygonEditReport, WideCurveControlPolygonEditResult } from './curve-wide-control-polygon.js';

export { reverseCurveWide, validateWideReversedCurveResult, WideCurveReversalError, WideCurveReversalDiagnosticCode } from './curve-wide-reversal.js';
export type { WideReversedCurveReport, WideReversedCurveResult } from './curve-wide-reversal.js';

export { buildThreeSectionLoftSurface, validateThreeSectionLoftSurface, ThreeSectionLoftError, ThreeSectionLoftDiagnosticCode } from './three-section-loft.js';
export type { ThreeSectionLoftOptions, ThreeSectionLoftObservation, ThreeSectionLoftD1Observation, ThreeSectionLoftProvenance, ThreeSectionLoftReport, ThreeSectionLoftResult } from './three-section-loft.js';

export { queryCadDocumentBounds, validateCadDocumentBounds, CadDocumentBoundsError, CadDocumentBoundsDiagnosticCode } from './cad-document-bounds.js';
export type { CadDocumentBoundsReport, CadDocumentBoundsResult } from './cad-document-bounds.js';

export { queryCadDocumentCurveArcLength, validateCadDocumentCurveArcLength, CadCurveArcLengthError, CadCurveArcLengthDiagnosticCode } from './cad-curve-arc-length.js';
export type { CadCurveArcLengthOptions, CadCurveArcLengthPanel, CadCurveArcLengthReport, CadCurveArcLengthResult } from './cad-curve-arc-length.js';

export { queryCadDocumentSurfaceArea, validateCadDocumentSurfaceArea, CadSurfaceAreaError, CadSurfaceAreaDiagnosticCode } from './cad-surface-area.js';
export type { CadSurfaceAreaOptions, CadSurfaceAreaCell, CadSurfaceAreaReport, CadSurfaceAreaResult } from './cad-surface-area.js';

export { evaluateCadAssembly, serializeCadAssembly, parseCadAssembly, updateCadAssembly, validateCadAssemblyResult, CadAssemblyError, CadAssemblyDiagnosticCode } from './cad-assembly.js';
export type { CadAssemblyMatrix, CadAssemblyPlacement, CadAssemblyInstance, CadAssemblyV0, CadAssemblyEvaluatedInstance, CadAssemblyEdits, CadAssemblyReport, CadAssemblyResult } from './cad-assembly.js';
export { queryCadAssemblyInstancePoint, validateCadAssemblyInstancePoint } from './cad-assembly-instance-point.js';
export type { CadAssemblyInstancePointQuery, CadAssemblyInstancePointReport, CadAssemblyInstancePointResult } from './cad-assembly-instance-point.js';

export { transactCadAssemblyMembers, validateCadAssemblyMemberTransaction } from './cad-assembly-members.js';
export type { CadAssemblyMemberTransaction, CadAssemblyMemberReport, CadAssemblyMemberResult } from './cad-assembly-members.js';

export { replaceCadAssemblyPart, validateCadAssemblyPartReplacement } from './cad-assembly-part-replacement.js';
export type { CadAssemblyPartReplacement, CadAssemblyPartReplacementReport, CadAssemblyPartReplacementResult } from './cad-assembly-part-replacement.js';

export { booleanCoplanarFaces, validateCoplanarFaceBoolean, CoplanarFaceBooleanError, CoplanarFaceBooleanDiagnosticCode } from './coplanar-face-boolean.js';
export type { CoplanarFaceBooleanOptions, CoplanarFaceBooleanContributor, CoplanarFaceBooleanEvent, CoplanarFaceBooleanFragment, CoplanarFaceBooleanLoop, CoplanarFaceBooleanComponent, CoplanarFaceBooleanReport, CoplanarFaceBooleanResult } from './coplanar-face-boolean.js';

export { tessellateCoplanarFaceBoolean, validateCoplanarFaceBooleanMesh, CoplanarFaceBooleanMeshError, CoplanarFaceBooleanMeshDiagnosticCode } from './coplanar-face-boolean-mesh.js';
export type { CoplanarFaceBooleanMeshOptions, CoplanarFaceBooleanMeshVertex, CoplanarFaceBooleanMeshBoundaryPath, CoplanarFaceBooleanMeshEdgeUse, CoplanarFaceBooleanMeshTriangulation, CoplanarFaceBooleanMeshReport, CoplanarFaceBooleanMeshResult } from './coplanar-face-boolean-mesh.js';

export { extrudeCoplanarFaceBoolean, validateCoplanarFaceBooleanExtrusion, CoplanarFaceBooleanExtrusionError, CoplanarFaceBooleanExtrusionDiagnosticCode } from './coplanar-face-boolean-extrusion.js';
export type { CoplanarFaceBooleanExtrusionOptions, CoplanarFaceBooleanExtrusionVertex, CoplanarFaceBooleanExtrusionEdgeUse, CoplanarFaceBooleanExtrusionFace, CoplanarFaceBooleanExtrusionShell, CoplanarFaceBooleanExtrusionReport, CoplanarFaceBooleanExtrusionResult } from './coplanar-face-boolean-extrusion.js';

export { tessellateCoplanarFaceBooleanExtrusion, validateCoplanarFaceBooleanExtrusionMesh, CoplanarFaceBooleanExtrusionMeshError, CoplanarFaceBooleanExtrusionMeshDiagnosticCode } from './coplanar-face-boolean-extrusion-mesh.js';
export type { CoplanarFaceBooleanExtrusionMeshOptions, CoplanarFaceBooleanExtrusionMeshVertex, CoplanarFaceBooleanExtrusionMeshFaceRange, CoplanarFaceBooleanExtrusionMeshEdgePath, CoplanarFaceBooleanExtrusionMeshShellRange, CoplanarFaceBooleanExtrusionMeshReport, CoplanarFaceBooleanExtrusionMeshResult } from './coplanar-face-boolean-extrusion-mesh.js';

export { evaluateBooleanExtrusionFeatureGraph, updateBooleanExtrusionFeatureGraph, validateBooleanExtrusionFeatureGraph, BooleanExtrusionFeatureGraphError, BooleanExtrusionFeatureGraphDiagnosticCode } from './boolean-extrusion-feature-graph.js';
export { serializeBooleanExtrusionFeatureGraph, parseBooleanExtrusionFeatureGraph } from './boolean-extrusion-feature-graph-serde.js';
export type { BooleanExtrusionLengthDefinition, BooleanExtrusionLengthParameter, BooleanExtrusionFaceFeature, BooleanExtrusionBooleanFeature, BooleanExtrusionExtrusionFeature, BooleanExtrusionFeatureGraphV0, BooleanExtrusionFeatureGraphOptions, BooleanExtrusionFeatureGraphEdits, BooleanExtrusionFeatureGraphResolvedParameter, BooleanExtrusionFeatureGraphEvaluatedFeature, BooleanExtrusionFeatureGraphReport, BooleanExtrusionFeatureGraphResult } from './boolean-extrusion-feature-graph.js';

export { transactBooleanExtrusionFeatureGraphParameters } from './boolean-extrusion-parameter-lifecycle.js';
export type { BooleanExtrusionParameterOperation, BooleanExtrusionParameterTransaction } from './boolean-extrusion-parameter-lifecycle.js';

export { transactBooleanExtrusionFeatureGraphFeatures } from './boolean-extrusion-feature-lifecycle.js';
export type { BooleanExtrusionFeatureOperation, BooleanExtrusionFeatureTransaction } from './boolean-extrusion-feature-lifecycle.js';

export { measureCoplanarFaceBooleanExtrusion, validateCoplanarFaceBooleanExtrusionProperties, CoplanarFaceBooleanExtrusionPropertiesError, CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode } from './coplanar-face-boolean-extrusion-properties.js';
export type { CoplanarFaceBooleanExtrusionPropertiesOptions, CoplanarFaceBooleanExtrusionPropertiesComponent, CoplanarFaceBooleanExtrusionPropertiesReport, CoplanarFaceBooleanExtrusionPropertiesResult } from './coplanar-face-boolean-extrusion-properties.js';

export { buildTranslationalSweepSurface, validateTranslationalSweepSurface, TranslationalSweepError, TranslationalSweepDiagnosticCode } from './translational-sweep-surface.js';
export type { TranslationalSweepOptions, TranslationalSweepProvenance, TranslationalSweepObservation, TranslationalSweepReport, TranslationalSweepResult } from './translational-sweep-surface.js';

export { buildInterpolatingCurve, validateInterpolatingCurve, CurveInterpolationError, CurveInterpolationDiagnosticCode } from './curve-interpolation.js';
export type { CurveInterpolationPoint, CurveInterpolationOptions, CurveInterpolationReport, CurveInterpolationResult } from './curve-interpolation.js';

export { buildInterpolatingSurface, validateInterpolatingSurface, SurfaceInterpolationError, SurfaceInterpolationDiagnosticCode } from './surface-interpolation.js';
export type { SurfaceInterpolationOptions, SurfaceInterpolationObservation, SurfaceInterpolationReport, SurfaceInterpolationResult } from './surface-interpolation.js';

export { buildParameterizedInterpolatingCurve, validateParameterizedInterpolatingCurve, CurveParameterizationError, CurveParameterizationDiagnosticCode } from './curve-parameterization.js';
export type { CurveParameterizationMethod, CurveParameterizationOptions, CurveParameterizationReport, CurveParameterizationResult } from './curve-parameterization.js';

export { buildWeightedInterpolatingCurve, validateWeightedInterpolatingCurve, WeightedCurveInterpolationError, WeightedCurveInterpolationDiagnosticCode } from './weighted-curve-interpolation.js';
export type { WeightedCurveInterpolationPoint, WeightedCurveInterpolationOptions, WeightedCurveInterpolationReport, WeightedCurveInterpolationResult } from './weighted-curve-interpolation.js';

export { buildMultiSectionLoftSurface, validateMultiSectionLoftSurface, MultiSectionLoftError, MultiSectionLoftDiagnosticCode } from './multi-section-loft.js';
export type { MultiSectionLoftOptions, MultiSectionLoftProvenance, MultiSectionLoftObservation, MultiSectionLoftReport, MultiSectionLoftResult } from './multi-section-loft.js';

export { transformNativeGeometryAffine, validateAffineGeometryTransform, AffineGeometryTransformError, AffineGeometryTransformDiagnosticCode } from './affine-geometry-transform.js';
export type { CadAffineMatrix3x4, AffineGeometryTransformOptions, AffineGeometryTransformObservation, AffineGeometryTransformReport, AffineGeometryTransformResult } from './affine-geometry-transform.js';

export { buildLinearGeometryPattern, validateLinearGeometryPattern, LinearGeometryPatternError, LinearGeometryPatternDiagnosticCode } from './linear-geometry-pattern.js';
export type { LinearGeometryPatternOptions, LinearGeometryPatternInstance, LinearGeometryPatternReport, LinearGeometryPatternResult } from './linear-geometry-pattern.js';

export { buildCircularGeometryPattern, validateCircularGeometryPattern, CircularGeometryPatternError, CircularGeometryPatternDiagnosticCode } from './circular-geometry-pattern.js';
export type { CircularGeometryPatternOptions, CircularGeometryPatternInstance, CircularGeometryPatternReport, CircularGeometryPatternResult } from './circular-geometry-pattern.js';

export { evaluateCurveD2, evaluateSurfaceD2, NativeSecondDerivativeError, NativeSecondDerivativeDiagnosticCode } from './second-derivatives.js';
export type { CurveD2Result, SurfaceD2Result } from './second-derivatives.js';

export { evaluateCurveCurvature, evaluateSurfaceCurvature, NativeCurvatureError, NativeCurvatureDiagnosticCode } from './local-curvature.js';
export type { CurveCurvatureResult, SurfaceCurvatureResult } from './local-curvature.js';

export { intersectCurveWithPlanarFaceMaterial, validateCurvePlanarFaceMaterialIntersection, CurvePlanarFaceMaterialError, CurvePlanarFaceMaterialDiagnosticCode } from './curve-planar-face-material.js';
export type { CurvePlanarFaceMaterialOptions, CurvePlanarFaceMaterialEvent, CurvePlanarFaceMaterialReport, CurvePlanarFaceMaterialResult } from './curve-planar-face-material.js';

export { estimateCoplanarFaceBooleanExtrusionMass, validateCoplanarFaceBooleanExtrusionMass, CoplanarFaceBooleanExtrusionMassError, CoplanarFaceBooleanExtrusionMassDiagnosticCode } from './coplanar-face-boolean-extrusion-mass.js';
export type { CoplanarFaceBooleanExtrusionMassOptions, CoplanarFaceBooleanExtrusionMassComponent, CoplanarFaceBooleanExtrusionMassReport, CoplanarFaceBooleanExtrusionMassResult } from './coplanar-face-boolean-extrusion-mass.js';

export { analyzeExtrusionConstructionPrincipalInertia, validateExtrusionConstructionPrincipalInertia, ExtrusionPrincipalInertiaError, ExtrusionPrincipalInertiaDiagnosticCode } from './extrusion-principal-inertia.js';
export type { ExtrusionPrincipalInertiaOptions, ExtrusionPrincipalInertiaAxis, ExtrusionPrincipalInertiaReport, ExtrusionPrincipalInertiaResult } from './extrusion-principal-inertia.js';

export { buildAlignedRationalRuledSurface, validateAlignedRationalRuledSurface, SectionKnotAlignmentError, SectionKnotAlignmentDiagnosticCode } from './section-knot-alignment.js';
export type { SectionKnotAlignmentOptions, SectionKnotAlignmentSection, SectionKnotAlignmentReport, SectionKnotAlignmentResult } from './section-knot-alignment.js';

export { buildExactBoundaryFaceAdjacency, validateExactBoundaryFaceAdjacency, ExactBoundaryFaceAdjacencyError, ExactBoundaryFaceAdjacencyDiagnosticCode } from './exact-boundary-face-adjacency.js';
export type { ExactBoundaryFaceAdjacencyAsset, ExactBoundaryFaceAdjacencyPair, ExactBoundaryFaceAdjacencyOptions, ExactBoundaryFaceAdjacencyEdge, ExactBoundaryFaceAdjacencyReport, ExactBoundaryFaceAdjacencyResult } from './exact-boundary-face-adjacency.js';

export { buildQuinticHermiteCurve, validateQuinticHermiteCurve, QuinticHermiteError, QuinticHermiteDiagnosticCode } from './quintic-hermite-curve.js';
export type { QuinticHermiteEndpoint, QuinticHermiteOptions, QuinticHermiteReport, QuinticHermiteResult } from './quintic-hermite-curve.js';

export { inspectCurveEndpointContinuity, validateCurveEndpointContinuity, CurveEndpointContinuityError, CurveEndpointContinuityDiagnosticCode } from './curve-endpoint-continuity.js';
export type { CurveEndpointContinuityInput, CurveEndpointContinuityOptions, CurveEndpointContinuityReport, CurveEndpointContinuityResult } from './curve-endpoint-continuity.js';

export { buildClosedExactPatchShell, validateClosedExactPatchShell, ClosedExactPatchShellError, ClosedExactPatchShellDiagnosticCode } from './closed-exact-patch-shell.js';
export type { ClosedExactPatchShellOptions, ClosedExactPatchShellGraph, ClosedExactPatchShellReport, ClosedExactPatchShellResult } from './closed-exact-patch-shell.js';

export { buildVLinearSurfacePlaneSection, validateVLinearSurfacePlaneSection, VLinearSurfacePlaneSectionError, VLinearSurfacePlaneSectionDiagnosticCode } from './vlinear-plane-section.js';
export type { VLinearSurfacePlaneSectionAsset, VLinearSurfacePlaneSectionOptions, VLinearSurfacePlaneSectionReport, VLinearSurfacePlaneSectionResult } from './vlinear-plane-section.js';

export { editSourceSurfaceControlNet, validateSourceSurfaceControlNetEdit, SourceSurfaceControlNetError, SourceSurfaceControlNetDiagnosticCode } from './source-surface-control-net.js';
export type { SourceSurfaceControlNetRequest, SourceSurfaceControlNetPatch, SourceSurfaceControlNetReport, SourceSurfaceControlNetResult } from './source-surface-control-net.js';

export { editSourceSurfaceControlNetWide, validateSourceSurfaceControlNetWideEdit, SourceSurfaceControlNetWideError, SourceSurfaceControlNetWideDiagnosticCode } from './source-surface-control-net-wide.js';
export type { SourceSurfaceControlNetWideRequest, SourceSurfaceControlNetWidePatch, SourceSurfaceControlNetWideReport, SourceSurfaceControlNetWideResult } from './source-surface-control-net-wide.js';

export { editSourceCurveControlPolygon, validateSourceCurveControlPolygonEdit, SourceCurveControlPolygonError, SourceCurveControlPolygonDiagnosticCode } from './source-curve-control-polygon.js';
export type { SourceCurveControlPolygonRequest, SourceCurveControlPolygonPatch, SourceCurveControlPolygonReport, SourceCurveControlPolygonResult } from './source-curve-control-polygon.js';

export { buildPiecewiseRationalLoftSurface, validatePiecewiseRationalLoftSurface, PiecewiseRationalLoftError, PiecewiseRationalLoftDiagnosticCode } from './piecewise-rational-loft.js';
export type { PiecewiseRationalLoftOptions, PiecewiseRationalLoftProvenance, PiecewiseRationalLoftReport, PiecewiseRationalLoftResult } from './piecewise-rational-loft.js';

export { buildVLinearSurfacePlaneTrimCandidates, validateVLinearSurfacePlaneTrimCandidates, VLinearSurfacePlaneTrimError, VLinearSurfacePlaneTrimDiagnosticCode } from './vlinear-plane-trim.js';
export type { VLinearSurfacePlaneTrimOptions, VLinearSurfacePlaneTrimEdge, VLinearSurfacePlaneTrimReport, VLinearSurfacePlaneTrimResult } from './vlinear-plane-trim.js';

export { classifyVLinearSurfacePlaneTrimUV, validateVLinearSurfacePlaneTrimUVClassification, VLinearSurfacePlaneTrimUVError, VLinearSurfacePlaneTrimUVDiagnosticCode } from './vlinear-plane-trim-classification.js';
export type { VLinearSurfacePlaneTrimUVQuery, VLinearSurfacePlaneTrimUVOptions, VLinearSurfacePlaneTrimUVReport, VLinearSurfacePlaneTrimUVResult } from './vlinear-plane-trim-classification.js';

export { buildAxisBoxSolidBoolean, validateAxisBoxSolidBoolean, AxisBoxSolidBooleanError, AxisBoxSolidBooleanDiagnosticCode } from './axis-box-boolean.js';
export type { AxisBoxSolidBooleanAsset, AxisBoxSolidBooleanOptions, AxisBoxSolidBooleanReport, AxisBoxSolidBooleanResult } from './axis-box-boolean.js';

export { classifyAxisBoxSolidBooleanPoints, validateAxisBoxSolidBooleanPointClassification, AxisBoxSolidBooleanPointError, AxisBoxSolidBooleanPointDiagnosticCode } from './axis-box-point-classification.js';
export type { AxisBoxSolidBooleanPointQuery, AxisBoxSolidBooleanPointOptions, AxisBoxSolidBooleanPointReport, AxisBoxSolidBooleanPointResult } from './axis-box-point-classification.js';

export { measureAxisBoxSolidBooleanMass, validateAxisBoxSolidBooleanMass, AxisBoxSolidMassError, AxisBoxSolidMassDiagnosticCode } from './axis-box-solid-mass.js';
export type { AxisBoxSolidMassOptions, AxisBoxSolidMassMeasure, AxisBoxSolidMassReport, AxisBoxSolidMassResult } from './axis-box-solid-mass.js';

export { analyzeAxisBoxSolidPrincipalInertia, validateAxisBoxSolidPrincipalInertia, AxisBoxSolidPrincipalInertiaError, AxisBoxSolidPrincipalInertiaDiagnosticCode } from './axis-box-principal-inertia.js';
export type { AxisBoxSolidPrincipalInertiaSelection, AxisBoxSolidPrincipalInertiaOptions, AxisBoxSolidPrincipalInertiaReport, AxisBoxSolidPrincipalInertiaResult } from './axis-box-principal-inertia.js';

export { transformAxisBoxSolidMassFrame, validateAxisBoxSolidMassFrame, AxisBoxSolidMassFrameError, AxisBoxSolidMassFrameDiagnosticCode } from './axis-box-mass-frame.js';
export type { AxisBoxSolidMassFramePose, AxisBoxSolidMassFrameOptions, AxisBoxSolidMassFrameReport, AxisBoxSolidMassFrameResult } from './axis-box-mass-frame.js';

export { buildAxisBoxSolidFeatureDocument, editAxisBoxSolidFeatureDocument, validateAxisBoxSolidFeatureDocument, serializeAxisBoxSolidFeatureDocument, parseAxisBoxSolidFeatureDocument, AxisBoxSolidFeatureDocumentError, AxisBoxSolidFeatureDocumentDiagnosticCode } from './axis-box-solid-feature-document.js';
export type { AxisBoxSolidFeatureDocumentV0, AxisBoxSolidFeatureDocumentOperand, AxisBoxSolidFeatureDocumentEdit, AxisBoxSolidFeatureDocumentReport, AxisBoxSolidFeatureDocumentResult } from './axis-box-solid-feature-document.js';

export { buildXYAngleArc, validateXYAngleArc, XYAngleArcError, XYAngleArcDiagnosticCode } from './xy-angle-arc.js';
export type { XYAngleArcRequest, XYAngleArcReport, XYAngleArcResult } from './xy-angle-arc.js';

export { evaluateMixedWorkplaneSketchDocument, updateMixedWorkplaneSketchDocument, validateMixedWorkplaneSketchDocument, serializeMixedWorkplaneSketchDocument, parseMixedWorkplaneSketchDocument, MixedWorkplaneSketchDocumentError, MixedWorkplaneSketchDocumentDiagnosticCode } from './mixed-workplane-sketch-document.js';
export type { MixedWorkplaneSketchProfileIntent, MixedWorkplaneSketchDocumentV0, MixedWorkplaneSketchDocumentEdit, MixedWorkplaneSketchDocumentReport, MixedWorkplaneSketchDocumentResult } from './mixed-workplane-sketch-document.js';

export { evaluateDrivenMixedSketchLines, updateDrivenMixedSketchLines, validateDrivenMixedSketchLines, serializeDrivenMixedSketchLines, parseDrivenMixedSketchLines, DrivenMixedSketchLinesError, DrivenMixedSketchLinesDiagnosticCode } from './driven-mixed-sketch-lines.js';
export type { DrivenMixedSketchLinesSegmentBinding, DrivenMixedSketchLinesDocumentV0, DrivenMixedSketchLinesDocumentEdit, DrivenMixedSketchLinesReport, DrivenMixedSketchLinesResult } from './driven-mixed-sketch-lines.js';

export { qualifyStoredPlateHoleSolid, validateStoredPlateHoleSolid, serializeStoredPlateHoleSolid, parseStoredPlateHoleSolid, StoredPlateHoleSolidError, StoredPlateHoleSolidDiagnosticCode } from './stored-plate-hole-solid.js';
export type { StoredPlateHoleSolidGerm, StoredPlateHoleSolidCorner, StoredPlateHoleSolidVertexLink, StoredPlateHoleSolidCertificate, StoredPlateHoleSolidResult } from './stored-plate-hole-solid.js';

export { verifyXYAngleArcArtifact, validateXYAngleArcArtifactVerification, serializeXYAngleArcArtifact, parseXYAngleArcArtifact, XYAngleArcArtifactError, XYAngleArcArtifactDiagnosticCode } from './xy-angle-arc-artifact.js';
export type { XYAngleArcArtifactFieldRule, XYAngleArcArtifactReport, XYAngleArcArtifactVerification } from './xy-angle-arc-artifact.js';

export { classifyStoredPlateHoleSolidPoints, validateStoredPlateHoleSolidPoints, serializeStoredPlateHoleSolidPoints, parseStoredPlateHoleSolidPoints, StoredPlateHolePointError, StoredPlateHolePointDiagnosticCode } from './stored-plate-hole-point-classification.js';
export type { StoredPlateHolePointQuery, StoredPlateHolePointOptions, StoredPlateHolePointProof, StoredPlateHolePointClassification, StoredPlateHolePointReport, StoredPlateHolePointResult } from './stored-plate-hole-point-classification.js';

export { buildMultiSpanVLinearSurfacePlaneSection, validateMultiSpanVLinearSurfacePlaneSection, MultiSpanVLinearSurfacePlaneSectionError, MultiSpanVLinearSurfacePlaneSectionDiagnosticCode } from './multispan-vlinear-plane-section.js';
export type { MultiSpanVLinearSurfacePlaneSectionAsset, MultiSpanVLinearSurfacePlaneSectionOptions, MultiSpanVLinearSurfacePlaneSectionReport, MultiSpanVLinearSurfacePlaneSectionResult } from './multispan-vlinear-plane-section.js';

export { buildMultiSpanVLinearSurfacePlaneTrimCandidates, validateMultiSpanVLinearSurfacePlaneTrimCandidates, MultiSpanVLinearSurfacePlaneTrimError, MultiSpanVLinearSurfacePlaneTrimDiagnosticCode } from './multispan-vlinear-plane-trim.js';
export type { MultiSpanVLinearSurfacePlaneTrimOptions, MultiSpanVLinearSurfacePlaneTrimEdge, MultiSpanVLinearSurfacePlaneTrimReport, MultiSpanVLinearSurfacePlaneTrimResult } from './multispan-vlinear-plane-trim.js';

export { classifyMultiSpanVLinearSurfacePlaneTrimUV, validateMultiSpanVLinearSurfacePlaneTrimUVClassification, MultiSpanVLinearSurfacePlaneTrimUVError, MultiSpanVLinearSurfacePlaneTrimUVDiagnosticCode } from './multispan-vlinear-plane-trim-classification.js';
export type { MultiSpanVLinearSurfacePlaneTrimUVQuery, MultiSpanVLinearSurfacePlaneTrimUVOptions, MultiSpanVLinearSurfacePlaneTrimUVReport, MultiSpanVLinearSurfacePlaneTrimUVResult } from './multispan-vlinear-plane-trim-classification.js';

export { buildPairedSectionPlaneCap, validatePairedSectionPlaneCap, PairedSectionPlaneCapError, PairedSectionPlaneCapDiagnosticCode } from './paired-section-plane-cap.js';
export type { PairedSectionPlaneCapOptions, PairedSectionPlaneCapEdge, PairedSectionPlaneCapReport, PairedSectionPlaneCapResult } from './paired-section-plane-cap.js';

export { buildSectionExactSurfaceBinding, validateSectionExactSurfaceBinding, SectionExactSurfaceBindingError, SectionExactSurfaceBindingDiagnosticCode } from './section-exact-surface-binding.js';
export type { SectionExactSurfaceBindingOptions, SectionExactSurfaceBindingSpanProof, SectionExactSurfaceBindingReport, SectionExactSurfaceBindingResult } from './section-exact-surface-binding.js';

export { buildExactSurfaceLowerTrim, validateExactSurfaceLowerTrim, ExactSurfaceLowerTrimError, ExactSurfaceLowerTrimDiagnosticCode } from './exact-surface-lower-trim.js';
export type { ExactSurfaceLowerTrimOptions, ExactSurfaceLowerTrimEdge, ExactSurfaceLowerTrimReport, ExactSurfaceLowerTrimResult } from './exact-surface-lower-trim.js';

export { buildTranslatedSurfaceBaseFace, validateTranslatedSurfaceBaseFace, TranslatedSurfaceBaseFaceError, TranslatedSurfaceBaseFaceDiagnosticCode } from './translated-surface-base-face.js';
export type { TranslatedSurfaceBaseFaceOptions, TranslatedSurfaceBaseFaceEdge, TranslatedSurfaceBaseFaceReport, TranslatedSurfaceBaseFaceResult } from './translated-surface-base-face.js';

export { measureTranslatedSurfaceStripVolume, validateTranslatedSurfaceStripVolume, TranslatedSurfaceStripVolumeError, TranslatedSurfaceStripVolumeDiagnosticCode } from './translated-surface-strip-volume.js';
export type { TranslatedSurfaceStripVolumeOptions, TranslatedSurfaceStripVolumeSpan, TranslatedSurfaceStripVolumeReport, TranslatedSurfaceStripVolumeResult } from './translated-surface-strip-volume.js';

export { buildTranslatedSurfaceEndFaces, validateTranslatedSurfaceEndFaces, TranslatedSurfaceEndFacesError, TranslatedSurfaceEndFacesDiagnosticCode } from './translated-surface-end-faces.js';
export type { TranslatedSurfaceEndFacesOptions, TranslatedSurfaceEndFace, TranslatedSurfaceEndFacesReport, TranslatedSurfaceEndFacesResult } from './translated-surface-end-faces.js';

export { buildQualifiedTranslatedStripBody, validateQualifiedTranslatedStripBody, QualifiedTranslatedStripBodyError, QualifiedTranslatedStripBodyDiagnosticCode } from './qualified-translated-strip-body.js';
export type { QualifiedTranslatedStripBodyOptions, QualifiedTranslatedStripBodyEdge, QualifiedTranslatedStripBodyReport, QualifiedTranslatedStripBodyResult } from './qualified-translated-strip-body.js';

export { classifyTranslatedSurfaceStripWorldPoints, validateTranslatedSurfaceStripWorldPointClassification, TranslatedSurfaceStripWorldPointError, TranslatedSurfaceStripWorldPointDiagnosticCode } from './translated-surface-strip-world-points.js';
export type { TranslatedSurfaceStripWorldPointQuery, TranslatedSurfaceStripWorldPointOptions, TranslatedSurfaceStripWorldPointReport, TranslatedSurfaceStripWorldPointResult } from './translated-surface-strip-world-points.js';

export { evaluateNurbsSourceLoftFeatureGraph, updateNurbsSourceLoftFeatureGraph, validateNurbsSourceLoftFeatureGraph, validateNurbsSourceLoftFeatureGraphUpdate, serializeNurbsSourceLoftFeatureGraph, parseNurbsSourceLoftFeatureGraph, NurbsSourceLoftFeatureGraphError, NurbsSourceLoftFeatureGraphDiagnosticCode } from './nurbs-source-loft-feature-graph.js';
export type { NurbsSourceLoftFeatureGraphV0, NurbsSourceLoftFeatureGraphOptions, NurbsSourceLoftFeatureGraphEdits, NurbsSourceLoftFeatureGraphResult, NurbsSourceLoftFeatureGraphReport, NurbsSourceLoftFeatureGraphTransaction, NurbsSourceLoftFeatureGraphTransactionReport, NurbsSourceLoftFeatureGraphUpdateResult } from './nurbs-source-loft-feature-graph.js';

export { buildExactSurfaceBandTrim, validateExactSurfaceBandTrim, ExactSurfaceBandTrimError, ExactSurfaceBandTrimDiagnosticCode } from './exact-surface-band-trim.js';
export type { ExactSurfaceBandTrimOptions, ExactSurfaceBandTrimEdge, ExactSurfaceBandTrimReport, ExactSurfaceBandTrimResult } from './exact-surface-band-trim.js';

export { buildTranslatedStripIntervalBoolean, validateTranslatedStripIntervalBoolean, TranslatedStripIntervalBooleanError, TranslatedStripIntervalBooleanDiagnosticCode } from './translated-strip-interval-boolean.js';
export type { TranslatedStripIntervalBooleanOptions, TranslatedStripIntervalBooleanOutput, TranslatedStripIntervalBooleanReport, TranslatedStripIntervalBooleanResult } from './translated-strip-interval-boolean.js';

export { tessellateQualifiedTranslatedStripBody, validateQualifiedTranslatedStripBodyMesh, QualifiedTranslatedStripBodyMeshError, QualifiedTranslatedStripBodyMeshDiagnosticCode } from './qualified-translated-strip-body-mesh.js';
export type { QualifiedTranslatedStripBodyMeshOptions, QualifiedTranslatedStripBodyMeshPacket, QualifiedTranslatedStripBodyMeshReport, QualifiedTranslatedStripBodyMeshResult } from './qualified-translated-strip-body-mesh.js';

export { insertSourceCurveKnot, validateSourceCurveKnotInsertion, SourceCurveKnotInsertionError, SourceCurveKnotInsertionDiagnosticCode } from './source-curve-knot-insertion.js';
export type { SourceCurveKnotInsertionRequest, SourceCurveKnotInsertionPatch, SourceCurveKnotInsertionReport, SourceCurveKnotInsertionResult } from './source-curve-knot-insertion.js';

export { insertSourceSurfaceKnot, validateSourceSurfaceKnotInsertion, SourceSurfaceKnotInsertionError, SourceSurfaceKnotInsertionDiagnosticCode } from './source-surface-knot-insertion.js';
export type { SourceSurfaceKnotInsertionRequest, SourceSurfaceKnotInsertionPatch, SourceSurfaceKnotInsertionReport, SourceSurfaceKnotInsertionResult } from './source-surface-knot-insertion.js';

export { extractSourceCurveInterval, validateSourceCurveIntervalExtraction, SourceCurveIntervalExtractionError, SourceCurveIntervalExtractionDiagnosticCode } from './source-curve-interval-extraction.js';
export type { SourceCurveIntervalExtractionRequest, SourceCurveIntervalExtractionPatch, SourceCurveIntervalExtractionReport, SourceCurveIntervalExtractionResult } from './source-curve-interval-extraction.js';


export { buildSourceKnotAlignedLoft, validateSourceKnotAlignedLoft, SourceKnotAlignedLoftError, SourceKnotAlignedLoftDiagnosticCode } from './source-knot-aligned-loft.js';
export type { SourceKnotAlignedLoftRequest, SourceKnotAlignedLoftOptions, SourceKnotAlignedLoftReport, SourceKnotAlignedLoftResult } from './source-knot-aligned-loft.js';


export { elevateSourceCurveDegree, validateSourceCurveDegreeElevation, SourceCurveDegreeElevationError, SourceCurveDegreeElevationDiagnosticCode } from './source-curve-degree-elevation.js';
export type { SourceCurveDegreeElevationRequest, SourceCurveDegreeElevationPatch, SourceCurveDegreeElevationReport, SourceCurveDegreeElevationResult } from './source-curve-degree-elevation.js';


export { evaluateSourceKnotRecipeLoftGraph, updateSourceKnotRecipeLoftGraph, validateSourceKnotRecipeLoftGraph, validateSourceKnotRecipeLoftGraphUpdate, serializeSourceKnotRecipeLoftGraph, parseSourceKnotRecipeLoftGraph, SourceKnotRecipeLoftGraphError, SourceKnotRecipeLoftGraphDiagnosticCode } from './source-knot-recipe-loft-graph.js';
export type { SourceKnotRecipeLoftGraphV0, SourceKnotRecipeLoftGraphOptions, SourceKnotRecipeLoftGraphEdits, SourceKnotRecipeLoftGraphResult, SourceKnotRecipeLoftGraphReport, SourceKnotRecipeLoftGraphTransaction, SourceKnotRecipeLoftGraphTransactionReport, SourceKnotRecipeLoftGraphUpdateResult } from './source-knot-recipe-loft-graph.js';


export { elevateSourceSurfaceAxisDegree, validateSourceSurfaceAxisDegreeElevation, SourceSurfaceDegreeElevationError, SourceSurfaceDegreeElevationDiagnosticCode } from './source-surface-degree-elevation.js';
export type { SourceSurfaceDegreeElevationRequest, SourceSurfaceDegreeElevationPatch, SourceSurfaceDegreeElevationReport, SourceSurfaceDegreeElevationResult } from './source-surface-degree-elevation.js';


export { importIGES, validateIGESImport, IGESImportError, IGESImportDiagnosticCode } from './iges-import.js';
export type { IGESImportOptions, IGESImportEntity, IGESImportReport, IGESImportResult } from './iges-import.js';
