import { functionalModifier } from "../../core/registry";

// not-[]: functionalModifier for arbitrary negation
functionalModifier(
  (mod: string) => /^not-\[.*\]$/.test(mod),
  ({ selector, mod }) => {
    const m = /^not-\[(.+)\]$/.exec(mod.type);
    if (m) {
      const content = m[1];
      // If it starts with a dot or contains >, it's a class selector, don't add brackets
      if (content.startsWith('.') || content.includes('>')) {
        return `${selector}:not(${content})`;
      }
      // Otherwise, it's an attribute selector, add brackets
      return `${selector}:not([${content}])`;
    }
    return selector;
  },
  undefined,
  { order: 200 }
);

// not-: functionalModifier for pseudo-class negation
functionalModifier(
  (mod: string) => /^not-(hover|focus|active|visited|checked|disabled|enabled|required|optional|valid|invalid|in-range|out-of-range|placeholder-shown|autofill|read-only|indeterminate|default|empty|target|root|scope|where|is|not|has|dir|lang|all|any|matches|current|past|future|playing|paused|seeking|buffering|muted|volume-locked|picture-in-picture|fullscreen|popover-open|modal|open|closed|selected|checked|pressed|expanded|grabbed|busy|live|atomic|relevant|invalid|current|past|future|playing|paused|seeking|buffering|muted|volume-locked|picture-in-picture|fullscreen|popover-open|modal|open|closed|selected|checked|pressed|expanded|grabbed|busy|live|atomic|relevant|invalid)$/.test(mod),
  ({ selector, mod }) => {
    const m = /^not-(.+)$/.exec(mod.type);
    return m ? `${selector}:not(:${m[1]})` : selector;
  },
  undefined,
  { order: 200 }
); 