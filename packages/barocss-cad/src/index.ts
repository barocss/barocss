export * from './types.js';
export { MAX_SAMPLES, validateCurve, validateSurface, validateModel, curveDomain, surfaceDomain, evaluateCurve, evaluateSurface, curveEvaluator, surfaceEvaluator, sampleCurve, sampleSurface } from './core/math.js';
export * from './io/iges.js';
export * from './core/packet.js';
export * from './core/preview.js';
export * from './core/extrusion.js';
export * from './core/derivatives.js';
export * from './core/boundary.js';
export * from './core/face.js';
export * from './core/adjacency.js';
export * from './core/orthogonal-adjacency.js';
export * from './core/box-shell.js';
export * from './core/box-solid.js';

export { compileCadModel } from './model-compiler.js';
export type { CadCompileOptions, CadCompileResult, CadDiagnostic, CadModelIR, CadModelAst, CadSourceRange } from './model-compiler.js';
export type { SourceSpan, ExtrusionConstruction } from './document/construction-types.js';
export type { CadModelIR1, CadModelIR2, CadResolvedParameter, CadFieldBinding, CadQuantityKind, CadParameterDependency } from './model-compiler.js';
export type { CadExpression } from './model-compiler.js';
export { buildXYProfile } from './sketch/xy-profile.js';
export type { XYPoint, XYProfileRequest, XYProfileReport, XYProfileResult } from './sketch/xy-profile.js';
export { buildXYArc } from './xy-arc.js';
export type { XYArcRequest, XYArcReport, XYArcResult } from './xy-arc.js';
export { buildAxisRectangleExtrusion } from './planar-solids/axis-rectangle-extrusion.js';
export type { AxisRectangleExtrusionRequest, AxisRectangleExtrusionConstruction, AxisRectangleExtrusionResult } from './planar-solids/axis-rectangle-extrusion.js';
export { evaluateAxisRectangleFeatureDocument, editAxisRectangleFeatureDocument, serializeAxisRectangleFeatureDocument } from './planar-solids/axis-rectangle-feature-document.js';
export type { AxisRectangleFeatureDocumentV0, AxisRectangleFeatureDocumentResult, AxisRectangleParameterEdit } from './planar-solids/axis-rectangle-feature-document.js';
export { solveXYLinearSketch } from './sketch/xy-linear-sketch.js';
export type { XYLinearSketchDocumentV0, XYLinearSketchResult, XYLinearSketchConstraint, XYLinearSketchDiagnostic } from './sketch/xy-linear-sketch.js';
export type { XYLinearSketchDocumentV1, XYLinearSketchConstraintV1, XYLinearSketchResultV1, XYLinearSketchDimensionReport } from './sketch/xy-linear-sketch.js';
export { buildXYPolygonRegion, validateXYPolygonRegion } from './sketch/xy-polygon-region.js';
export type { XYPolygonRegionRequest, XYPolygonRegionResult, XYPolygonRegionReport } from './sketch/xy-polygon-region.js';
export { tessellateXYPolygonRegion } from './planar-solids/xy-polygon-preview.js';
export type { XYPolygonPreviewOptions, XYPolygonPreviewVertexSource, XYPolygonPreviewReport, XYPolygonPreviewResult } from './planar-solids/xy-polygon-preview.js';
export { buildXYPolygonPrismPreview } from './planar-solids/xy-polygon-prism-preview.js';
export type { XYPolygonPrismPreviewRequest, XYPolygonPrismPreviewConstruction, XYPolygonPrismPreviewRole, XYPolygonPrismPreviewReport, XYPolygonPrismPreviewResult } from './planar-solids/xy-polygon-prism-preview.js';
export { evaluateXYPolygonPrismDocument, updateXYPolygonPrismDocument, serializeXYPolygonPrismDocument, parseXYPolygonPrismDocument } from './planar-solids/xy-polygon-prism-document.js';
export type { XYPolygonPrismDocumentV0, XYPolygonPrismDocumentOptions, XYPolygonPrismDocumentUpdate, XYPolygonPrismDocumentEvaluation, XYPolygonPrismDocumentResult } from './planar-solids/xy-polygon-prism-document.js';
export { buildXYPolygonPlanarFace, validateXYPolygonPlanarFaceBundle, classifyXYPolygonPlanarFacePoint } from './planar-solids/xy-polygon-planar-face.js';
export type { XYPolygonPlanarFaceOptions, XYPolygonPlanarFaceBundle, XYPolygonPlanarFaceReport, XYPolygonPlanarFaceResult, XYPolygonPlanarFacePointResult } from './planar-solids/xy-polygon-planar-face.js';
export { buildXYPolygonPrismShell, validateXYPolygonPrismShell } from './planar-solids/xy-polygon-prism-shell.js';
export type { XYPolygonPrismShellOptions, XYPolygonPrismShell, XYPolygonPrismShellReport, XYPolygonPrismShellResult, XYPolygonPrismCapFace, XYPolygonPrismLateralFace, XYPolygonPrismQualifiedUse } from './planar-solids/xy-polygon-prism-shell.js';
export { tessellateXYPolygonPrismShell } from './planar-solids/xy-polygon-prism-shell-preview.js';
export type { XYPolygonPrismShellPreviewOptions, XYPolygonPrismShellFaceRange, XYPolygonPrismShellEdgePath, XYPolygonPrismShellEdgeProvenance, XYPolygonPrismShellPreviewReport, XYPolygonPrismShellPreviewResult } from './planar-solids/xy-polygon-prism-shell-preview.js';
export { queryXYPolygonPrismShellRay } from './planar-solids/xy-polygon-prism-ray-query.js';
export type { XYPolygonPrismShellRayQueryOptions, XYPolygonPrismShellRayHit, XYPolygonPrismShellCoplanarFace, XYPolygonPrismShellRayQueryReport, XYPolygonPrismShellRayQueryResult } from './planar-solids/xy-polygon-prism-ray-query.js';
export { buildXYPolygonPlanarFaceWithHole, validateXYPolygonPlanarFaceWithHoleBundle, classifyXYPolygonPlanarFaceWithHolePoint } from './planar-solids/xy-polygon-planar-face-hole.js';
export type { XYPolygonPlanarFaceWithHoleOptions, XYPolygonPlanarFaceWithHoleBundle, XYPolygonPlanarFaceWithHoleReport, XYPolygonPlanarFaceWithHoleResult, XYPolygonPlanarFaceWithHolePointResult } from './planar-solids/xy-polygon-planar-face-hole.js';
export { tessellateXYPolygonPlanarFaceWithHole } from './planar-solids/xy-polygon-planar-face-hole-preview.js';
export type { XYPolygonHoleFacePreviewOptions, XYPolygonHoleRational, XYPolygonHolePreviewCorner, XYPolygonHolePreviewSlab, XYPolygonHolePreviewEdgeProvenance, XYPolygonHoleFacePreviewReport, XYPolygonHoleFacePreviewResult } from './planar-solids/xy-polygon-planar-face-hole-preview.js';
export { buildXYPolygonPrismShellWithHole, validateXYPolygonPrismShellWithHole } from './planar-solids/xy-polygon-prism-shell-hole.js';
export type { XYPolygonPrismShellWithHoleOptions, XYPolygonPrismShellWithHole, XYPolygonPrismShellWithHoleReport, XYPolygonPrismShellWithHoleResult, XYPolygonPrismHoleCapFace, XYPolygonPrismHoleWallFace } from './planar-solids/xy-polygon-prism-shell-hole.js';
export { tessellateXYPolygonPrismShellWithHole } from './planar-solids/xy-polygon-prism-shell-hole-preview.js';
export type { XYPolygonPrismHoleShellPreviewOptions, XYPolygonPrismHoleShellFaceRange, XYPolygonPrismHoleShellEdgePath, XYPolygonPrismHoleShellEdgeProvenance, XYPolygonPrismHoleShellPreviewReport, XYPolygonPrismHoleShellPreviewResult } from './planar-solids/xy-polygon-prism-shell-hole-preview.js';
export { evaluateXYPolygonPrismHoleDocument, updateXYPolygonPrismHoleDocument, serializeXYPolygonPrismHoleDocument, parseXYPolygonPrismHoleDocument } from './planar-solids/xy-polygon-prism-hole-document.js';
export type { XYPolygonPrismHoleDocumentV0, XYPolygonPrismHoleDocumentOptions, XYPolygonPrismHoleDocumentUpdate, XYPolygonPrismHoleDocumentEvaluation, XYPolygonPrismHoleDocumentReport, XYPolygonPrismHoleDocumentResult } from './planar-solids/xy-polygon-prism-hole-document.js';
export { queryXYPolygonPrismShellWithHoleRay } from './planar-solids/xy-polygon-prism-shell-hole-ray-query.js';
export type { XYPolygonPrismHoleShellRayQueryOptions, XYPolygonPrismHoleShellRayFaceRole, XYPolygonPrismHoleShellRayEdgeReference, XYPolygonPrismHoleShellRayHit, XYPolygonPrismHoleShellCoplanarFace, XYPolygonPrismHoleShellRayQueryReport, XYPolygonPrismHoleShellRayQueryResult } from './planar-solids/xy-polygon-prism-shell-hole-ray-query.js';
export { evaluateXYSketchDocument, updateXYSketchDocument, serializeXYSketchDocument, parseXYSketchDocument } from './sketch/xy-sketch-document.js';
export type { XYSketchAuthoredPoint, XYSketchProfileIntent, XYSketchDocumentV0, XYSketchDocumentEdit, XYSketchPointBinding, XYSketchEvaluatedProfile, XYSketchDocumentReport, XYSketchDocumentResult } from './sketch/xy-sketch-document.js';

