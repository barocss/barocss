import type { ParsedClassToken } from "../../parser/utils";

// table (table, table-row, table-cell 등)
// "table-auto" → { prefix: "table", value: "auto" } → { tableLayout: "auto" }
export const table = (utility: ParsedClassToken) => ({ tableLayout: utility.value + (utility.important ? ' !important' : '') });
export const tableRow = () => ({ display: "table-row" });
export const tableCell = () => ({ display: "table-cell" }); 