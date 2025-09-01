import { staticModifier } from "../../core/registry";
import { AstNode, atRule } from "../../core/ast";

// --- Media feature variants ---
staticModifier('prefers-contrast-more', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(prefers-contrast: more)', [], 'media')],
  source: 'media'
});
staticModifier('prefers-contrast-less', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(prefers-contrast: less)', [], 'media')],
  source: 'media'
});
staticModifier('forced-colors', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(forced-colors: active)', [], 'media')],
  source: 'media'
});
staticModifier('pointer-coarse', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(pointer: coarse)', [], 'media')],
  source: 'media'
});
staticModifier('pointer-fine', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(pointer: fine)', [], 'media')],
  source: 'media'
});
staticModifier('any-pointer-coarse', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(any-pointer: coarse)', [], 'media')],
  source: 'media'
});
staticModifier('any-pointer-fine', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(any-pointer: fine)', [], 'media')],
  source: 'media'
});

// Motion variants
staticModifier('motion-safe', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(prefers-reduced-motion: no-preference)', [], 'media')],
  source: 'media'
});
staticModifier('motion-reduce', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(prefers-reduced-motion: reduce)', [], 'media')],
  source: 'media'
});

// Print and orientation variants
staticModifier('print', ['&'], {
  order: 5,
  wrap: () => [atRule('media', 'print', [], 'media')],
  source: 'media'
});
staticModifier('portrait', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(orientation: portrait)', [], 'media')],
  source: 'media'
});
staticModifier('landscape', ['&'], {
  order: 5,
  wrap: () => [atRule('media', '(orientation: landscape)', [], 'media')],
  source: 'media'
}); 