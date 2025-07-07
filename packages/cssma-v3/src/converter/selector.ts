import type { SelectorNode } from './css';
import type { CssmaContext } from '../theme-types';

// modifier prefix 제거 함수
function stripModifierPrefix(className: string): string {
  // group-hover:bg-green → bg-green, peer-focus:underline- → underline, dark:text-white → text-white 등
  return className.replace(/^(?:[\w-]+:)+/, '');
}

export function selectorTreeToCssSelector(
  selectorTree: SelectorNode[],
  context: CssmaContext
): string {
  let media = '';
  let parts: string[] = [];
  let classPart = '';
  let pseudoPart = '';
  let placeholder = false;

  for (let i = 0; i < selectorTree.length; i++) {
    const node = selectorTree[i];
    if (node.type === 'media') {
      media = node.value;
    } else if (node.type === 'theme') {
      parts.push(node.value);
    } else if (node.type === 'group' || node.type === 'peer' || node.type === 'attribute' || node.type === 'container' || node.type === 'logical') {
      parts.push(node.value);
    } else if (node.type === 'pseudo') {
      if (node.value === '::placeholder') placeholder = true;
      else pseudoPart += node.value;
    } else if (node.type === 'class') {
      classPart = stripModifierPrefix(node.value);
    }
  }

  let selector = [...parts, classPart].filter(Boolean).join(' ');
  if (pseudoPart) selector += pseudoPart;
  if (placeholder) selector += '::placeholder';
  if (media) selector = `${media} { ${selector} }`;
  return selector;
} 
} 