import { functionalModifier } from "../../core/registry";

// Tailwind-style arbitrary variant ([...]) 지원 (order: 999, always last)
functionalModifier(
  (mod: string) => /^\[.*\]$/.test(mod),
  ({ selector, mod }) => {
    const m = /^\[(.+)\]$/.exec(mod.type);
    if (!m) return { selector };
    const inner = m[1].trim();
    // 속성 선택자(attr=val) 또는 단순 속성([open])도 대괄호로 감싸서 반환
    if (/^[a-zA-Z0-9_-]+(=.+)?$/.test(inner)) {
      return { selector: `&[${inner}]`, wrappingType: 'rule' };
    }

    if (inner === '&>*') {
      return { selector: `${inner}`, wrappingType: 'style-rule' };
    }

    if (inner.startsWith('&')) {
      return { selector: `${inner}`, wrappingType: 'rule' };
    }

    return { selector: `${inner} &`.trim(), wrappingType: 'rule' };
  },
  undefined,
  { order: 999 }
); 