export { evaluateWorkplaneSketchDocument, updateWorkplaneSketchDocument, validateWorkplaneSketchDocument, serializeWorkplaneSketchDocument, parseWorkplaneSketchDocument, WorkplaneSketchDocumentError, WorkplaneSketchDocumentDiagnosticCode } from './sketch/workplane-sketch-document.js';
export type { WorkplaneSketchFrame, WorkplaneSketchDocumentV0, WorkplaneSketchDocumentEdit, WorkplaneSketchDocumentReport, WorkplaneSketchDocumentResult } from './sketch/workplane-sketch-document.js';
export { evaluateXYArcSketchDocument, updateXYArcSketchDocument, serializeXYArcSketchDocument, parseXYArcSketchDocument } from './sketch/xy-arc-sketch-document.js';
export type { XYArcSketchRadius, XYArcSketchProfileIntent, XYArcSketchDocumentV0, XYArcSketchDocumentEdit, XYArcSketchCurvePointBinding, XYArcSketchBindings, XYArcSketchEvaluatedProfile, XYArcSketchDocumentReport, XYArcSketchDocumentResult } from './sketch/xy-arc-sketch-document.js';
export { buildXYCirclePlanarFace, validateXYCirclePlanarFaceBundle, classifyXYCirclePlanarFacePoint } from './planar-solids/xy-circle-planar-face.js';
export type { XYCircleFaceProfile, XYCirclePlanarFaceOptions, XYCirclePlanarFaceBundle, XYCirclePlanarFaceReport, XYCirclePlanarFaceResult, XYCirclePlanarFacePointResult } from './planar-solids/xy-circle-planar-face.js';
export { tessellateXYCirclePlanarFace } from './planar-solids/xy-circle-planar-face-preview.js';
export type { XYCirclePlanarFacePreviewOptions, XYCirclePlanarFaceEdgePath, XYCirclePlanarFaceEdgeProvenance, XYCirclePlanarFacePreviewReport, XYCirclePlanarFacePreviewResult } from './planar-solids/xy-circle-planar-face-preview.js';
export { buildXYCirclePrismShell, validateXYCirclePrismShellBundle } from './xy-circle-prism-shell.js';
export type { XYCirclePrismShellOptions, XYCirclePrismShellUse, XYCirclePrismShellBundle, XYCirclePrismShellReport, XYCirclePrismShellResult } from './xy-circle-prism-shell.js';
export { tessellateXYCirclePrismShell } from './planar-solids/xy-circle-prism-shell-preview.js';
export type { XYCirclePrismShellPreviewOptions, XYCirclePrismWallPanel, XYCirclePrismShellFaceRange, XYCirclePrismShellEdgePath, XYCirclePrismShellEdgeProvenance, XYCirclePrismShellPreviewReport, XYCirclePrismShellPreviewResult } from './planar-solids/xy-circle-prism-shell-preview.js';
export { evaluateXYCirclePrismDocument, updateXYCirclePrismDocument, serializeXYCirclePrismDocument, parseXYCirclePrismDocument } from './planar-solids/xy-circle-prism-document.js';
export type { XYCirclePrismDocumentV0, XYCirclePrismDocumentPatch, XYCirclePrismDocumentReport, XYCirclePrismDocumentResult } from './planar-solids/xy-circle-prism-document.js';
export { evaluateSketchCircleFeatureGraph, updateSketchCircleFeatureGraph, editSketchCircleFeatureGraphFeatures, editSketchCircleFeatureGraphParameters, serializeSketchCircleFeatureGraph, parseSketchCircleFeatureGraph } from './sketch/sketch-circle-feature-graph.js';
export type { SketchCircleLengthDefinition, SketchCircleLengthParameter, SketchCircleGraphFeature, SketchCircleFeatureGraphV0, SketchCircleFeatureGraphEdits, SketchCircleFeatureOperation, SketchCircleFeatureLifecycleEdits, SketchCircleParameterOperation, SketchCircleParameterLifecycleEdits, SketchCircleResolvedParameter, SketchCircleFeatureBindings, SketchCircleEvaluatedFeature, SketchCircleFeatureGraphReport, SketchCircleFeatureGraphResult } from './sketch/sketch-circle-feature-graph.js';
export { evaluateSketchRectangleFeatureGraph, updateSketchRectangleFeatureGraph, editSketchRectangleFeatureGraphFeatures, editSketchRectangleFeatureGraphParameters, serializeSketchRectangleFeatureGraph, parseSketchRectangleFeatureGraph } from './sketch/sketch-rectangle-feature-graph.js';
export type { SketchRectangleLengthDefinition, SketchRectangleLengthParameter, SketchRectangleGraphFeature, SketchRectangleFeatureGraphV0, SketchRectangleFeatureGraphEdits, SketchRectangleFeatureOperation, SketchRectangleFeatureLifecycleEdits, SketchRectangleParameterOperation, SketchRectangleParameterLifecycleEdits, SketchRectangleResolvedParameter, SketchRectangleFeatureBindings, SketchRectangleEvaluatedFeature, SketchRectangleFeatureGraphReport, SketchRectangleFeatureGraphResult } from './sketch/sketch-rectangle-feature-graph.js';
export { evaluateDrivenSketchCircleFeatureGraph, updateDrivenSketchCircleFeatureGraph, editDrivenSketchCircleFeatureGraphParameters, editDrivenSketchCircleFeatureGraphProfiles, serializeDrivenSketchCircleFeatureGraph, parseDrivenSketchCircleFeatureGraph } from './sketch/driven-sketch-circle-feature-graph.js';
export type { DrivenCircleRadiusDefinition, DrivenXYArcProfileIntent, DrivenXYArcSketchDocumentV0, DrivenSketchCircleFeatureGraphV1, DrivenSketchCircleFeatureGraphEdits, DrivenSketchCircleParameterLifecycleEdits, DrivenSketchCircleProfileOperation, DrivenSketchCircleProfileLifecycleEdits, DrivenCircleProfileDimension, DrivenCircleRadiusBindings, DrivenSketchCircleFeatureGraphReport, DrivenSketchCircleFeatureGraphResult } from './sketch/driven-sketch-circle-feature-graph.js';
export { buildZAxisRevolvedSurface } from './nurbs/surfaces/z-axis-revolved-surface.js';
export type { ZAxisRevolvedSurfaceOptions, ZAxisRevolvedSurfaceConstruction, ZAxisRevolveBoundaryObservation, ZAxisRevolvedSurfaceReport, ZAxisRevolvedSurfaceResult } from './nurbs/surfaces/z-axis-revolved-surface.js';
export { evaluateZAxisRevolveFeatureDocument, updateZAxisRevolveFeatureDocument, serializeZAxisRevolveFeatureDocument, parseZAxisRevolveFeatureDocument } from './features/z-axis-revolve-document.js';
export type { ZAxisRevolveFeatureDocumentV0, ZAxisRevolvePoleEdit, ZAxisRevolveFeatureDocumentEdits, ZAxisRevolveFeatureDocumentReport, ZAxisRevolveFeatureDocumentResult } from './features/z-axis-revolve-document.js';
export { tessellateZAxisRevolvedSurface } from './features/z-axis-revolve-preview.js';
export type { ZAxisRevolvePreviewOptions, ZAxisRevolvePreviewPanel, ZAxisRevolveBoundaryRole, ZAxisRevolveBoundaryPath, ZAxisRevolveBoundaryProvenance, ZAxisRevolvePreviewReport, ZAxisRevolvePreviewResult } from './features/z-axis-revolve-preview.js';
export { buildCompatibleRuledSurface } from './nurbs/surfaces/compatible-ruled-surface.js';
export type { CompatibleRuledSurfaceOptions, CompatibleRuledSurfaceConstruction, CompatibleRuledSurfaceObservation, CompatibleRuledSurfaceReport, CompatibleRuledSurfaceResult } from './nurbs/surfaces/compatible-ruled-surface.js';
export { insertCurveKnot } from './nurbs/curves/curve-knot-insertion.js';
export type { CurveKnotInsertionOptions, CurveKnotUnchangedPole, CurveKnotUnchangedKnot, CurveKnotInsertionStep, CurveKnotInsertionProvenance, CurveKnotInsertionReport, CurveKnotInsertionResult } from './nurbs/curves/curve-knot-insertion.js';
export { editSurfaceControlNet } from './nurbs/surfaces/surface-control-net.js';
export type { SurfacePoleField, SurfacePoleEdit, SurfaceControlNetEdits, SurfacePoleEditProvenance, SurfaceControlNetReport, SurfaceControlNetResult } from './nurbs/surfaces/surface-control-net.js';
export { insertSurfaceKnot } from './nurbs/surfaces/surface-knot-insertion.js';
export type { SurfaceKnotInsertionOptions, SurfaceKnotUnchangedPole, SurfaceKnotInsertionStrip, SurfaceKnotInsertionProvenance, SurfaceKnotGridCount, SurfaceKnotInsertionReport, SurfaceKnotInsertionResult } from './nurbs/surfaces/surface-knot-insertion.js';
export { extractSurfaceIsoCurve } from './nurbs/surfaces/surface-isocurve.js';
export type { SurfaceIsoCurveOptions, SurfaceIsoCurveBasis, SurfaceIsoCurveContribution, SurfaceIsoCurvePole, SurfaceIsoCurveProvenance, SurfaceIsoCurveReport, SurfaceIsoCurveResult } from './nurbs/surfaces/surface-isocurve.js';
export { splitSurfaceAtParameter } from './nurbs/surfaces/surface-parameter-split.js';
export type { SurfaceParameterSplitOptions, SurfaceSplitPoleMapping, SurfaceSplitKnotMapping, SurfaceSplitChildProvenance, SurfaceSplitRefinementProvenance, SurfaceSplitSharedCoefficients, SurfaceParameterSplitProvenance, SurfaceParameterSplitReport, SurfaceParameterSplitResult } from './nurbs/surfaces/surface-parameter-split.js';
export { splitCurveAtParameter } from './nurbs/curves/curve-parameter-split.js';
export type { CurveParameterSplitOptions, CurveSplitPoleMapping, CurveSplitKnotMapping, CurveSplitChildProvenance, CurveSplitRefinementProvenance, CurveSplitSharedCoefficient, CurveParameterSplitProvenance, CurveParameterSplitReport, CurveParameterSplitResult } from './nurbs/curves/curve-parameter-split.js';
export { editCurveControlPolygon } from './nurbs/curves/curve-control-polygon.js';
export type { CurvePoleField, CurvePoleEdit, CurveControlPolygonEdits, CurvePoleEditProvenance, CurveControlPolygonD1Evaluation, CurveControlPolygonD1Observation, CurveControlPolygonReport, CurveControlPolygonResult } from './nurbs/curves/curve-control-polygon.js';
export { elevateBezierCurveDegree } from './nurbs/curves/bezier-curve-degree-elevation.js';
export type { BezierCurveDegreeElevationOptions, BezierCurveElevatedInteriorPole, BezierCurveElevationKnot, BezierCurveDegreeElevationProvenance, BezierCurveDegreeD1Evaluation, BezierCurveDegreeD1Observation, BezierCurveDegreeElevationReport, BezierCurveDegreeElevationResult } from './nurbs/curves/bezier-curve-degree-elevation.js';
export { elevateSurfaceBezierAxisDegree } from './nurbs/surfaces/surface-bezier-axis-degree-elevation.js';
export type { SurfaceBezierAxisDegreeElevationOptions, SurfaceBezierAxisEndpointMapping, SurfaceBezierAxisDegreeStrip, SurfaceBezierAxisDegreeElevationProvenance, SurfaceBezierAxisD1Evaluation, SurfaceBezierAxisD1Observation, SurfaceBezierAxisDegreeElevationReport, SurfaceBezierAxisDegreeElevationResult } from './nurbs/surfaces/surface-bezier-axis-degree-elevation.js';
export { buildRationalRuledSurface } from './nurbs/surfaces/rational-ruled-surface.js';
export type { RationalRuledSurfaceOptions, RationalRuledSurfaceConstruction, RationalRuledSurfaceObservation, RationalRuledCurveD1Evaluation, RationalRuledSurfaceD1Evaluation, RationalRuledSurfaceD1Observation, RationalRuledSurfaceReport, RationalRuledSurfaceResult } from './nurbs/surfaces/rational-ruled-surface.js';
export { buildDegreeMatchedBezierRuledSurface } from './nurbs/surfaces/degree-matched-bezier-ruled.js';
export type { DegreeMatchedBezierRuledOptions, DegreeMatchedBezierSectionProvenance, DegreeMatchedBezierRuledProvenance, DegreeMatchedBezierPointObservation, DegreeMatchedBezierD1Evaluation, DegreeMatchedBezierD1Observation, DegreeMatchedBezierSectionReport, DegreeMatchedBezierRuledReport, DegreeMatchedBezierRuledResult } from './nurbs/surfaces/degree-matched-bezier-ruled.js';
export { buildOwnPlateCircularHole, validateOwnPlateCircularHoleBundle } from './own-plate-circular-hole.js';
export type { OwnPlateCircularHoleRequest, OwnPlateCircularHoleUse, OwnPlateCircularHoleLoop, OwnPlateCircularHoleFace, OwnPlateCircularHoleEdge, OwnPlateCircularHoleBundle, OwnPlateCircularHoleReport, OwnPlateCircularHoleResult } from './own-plate-circular-hole.js';
export { tessellateOwnPlateCircularHole, validateOwnNativeFaceMesh, validateOwnPlateHolePreviewContext } from './intersect/own-plate-circular-hole-preview.js';
export type { OwnPlateHolePreviewContext, OwnPlateHolePreviewOptions, OwnPlateHolePreviewFaceProvenance, OwnPlateHolePreviewReport, OwnPlateHolePreviewResult, OwnNativeFaceMesh, OwnNativeFaceMeshChunk } from './intersect/own-plate-circular-hole-preview.js';
export { intersectXYCirclePrismWallWithPlane, validateXYCirclePrismPlaneIntersection } from './intersect/own-plane-cylinder-intersection.js';
export type { XYCirclePrismPlaneIntersectionOptions, XYCirclePrismPlaneBindings, PlaneCylinderCurveD1State, PlaneCylinderSurfaceD1State, PlaneCylinderIntersectionObservation, PlaneCylinderHomogeneousSpan, XYCirclePrismPlaneIntersectionReport, XYCirclePrismPlaneSection, XYCirclePrismPlaneDisjoint, XYCirclePrismPlaneIntersectionResult } from './intersect/own-plane-cylinder-intersection.js';
export { intersectFiniteXYCirclePrismWallWithPlane, validateFiniteXYCirclePrismPlaneIntersection } from './intersect/own-plane-cylinder-clipped.js';
export type { FinitePlaneCylinderEquation, FinitePlaneCylinderBoundaryEvent, FinitePlaneCylinderEndpointApproximation, FinitePlaneCylinderPiece, FiniteXYCirclePrismPlaneIntersectionReport, FiniteXYCirclePrismPlaneIntersectionResult } from './intersect/own-plane-cylinder-clipped.js';
export type { FinitePlaneCylinderOriginalDerivativeGuard } from './intersect/own-plane-cylinder-clipped.js';
export { intersectBezierCurveWithAffinePlaneSurface, validateBezierCurveAffinePlaneIntersection } from './intersect/own-curve-plane-intersection.js';
export type { BezierCurveAffinePlaneIntersectionOptions, BezierCurveAffinePlaneIntersectionReport, BezierCurveAffinePlaneIntersectionResult, BezierCurvePlanePointEvent, CurveAffinePlaneAxes, CurvePlaneD1State } from './intersect/own-curve-plane-intersection.js';
export { intersectCurveWithAffinePlaneSurface, validateCurveAffinePlaneIntersection } from './intersect/own-multispan-curve-plane.js';
export { intersectCurveWideWithAffinePlaneSurface, validateWideCurveAffinePlaneIntersection, WideCurveAffinePlaneIntersectionError, WideCurveAffinePlaneIntersectionDiagnosticCode } from './nurbs/source-wide/curve-wide-plane-intersection.js';
export type { WideCurveAffinePlaneIntersectionOptions, WideCurveAffinePlaneIntersectionReport, WideCurveAffinePlaneIntersectionResult } from './nurbs/source-wide/curve-wide-plane-intersection.js';
export type { CurveAffinePlaneIntersectionOptions, CurveAffinePlaneSpan, CurvePlaneSpanContribution, CurvePlaneSideObservation, CurvePlanePointEvent, CurveAffinePlaneIntersectionReport, CurveAffinePlaneIntersectionResult } from './intersect/own-multispan-curve-plane.js';
export { clipCurvePlaneCoincidentIntervals, validateCurvePlaneCoincidentClip } from './intersect/own-coincident-plane-clip.js';
export type { PlaneClipBoundary, CurvePlaneCoincidentClipOptions, PlaneClipBoundaryContribution, PlaneClipContact, PlaneClipSpan, PlaneClipEndpointApproximation, PlaneClipBindingObservation, PlaneClipUVSplitProvenance, PlaneClipPiece, CurvePlaneCoincidentClipReport, CurvePlaneCoincidentClipResult } from './intersect/own-coincident-plane-clip.js';
export { intersectCoplanarCurveWithLineSegment, validateCoplanarCurveLineIntersection } from './intersect/own-curve-line-intersection.js';
export type { CoplanarCurveLineIntersectionOptions, CurveLineUVSplitProvenance, CurveLineRootContribution, CurveLineBinding, CurveLineSideObservation, CurveLinePointEvent, CurveLineBoundaryContribution, CurveLineOverlapContact, CurveLineSpan, CurveLineEndpointApproximation, CurveLineOverlapObservation, CurveLineOverlapPiece, CoplanarCurveLineIntersectionReport, CoplanarCurveLineIntersectionResult } from './intersect/own-curve-line-intersection.js';
export { clipCurveWithConvexLineLoop, validateConvexLineLoopClip } from './intersect/own-convex-loop-clip.js';
export type { ConvexNativeLineLoop, ConvexLineLoopClipOptions, ConvexLoopUVSplitProvenance, ConvexLoopContactContribution, ConvexLoopClipContact, ConvexLoopClipSpan, ConvexLoopEndpointApproximation, ConvexLoopBoundaryBinding, ConvexLoopPieceObservation, ConvexLoopClipPiece, ConvexLineLoopClipReport, ConvexLineLoopClipResult } from './intersect/own-convex-loop-clip.js';
export { buildConvexPlanarFace, validateConvexPlanarFace, classifyConvexPlanarFaceUV } from './own-convex-planar-face.js';
export type { ConvexPlanarFaceLoop, ConvexPlanarFaceOptions, ConvexPlanarFaceVertex, ConvexPlanarFaceEdge, ConvexPlanarFaceUse, ConvexPlanarFaceTopology, ConvexPlanarFacePcurve, ConvexPlanarFaceBinding, ConvexPlanarFaceReport, ConvexPlanarFaceResult, ConvexPlanarFaceBoundaryClassification, ConvexPlanarFaceUVClassification } from './own-convex-planar-face.js';
export { intersectConvexPlanarFaces, validateConvexPlanarFaceIntersection } from './intersect/own-convex-planar-face-intersection.js';
export type { ConvexPlanarFaceIntersectionOptions, ConvexFaceSupportUVMap, ConvexFaceIntersectionConstraint, ConvexFaceIntersectionContributor, ConvexFaceIntersectionEndpoint, ConvexFaceIntersectionBinding, ConvexFaceIntersectionSegment, ConvexFaceIntersectionPoint, ConvexPlanarFaceIntersectionReport, ConvexPlanarFaceIntersectionResult } from './intersect/own-convex-planar-face-intersection.js';
export { buildConvexPlanarFaceWithHoles, validateConvexPlanarFaceWithHoles, classifyConvexPlanarFaceWithHolesUV } from './intersect/own-convex-planar-face-holes.js';
export type { ConvexPlanarFaceWithHolesLoop, ConvexPlanarFaceWithHolesOptions, ConvexPlanarLoopRole, ConvexPlanarHoleVertex, ConvexPlanarHoleEdge, ConvexPlanarHoleUse, ConvexPlanarHolePcurve, ConvexPlanarHoleBinding, ConvexPlanarFaceHoleTopology, ConvexHoleContainmentEvidence, ConvexHolesSeparationEvidence, ConvexPlanarFaceWithHolesReport, ConvexPlanarFaceWithHolesResult, ConvexPlanarHoleBoundaryClassification, ConvexPlanarFaceWithHolesUVClassification } from './intersect/own-convex-planar-face-holes.js';
export { intersectConvexPlanarFacesWithHoles, validateConvexPlanarFaceWithHolesIntersection } from './intersect/own-convex-planar-face-holes-intersection.js';
export type { ConvexPlanarFaceWithHolesIntersectionOptions, HoleFaceIntersectionConstraint, HoleFaceLoopInterval, HoleFaceExcludedInterval, HoleFaceExcludedUnion, HoleFacePointObservation, HoleFaceIntersectionContributor, HoleFaceIntersectionEndpoint, HoleFaceIntersectionSegment, HoleFaceIntersectionPoint, HoleFaceBoundaryContact, ConvexPlanarFaceWithHolesIntersectionReport, ConvexPlanarFaceWithHolesIntersectionResult } from './intersect/own-convex-planar-face-holes-intersection.js';
export { tessellateConvexPlanarFaceWithHoles, validateConvexPlanarFaceWithHolesMesh } from './intersect/own-convex-planar-face-holes-preview.js';
export type { ConvexHoleMeshVertex, ConvexHoleMeshBoundaryPath, ConvexHoleMeshEdgeUse, ConvexHoleMeshTriangulation, ConvexPlanarFaceWithHolesMeshReport, ConvexPlanarFaceWithHolesMeshResult } from './intersect/own-convex-planar-face-holes-preview.js';
export { queryConvexPlanarFaceWithHolesRay, validateConvexPlanarFaceWithHolesRay } from './intersect/own-convex-planar-face-holes-ray.js';
export type { ConvexPlanarFaceWithHolesRayQuery, ConvexPlanarFaceWithHolesRayPolicy, ConvexPlanarFaceWithHolesRaySupport, ConvexPlanarFaceWithHolesRayCandidate, ConvexPlanarFaceWithHolesRayBoundary, ConvexPlanarFaceWithHolesRayHit, ConvexPlanarFaceWithHolesRayStatus, ConvexPlanarFaceWithHolesRayReason, ConvexPlanarFaceWithHolesRayReport, ConvexPlanarFaceWithHolesRayResult } from './intersect/own-convex-planar-face-holes-ray.js';
export { sampleCurveAdaptive, validateAdaptiveCurveSamples } from './nurbs/curves/curve-adaptive-sampling.js';
export type { AdaptiveCurveSamplingOptions, AdaptiveCurveSample, AdaptiveCurveObservation, AdaptiveCurveSegment, AdaptiveCurveSplitOperation, AdaptiveCurveSamplingReport, AdaptiveCurveSamplingResult } from './nurbs/curves/curve-adaptive-sampling.js';
export { joinCurves, validateJoinedCurveResult } from './nurbs/curves/curve-join.js';
export type { CurveJoinOptions, CurveJoinD1State, CurveJoinKnotMapping, CurveJoinProvenance, CurveJoinObservation, JoinedCurveReport, JoinedCurveResult } from './nurbs/curves/curve-join.js';
export { reverseCurve, validateReversedCurveResult, CurveReversalError } from './nurbs/curves/curve-reversal.js';
export { CurveReversalDiagnosticCode } from './nurbs/curves/curve-reversal.js';
export type { CurveReversalOptions, CurveReversalD1State, CurveReversalKnotMapping, CurveReversalProvenance, CurveReversalObservation, CurveReversalGuardObservation, ReversedCurveReport, ReversedCurveResult } from './nurbs/curves/curve-reversal.js';
export { extractCurveInterval, validateExtractedCurveInterval, CurveIntervalExtractionError, CurveIntervalExtractionDiagnosticCode } from './nurbs/curves/curve-interval-extraction.js';
export type { CurveIntervalExtractionOptions, CurveIntervalExtractionD1State, CurveIntervalBoundaryChoice, CurveIntervalSplitOperation, CurveIntervalExtractionProvenance, CurveIntervalExtractionObservation, CurveIntervalExtractionGuardObservation, ExtractedCurveIntervalReport, ExtractedCurveIntervalResult } from './nurbs/curves/curve-interval-extraction.js';
export { extractSurfaceRegion, validateExtractedSurfaceRegion, SurfaceRegionError, SurfaceRegionDiagnosticCode } from './nurbs/surfaces/surface-region.js';
export type { SurfaceRegionOptions, SurfaceRegionDomain, SurfaceRegionD1State, SurfaceRegionBoundaryChoice, SurfaceRegionSplitOperation, SurfaceRegionProvenance, SurfaceRegionObservation, SurfaceRegionGuardObservation, ExtractedSurfaceRegionReport, ExtractedSurfaceRegionResult } from './nurbs/surfaces/surface-region.js';
export { refineCurveWide, validateWideCurveRefinement, WideCurveRefinementError, WideCurveRefinementDiagnosticCode } from './nurbs/source-wide/curve-wide-refinement.js';
export type { WideCurveInsertionRequest, WideCurveRefinementOptions, WideCurveRefinementD1State, WideCurveHomogeneousPole, WideCurveRefinementOperation, WideCurveRefinementProvenance, WideCurveRefinementObservation, WideCurveRefinementGuardObservation, WideCurveRefinementReport, WideCurveRefinementResult } from './nurbs/source-wide/curve-wide-refinement.js';
export { reverseSurfaceAxis, validateReversedSurfaceAxis, SurfaceAxisReversalError, SurfaceAxisReversalDiagnosticCode } from './nurbs/surfaces/surface-axis-reversal.js';
export type { SurfaceAxisReversalOptions, SurfaceAxisReversalDomain, SurfaceAxisReversalD1State, SurfaceAxisReversalStrip, SurfaceAxisReversalCoefficientMapping, SurfaceAxisReversalProvenance, SurfaceAxisReversalObservation, SurfaceAxisReversalGuardObservation, ReversedSurfaceAxisReport, ReversedSurfaceAxisResult } from './nurbs/surfaces/surface-axis-reversal.js';
export { sampleCurveWideAdaptive, validateWideAdaptiveCurveSamples, WideAdaptiveCurveSamplingError, WideAdaptiveCurveSamplingDiagnosticCode } from './nurbs/source-wide/curve-wide-adaptive-sampling.js';
export type { WideAdaptiveCurveSamplingOptions, WideAdaptiveCurveSample, WideAdaptiveCurveD1State, WideAdaptiveCurveExtractionLevel, WideAdaptiveCurveSpan, WideAdaptiveCurveObservation, WideAdaptiveCurveSegment, WideAdaptiveCurveSplitOperation, WideAdaptiveCurveSamplingReport, WideAdaptiveCurveSamplingResult } from './nurbs/source-wide/curve-wide-adaptive-sampling.js';
export { extractCurveBezierSpans, validateCurveBezierSpans, CurveBezierSpanExtractionError, CurveBezierSpanExtractionDiagnosticCode } from './nurbs/curves/curve-bezier-spans.js';
export type { CurveBezierSpanExtractionOptions, CurveBezierSpan, CurveBezierSpanD1State, CurveBezierSpanObservation, CurveBezierSpanEndpoint, CurveBezierSpanExtractionReport, CurveBezierSpanExtractionResult } from './nurbs/curves/curve-bezier-spans.js';
export { createCadDocument, serializeCadDocument, parseCadDocument, validateCadDocumentResult, CadDocumentError, CadDocumentDiagnosticCode } from './cad-document.js';
export type { CadDocumentUnits, CadDocumentSourceAsset, CadDocumentBody, CadDocumentV1, CadDocumentCompiledAsset, CadDocumentBodyBinding, CadDocumentReport, CadDocumentResult } from './cad-document.js';
export { createCadGeometryReference, resolveCadGeometryReference, rebindCadGeometryReference, queryCadDocumentPoint, convertCadDocumentPoint, validateCadDocumentPoint, validateCadFrameConversion, CadReferenceError, CadReferenceDiagnosticCode } from './document/cad-document-reference.js';
export type { CadGeometryReferenceInput, CadGeometryReferenceV0, CadGeometryReferenceResult, CadGeometryRebindResult, CadDocumentPointQuery, CadDocumentPointResult, CadFrameConversionOptions, CadFrameConversionResult, CadReferenceReport, CadFrameConversionReport } from './document/cad-document-reference.js';
export { inspectCadDocumentCompatibility, migrateCadDocument, validateCadDocumentMigration, CadDocumentCompatibilityError, CadDocumentCompatibilityDiagnosticCode } from './document/cad-document-compatibility.js';
export type { CadDocumentCompatibilityInput, CadDocumentMigrationOptions, CadDocumentCompatibilityEntry, CadDocumentCompatibilityReport, CadDocumentMigrationMapping, CadDocumentMigrationResult } from './document/cad-document-compatibility.js';

