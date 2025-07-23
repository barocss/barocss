import { functionalModifier } from "../../core/registry";

// --- group/peer/parent/child 확장 (예시: group-focus, peer-active 등) ---
functionalModifier(
  (mod: string) => /^group-(hover|focus|active|visited|checked|disabled|aria-[^:]+)$/.test(mod),
  ({ selector, mod }) => {
    const m = /^group-(.+)$/.exec(mod.type);
    return m ? {
      selector: `.group:${m[1]} &`,
      wrappingType: 'rule',
      source: 'group'
    } : {
      selector,
      source: 'group'
    };
  },
  undefined,
  { order: 30 }
);
functionalModifier(
  (mod: string) => /^peer-(hover|focus|active|visited|checked|disabled|aria-[^:]+)$/.test(mod),
  ({ selector, mod }) => {
    const m = /^peer-(.+)$/.exec(mod.type);
    return m ? {
      selector: `.peer:${m[1]} ~ &`,
      source: 'peer'
    } : {
      selector,
      source: 'peer'
    };
  },
  undefined,
  { order: 30 }
);

// --- parent/child 확장(실제 Tailwind에는 없지만 확장성 예시) ---
functionalModifier(
  (mod: string) => /^parent-(open|focus|hover)$/.test(mod),
  ({ selector, mod }) => {
    const m = /^parent-(.+)$/.exec(mod.type);
    return m ? {
      selector: `.parent:${m[1]} &`,
      source: 'parent'
    } : {
      selector,
      source: 'parent'
    };
  },
  undefined,
  { order: 30 }
);
functionalModifier(
  (mod: string) => /^child-(hover|focus|active)$/.test(mod),
  ({ selector, mod }) => {
    const m = /^child-(.+)$/.exec(mod.type);
    return m ? {
      selector: `& > .child:${m[1]}`,
      source: 'child'
    } : {
      selector,
      source: 'child'
    };
  },
  undefined,
  { order: 30 }
); 