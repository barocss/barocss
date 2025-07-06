import { visit } from 'unist-util-visit';
import type { Root } from 'hast';
import type { TaildownConfig } from './types';

const APPLY_REGEX = /^(?<variant>\w+:)?apply$/;

export function remarkTailwindApply(config: TaildownConfig) {
  return (tree: Root) => {
    visit(tree, 'element', (node) => {
      const { properties } = node;
      if (!properties) return;

      const finalClasses = new Set<string>((properties.className as string[]) || []);

      for (const key in properties) {
        const match = key.match(APPLY_REGEX);
        if (match) {
          const variant = match.groups?.variant ? match.groups.variant.slice(0, -1) : undefined;
          const groupName = properties[key] as string;
          const component = config.components?.[groupName];

          if (component?.base) {
            component.base.split(' ').forEach(cls => {
              finalClasses.add(variant ? `${variant}:${cls}` : cls);
            });
          }
          
          delete properties[key];
        }
      }

      if (finalClasses.size > 0) {
        properties.className = Array.from(finalClasses);
      }
    });
  };
}