export { getCadDocumentExportCapabilities, inspectCadDocumentExport, exportCadDocument, validateCadDocumentExport, CadDocumentExportError, CadDocumentExportDiagnosticCode } from './document/cad-document-export.js';
export type { CadDocumentExportCapability, CadDocumentExportSelection, CadDocumentExportOptions, CadDocumentExportMapping, CadDocumentExportReport, CadDocumentExportResult } from './document/cad-document-export.js';

export { intersectCubicBezierCurveWithAffinePlaneSurface, validateCubicBezierCurveAffinePlaneIntersection, CubicCurveAffinePlaneIntersectionError, CubicCurveAffinePlaneIntersectionDiagnosticCode } from './intersect/own-cubic-curve-plane-intersection.js';
export type { CubicCurveAffinePlaneIntersectionOptions, CubicCurveAffinePlaneIntersectionReport, CubicCurveAffinePlaneIntersectionResult, CubicCurvePlaneRootEvidence } from './intersect/own-cubic-curve-plane-intersection.js';

export { intersectCubicCurveWideWithAffinePlaneSurface, validateWideCubicCurveAffinePlaneIntersection, WideCubicCurveAffinePlaneIntersectionError, WideCubicCurveAffinePlaneIntersectionDiagnosticCode } from './nurbs/source-wide/curve-wide-cubic-plane-intersection.js';
export type { WideCubicCurveAffinePlaneIntersectionOptions, WideCubicCurveAffinePlaneSpan, WideCubicCurveAffinePlaneIntersectionReport, WideCubicCurveAffinePlaneIntersectionResult } from './nurbs/source-wide/curve-wide-cubic-plane-intersection.js';

export { editCurveControlPolygonWide, validateWideCurveControlPolygonEdit, WideCurveControlPolygonEditError, WideCurveControlPolygonEditDiagnosticCode } from './nurbs/source-wide/curve-wide-control-polygon.js';
export type { WideCurveControlPolygonEditReport, WideCurveControlPolygonEditResult } from './nurbs/source-wide/curve-wide-control-polygon.js';

export { reverseCurveWide, validateWideReversedCurveResult, WideCurveReversalError, WideCurveReversalDiagnosticCode } from './nurbs/source-wide/curve-wide-reversal.js';
export type { WideReversedCurveReport, WideReversedCurveResult } from './nurbs/source-wide/curve-wide-reversal.js';

export { buildThreeSectionLoftSurface, validateThreeSectionLoftSurface, ThreeSectionLoftError, ThreeSectionLoftDiagnosticCode } from './features/three-section-loft.js';
export type { ThreeSectionLoftOptions, ThreeSectionLoftObservation, ThreeSectionLoftD1Observation, ThreeSectionLoftProvenance, ThreeSectionLoftReport, ThreeSectionLoftResult } from './features/three-section-loft.js';

export { queryCadDocumentBounds, validateCadDocumentBounds, CadDocumentBoundsError, CadDocumentBoundsDiagnosticCode } from './document/cad-document-bounds.js';
export type { CadDocumentBoundsReport, CadDocumentBoundsResult } from './document/cad-document-bounds.js';

export { queryCadDocumentCurveArcLength, validateCadDocumentCurveArcLength, CadCurveArcLengthError, CadCurveArcLengthDiagnosticCode } from './nurbs/curves/cad-curve-arc-length.js';
export type { CadCurveArcLengthOptions, CadCurveArcLengthPanel, CadCurveArcLengthReport, CadCurveArcLengthResult } from './nurbs/curves/cad-curve-arc-length.js';

export { queryCadDocumentSurfaceArea, validateCadDocumentSurfaceArea, CadSurfaceAreaError, CadSurfaceAreaDiagnosticCode } from './nurbs/surfaces/cad-surface-area.js';
export type { CadSurfaceAreaOptions, CadSurfaceAreaCell, CadSurfaceAreaReport, CadSurfaceAreaResult } from './nurbs/surfaces/cad-surface-area.js';

export { evaluateCadAssembly, serializeCadAssembly, parseCadAssembly, updateCadAssembly, validateCadAssemblyResult, CadAssemblyError, CadAssemblyDiagnosticCode } from './document/cad-assembly.js';
export type { CadAssemblyMatrix, CadAssemblyPlacement, CadAssemblyInstance, CadAssemblyV0, CadAssemblyEvaluatedInstance, CadAssemblyEdits, CadAssemblyReport, CadAssemblyResult } from './document/cad-assembly.js';
export { queryCadAssemblyInstancePoint, validateCadAssemblyInstancePoint } from './document/cad-assembly-instance-point.js';
export type { CadAssemblyInstancePointQuery, CadAssemblyInstancePointReport, CadAssemblyInstancePointResult } from './document/cad-assembly-instance-point.js';

export { transactCadAssemblyMembers, validateCadAssemblyMemberTransaction } from './document/cad-assembly-members.js';
export type { CadAssemblyMemberTransaction, CadAssemblyMemberReport, CadAssemblyMemberResult } from './document/cad-assembly-members.js';

export { replaceCadAssemblyPart, validateCadAssemblyPartReplacement } from './document/cad-assembly-part-replacement.js';
export type { CadAssemblyPartReplacement, CadAssemblyPartReplacementReport, CadAssemblyPartReplacementResult } from './document/cad-assembly-part-replacement.js';

export { booleanCoplanarFaces, validateCoplanarFaceBoolean, CoplanarFaceBooleanError, CoplanarFaceBooleanDiagnosticCode } from './planar-solids/coplanar-face-boolean.js';
export type { CoplanarFaceBooleanOptions, CoplanarFaceBooleanContributor, CoplanarFaceBooleanEvent, CoplanarFaceBooleanFragment, CoplanarFaceBooleanLoop, CoplanarFaceBooleanComponent, CoplanarFaceBooleanReport, CoplanarFaceBooleanResult } from './planar-solids/coplanar-face-boolean.js';

export { tessellateCoplanarFaceBoolean, validateCoplanarFaceBooleanMesh, CoplanarFaceBooleanMeshError, CoplanarFaceBooleanMeshDiagnosticCode } from './planar-solids/coplanar-face-boolean-mesh.js';
export type { CoplanarFaceBooleanMeshOptions, CoplanarFaceBooleanMeshVertex, CoplanarFaceBooleanMeshBoundaryPath, CoplanarFaceBooleanMeshEdgeUse, CoplanarFaceBooleanMeshTriangulation, CoplanarFaceBooleanMeshReport, CoplanarFaceBooleanMeshResult } from './planar-solids/coplanar-face-boolean-mesh.js';

