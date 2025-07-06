
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkAttr from 'remark-attr';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { remarkTailwindApply } from './remark-tailwind-apply';
import type { TaildownConfig } from './types';

export async function taildown(
  markdown: string,
  config: TaildownConfig
): Promise<string> {
  const file = await unified()
    .use(remarkParse) // 명시적으로 remarkParse를 사용합니다.
    .use(remarkAttr)
    .use(remarkRehype, {
      allowDangerousHtml: true,
      passThrough: ['data'],
    })
    .use(remarkTailwindApply, config)
    .use(rehypeStringify)
    .process(markdown);

  return String(file);
}
