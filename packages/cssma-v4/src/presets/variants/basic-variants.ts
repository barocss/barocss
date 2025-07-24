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
staticModifier('before', ['&::before'], { source: 'pseudo' });
staticModifier('after', ['&::after'], { source: 'pseudo' });
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