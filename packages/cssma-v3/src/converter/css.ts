// CSS 변환기: 파서 결과(ParsedClass[])를 Tailwind 스타일 CSS 셀렉터+스타일 쌍으로 변환
import type { CssmaContext } from '../theme-types';
import { selectorTreeToCssSelector } from './selector';
import { utilityToCss } from './cssMap';
import type { ParsedClass } from '../parser';

export type SelectorNode =
  | { type: 'media'; value: string }
  | { type: 'theme'; value: string }
  | { type: 'pseudo'; value: string }
  | { type: 'class'; value: string }
  | { type: 'group'; value: string }
  | { type: 'peer'; value: string }
  | { type: 'attribute'; value: string }
  | { type: 'container'; value: string }
  | { type: 'logical'; value: string };

export type CssRule = {
  className: string;
  selectorTree: SelectorNode[];
  selector: string;
  css: string;
};

// modifier → SelectorNode 변환 (간단 버전)
function modifiersToSelectorTree(modifiers: ParsedClass['modifiers'], className: string): SelectorNode[] {
  const tree: SelectorNode[] = [];
  for (const mod of modifiers) {
    if (mod.type === 'modifier') {
      // Responsive
      if (mod.raw === 'sm') tree.push({ type: 'media', value: '@media (min-width: 640px)' });
      else if (mod.raw === 'md') tree.push({ type: 'media', value: '@media (min-width: 768px)' });
      else if (mod.raw === 'lg') tree.push({ type: 'media', value: '@media (min-width: 1024px)' });
      else if (mod.raw === 'xl') tree.push({ type: 'media', value: '@media (min-width: 1280px)' });
      else if (mod.raw === '2xl') tree.push({ type: 'media', value: '@media (min-width: 1536px)' });
      // Media
      else if (mod.raw === 'motion-reduce') tree.push({ type: 'media', value: '@media (prefers-reduced-motion: reduce)' });
      else if (mod.raw === 'print') tree.push({ type: 'media', value: '@media print' });
      // Theme
      else if (mod.raw === 'dark') tree.push({ type: 'theme', value: '.dark' });
      else if (mod.raw === 'light') tree.push({ type: 'theme', value: '.light' });
      // Group
      else if (mod.raw.startsWith('group-')) {
        const pseudo = mod.raw.slice('group-'.length);
        tree.push({ type: 'group', value: `.group${pseudo ? ':' + pseudo : ''}` });
      }
      // Peer
      else if (mod.raw.startsWith('peer-')) {
        const pseudo = mod.raw.slice('peer-'.length);
        tree.push({ type: 'peer', value: `.peer${pseudo ? ':' + pseudo : ''}` });
      }
      // Pseudo
      else if ([
        'hover','focus','active','visited','checked','disabled','enabled','first','last','odd','even','open','required','optional','valid','invalid','focus-visible','focus-within','first-line','first-letter','last-of-type','only','only-of-type','empty','before','after','placeholder-shown','placeholder','autofill','read-only','selection','marker','backdrop','indeterminate','default','target','in-range','out-of-range','user-valid','user-invalid','not','has','in','rtl','ltr','nth','nth-of-type','nth-last-of-type','not-forced-colors','forced-colors','inverted-colors','pointer','any-pointer','portrait','landscape','noscript','details-content','file','starting','supports','aria','data','['].includes(mod.raw)
      ) tree.push({ type: 'pseudo', value: `:${mod.raw}` });
      // Attribute/Aria/Data
      else if (mod.raw.startsWith('aria-')) tree.push({ type: 'attribute', value: `[${mod.raw}]` });
      else if (mod.raw.startsWith('data-')) tree.push({ type: 'attribute', value: `[${mod.raw}]` });
      else if (mod.raw.startsWith('[')) tree.push({ type: 'attribute', value: mod.raw });
      // Container (Tailwind: .container)
      else if (mod.raw === '@container') tree.push({ type: 'container', value: '.container' });
      // Logical
      else if (['not', 'has', 'in'].includes(mod.raw)) tree.push({ type: 'logical', value: `:${mod.raw}` });
      // Fallback: pseudo
      else tree.push({ type: 'pseudo', value: `:${mod.raw}` });
    }
  }
  // className은 prefix 없이 utility만
  tree.push({ type: 'class', value: `.${className}` });
  return tree;
}

// className 생성 (modifier + utility)
function buildClassName(parsed: ParsedClass): string {
  const mods = parsed.modifiers.map(m => m.raw).join(':');
  if (parsed.utility) {
    return mods ? `${mods}:${parsed.utility.prefix}-${parsed.utility.value}` : `${parsed.utility.prefix}-${parsed.utility.value}`;
  }
  return mods;
}

function styleObjToString(obj: Record<string, string>): string {
  return Object.entries(obj).map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${v};`).join(' ');
}

export function cssConverter(
  parsed: ParsedClass[],
  context: CssmaContext
): CssRule[] {
  return parsed.filter(item => item.utility).map(item => {
    const className = buildClassName(item);
    const selectorTree = modifiersToSelectorTree(item.modifiers, className);
    const selector = selectorTreeToCssSelector(selectorTree, context);
    const { prefix } = item.utility!;
    const cssObj = utilityToCss[prefix] ? utilityToCss[prefix](item.utility!, context) : {};
    const css = Object.keys(cssObj).length ? styleObjToString(cssObj) : '';
    return {
      className,
      selectorTree,
      selector,
      css,
    };
  });
} 