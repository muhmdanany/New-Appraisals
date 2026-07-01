/**
 * Client-side spreadsheet helpers built on SheetJS. Import parses a file entirely
 * in the browser (the raw file never leaves the device); only validated rows are
 * sent to the server. Export builds an RTL .xlsx and triggers a download.
 */
// SheetJS is loaded on demand (dynamic import) so it stays out of the initial
// page bundle and is only fetched when the user actually imports/exports.

export type SheetRow = Record<string, string>;

/** Parse the first sheet of an uploaded workbook into an array of string-keyed rows. */
export async function parseSpreadsheet(file: File): Promise<SheetRow[]> {
  const XLSX = await import("xlsx");
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = wb.Sheets[firstSheetName];
  if (!sheet) return [];
  // raw:false → formatted strings; defval:"" → keep empty cells as "".
  return XLSX.utils.sheet_to_json<SheetRow>(sheet, { raw: false, defval: "" });
}

/** Build an RTL .xlsx from rows of {column header → value} and download it. */
export async function exportToSpreadsheet(
  filename: string,
  sheetName: string,
  rows: Record<string, string | number>[],
): Promise<void> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  // Render the sheet right-to-left to match the Arabic UI.
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

/** Split a comma/، separated cell into trimmed, non-empty values. */
export function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,،]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

/** First non-empty value among a set of candidate header names (header aliases). */
export function pick(row: SheetRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}