export { extrudeCoplanarFaceBoolean, validateCoplanarFaceBooleanExtrusion, CoplanarFaceBooleanExtrusionError, CoplanarFaceBooleanExtrusionDiagnosticCode } from './planar-solids/coplanar-face-boolean-extrusion.js';
export type { CoplanarFaceBooleanExtrusionOptions, CoplanarFaceBooleanExtrusionVertex, CoplanarFaceBooleanExtrusionEdgeUse, CoplanarFaceBooleanExtrusionFace, CoplanarFaceBooleanExtrusionShell, CoplanarFaceBooleanExtrusionReport, CoplanarFaceBooleanExtrusionResult } from './planar-solids/coplanar-face-boolean-extrusion.js';

export { tessellateCoplanarFaceBooleanExtrusion, validateCoplanarFaceBooleanExtrusionMesh, CoplanarFaceBooleanExtrusionMeshError, CoplanarFaceBooleanExtrusionMeshDiagnosticCode } from './planar-solids/coplanar-face-boolean-extrusion-mesh.js';
export type { CoplanarFaceBooleanExtrusionMeshOptions, CoplanarFaceBooleanExtrusionMeshVertex, CoplanarFaceBooleanExtrusionMeshFaceRange, CoplanarFaceBooleanExtrusionMeshEdgePath, CoplanarFaceBooleanExtrusionMeshShellRange, CoplanarFaceBooleanExtrusionMeshReport, CoplanarFaceBooleanExtrusionMeshResult } from './planar-solids/coplanar-face-boolean-extrusion-mesh.js';

export { evaluateBooleanExtrusionFeatureGraph, updateBooleanExtrusionFeatureGraph, validateBooleanExtrusionFeatureGraph, BooleanExtrusionFeatureGraphError, BooleanExtrusionFeatureGraphDiagnosticCode } from './features/boolean-extrusion-feature-graph.js';
export { serializeBooleanExtrusionFeatureGraph, parseBooleanExtrusionFeatureGraph } from './features/boolean-extrusion-feature-graph-serde.js';
export type { BooleanExtrusionLengthDefinition, BooleanExtrusionLengthParameter, BooleanExtrusionFaceFeature, BooleanExtrusionBooleanFeature, BooleanExtrusionExtrusionFeature, BooleanExtrusionFeatureGraphV0, BooleanExtrusionFeatureGraphOptions, BooleanExtrusionFeatureGraphEdits, BooleanExtrusionFeatureGraphResolvedParameter, BooleanExtrusionFeatureGraphEvaluatedFeature, BooleanExtrusionFeatureGraphReport, BooleanExtrusionFeatureGraphResult } from './features/boolean-extrusion-feature-graph.js';

export { transactBooleanExtrusionFeatureGraphParameters } from './features/boolean-extrusion-parameter-lifecycle.js';
export type { BooleanExtrusionParameterOperation, BooleanExtrusionParameterTransaction } from './features/boolean-extrusion-parameter-lifecycle.js';

export { transactBooleanExtrusionFeatureGraphFeatures } from './features/boolean-extrusion-feature-lifecycle.js';
export type { BooleanExtrusionFeatureOperation, BooleanExtrusionFeatureTransaction } from './features/boolean-extrusion-feature-lifecycle.js';

export { createNativeExtrusionPreviewAcceptanceV1 } from './exact-proof/native-extrusion-preview-acceptance-v1.js';
export type { NativeExtrusionPreviewTicketV1, NativeExtrusionPreparedV1, NativeExtrusionAcceptedV1, NativeExtrusionPreviewAcceptanceSessionV1 } from './exact-proof/native-extrusion-preview-acceptance-v1.js';

export { measureCoplanarFaceBooleanExtrusion, validateCoplanarFaceBooleanExtrusionProperties, CoplanarFaceBooleanExtrusionPropertiesError, CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode } from './planar-solids/coplanar-face-boolean-extrusion-properties.js';
export type { CoplanarFaceBooleanExtrusionPropertiesOptions, CoplanarFaceBooleanExtrusionPropertiesComponent, CoplanarFaceBooleanExtrusionPropertiesReport, CoplanarFaceBooleanExtrusionPropertiesResult } from './planar-solids/coplanar-face-boolean-extrusion-properties.js';

export { buildTranslationalSweepSurface, validateTranslationalSweepSurface, TranslationalSweepError, TranslationalSweepDiagnosticCode } from './nurbs/surfaces/translational-sweep-surface.js';
export type { TranslationalSweepOptions, TranslationalSweepProvenance, TranslationalSweepObservation, TranslationalSweepReport, TranslationalSweepResult } from './nurbs/surfaces/translational-sweep-surface.js';

export { buildInterpolatingCurve, validateInterpolatingCurve, CurveInterpolationError, CurveInterpolationDiagnosticCode } from './nurbs/curves/curve-interpolation.js';
export type { CurveInterpolationPoint, CurveInterpolationOptions, CurveInterpolationReport, CurveInterpolationResult } from './nurbs/curves/curve-interpolation.js';

export { buildInterpolatingSurface, validateInterpolatingSurface, SurfaceInterpolationError, SurfaceInterpolationDiagnosticCode } from './nurbs/surfaces/surface-interpolation.js';
export type { SurfaceInterpolationOptions, SurfaceInterpolationObservation, SurfaceInterpolationReport, SurfaceInterpolationResult } from './nurbs/surfaces/surface-interpolation.js';

export { buildParameterizedInterpolatingCurve, validateParameterizedInterpolatingCurve, CurveParameterizationError, CurveParameterizationDiagnosticCode } from './nurbs/curves/curve-parameterization.js';
export type { CurveParameterizationMethod, CurveParameterizationOptions, CurveParameterizationReport, CurveParameterizationResult } from './nurbs/curves/curve-parameterization.js';

export { buildWeightedInterpolatingCurve, validateWeightedInterpolatingCurve, WeightedCurveInterpolationError, WeightedCurveInterpolationDiagnosticCode } from './nurbs/curves/weighted-curve-interpolation.js';
export type { WeightedCurveInterpolationPoint, WeightedCurveInterpolationOptions, WeightedCurveInterpolationReport, WeightedCurveInterpolationResult } from './nurbs/curves/weighted-curve-interpolation.js';

export { buildMultiSectionLoftSurface, validateMultiSectionLoftSurface, MultiSectionLoftError, MultiSectionLoftDiagnosticCode } from './features/multi-section-loft.js';
export type { MultiSectionLoftOptions, MultiSectionLoftProvenance, MultiSectionLoftObservation, MultiSectionLoftReport, MultiSectionLoftResult } from './features/multi-section-loft.js';

export { transformNativeGeometryAffine, validateAffineGeometryTransform, AffineGeometryTransformError, AffineGeometryTransformDiagnosticCode } from './features/affine-geometry-transform.js';
export type { CadAffineMatrix3x4, AffineGeometryTransformOptions, AffineGeometryTransformObservation, AffineGeometryTransformReport, AffineGeometryTransformResult } from './features/affine-geometry-transform.js';

export { buildLinearGeometryPattern, validateLinearGeometryPattern, LinearGeometryPatternError, LinearGeometryPatternDiagnosticCode } from './features/linear-geometry-pattern.js';
export type { LinearGeometryPatternOptions, LinearGeometryPatternInstance, LinearGeometryPatternReport, LinearGeometryPatternResult } from './features/linear-geometry-pattern.js';

export { buildCircularGeometryPattern, validateCircularGeometryPattern, CircularGeometryPatternError, CircularGeometryPatternDiagnosticCode } from './features/circular-geometry-pattern.js';
export type { CircularGeometryPatternOptions, CircularGeometryPatternInstance, CircularGeometryPatternReport, CircularGeometryPatternResult } from './features/circular-geometry-pattern.js';

export { evaluateCurveD2, evaluateSurfaceD2, NativeSecondDerivativeError, NativeSecondDerivativeDiagnosticCode } from './core/second-derivatives.js';
export type { CurveD2Result, SurfaceD2Result } from './core/second-derivatives.js';

export { evaluateCurveCurvature, evaluateSurfaceCurvature, NativeCurvatureError, NativeCurvatureDiagnosticCode } from './nurbs/surfaces/local-curvature.js';
export type { CurveCurvatureResult, SurfaceCurvatureResult } from './nurbs/surfaces/local-curvature.js';

export { intersectCurveWithPlanarFaceMaterial, validateCurvePlanarFaceMaterialIntersection, CurvePlanarFaceMaterialError, CurvePlanarFaceMaterialDiagnosticCode } from './nurbs/curves/curve-planar-face-material.js';
export type { CurvePlanarFaceMaterialOptions, CurvePlanarFaceMaterialEvent, CurvePlanarFaceMaterialReport, CurvePlanarFaceMaterialResult } from './nurbs/curves/curve-planar-face-material.js';

export { estimateCoplanarFaceBooleanExtrusionMass, validateCoplanarFaceBooleanExtrusionMass, CoplanarFaceBooleanExtrusionMassError, CoplanarFaceBooleanExtrusionMassDiagnosticCode } from './planar-solids/coplanar-face-boolean-extrusion-mass.js';
export type { CoplanarFaceBooleanExtrusionMassOptions, CoplanarFaceBooleanExtrusionMassComponent, CoplanarFaceBooleanExtrusionMassReport, CoplanarFaceBooleanExtrusionMassResult } from './planar-solids/coplanar-face-boolean-extrusion-mass.js';

export { analyzeExtrusionConstructionPrincipalInertia, validateExtrusionConstructionPrincipalInertia, ExtrusionPrincipalInertiaError, ExtrusionPrincipalInertiaDiagnosticCode } from './features/extrusion-principal-inertia.js';
export type { ExtrusionPrincipalInertiaOptions, ExtrusionPrincipalInertiaAxis, ExtrusionPrincipalInertiaReport, ExtrusionPrincipalInertiaResult } from './features/extrusion-principal-inertia.js';

export { buildAlignedRationalRuledSurface, validateAlignedRationalRuledSurface, SectionKnotAlignmentError, SectionKnotAlignmentDiagnosticCode } from './features/section-knot-alignment.js';
export type { SectionKnotAlignmentOptions, SectionKnotAlignmentSection, SectionKnotAlignmentReport, SectionKnotAlignmentResult } from './features/section-knot-alignment.js';

export { buildExactBoundaryFaceAdjacency, validateExactBoundaryFaceAdjacency, ExactBoundaryFaceAdjacencyError, ExactBoundaryFaceAdjacencyDiagnosticCode } from './exact-proof/exact-boundary-face-adjacency.js';
export type { ExactBoundaryFaceAdjacencyAsset, ExactBoundaryFaceAdjacencyPair, ExactBoundaryFaceAdjacencyOptions, ExactBoundaryFaceAdjacencyEdge, ExactBoundaryFaceAdjacencyReport, ExactBoundaryFaceAdjacencyResult } from './exact-proof/exact-boundary-face-adjacency.js';

export { buildQuinticHermiteCurve, validateQuinticHermiteCurve, QuinticHermiteError, QuinticHermiteDiagnosticCode } from './nurbs/curves/quintic-hermite-curve.js';
export type { QuinticHermiteEndpoint, QuinticHermiteOptions, QuinticHermiteReport, QuinticHermiteResult } from './nurbs/curves/quintic-hermite-curve.js';

export { inspectCurveEndpointContinuity, validateCurveEndpointContinuity, CurveEndpointContinuityError, CurveEndpointContinuityDiagnosticCode } from './nurbs/curves/curve-endpoint-continuity.js';
export type { CurveEndpointContinuityInput, CurveEndpointContinuityOptions, CurveEndpointContinuityReport, CurveEndpointContinuityResult } from './nurbs/curves/curve-endpoint-continuity.js';

export { buildClosedExactPatchShell, validateClosedExactPatchShell, ClosedExactPatchShellError, ClosedExactPatchShellDiagnosticCode } from './brep/closed-exact-patch-shell.js';
export type { ClosedExactPatchShellOptions, ClosedExactPatchShellGraph, ClosedExactPatchShellReport, ClosedExactPatchShellResult } from './brep/closed-exact-patch-shell.js';

export { buildVLinearSurfacePlaneSection, validateVLinearSurfacePlaneSection, VLinearSurfacePlaneSectionError, VLinearSurfacePlaneSectionDiagnosticCode } from './intersect/vlinear-plane-section.js';
export type { VLinearSurfacePlaneSectionAsset, VLinearSurfacePlaneSectionOptions, VLinearSurfacePlaneSectionReport, VLinearSurfacePlaneSectionResult } from './intersect/vlinear-plane-section.js';

export { editSourceSurfaceControlNet, validateSourceSurfaceControlNetEdit, SourceSurfaceControlNetError, SourceSurfaceControlNetDiagnosticCode } from './nurbs/source-wide/source-surface-control-net.js';
export type { SourceSurfaceControlNetRequest, SourceSurfaceControlNetPatch, SourceSurfaceControlNetReport, SourceSurfaceControlNetResult } from './nurbs/source-wide/source-surface-control-net.js';

export { editSourceSurfaceControlNetWide, validateSourceSurfaceControlNetWideEdit, SourceSurfaceControlNetWideError, SourceSurfaceControlNetWideDiagnosticCode } from './nurbs/source-wide/source-surface-control-net-wide.js';
export type { SourceSurfaceControlNetWideRequest, SourceSurfaceControlNetWidePatch, SourceSurfaceControlNetWideReport, SourceSurfaceControlNetWideResult } from './nurbs/source-wide/source-surface-control-net-wide.js';

export { editSourceCurveControlPolygon, validateSourceCurveControlPolygonEdit, SourceCurveControlPolygonError, SourceCurveControlPolygonDiagnosticCode } from './nurbs/source-wide/source-curve-control-polygon.js';
export type { SourceCurveControlPolygonRequest, SourceCurveControlPolygonPatch, SourceCurveControlPolygonReport, SourceCurveControlPolygonResult } from './nurbs/source-wide/source-curve-control-polygon.js';

export { buildPiecewiseRationalLoftSurface, validatePiecewiseRationalLoftSurface, PiecewiseRationalLoftError, PiecewiseRationalLoftDiagnosticCode } from './features/piecewise-rational-loft.js';
export type { PiecewiseRationalLoftOptions, PiecewiseRationalLoftProvenance, PiecewiseRationalLoftReport, PiecewiseRationalLoftResult } from './features/piecewise-rational-loft.js';

export { buildVLinearSurfacePlaneTrimCandidates, validateVLinearSurfacePlaneTrimCandidates, VLinearSurfacePlaneTrimError, VLinearSurfacePlaneTrimDiagnosticCode } from './intersect/vlinear-plane-trim.js';
export type { VLinearSurfacePlaneTrimOptions, VLinearSurfacePlaneTrimEdge, VLinearSurfacePlaneTrimReport, VLinearSurfacePlaneTrimResult } from './intersect/vlinear-plane-trim.js';

export { classifyVLinearSurfacePlaneTrimUV, validateVLinearSurfacePlaneTrimUVClassification, VLinearSurfacePlaneTrimUVError, VLinearSurfacePlaneTrimUVDiagnosticCode } from './intersect/vlinear-plane-trim-classification.js';
export type { VLinearSurfacePlaneTrimUVQuery, VLinearSurfacePlaneTrimUVOptions, VLinearSurfacePlaneTrimUVReport, VLinearSurfacePlaneTrimUVResult } from './intersect/vlinear-plane-trim-classification.js';

