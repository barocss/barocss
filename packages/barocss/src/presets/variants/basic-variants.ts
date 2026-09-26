import { staticModifier } from "../../core/registry";
import { AstNode, atRule, atRoot, decl, property } from "../../core/ast";

// Import separated variant modules
import "./pseudo-classes";
import "./form-states";
import "./structural-selectors";
import "./media-features";
import "./attribute-selectors";

// --- Pseudo-elements (cross-browser) ---
// Like Tailwind, before:/after: create the pseudo-element: `content` defaults to
// var(--baro-content) (initial ""), which content-* utilities set.
// A content-* utility already sets `content`, so the default is skipped then
// (Tailwind prepends it and lets the utility override it: same result).
const withPseudoContent = (ast: AstNode[]): AstNode[] => [
  atRoot([property("--baro-content", '""')]),
  ...ast,
  ...(ast.some((n) => n.type === "decl" && n.prop === "content") ? [] : [decl("content", "var(--baro-content)")]),
];
staticModifier('before', ['&::before'], { source: 'pseudo', astHandler: withPseudoContent });
staticModifier('after', ['&::after'], { source: 'pseudo', astHandler: withPseudoContent });
// #335: the selectors Tailwind 4.3.3 emits. Each vendor pseudo-element is its own rule in a browser that
// does not know it, and the legacy ones (::-moz-selection, :-ms-input-placeholder, ...) are no longer needed.
staticModifier('placeholder', ['&::placeholder'], { source: 'pseudo' });
staticModifier('selection', ['& *::selection', '&::selection'], { source: 'pseudo' });
staticModifier('file', ['&::file-selector-button'], { source: 'pseudo' });
staticModifier('marker', [
  '& *::marker',
  '&::marker',
  '& *::-webkit-details-marker',
  '&::-webkit-details-marker',
], { source: 'pseudo' });
staticModifier('details-content', ['&::details-content'], { source: 'pseudo' });
staticModifier('first-line', ['&::first-line'], { source: 'pseudo' });
staticModifier('first-letter', ['&::first-letter'], { source: 'pseudo' });
staticModifier('backdrop', ['&::backdrop'], { source: 'pseudo' });

// --- starting: variant (maps to @starting-style) ---
staticModifier('starting', ['&'], {
  wrap: () => [atRule('starting-style', '', [], 'starting')],
  source: 'starting'
}); 