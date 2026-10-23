// The drawing's sheet pipeline (moved out of DrawingWorkspace for G24, no behaviour change): the scope and its document,
// the bodies read, the views projected (with the sections cut), the layout, the callouts, fits, threads, BOM, sourced
// tables and weld joints, and the sheet built from them — and, when asked, the sheet's annotations lifted onto the
// model (model-annotations-v1). `active` false: nothing is asked of the engine and nothing is built.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { drawingDocument, drawingSource, drawingScopeOf, drawsMadeOnly, type DrawingScope } from '@barocss/cad-model/drawing/scope';
import { canonicalOf } from '@barocss/cad-model/util/revision';
import { followedStale, staleText } from '@barocss/cad-model/frames/skeleton';
import { elementsOfBodies, withElements } from '@barocss/cad-model/drawing/elementCallouts';
import { fitMiss, withFit } from '@barocss/cad-model/drawing/fits';
import { weldList } from '@barocss/cad-model/frames/welds';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { tableContent } from '@barocss/cad-model/drawing/tables';
import { modelAnnotations, type ModelAnnotations } from '@barocss/cad-model/drawing/annotations3d';
import { bomPanelData } from '@barocss/cad-model/bom/bom';
import type { Bom } from '@barocss/cad-model/bom/core';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { buildSheet, sectionExtents, sheetSections } from '@barocss/cad-model/drawing/sheet';
import { bodyFacesOf } from '@barocss/cad-model/drawing/balloons';
import { holeCallout } from '@barocss/cad-model/drawing/callout';
import { threadsOf } from '@barocss/cad-model/app/threads';
import { fastenerSizesOf } from '@barocss/cad-model/engine/fastenerSizeRows';
import { revisionOf } from '@barocss/cad-model/util/revision';
import { layoutSheet } from '@barocss/cad-model/drawing/views';
import { sameSection, sectionsOf, type DrawingSettings, type DrawingTable, type DrawingViews } from '@barocss/cad-model/drawing/types';
import type { SectionCut } from '@barocss/cad-model/drawing/section';
import type { EngineClient } from '../engine/client';

