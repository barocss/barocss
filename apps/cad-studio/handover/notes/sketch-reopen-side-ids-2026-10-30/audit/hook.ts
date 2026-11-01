import { createElement, type SetStateAction } from 'react';
import { renderToString } from 'react-dom/server.edge';
import { useSketchActions } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/apps/cad-studio/src/sketch/useSketchActions';
export function actions(doc: any) {
  let sketch: any = null, api!: any, revision = 1;
  const accepted: any[] = [], evaluated: any[] = [], notices: any[] = [], docNow = { current: doc };
  const setSketch = (value: SetStateAction<any>) => { sketch = typeof value === 'function' ? (value as any)(sketch) : value; };
  const transport = { evaluate: async (input: any, revision: number) => { evaluated.push(input); return { ok: true as const, revision, bodies: [], wallTime: 0 }; } };
  function Probe() {
    api = useSketchActions({ model: { doc, bodies: [], selection: { faces: [], edges: [], bodies: [] }, marker: null } as any,
      editor: { sketch, setSketch, sketchGeneration: { current: 0 } }, owner: { docNow, acceptanceScope: {} },
      worker: { engine: transport as any, nextRevision: () => revision++ }, viewport: { current: null },
      changes: { canChangeDocument: () => true, commit: (next: any) => { accepted.push(next); docNow.current = next; return true; }, commitDirect: () => { throw new Error('direct'); }, setSelection: () => {}, setEditNode: () => {}, setActive: () => {}, setPreviewBodies: () => {} } as any,
      onNotice: (n: any) => notices.push(n) } as any);
    return null;
  }
  const render = () => renderToString(createElement(Probe)); render();
  return { accepted, evaluated, notices, render, get api() { return api; }, get sketch() { return sketch; }, setSketch };
}
