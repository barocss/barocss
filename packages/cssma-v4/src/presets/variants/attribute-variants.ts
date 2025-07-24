import { functionalModifier } from "../../core/registry";

// --- Standard aria and not- variants ---
functionalModifier(
  (mod: string) => /^aria-/.test(mod),
  ({ selector, mod }) => {
    // aria-[expanded=true] → &[aria-expanded="true"] { ... }
    const bracket = /^aria-\[([a-zA-Z0-9_-]+)(?:=([^\]]+))?\]$/.exec(mod.type);
    if (bracket) {
      const key = bracket[1];
      const value = bracket[2] ?? 'true';
      return {
        selector: `&[aria-${key}="${value}"]`,
        source: 'aria'
      };
    }
    // aria-pressed → &[aria-pressed="true"] { ... }
    const m2 = /^aria-([a-zA-Z0-9_]+)$/.exec(mod.type);
    if (m2) {
      const key = m2[1];
      return {
        selector: `&[aria-${key}="true"]`,
        source: 'aria'
      };
    }
    return {
      selector,
      source: 'aria'
    };
  },
  undefined
);

functionalModifier(
  (mod: string) => mod.startsWith('not-'),
  ({ selector, mod }) => {
    const pseudo = mod.type.replace('not-', '');
    if (pseudo.startsWith('[')) {
      const inner = pseudo.slice(1, -1);
      // 속성 패턴: 식별자(=값)? (예: open, dir=rtl, aria-pressed=true)
      if (/^[a-zA-Z0-9_-]+(=.+)?$/.test(inner)) {
        return {
          selector: `&:not([${inner}])`,
          source: 'attribute'
        };
      } else {
        // 그 외는 selector로 인식
        return {
          selector: `&:not(${inner})`,
          source: 'attribute'
        };
      }
    } else {
      // not-hover → :not(:hover)
      return {
        selector: `&:not(:${pseudo})`,
        source: 'attribute'
      };
    }
  },
  undefined
);

// --- Standard data- variants (similar to aria-) ---
functionalModifier(
  (mod: string) => /^data-/.test(mod),
  ({ selector, mod }) => {
    
    // data-[state=open] → [data-state="open"] & { ... }
    const bracket = /^data-\[([a-zA-Z0-9_-]+)(?:=([^\]]+))?\]$/.exec(mod.type);
    if (bracket) {
      const key = bracket[1];
      const value = bracket[2] ?? 'true';
      return {
        selector: `&[data-${key}="${value}"]`,
        source: 'data'
      };
    }
    // data-avatar → [data-avatar="true"] & { ... }
    const m2 = /^data-([a-zA-Z0-9_]+)$/.exec(mod.type);
    if (m2) {
      const key = m2[1];
      return {
        selector: `&[data-${key}]`,
        source: 'data'
      };
    }
    return {
      selector,
      source: 'attribute'
    };
  },
  undefined
); 