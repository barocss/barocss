export interface Token {
  value: string;
  start: number;
  end: number;
}

/**
 * Tokenizes a class name string into an array of tokens
 * Only handles separation by ':' while respecting brackets and parentheses
 * 
 * Examples:
 * - 'hover:bg-red-500' → [{ value: 'hover' }, { value: 'bg-red-500' }]
 * - 'bg-[#ff0000]:hover' → [{ value: 'bg-[#ff0000]' }, { value: 'hover' }]
 * - 'text-[color:var(--foo)]' → [{ value: 'text-[color:var(--foo)]' }]
 * - '!bg-[red]' → [{ value: '!bg-[red]' }]
 */
export function tokenize(className: string): Token[] {
  const tokens: Token[] = [];
  let current = '';
  let start = 0;
  let inBracket = 0;
  let inParen = 0;
  
  for (let i = 0; i < className.length; i++) {
    const char = className[i];
    
    // Bracket tracking
    if (char === '[') inBracket++;
    if (char === ']') inBracket--;
    if (char === '(') inParen++;
    if (char === ')') inParen--;
    
    // Separator (only when not inside brackets or parentheses)
    if (char === ':' && inBracket === 0 && inParen === 0) {
      if (current) {
        tokens.push({
          value: current,
          start,
          end: i
        });
      }
      current = '';
      start = i + 1;
    } else {
      current += char;
    }
  }
  
  // Add remaining token
  if (current) {
    tokens.push({
      value: current,
      start,
      end: className.length
    });
  }
  
  return tokens;
} 