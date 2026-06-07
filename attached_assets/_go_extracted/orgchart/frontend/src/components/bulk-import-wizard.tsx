import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import {
  getListEmployeesQueryKey,
  getListDepartmentsQueryKey,
  getGetOrgDashboardQueryKey,
  getGetOrgChartQueryKey,
  getGetRecentActivityQueryKey,
  getGetDepartmentStatsQueryKey,
  useDetectImportDuplicates,
  type BulkImportReport,
  type DuplicateDetectionResult,
  type ImportDecision,
} from "@workspace/api-client-react";
import {
  DuplicateResolver,
  type DuplicateCandidateInput,
} from "./duplicate-resolver";

interface Props {
  orgId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "upload" | "preview" | "duplicates" | "results";

const REQUIRED_COLS = ["firstName", "title", "email"];
const BUILTIN_COLS = [
  "firstName",
  "lastName",
  "title",
  "email",
  "department",
  "managerEmail",
  "phone",
  "location",
  "startDate",
  "bio",
  "displayOrder",
];

interface CustomFieldDef {
  id: number;
  label: string;
  fieldKey?: string | null;
  fieldType: string;
  appliesTo: string;
  isStandard: boolean;
}

function normalize(h: string) {
  return h.toLowerCase().replace(/\s+/g, "");
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

function isXlsxFile(f: File): boolean {
  if (/\.xlsx$/i.test(f.name)) return true;
  return (
    f.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    f.type === "application/vnd.ms-excel"
  );
}

async function parseXlsx(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, defval: "" });
  if (aoa.length === 0) return { headers: [], rows: [] };
  const headers = (aoa[0] as unknown[]).map((v) => String(v ?? "").trim());
  const rows = aoa.slice(1).map((r) => (r as unknown[]).map((v) => String(v ?? "").trim()));
  return { headers, rows };
}

