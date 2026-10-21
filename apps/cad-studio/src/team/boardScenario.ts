// A7.5 (O94): a candidate board's scenario — a seed (the part's ops), then steps on the board, each giving one outcome —
// run in this process (the studio's tool path) or by `cad-cli board scenario.json` (a fresh process, its replay a
// fresh reader too). The same scenario gives the same outcomes either way; its conformance case holds #2181's nine
// steps (conformance/a7/candidates/).
import { emptyDoc } from '@barocss/cad-model/engine/doc';
import { dispatchTool, type ChatState, type Evaluate } from '@barocss/cad-model/chat/tools';
import type { Op } from '@barocss/cad-model/chat/proposals';
import { freshnessOf, massResult, type Result } from '@barocss/cad-model/team/freshness';
import { CandidateBoard, type CandidateRequest, type Outcome, type Reopen } from './candidates';

export type BoardStep =
  | { do: 'start'; op: string; candidate: string; ops: Op[]; units?: string; dependsOn?: string[]; budget?: CandidateRequest['budget']; deadline?: number }
  | { do: 'run' | 'cancel' | 'accept'; op: string; candidate: string }
  | { do: 'undo' | 'redo'; op: string }
  /** A run whose cancel (`cancelOp`) comes while it builds: its result arrives after the cancel. */
  | { do: 'run_cancelled'; op: string; cancelOp: string; candidate: string }
  | { do: 'tick'; n: number }
  /** The accepted part saved and opened again fresh: the board goes on from the file. */
  | { do: 'save_open' }
  /** The saved file cut short, then opened: refused (CORRUPT_FILE), the board as it was. */
  | { do: 'open_corrupt' }
  /** A mass result stamped on the accepted part, by name; `fresh` reads it against the part as it is now. */
  | { do: 'stamp'; as: string }
  | { do: 'fresh'; of: string };
export interface BoardScenario { case: string; step: string; note: string; seed: Op[]; steps: BoardStep[]; expect: StepExpect[] }
/** What a step gave, as the scenario compares it: ok, its code, the accepted part's volume, a built candidate's, a result's freshness. */
export interface StepExpect { ok: boolean; code?: string; volume?: number | null; candidate_volume?: number; fresh?: string; duplicate?: true }

const summary = (o: Outcome): StepExpect => ({ ok: o.ok, ...(o.code ? { code: o.code } : {}), volume: o.volume_mm3, ...(o.op === 'run' && o.evidence ? { candidate_volume: o.evidence.facts.volume_mm3 } : {}), ...(o.duplicate ? { duplicate: true as const } : {}) });

/** The scenario run on a board: each step's outcome, the board's full trace. */
export async function runBoardScenario(sc: BoardScenario, evaluate: Evaluate, reopen?: Reopen): Promise<{ steps: StepExpect[]; outcomes: Outcome[] }> {
  let state = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  const seeded = await dispatchTool(state, 'apply_ops', { ops: sc.seed }, evaluate);
  if (seeded.isError) throw new Error(`the scenario's seed is refused: ${seeded.content}`);
  state = seeded.state;
  let board = new CandidateBoard(state, evaluate, reopen);
  const steps: StepExpect[] = [], stamped = new Map<string, Result>(), all: Outcome[] = [];
  for (const s of sc.steps) {
    if (s.do === 'tick') { board.tick(s.n); steps.push({ ok: true, volume: vol(board) }); continue; }
    if (s.do === 'save_open' || s.do === 'open_corrupt') {
      const bytes = board.save(), opened = await CandidateBoard.open(s.do === 'save_open' ? bytes : bytes.subarray(0, Math.floor(bytes.length / 2)), evaluate, reopen);
      if ('code' in opened) { steps.push({ ok: false, code: opened.code, volume: vol(board) }); continue; }
      all.push(...board.outcomes); board = opened; steps.push({ ok: true, volume: vol(board) }); continue;
    }
    if (s.do === 'stamp') { stamped.set(s.as, await massResult(board.state.doc, evaluate, s.as)); steps.push({ ok: true, volume: vol(board) }); continue; }
    if (s.do === 'fresh') { const f = await freshnessOf(stamped.get(s.of)!, board.state.doc, evaluate); steps.push({ ok: true, volume: vol(board), fresh: f.state }); continue; }
    if (s.do === 'run_cancelled') {
      const running = board.run(s.op, s.candidate); const cancelled = board.cancel(s.cancelOp, s.candidate);
      steps.push({ ...summary(await running), ...(cancelled.ok ? {} : { code: cancelled.code }) }); continue;
    }
    const o = s.do === 'start' ? board.start({ operationId: s.op, candidate: s.candidate, patch: { ops: s.ops, ...(s.units ? { units: s.units } : {}), ...(s.dependsOn ? { dependsOn: s.dependsOn } : {}) }, ...(s.budget ? { budget: s.budget } : {}), ...(s.deadline !== undefined ? { deadline: s.deadline } : {}) })
      : s.do === 'run' ? await board.run(s.op, s.candidate) : s.do === 'cancel' ? board.cancel(s.op, s.candidate) : s.do === 'accept' ? await board.accept(s.op, s.candidate)
        : s.do === 'undo' ? board.undo(s.op) : board.redo(s.op);
    steps.push(summary(o));
  }
  return { steps, outcomes: [...all, ...board.outcomes] };
}
const vol = (b: CandidateBoard) => b.volume();