export { buildAxisBoxSolidBoolean, validateAxisBoxSolidBoolean, AxisBoxSolidBooleanError, AxisBoxSolidBooleanDiagnosticCode } from './axis-box-boolean.js';
export type { AxisBoxSolidBooleanAsset, AxisBoxSolidBooleanOptions, AxisBoxSolidBooleanReport, AxisBoxSolidBooleanResult } from './axis-box-boolean.js';

export { classifyAxisBoxSolidBooleanPoints, validateAxisBoxSolidBooleanPointClassification, AxisBoxSolidBooleanPointError, AxisBoxSolidBooleanPointDiagnosticCode } from './planar-solids/axis-box-point-classification.js';
export type { AxisBoxSolidBooleanPointQuery, AxisBoxSolidBooleanPointOptions, AxisBoxSolidBooleanPointReport, AxisBoxSolidBooleanPointResult } from './planar-solids/axis-box-point-classification.js';

export { measureAxisBoxSolidBooleanMass, validateAxisBoxSolidBooleanMass, AxisBoxSolidMassError, AxisBoxSolidMassDiagnosticCode } from './axis-box-solid-mass.js';
export type { AxisBoxSolidMassOptions, AxisBoxSolidMassMeasure, AxisBoxSolidMassReport, AxisBoxSolidMassResult } from './axis-box-solid-mass.js';

export { analyzeAxisBoxSolidPrincipalInertia, validateAxisBoxSolidPrincipalInertia, AxisBoxSolidPrincipalInertiaError, AxisBoxSolidPrincipalInertiaDiagnosticCode } from './planar-solids/axis-box-principal-inertia.js';
export type { AxisBoxSolidPrincipalInertiaSelection, AxisBoxSolidPrincipalInertiaOptions, AxisBoxSolidPrincipalInertiaReport, AxisBoxSolidPrincipalInertiaResult } from './planar-solids/axis-box-principal-inertia.js';

export { transformAxisBoxSolidMassFrame, validateAxisBoxSolidMassFrame, AxisBoxSolidMassFrameError, AxisBoxSolidMassFrameDiagnosticCode } from './planar-solids/axis-box-mass-frame.js';
export type { AxisBoxSolidMassFramePose, AxisBoxSolidMassFrameOptions, AxisBoxSolidMassFrameReport, AxisBoxSolidMassFrameResult } from './planar-solids/axis-box-mass-frame.js';

export { buildAxisBoxSolidFeatureDocument, editAxisBoxSolidFeatureDocument, validateAxisBoxSolidFeatureDocument, serializeAxisBoxSolidFeatureDocument, parseAxisBoxSolidFeatureDocument, AxisBoxSolidFeatureDocumentError, AxisBoxSolidFeatureDocumentDiagnosticCode } from './planar-solids/axis-box-solid-feature-document.js';
export type { AxisBoxSolidFeatureDocumentV0, AxisBoxSolidFeatureDocumentOperand, AxisBoxSolidFeatureDocumentEdit, AxisBoxSolidFeatureDocumentReport, AxisBoxSolidFeatureDocumentResult } from './planar-solids/axis-box-solid-feature-document.js';

export { buildXYAngleArc, validateXYAngleArc, XYAngleArcError, XYAngleArcDiagnosticCode } from './sketch/xy-angle-arc.js';
export type { XYAngleArcRequest, XYAngleArcReport, XYAngleArcResult } from './sketch/xy-angle-arc.js';

export { evaluateMixedWorkplaneSketchDocument, updateMixedWorkplaneSketchDocument, validateMixedWorkplaneSketchDocument, serializeMixedWorkplaneSketchDocument, parseMixedWorkplaneSketchDocument, MixedWorkplaneSketchDocumentError, MixedWorkplaneSketchDocumentDiagnosticCode } from './sketch/mixed-workplane-sketch-document.js';
export type { MixedWorkplaneSketchProfileIntent, MixedWorkplaneSketchDocumentV0, MixedWorkplaneSketchDocumentEdit, MixedWorkplaneSketchDocumentReport, MixedWorkplaneSketchDocumentResult } from './sketch/mixed-workplane-sketch-document.js';

export { evaluateDrivenMixedSketchLines, updateDrivenMixedSketchLines, validateDrivenMixedSketchLines, serializeDrivenMixedSketchLines, parseDrivenMixedSketchLines, DrivenMixedSketchLinesError, DrivenMixedSketchLinesDiagnosticCode } from './sketch/driven-mixed-sketch-lines.js';
export type { DrivenMixedSketchLinesSegmentBinding, DrivenMixedSketchLinesDocumentV0, DrivenMixedSketchLinesDocumentEdit, DrivenMixedSketchLinesReport, DrivenMixedSketchLinesResult } from './sketch/driven-mixed-sketch-lines.js';

export { qualifyStoredPlateHoleSolid, validateStoredPlateHoleSolid, serializeStoredPlateHoleSolid, parseStoredPlateHoleSolid, StoredPlateHoleSolidError, StoredPlateHoleSolidDiagnosticCode } from './stored-plate-hole-solid.js';
export type { StoredPlateHoleSolidGerm, StoredPlateHoleSolidCorner, StoredPlateHoleSolidVertexLink, StoredPlateHoleSolidCertificate, StoredPlateHoleSolidResult } from './stored-plate-hole-solid.js';
export { qualifyKnownSolid } from './features/known-solid-qualification.js';
export type { KnownSolidFamily, KnownSolidRequest, KnownSolidQualification, KnownTopologyKind, KnownTopologyCheck, KnownSolidRefusalReason } from './features/known-solid-qualification.js';

export { verifyXYAngleArcArtifact, validateXYAngleArcArtifactVerification, serializeXYAngleArcArtifact, parseXYAngleArcArtifact, XYAngleArcArtifactError, XYAngleArcArtifactDiagnosticCode } from './sketch/xy-angle-arc-artifact.js';
export type { XYAngleArcArtifactFieldRule, XYAngleArcArtifactReport, XYAngleArcArtifactVerification } from './sketch/xy-angle-arc-artifact.js';

export { classifyStoredPlateHoleSolidPoints, validateStoredPlateHoleSolidPoints, serializeStoredPlateHoleSolidPoints, parseStoredPlateHoleSolidPoints, StoredPlateHolePointError, StoredPlateHolePointDiagnosticCode } from './planar-solids/stored-plate-hole-point-classification.js';
export type { StoredPlateHolePointQuery, StoredPlateHolePointOptions, StoredPlateHolePointProof, StoredPlateHolePointClassification, StoredPlateHolePointReport, StoredPlateHolePointResult } from './planar-solids/stored-plate-hole-point-classification.js';

export { buildMultiSpanVLinearSurfacePlaneSection, validateMultiSpanVLinearSurfacePlaneSection, MultiSpanVLinearSurfacePlaneSectionError, MultiSpanVLinearSurfacePlaneSectionDiagnosticCode } from './intersect/multispan-vlinear-plane-section.js';
export type { MultiSpanVLinearSurfacePlaneSectionAsset, MultiSpanVLinearSurfacePlaneSectionOptions, MultiSpanVLinearSurfacePlaneSectionReport, MultiSpanVLinearSurfacePlaneSectionResult } from './intersect/multispan-vlinear-plane-section.js';

export { buildMultiSpanVLinearSurfacePlaneTrimCandidates, validateMultiSpanVLinearSurfacePlaneTrimCandidates, MultiSpanVLinearSurfacePlaneTrimError, MultiSpanVLinearSurfacePlaneTrimDiagnosticCode } from './intersect/multispan-vlinear-plane-trim.js';
export type { MultiSpanVLinearSurfacePlaneTrimOptions, MultiSpanVLinearSurfacePlaneTrimEdge, MultiSpanVLinearSurfacePlaneTrimReport, MultiSpanVLinearSurfacePlaneTrimResult } from './intersect/multispan-vlinear-plane-trim.js';

export { classifyMultiSpanVLinearSurfacePlaneTrimUV, validateMultiSpanVLinearSurfacePlaneTrimUVClassification, MultiSpanVLinearSurfacePlaneTrimUVError, MultiSpanVLinearSurfacePlaneTrimUVDiagnosticCode } from './intersect/multispan-vlinear-plane-trim-classification.js';
export type { MultiSpanVLinearSurfacePlaneTrimUVQuery, MultiSpanVLinearSurfacePlaneTrimUVOptions, MultiSpanVLinearSurfacePlaneTrimUVReport, MultiSpanVLinearSurfacePlaneTrimUVResult } from './intersect/multispan-vlinear-plane-trim-classification.js';

export { buildPairedSectionPlaneCap, validatePairedSectionPlaneCap, PairedSectionPlaneCapError, PairedSectionPlaneCapDiagnosticCode } from './paired/paired-section-plane-cap.js';
export type { PairedSectionPlaneCapOptions, PairedSectionPlaneCapEdge, PairedSectionPlaneCapReport, PairedSectionPlaneCapResult } from './paired/paired-section-plane-cap.js';

export { buildSectionExactSurfaceBinding, validateSectionExactSurfaceBinding, SectionExactSurfaceBindingError, SectionExactSurfaceBindingDiagnosticCode } from './features/section-exact-surface-binding.js';
export type { SectionExactSurfaceBindingOptions, SectionExactSurfaceBindingSpanProof, SectionExactSurfaceBindingReport, SectionExactSurfaceBindingResult } from './features/section-exact-surface-binding.js';

export { buildExactSurfaceLowerTrim, validateExactSurfaceLowerTrim, ExactSurfaceLowerTrimError, ExactSurfaceLowerTrimDiagnosticCode } from './exact-proof/exact-surface-lower-trim.js';
export type { ExactSurfaceLowerTrimOptions, ExactSurfaceLowerTrimEdge, ExactSurfaceLowerTrimReport, ExactSurfaceLowerTrimResult } from './exact-proof/exact-surface-lower-trim.js';

export { buildTranslatedSurfaceBaseFace, validateTranslatedSurfaceBaseFace, TranslatedSurfaceBaseFaceError, TranslatedSurfaceBaseFaceDiagnosticCode } from './translated-strip/translated-surface-base-face.js';
export type { TranslatedSurfaceBaseFaceOptions, TranslatedSurfaceBaseFaceEdge, TranslatedSurfaceBaseFaceReport, TranslatedSurfaceBaseFaceResult } from './translated-strip/translated-surface-base-face.js';

export { measureTranslatedSurfaceStripVolume, validateTranslatedSurfaceStripVolume, TranslatedSurfaceStripVolumeError, TranslatedSurfaceStripVolumeDiagnosticCode } from './translated-strip/translated-surface-strip-volume.js';
export type { TranslatedSurfaceStripVolumeOptions, TranslatedSurfaceStripVolumeSpan, TranslatedSurfaceStripVolumeReport, TranslatedSurfaceStripVolumeResult } from './translated-strip/translated-surface-strip-volume.js';

export { buildTranslatedSurfaceEndFaces, validateTranslatedSurfaceEndFaces, TranslatedSurfaceEndFacesError, TranslatedSurfaceEndFacesDiagnosticCode } from './translated-strip/translated-surface-end-faces.js';
export type { TranslatedSurfaceEndFacesOptions, TranslatedSurfaceEndFace, TranslatedSurfaceEndFacesReport, TranslatedSurfaceEndFacesResult } from './translated-strip/translated-surface-end-faces.js';

export { buildQualifiedTranslatedStripBody, validateQualifiedTranslatedStripBody, QualifiedTranslatedStripBodyError, QualifiedTranslatedStripBodyDiagnosticCode } from './translated-strip/qualified-translated-strip-body.js';
export type { QualifiedTranslatedStripBodyOptions, QualifiedTranslatedStripBodyEdge, QualifiedTranslatedStripBodyReport, QualifiedTranslatedStripBodyResult } from './translated-strip/qualified-translated-strip-body.js';

export { classifyTranslatedSurfaceStripWorldPoints, validateTranslatedSurfaceStripWorldPointClassification, TranslatedSurfaceStripWorldPointError, TranslatedSurfaceStripWorldPointDiagnosticCode } from './translated-strip/translated-surface-strip-world-points.js';
export type { TranslatedSurfaceStripWorldPointQuery, TranslatedSurfaceStripWorldPointOptions, TranslatedSurfaceStripWorldPointReport, TranslatedSurfaceStripWorldPointResult } from './translated-strip/translated-surface-strip-world-points.js';

export { evaluateNurbsSourceLoftFeatureGraph, updateNurbsSourceLoftFeatureGraph, validateNurbsSourceLoftFeatureGraph, validateNurbsSourceLoftFeatureGraphUpdate, serializeNurbsSourceLoftFeatureGraph, parseNurbsSourceLoftFeatureGraph, NurbsSourceLoftFeatureGraphError, NurbsSourceLoftFeatureGraphDiagnosticCode } from './features/nurbs-source-loft-feature-graph.js';
export type { NurbsSourceLoftFeatureGraphV0, NurbsSourceLoftFeatureGraphOptions, NurbsSourceLoftFeatureGraphEdits, NurbsSourceLoftFeatureGraphResult, NurbsSourceLoftFeatureGraphReport, NurbsSourceLoftFeatureGraphTransaction, NurbsSourceLoftFeatureGraphTransactionReport, NurbsSourceLoftFeatureGraphUpdateResult } from './features/nurbs-source-loft-feature-graph.js';

export { buildExactSurfaceBandTrim, validateExactSurfaceBandTrim, ExactSurfaceBandTrimError, ExactSurfaceBandTrimDiagnosticCode } from './exact-proof/exact-surface-band-trim.js';
export type { ExactSurfaceBandTrimOptions, ExactSurfaceBandTrimEdge, ExactSurfaceBandTrimReport, ExactSurfaceBandTrimResult } from './exact-proof/exact-surface-band-trim.js';

export { buildTranslatedStripIntervalBoolean, validateTranslatedStripIntervalBoolean, TranslatedStripIntervalBooleanError, TranslatedStripIntervalBooleanDiagnosticCode } from './translated-strip/translated-strip-interval-boolean.js';
export type { TranslatedStripIntervalBooleanOptions, TranslatedStripIntervalBooleanOutput, TranslatedStripIntervalBooleanReport, TranslatedStripIntervalBooleanResult } from './translated-strip/translated-strip-interval-boolean.js';

export { tessellateQualifiedTranslatedStripBody, validateQualifiedTranslatedStripBodyMesh, QualifiedTranslatedStripBodyMeshError, QualifiedTranslatedStripBodyMeshDiagnosticCode } from './translated-strip/qualified-translated-strip-body-mesh.js';
export type { QualifiedTranslatedStripBodyMeshOptions, QualifiedTranslatedStripBodyMeshPacket, QualifiedTranslatedStripBodyMeshReport, QualifiedTranslatedStripBodyMeshResult } from './translated-strip/qualified-translated-strip-body-mesh.js';

