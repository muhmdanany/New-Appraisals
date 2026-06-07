import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useGenerateJobDescription } from "@workspace/api-client-react";
import type { TFn } from "@/lib/org-chart/types";

interface JobDescriptionFieldProps {
  orgId: number | null | undefined;
  title: string;
  departmentName: string | null | undefined;
  value: string;
  onChange: (value: string) => void;
  t: TFn;
}

function formatDraft(draft: {
  summary?: string;
  responsibilities?: string[];
  qualifications?: string[];
}, t: TFn): string {
  const parts: string[] = [];
  if (draft.summary) parts.push(draft.summary.trim());
  if (draft.responsibilities && draft.responsibilities.length > 0) {
    parts.push(
      `${t("orgChart.jobDescriptionAi.responsibilitiesHeading")}\n` +
        draft.responsibilities.map((r) => `• ${r}`).join("\n"),
    );
  }
  if (draft.qualifications && draft.qualifications.length > 0) {
    parts.push(
      `${t("orgChart.jobDescriptionAi.qualificationsHeading")}\n` +
        draft.qualifications.map((q) => `• ${q}`).join("\n"),
    );
  }
  return parts.join("\n\n");
}

export function JobDescriptionField({
  orgId,
  title,
  departmentName,
  value,
  onChange,
  t,
}: JobDescriptionFieldProps) {
  const { i18n } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const generate = useGenerateJobDescription();

  const handleGenerate = () => {
    if (!orgId || !title.trim() || generate.isPending) return;
    setError(null);
    const lang = i18n.language?.toLowerCase().startsWith("ar") ? "ar" : "en";
    generate.mutate(
      {
        orgId,
        data: {
          title: title.trim(),
          department: departmentName ?? null,
          lang,
        },
      },
      {
        onSuccess: (draft) => {
          onChange(formatDraft(draft, t));
        },
        onError: (err: unknown) => {
          const msg =
            err && typeof err === "object" && "message" in err
              ? String((err as { message: unknown }).message)
              : t("orgChart.jobDescriptionAi.genericError");
          setError(msg);
        },
      },
    );
  };

  const disabled = !title.trim() || !orgId || generate.isPending;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{t("orgChart.jobDescriptionAi.label")}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={disabled}
          data-testid="button-generate-job-description"
          title={!title.trim() ? t("orgChart.jobDescriptionAi.titleRequired") : undefined}
        >
          <Sparkles className="h-4 w-4 me-1" />
          {generate.isPending
            ? t("orgChart.jobDescriptionAi.generating")
            : t("orgChart.jobDescriptionAi.generate")}
        </Button>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("orgChart.jobDescriptionAi.placeholder")}
        rows={8}
        data-testid="textarea-job-description"
      />
      {error && (
        <p className="text-xs text-destructive" data-testid="text-job-description-error">
          {error}
        </p>
      )}
    </div>
  );
}
