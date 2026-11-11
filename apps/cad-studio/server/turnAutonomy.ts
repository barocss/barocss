type Autonomy = 1 | 2 | 3 | 4;

const englishApproval = [
  /^(?:please\s+)?(?:do not|don't|never)\s+(?:apply|edit|modify|change)\b[^"“”]{0,100}\s+(?:until|before)\s+(?:i|we)\s+approve(?:\s+(?:it|them|the\s+(?:change|changes|proposal)))?$/i,
  /^(?:please\s+)?(?:do not|don't|never)\s+(?:apply|edit|modify|change)\b[^"“”]{0,100}\s+(?:without|before)\s+(?:my|our)\s+approval$/i,
  /^(?:please\s+)?(?:wait for|require|ask for)\s+(?:my|our)\s+approval\s+before\s+(?:applying|editing|modifying|changing)\b[^"“”]{0,60}$/i,
];
const koreanApproval = /^(?:(?:(?:내가|제가)\s*)?승인(?:하기)?\s*전(?:까지|에는|에)?|(?:내가|제가)\s*승인할\s*때까지|(?:(?:내|제)\s*)?승인\s*없이(?:는)?)/u;
const koreanProhibition = /^[^"'“”]{0,60}(?:적용|편집|수정|변경)\s*(?:금지|하지\s*(?:마(?:세요|십시오|요)?|말아(?:\s*(?:줘|주세요))?))$/u;

function isApprovalInstruction(clause: string): boolean {
  const text = clause.trim();
  const approval = koreanApproval.exec(text);
  return approval ? koreanProhibition.test(text.slice(approval[0].length)) : englishApproval.some(rule => rule.test(text));
}

/** Recognize explicit approval instructions in the current person's own text. */
function approvalRequested(text: string): boolean {
  const lines = text.normalize('NFKC').replace(/[‘’]/g, "'").replace(/```[\s\S]*?(?:```|$)/g, '').split(/\r?\n/);
  return lines.some(line => !/^\s*>/.test(line) && line.split(/[.!?。！？]+(?=\s|$)/u).some(isApprovalInstruction));
}

export function turnAutonomy(preference: unknown, text: string): { level: Autonomy; approvalRequested: boolean } {
  const level = Number(preference);
  const approval = approvalRequested(text);
  return { level: approval ? 1 : level === 1 || level === 3 || level === 4 ? level : 2, approvalRequested: approval };
}
