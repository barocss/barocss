import { decl } from '../core/ast';
import { registerUtility } from '../core/registry';

const namedSizeContainer = /^@container-size\/([A-Za-z_][A-Za-z0-9_-]*)$/;

registerUtility({
  name: '@container',
  match: (className) => className === '@container-size' || namedSizeContainer.test(className),
  handler: (value) => {
    const name = value === 'size' ? undefined : /^size\/(.+)$/.exec(value)?.[1];
    return [
      decl('container-type', 'size'),
      ...(name ? [decl('container-name', name)] : []),
    ];
  },
  category: 'layout',
});
