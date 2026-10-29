import { useRef, useState, type RefObject } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import { prefixDoc } from '@barocss/cad-model/engine/doc';
import type { directNow } from '@barocss/cad-model/engine/directModule';
import { assertRouteBundleDocument, createRouteBundle, detachRouteBundle, moveRouteBundle, routeBundleDocumentIdentity } from '@barocss/cad-model/engine/routeBundle';
import type { EngineClient } from '../engine/client';
import type { RouteBundleCreateDraft, RouteBundlePanelProps } from '../ui/RouteBundlePanel';
import { routeBindings, routeNumbers, routeMessage, type RouteBundleSession, type RouteTransformGizmo } from '../app/routeSession';
import { withMasses, type MassFields } from '../app/bodyResults';

type RouteReady = NonNullable<RouteBundleSession['ready']>;
type RouteUnderlay = { id: string; lines: Vec3[][]; texts: { at: Vec3; dir: Vec3; up: Vec3; text: string; height: number }[] };
interface RouteEditorOptions {
  owner: { docNow: RefObject<StudioDoc>; blocked: RefObject<{ blocked: boolean }>; commandActive(): boolean };
  worker: { engine: EngineClient; nextRevision(): number };
  acceptValidated(ready: RouteReady): boolean;
  onNotice(notice: FriendlyError): void;
}