export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function useDrawingSheet(active: boolean, { engine, doc: sourceDoc, bodies: sourceBodies, settings, fileName, annotations: wantAnnotations = false }: {
  engine: EngineClient; doc: StudioDoc; bodies?: readonly BodyResult[]; settings: DrawingSettings; fileName: string; annotations?: boolean;
}) {
  const scopeRead = (() => {
    try { return { scope: drawingScopeOf(settings), error: null }; }
    catch (cause) { return { scope: null, error: cause instanceof Error ? cause.message : String(cause) }; }
  })();
  // This placeholder is only for disabled controls; an invalid persisted scope never reaches the engine.
  const scope: DrawingScope = scopeRead.scope ?? { kind: 'part' };
  // (Inactive, the document is not canonicalised on every render: nothing is built from it then.)
  const scopeKey = JSON.stringify([scopeRead.scope, scopeRead.error]), sourceKey = active ? canonicalOf(sourceDoc) : '';
  const scoped = useMemo(() => {
    try { return { doc: drawingDocument(sourceDoc, settings), authored: drawingSource(sourceDoc, settings), error: null }; }
    catch (cause) { return { doc: { ...sourceDoc, nodes: [], instances: [] } as StudioDoc, authored: null, error: cause instanceof Error ? cause.message : String(cause) }; }
  }, [sourceKey, scopeKey]);
  const doc = scoped.doc, model = doc;
  const currentModel = useRef(model); currentModel.current = model;
  const [bodyRead, setBodyRead] = useState<{ doc: StudioDoc; bodies: readonly BodyResult[] } | null>(null);
  const bodyRevision = useRef(1);
  const bodies = scope.kind === 'assembly' ? sourceBodies : bodyRead && bodyRead.doc === doc ? bodyRead.bodies : undefined;
  useEffect(() => {
    if (!active || scope.kind !== 'part' || scoped.error) return;
    let live = true;
    engine.part(doc, bodyRevision.current++, 'read').then(r => { if (live) setBodyRead(r.ok ? { doc, bodies: r.bodies } : null); }, () => { if (live) setBodyRead(null); });
    return () => { live = false; };
  }, [active, engine, doc, scoped.error, scope.kind]);
  // The views as projected, with the front side they were projected for (R14.3b): only those of the drawing's side are used.
  const [projected, setProjected] = useState<{ views: DrawingViews; side: string; model: StudioDoc } | null>(null);
  const views = projected && projected.model === model && projected.side === (settings.orientation ?? 'y-') ? projected.views : null;
  /** The sections as last cut (O148 X1; each with why it could not be cut). */
  const [rawCutsMade, setCutsMade] = useState<SectionCut[] | null>(null);
  const cutsMade = projected?.model === model ? rawCutsMade : null;
  const sectionList = sectionsOf(settings), sectionKey = JSON.stringify(sectionList), madeOnly = drawsMadeOnly(settings);
  const [error, setError] = useState<string | null>(null);
  /** The part has no body yet: the panel says so, and nothing is raised as an error. */
  const [empty, setEmpty] = useState(false);
  const [busy, setBusy] = useState(true);
  // Project the part (and its shown instances) whenever they change; of the drawing settings only tangent edges change the views.
  useEffect(() => {
    if (!active) return;
    if (scoped.error) { setBusy(false); setEmpty(false); setError(scoped.error); setProjected(null); setCutsMade(null); return; }
    let live = true; setBusy(true);
    const side = settings.orientation ?? 'y-';
    // (O174: a part's drawing documents what the part makes — its bought elements left out of the views and sections.)
    engine.drawing(model, { tangentEdges: !!settings.tangent, ...(sectionList.length ? { sections: sectionList } : {}), ...(settings.orientation ? { orientation: settings.orientation } : {}), made: madeOnly }).then(r => {
      if (!live) return;
      setBusy(false);
      setEmpty(!r.ok && !!r.empty);
      if (r.ok) { setProjected({ views: r.views, side, model }); setCutsMade(r.sections ?? null); setError(null); } else { setProjected(null); setCutsMade(null); setError(r.error); }
    });
    return () => { live = false; };
  }, [active, engine, model, scoped.error, settings.tangent, sectionKey, settings.orientation, madeOnly]);

  const title = settings.title ?? fileName;
  // (The sections the settings list, as cut for them: one whose letter, view or place changed is cut again first.)
  const cuts = useMemo(() => sheetSections((projected?.model === model ? cutsMade ?? [] : []).filter(c => sectionList.some(x => sameSection(x, c)))), [cutsMade, sectionKey, projected, model]);
  const sectionA = sectionList.find(x => x.id === 'A' && x.view === 'front'), cutA = cutsMade?.find(c => c.id === 'A' && c.view === 'front');
  const layout = useMemo(() => views && layoutSheet(views, settings, sectionExtents(settings, cuts)), [views, settings, cuts]);
  // Diameter dimensions on a hole read as its callout (count, size or thread, depth, counterbore or countersink).
  // (D155: a diameter on a face with a fit class shows the class and its limits; a class with no row, an issue.)
  // (O145: and the machine elements' callouts — a bearing's seat, a ring's groove.)
  const elements = useMemo(() => elementsOfBodies(doc.nodes, bodies ?? []), [doc.nodes, bodies]);
  const callout = useMemo(() => withElements(doc, withFit(doc, (edge: string) => holeCallout(doc.nodes, edge)), elements), [doc.nodes, doc.fits, elements]);
  const fitMissOf = useMemo(() => fitMiss(doc), [doc.fits]);
  // (FRf2, O125: frames following a placed part's sketch that changed since linked.)
  const followedChanged = useMemo(() => scoped.authored ? followedStale(scoped.authored).map(staleText) : [], [scoped.authored]);
  const threads = useMemo(() => threadsOf(doc.nodes, fastenerSizesOf(doc)), [doc.nodes, doc.fastenerSizes]);
  // (O9: the source revision the sheet is drawn from, in its title block.)
  const source = useMemo(() => revisionOf(doc), [doc]);
  // (O147 B2: the BOM, when the BOM table or the balloons read it — every document evaluated in the engine worker.)
  const wantsBom = !!settings.balloons || !!settings.tables?.some(x => x.from === 'bom');
  const [bomRead, setBomRead] = useState<{ doc: StudioDoc; bom: Bom } | null>(null);
  const bom = bomRead && bomRead.doc === doc ? bomRead.bom : null;
  const bomRevision = useRef(1);
  useEffect(() => {
    if (!active || !wantsBom || scoped.error) { setBomRead(null); return; }
    let live = true;
    const t = setTimeout(() => { bomPanelData(doc, d => engine.part(d, bomRevision.current++, 'read'), title).then(d => { if (live) setBomRead({ doc, bom: d.bom }); }, () => { if (live) setBomRead(null); }); }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [active, wantsBom, doc, title, scoped.error]);
  // (Each sourced table's content once a document (O49): the bend table from the bodies' flat patterns.)
  const sourced = useMemo(() => new Map((settings.tables ?? []).filter(x => x.from).map(x => [x.id, tableContent(x, { doc, ...(bodies ? { bodies } : {}), ...(bom ? { bom } : {}) })])), [settings.tables, doc, bodies, bom]);
  const tableContentOf = useCallback((x: DrawingTable) => sourced.get(x.id) ?? { error: 'its source was not run for this sheet' }, [sourced]);
  const hasSheet = (bodies ?? []).some(b => b.flat && b.flat.bends.length);
  const hasFrame = (bodies ?? []).some(b => b.cutPiece);
  // (O144: machine elements' tables, offered when the part has such an element.)
  const kinds = new Set((bodies ?? []).flatMap(b => b.element ? [b.element.kind] : [])), hasBought = (bodies ?? []).some(b => b.ref && doc.nodes[b.ref.node]?.bought === true);
  // (FRd2, O119: the frame's weld joints for the symbols, when they are shown.)
  const weldJoints = useMemo(() => settings.weldSymbols && bodies ? weldList(doc, bodies).joints : undefined, [settings.weldSymbols, doc, bodies]);
  // (O177: the base part's bodies' face names, for the balloons of its own BOM lines — members, made bodies.)
  const bodyFaces = useMemo(() => settings.balloons && bodies ? bodyFacesOf(bodies) : undefined, [settings.balloons, bodies]);
  const sheet = useMemo(() => views && layout && buildSheet(views, layout, settings, { title, date: today(), source, callout, threads, tableContent: tableContentOf, welds: weldJoints, bodyFaces, ...(bom ? { bom } : {}) }, cuts), [views, layout, settings, title, cuts, callout, threads, tableContentOf, weldJoints, bodyFaces, bom]);
  const annotations = useMemo<ModelAnnotations | null>(() => active && wantAnnotations && sheet && layout && views ? modelAnnotations({ views, layout, settings, sheet, ...(weldJoints ? { welds: weldJoints } : {}) }) : null,
    [active, wantAnnotations, sheet, layout, views, settings, weldJoints]);
  return { source, scopeRead, scope, scopeKey, scoped, doc, model, currentModel, bodies, projected, views, cutsMade, sectionList, sectionKey, error, empty, busy, title, cuts, sectionA, cutA, layout, elements, callout, fitMissOf, followedChanged, threads, wantsBom, bom, sourced, tableContentOf, hasSheet, hasFrame, kinds, hasBought, weldJoints, bodyFaces, sheet, annotations };
}
