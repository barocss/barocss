import { useMemo, useState, type Dispatch, type SetStateAction, type RefObject } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import type { Proposal } from '@barocss/cad-model/engine/schema/proposals';
import type { ProposalPart } from '@barocss/cad-model/chat/tools';
import type { PersonRowFiles } from '@barocss/cad-model/engine/rowFiles';
import { rejectProposal } from '@barocss/cad-model/chat/proposals';
import { modelHash } from '@barocss/cad-model/chat/spec';
import type { EngineClient, ProposalOverlay } from '../engine/client';
import type { Lanes } from '../engine/lanes';
interface ProposalPreviewOptions {
  model: { doc: StudioDoc; bodies: BodyResult[]; marker: number | null; active: boolean; sketch: boolean };
  worker: { engine: EngineClient; lanes: Lanes; nextRevision(): number };
  changes: { commit(next: StudioDoc, capture: false): boolean; setPreviewBodies: Dispatch<SetStateAction<BodyResult[] | null>> };
  chatRowFiles: RefObject<PersonRowFiles | undefined>;
  onNotice(notice: FriendlyError): void;
}
/** Proposal previews and acceptance use the existing tool path and App's central commit. */
export function useProposalPreview({ model, worker, changes, chatRowFiles, onNotice: setToast }: ProposalPreviewOptions) {
  const { doc, bodies, marker, active, sketch } = model;
  const { engine, lanes, nextRevision } = worker;
  const { commit, setPreviewBodies } = changes;
  // Proposals (A4.2): one shown as a ghost — the part it would leave, its changed bodies tinted — with a
  // before/after toggle and the volume it adds or takes off; accepted (its ops replayed) or rejected (kept).
  // (`full`: the part the whole proposal leaves; `parts`: its features, `leaveOut` those unticked, A4.3.)
  // (`shown`: the part as previewed — the whole proposal's, or without what is left out; G12 diffs it with the part.)
  const [ghost, setGhost] = useState<{ id: string; bodies: BodyResult[]; after: boolean; full: StudioDoc; shown: StudioDoc; parts: ProposalPart[]; leaveOut: string[] } | null>(null);
  /** G12: what the shown proposal adds and takes away (worked out in the engine worker), for the viewport's overlay. */
  const [proposalOverlay, setProposalOverlay] = useState<ProposalOverlay | null>(null);
  const [proposalBusy, setProposalBusy] = useState(false);
  const partEval = (d: StudioDoc) => engine.part(d, nextRevision(), 'agent');
  const resetForModelChange = () => { setGhost(g => { if (g) setPreviewBodies(null); return null; }); };
  // (Only wanted to show an open proposal stale.)
  const hashNow = useMemo(() => doc.proposals?.some(p => p.status === 'open') ? modelHash(doc) : '', [doc]);
  const showProposal = async (p: Proposal, from: StudioDoc = doc) => {
    if (ghost?.id === p.id && from === doc) { setGhost(null); setPreviewBodies(null); return; }
    if (active || sketch || marker !== null) return;
    setProposalBusy(true);
    const tools = await import('@barocss/cad-model/chat/tools'), r = await tools.previewProposal({ doc: from, bodies, rowFiles: chatRowFiles.current }, p.id, partEval);
    setProposalBusy(false);
    if ('error' in r) { setToast({ title: `${p.id} does not apply to the part as it is`, hint: r.error, detail: '' }); return; }
    setGhost({ id: p.id, bodies: r.bodies, after: true, full: r.doc, shown: r.doc, parts: tools.proposalParts(from, r.doc), leaveOut: [] }); setPreviewBodies(r.bodies);
  };
  /** A stale proposal made again on the part as it is, then shown (D41): only the rebased one can be accepted. */
  const rebaseIt = async (p: Proposal) => {
    if (active || sketch || marker !== null) return;
    setProposalBusy(true);
    const r = await (await import('@barocss/cad-model/chat/tools')).rebaseProposal({ doc, bodies, rowFiles: chatRowFiles.current }, p.id, partEval);
    setProposalBusy(false);
    if ('error' in r) { setToast({ title: `${p.id} could not be rebased`, hint: r.error, detail: 'Nothing changed; the proposal stays open.' }); return; }
    if (!commit(r.state.doc, false)) return;
    await showProposal(r.state.doc.proposals!.find(q => q.id === p.id)!, r.state.doc);
  };
  /** A feature of the shown proposal ticked or unticked: the ghost rebuilt without what is left out. */
  const tickPart = async (id: string, on: boolean) => {
    if (!ghost) return;
    const tools = await import('@barocss/cad-model/chat/tools'), leaveOut = tools.toggledLeaveOut(ghost.parts, ghost.leaveOut, id, on);
    const partial = tools.partialDoc(doc, ghost.full, ghost.parts, leaveOut);
    if ('error' in partial) { setToast({ title: 'Cannot leave that out', hint: partial.error, detail: '' }); return; }
    setProposalBusy(true);
    const r = await partEval(partial.doc);
    setProposalBusy(false);
    if (!r.ok) { setToast({ title: `Without ${leaveOut.join(', ')} the part does not build`, hint: `${r.error.title}. ${r.error.hint}`, detail: '' }); return; }
    setGhost(g => g && { ...g, leaveOut, bodies: r.bodies, shown: partial.doc, after: true }); setPreviewBodies(r.bodies);
  };
  // (G12: the diff of the part as it is and the proposal as shown, again when what is shown changes; none without one.)
  const updateDiff = () => {
    if (!ghost) { setProposalOverlay(null); return; }
    // (R4b: on the O9 'proposal-diff' lane — a reply for a proposal no longer shown comes back stale.)
    const at = nextRevision(), key = `${ghost.id}|${ghost.leaveOut.join(',')}`;
    void lanes.run('proposal-diff', { revision: at, source: key }, () => engine.proposalDiff(doc, ghost.shown, at, { revision: modelHash(doc), proposal: key })).then(reply => { if (!reply.stale) setProposalOverlay('error' in reply.result ? null : reply.result); });
    return () => lanes.cancel('proposal-diff');
  };
  const flipGhost = () => setGhost(g => { if (!g) return g; setPreviewBodies(g.after ? null : g.bodies); return { ...g, after: !g.after }; });
  const acceptIt = async (p: Proposal) => {
    if (active || sketch) return;
    if (marker !== null) { setToast({ title: 'Roll forward to accept', hint: 'A proposal applies to the whole part: drag the rollback bar to the end first.', detail: '' }); return; }
    setProposalBusy(true);
    const leaveOut = ghost?.id === p.id ? ghost.leaveOut : [];
    const r = await (await import('@barocss/cad-model/chat/tools')).acceptProposal({ doc, bodies, rowFiles: chatRowFiles.current }, p.id, partEval, { leaveOut });
    setProposalBusy(false);
    if ('error' in r) { setToast({ title: `${p.id} could not be applied`, hint: r.error, detail: 'Nothing changed; the proposal stays open.' }); return; }
    if (!commit(r.state.doc, false)) return;
    setGhost(null); setPreviewBodies(null);
  };
  const rejectIt = (p: Proposal) => { const next = rejectProposal(doc, p.id); if ('error' in next || !commit(next, false)) return; if (ghost?.id === p.id) { setGhost(null); setPreviewBodies(null); } };
  return { ghost, proposalOverlay, proposalBusy, hashNow, partEval, resetForModelChange, updateDiff, showProposal, rebaseIt, tickPart, flipGhost, acceptIt, rejectIt };
}
