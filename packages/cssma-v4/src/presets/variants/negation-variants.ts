import { functionalModifier } from "../../core/registry";

// not-[]: functionalModifier for arbitrary negation
functionalModifier(
  (mod: string) => /^not-\[.*\]$/.test(mod),
  ({ selector, mod, variantChain, index }) => {
    const m = /^not-\[(.+)\]$/.exec(mod.type);
    if (m) {
      const content = m[1];
      const isSingle = !variantChain || variantChain.length === 1;
      // class selector or complex selector
      if (content.startsWith('.') || content.includes('>')) {
        return {
          selector: `${selector}:not(${content})`,
          flatten: !isSingle,
          wrappingType: isSingle ? 'rule' : 'style-rule'
        };
      }
      // attribute selector
      return {
        selector: `${selector}:not([${content}])`,
        flatten: !isSingle,
        wrappingType: isSingle ? 'rule' : 'style-rule'
      };
    }
    return selector;
  },
  undefined,
  { order: 200 }
);

// not-: functionalModifier for pseudo-class negation
functionalModifier(
  (mod: string) => /^not-(hover|focus|active|visited|checked|disabled|enabled|required|optional|valid|invalid|in-range|out-of-range|placeholder-shown|autofill|read-only|indeterminate|default|empty|target|root|scope|where|is|not|has|dir|lang|all|any|matches|current|past|future|playing|paused|seeking|buffering|muted|volume-locked|picture-in-picture|fullscreen|popover-open|modal|open|closed|selected|checked|pressed|expanded|grabbed|busy|live|atomic|relevant|invalid|current|past|future|playing|paused|seeking|buffering|muted|volume-locked|picture-in-picture|fullscreen|popover-open|modal|open|closed|selected|checked|pressed|expanded|grabbed|busy|live|atomic|relevant|invalid)$/.test(mod),
  ({ selector, mod, variantChain, index }) => {
    const m = /^not-(.+)$/.exec(mod.type);
    const isSingle = !variantChain || variantChain.length === 1;
    return {
      selector: m ? `${selector}:not(:${m[1]})` : selector,
      flatten: !isSingle,
      wrappingType: isSingle ? 'rule' : 'style-rule'
    };
  },
  undefined,
  { order: 200 }
); 