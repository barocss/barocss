import { functionalModifier } from "../../core/registry";
import { AstNode, atRule } from "../../core/ast";

// --- At-rule variants ---

// supports-[]: functionalModifier
functionalModifier(
  (mod: string) => /^supports-\[.*\]$/.test(mod),
  undefined,
  (mod) => {
    const m = /^supports-\[(.+)\]$/.exec(mod.type);
    if (m) {
      return [atRule('supports', m[1], [], 'supports')];
    }
    return [];
  },
  { order: 15 }
);

// --- layer-[]: @layer 쿼리 variant ---
functionalModifier(
  (mod: string) => /^layer-\[.*\]$/.test(mod),
  undefined,
  (mod) => {
    const m = /^layer-\[(.+)\]$/.exec(mod.type);
    return m ? [atRule('layer', m[1], [])] : [];
  },
  { order: 15 }
);

// --- scope-[]: @scope 쿼리 variant ---
functionalModifier(
  (mod: string) => /^scope-\[.*\]$/.test(mod),
  undefined,
  (mod) => {
    const m = /^scope-\[(.+)\]$/.exec(mod.type);
    return m ? [atRule('scope', m[1], [])] : [];
  },
  { order: 15 }
); 