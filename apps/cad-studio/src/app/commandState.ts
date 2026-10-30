import type { Command, Ctx, Field, Values } from '@barocss/cad-model/app/commands';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
/** `placing`: a new shape that follows the pointer until a click (or a drop from the rail) stands it there. */
export function missingCommandField(fields: readonly Field[], values: Values): Field | undefined {
  for (const field of fields) {
    const value = values[field.key];
    if (field.kind === 'text' || field.kind === 'file') {
      if (typeof value !== 'string' || !value.trim() || value.length > field.maxLength) return field;
    } else if (field.kind !== 'choice' && (value === '' || !Number.isFinite(Number(value)))) return field;
  }
  return undefined;
}

export interface Active { cmd: Command; values: Values; preview: 'busy' | 'ok' | 'error'; error?: FriendlyError; ctx: Ctx; placing?: boolean; upload?: 'busy' | 'error' }
/** Stable numbers for objects (a command's context, its values), for the App's subscription key. */
const objectIds = new WeakMap<object, number>();
let nextObjectId = 0;
const idOf = (o: object) => { let id = objectIds.get(o); if (id === undefined) { id = ++nextObjectId; objectIds.set(o, id); } return id; };
/**
 * What of the running command the App renders for (R1d): its start and end, its command, context and placing — and its
 * values, unless the HUD typed them (`typed`, the values its last keystroke made) or the pointer is placing the shape. The
 * preview's state and error are the HUD's; a typed or placed value's preview renders the App once, with its result.
 */
export const activeKey = (a: Active | null, typed: Values | null) =>
  a ? `${a.cmd.id}|${idOf(a.ctx)}|${a.placing ? 1 : 0}|${a.placing || a.values === typed ? '' : idOf(a.values)}` : '';

