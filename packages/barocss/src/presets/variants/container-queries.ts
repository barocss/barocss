import { functionalModifier } from "../../core/registry";
import { AstNode, atRule } from "../../core/ast";
import { Context } from "../../core/context";
import { ParsedModifier } from "../../core/parser";
import { createContainerRule, createContainerParams } from "./utils";

// --- @container query variants ---

// @container/<name> is a utility (container-type + container-name, presets/layout.ts), not a variant: a bare
// `@container <name> { }` has no condition and is invalid CSS.

// 3. [not-]@<size>, @min-<size>, @max-<size>, each with an optional /<name>. <size> is a --container-* theme key
// (3xs…7xl) or an arbitrary [value]; unknown theme keys emit nothing (Tailwind 4 behaviour).
const SIZE_VARIANT = /^(not-)?@(?:(min|max)-)?(\[[^\]]+\]|[a-zA-Z0-9.]+)(?:\/([a-zA-Z0-9_-]+))?$/;
functionalModifier(
  (mod: string) => SIZE_VARIANT.test(mod) && !/^(?:not-)?@container(?:\/|$)/.test(mod),
  undefined,
  (mod: ParsedModifier, context: Context) => {
    const m = SIZE_VARIANT.exec(mod.type);
    if (!m) return [];
    const [, not, type, size, name] = m;
    const value = size.startsWith('[')
      ? size.slice(1, -1).replace(/_/g, ' ')
      : (context.theme('container.' + size) as string | undefined);
    if (!value) return [];
    // #311: not-@<size> negates the condition (Tailwind 4.3.3: `@container [name] not (width >= …)`).
    return [createContainerRule(createContainerParams(type === 'max' ? 'max' : 'min', value, name, !!not), [])];
  }
);
