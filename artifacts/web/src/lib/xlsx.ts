import * as XLSX from "xlsx";

/**
 * Parse an Excel/CSV file into an array of row objects.
 * Column headers become object keys.
 */
export async function parseSpreadsheet(file: File): Promise<Record<string, string>[]> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
    raw: false,
  });
  return rows;
}

/**
 * Pick a value from a row by trying multiple possible header names (Arabic + English aliases).
 */
export function pick(row: Record<string, string>, ...aliases: string[]): string {
  for (const alias of aliases) {
    const key = Object.keys(row).find(
      (k) => k.trim().toLowerCase() === alias.trim().toLowerCase()
    );
    if (key && row[key] != null) return String(row[key]).trim();
  }
  return "";
}

/**
 * Map Arabic role names to system enum values.
 */
const ROLE_MAP: Record<string, string> = {
  "موظف": "EMPLOYEE",
  "مدير مباشر": "FIRST_LEVEL_MANAGER",
  "مدير أول": "FIRST_LEVEL_MANAGER",
  "مدير": "FIRST_LEVEL_MANAGER",
  "مدير أعلى": "SECOND_LEVEL_MANAGER",
  "مدير ثاني": "SECOND_LEVEL_MANAGER",
  "مدير إدارة": "SECOND_LEVEL_MANAGER",
  "مدير نظام": "ADMIN",
  "admin": "ADMIN",
  "hr": "HR_MANAGER",
  "مدير موارد بشرية": "HR_MANAGER",
  "employee": "EMPLOYEE",
  "first_level_manager": "FIRST_LEVEL_MANAGER",
  "second_level_manager": "SECOND_LEVEL_MANAGER",
};

export function mapRole(value: string): string {
  const v = value.trim().toLowerCase();
  return ROLE_MAP[v] ?? "EMPLOYEE";
}

/**
 * Export rows to an Excel file and trigger download.
 */
export function exportToSpreadsheet(filename: string, rows: Record<string, any>[]) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  // RTL sheet
  if (!ws["!cols"]) ws["!cols"] = [];
  ws["!cols"].push({ wch: 20 });
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename);
}

/**
 * Generate and download a template Excel file for employee import.
 */
export function downloadImportTemplate() {
  const template = [
    {
      "الرقم الوظيفي": "E-001",
      "الاسم": "أحمد محمد",
      "البريد الإلكتروني": "ahmed@company.com",
      "الدور": "مدير أعلى",
      "رقم المدير": "",
    },
    {
      "الرقم الوظيفي": "E-002",
      "الاسم": "نورة سعيد",
      "البريد الإلكتروني": "noura@company.com",
      "الدور": "مدير مباشر",
      "رقم المدير": "E-001",
    },
    {
      "الرقم الوظيفي": "E-003",
      "الاسم": "خالد علي",
      "البريد الإلكتروني": "khaled@company.com",
      "الدور": "موظف",
      "رقم المدير": "E-002",
    },
  ];
  exportToSpreadsheet("نموذج_استيراد_الموظفين.xlsx", template);
}
