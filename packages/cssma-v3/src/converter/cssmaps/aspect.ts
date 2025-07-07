import type { ParsedClassToken } from "../../parser/utils";

export const aspect = (utility: ParsedClassToken) => ({ aspectRatio: utility.arbitrary ? utility.arbitraryValue : utility.value }); 