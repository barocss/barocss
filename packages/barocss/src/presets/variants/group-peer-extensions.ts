import { functionalModifier } from "../../core/registry";

// --- group/peer/parent/child extensions (examples: group-focus, peer-active, etc.) ---
functionalModifier(
  (mod: string) => /^group-(.+)$/.test(mod),
  ({ selector, mod }) => {
    const m = /^group-(.+)$/.exec(mod.type);

    if (m?.[1].startsWith('[') && m?.[1].endsWith(']')) {
      const value = m?.[1].slice(1, -1).replace(/_/g, '');
      return {
        selector: `&:is(:where(.group):is(${value}) *)`,
        wrappingType: 'rule',
        source: 'group'
      };
    }

    if (m?.[1]?.startsWith('has-')) {
      const pattern = /^has-\[([a-zA-Z0-9_-]+)\]$/.exec(m?.[1]);
      if (pattern) {
        const value = pattern[1];
        return {
          selector: `&:is(:where(.group):has(:is(${value})) *)`,
          source: 'group'
        };
      }
      return {
        selector: `&:is(:where(.group):has(:is(${m?.[1].slice(4, -1)})) *)`,
        source: 'group'
      };
    }

    if (m?.[1]?.startsWith('aria-')) {
      const pattern = /^aria-\[([a-zA-Z0-9_-]+)(?:=([^\]]+))?\]$/.exec(m?.[1]);
      if (pattern) {
        const value = pattern[1];
        if (pattern[2]) {
          return {
            selector: `&:is(:where(.group)[aria-${value}="${pattern[2]}"] *)`,
            source: 'group'
          };
        } else {
          return {
            selector: `&:is(:where(.group)[aria-${value}] *)`,
            source: 'group'
          };
        }
      }
    }

    return m ? {
      selector: `&:is(:where(.group):${m[1]} *)`,
      wrappingType: 'rule',
      source: 'group'
    } : {
      selector,
      source: 'group'
    };
  },
  undefined,
);

functionalModifier(
  (mod: string) => /^peer-(.+)$/.test(mod),
  ({ selector, mod }) => {
    const m = /^peer-(.+)$/.exec(mod.type);

    if (m?.[1].startsWith('[') && m?.[1].endsWith(']')) {
      const value = m?.[1].slice(1, -1).replace(/_/g, '');
      return {
        selector: `&:is(:where(.peer):is(${value})~*)`,
        wrappingType: 'rule',
        source: 'peer'
      };
    }

    const value = m?.[1];

    // has-xxxx, not-xxxx, aria-xxxx

    if (value?.startsWith('has-')) {
      return {
        selector: `&:is(:where(.peer):has(:${value.slice(4)})~*)`,
        source: 'peer'
      };
    }

    if (value?.startsWith('not-')) {
      return {
        selector: `&:is(:where(.peer):not(:${value.slice(4)})~*)`,
        source: 'peer'
      };
    }
    
    if (value?.startsWith('aria-')) {

      let pattern = /^aria-([a-zA-Z0-9_]+)$/.exec(value);
      if (pattern) {
        const key = pattern[1];
        return {
          selector: `&:is(:where(.peer)[aria-${key}]~*)`,
          source: 'peer'
        };
      }

      pattern = /^aria-\[([a-zA-Z0-9_-]+)(?:=([^\]]+))?\]$/.exec(value);
      if (pattern) {
        const key = pattern[1];
        const value = pattern[2];

        if (pattern[2]) {
          return {
            selector: `&:is(:where(.peer)[aria-${key}="${value}"]~*)`,
            source: 'peer'
          };
        } else {
          return {
            selector: `&:is(:where(.peer)[aria-${key}]~*)`,
            source: 'peer'
          };
        }
      }
    }

    return m ? {
      selector: `&:is(:where(.peer):${value}~*)`,
      source: 'peer'
    } : {
      selector,
      source: 'peer'
    };
  },
  undefined,
);

// --- parent/child extensions (not in the actual spec, but extensibility example) ---
functionalModifier(
  (mod: string) => /^parent-(.+)$/.test(mod),
  ({ selector, mod }) => {
    const m = /^parent-(.+)$/.exec(mod.type);

    if (m?.[1].startsWith('[') && m?.[1].endsWith(']')) {
      return {
        selector: `.parent\\:\\[${m[1].slice(1, -1)}\\] &`,
        wrappingType: 'rule',
        source: 'parent'
      };
    }

    return m ? {
      selector: `.parent:${m[1]} &`,
      source: 'parent'
    } : {
      selector,
      source: 'parent'
    };
  },
  undefined,
);
functionalModifier(
  (mod: string) => /^child-(.+)$/.test(mod),
  ({ selector, mod }) => {
    const m = /^child-(.+)$/.exec(mod.type);

    if (m?.[1].startsWith('[') && m?.[1].endsWith(']')) {
      return {
        selector: `& > .child\\:\\[${m[1].slice(1, -1)}\\]`,
        wrappingType: 'rule',
        source: 'child'
      };
    }
    return m ? {
      selector: `& > .child:${m[1]}`,
      source: 'child'
    } : {
      selector,
      source: 'child'
    };
  },
  undefined,
); 