export { insertSourceCurveKnot, validateSourceCurveKnotInsertion, SourceCurveKnotInsertionError, SourceCurveKnotInsertionDiagnosticCode } from './nurbs/source-wide/source-curve-knot-insertion.js';
export type { SourceCurveKnotInsertionRequest, SourceCurveKnotInsertionPatch, SourceCurveKnotInsertionReport, SourceCurveKnotInsertionResult } from './nurbs/source-wide/source-curve-knot-insertion.js';

export { insertSourceSurfaceKnot, validateSourceSurfaceKnotInsertion, SourceSurfaceKnotInsertionError, SourceSurfaceKnotInsertionDiagnosticCode } from './nurbs/source-wide/source-surface-knot-insertion.js';
export type { SourceSurfaceKnotInsertionRequest, SourceSurfaceKnotInsertionPatch, SourceSurfaceKnotInsertionReport, SourceSurfaceKnotInsertionResult } from './nurbs/source-wide/source-surface-knot-insertion.js';

export { extractSourceCurveInterval, validateSourceCurveIntervalExtraction, SourceCurveIntervalExtractionError, SourceCurveIntervalExtractionDiagnosticCode } from './nurbs/source-wide/source-curve-interval-extraction.js';
export type { SourceCurveIntervalExtractionRequest, SourceCurveIntervalExtractionPatch, SourceCurveIntervalExtractionReport, SourceCurveIntervalExtractionResult } from './nurbs/source-wide/source-curve-interval-extraction.js';


export { buildSourceKnotAlignedLoft, validateSourceKnotAlignedLoft, SourceKnotAlignedLoftError, SourceKnotAlignedLoftDiagnosticCode } from './nurbs/source-wide/source-knot-aligned-loft.js';
export type { SourceKnotAlignedLoftRequest, SourceKnotAlignedLoftOptions, SourceKnotAlignedLoftReport, SourceKnotAlignedLoftResult } from './nurbs/source-wide/source-knot-aligned-loft.js';


export { elevateSourceCurveDegree, validateSourceCurveDegreeElevation, SourceCurveDegreeElevationError, SourceCurveDegreeElevationDiagnosticCode } from './nurbs/source-wide/source-curve-degree-elevation.js';
export type { SourceCurveDegreeElevationRequest, SourceCurveDegreeElevationPatch, SourceCurveDegreeElevationReport, SourceCurveDegreeElevationResult } from './nurbs/source-wide/source-curve-degree-elevation.js';


export { evaluateSourceKnotRecipeLoftGraph, updateSourceKnotRecipeLoftGraph, validateSourceKnotRecipeLoftGraph, validateSourceKnotRecipeLoftGraphUpdate, serializeSourceKnotRecipeLoftGraph, parseSourceKnotRecipeLoftGraph, SourceKnotRecipeLoftGraphError, SourceKnotRecipeLoftGraphDiagnosticCode } from './nurbs/source-wide/source-knot-recipe-loft-graph.js';
export type { SourceKnotRecipeLoftGraphV0, SourceKnotRecipeLoftGraphOptions, SourceKnotRecipeLoftGraphEdits, SourceKnotRecipeLoftGraphResult, SourceKnotRecipeLoftGraphReport, SourceKnotRecipeLoftGraphTransaction, SourceKnotRecipeLoftGraphTransactionReport, SourceKnotRecipeLoftGraphUpdateResult } from './nurbs/source-wide/source-knot-recipe-loft-graph.js';


export { elevateSourceSurfaceAxisDegree, validateSourceSurfaceAxisDegreeElevation, SourceSurfaceDegreeElevationError, SourceSurfaceDegreeElevationDiagnosticCode } from './nurbs/source-wide/source-surface-degree-elevation.js';
export type { SourceSurfaceDegreeElevationRequest, SourceSurfaceDegreeElevationPatch, SourceSurfaceDegreeElevationReport, SourceSurfaceDegreeElevationResult } from './nurbs/source-wide/source-surface-degree-elevation.js';


export { importIGES, validateIGESImport, IGESImportError, IGESImportDiagnosticCode } from './io/iges-import.js';
export type { IGESImportOptions, IGESImportEntity, IGESImportReport, IGESImportResult } from './io/iges-import.js';


export { buildSourceLineWidthFace, validateSourceLineWidthFace, SourceLineWidthFaceError, SourceLineWidthFaceDiagnosticCode } from './nurbs/source-wide/source-line-width-face.js';
export type { SourceLineWidthFaceRequest, SourceLineWidthFaceOptions, SourceLineWidthFaceReport, SourceLineWidthFaceResult } from './nurbs/source-wide/source-line-width-face.js';


export { extrudeConvexPlanarFace, validateConvexPlanarFaceExtrusion, ConvexPlanarFaceExtrusionError, ConvexPlanarFaceExtrusionDiagnosticCode } from './planar-solids/convex-planar-face-extrusion.js';
export type { ConvexPlanarFaceExtrusionRequest, ConvexPlanarFaceExtrusionOptions, ConvexPlanarFaceExtrusionReport, ConvexPlanarFaceExtrusionResult } from './planar-solids/convex-planar-face-extrusion.js';


export { tracePairedSurfaceIntersectionBranch, validatePairedSurfaceIntersectionBranch, PairedSurfaceIntersectionBranchError, PairedSurfaceIntersectionBranchDiagnosticCode } from './paired/paired-surface-intersection-branch.js';
export type { PairedSurfaceIntersectionBranchRequest, PairedSurfaceIntersectionBranchOptions, PairedSurfaceIntersectionBranchReport, PairedSurfaceIntersectionBranchResult } from './paired/paired-surface-intersection-branch.js';


export { splitTranslatedStripBodyByPlane, validateTranslatedStripPlaneSplit, serializeTranslatedStripPlaneSplit, parseTranslatedStripPlaneSplit, TranslatedStripPlaneSplitError, TranslatedStripPlaneSplitDiagnosticCode } from './translated-strip/translated-strip-plane-split.js';
export type { TranslatedStripPlaneSplitRequest, TranslatedStripPlaneSplitOptions, TranslatedStripPlaneSplitReport, TranslatedStripPlaneSplitResult } from './translated-strip/translated-strip-plane-split.js';


export { evaluateSourceLineWidthExtrusionGraph, updateSourceLineWidthExtrusionGraph, validateSourceLineWidthExtrusionGraph, validateSourceLineWidthExtrusionGraphUpdate, serializeSourceLineWidthExtrusionGraph, parseSourceLineWidthExtrusionGraph, SourceLineWidthExtrusionGraphError, SourceLineWidthExtrusionGraphDiagnosticCode } from './nurbs/source-wide/source-line-width-extrusion-graph.js';
export type { SourceLineWidthExtrusionGraphV0, SourceLineWidthExtrusionGraphOptions, SourceLineWidthExtrusionGraphEdits, SourceLineWidthExtrusionGraphReport, SourceLineWidthExtrusionGraphResult, SourceLineWidthExtrusionGraphTransactionReport, SourceLineWidthExtrusionGraphTransaction, SourceLineWidthExtrusionGraphUpdateResult } from './nurbs/source-wide/source-line-width-extrusion-graph.js';


export type { CadCallArgument, CadCallExpression } from './language/expression-parser.js';
export type { CadFormalArgument, CadFunctionAst } from './language/source-ast.js';
export type { CadModelIR3 } from './language/semantic-model.js';
export type { CadFunctionQuantity, CadResolvedFunction, CadFunctionCallReceipt, CadFunctionWork } from './document/function-quantity-semantics.js';


export { sampleSourceCurveAdaptive, validateSourceCurveAdaptive, SourceCurveAdaptiveSamplingError, SourceCurveAdaptiveSamplingDiagnosticCode } from './nurbs/source-wide/source-curve-adaptive-sampling.js';
export type { SourceCurveAdaptiveSamplingRequest, SourceCurveAdaptiveSamplingOptions, SourceCurveAdaptiveSamplingReport, SourceCurveAdaptiveSamplingResult } from './nurbs/source-wide/source-curve-adaptive-sampling.js';


export { qualifyRectangularFaceExtrusionBody, validateRectangularFaceExtrusionBody, RectangularFaceExtrusionBodyError, RectangularFaceExtrusionBodyDiagnosticCode } from './planar-solids/rectangular-face-extrusion-body.js';
export type { RectangularFaceExtrusionBodyRequest, RectangularFaceExtrusionBodyOptions, RectangularFaceExtrusionBodyReport, RectangularFaceExtrusionBodyResult } from './planar-solids/rectangular-face-extrusion-body.js';


export { evaluateSourceLineWidthMaterialBodyGraph, updateSourceLineWidthMaterialBodyGraph, validateSourceLineWidthMaterialBodyGraph, validateSourceLineWidthMaterialBodyGraphUpdate, serializeSourceLineWidthMaterialBodyGraph, parseSourceLineWidthMaterialBodyGraph, SourceLineWidthMaterialBodyGraphError, SourceLineWidthMaterialBodyGraphDiagnosticCode } from './nurbs/source-wide/source-line-width-material-body-graph.js';
export type { SourceLineWidthMaterialBodyGraphV0, SourceLineWidthMaterialBodyGraphOptions, SourceLineWidthMaterialBodyGraphEdits, SourceLineWidthMaterialBodyGraphResult, SourceLineWidthMaterialBodyGraphReport, SourceLineWidthMaterialBodyGraphTransaction, SourceLineWidthMaterialBodyGraphTransactionReport, SourceLineWidthMaterialBodyGraphUpdateResult } from './nurbs/source-wide/source-line-width-material-body-graph.js';


export { buildExactPairedVLinearSurfaceIntersection, validateExactPairedVLinearSurfaceIntersection, ExactPairedVLinearSurfaceIntersectionError, ExactPairedVLinearSurfaceIntersectionDiagnosticCode } from './exact-proof/exact-paired-vlinear-surface-intersection.js';
export type { ExactPairedVLinearSurfaceIntersectionRequest, ExactPairedVLinearSurfaceIntersectionOptions, ExactPairedVLinearSurfaceIntersectionReport, ExactPairedVLinearSurfaceIntersectionResult } from './exact-proof/exact-paired-vlinear-surface-intersection.js';


export { buildPairedSurfaceUVSplitFaces, validatePairedSurfaceUVSplitFaces, PairedSurfaceUVSplitFacesError, PairedSurfaceUVSplitFacesDiagnosticCode } from './paired/paired-surface-uv-split-faces.js';
export type { PairedSurfaceUVSplitFacesRequest, PairedSurfaceUVSplitFacesOptions, PairedSurfaceUVSplitFacesReport, PairedSurfaceUVSplitFacesResult } from './paired/paired-surface-uv-split-faces.js';

// Original-B XZ Faces from a full exact paired section (private CPU data).
export { buildPairedSurfaceBUVSplitFaces, validatePairedSurfaceBUVSplitFaces, PairedSurfaceBUVSplitFacesError, PairedSurfaceBUVSplitFacesDiagnosticCode } from './paired/paired-surface-b-uv-split-faces.js';
export type { PairedSurfaceBUVSplitFacesRequest, PairedSurfaceBUVSplitFacesOptions, PairedSurfaceBUVSplitFacesReport, PairedSurfaceBUVSplitFacesResult } from './paired/paired-surface-b-uv-split-faces.js';

// Exact original-UV membership on certified paired complementary Faces.
export { classifyPairedSurfaceUVFaces, validatePairedSurfaceUVFaceClassification, PairedSurfaceUVFaceClassificationError, PairedSurfaceUVFaceClassificationDiagnosticCode } from './paired/paired-surface-uv-face-classification.js';
export type { PairedSurfaceUVFaceQuery, PairedSurfaceUVFaceOptions, PairedSurfaceUVFaceReport, PairedSurfaceUVFaceResult } from './paired/paired-surface-uv-face-classification.js';

// Restricted occupied material Body from original paired curved Faces.
export { buildPairedSurfaceMaterialBody, validatePairedSurfaceMaterialBody, PairedSurfaceMaterialBodyError, PairedSurfaceMaterialBodyDiagnosticCode } from './paired/paired-surface-material-body.js';
export type { PairedSurfaceMaterialBodyRequest, PairedSurfaceMaterialBodyOptions, PairedSurfaceMaterialBodyReport, PairedSurfaceMaterialBodyResult } from './paired/paired-surface-material-body.js';

// Exact WorldXYZ membership on a restricted paired Surface material Body.
export { classifyPairedSurfaceMaterialBodyWorldPoints, validatePairedSurfaceMaterialBodyWorldPointClassification, PairedSurfaceMaterialBodyWorldPointError, PairedSurfaceMaterialBodyWorldPointDiagnosticCode } from './paired/paired-surface-material-body-world-points.js';
export type { PairedSurfaceMaterialBodyWorldPointQuery, PairedSurfaceMaterialBodyWorldPointOptions, PairedSurfaceMaterialBodyWorldPointReport, PairedSurfaceMaterialBodyWorldPointResult } from './paired/paired-surface-material-body-world-points.js';

// Actual strictly positive paired-roof occupied difference Body.
export { buildPairedRoofDifferenceBody, validatePairedRoofDifferenceBody, PairedRoofDifferenceBodyError, PairedRoofDifferenceBodyDiagnosticCode } from './paired/paired-roof-difference-body.js';
export type { PairedRoofDifferenceBodyRequest, PairedRoofDifferenceBodyOptions, PairedRoofDifferenceBodyReport, PairedRoofDifferenceBodyResult } from './paired/paired-roof-difference-body.js';

// Bounded binary STL exchange from the whole qualified translated-strip Body mesh.
export { exportQualifiedTranslatedStripBodyBinaryStl, validateQualifiedTranslatedStripBodyBinaryStl, QualifiedTranslatedStripBodyBinaryStlError, QualifiedTranslatedStripBodyBinaryStlDiagnosticCode } from './translated-strip/qualified-strip-binary-stl.js';
export type { QualifiedTranslatedStripBodyBinaryStlOptions, QualifiedTranslatedStripBodyBinaryStlVertexLoss, QualifiedTranslatedStripBodyBinaryStlReport, QualifiedTranslatedStripBodyBinaryStlResult } from './translated-strip/qualified-strip-binary-stl.js';

// Exact conserved partition at a retained native intermediate paired A roof.
export { splitPairedRoofDifferenceBody, validatePairedRoofBodySplit, PairedRoofBodySplitError, PairedRoofBodySplitDiagnosticCode } from './paired/paired-roof-body-split.js';
export type { PairedRoofBodySplitRequest, PairedRoofBodySplitOptions, PairedRoofBodySplitResult, PairedRoofBodySplitReport } from './paired/paired-roof-body-split.js';

export {
  classifyPairedRoofDifferenceBodyWorldPoints,
  validatePairedRoofDifferenceBodyWorldPoints,
  PairedRoofDifferenceBodyWorldPointError,
  PairedRoofDifferenceBodyWorldPointDiagnosticCode,
} from './paired/paired-roof-difference-body-world-points.js';
export type {
  PairedRoofDifferenceBodyWorldPointQuery,
  PairedRoofDifferenceBodyWorldPointOptions,
  PairedRoofDifferenceBodyWorldPointResult,
  PairedRoofDifferenceBodyWorldPointReport,
} from './paired/paired-roof-difference-body-world-points.js';

