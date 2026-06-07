import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, GitMerge } from "lucide-react";

interface Props {
  details: Record<string, unknown> | null | undefined;
  formatValue?: (v: unknown) => string;
  compact?: boolean;
}

const defaultFormatValue = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "∅";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

export function MergedFromImportDetails({
  details,
  formatValue = defaultFormatValue,
  compact = false,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const d = details ?? {};
  const source = typeof d.source === "string" ? (d.source as string) : "";
  const sourceName = typeof d.sourceName === "string" ? (d.sourceName as string) : "";
  const sourceEmail = typeof d.sourceEmail === "string" ? (d.sourceEmail as string) : "";
  const before =
    d.before && typeof d.before === "object"
      ? (d.before as Record<string, unknown>)
      : {};
  const after =
    d.after && typeof d.after === "object"
      ? (d.after as Record<string, unknown>)
      : {};
  const fieldsApplied = Array.isArray(d.fieldsApplied)
    ? (d.fieldsApplied as unknown[]).map(String)
    : Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  const titleKey =
    source === "entra_import"
      ? "audit.mergedFromImport.titleEntra"
      : source === "bulk_import"
        ? "audit.mergedFromImport.titleCsv"
        : "audit.mergedFromImport.title";

  const fieldLabel = (k: string): string => {
    const translated = t(`employees.fields.${k}` as never, { defaultValue: "" }) as string;
    return translated || k;
  };

  return (
    <div className="space-y-1.5" data-testid="merged-from-import-details">
      <div
        className={`flex items-center gap-1.5 font-medium text-foreground ${
          compact ? "text-sm" : "text-sm"
        }`}
      >
        <GitMerge className="h-3.5 w-3.5 text-indigo-600" />
        <span>{t(titleKey)}</span>
      </div>
      {(sourceName || sourceEmail) && !compact && (
        <div className="text-xs text-muted-foreground">
          {sourceName}
          {sourceName && sourceEmail ? " · " : ""}
          {sourceEmail}
        </div>
      )}
      <div className="text-xs text-muted-foreground">
        {t("audit.mergedFromImport.fieldsCount", { count: fieldsApplied.length })}
      </div>
      {fieldsApplied.length > 0 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
            data-testid="button-toggle-merge-diff"
            aria-expanded={open}
          >
            <ChevronDown
              className={`h-3 w-3 transition-transform ${open ? "" : "-rotate-90"}`}
            />
            {open ? t("audit.mergedFromImport.hideDiff") : t("audit.mergedFromImport.showDiff")}
          </button>
          {open && (
            <div className="flex flex-col gap-0.5 mt-1" data-testid="merge-diff-list">
              {fieldsApplied.map((k) => {
                const from = before[k];
                const to = after[k];
                return (
                  <div key={k} className="flex items-center gap-1.5 text-xs">
                    <span className="font-medium text-muted-foreground">{fieldLabel(k)}:</span>
                    <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 line-through max-w-[180px] truncate">
                      {formatValue(from)}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 max-w-[180px] truncate">
                      {formatValue(to)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
