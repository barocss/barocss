// #287: config.utilities (static custom utilities). Internal module: not re-exported from the package index.
import type { AstNode } from './ast';
import { decl } from './ast';
import type { Context } from './context';
import { getUtility, registerUtility } from './registry';
import { isStructureSafeValue, hasCommentDelimiter } from './parser';
import { debugWarn } from '../utils/debug';

const customUtilityName = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const customUtilityProp = /^(--[A-Za-z0-9_-]+|-?[A-Za-z][A-Za-z0-9-]*)$/;

/** The safe declarations of a custom utility, or null when its name or any declaration is invalid. */
export function validateCustomUtility(name: unknown, decls: unknown): [string, string][] | null {
  if (typeof name !== 'string' || !customUtilityName.test(name)) return null;
  if (!decls || typeof decls !== 'object' || Array.isArray(decls)) return null;
  const out: [string, string][] = [];
  for (const [prop, raw] of Object.entries(decls as Record<string, unknown>)) {
    if (typeof raw !== 'string' && typeof raw !== 'number') return null;
    const value = String(raw).trim();
    if (!customUtilityProp.test(prop) || !value || !isStructureSafeValue(value) || hasCommentDelimiter(value)) return null;
    out.push([prop, value]);
  }
  return out.length ? out : null;
}

/**
 * Registers config.utilities on this context, ahead of the built-ins (the first match wins). Like
 * Tailwind 4's `@utility`, a custom utility named like a built-in emits the built-in's declarations
 * first and then its own.
 */
export function registerCustomUtilities(ctx: Context, utilities: unknown): void {
  if (!utilities || typeof utilities !== 'object' || Array.isArray(utilities)) return;
  const list = getUtility(ctx);
  const builtins = [...list];
  const before = list.length;
  for (const [name, decls] of Object.entries(utilities as Record<string, unknown>)) {
    const safe = validateCustomUtility(name, decls);
    if (!safe) {
      debugWarn(`[BAROCSS] Ignoring invalid custom utility "${name}"`);
      continue;
    }
    const shadowed = builtins.filter((u) => u.match(name));
    registerUtility({
      name,
      category: 'custom',
      match: (className: string) => className === name,
      handler: (value, c, token) => {
        let base: AstNode[] = [];
        for (const reg of shadowed) {
          base = reg.handler(value, c, token, reg) || [];
          if (base.length > 0) break;
        }
        return [...base, ...safe.map(([prop, v]) => decl(prop, v))];
      },
    }, ctx);
  }
  if (list.length > before) list.unshift(...list.splice(before));
}
