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
staticModifier('before', ['&::before'], { order: 100 });
staticModifier('after', ['&::after'], { order: 100 });
staticModifier('placeholder', [
  '&::placeholder',
  '&::-webkit-input-placeholder',
  '&::-moz-placeholder',
  '&:-ms-input-placeholder',
], { order: 100 });
staticModifier('selection', [
  '&::selection',
  '&::-moz-selection',
], { order: 100 });
staticModifier('file', [
  '&::file-selector-button',
  '&::-webkit-file-upload-button',
], { order: 100 });
staticModifier('marker', [
  '&::marker',
  '&::-webkit-details-marker',
  '&::-moz-list-bullet',
  '&::-moz-list-number',
], { order: 100 });
staticModifier('details-content', ['&::details-content'], { order: 100 });
staticModifier('first-line', ['&::first-line'], { order: 100 });
staticModifier('first-letter', ['&::first-letter'], { order: 100 });
staticModifier('backdrop', ['&::backdrop'], { order: 100 });

// --- starting: variant (maps to @starting-style) ---
staticModifier('starting', ['&'], {
  order: 15,
  wrap: () => [atRule('starting-style', '', [])]
}); 