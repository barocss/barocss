// R10a (D86): a profile's side faces named by its sketch's own segment ids — `<prefix>.side[<tag>]` — when the sketch
// gives them (`sideTags`), so a vertex inserted or a segment deleted leaves every other side's name as it was; by
// position — `<prefix>.side<i>` — when it does not (documents written before keep their names, D16).
/** The authored segment i's side name under `prefix`: by its tag, or by position. */
export const sideName = (prefix, i, tags) => tags ? `${prefix}.side[${tags[i]}]` : `${prefix}.side${i}`;
/** A tag: letters, digits, `_` or `-`, 1 to 32 of them. */
export const SIDE_TAG = /^[A-Za-z0-9_-]{1,32}$/;