// Separately versioned exact affine XY constraints; legacy linear sketches are unchanged.
export { solveXYAffineSketch, buildXYAffineSketch, validateXYAffineSketch, XYAffineSketchError, XYAffineSketchDiagnosticCode } from './xy-affine-sketch.js';
export type { XYAffineSketchPoint, XYAffineSketchSegment, XYAffineSketchReferenceLine, XYAffineSketchConstraint, XYAffineSketchDocumentV0, XYAffineSketchCoordinate, XYAffineSketchDiagnostic, XYAffineSketchReport, XYAffineSketchSuccess, XYAffineSketchResult } from './xy-affine-sketch.js';

// Bounded chained exact orthogonal solids; complete source-qualified result operands.
export { buildOrthogonalSolidBoolean, validateOrthogonalSolidBoolean, OrthogonalSolidBooleanError, OrthogonalSolidBooleanDiagnosticCode } from './orthogonal-solid-boolean.js';
export type { OrthogonalSolidBooleanOperand, OrthogonalSolidBooleanOptions, OrthogonalSolidBooleanResult, OrthogonalSolidBooleanReport } from './orthogonal-solid-boolean.js';

export { buildXYNumericalSketch, solveXYNumericalSketch, solveXYNumericalSketchPoints, validateXYNumericalSketch, XYNumericalSketchError, XYNumericalSketchDiagnosticCode } from './sketch/xy-numerical-sketch.js';
export type { XYNumericalSketchPoint, XYNumericalSketchSegment, XYNumericalSketchConstraint, XYNumericalSketchBranchGuard, XYNumericalSketchDocumentV0, XYNumericalSketchResidual, XYNumericalSketchReport, XYNumericalSketchSuccess, XYNumericalSketchDiagnostic, XYNumericalSketchResult, XYNumericalSketchPointsSuccess } from './sketch/xy-numerical-sketch.js';
export { qualifyConvexPlanarSolid, validateConvexPlanarSolid, classifyConvexPlanarSolidPoints, ConvexPlanarSolidError, ConvexPlanarSolidDiagnosticCode } from './convex-planar-solid.js';
export type { ConvexPlanarSolidAsset, ConvexPlanarSolidUseReference, ConvexPlanarSolidEdgePair, ConvexPlanarSolidOptions, ConvexPlanarSolidQueryOptions, ConvexPlanarSolidVertexReference, ConvexPlanarSolidGraph, ConvexPlanarSolidSupport, ConvexPlanarSolidCertificate, ConvexPlanarSolidReport, ConvexPlanarSolidResult, ConvexPlanarSolidPointClassification, ConvexPlanarSolidPointBatch } from './convex-planar-solid.js';

export { buildXYCircularNumericalSketch, solveXYCircularNumericalSketch, validateXYCircularNumericalSketch, XYCircularNumericalSketchError, XYCircularNumericalSketchDiagnosticCode } from './sketch/xy-circular-numerical-sketch.js';
export type { XYCircularNumericalSketchPoint, XYCircularNumericalSketchSegment, XYCircularNumericalSketchCircle, XYCircularNumericalSketchConstraint, XYCircularNumericalSketchBranchGuard, XYCircularNumericalSketchDocumentV0, XYCircularNumericalSketchRadius, XYCircularNumericalSketchContact, XYCircularNumericalSketchBinding, XYCircularNumericalSketchReport, XYCircularNumericalSketchSuccess, XYCircularNumericalSketchDiagnostic, XYCircularNumericalSketchResult } from './sketch/xy-circular-numerical-sketch.js';

export { splitConvexPlanarSolid, validateConvexPlanarSolidSplit, ConvexPlanarSolidSplitError } from './convex-planar-solid-split.js';
export type { ConvexPlanarSolidCutter, ConvexPlanarSolidSplitOptions, ConvexPlanarSolidSplitOutcome, ConvexPlanarSolidSplitNode, ConvexPlanarSolidSplitSegment, ConvexPlanarSolidSplitFaceLineage, ConvexPlanarSolidSplitReport, ConvexPlanarSolidSplitResult, ConvexPlanarSolidSplitDiagnosticCode } from './convex-planar-solid-split.js';
export { buildXYAffineSketchPrism, validateXYAffineSketchPrism, resolveXYAffineSketchPrismWall, XYAffineSketchPrismError } from './xy-affine-sketch-prism.js';
export type { XYAffineSketchPrismOffsetCoordinateSpanOptions, XYAffineSketchPrismOffsetCoordinateSpanReport, XYAffineSketchPrismOffsetLineage, XYAffineSketchPrismOffsetCoordinateSpanResult, XYAffineSketchPrismCoordinateSpanOptions, XYAffineSketchPrismCoordinateSpanReport, XYAffineSketchPrismCoordinateSpanResult, XYAffineSketchPrismOptions, XYAffineSketchPrismWallReference, XYAffineSketchPrismFaceReference, XYAffineSketchPrismLineage, XYAffineSketchPrismReport, XYAffineSketchPrismResult, XYAffineSketchPrismWallResolution, XYAffineSketchPrismStage } from './xy-affine-sketch-prism.js';

export { intersectConvexPlanarSolids, validateConvexPlanarSolidIntersection, ConvexPlanarSolidIntersectionError } from './convex-planar-solid-intersection.js';
export type { ConvexPlanarSolidIntersectionOptions, ConvexPlanarSolidIntersectionSource, ConvexPlanarSolidIntersectionNode, ConvexPlanarSolidIntersectionEdgeOrigin, ConvexPlanarSolidIntersectionFace, ConvexPlanarSolidIntersectionReport, ConvexPlanarSolidIntersectionResult, ConvexPlanarSolidIntersectionDiagnosticCode } from './convex-planar-solid-intersection.js';

export * from "./convex-planar-slab-subtraction.js";

export { XYAffinePrismFeatureError, XYAffinePrismFeatureDocumentLimits, evaluateXYAffinePrismFeatureDocument, updateXYAffinePrismFeatureDocument, validateXYAffinePrismFeatureDocument, validateXYAffinePrismFeatureDocumentUpdate, serializeXYAffinePrismFeatureDocument, parseXYAffinePrismFeatureDocument } from './planar-solids/xy-affine-prism-feature-document.js';
export type { XYAffinePrismSketchNode, XYAffinePrismNode, XYAffinePrismComponentRecipe, XYAffinePrismSubtractionNode, XYAffinePrismFeatureParameter, XYAffinePrismFeatureDocumentV0, XYAffinePrismFeatureEdits, XYAffinePrismFeatureWork, XYAffinePrismFeatureResult, XYAffinePrismFeatureUpdate, XYAffinePrismFeatureDiagnosticCode } from './planar-solids/xy-affine-prism-feature-document.js';
export { chamferConvexPlanarSolid, validateConvexPlanarSolidChamfer, ConvexPlanarSolidChamferError } from './convex-planar-solid-chamfer.js';
export type { ConvexPlanarChamferUseReference, ConvexPlanarChamferSelection, ConvexPlanarSolidChamferOptions, ConvexPlanarSolidChamferReport, ConvexPlanarSolidChamferResult, ConvexPlanarSolidChamferDiagnosticCode } from './convex-planar-solid-chamfer.js';

export { measureConvexPlanarSolidMass, validateConvexPlanarSolidMass, ConvexPlanarSolidMassError, ConvexPlanarSolidMassDiagnosticCode } from './convex-planar-solid-mass.js';
export type { ConvexPlanarSolidMassOptions, ConvexPlanarSolidMassMeasure, ConvexPlanarSolidMassReport, ConvexPlanarSolidMassResult } from './convex-planar-solid-mass.js';

export { XYAffinePrismFeatureDocumentLimitsV1, evaluateXYAffinePrismFeatureDocumentV1, updateXYAffinePrismFeatureDocumentV1, validateXYAffinePrismFeatureDocumentV1, validateXYAffinePrismFeatureDocumentUpdateV1, serializeXYAffinePrismFeatureDocumentV1, parseXYAffinePrismFeatureDocumentV1 } from './planar-solids/xy-affine-prism-feature-document.js';
export type { XYAffinePrismChamferNode, XYAffinePrismFeatureBindingV1, XYAffinePrismFeatureParameterV1, XYAffinePrismFeatureDocumentV1, XYAffinePrismFeatureWorkV1, XYAffinePrismFeatureResultV1, XYAffinePrismFeatureUpdateV1 } from './planar-solids/xy-affine-prism-feature-document.js';

export { tessellateConvexPlanarSolid, validateConvexPlanarSolidMesh, ConvexPlanarSolidMeshError, ConvexPlanarSolidMeshLimits } from './planar-solids/convex-planar-solid-mesh.js';
export type { ConvexPlanarSolidMeshDiagnosticCode, ConvexPlanarSolidMeshOptions, ConvexPlanarSolidMeshVertex, ConvexPlanarSolidMeshFace, ConvexPlanarSolidMeshBoundary, ConvexPlanarSolidMeshReport, ConvexPlanarSolidMeshResult } from './planar-solids/convex-planar-solid-mesh.js';

export { cad } from './core/public-api.js';

export { qualifyStoredCirclePrismSolid, validateStoredCirclePrismSolid, StoredCirclePrismSolidError, StoredCirclePrismSolidDiagnosticCode } from './stored-circle-prism-solid.js';
export type { StoredCirclePrismSolidResult, StoredCirclePrismSolidCertificate, StoredCirclePrismSolidGerm, StoredCirclePrismSolidCorner, StoredCirclePrismSolidVertexLink } from './stored-circle-prism-solid.js';

export { XYAffinePrismFeatureDocumentLimitsV2, evaluateXYAffinePrismFeatureDocumentV2, updateXYAffinePrismFeatureDocumentV2, validateXYAffinePrismFeatureDocumentV2, validateXYAffinePrismFeatureDocumentUpdateV2, serializeXYAffinePrismFeatureDocumentV2, parseXYAffinePrismFeatureDocumentV2 } from './planar-solids/xy-affine-prism-feature-document-v2.js';
export type { XYAffinePrismNodeV2, XYAffinePrismChamferNodeV2, XYAffinePrismChamferResolutionV2, XYAffinePrismFeatureDocumentV2, XYAffinePrismFeatureWorkV2, XYAffinePrismFeatureResultV2, XYAffinePrismFeatureUpdateV2 } from './planar-solids/xy-affine-prism-feature-document-v2.js';

