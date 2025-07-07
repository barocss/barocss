import type { ParsedClassToken } from '../../parser/types';

export function bgRepeat(token: ParsedClassToken) {
  if (!token || token.prefix !== 'bg-repeat') return undefined;
  switch (token.value) {
    case '':
    case undefined:
    case 'repeat':
      return { backgroundRepeat: 'repeat' };
    case 'x':
      return { backgroundRepeat: 'repeat-x' };
    case 'y':
      return { backgroundRepeat: 'repeat-y' };
    case 'no':
    case 'no-repeat':
      return { backgroundRepeat: 'no-repeat' };
    default:
      return undefined;
  }
} 