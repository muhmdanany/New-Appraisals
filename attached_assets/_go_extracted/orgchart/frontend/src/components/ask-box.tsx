import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Sparkles, Send, Loader2, AlertTriangle, ArrowRight, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrg } from "@/lib/org-context";
import { useAskOrganization } from "@workspace/api-client-react";
import type { AskResponse, AskEmployee } from "@workspace/api-client-react";

interface AskBoxProps {
  /** Optional initial question to auto-run (e.g. from a ?ask= deep link). */
  initialQuestion?: string;
  /** Compact variant uses smaller padding (used on dashboard). */
  compact?: boolean;
}

export function AskBox({ initialQuestion, compact }: AskBoxProps) {
  const { t } = useTranslation();
  const { selectedOrgId } = useOrg();
  const [, setLocation] = useLocation();
  const [question, setQuestion] = useState(initialQuestion ?? "");
  const [result, setResult] = useState<AskResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ask = useAskOrganization();

  const submit = (q: string) => {
    if (!selectedOrgId) return;
    const trimmed = q.trim();
    if (!trimmed) return;
    ask.mutate(
      { orgId: selectedOrgId, data: { question: trimmed } },
      {
        onSuccess: (data) => setResult(data),
        onError: () => setResult(null),
      },
    );
  };

  // Auto-run an initial question (used when opening the dashboard with
  // ?ask=... from the command palette).
  useEffect(() => {
    if (initialQuestion && initialQuestion.trim() && selectedOrgId) {
      submit(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion, selectedOrgId]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(question);
  };

  const placeholder = t("ask.placeholder");
  const examples = [
    t("ask.example1"),
    t("ask.example2"),
    t("ask.example3"),
  ];

  return (
    <Card data-testid="ask-box">
      <CardContent className={compact ? "p-3" : "p-4"}>
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <Input
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            disabled={!selectedOrgId}
            data-testid="input-ask"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!selectedOrgId || !question.trim() || ask.isPending}
            data-testid="button-ask-submit"
          >
            {ask.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="ms-2 hidden sm:inline">{t("ask.submit")}</span>
          </Button>
        </form>

        {!result && !ask.isPending && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setQuestion(ex);
                  submit(ex);
                }}
                className="text-xs text-muted-foreground hover:text-foreground rounded-md border border-border bg-muted/40 px-2 py-1 transition-colors"
                data-testid={`button-ask-example-${ex.slice(0, 12)}`}
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {ask.isError && (
          <p
            className="mt-3 text-sm text-destructive flex items-center gap-2"
            data-testid="text-ask-error"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {t("ask.error")}
          </p>
        )}

        {result && <AskResultPanel result={result} onNavigate={(href) => setLocation(href)} />}
      </CardContent>
    </Card>
  );
}

function AskResultPanel({
  result,
  onNavigate,
}: {
  result: AskResponse;
  onNavigate: (href: string) => void;
}) {
  const { t } = useTranslation();

  if (result.refused) {
    return (
      <div
        className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3"
        data-testid="ask-result-refused"
      >
        <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">{t("ask.refusedTitle")}</span>
        </div>
        <p className="mt-1 text-sm text-foreground">{result.answer}</p>
      </div>
    );
  }

  if (result.intent === "unknown") {
    return (
      <p
        className="mt-3 text-sm text-muted-foreground"
        data-testid="ask-result-unknown"
      >
        {result.answer}
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2" data-testid="ask-result">
      <div className="flex items-start gap-2">
        <Badge variant="secondary" className="mt-0.5 text-xs">
          {t(`ask.intent.${result.intent}`, { defaultValue: result.intent })}
        </Badge>
        <p className="text-sm text-foreground" data-testid="text-ask-answer">
          {result.answer}
        </p>
      </div>

      {result.employees.length > 0 && (
        <ul className="rounded-md border border-border divide-y divide-border max-h-64 overflow-y-auto">
          {result.employees.slice(0, 25).map((e) => (
            <EmployeeRow key={e.id} e={e} onNavigate={onNavigate} />
          ))}
        </ul>
      )}

      {result.deepLink && (result.employees.length > 0 || result.count) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 -ms-2"
          onClick={() => onNavigate(result.deepLink!)}
          data-testid="button-ask-view-all"
        >
          {t("ask.viewAll")}
          <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
        </Button>
      )}
    </div>
  );
}

function EmployeeRow({
  e,
  onNavigate,
}: {
  e: AskEmployee;
  onNavigate: (href: string) => void;
}) {
  const full = `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim();
  return (
    <li
      role="button"
      tabIndex={0}
      onClick={() => onNavigate(`/employees?employeeId=${e.id}`)}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          onNavigate(`/employees?employeeId=${e.id}`);
        }
      }}
      className="flex items-center gap-2 p-2 hover:bg-muted/50 cursor-pointer transition-colors"
      data-testid={`ask-result-employee-${e.id}`}
    >
      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <User className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground truncate">{full || "—"}</p>
        <p className="text-xs text-muted-foreground truncate">
          {e.title}
          {e.departmentName ? ` • ${e.departmentName}` : ""}
        </p>
      </div>
    </li>
  );
}