export function BulkImportWizard({ orgId, open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [report, setReport] = useState<BulkImportReport | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  const [dupCandidates, setDupCandidates] = useState<DuplicateCandidateInput[]>([]);
  const [dupResults, setDupResults] = useState<DuplicateDetectionResult[]>([]);
  const detectMutation = useDetectImportDuplicates();

  const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

  useEffect(() => {
    if (!open || !orgId) return;
    fetch(`${apiBase}/organizations/${orgId}/fields`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list: CustomFieldDef[] = Array.isArray(data)
          ? data.filter((f: CustomFieldDef) => !f.isStandard && f.appliesTo === "person")
          : [];
        setCustomFields(list);
      })
      .catch(() => setCustomFields([]));
  }, [open, orgId, apiBase]);

  const knownCols = useMemo(() => {
    const cols = [...BUILTIN_COLS];
    const seen = new Set(BUILTIN_COLS.map(normalize));
    const headerNorms = new Set((parsed?.headers ?? []).map(normalize));
    for (const f of customFields) {
      const labelKey = normalize(f.label);
      const keyAlias = f.fieldKey ? normalize(f.fieldKey) : "";
      if (seen.has(labelKey) || (keyAlias && seen.has(keyAlias))) continue;
      // Prefer the alias actually present in the uploaded file so the
      // mapping row reads "← <header>" instead of showing "not mapped".
      const display =
        keyAlias && headerNorms.has(keyAlias) && !headerNorms.has(labelKey)
          ? f.fieldKey!
          : f.label;
      cols.push(display);
      seen.add(labelKey);
      if (keyAlias) seen.add(keyAlias);
    }
    return cols;
  }, [customFields, parsed]);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setParsed(null);
    setParseError(null);
    setSubmitError(null);
    setReport(null);
    setSubmitting(false);
    setUpdateExisting(false);
    setDupCandidates([]);
    setDupResults([]);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const headerMatches = useMemo(() => {
    if (!parsed) return null;
    const normalized = parsed.headers.map(normalize);
    return knownCols.map((col) => ({
      column: col,
      required: REQUIRED_COLS.includes(col),
      matchedHeader: parsed.headers[normalized.indexOf(normalize(col))] ?? null,
    }));
  }, [parsed, knownCols]);

  const missingRequired = useMemo(() => {
    if (!headerMatches) return [];
    return headerMatches.filter((m) => m.required && !m.matchedHeader).map((m) => m.column);
  }, [headerMatches]);

  const onFileSelected = async (f: File) => {
    setFile(f);
    setParseError(null);
    try {
      const result = isXlsxFile(f) ? await parseXlsx(f) : parseCsv(await f.text());
      if (result.headers.length === 0) {
        setParseError(t("bulkImport.emptyFile"));
        setParsed(null);
        return;
      }
      setParsed(result);
    } catch {
      setParseError(t("bulkImport.parseError"));
      setParsed(null);
    }
  };

  const goPreview = () => {
    if (!parsed || missingRequired.length > 0) return;
    setStep("preview");
  };

  // Build a lightweight candidate list from the parsed CSV that the
  // duplicate-detection endpoint can score against existing employees.
  const buildCandidates = (): DuplicateCandidateInput[] => {
    if (!parsed) return [];
    const norm = parsed.headers.map(normalize);
    const colOf = (name: string) => norm.indexOf(normalize(name));
    const cFirst = colOf("firstName");
    const cLast = colOf("lastName");
    const cEmail = colOf("email");
    const cPhone = colOf("phone");
    const cTitle = colOf("title");
    const cDept = colOf("department");
    const out: DuplicateCandidateInput[] = [];
    const seen = new Set<string>();
    for (const row of parsed.rows) {
      const email = (cEmail >= 0 ? row[cEmail] : "")?.trim().toLowerCase() ?? "";
      if (!email || seen.has(email)) continue;
      seen.add(email);
      out.push({
        key: email,
        firstName: cFirst >= 0 ? row[cFirst]?.trim() : "",
        lastName: cLast >= 0 ? row[cLast]?.trim() : "",
        email,
        phone: cPhone >= 0 ? row[cPhone]?.trim() : "",
        title: cTitle >= 0 ? row[cTitle]?.trim() : "",
        department: cDept >= 0 ? row[cDept]?.trim() : "",
      });
    }
    return out;
  };

  // Runs detection. When matches exist, advance to the resolver step;
  // otherwise commit the import directly with no decisions attached.
  const goToDuplicates = async () => {
    setSubmitError(null);
    const candidates = buildCandidates();
    if (candidates.length === 0) {
      await commitImport({});
      return;
    }
    setSubmitting(true);
    try {
      const res = await detectMutation.mutateAsync({ orgId, data: { candidates } });
      const conflicting = res.results.filter((r) => r.matches.length > 0);
      if (conflicting.length === 0) {
        setSubmitting(false);
        await commitImport({});
        return;
      }
      setDupCandidates(candidates);
      setDupResults(res.results);
      setStep("duplicates");
    } catch (e) {
      setSubmitError((e as Error)?.message || t("bulkImport.uploadFailed"));
    }
    setSubmitting(false);
  };

  const commitImport = async (decisions: Record<string, ImportDecision>) => {
    if (!file) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (updateExisting) fd.append("updateExisting", "true");
      if (Object.keys(decisions).length > 0) {
        fd.append("decisions", JSON.stringify(decisions));
      }
      const res = await fetch(`${apiBase}/organizations/${orgId}/employees/bulk-import`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.message || t("bulkImport.uploadFailed"));
        setSubmitting(false);
        return;
      }
      setReport(data as BulkImportReport);
      qc.invalidateQueries({ queryKey: getListEmployeesQueryKey(orgId) });
      qc.invalidateQueries({ queryKey: getListDepartmentsQueryKey(orgId) });
      qc.invalidateQueries({ queryKey: getGetOrgDashboardQueryKey(orgId) });
      qc.invalidateQueries({ queryKey: getGetOrgChartQueryKey(orgId) });
      qc.invalidateQueries({ queryKey: getGetRecentActivityQueryKey(orgId) });
      qc.invalidateQueries({ queryKey: getGetDepartmentStatsQueryKey(orgId) });
      setStep("results");
    } catch {
      setSubmitError(t("bulkImport.uploadFailed"));
    }
    setSubmitting(false);
  };

  const submit = goToDuplicates;

  const downloadTemplate = () => {
    window.open(`${apiBase}/organizations/${orgId}/employees/bulk-import/template`, "_blank");
  };

  const previewRows = parsed?.rows.slice(0, 10) ?? [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {t("bulkImport.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 my-3 text-xs">
          {(["upload", "preview", "duplicates", "results"] as Step[]).map((s, idx, arr) => {
            const order: Record<Step, number> = { upload: 0, preview: 1, duplicates: 2, results: 3 };
            const active = step === s;
            const done = order[step] > order[s];
            return (
              <div key={s} className="flex items-center gap-2">
                <span
                  className={`flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-semibold ${
                    active ? "bg-primary text-primary-foreground" : done ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {idx + 1}
                </span>
                <span className={active ? "font-medium" : "text-muted-foreground"}>
                  {t(`bulkImport.step.${s}`)}
                </span>
                {idx < arr.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground rtl:rotate-180" />}
              </div>
            );
          })}
        </div>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("bulkImport.subtitle")}</p>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                file ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const f = e.dataTransfer.files?.[0];
                if (f) onFileSelected(f);
              }}
            >
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="h-10 w-10 text-primary" />
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  <Button variant="ghost" size="sm" onClick={() => { setFile(null); setParsed(null); }}>
                    {t("common.cancel")}
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-3 cursor-pointer">
                  <Upload className="h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">{t("bulkImport.dragDrop")}</p>
                  <p className="text-xs text-muted-foreground">{t("bulkImport.csvOnly")}</p>
                  <input
                    type="file"
                    accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onFileSelected(f);
                    }}
                    data-testid="input-bulk-import-file"
                  />
                </label>
              )}
            </div>

            {parseError && (
              <div className="flex items-start gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-lg text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <p>{parseError}</p>
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium">{t("bulkImport.requiredColumns")}: firstName, title, email</p>
              <p className="text-xs text-muted-foreground">
                {t("bulkImport.optionalColumns")}: lastName, department, managerEmail, phone, location, startDate, bio, displayOrder
              </p>
              {customFields.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("bulkImport.customFieldColumns", "Custom fields")}: {customFields.map((f) => f.label).join(", ")}
                </p>
              )}
            </div>

            <label className="flex items-start gap-2 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
              <input
                type="checkbox"
                checked={updateExisting}
                onChange={(e) => setUpdateExisting(e.target.checked)}
                className="mt-0.5"
                data-testid="checkbox-update-existing"
              />
              <div className="flex-1">
                <p className="text-sm font-medium">{t("bulkImport.updateExistingTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("bulkImport.updateExistingHint")}</p>
              </div>
            </label>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={downloadTemplate} data-testid="button-download-template">
                <Download className="h-4 w-4 me-2" />
                {t("bulkImport.downloadTemplate")}
              </Button>
              <Button
                className="flex-1"
                onClick={goPreview}
                disabled={!parsed || missingRequired.length > 0}
                data-testid="button-go-preview"
              >
                {t("bulkImport.next")}
                <ArrowRight className="h-4 w-4 ms-2 rtl:rotate-180" />
              </Button>
            </div>
            {missingRequired.length > 0 && (
              <p className="text-xs text-destructive">
                {t("bulkImport.missingColumns")}: {missingRequired.join(", ")}
              </p>
            )}
          </div>
        )}

        {step === "preview" && parsed && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">{t("bulkImport.columnMapping")}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {headerMatches?.map((m) => (
                  <div
                    key={m.column}
                    className={`flex items-center justify-between rounded-md border px-2 py-1.5 ${
                      m.matchedHeader ? "border-border bg-muted/30" : m.required ? "border-destructive/40 bg-destructive/10" : "border-dashed border-border"
                    }`}
                  >
                    <span className="font-medium">
                      {m.column}
                      {m.required && <span className="text-destructive ms-1">*</span>}
                    </span>
                    <span className="text-muted-foreground">
                      {m.matchedHeader ? `← ${m.matchedHeader}` : t("bulkImport.notMapped")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">
                {t("bulkImport.previewTitle", { count: previewRows.length, total: parsed.rows.length })}
              </p>
              <div className="border rounded-lg overflow-x-auto max-h-72">
                <table className="text-xs w-full">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      {parsed.headers.map((h) => (
                        <th key={h} className="text-start px-2 py-1.5 font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-t">
                        {parsed.headers.map((_, ci) => (
                          <td key={ci} className="px-2 py-1.5 whitespace-nowrap">
                            {row[ci] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {submitError && (
              <div className="flex items-start gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-lg text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <p>{submitError}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("upload")} disabled={submitting}>
                <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" />
                {t("bulkImport.back")}
              </Button>
              <Button className="flex-1" onClick={submit} disabled={submitting} data-testid="button-confirm-import">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    {t("bulkImport.importing")}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 me-2" />
                    {t("bulkImport.import")}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "duplicates" && (
          <DuplicateResolver
            candidates={dupCandidates}
            results={dupResults}
            onBack={() => {
              setStep("preview");
              setSubmitError(null);
            }}
            onConfirm={(decisions) => commitImport(decisions)}
            submitting={submitting}
            submitError={submitError}
          />
        )}

        {step === "results" && report && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-900">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-800 dark:text-green-300">{t("bulkImport.complete")}</p>
                <p className="text-xs text-green-700 dark:text-green-400">
                  {t("bulkImport.summary", {
                    added: report.created.length,
                    updated: report.updated.length,
                    skipped: report.skipped.length,
                    failed: report.failed.length,
                  })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-2xl font-bold" data-testid="stat-created">{report.created.length}</p>
                <p className="text-xs text-muted-foreground">{t("bulkImport.added")}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-2xl font-bold" data-testid="stat-updated">{report.updated.length}</p>
                <p className="text-xs text-muted-foreground">{t("bulkImport.updatedCount")}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-2xl font-bold">{report.skipped.length}</p>
                <p className="text-xs text-muted-foreground">{t("bulkImport.skippedCount")}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-2xl font-bold">{report.failed.length}</p>
                <p className="text-xs text-muted-foreground">{t("bulkImport.failed")}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-2xl font-bold">{report.departmentsCreated}</p>
                <p className="text-xs text-muted-foreground">{t("bulkImport.deptsCreated")}</p>
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
              {t("bulkImport.rollbackHint")}
            </div>

            {(report.skipped.length > 0 || report.failed.length > 0) && (
              <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 rounded-lg p-3">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
                  {t("bulkImport.issues")}
                </p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {[...report.skipped, ...report.failed].map((r, i) => (
                    <p key={i} className="text-xs text-amber-700 dark:text-amber-400">
                      {t("bulkImport.row")} {r.row}
                      {r.email ? ` (${r.email})` : ""}: {r.reason}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={reset}>
                {t("bulkImport.importAnother")}
              </Button>
              <Button className="flex-1" onClick={() => handleClose(false)}>
                {t("bulkImport.close")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