/** One frozen route draft, its worker replies, pointer gestures and display-only guides. */
export function useRouteBundleEditor({ owner, worker, acceptValidated, onNotice: setToast }: RouteEditorOptions) {
  const { docNow, blocked: routeContext } = owner;
  const [routePanelOpen, setRoutePanelOpen] = useState(false);
  const [routeCreate, setRouteCreate] = useState<RouteBundleCreateDraft>({ id: 'bundle1', tieId: 'tie1', anchorMM: ['0', '0', '0'], members: [
    { curveObjectId: '', handleKey: '1', sweepFeatureId: '' }, { curveObjectId: '', handleKey: '1', sweepFeatureId: '' },
  ] });
  const [routeMove, setRouteMove] = useState<[string, string, string]>(['0', '0', '0']);
  const [routeSelected, setRouteSelected] = useState<string | null>(null);
  const [routePhase, setRoutePhase] = useState<RouteBundlePanelProps['phase']>('idle');
  const [routeError, setRouteError] = useState<RouteBundlePanelProps['error']>();
  const [routeViewDoc, setRouteViewDoc] = useState<StudioDoc | null>(null);
  const [routeVisualDoc, setRouteVisualDoc] = useState<StudioDoc | null>(null);
  const [routePreviewBodies, setRoutePreviewBodies] = useState<BodyResult[] | null>(null);
  const routeSession = useRef<RouteBundleSession | null>(null), routeToken = useRef(0);
  const routePreviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearRouteTimer = () => { if (routePreviewTimer.current !== null) clearTimeout(routePreviewTimer.current); routePreviewTimer.current = null; };
  const discardRoute = () => {
    clearRouteTimer(); routeToken.current++;
    if (routeSession.current) { routeSession.current.purpose = 'cancelled'; routeSession.current.sequence++; }
    routeSession.current = null;
    setRouteViewDoc(null); setRouteVisualDoc(null); setRoutePreviewBodies(null);
    setRoutePhase('idle'); setRouteError(undefined); setRouteMove(['0', '0', '0']);
  };
  // A bundle session owns a frozen document. Preview and final replies never replace accepted bodies.
  const routeCurrent = (session: RouteBundleSession) => {
    if (routeSession.current !== session || session.token !== routeToken.current || session.purpose === 'cancelled' || routeContext.current.blocked || owner.commandActive()) return false;
    try {
      return docNow.current === session.accepted && routeBundleDocumentIdentity(docNow.current) === session.acceptedIdentity
        && routeBundleDocumentIdentity(session.frozenStart) === session.frozenIdentity && routeBindings(session.frozenStart) === session.bindings;
    } catch { return false; }
  };
  const routeFail = (error: unknown) => {
    clearRouteTimer();
    const session = routeSession.current;
    if (session) { session.sequence++; session.ready = undefined; session.purpose = 'draft'; }
    const friendly = error && typeof error === 'object'
      && 'title' in error && typeof error.title === 'string'
      && 'hint' in error && typeof error.hint === 'string'
      && 'detail' in error && typeof error.detail === 'string'
      && (!('code' in error) || error.code === undefined || typeof error.code === 'string') ? error as FriendlyError : null;
    if (friendly) setToast(friendly);
    setRoutePreviewBodies(null); setRouteVisualDoc(null); setRoutePhase('error'); setRouteError({ message: friendly ? friendly.hint || friendly.title : routeMessage(error) });
  };
  const beginRoute = (frozenStart: StudioDoc, bundleId: string, resetMove = true) => {
    const accepted = docNow.current;
    assertRouteBundleDocument(accepted); assertRouteBundleDocument(frozenStart);
    const session: RouteBundleSession = { token: ++routeToken.current, accepted, acceptedIdentity: routeBundleDocumentIdentity(accepted),
      frozenStart, frozenIdentity: routeBundleDocumentIdentity(frozenStart), bindings: routeBindings(frozenStart), bundleId,
      gesture: 0, pointerId: null, sequence: 0, purpose: 'draft', delta: [0, 0, 0], gestureBase: [0, 0, 0] };
    routeSession.current = session; setRouteViewDoc(frozenStart); setRouteSelected(bundleId);
    if (resetMove) setRouteMove(['0', '0', '0']);
    setRouteVisualDoc(null); setRoutePreviewBodies(null); setRouteError(undefined); setRoutePhase('draft');
    return session;
  };
  const routeEvaluate = async (session: RouteBundleSession, candidate: StudioDoc, final: boolean, withPreview = true) => {
    if (!routeCurrent(session)) { discardRoute(); return; }
    clearRouteTimer();
    const identity = routeBundleDocumentIdentity(candidate), evaluationDoc = prefixDoc(candidate, candidate.nodes.length);
    const evaluatedIdentity = routeBundleDocumentIdentity(evaluationDoc), sequence = ++session.sequence;
    const gesture = session.gesture, pointerId = session.pointerId;
    session.ready = undefined; session.purpose = withPreview ? 'preview' : 'final'; setRoutePhase(withPreview ? 'preview' : 'validating'); setRouteError(undefined); setRoutePreviewBodies(null); setRouteVisualDoc(candidate);
    const current = (purpose: RouteBundleSession['purpose']) => routeCurrent(session) && session.sequence === sequence && session.gesture === gesture
      && session.pointerId === pointerId && session.purpose === purpose && routeBundleDocumentIdentity(candidate) === identity;
    try {
      if (withPreview) {
        const previewRevision = worker.nextRevision(), preview = await worker.engine.preview(evaluationDoc, previewRevision);
        if (!current('preview')) return;
        if (preview.revision !== previewRevision) throw new Error('The preview was interrupted. Preview this draft again.');
        if (!preview.ok) { routeFail(preview.error); return; }
        setRoutePreviewBodies(preview.bodies);
        if (!final) { session.purpose = 'draft'; setRoutePhase('draft'); return; }
      }
      session.purpose = 'final'; setRoutePhase('validating');
      const finalRevision = worker.nextRevision(), result = await worker.engine.evaluate(evaluationDoc, finalRevision);
      if (!current('final')) return;
      if (!result || result.revision !== finalRevision) throw new Error('The final check was interrupted. Preview this draft again.');
      if (!result.ok) { routeFail(result.error); return; }
      session.ready = { candidate, identity, evaluatedIdentity, result, sequence, gesture, pointerId }; session.purpose = 'ready';
      setRoutePreviewBodies(result.bodies); setRoutePhase('ready');
    } catch (error) { if (current(session.purpose)) routeFail(error); }
  };
  const selectRouteBundle = (id: string) => {
    discardRoute(); setRouteSelected(id);
    if (routeContext.current.blocked) return;
    try {
      if (!docNow.current.routeBundles?.some(b => b.id === id)) throw new Error('Select a current route bundle.');
      beginRoute(JSON.parse(JSON.stringify(docNow.current)) as StudioDoc, id);
    } catch (error) { routeFail(error); }
  };
  const open = (directSel: readonly string[]) => {
    setRoutePanelOpen(true);
    const id = docNow.current.routeBundles?.[0]?.id;
    if (id) { selectRouteBundle(id); return; }
    setRouteSelected(null);
    setRouteCreate({ id: 'bundle1', tieId: 'tie1', anchorMM: ['0', '0', '0'], members: [0, 1].map(i => ({
      curveObjectId: directSel[i] ?? '', handleKey: '1', sweepFeatureId: '',
    })) as RouteBundleCreateDraft['members'] });
  };
  const createRoute = () => {
    if (routeContext.current.blocked) return;
    try {
      const accepted = docNow.current;
      const members = routeCreate.members.map((member, index) => {
        const sweep = accepted.nodes.find(n => n.id === member.sweepFeatureId);
        if (!sweep || sweep.kind !== 'sweep-curve') throw new Error(`Member ${index + 1}: select a current copied sweep.`);
        const profile = accepted.nodes[sweep.sketch];
        if (!profile?.id) throw new Error(`Member ${index + 1}: the copied sweep needs a current profile. Reselect the curve and copied sweep.`);
        return { ...member, id: `member${index + 1}`, profileFeatureId: profile.id };
      }) as Parameters<typeof createRouteBundle>[1]['members'];
      const candidate = createRouteBundle(accepted, { id: routeCreate.id, tieId: routeCreate.tieId, anchorMM: routeNumbers(routeCreate.anchorMM), members,
        expectedDocumentIdentity: routeBundleDocumentIdentity(accepted) });
      const session = beginRoute(candidate, routeCreate.id);
      void routeEvaluate(session, candidate, false);
    } catch (error) { routeFail(error); }
  };
  const previewRoute = () => {
    if (routeContext.current.blocked || routePhase === 'validating') return;
    try {
      let session = routeSession.current;
      if (!session && routeSelected) session = beginRoute(JSON.parse(JSON.stringify(docNow.current)) as StudioDoc, routeSelected, false);
      if (!session || !routeCurrent(session)) throw new Error('Select the current bundle again. The document changed.');
      const delta = routeNumbers(routeMove);
      const candidate = moveRouteBundle(session.frozenStart, session.bundleId, delta, session.frozenIdentity);
      session.delta = delta; session.pointerId = null; session.gesture++;
      void routeEvaluate(session, candidate, true);
    } catch (error) { routeFail(error); }
  };
  const changeRouteMove = (next: [string, string, string]) => {
    clearRouteTimer();
    const session = routeSession.current;
    if (session) { session.sequence++; session.purpose = 'draft'; session.ready = undefined; session.pointerId = null; session.delta = [0, 0, 0]; }
    setRouteMove(next); setRoutePhase('draft'); setRouteError(undefined); setRouteVisualDoc(null); setRoutePreviewBodies(null);
  };
  const applyRoute = () => {
    const session = routeSession.current, ready = session?.ready;
    if (!session || !ready || !routeCurrent(session) || session.purpose !== 'ready' || ready.sequence !== session.sequence
      || ready.gesture !== session.gesture || ready.pointerId !== session.pointerId) { routeFail(new Error('Preview the current draft before applying it.')); return; }
    try {
      assertRouteBundleDocument(ready.candidate);
      if (routeBundleDocumentIdentity(ready.candidate) !== ready.identity) throw new Error('The draft changed. Preview it again.');
      const candidate = ready.candidate, id = session.bundleId;
      if (!acceptValidated(ready)) return;
      setRouteSelected(candidate.routeBundles?.some(b => b.id === id) ? id : null);
    } catch (error) { routeFail(error); }
  };
  const detachRoute = () => {
    if (routeContext.current.blocked) return;
    try {
      const id = routeSelected;
      if (!id || !docNow.current.routeBundles?.some(b => b.id === id)) { discardRoute(); return; }
      const session = beginRoute(JSON.parse(JSON.stringify(docNow.current)) as StudioDoc, id);
      const candidate = detachRouteBundle(session.frozenStart, id, session.frozenIdentity);
      void routeEvaluate(session, candidate, true);
    } catch (error) { routeFail(error); }
  };
  const cancelIfChanged = (doc: StudioDoc) => { if (routeSession.current && routeSession.current.accepted !== doc) discardRoute(); };
  const dispose = () => { clearRouteTimer(); routeToken.current++; if (routeSession.current) routeSession.current.purpose = 'cancelled'; };

  const makeGizmo = (): RouteTransformGizmo | null => {
  const routeSessionShown = routeSession.current;
  const routeTie = routeSessionShown?.frozenStart.routeBundles?.find(b => b.id === routeSessionShown.bundleId)?.tie;
  return routePanelOpen && routeSessionShown && routeTie && routePhase !== 'error' && !routeContext.current.blocked && routeCurrent(routeSessionShown) ? {
    // Stable for the whole edit; a gesture has a different token and never changes this key.
    sessionKey: `route-bundle:${routeSessionShown.token}:${routeSessionShown.bundleId}`,
    origin: routeTie.anchorMM.map((v, k) => v + routeSessionShown.delta[k]) as Vec3, move: [0, 1, 2],
    onStart: pointerId => {
      const session = routeSession.current;
      if (!session || session !== routeSessionShown || !routeCurrent(session)) return;
      clearRouteTimer(); session.sequence++; session.gesture++; session.pointerId = pointerId;
      session.gestureBase = [...session.delta]; session.ready = undefined; session.purpose = 'draft';
      setRouteMove(session.delta.map(String) as [string, string, string]);
      setRoutePhase('draft'); setRouteError(undefined); setRoutePreviewBodies(null);
    },
    onMove: (delta, done, pointerId) => {
      const session = routeSession.current;
      if (!session || session !== routeSessionShown || pointerId === undefined || session.pointerId !== pointerId || !routeCurrent(session)) return;
      clearRouteTimer(); session.sequence++; session.ready = undefined; session.purpose = 'draft';
      try {
        // The viewport supplies total displacement from this gesture's captured origin.
        const total = session.gestureBase.map((v, k) => v + delta[k]) as Vec3;
        const candidate = moveRouteBundle(session.frozenStart, session.bundleId, total, session.frozenIdentity);
        session.delta = total; setRouteMove(total.map(String) as [string, string, string]);
        setRouteVisualDoc(candidate); setRoutePreviewBodies(null); setRoutePhase('draft'); setRouteError(undefined);
        if (done) { void routeEvaluate(session, candidate, true, false); return; }
        const sequence = session.sequence, gesture = session.gesture;
        routePreviewTimer.current = setTimeout(() => {
          routePreviewTimer.current = null;
          if (routeCurrent(session) && session.sequence === sequence && session.gesture === gesture && session.pointerId === pointerId) void routeEvaluate(session, candidate, false);
        }, 100);
      } catch (error) { routeFail(error); }
    },
    onCancel: (pointerId, _reason) => {
      const session = routeSession.current;
      if (session && session === routeSessionShown && session.pointerId === pointerId) discardRoute();
    },
  } : null;

  };
  // Display-only draft guides reuse the existing non-pickable world-mm underlay channel.
  const makeGuides = (D: ReturnType<typeof directNow>, underlaysShown: RouteUnderlay[]): RouteUnderlay[] => {
    const session = routeSession.current;
    if (!routePanelOpen || !session || !D || routePhase === 'error' || !routeCurrent(session)) return [];
    try {
      const candidate = routeVisualDoc ?? session.frozenStart;
      assertRouteBundleDocument(candidate);
      const bundle = candidate.routeBundles?.find(b => b.id === session.bundleId);
      if (!bundle || !candidate.direct) return [];
      const points = bundle.members.map(member => {
        const pole = D.polesOf(candidate.direct!, member.curveObjectId).find(p => p.key === member.handleKey);
        if (!pole || pole.at.some(v => !Number.isFinite(v))) throw new Error('The current member point is unavailable.');
        return { member, at: pole.at };
      });
      const tie = bundle.tie.anchorMM;
      const span = Math.max(...points.map(p => Math.hypot(...p.at.map((v, k) => v - tie[k]))));
      const height = Math.max(0.5, span * 0.05), radius = height * 0.25;
      const guides: RouteUnderlay[] = [];
      const key = (kind: 'point' | 'line' | 'label', owner: 'member' | 'tie', id: string) => {
        let value = JSON.stringify(['route-bundle-draft', session.token, bundle.id, kind, owner, id]);
        while (underlaysShown.some(u => u.id === value)) value = '_' + value;
        return value;
      };
      const text = (at: Vec3, value: string) => ({ at, dir: [1, 0, 0] as Vec3, up: [0, 1, 0] as Vec3, text: value, height });
      for (const { member, at } of points) {
        const cross = [0, 1, 2].map(axis => [
          at.map((v, k) => v - (k === axis ? radius : 0)) as Vec3,
          at.map((v, k) => v + (k === axis ? radius : 0)) as Vec3,
        ]);
        const letter = member.id === bundle.members[0].id ? 'A' : 'B';
        guides.push({ id: key('line', 'member', member.id), lines: [[tie, at]], texts: [] },
          { id: key('point', 'member', member.id), lines: cross, texts: [] },
          { id: key('label', 'member', member.id), lines: [], texts: [text([at[0] + (letter === 'A' ? -height : height * 0.4), at[1] + height * 0.4, at[2]], letter)] });
      }
      const diamond: Vec3[] = [[tie[0], tie[1] + radius, tie[2]], [tie[0] + radius, tie[1], tie[2]],
        [tie[0], tie[1] - radius, tie[2]], [tie[0] - radius, tie[1], tie[2]], [tie[0], tie[1] + radius, tie[2]]];
      guides.push({ id: key('point', 'tie', bundle.tie.id), lines: [diamond], texts: [] },
        { id: key('label', 'tie', bundle.tie.id), lines: [], texts: [text([tie[0] + height * 0.4, tie[1] + height * 0.8, tie[2]], 'Tie')] });
      return guides;
    } catch { return []; } // No guessed coordinates or source repair when a binding is unavailable.
  };
  const patchMasses = (got: ReadonlyMap<number, MassFields>) => {
    const ready = routeSession.current?.ready;
    if (ready) ready.result.bodies = withMasses(ready.result.bodies, got);
    setRoutePreviewBodies(bs => bs && withMasses(bs, got));
  };
  const discardBlocked = () => { if (routeContext.current.blocked && routeSession.current) discardRoute(); };
  return { routePanelOpen, setRoutePanelOpen, routeCreate, setRouteCreate, routeMove, routeSelected, routePhase, setRoutePhase, routeError, routeViewDoc, routeVisualDoc, routePreviewBodies,
    discardRoute, open, selectRouteBundle, createRoute, previewRoute, changeRouteMove, applyRoute, detachRoute, makeGizmo, makeGuides, patchMasses, discardBlocked, cancelIfChanged, dispose };
}
