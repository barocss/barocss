// Shared helpers for audit probes (imports the FIXED tree by absolute path unless SRC is overridden at bundle time).
import { part, sketch } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-af167fdb085fc2526/packages/barocss-cad-model/src/api';
import { evaluateDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-af167fdb085fc2526/packages/barocss-cad-model/src/engine/evaluate';
import type { ModelNode, SketchNode, StudioDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-af167fdb085fc2526/packages/barocss-cad-model/src/engine/doc';
import { editFields } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-af167fdb085fc2526/packages/barocss-cad-model/src/app/editFields';
import { outlineFields } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-af167fdb085fc2526/packages/barocss-cad-model/src/sketch/outlineFields';
import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-af167fdb085fc2526/packages/barocss-cad-model/src/sketch/loops';
import { sketchShapes } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-af167fdb085fc2526/packages/barocss-cad-model/src/sketch/reopen';
import { commitDimension, type Polygon } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-af167fdb085fc2526/packages/barocss-cad-model/src/sketch/rules';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-af167fdb085fc2526/packages/barocss-cad-model/src/sketch/settle';
import type { SketchShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-af167fdb085fc2526/packages/barocss-cad-model/src/sketch/types';
export { part, sketch, evaluateDoc, editFields, outlineFields, profileOf, sketchShapes, commitDimension, settleShape };
export type { ModelNode, SketchNode, StudioDoc, Polygon, SketchShape };

export const poly = (points: [number, number][], bulges?: number[]): Polygon => ({ kind: 'polygon', points, closed: true, bulges: bulges ?? points.map(() => 0) });
export function dimensioned(points: [number, number][], dims: [string, number][], extra: Partial<Polygon> = {}): Polygon {
  const raw = { ...poly(points, extra.bulges), ...extra } as Polygon;
  const settled = settleShape(raw, { ...raw, closed: false });
  if (settled.error) throw new Error(settled.error);
  let shape = settled.shape as Polygon;
  for (const [key, value] of dims) {
    const r = commitDimension(shape, key, value);
    if (!r.ok) throw new Error(key + ': ' + JSON.stringify(r));
    shape = r.shape as Polygon;
  }
  return shape;
}
export const nodeOf = (shapes: SketchShape[]): SketchNode => { const r = profileOf(shapes); if (!('node' in r)) throw new Error(JSON.stringify(r)); return r.node; };
