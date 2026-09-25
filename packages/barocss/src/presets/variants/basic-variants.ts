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
const withPseudoContent = (ast: AstNode[]): AstNode[] => [
  atRoot([property("--baro-content", '""')]),
  ...ast,
  decl("content", "var(--baro-content)"),
];
staticModifier('before', ['&::before'], { source: 'pseudo', astHandler: withPseudoContent });
staticModifier('after', ['&::after'], { source: 'pseudo', astHandler: withPseudoContent });
staticModifier('placeholder', [
  '&::placeholder',
  '&::-webkit-input-placeholder',
  '&::-moz-placeholder',
  '&:-ms-input-placeholder',
], { source: 'pseudo' });
staticModifier('selection', [
  '&::selection',
  '&::-moz-selection',
], { source: 'pseudo' });
staticModifier('file', [
  '&::file-selector-button',
  '&::-webkit-file-upload-button',
], { source: 'pseudo' });
staticModifier('marker', [
  '&::marker',
  '&::-webkit-details-marker',
  '&::-moz-list-bullet',
  '&::-moz-list-number',
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