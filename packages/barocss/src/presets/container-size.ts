import { decl } from '../core/ast';
import { registerUtility } from '../core/registry';

const namedSizeContainer = /^@container-size\/([A-Za-z_][A-Za-z0-9_-]*)$/;
const namedInlineContainer = /^@container\/([A-Za-z_][A-Za-z0-9_-]*)$/;

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

// Keep the registry name distinct from the @container variant token. Otherwise
// the parser can read @container:utility as utility:variant.
registerUtility({
  name: '@container-inline-marker',
  match: (className) => className === '@container' || namedInlineContainer.test(className),
  handler: (_value, _ctx, token) => {
    const className = token.value ? `${token.prefix}-${token.value}` : token.prefix;
    const name = namedInlineContainer.exec(className)?.[1];
    return [
      decl('container-type', 'inline-size'),
      ...(name ? [decl('container-name', name)] : []),
    ];
  },
  category: 'layout',
});
