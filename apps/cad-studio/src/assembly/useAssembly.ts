// The studio's mate workflow: reads the parts' faces, re-solves the assembly whenever an instance, a mate
// or a part changes, and runs "Add mate" (two face picks) and mate edits, refusing what cannot be met.
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { PartInstance, StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { validateBallOptions, validateFastenedOptions, validateUniversalOptions, validateCylindricalOptions } from '@barocss/cad-model/assembly/connectors';
import { FaceClient } from './faceClient';
import { flattenAssembly } from '@barocss/cad-model/engine/flatten';
import { BASE, mateKindsOf, lockRel, mateRefusal, solveAssembly, type FaceTable, type Freedom, type Mate, type MateKind, type MateRef, type Problem } from '@barocss/cad-model/assembly/mates';

/** A face clicked while adding a mate: on the base part (a body and face to highlight) or on an instance. */
export interface MatePick { ref: MateRef; body?: number; face?: number }
export interface MateDraft { kind: MateKind | 'auto'; distance: number; angle: number; flip: boolean; picks: MatePick[]; error?: string }
const EMPTY_TABLES = new Map<string, FaceTable>();
const EMPTY_PROBLEMS: Problem[] = [];
const EMPTY_FREEDOM: Record<string, Freedom> = {};
const FACES_PENDING = 'The current parts’ faces are unavailable. Wait for their evaluation or fix the current part error.';
type Hit = { face: { body: number; face: number } | null; instance?: string; instanceFace?: { body: number; face: number } };

export interface Assembly {
  mates: Mate[]; problems: Problem[]; tables: Map<string, FaceTable>;
  /** What each mated instance can still do (see Solved.freedom). */
  freedom: Record<string, Freedom>;
  draft: MateDraft | null; selected: string | null;
  start(): void; cancel(): void; setDraft(patch: Partial<MateDraft>): void; select(id: string | null): void;
  /** A viewport click while adding a mate (true: it was taken). */
  pick(hit: Hit): boolean;
  /** Locks a part to another (or the base part) where it stands now; the reason when it cannot be. */
  lock(part: string, to: string): string | null;
  /** Picks a face by name while adding a mate (an origin plane: `origin:xy`, `origin:xz`, `origin:yz`). */
  pickFace(ref: MateRef): void;
  /** Changes a mate, re-solving; the reason when it cannot be met (nothing changes then). */
  edit(id: string, patch: Partial<Mate>): string | null;
  remove(id: string): void;
  /** Fixes an instance in place or frees it; the reason when a mate still moves it. */
  ground(id: string, on: boolean): string | null;
  /** The mates without those on a part (when it is removed). */
  without(part: string): Mate[];
  /**
   * What to show picked: the faces clicked while adding a mate, else the selected mate's two faces —
   * base part faces (`faces`), instance faces, and the instances to outline while adding.
   */
  highlight: { faces: { body: number; face: number }[]; instanceFaces: { id: string; body: number; face: number }[]; instances: string[] };
}

export function useAssembly({ doc, evaluated, bodies, instanceBodies, setDoc, commit, readFaces }: {
  doc: StudioDoc; evaluated: StudioDoc; bodies: BodyResult[];
  instanceBodies: Map<string, { bodies: BodyResult[] }>;
  setDoc: Dispatch<SetStateAction<StudioDoc>>;
  /** Current-root linked evaluations, with exact immediate owner and local input; no flattening here. */
  readFaces?(owner: string, input: StudioDoc): Promise<FaceTable | null>;
  /** One undoable change of the instances and the mates together. */
  commit(instances: PartInstance[], mates: Mate[]): void;
}): Assembly {
  const client = useMemo(() => new FaceClient(), []);
  const instances = useMemo(() => doc.instances ?? [], [doc.instances]);
  const mates = useMemo(() => doc.mates ?? [], [doc.mates]);
  const sourceKey = useMemo(() => ({}), [readFaces, evaluated, instances]);
  const currentSource = useRef(sourceKey); currentSource.current = sourceKey;
  const [faceResult, setFaceResult] = useState<{ key: object; linked: boolean; tables: Map<string, FaceTable> | null } | null>(null);
  const linkedScope = !!readFaces || !!faceResult?.linked;
  const currentTables = faceResult?.key === sourceKey && faceResult.tables !== null;
  const facesUnavailable = linkedScope && !currentTables;
  // A linked result can never bleed into another root/setup or back into the legacy reader.
  const tables = !instances.length || facesUnavailable ? EMPTY_TABLES : faceResult?.tables ?? EMPTY_TABLES;
  const facesPending = useCallback(() => facesUnavailable || currentSource.current !== sourceKey, [facesUnavailable, sourceKey]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [freedom, setFreedom] = useState<Record<string, Freedom>>({});
  const [draft, setDraftView] = useState<MateDraft | null>(null);
  // The draft as of the last pick, ahead of React's re-render (two picks can come before it).
  const draftRef = useRef<MateDraft | null>(null);
  const setDraftState = useCallback((next: MateDraft | null) => { draftRef.current = next; setDraftView(next); }, []);
  const [selected, setSelected] = useState<string | null>(null);

  // Linked inputs stay local and keep their explicit occurrence context in the host callback.
  useEffect(() => {
    if (!instances.length) { setFaceResult({ key: sourceKey, linked: false, tables: EMPTY_TABLES }); return; }
    let live = true;
    const current = () => live && currentSource.current === sourceKey;
    const unavailable = () => {
      if (current()) setFaceResult(previous => ({ key: sourceKey, linked: !!readFaces || !!previous?.linked, tables: null }));
    };
    // Wrap each call before starting the group: even mixed sync throws/rejections stay handled.
    const take = (owner: string, input: StudioDoc) => Promise.resolve().then(() => {
      if (!current()) return null;
      return readFaces ? readFaces(owner, input) : client.table(owner === BASE ? input : flattenAssembly(input));
    });
    void Promise.all([take(BASE, evaluated), ...instances.map(i => take(i.id, i.doc))]).then(ts => {
      if (!current()) return;
      if (ts.some(table => !table || typeof table !== 'object' || Array.isArray(table))) { unavailable(); return; }
      setFaceResult({ key: sourceKey, linked: !!readFaces, tables: new Map([[BASE, ts[0]!], ...instances.map((i, k) => [i.id, ts[k + 1]!] as [string, FaceTable])]) });
    }, unavailable);
    return () => { live = false; };
  }, [client, evaluated, instances, readFaces, sourceKey]);

  const solve = useCallback((list: readonly PartInstance[], ms: readonly Mate[]) => facesPending()
    ? { instances: [...list], problems: EMPTY_PROBLEMS, pending: true, freedom: EMPTY_FREEDOM }
    : solveAssembly(list, ms, p => tables.get(p)), [tables, facesPending]);

  // Re-solve after every change (a typed placement, a mate, an edited part): a mated instance follows, and
  // one whose part moved is carried along with it. The result replaces the document in place (it is the
  // same state, solved), so undo skips it.
  const lastSolved = useRef<readonly PartInstance[] | undefined>(undefined);
  useEffect(() => {
    if (facesPending()) { setProblems(EMPTY_PROBLEMS); setFreedom(EMPTY_FREEDOM); return; }
    if (!mates.length) { setProblems([]); setFreedom({}); lastSolved.current = instances; return; }
    const r = solveAssembly(instances, mates, p => tables.get(p), lastSolved.current);
    if (r.pending) return;
    lastSolved.current = r.instances;
    setProblems(r.problems); setFreedom(r.freedom);
    const moved = r.instances.some((i, k) => i.position.some((v, j) => Math.abs(v - instances[k].position[j]) > 1e-9) || i.rotation.some((v, j) => Math.abs(v - instances[k].rotation[j]) > 1e-9));
    if (moved) setDoc(d => d.instances === doc.instances ? { ...d, instances: r.instances } : d);
  }, [solve, instances, mates, facesPending]);

  const isFixed = useCallback((part: string) => part === BASE || !!instances.find(i => i.id === part)?.grounded, [instances]);
  const faceOf = (ref: MateRef) => tables.get(ref.part)?.[ref.face];

  /** Adds the mate the two picks make, or says why not (and keeps the first pick). */
  const finish = (d: MateDraft): MateDraft | null => {
    if (facesPending()) return { ...d, picks: [d.picks[0]], error: FACES_PENDING };
    let [first, second] = d.picks;
    if (first.ref.part === second.ref.part) return { ...d, picks: [first], error: 'Both faces are on the same part. Pick the second face on another part.' };
    // The second pick moves, unless its part is fixed: then the first one does.
    if (isFixed(second.ref.part)) {
      if (isFixed(first.ref.part)) return { ...d, picks: [first], error: 'Both parts are fixed. Pick a face on a part that can move (an instance not fixed in place).' };
      [first, second] = [second, first];
    }
    const fa = faceOf(first.ref), fb = faceOf(second.ref);
    if (!fa || !fb) return { ...d, picks: [d.picks[0]], error: 'This part’s faces are still being read. Click the face again in a moment.' };
    let kinds: MateKind[];
    try { kinds = mateKindsOf({ a: first.ref, b: second.ref }, { a: fa, b: fb }); } catch (e) { return { ...d, picks: [d.picks[0]], error: String(e instanceof Error ? e.message : e) }; }
    const kind = d.kind === 'auto' ? kinds[0] ?? 'coincident' : d.kind;
    const used = new Set(mates.map(m => m.id));
    let n = mates.length + 1; while (used.has(`m${n}`)) n++;
    const mate: Mate = { id: `m${n}`, kind, a: first.ref, b: second.ref, ...(kind === 'distance' ? { distance: d.distance } : {}), ...(kind === 'angle' ? { angle: d.angle } : {}), ...(kind !== 'concentric' && d.flip ? { flip: true } : {}) };
    const why = mateRefusal(mate, fa, fb);
    if (why) return { ...d, picks: [d.picks[0]], error: why };
    const r = solve(instances, [...mates, mate]);
    const problem = r.problems.find(p => p.mate === mate.id) ?? (mate.kind === 'fastened' || mate.kind === 'ball' || mate.kind === 'universal' || mate.kind === 'cylindrical' || mates.some(m => m.kind === 'universal' || m.kind === 'cylindrical') ? r.problems[0] : undefined);
    if (r.pending) return { ...d, picks: [d.picks[0]], error: 'The parts’ faces are still being read. Click the face again in a moment.' };
    if (problem) return { ...d, picks: [d.picks[0]], error: problem.reason };
    commit(r.instances, [...mates, mate]); setSelected(mate.id);
    return null;
  };

  const pick = (hit: Hit): boolean => {
    const draft = draftRef.current;
    if (!draft) return false;
    let p: MatePick | null = null;
    // A display face may join coplanar faces ("a+b"): the first that is a mateable face names it.
    const named = (part: string, name: string | undefined) => name?.split('+').find(x => tables.get(part)?.[x]) ?? name?.split('+')[0];
    if (hit.instance && hit.instanceFace) {
      const face = instanceBodies.get(hit.instance)?.bodies[hit.instanceFace.body]?.mesh.faces[hit.instanceFace.face];
      const name = named(hit.instance, face?.name);
      if (name) p = { ref: { part: hit.instance, face: name } };
    } else if (hit.face) {
      const name = named(BASE, bodies[hit.face.body]?.mesh.faces[hit.face.face]?.name);
      if (name) p = { ref: { part: BASE, face: name }, body: hit.face.body, face: hit.face.face };
    }
    if (p) addPick(p);
    return true;
  };
  const addPick = (p: MatePick) => {
    const draft = draftRef.current;
    if (!draft) return;
    if (facesPending()) { setDraftState({ ...draft, error: FACES_PENDING }); return; }
    if (!tables.get(p.ref.part)?.[p.ref.face] && tables.has(p.ref.part)) { setDraftState({ ...draft, error: 'This face cannot be mated: pick a flat face or a round (cylindrical) one.' }); return; }
    const next = { ...draft, error: undefined, picks: draft.picks.length >= 2 ? [p] : [...draft.picks, p] };
    setDraftState(next.picks.length === 2 ? finish(next) : next);
  };
  const pickRef = useRef(pick); pickRef.current = pick;

  // Dev/test hook: a click on an instance's face by its persistent name (canvas picks are not reproducible).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __studioPickInstanceFace: (id: string, name: string) => boolean }).__studioPickInstanceFace = (id, name) => {
      const list = instanceBodies.get(id)?.bodies ?? [];
      for (const [b, body] of list.entries()) {
        const f = body.mesh.faces.findIndex(x => x.name.split('+').includes(name));
        if (f >= 0) return pickRef.current({ face: null, instance: id, instanceFace: { body: b, face: f } });
      }
      return false;
    };
  }, [instanceBodies]);

  const edit = (id: string, patch: Partial<Mate>): string | null => {
    if (facesPending()) return FACES_PENDING;
    const old = mates.find(m => m.id === id);
    if (!old) return 'This mate is no longer in the assembly.';
    const mate = { ...old, ...patch };
    try {
      validateFastenedOptions(mate.kind, patch);
      validateBallOptions(mate.kind, patch);
      validateUniversalOptions(mate.kind, patch);
      validateCylindricalOptions(mate.kind, patch);
      // Switching a classic mate to fastened drops only its old kind's scalar fields.
      if (mate.kind === 'fastened' && old.kind !== 'fastened') { delete mate.distance; delete mate.angle; }
      if (mate.kind === 'ball' && old.kind !== 'ball') { delete mate.distance; delete mate.angle; delete mate.flip; }
      if (mate.kind === 'universal' && old.kind !== 'universal') { delete mate.distance; delete mate.angle; delete mate.flip; }
      if (mate.kind === 'cylindrical' && old.kind !== 'cylindrical') { delete mate.distance; delete mate.angle; delete mate.flip; }
      validateFastenedOptions(mate.kind, mate);
      validateBallOptions(mate.kind, mate);
      validateUniversalOptions(mate.kind, mate);
      validateCylindricalOptions(mate.kind, mate);
    } catch (e) { return String(e instanceof Error ? e.message : e); }
    const next = mates.map(m => m.id === id ? mate : m);
    const why = mateRefusal(mate, faceOf(mate.a), faceOf(mate.b));
    if (why) return why;
    const r = solve(instances, next), problem = r.problems.find(p => p.mate === id) ?? (next.some(m => m.kind === 'fastened' || m.kind === 'ball' || m.kind === 'universal' || m.kind === 'cylindrical') ? r.problems[0] : undefined);
    if ((mate.kind === 'fastened' || mate.kind === 'ball' || mate.kind === 'universal' || mate.kind === 'cylindrical') && r.pending) return FACES_PENDING;
    if (problem) return problem.reason;
    commit(r.instances, next); return null;
  };

  return {
    mates, problems: facesUnavailable ? EMPTY_PROBLEMS : problems, tables, freedom: facesUnavailable ? EMPTY_FREEDOM : freedom, draft, selected,
    start: () => { setDraftState({ kind: 'auto', distance: 10, angle: 90, flip: false, picks: [] }); setSelected(null); },
    cancel: () => setDraftState(null),
    setDraft: patch => { if (draftRef.current) setDraftState({ ...draftRef.current, ...patch }); },
    select: setSelected,
    pick, edit, pickFace: ref => addPick({ ref }),
    lock: (part, to) => {
      if (facesPending()) return FACES_PENDING;
      const b = instances.find(i => i.id === part), a = to === BASE ? null : instances.find(i => i.id === to);
      if (!b || (to !== BASE && !a)) return 'Pick the part to lock it to.';
      const used = new Set(mates.map(m => m.id));
      let n = mates.length + 1; while (used.has(`m${n}`)) n++;
      const mate: Mate = { id: `m${n}`, kind: 'lock', a: { part: to, face: '' }, b: { part, face: '' }, rel: lockRel(a ?? null, b) };
      const r = solve(instances, [...mates, mate]), problem = r.problems.find(p => p.mate === mate.id) ?? (mates.some(m => m.kind === 'universal' || m.kind === 'cylindrical') ? r.problems[0] : undefined);
      if (problem) return problem.reason;
      commit(r.instances, [...mates, mate]); setSelected(mate.id); return null;
    },
    remove: id => { commit(instances, mates.filter(m => m.id !== id)); if (selected === id) setSelected(null); },
    ground: (id, on) => {
      if (facesPending()) return FACES_PENDING;
      const by = mates.filter(m => m.b.part === id);
      if (on && by.length) return `${by.length} mate${by.length > 1 ? 's' : ''} move${by.length > 1 ? '' : 's'} this part. Delete ${by.length > 1 ? 'them' : 'it'} first, or fix the other part instead.`;
      commit(instances.map(i => i.id === id ? { ...i, grounded: on || undefined } : i), mates); return null;
    },
    without: part => mates.filter(m => m.a.part !== part && m.b.part !== part),
    highlight: (() => {
      const sel = mates.find(m => m.id === selected), refs = draft ? draft.picks.map(p => p.ref) : sel ? [sel.a, sel.b] : [];
      // A face by name on the part's evaluated bodies (display faces may join coplanar faces: "a+b").
      const locate = (ref: MateRef) => {
        for (const [body, b] of (ref.part === BASE ? bodies : instanceBodies.get(ref.part)?.bodies ?? []).entries()) {
          const face = b.mesh.faces.findIndex(f => f.name.split('+').includes(ref.face));
          if (face >= 0) return { body, face };
        }
        return null;
      };
      return {
        faces: refs.filter(r => r.part === BASE).flatMap(r => { const at = locate(r); return at ? [at] : []; }),
        instanceFaces: refs.filter(r => r.part !== BASE).flatMap(r => { const at = locate(r); return at ? [{ id: r.part, ...at }] : []; }),
        instances: (draft?.picks ?? []).filter(p => p.ref.part !== BASE).map(p => p.ref.part),
      };
    })(),
  };
}
