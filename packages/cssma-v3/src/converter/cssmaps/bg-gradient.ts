import type { ParsedClassToken } from "../../parser/utils";
export const bgGradient = (utility: ParsedClassToken) => ({ backgroundImage: utility.arbitrary ? utility.arbitraryValue : utility.value }); 