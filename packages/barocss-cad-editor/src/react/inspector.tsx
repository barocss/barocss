import { useEffect, useId, useRef, useState } from 'react';
import { Focus, PanelsTopLeft, CircleHelp } from 'lucide-react';
import { CadEditorError } from '../types.js';
import type { CadEditorPoleField } from '../types.js';
import { cn } from '../lib/utils.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';
import { useCadEditorSnapshot } from './use-session.js';
import type { CadEditorInspectorProps } from './types.js';
import { CadEditorGeometryAnalysis } from './geometry-analysis.js';
import { CurveIntervalControls, useCurveInterval } from './curve-interval.js';
import { SurfaceKnotControls, useSurfaceKnot } from './surface-knot.js';
import { CurveKnotControls, useCurveKnot } from './curve-knot.js';
import { CadEditorBodyRename } from './body-rename.js';
import { SurfaceIsoCurveControls, useSurfaceIsoCurve } from './surface-isocurve.js';
import { SurfaceRegionControls, useSurfaceRegion } from './surface-region.js';
import { CurveSplitControls, useCurveSplit } from './curve-split.js';
import { SurfaceSplitControls, useSurfaceSplit } from './surface-split.js';
import { CurveJoinControls } from './curve-join.js';

const FIELDS: { field: CadEditorPoleField; label: string }[] = [
  { field: 'xMM', label: 'X (mm)' }, { field: 'yMM', label: 'Y (mm)' },
  { field: 'zMM', label: 'Z (mm)' }, { field: 'weight', label: 'Weight' },
];

function numberText(value: number): string {
  return Object.is(value, -0) ? '-0' : String(value);
}

function diagnosticText(error: CadEditorError): string {
  const messages = [error.message];
  let cause: unknown = error.cause;
  for (let index = 0; index < 4 && cause instanceof Error; index++) {
    messages.push(cause.message);
    cause = cause.cause;
  }
  return messages.join('\n');
}

function actionableMessage(error: CadEditorError): string {
  const details = diagnosticText(error);
  let cause: unknown = error;
  for (let index = 0; index < 5 && cause instanceof Error; index++) {
    if ((cause.name === 'SourceSurfaceControlNetError' || cause.name === 'SourceSurfaceControlNetWideError') && 'code' in cause && cause.code === 'BINDING') {
      return 'This Surface source cannot preserve this edit. Choose another Surface.';
    }
    cause = cause.cause;
  }
  if (/Weights must be in/i.test(details) || /weight/i.test(details) && /positive|weight.*range|weights.*within/i.test(details)) return 'Enter a weight from 0.000001 to 1000000.';
  if (/1000000|1e6/i.test(details) && /coordinate|XYZ/i.test(details)) return 'Enter coordinates from -1000000 to 1000000 mm.';
  if (/XYZ coordinates within|Coordinates must be finite and within/i.test(details)) return 'Enter coordinates from -10000 to 10000 mm.';
  const field = FIELDS.find(item => item.field === error.context.field);
  if (error.code === 'INPUT' && field) return `Enter a finite number for ${field.label}.`;
  if (error.code === 'BUDGET') return 'Use a shorter value and try again.';
  if (error.context.field === 'view' || /curve-focus|document view|focused Curve/i.test(details)) return 'Use document view or the selected Curve’s matching focus. Interval editing still requires focus.';
  if (error.context.field === 'edit-capability') return 'Choose a supported object to change control points.';
  if (error.code === 'UNSUPPORTED') return 'Cannot edit these points with the current tool. Open Help or choose another object.';
  if (error.code === 'STALE') return 'Select the control pole again, then apply the change.';
  if (error.code === 'LIFECYCLE') return 'Reopen the document to continue editing.';
  return 'The change was not applied. Check the values and try again.';
}

