import { atRoot, atRule, decl, property, styleRule } from '../core/ast';
import { functionalUtility } from '../core/registry';

const scrollbarColor = 'var(--tw-scrollbar-thumb) var(--tw-scrollbar-track)';
const fallbackSupports = '((-webkit-hyphens: none) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b))))';

function scrollbarProperties() {
  return atRoot([
    property('--tw-scrollbar-thumb', '#0000', '<color>'),
    property('--tw-scrollbar-track', '#0000', '<color>'),
    atRule('layer', 'properties', [
      atRule('supports', fallbackSupports, [
        styleRule('*, ::before, ::after, ::backdrop', [
          decl('--tw-scrollbar-thumb', '#0000'),
          decl('--tw-scrollbar-track', '#0000'),
        ]),
      ]),
    ]),
  ]);
}

for (const [name, variable] of [
  ['scrollbar-thumb', '--tw-scrollbar-thumb'],
  ['scrollbar-track', '--tw-scrollbar-track'],
] as const) {
  const declarations = (color: string) => [
    decl(variable, color),
    decl('scrollbar-color', scrollbarColor),
    scrollbarProperties(),
  ];

  functionalUtility({
    name,
    themeKeys: ['colors'],
    supportsOpacity: true,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handle: (value, _ctx, token, extra) => {
      if (!extra?.realThemeValue && !token.arbitrary && value !== 'transparent' && value !== 'current' && value !== 'inherit') return null;
      const color = value === 'current' ? 'currentcolor' : value;
      if (extra?.opacity) {
        const opacity = Number(extra.opacity);
        if (!Number.isFinite(opacity) || opacity < 0 || opacity > 100) return null;
        return declarations(`color-mix(in oklab, ${color} ${extra.opacity}%, transparent)`);
      }
      return declarations(color);
    },
    handleCustomProperty: (value) => declarations(`var(${value})`),
    category: 'interactivity',
  });
}