export { CadModelError, CadModelLimits } from './modeling.js';
export type { CadModel, CadModelSnapshot, CadStlExport, CadMassPropertiesOptions, CadMassProperties, CadModelFeature, CadModelEvidence, CadBody, CadModelErrorCode, CadParameter, CadDimensionExpression, CadDimension, CadPoint2, CadAxis, CadEdgeQuery, CadEdgeSelection, CadEdgeQueryHandle, CadShape, CadCut, CadSplit, CadSketch, CadSketchPoint, CadConstrainedPolygonBuilder, CadRectangle, CadLoopSegment } from './modeling.js';
export * from './features/extruded-profile-solid.js';
export { encodeBinaryStl } from './io/stl.js';
export { brepFromTriangles, readObj, readStl, meshBrepError, isMeshBrepError, type MeshBrepOptions } from './mesh/mesh-brep.js';
export { facetBrepFromTriangles, facetBrepsFromTriangles, facetPieces, type FacetBrepOptions } from './mesh/facet-brep.js';
export { facetArea, facetPlane, facetVectorArea } from './mesh/facet-patch.js';
export { classifyPointInFacets, facetBvh, type FacetBvh, type FacetPointClass } from './mesh/facet-bvh.js';
export { splitFacetBrep, type FacetSplitOptions, type FacetSplitResult } from './mesh/facet-split.js';
export { decimateMesh, type DecimateOptions, type DecimateReport, type DecimateResult } from './mesh/mesh-decimate.js';
export { meshDistance, type MeshDistance } from './mesh/mesh-distance.js';
// K2 (D141): the one triangle hierarchy, its ray and nearest-point queries.
export { triangleBvh, rayHit, nearestDistance2, pointTriangleDistance2, closestPointOnTriangle, type TriangleBvh, type TriangleBvhOptions } from './mesh/triangle-bvh.js';
// K3 (D142): the least distance between two meshes' surfaces, exactly, with the closest points.
export { meshClearance, type MeshClearance, type MeshClearanceOptions } from './mesh/mesh-clearance.js';
// K4 (D143): the nearest point of a NURBS surface.
export { closestPointOnSurface, surfaceSeedGrid, surfaceD1Near, type SurfaceClosestPoint, type SurfaceClosestOptions, type SurfaceSeedGrid } from './nurbs/surfaces/surface-closest.js';
// K5 (D144): section properties of polygons, a symmetric 3 × 3 eigen solver, a mesh's volume.
export { polygonSectionProperties, symmetricEigen3, symmetricEigen3InPlace, meshVolume, type SectionProperties, type Matrix3, type Vector3 } from './features/section-properties.js';
// K6 (D145): a mesh on a voxel grid (inside flags, capped depth) and marching tetrahedra.
export { voxelInsideFlags, voxelDepth, marchingTetrahedra, voxelNode, VOXEL_CORNERS, VOXEL_TETRAHEDRA, type VoxelField, type VoxelPoint } from './mesh/voxel-field.js';
// K7b (D147): plain (uncertified) B-spline fitting — interpolation, least squares, the surface tensor, knot removal.
export { interpolateCurvePlain, approximateCurvePlain, interpolateSurfacePlain, removeCurveKnotPlain, chordParameters, averagedKnots, plainBasis, plainFindSpan, type PlainFitCurve, type PlainFitSurface, type PlainPoint } from './features/fit-plain.js';
// K1 (D140): generic convex geometry moved down from the studio's robot track.
export { convexHull, HullError, type ConvexHull, type HullErrorCode } from './brep/convex-hull.js';
export { convexDistance } from './brep/convex-distance.js';
export { subdBrep, SubdError, subdSummary, type SubdCage, type SubdOptions, type SubdSummary } from './features/subd.js';
export { subdReport, type SubdReport, type SubdReportOptions } from './features/subd-report.js';
export { cageTopology, validateCage, edgeLoop, edgeRing, moveVertices, selectionVertices, extrudeFaces, extrudeEdges, insertEdgeLoop, deleteFaces, compact, boundaryLoop, fillHole, bridge, weldVertices, weldWithin, setCreases, mirrorCage, halfCage, keepOnPlane, subdPreviewMesh, type Cage, type CageTopology, type CageValidation, type MirrorAxis } from './features/subd-cage.js';
export { facetBoolean, facetBooleanError, isFacetBooleanError, type FacetBooleanOptions } from './mesh/facet-boolean.js';
export { spurGear, spurGearProfile, spurGearDimensions, spurGearPairNominal, spurGearCenterDistance, checkSpurGearPair, checkPlacedSpurGears, gearError, isGearError, type PlacedSpurGear, type PlacedSpurGearPairCheck, type SpurGearPairCheck, type SpurGearPairOptions, type SpurGearSpec, type SpurGearReport, type SpurGearDimensions, type GearDiagnostic, type GearDiagnosticCode } from './machine/gear.js';
export { spurRack, spurRackDimensions, checkSpurGearRack, checkPlacedSpurRack, type PlacedSpurRack, type PlacedSpurRackCheck, type SpurRackSpec, type SpurRackReport, type SpurRackPairOptions, type SpurRackPairCheck } from './machine/gear-rack.js';
export { internalGear, internalGearDimensions, internalGearCenterDistance, checkInternalGearPair, checkPlacedInternalGears, pinionTurnInside, type InternalGearSpec, type InternalGearReport, type InternalGearPairOptions, type InternalGearPairCheck, type PlacedInternalGear, type PlacedInternalGearPairCheck } from './machine/gear-internal.js';
export { bevelGear, bevelGearDimensions, checkBevelGearPair, checkPlacedBevelGears, bevelMatePlacement, bevelGearMatrix, type BevelGearSpec, type BevelGearReport, type BevelGearPairOptions, type BevelGearPairCheck, type PlacedBevelGear, type PlacedBevelGearPairCheck } from './machine/gear-bevel.js';
export { worm, wormDimensions, wormWheelSpec, checkWormPair, wormPlacement, wormMatrix, checkPlacedWormPair, type WormSpec, type WormReport, type WormPairOptions, type WormPairCheck, type PlacedWorm, type PlacedWormWheel, type PlacedWormPairCheck } from './machine/gear-worm.js';
export { throatedWormWheel, throatedWheelGeom, checkThroatedWormPair, throatedWormPlacement, checkPlacedThroatedPair, throatedWheelWorm, type ThroatedWheelSpec, type ThroatedWheelReport, type ThroatedPairCheck, type PlacedThroatedWheel } from './machine/gear-worm-wheel.js';
export { glandCheck, glandCut, oringInGland, oringRowProblem, O2_RANGES, glandError, isGlandError, type GlandCode, type ORingRow, type GlandRanges, type GlandSpec, type GlandReport, type GlandPlace } from './machine/oring.js';
export { connectorRowProblem, connectorSectionArea, connectorFrame, connectorKeepOut, connectorOpening, connectorBody, connectorError, isConnectorError, type ConnectorCode, type ConnectorRow, type ConnectorSection, type ConnectorReport, type ConnectorSpec } from './machine/connector.js';
export { sectionTableProblem, lookupSection, type SectionTable, type SectionTableRow, type SectionTableKind } from './features/section-table.js';
export { sprocket, sprocketProfile, sprocketPitchDiameter, sprocketLimits, timingPitchDiameter, pulley, openBeltLength, chainLinks, beltBand, couplingEnvelope, driveRowProblem, driveError, isDriveError, type DriveCode, type DriveRow, type ChainRow, type TimingBeltRow, type VBeltRow, type FlatBeltRow, type CouplingRow, type BeltRow, type SprocketSpec, type SprocketReport, type PulleySpec, type PulleyReport, type BeltSpec, type BeltReport, type CouplingReport } from './machine/drive.js';
export { camLaw, camLawPeaks, camMotion, camProfile, discCam, CAM_LAWS, camError, isCamError, type CamLaw, type CamCode, type CamWarningCode, type CamSegment, type CamSpec, type CamReport, type CamSegmentReport } from './machine/cam.js';
export { seatedBearing, bearingEnvelope, bearingRowProblem, bearingError, isBearingError, type BearingCode, type BearingRow, type BearingReport, type BearingFitClasses, type BearingRingFit } from './machine/bearing.js';
export { keySolid, keywayCut, ringSolid, pinSolid, shaftPartError, isShaftPartError, type ShaftPartCode, type PlacedShaft, type KeywayReport, type KeyReport, type KeyFitClasses, type RingRow, type RingReport, type PinReport } from './machine/shaft-parts.js';
export { shaftSolid, shaftError, isShaftError, type ShaftSpec, type ShaftStep, type ShaftGroove, type ShaftKeyseat, type ShaftHole, type ShaftReport, type ShaftKeyseatReport, type ShaftDiagnosticCode } from './machine/shaft.js';
export { fitTableProblem, lookupFit, fitLimits, checkFit, isHoleClass, FitError, type FitErrorCode, type FitSource, type FitRow, type FitTable, type FitLimit, type FitLimits, type FitFace, type FitCondition, type FitCheck } from './machine/fits.js';
export { helicalSweep, compressionSpring, hookedSpring, springDimensions, springSolidPitch, springError, isSpringError, type HookedSpringSpec, type HookedSpringDimensions, type HookedSpringReport, type HelicalRun, type HelicalSweepSpec, type HelicalSweepResult, type SpringSpec, type SpringDimensions, type SpringReport, type SpringDiagnostic, type SpringDiagnosticCode } from './machine/spring.js';
export { DEFAULT_REPAIR, diagnoseMesh, repairMesh, selfIntersections, type MeshDiagnosis, type MeshHole, type MeshRepairReport, type MeshRepairResult, type MeshRepairSteps } from './mesh/mesh-repair.js';
export { isoThreadRadius, threadSolid, type ThreadSolidRequest } from './machine/thread-solid.js';
export { sweepSolid, type SweepSolidRequest } from './brep/sweep-solid.js';
export { thickenSolid, type ThickenSolidRequest } from './brep/thicken-solid.js';
export { sewSolid, sewError, isSewError, type SewSolidRequest } from './brep/sew-solid.js';
export { CadNumericPolicy, chartRoundingBoundMM } from './numeric-policy.js';
export { checkBrep, assertValidBrep, buildBrep, coedgeVertices, isFacetFace, lineCurve, mergeBreps, nurbsOf, BrepError } from './brep/brep-core.js';
export type { BrepErrorReason } from './brep/brep-core.js';
export type { Brep, BrepBody, BrepShell, BrepFace, BrepLoop, BrepCoedge, BrepEdge, BrepVertex, BrepCheckReport, BrepBodyTopology, BrepBuildInput, BrepFaceInput, BrepLoopInput, BrepShellInput } from './brep/brep-core.js';
export { brepFromBody, brepFromConvexPlanar, brepFromExtrudedProfile, brepFromPlateHole, brepFromCirclePrism, brepFromOrthogonalCells } from './brep/brep-adapters.js';
export type { BrepInputBody } from './brep/brep-adapters.js';
export { BrepEditor, BrepEulerError } from './brep/brep-euler.js';
export { extrudeProfileWithHoles, extrudePolygonBoolean } from './brep/brep-sweep.js';
export type { ProfileWithHolesInput } from './brep/brep-sweep.js';
export { tessellateBrep, triangulatePolygonWithHoles } from './brep/brep-tessellate.js';
export type { BrepMesh, BrepMeshFace, BrepMeshEdge, BrepTessellationOptions } from './brep/brep-tessellate.js';
export { projectBrepHiddenLines } from './brep/brep-hidden-line.js';
export type { BrepProjection, HiddenLineOptions, HiddenLineView, ProjectedCurve, ProjectedEdge, ProjectedPiece, ProjectedXY } from './brep/brep-hidden-line.js';
export { booleanPolygons, planarArrangementCounts, planarArrangementError, isPlanarArrangementError } from './brep/planar-arrangement.js';
export type { PolygonWithHoles, PlanarBooleanOperation } from './brep/planar-arrangement.js';
export { booleanPolyhedra } from './brep/polyhedral-boolean.js';
export type { PolyhedralBooleanOperation } from './brep/polyhedral-boolean.js';
export { booleanCurveRegions, curveArrangementVertices, curvedArrangementError, isCurvedArrangementError, regionArea as curveRegionArea } from './brep/curved-arrangement.js';
export type { CurveSegment2, CurveRegion2, CurveBooleanOperation } from './brep/curved-arrangement.js';
export { prismaticExtrude, prismaticFromProfile, booleanPrismatic, prismaticVolume, prismaticContains, brepFromPrismatic, prismaticSolidError, isPrismaticSolidError } from './features/prismatic-solid.js';
export type { PrismaticSolid, PrismaticSlab, PrismaticBooleanOperation } from './features/prismatic-solid.js';
export { regionMoments } from './brep/curved-arrangement.js';
export { transformPrismatic } from './features/prismatic-solid.js';
export type { PrismaticCapSource } from './features/prismatic-solid.js';
export { transformBrep, quarterTurn } from './brep/brep-transform.js';
export type { BrepAffine } from './brep/brep-transform.js';
export { prismaticMassProperties, brepMassProperties, brepSurfaceArea, combineMassProperties, solidMassFromIntegrals, solidMassError, isSolidMassError } from './brep/solid-mass.js';
export { loftSolid, type LoftInput, type LoftSectionInput, type LoftSectionFrame } from './features/loft.js';
export { generalShell } from './blend/general-shell.js';
export { revolutionOf, type Revolution } from './nurbs/surfaces/surface-revolution.js';
export type { MassProperties } from './brep/solid-mass.js';
export { momentOfInertiaAboutAxis } from './brep/axis-inertia.js';
export type { MassInertiaAxis } from './brep/axis-inertia.js';
export { evaluateCadPart, loadCadPart, emptyCadPart, massPropertiesOf, surfaceAreaOf, checkOutput, exportStl, flatPatternOf, outputOf, reevaluate, saveCadPart, CadPartError, CadPartLimits, stepSizeProblem, type GearPlacement, type RackPlacement, FACET_EXPLODE_TRIANGLES, FACET_PREVIEW_TRIANGLES } from './part/part-model.js';
export type { CadPartDocument, CadPartFeature, CadPartSnapshot, CadPartOutput, CadPartDim, CadPartAxis, CadPartLoopSegment, CadPartErrorCode, CadPartBeadSharing, CadPartLoftSection, CadPartSweepStep, CadPartSketchPlane, CadPartEvaluationOptions, CadPartProfileCalls, CadPartFeatureProfile, CadPartSection, CadPartFrameOverride, CadPartFrameSegment, CadPartFrameCorners, CadPartFrameNotch, CadPartFrameTrim } from './part/part-model.js';
export { booleanAnalytic } from './brep/analytic-boolean.js';
export type { AnalyticBooleanOperation } from './brep/analytic-boolean.js';
export { curveFaceRegions, locateInRegion, regionInteriorPoint } from './brep/curved-arrangement.js';
export { revolveProfile, revolveMassProperties } from './features/revolve.js';
export type { RevolveInput } from './features/revolve.js';
export { finishBrepEdges } from './blend/edge-finish.js';
export { draftedExtrusion } from './features/drafted-extrusion.js';
export { exportStep, importStep, MESH_PLANAR_LIMIT, MESH_PLANAR_TRIANGLES, stepMeshes, stepTessellatedChars, stepValidationProperties, compareValidationProperties, type StepValidationProperties, type ValidationCheck } from './io/step.js';
export type { StepExportOptions } from './io/step.js';
export type { DraftedExtrusionInput } from './features/drafted-extrusion.js';
export type { EdgeFinishKind } from './blend/edge-finish.js';
export { faceGeometry } from './brep/analytic-boolean.js';
export { splitFaceAlongCurve, splitFaceAlongIsocline } from './brep/analytic-boolean.js';
export type { FaceSplit, FaceSplitPiece, FaceSplitOptions } from './brep/analytic-boolean.js';
export { surfaceIsoclines } from './nurbs/surfaces/surface-isocline.js';
export type { SurfaceIsocline, SurfaceIsoclineOptions } from './nurbs/surfaces/surface-isocline.js';
export type { FaceGeometry } from './brep/analytic-boolean.js';
/** General marching intersection of two parametric patches (used inside the analytic Booleans). */
export { intersectPatches, chainCurve, SurfaceIntersectionError } from './intersect/surface-intersection.js';
export type { Patch, IntersectionChain } from './intersect/surface-intersection.js';
export { CAD_KERNEL_VERSION, LIBRARY_REFUSED_KINDS, loadCadLibrary, instantiateLibraryPart, parseLibraryExpression, evaluateLibraryExpression, expressionNames, CadLibraryError, CadLibraryLimits, type CadLibrary, type CadLibraryManifest, type CadLibraryPart, type CadLibraryParameter, type CadLibraryVariant, type CadLibraryRecipeFeature, type CadLibraryInterface, type CadLibraryInstance, type CadLibraryOrigin, type CadLibraryErrorCode } from './features/library.js';
export { placeByInterfaces, checkLibraryFit, type LibraryPlacement, type LibraryFitReport } from './features/library-fit.js';
export type { FilletReport } from './blend/rolling-ball.js';
/** R11b (O1): an ASCII DXF writer (AC1015, with an R12 option) for drawings, sketches and sections. */
export { writeDxf, dxfNumber, dxfText, dxfHatchLines, dxfWriteError, isDxfWriteError, DXF_WRITER_VERSION } from './io/dxf-writer.js';
export type { DxfDocument, DxfEntity, DxfLayer, DxfLinetype, DxfTextStyle, DxfBlock, DxfHatchLoop, DxfHatchFill, DxfDimensionGeometry, DxfVersion, DxfUnits, DxfXY, DxfWriteOptions, DxfWriteReport, DxfWriteResult, DxfWriteErrorCode } from './io/dxf-writer.js';
export { bendAllowance, outsideSetback, bendDeduction, contourFlangeSection, sheetMetalError, isSheetMetalError } from './frame-sheet/sheet-metal.js';
export type { SheetReport, SheetBendReport, ContourSection, ContourBend } from './frame-sheet/sheet-metal.js';
export { flatPattern, flatPatternDxf, flatPatternError, isFlatPatternError } from './frame-sheet/sheet-flat.js';
export type { FlatPattern, FlatLoop, FlatSegment, FlatBend, FlatPatternOptions, FlatPatternErrorCode } from './frame-sheet/sheet-flat.js';
export { bendTableProblem, lookupBend, rowKFactor } from './frame-sheet/sheet-metal.js';
export type { BendTable, BendTableRow, BendTableSource, BendTableUse } from './frame-sheet/sheet-metal.js';
export { frameSection, anchorPoint, loopBox, frameSectionError, isFrameSectionError, FRAME_ANCHORS } from './frame-sheet/frame-section.js';
export type { FrameSection, FrameSectionSpec, FrameAnchor, FrameMemberReport, FrameEndReport, FrameNotchReport } from './frame-sheet/frame-section.js';
export { cutPiece, cutList, cutListCsv, CutListError } from './frame-sheet/frame-cutlist.js';
export type { CutPiece, CutRow, CutList, CutEnd } from './frame-sheet/frame-cutlist.js';
export { loopArea, loopPerimeter } from './frame-sheet/frame-weldment.js';
export type { GussetReport, EndCapReport, WeldmentSeam, BeadReport, BeadJointRef, BeadSharedComponent, BeadSharedSeam } from './frame-sheet/frame-weldment.js';
// R7.3a: the one refusal shape; every error class of the kernel is a BarocssError (api-conventions.md §6).
export { BarocssError, type Problem, type RefusalWhere } from './core/barocss-error.js';
// O19: a stored name's signature, for a fillet's, chamfer's, shell's or draft's `expect` (D277).
export type { CadPartNameSignature } from './part/part-expect.js';
// R7.3a batch 2: one list of the kernel's codes (D278).
export { CAD_ERROR_CODES, CAD_REFUSAL_CODES, refusalCodeOf, type CadErrorCode, type CadRefusalCode } from './core/error-codes.js';
