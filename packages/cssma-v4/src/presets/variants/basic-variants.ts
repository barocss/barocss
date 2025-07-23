import { staticModifier } from "../../core/registry";
import { AstNode, atRule } from "../../core/ast";

// Import separated variant modules
import "./pseudo-classes";
import "./form-states";
import "./structural-selectors";
import "./media-features";
import "./group-peer";
import "./attribute-selectors";

// --- Pseudo-elements (cross-browser) ---
staticModifier('before', ['&::before'], { order: 100, source: 'pseudo' });
staticModifier('after', ['&::after'], { order: 100, source: 'pseudo' });
staticModifier('placeholder', [
  '&::placeholder',
  '&::-webkit-input-placeholder',
  '&::-moz-placeholder',
  '&:-ms-input-placeholder',
], { order: 100, source: 'pseudo' });
staticModifier('selection', [
  '&::selection',
  '&::-moz-selection',
], { order: 100, source: 'pseudo' });
staticModifier('file', [
  '&::file-selector-button',
  '&::-webkit-file-upload-button',
], { order: 100, source: 'pseudo' });
staticModifier('marker', [
  '&::marker',
  '&::-webkit-details-marker',
  '&::-moz-list-bullet',
  '&::-moz-list-number',
], { order: 100, source: 'pseudo' });
staticModifier('details-content', ['&::details-content'], { order: 100, source: 'pseudo' });
staticModifier('first-line', ['&::first-line'], { order: 100, source: 'pseudo' });
staticModifier('first-letter', ['&::first-letter'], { order: 100, source: 'pseudo' });
staticModifier('backdrop', ['&::backdrop'], { order: 100, source: 'pseudo' });

// --- starting: variant (maps to @starting-style) ---
staticModifier('starting', ['&'], {
  order: 15,
  wrap: () => [atRule('starting-style', '', [], 'starting')],
  source: 'starting'
}); 