export function CadEditorInspector({ session, onError, onAnalysis, onLength, className }: CadEditorInspectorProps) {
  const snapshot = useCadEditorSnapshot(session);
  const interval = useCurveInterval();
  const knot = useSurfaceKnot();
  const curveKnot = useCurveKnot();
  const isoCurve = useSurfaceIsoCurve();
  const region = useSurfaceRegion();
  const split = useCurveSplit();
  const surfaceSplit = useSurfaceSplit();
  const id = useId();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastError, setLastError] = useState<CadEditorError | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const lastFieldRef = useRef<HTMLInputElement | null>(null);
  const composingFieldsRef = useRef(new Set<CadEditorPoleField>());
  const restoreFieldFocusRef = useRef(false);
  const attemptedTransitionRef = useRef<string | null>(null);
  const { selection, curveSelection, accepted, pending, candidate } = snapshot;
  const pole = selection ?? curveSelection;
  const transition = snapshot.selectionTransition;
  const contextActive = interval?.active === true || knot?.active === true || curveKnot?.active === true
    || isoCurve?.active === true || region?.active === true || split?.active === true || surfaceSplit?.active === true;
  const busy = candidate !== null || snapshot.disposed || interval?.active === true || knot?.active === true || curveKnot?.active === true || isoCurve?.active === true || region?.active === true || split?.active === true || surfaceSplit?.active === true;
  const transitionBusy = surfaceSplit?.active ? candidate !== null || snapshot.disposed || surfaceSplit.gesture.current : split?.active ? candidate !== null || snapshot.disposed || split.gesture.current : region?.active ? candidate !== null || snapshot.disposed || region.gesture.current : isoCurve?.active ? candidate !== null || snapshot.disposed || isoCurve.gesture.current : busy;
  const capability = snapshot.bodyCapabilities.find(body => body.bodyId === snapshot.selectedBodyId);
  const selectedBody = accepted.document.bodies.find(body => body.id === snapshot.selectedBodyId);
  const selectedKind = accepted.bodyBindings.find(body => body.bodyId === snapshot.selectedBodyId)?.geometryKind;
  const objectMode = snapshot.editTarget === 'object';
  const rotationMode = snapshot.editTarget === 'rotation';
  const scaleMode = snapshot.editTarget === 'scale';
  const transformMode = objectMode||rotationMode||scaleMode;
  const bodyOnly = pole === null && snapshot.selectedBodyId !== null && (selectedKind === 'surface' || selectedKind === 'curve');
  const canMoveBody = capability?.canTranslateBody === true && (snapshot.view.kind === 'document'
    || selectedKind === 'curve' && snapshot.view.bodyId === snapshot.selectedBodyId);
  const scaleComposing=useRef(false);
  const rotationComposing=useRef(false);
  const canEdit = objectMode && bodyOnly ? canMoveBody : selection !== null ? (scaleMode ? capability?.canScaleBody === true : rotationMode ? capability?.canRotateBody === true : objectMode ? capability?.canTranslateBody === true : capability?.canEditSurfacePole === true) && snapshot.view.kind === 'document'
    : curveSelection !== null && (scaleMode ? capability?.canScaleBody === true : rotationMode ? capability?.canRotateBody === true : objectMode ? capability?.canTranslateBody === true : capability?.canEditCurvePole === true) && (snapshot.view.kind === 'document' || snapshot.view.kind === 'curve-focus' && snapshot.view.bodyId === curveSelection.bodyId);
  useEffect(() => {
    if (!transition) {
      attemptedTransitionRef.current = null;
      setTransitionError(null);
    } else if (attemptedTransitionRef.current === transition.token && !candidate) {
      setTransitionError('Cannot apply this change. Your draft is retained. Cancel to revise the values.');
    }
  }, [transition?.token, candidate?.token]);
  function action(run: () => void, inTransition = false) {
    try { run(); setErrorMessage(null); setLastError(null); if (inTransition) setTransitionError(null); }
    catch (cause) {
      const error = cause instanceof CadEditorError ? cause
        : new CadEditorError('INPUT', cause instanceof Error ? cause.message : 'The editor action was refused.', {}, cause);
      setErrorMessage(actionableMessage(error));
      setLastError(error);
      if (inTransition) setTransitionError(actionableMessage(error));
      try { onError?.(error); } catch { /* Host callbacks do not change the session. */ }
    }
  }
  function select(uIndex: number, vIndex: number) {
    if (selection) action(() => session.requestSelection({ bodyId: selection.bodyId, uIndex, vIndex }));
  }
  function resolveTransition(decision: 'apply' | 'discard' | 'cancel') {
    const current = session.getSnapshot().selectionTransition;
    if (!current) return;
    if (decision === 'cancel') restoreFieldFocusRef.current = true;
    action(() => {
      const prepared = session.resolveSelectionTransition(current.token, decision);
      if (prepared) attemptedTransitionRef.current = current.token;
    }, true);
  }
  return <aside className={cn('cad-editor-inspector', transformMode&&'cad-editor-object-translation', className)} aria-label="Native control point inspector">
    <div className="cad-editor-inspector-title">
      <h2 className="cad-editor-heading">{scaleMode ? 'Scale object' : rotationMode ? 'Rotate object' : objectMode ? 'Move object' : curveSelection ? 'Curve point' : selection ? 'Control point' : 'Object'}</h2>
      <Dialog>
        <DialogTrigger asChild><Button type="button" variant="ghost" size="xs" className="cad-editor-operation-icon" data-testid="cad-editor-help"
          aria-label="Control point editing help" title="Control point editing help"><CircleHelp size={16} aria-hidden="true" /></Button></DialogTrigger>
        <DialogContent className="cad-editor-help-dialog">
          <DialogHeader><DialogTitle>Control point editing help</DialogTitle>
            <DialogDescription>Current native requirements and document details.</DialogDescription></DialogHeader>
          <div className="cad-editor-help-body">
            <section><h3>Current editing requirements</h3>
              <p>The native document can contain 1–4 source assets and up to 16 bodies. The viewport displays 1–4 chosen bodies at a time.</p>
              <p>Move object also works after a coefficient change clears the point selection. Its Canvas anchor is the native control-hull box centre, used only for translation display. Rotate and Scale still require an original selected point.</p>
              <p>Choose the displayed bodies in the object list. You can select and inspect a hidden body. Show it before using Fit Selected.</p>
              <p>Double-click a displayed object to fit it in the canvas. The first click uses the normal object selection. Fitting changes only the camera and uses the same view as Fit Selected. Finish a drag, apply or discard a draft, and close menus or dialogs before fitting. Empty or ambiguous hits cannot fit an object.</p>
              <p>Supported Surfaces and Curves can use point, Move, Rotate and Scale editing in document view. The whole source remains authority when its Model name differs from its geometry ID. Focus Curve is an optional separate view.</p>
              <p>The current native Surface point writer supports degree 1–5, 2–16 control poles on each grid axis and at most 256 poles. Coordinates can be within ±1000000 mm, weights within 0.000001–1000000 and the native Surface ID within 48 characters. Apply uses the wide complete-source writer and its native validator.</p>
              <p>Source0 assets support 1–16 objects and at most 262144 UTF-16 code units and UTF-8 bytes. Pole edits require directly authored numeric coefficient bindings. The native provider can refuse unsupported bindings or source budgets during Apply.</p>
              <p>Display parsing reads the whole source asset, including hidden sibling objects. Hiding bodies does not remove those siblings from the source or bypass parsing limits.</p>
              <p>A native source edit does not prove display support. A degree 5 Curve in the displayed Surface's asset still reaches the actual Viewer sampling refusal. A degree 5 Curve in a separate hidden asset is preserved without a sampling or display claim.</p>
              <p>Coordinates use authored X, Y and Z in mm. They map directly to the display axes. The editor does not silently swap or convert axes.</p>
              <p>U and V select an original Surface control pole. Coordinates and weight edit its native coefficients. Display samples are separate from these coefficients.</p>
              <p>Curve points use one original pole index, displayed as Point 1, Point 2 and so on. Curve editing supports native degree 1–5, 2–64 poles and at most 70 knots, coordinates within ±1000000 mm, weights 0.000001–1000000 and native Curve IDs within 48 characters. The native full-source writer and validator own profile and coefficient-binding refusal.</p>
              <p>The separate focused display compiles the complete selected asset, keeps 1–4 original objects and at most 65536 UTF-8 bytes and code units, and samples the selected Curve uniformly at 65 original parameters. It does not extract a smaller source or replace native coefficients with samples. Canonical document Curve sampling retains its current degree 1–3 profile; Surface display uses native degree 1–5 evaluation.</p>
              <p>The focused Viewer additionally requires source Model and selected Curve IDs within its ASCII 1–64 profile, and sampled coordinates after positive display scaling within ±1000 scene units. These display limits are narrower than native source editing; a native candidate can still be refused for display.</p>
              <p>Focus Curve and Return to document view are explicit display-only changes. They retain source, history, native draft and download state. Return loads the current accepted document with its retained canonical display subset and camera; a refused return keeps the focused view.</p>
              <p>Focused display has no Viewer document or document-body bindings. Its copied receipt separately qualifies the actual canonical body, asset, complete source Model and original Curve. Uniform samples are derived observations, not certified adaptive tessellation or geometric accuracy.</p>
              <p>Drag an original point handle in the current camera-facing plane. The pending handle and control polygon are a distinct ghost; the accepted Curve stays unchanged until pointer release prepares one actual Apply. Escape or pointer cancellation restores only the gesture-owned draft and previous point. A refused change keeps corrective raw values.</p>
              <p>In document view, an editable, displayed Surface has handles for its original controlPoints[u][v] and U/V grid edges. Drag a point in the current camera-facing plane. The pending net is a distinct ghost; the accepted Surface and frame stay unchanged until release prepares one actual native Apply. A successful change adds one history step. Weight stays unchanged. Escape or pointer cancellation restores only the gesture-owned draft and previous U/V selection. A refused change keeps corrective raw values.</p>
              <p>Control handles can be offscreen or visually overlap. Use the exact U/V selectors for a Surface or the Point selector for a Curve, then use the XYZ/weight fields. Surface and Curve handles represent original native coefficients, not mesh samples. They are approximate overlays, not certified topology picks. The selected point also has X, Y and Z axis handles. A handle moves only its original coordinate. A nearly camera-aligned axis is hidden; choose Isometric to reach other axes. Live whole-shape preview is not included.</p>
            </section>
            <section><h3>Tool commands</h3>
              <p>Use the four buttons in the viewport, or focus the canvas and press Q for Control point, W for Move object, E for Rotate object or R for Scale object. The palette shows only the settings for the current tool.</p>
              <p>Commands are disabled while a gesture, draft, candidate or selection decision is active. Apply or discard the draft first. Keys do not change tools while you type in a field or use a menu, dialog or text composition. Each tool keeps its own units and the selected original grip.</p>
              <p>Choosing a tool changes only the local editing mode. It does not edit geometry, source, view or history. Unsupported or hidden objects need the existing point selectors, Focus Curve or document view controls.</p>
            </section>
            <section><h3>Axis movement and snapping</h3>
              <p>Drag a colored X, Y or Z axis handle to move the selected original point along that axis. Perspective projection maps the pointer to the world axis. Other coordinates and weight stay unchanged. Release prepares one native change; Escape or pointer cancellation clears only that gesture's draft.</p>
              <p>Snap movement rounds the distance from the starting point to the nearest step in mm. It does not round the absolute coordinate or change native units. The step must be a finite number from 0.000001 to 1000000 mm. Invalid text stays visible and prevents an axis move.</p>
              <p>Focus an axis handle and use the arrow keys to move one step. Without snapping, a keyboard step is 1 mm. Settings and view buttons are disabled while a draft or gesture is active. Snapping settings stay local to this viewport; they are not saved with the document or recovery copy.</p>
              <p>The colored axis and control-point ghost are pending coefficients. The actual accepted shape changes only after native validation, display admission and a fresh frame read. A refused edit retains its raw value for correction.</p>
            </section>
            <section><h3>Scaling an object</h3>
              <p>Choose Scale object in the viewport toolbar. The All axis button changes every original coordinate around the selected grip. The X, Y or Z axis button changes only that world axis. The grip is an original control pole, not a certified center.</p>
              <p>Factor is a ratio: 1 keeps the size, 2 doubles it and 0.5 halves it. Enter a finite positive factor from 0.001 to 100. Zero, negative values and reflection are not supported. Native coordinate, matrix or display limits can still refuse a change.</p>
              <p>Drag the square handle. Axis handles invert the actual perspective projection; All uses the screen-diagonal distance from its captured start as a ratio. Snap factor rounds the change from 1 using a separate step from 0.001 to 1. Arrow keys apply 1.1 or 0.9 without snapping, or one factor step with snapping.</p>
              <p>The pending square and Factor field show the proposed ratio. The full accepted shape stays unchanged until release and successful admission. One accepted change adds one history entry. Escape or pointer cancellation discards only the owned draft; a refusal retains the raw factor for correction.</p>
              <p>Scaling uses the native affine provider and complete-source writers. Original IDs, weights, knots, sibling objects and other assets are preserved. Curve scaling requires its matching focused view; Surface scaling requires document view. The wide Surface writer receives all transformed original poles in one private request. Temporary IDs, mode, axes and snapping are not saved in the native document or recovery copy.</p>
            </section>
            <section><h3>Moving an object</h3>
              <p>Choose Move object in the viewport toolbar to translate the entire selected Curve or Surface. Offsets use mm from the current accepted position. The original point selected by U/V or Point is the movement grip; it is not a certified center.</p>
              <p>Drag an XY, XZ or YZ plane handle to move along two world axes. The third axis stays unchanged. A nearly edge-on or offscreen plane is hidden. Each movement snap step applies from the captured pointer start. Right and Left increase or decrease the first named axis; Up and Down change the second. Release applies one complete native move; Escape cancels only the owned draft.</p>
              <p>Native affine transformation computes every original pole. Source-preserving writers apply the resulting coordinates to the complete original asset. Knots, weights, geometry IDs, sibling objects and other assets stay unchanged. Temporary native transform geometry is validation evidence; it is not a new saved object or a replacement source.</p>
              <p>The current native affine profile supports Curve and Surface degree 1–5, with 2–64 Curve poles or 2–16 Surface poles per axis and at most 256 Surface poles. Original and transformed coordinates, matrix translation and original knots must remain within ±10000. Coordinate and translation values use mm; knot values are original parameters. This affine requirement is separate from the wider Surface point-edit range. Source bindings, native numeric or display requirements can still refuse a change. Curve moves use document view or matching Curve focus; Surface moves require document view.</p>
              <p>The wide Surface writer applies all transformed original poles in one private, validated complete-source request. One accepted movement adds one history entry. A refusal retains the original source and offsets.</p>
              <p>The control net shifts as a pending ghost. The full accepted shape changes only after release, native validation and the actual rendered frame. Changing tools requires an empty draft and does not edit source or history. Open resets the tool to Control point. Move settings and temporary transform IDs are not stored in the native document or recovery copy.</p>
            </section>
            <section><h3>Rotating an object</h3>
              <p>Choose Rotate object in the viewport toolbar. The selected original point is the pivot. Select a world X, Y or Z axis button, then drag the projected ring or enter an angle in degrees. Positive angles follow the right-hand rule. The current action accepts angles from -360 to 360 degrees.</p>
              <p>Snap angle uses a separate degree step from 0.001 to 180. It does not use the movement step in mm. Arrow keys on the ring rotate by one degree without snapping, or by the selected angle step. A full turn is a native no-op.</p>
              <p>The ring is projected from its world plane through the actual camera. A nearly edge-on plane, offscreen ring or near-pivot pointer can be refused. Choose another view or fit the selected grip. Ring angles are display observations, not certified topology picks.</p>
              <p>Angle and marker changes remain pending. The actual native affine engine rotates every original coefficient around the captured pivot. Full-source writers retain original IDs, knots, weights and siblings. The native matrix translation and generated coordinates remain within the current ±10000 mm affine profile; rotation about a distant pivot can be refused rather than clamped.</p>
              <p>Release prepares one native candidate. The actual Viewer and fresh rendered frame gate one history entry. Escape or pointer cancellation clears only owned current raw; a changed axis, pivot, view or raw value retains corrective data. Axis/mode settings and temporary transform IDs are not saved. Open resets Control point and Z rotation axis.</p>
            </section>
            <section><h3>Complete source preservation</h3>
              <p>Apply uses the native source-preserving edit provider's complete result.source and result.model. The source keeps untouched spelling, whitespace and comments. The Model keeps its name, object order, native IDs and sibling objects. Only the requested coordinate or weight literals change.</p>
              <p>The wide Surface result.surface and provenance describe the selected native coefficients. The complete result.source and result.model remain authority for the whole asset. The editor adopts that complete source and rebuilds the document through the native API.</p>
              <p>These ranges describe current native and display admission. They do not define the final modeling scope. A native-valid change still needs actual display admission; no source extraction, silent conversion or numeric clamp bypasses a refusal.</p>
              <p>Only the document and edited asset revisions advance. Canonical asset, body and geometry IDs keep their associations. Other asset revisions and hidden source bytes remain unchanged. An exact native no-op keeps the original source, revisions and history.</p>
              <p>Successful native validation is followed by complete selected-asset Viewer admission and a fresh RGBA frame read. A refused source, binding or display keeps the accepted source, history, draft, selection and current view.</p>
            </section>
            <section><h3>Draft and current values</h3>
              <p>Changed fields remain pending until you select Apply. Discard restores the current values.</p>
              <p>When you select another object or control pole with a draft, choose Apply, Discard or Cancel. Cancel keeps the draft and returns focus to the last coordinate or weight field.</p>
              <p>Apply prepares a native source candidate. The candidate becomes accepted after native validation and successful display. Download writes the accepted document.</p>
              <p>Changing the displayed set does not edit the source, clear a draft or add a history entry. A rejected display change keeps the current view and displayed set.</p>
              {Object.keys(pending).length > 0 && <dl className="cad-editor-reference">
                {FIELDS.filter(({ field }) => Object.hasOwn(pending, field)).map(({ field, label }) => <div key={field}>
                  <dt>Draft {label}</dt><dd>{pending[field]}</dd>
                </div>)}
              </dl>}
              {!candidate && <p>No native source candidate is waiting for display.</p>}
            </section>
            <section><h3>Keyboard</h3>
              <p>Enter in a coordinate or weight field applies the draft. During text composition, Enter commits text only. Escape in the field keeps its draft and focus.</p>
              <p>Outside text fields, Cmd/Ctrl+Z undoes a change. Shift+Cmd/Ctrl+Z and Ctrl+Y redo it. Apply or discard pending values before using these shortcuts. Text fields keep the browser text undo.</p>
              <p>Escape in the selection decision cancels the selection change. Escape in the viewport keeps the selected object and camera.</p>
              <p>Click a displayed object to select it. Drag to orbit or Shift-drag to pan without changing selection. Fit Document uses the native bounds of the displayed set; Fit Selected uses the displayed selected body's native bounds.</p>
              <p>Front looks from +Z, Right from +X, Top from +Y and Isometric from +XYZ in the actual right-handed, Y-up display basis. These are perspective views. They preserve the current camera target and distance. View buttons are disabled while a draft, candidate or selection decision is active.</p>
            </section>
            {selection && <details className="cad-editor-source">
              <summary className="cad-editor-source-title">Original native coefficients and binding</summary>
              <dl className="cad-editor-reference">
                <dt>Object</dt><dd>{selection.reference.geometryId}</dd>
                <dt>Asset</dt><dd>{selection.reference.assetId} · revision {selection.reference.assetRevision}</dd>
                <dt>Document</dt><dd>{selection.reference.documentId} · revision {selection.reference.documentRevision}</dd>
                <dt>Control pole</dt><dd>U {selection.uIndex}, V {selection.vIndex}</dd>
                {FIELDS.map(({ field, label }) => <div key={field}><dt>Current {label}</dt><dd>{numberText(selection.accepted[field])}</dd></div>)}
              </dl>
            </details>}
            {curveSelection && <details className="cad-editor-source"><summary className="cad-editor-source-title">Original Curve coefficients and binding</summary>
              <dl className="cad-editor-reference"><dt>Body</dt><dd>{curveSelection.bodyId}</dd><dt>Asset</dt><dd>{curveSelection.reference.assetId} · revision {curveSelection.reference.assetRevision}</dd>
                <dt>Curve</dt><dd>{curveSelection.reference.geometryId}</dd><dt>Document</dt><dd>{curveSelection.reference.documentId} · revision {curveSelection.reference.documentRevision}</dd>
                <dt>Point</dt><dd>{curveSelection.index + 1} of {curveSelection.count}</dd>
                {FIELDS.map(({ field, label }) => <div key={field}><dt>Current {label}</dt><dd>{numberText(curveSelection.accepted[field])}</dd></div>)}
              </dl></details>}
            <details className="cad-editor-source">
              <summary className="cad-editor-source-title">Accepted native source</summary>
              {accepted.document.assets.map(asset => <section key={asset.id}>
                <h4>{asset.id} · revision {asset.revision}</h4><pre>{asset.source}</pre>
              </section>)}
            </details>
            {candidate?.kind === 'display' && <details className="cad-editor-source" open>
              <summary className="cad-editor-source-title">Pending display set</summary>
              <p>{candidate.displayBodyIds.map(bodyId => accepted.document.bodies.find(body => body.id === bodyId)?.name ?? bodyId).join(', ')}</p>
              <p>The accepted native source is unchanged.</p>
            </details>}
            {candidate && candidate.kind !== 'display' && <details className="cad-editor-source" open>
              <summary className="cad-editor-source-title">Pending native source · awaiting display</summary>
              {candidate.result.document.assets.map(asset => <section key={asset.id}>
                <h4>{asset.id} · revision {asset.revision}</h4><pre>{asset.source}</pre>
              </section>)}
            </details>}
            <details className="cad-editor-source">
              <summary className="cad-editor-source-title">Accepted history</summary>
              <p>State {snapshot.history.index + 1} of {snapshot.history.count} · {snapshot.history.bytes} bytes</p>
              <p>Document revision {accepted.document.revision} · {snapshot.downloadStatus}</p>
              <p>Displayed bodies {snapshot.displayBodyIds.length} · display generation {snapshot.displayGeneration}</p>
            </details>
            {lastError && <details className="cad-editor-source">
              <summary className="cad-editor-source-title">Last error details</summary>
              <p>{lastError.code}</p><pre>{diagnosticText(lastError)}</pre>
            </details>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
    <Dialog open={transition !== null} onOpenChange={open => { if (!open) resolveTransition('cancel'); }}>
      <DialogContent className="cad-editor-help-dialog cad-editor-transition-dialog" showCloseButton={false}
        data-testid="cad-editor-transition"
        onPointerDownOutside={event => event.preventDefault()}
        onEscapeKeyDown={event => { event.preventDefault(); resolveTransition('cancel'); }}
        onCloseAutoFocus={event => {
          if (!restoreFieldFocusRef.current) return;
          event.preventDefault();
          restoreFieldFocusRef.current = false;
          const field = lastFieldRef.current;
          if (field?.isConnected && !field.disabled) field.focus({ preventScroll: true });
        }}>
        <DialogHeader><DialogTitle>Keep your changes?</DialogTitle>
          <DialogDescription>Apply or discard the draft before changing selection. Cancel keeps your current selection.</DialogDescription></DialogHeader>
        {transitionError && <p className="cad-editor-error" role="alert">{transitionError}</p>}
        <div className="cad-editor-transition-actions">
          <Button type="button" disabled={transitionBusy} data-testid="cad-editor-transition-apply" onClick={() => resolveTransition('apply')}>Apply</Button>
          <Button type="button" variant="outline" disabled={transitionBusy} data-testid="cad-editor-transition-discard" onClick={() => resolveTransition('discard')}>Discard</Button>
          <Button type="button" variant="ghost" disabled={snapshot.disposed} data-testid="cad-editor-transition-cancel" onClick={() => resolveTransition('cancel')}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
    <div className="cad-editor-object-context">
      <span className="cad-editor-context-label">Selected object</span>
      <h3 title={selectedBody?.name}>{selectedBody?.name ?? 'No object selected'}</h3>
      {selectedKind && <p>{selectedKind === 'surface' ? 'Surface' : 'Curve'} · XYZ / mm{selection && <span>U {selection.uIndex} · V {selection.vIndex}</span>}{curveSelection && <span>Point {curveSelection.index + 1}</span>}</p>}
    </div>
    <div className="cad-editor-field cad-editor-object-field">
      <Label htmlFor={`${id}-body`}>Object</Label>
      <select id={`${id}-body`} value={snapshot.selectedBodyId ?? ''} disabled={busy || accepted.document.bodies.length === 0}
        data-testid="cad-editor-body" onChange={event => action(() => session.requestSelection({ bodyId: event.target.value }))}>
        {snapshot.selectedBodyId === null && <option value="">Select an object</option>}
        {accepted.document.bodies.map(body => <option key={body.id} value={body.id}>
          {body.name}{snapshot.bodyCapabilities.find(capability => capability.bodyId === body.id)?.canEditSurfacePole === false
            && snapshot.bodyCapabilities.find(capability => capability.bodyId === body.id)?.canEditCurvePole === false ? ' · read-only' : ''}
        </option>)}
      </select>
    </div>
    {!isoCurve?.active && !region?.active && !split?.active && !surfaceSplit?.active && <CadEditorBodyRename session={session} onError={onError} />}
    {selectedKind==='curve'&&!interval?.active&&!knot?.active&&!curveKnot?.active&&!isoCurve?.active&&!region?.active&&!split?.active&&!surfaceSplit?.active&&<CurveJoinControls session={session} onError={onError} />}
    <div className="cad-editor-context-tools" role="group" aria-label="Object operations" data-active={contextActive}>
    <div className="cad-editor-curve-view-actions cad-editor-context-entry" data-active={false}>
      {curveSelection && <Button type="button" variant="outline" size="sm" className="cad-editor-operation-icon" aria-label="Focus Curve" title="Focus Curve" data-testid="curve-focus" disabled={busy || transition !== null}
        onClick={() => action(() => { session.prepareCurveFocus(curveSelection.bodyId, 65); })}><Focus size={16} aria-hidden="true" /></Button>}
      {snapshot.view.kind === 'curve-focus' && <Button type="button" variant="outline" size="sm" className="cad-editor-operation-icon" aria-label="Return to document view" title="Return to document view" data-testid="curve-return-document" disabled={busy || transition !== null}
        onClick={() => action(() => { session.prepareDocumentView(); })}><PanelsTopLeft size={16} aria-hidden="true" /></Button>}
    </div>
    {selectedKind === 'curve' && !curveKnot?.active && !isoCurve?.active && !region?.active && !split?.active && !surfaceSplit?.active && <div className="cad-editor-context-entry" data-active={interval?.active === true}><CurveIntervalControls session={session} /></div>}
    {selectedKind === 'curve' && !interval?.active && !knot?.active && !isoCurve?.active && !region?.active && !split?.active && !surfaceSplit?.active && <div className="cad-editor-context-entry" data-active={curveKnot?.active === true}><CurveKnotControls session={session} /></div>}
    {selectedKind === 'surface' && !curveKnot?.active && !isoCurve?.active && !region?.active && !split?.active && !surfaceSplit?.active && <div className="cad-editor-context-entry" data-active={knot?.active === true}><SurfaceKnotControls session={session} /></div>}
    {selectedKind === 'surface' && !interval?.active && !knot?.active && !curveKnot?.active && !region?.active && !split?.active && !surfaceSplit?.active && <div className="cad-editor-context-entry" data-active={isoCurve?.active === true}><SurfaceIsoCurveControls session={session} /></div>}
    {selectedKind === 'surface' && !interval?.active && !knot?.active && !curveKnot?.active && !isoCurve?.active && !split?.active && !surfaceSplit?.active && <div className="cad-editor-context-entry" data-active={region?.active === true}><SurfaceRegionControls session={session} /></div>}
    {selectedKind === 'curve' && !interval?.active && !knot?.active && !curveKnot?.active && !isoCurve?.active && !region?.active && !surfaceSplit?.active && <div className="cad-editor-context-entry" data-active={split?.active === true}><CurveSplitControls session={session} /></div>}
    {selectedKind === 'surface' && !interval?.active && !knot?.active && !curveKnot?.active && !isoCurve?.active && !region?.active && !split?.active && <div className="cad-editor-context-entry" data-active={surfaceSplit?.active === true}><SurfaceSplitControls session={session} /></div>}
    </div>
    {!interval?.active && !curveKnot?.active && !isoCurve?.active && !region?.active && !split?.active && !surfaceSplit?.active && selectedKind === 'curve' && curveSelection === null && snapshot.selectedBodyId && <Button type="button" variant="outline" size="sm"
      data-testid="cad-editor-curve-select-point" disabled={candidate !== null || snapshot.disposed || Object.keys(pending).length > 0}
      onClick={() => action(() => session.selectCurvePole({ bodyId: snapshot.selectedBodyId!, index: 0 }))}>Select a point</Button>}
    {!knot?.active && !isoCurve?.active && !region?.active && !split?.active && !surfaceSplit?.active && selectedKind === 'surface' && selection === null && snapshot.selectedBodyId && <Button type="button" variant="outline" size="sm"
      data-testid="surface-select-point" disabled={candidate !== null || snapshot.disposed || transition !== null || Object.keys(pending).length > 0}
      onClick={() => action(() => session.selectSurfacePole({ bodyId: snapshot.selectedBodyId!, uIndex: 0, vIndex: 0 }))}>Select a point</Button>}
    {!interval?.active&&!knot?.active&&!curveKnot?.active&&!isoCurve?.active&&!region?.active&&!split?.active&&!surfaceSplit?.active&&bodyOnly&&!objectMode
      &&snapshot.view.kind==='document'&&!snapshot.displayBodyIds.includes(snapshot.selectedBodyId!)&&<Button type="button" variant="outline" size="sm"
        data-testid="inspector-move-body" disabled={busy||!canMoveBody||transition!==null||Object.keys(pending).length>0}
        onClick={()=>action(()=>{const current=session.getSnapshot();
          if(current.selectedBodyId!==snapshot.selectedBodyId||current.generation!==snapshot.generation||current.displayGeneration!==snapshot.displayGeneration
            ||current.selection!==null||current.curveSelection!==null||current.candidate||current.selectionTransition||current.disposed||Object.keys(current.pending).length
            ||document.querySelector('[role="dialog"][data-state="open"],[role="menu"]')||document.activeElement?.closest('[data-direct-host-busy="true"],[data-panel-resizing="true"]'))
            throw new CadEditorError('STALE','The selected body changed. Review the object.',{field:'body-translation'});
          session.setEditTarget('object');})}>Move object</Button>}
    {!interval?.active && !knot?.active && !curveKnot?.active && !isoCurve?.active && !region?.active && !split?.active && !surfaceSplit?.active && (pole || objectMode && bodyOnly) ? <>
      {selection && capability?.canEditSurfacePole === false && <p className="cad-editor-readonly" role="status" data-testid="cad-editor-readonly-surface">
        Cannot edit these points. Open Help for details, or choose another Surface.
      </p>}
      {selection && snapshot.view.kind !== 'document' && <p role="status" className="cad-editor-readonly">Return to document view to edit Surface points.</p>}
      {curveSelection && capability?.canEditCurvePole === false && <p role="status" className="cad-editor-readonly" data-testid="cad-editor-readonly-curve">These Curve points are outside the editing limits. Open Help or choose another Curve.</p>}
      {snapshot.view.kind === 'document' && snapshot.selectedBodyId !== null && !snapshot.displayBodyIds.includes(snapshot.selectedBodyId)
        && <p className="cad-editor-hidden-body" role="status">This object is not displayed. Show it to fit or select it in the viewport.</p>}
      {selection ? <div className="cad-editor-selection">
        <div className="cad-editor-field"><Label htmlFor={`${id}-u`}>U index</Label>
          <select id={`${id}-u`} value={selection.uIndex} disabled={busy} data-testid="cad-editor-u"
            onChange={event => select(Number(event.target.value), selection.vIndex)}>
            {Array.from({ length: selection.countU }, (_, index) => <option key={index} value={index}>{index}</option>)}
          </select>
        </div>
        <div className="cad-editor-field"><Label htmlFor={`${id}-v`}>V index</Label>
          <select id={`${id}-v`} value={selection.vIndex} disabled={busy} data-testid="cad-editor-v"
            onChange={event => select(selection.uIndex, Number(event.target.value))}>
            {Array.from({ length: selection.countV }, (_, index) => <option key={index} value={index}>{index}</option>)}
          </select>
        </div>
      </div> : curveSelection && <div className="cad-editor-field"><Label htmlFor={`${id}-curve-index`}>Point</Label>
        <select id={`${id}-curve-index`} data-testid="cad-editor-curve-index" value={curveSelection.index} disabled={busy || transition !== null}
          onChange={event => action(() => session.requestSelection({ bodyId: curveSelection.bodyId, index: Number(event.target.value) }))}>
          {Array.from({ length: curveSelection.count }, (_, index) => <option key={index} value={index}>Point {index + 1}</option>)}
        </select></div>}
      <h3 className="cad-editor-heading">{scaleMode ? 'Scale' : rotationMode ? 'Rotation' : objectMode ? 'Object offset (mm)' : 'Coordinates and weight'}</h3>
      {Object.keys(pending).length > 0 && <p className="cad-editor-draft-status">Unapplied changes</p>}
      {transformMode && !(scaleMode?capability?.canScaleBody:rotationMode?capability?.canRotateBody:capability?.canTranslateBody) && <p className="cad-editor-readonly" role="status">Cannot transform this object. Use Control point editing, or open Help for details.</p>}
      {transformMode && (!(scaleMode?capability?.canScaleBody:rotationMode?capability?.canRotateBody:capability?.canTranslateBody) || !canEdit || snapshot.view.kind==='document'&&!snapshot.displayBodyIds.includes(snapshot.selectedBodyId!)) && <div className="cad-editor-field">
        <Label htmlFor={`${id}-edit-target`}>Target</Label><select id={`${id}-edit-target`} data-testid="inspector-edit-target" value={snapshot.editTarget} disabled={busy||Object.keys(pending).length>0||transition!==null}
          onChange={event=>action(()=>session.setEditTarget(event.target.value as 'pole'|'object'|'rotation'|'scale'))}><option value="pole">Control point</option><option value="object" disabled={!capability?.canTranslateBody}>Object</option><option value="rotation" disabled={!pole||!capability?.canRotateBody}>Rotate object</option><option value="scale" disabled={!pole||!capability?.canScaleBody}>Scale object</option></select></div>}
      {rotationMode&&<>
        <p className="cad-editor-grip-note">{snapshot.rotationAxis.toUpperCase()} axis · Selected grip</p>
        <div className="cad-editor-field"><Label htmlFor={`${id}-rotation-angle`}>Angle (deg)</Label>
          <Input id={`${id}-rotation-angle`} data-testid="cad-editor-angle-degrees" type="text" inputMode="decimal" disabled={busy||!canEdit}
            value={pending.angleDegrees??'0'} className={Object.hasOwn(pending,'angleDegrees')?'cad-editor-pending-input':undefined}
            onFocus={event=>{lastFieldRef.current=event.currentTarget;}}
            onCompositionStart={()=>{rotationComposing.current=true;}} onCompositionEnd={()=>{rotationComposing.current=false;}}
            onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();return;}if(event.key==='Enter'&&!event.repeat&&!event.nativeEvent.isComposing&&event.keyCode!==229&&!rotationComposing.current&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();event.stopPropagation();action(()=>{session.prepareApply();});}}}
            onChange={event=>action(()=>session.stageBodyRotation(event.target.value))}/>
          {Object.hasOwn(pending,'angleDegrees')&&<span className="cad-editor-accepted">Current: 0</span>}
        </div>
      </>}
      {scaleMode&&<>
        <p className="cad-editor-grip-note">{snapshot.scaleAxis==='uniform'?'All axes':snapshot.scaleAxis.toUpperCase()+' axis'} · Selected grip</p>
        <div className="cad-editor-field"><Label htmlFor={`${id}-scale-factor`}>Factor (×)</Label>
          <Input id={`${id}-scale-factor`} data-testid="cad-editor-scale-factor" type="text" inputMode="decimal" maxLength={128} disabled={busy||!canEdit}
            value={pending.scaleFactor??'1'} className={Object.hasOwn(pending,'scaleFactor')?'cad-editor-pending-input':undefined}
            onFocus={event=>{lastFieldRef.current=event.currentTarget;}}
            onCompositionStart={()=>{scaleComposing.current=true;}} onCompositionEnd={()=>{scaleComposing.current=false;}}
            onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();return;}if(event.key==='Enter'&&!event.repeat&&!event.nativeEvent.isComposing&&event.keyCode!==229&&!scaleComposing.current&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();event.stopPropagation();action(()=>{session.prepareApply();});}}}
            onChange={event=>action(()=>session.stageBodyScale(event.target.value))}/>
          {Object.hasOwn(pending,'scaleFactor')&&<span className="cad-editor-accepted">Current: 1</span>}
        </div>
      </>}
      {!rotationMode&&!scaleMode&&FIELDS.filter(({field})=>!objectMode||field!=='weight').map(({ field, label }) => <div className="cad-editor-field" key={field}>
        <Label htmlFor={`${id}-${field}`}>{objectMode ? 'Offset '+field[0].toUpperCase() : label}</Label>
        <Input id={`${id}-${field}`} type="text" inputMode="decimal" disabled={busy || !canEdit}
          className={Object.hasOwn(pending, field) ? 'cad-editor-pending-input' : undefined}
          value={pending[field] ?? (objectMode?'0':numberText(pole!.accepted[field]))} data-testid={`cad-editor-${field}`}
          onFocus={event => { lastFieldRef.current = event.currentTarget; }}
          onCompositionStart={() => { composingFieldsRef.current.add(field); }}
          onCompositionEnd={() => { composingFieldsRef.current.delete(field); }}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            if (!canEdit || event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229
              || composingFieldsRef.current.has(field) || event.repeat
              || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            event.preventDefault();
            event.stopPropagation();
            action(() => { session.prepareApply(); });
          }}
          onChange={event => action(() => { if(objectMode&&field!=='weight')session.stageBodyTranslationField(field,event.target.value); else if (curveSelection) session.stageCurvePoleField(field, event.target.value); else session.stageSurfacePoleField(field, event.target.value); })}
          aria-describedby={Object.hasOwn(pending, field) ? `${id}-${field}-accepted` : undefined} />
        {Object.hasOwn(pending, field) && <span id={`${id}-${field}-accepted`} className="cad-editor-accepted">Current: {objectMode?'0':numberText(pole!.accepted[field])}</span>}
      </div>)}
      {(canEdit || Object.keys(pending).length > 0) && <div className="cad-editor-actions">
        <Button type="button" disabled={busy || !canEdit || Object.keys(pending).length === 0} data-testid="cad-editor-apply"
          onClick={() => action(() => { session.prepareApply(); })}>{candidate ? 'Applying…' : 'Apply'}</Button>
        <Button type="button" variant="outline" disabled={busy || Object.keys(pending).length === 0}
          data-testid="cad-editor-discard" onClick={() => action(() => session.discardPending())}>Discard</Button>
      </div>}
    </> : <p role="status" data-testid={snapshot.selectedBodyId === null ? undefined : 'cad-editor-readonly-curve'}>{snapshot.selectedBodyId === null
      ? 'Select a Surface or Curve to inspect its control points.' : interval?.active || knot?.active || curveKnot?.active || isoCurve?.active || region?.active || split?.active || surfaceSplit?.active ? 'Use Done to inspect control points.'
        : selectedKind === 'surface' || selectedKind === 'curve' ? 'Select a point from the current control net.' : 'Control point inspection is unavailable for this object.'}</p>}
    {errorMessage && <p className="cad-editor-error" role="alert">{errorMessage}</p>}
    {!isoCurve?.active && !region?.active && !split?.active && !surfaceSplit?.active && <details className="cad-editor-secondary-analysis cad-editor-source" data-testid="inspector-analysis-disclosure">
      <summary className="cad-editor-source-title" data-testid="inspector-analysis-toggle">Analysis</summary>
      <CadEditorGeometryAnalysis session={session} onAnalysis={onAnalysis} onLength={onLength} onError={onError} />
    </details>}
  </aside>;
}
