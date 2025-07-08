import { ParsedClassToken } from "../../parser/utils";

const bgRepeatMap = {
  repeat: 'repeat',
  'repeat-x': 'repeat-x',
  'repeat-y': 'repeat-y',
  'no-repeat': 'no-repeat',
  space: 'space',
  round: 'round',
} as const;

export function bgRepeat(token: ParsedClassToken) {
  if (!token || token.prefix !== 'bg-repeat') return undefined;
  
  switch (token.value) {
    case '':
    case undefined:
    case 'repeat':
      return { backgroundRepeat: bgRepeatMap.repeat };
    case 'x':
    case 'repeat-x':
      return { backgroundRepeat: bgRepeatMap['repeat-x'] };
    case 'y':
    case 'repeat-y':
      return { backgroundRepeat: bgRepeatMap['repeat-y'] };
    case 'no':
    case 'no-repeat':
      return { backgroundRepeat: bgRepeatMap['no-repeat'] };
    case 'space':
      return { backgroundRepeat: bgRepeatMap.space };
    case 'round':
      return { backgroundRepeat: bgRepeatMap.round };
    default:
      return undefined;
  }
} 