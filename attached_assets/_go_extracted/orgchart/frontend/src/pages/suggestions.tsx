import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useOrg } from "@/lib/org-context";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSuggestions,
  useDismissSuggestion,
  useRestoreSuggestion,
  useGetSuggestionsSummary,
  regenerateSuggestionsSummary,
  getGetSuggestionsSummaryQueryKey,
  getListSuggestionsQueryKey,
} from "@workspace/api-client-react";
import type { Suggestion, SuggestionsSummary } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/markdown";
import { useToast } from "@/hooks/use-toast";
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  Lightbulb,
  ChevronRight,
  RotateCcw,
  Sparkles,
  RefreshCw,
} from "lucide-react";

type Severity = "info" | "warning" | "critical";
type Filter = "all" | Severity;

const severityIcon = (s: string) => {
  switch (s) {
    case "critical":
      return AlertOctagon;
    case "warning":
      return AlertTriangle;
    default:
      return Info;
  }
};

const severityClasses = (s: string) => {
  switch (s) {
    case "critical":
      return "border-destructive/40 bg-destructive/5";
    case "warning":
      return "border-amber-500/40 bg-amber-500/5";
    default:
      return "border-blue-500/30 bg-blue-500/5";
  }
};

const severityBadgeClasses = (s: string) => {
  switch (s) {
    case "critical":
      return "border-destructive/50 text-destructive";
    case "warning":
      return "border-amber-500/50 text-amber-700 dark:text-amber-400";
    default:
      return "border-blue-500/50 text-blue-700 dark:text-blue-400";
  }
};

export default function SuggestionsPage() {
  const { selectedOrgId } = useOrg();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<Filter>("all");
  const [showDismissed, setShowDismissed] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, isError } = useListSuggestions(selectedOrgId!, {
    query: { enabled: !!selectedOrgId, queryKey: getListSuggestionsQueryKey(selectedOrgId!) },
  });

  const dismissMutation = useDismissSuggestion({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSuggestionsQueryKey(selectedOrgId!) });
        toast({
          title: t("suggestions.dismissedToast"),
          description: t("suggestions.dismissedToastDesc"),
        });
      },
    },
  });

  const restoreMutation = useRestoreSuggestion({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSuggestionsQueryKey(selectedOrgId!) });
        toast({ title: t("suggestions.restoredToast") });
      },
    },
  });

  const summaryQuery = useGetSuggestionsSummary(selectedOrgId!, {
    query: {
      enabled: !!selectedOrgId,
      queryKey: getGetSuggestionsSummaryQueryKey(selectedOrgId!),
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  });
  const [isRegenerating, setIsRegenerating] = useState(false);
  const handleRegenerate = async () => {
    if (!selectedOrgId || isRegenerating) return;
    setIsRegenerating(true);
    try {
      const fresh = await regenerateSuggestionsSummary(selectedOrgId);
      queryClient.setQueryData<SuggestionsSummary>(
        getGetSuggestionsSummaryQueryKey(selectedOrgId),
        fresh,
      );
      toast({ title: t("suggestions.aiSummary.regenerated") });
    } catch (err: unknown) {
      const status = (err as { status?: number } | null)?.status;
      toast({
        title:
          status === 429
            ? t("suggestions.aiSummary.rateLimited")
            : t("suggestions.aiSummary.regenerateFailed"),
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const filtered = useMemo(() => {
    const list: Suggestion[] = data?.suggestions ?? [];
    if (filter === "all") return list;
    return list.filter((s) => s.severity === filter);
  }, [data, filter]);

  const counts = useMemo(() => {
    const list: Suggestion[] = data?.suggestions ?? [];
    return {
      all: list.length,
      critical: list.filter((s) => s.severity === "critical").length,
      warning: list.filter((s) => s.severity === "warning").length,
      info: list.filter((s) => s.severity === "info").length,
    };
  }, [data]);

  if (!selectedOrgId) {
    return <div className="p-8 text-muted-foreground">{t("common.selectOrg")}</div>;
  }

  const filterButtons: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: t("suggestions.severityAll"), count: counts.all },
    { id: "critical", label: t("suggestions.severityCritical"), count: counts.critical },
    { id: "warning", label: t("suggestions.severityWarning"), count: counts.warning },
    { id: "info", label: t("suggestions.severityInfo"), count: counts.info },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1
              className="text-2xl font-bold text-foreground flex items-center gap-2"
              data-testid="text-page-title"
            >
              <Lightbulb className="h-6 w-6 text-amber-500" />
              {t("suggestions.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t("suggestions.subtitle")}</p>
            {data && (
              <p
                className="text-xs text-muted-foreground mt-2"
                data-testid="text-suggestions-summary"
              >
                {t("suggestions.summary", {
                  visible: data.visibleCount,
                  dismissed: data.dismissedCount,
                })}
              </p>
            )}
          </div>
        </div>

        <Card
          className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent"
          data-testid="card-ai-summary"
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2
                    className="text-base font-semibold text-foreground"
                    data-testid="text-ai-summary-title"
                  >
                    {t("suggestions.aiSummary.title")}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1 max-w-prose">
                    {t("suggestions.aiSummary.subtitle")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {summaryQuery.data?.generatedAt && (
                  <span
                    className="text-xs text-muted-foreground"
                    data-testid="text-ai-summary-generated-at"
                  >
                    {t("suggestions.aiSummary.generatedAt", {
                      when: new Date(summaryQuery.data.generatedAt).toLocaleString(),
                    })}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRegenerate}
                  disabled={isRegenerating || summaryQuery.isLoading}
                  data-testid="button-regenerate-summary"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 me-1 ${isRegenerating ? "animate-spin" : ""}`}
                  />
                  {isRegenerating
                    ? t("suggestions.aiSummary.regenerating")
                    : t("suggestions.aiSummary.regenerate")}
                </Button>
              </div>
            </div>
            <div className="mt-4">
              {summaryQuery.isLoading ? (
                <div className="space-y-2" data-testid="loader-ai-summary">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <p className="text-xs text-muted-foreground pt-2">
                    {t("suggestions.aiSummary.loading")}
                  </p>
                </div>
              ) : summaryQuery.isError ? (
                <p
                  className="text-sm text-destructive"
                  data-testid="text-ai-summary-error"
                >
                  {t("suggestions.aiSummary.error")}
                </p>
              ) : summaryQuery.data?.content ? (
                <div data-testid="text-ai-summary-content">
                  <Markdown source={summaryQuery.data.content} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("suggestions.aiSummary.empty")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t("suggestions.severityLabel")}
        >
          {filterButtons.map((btn) => (
            <Button
              key={btn.id}
              variant={filter === btn.id ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(btn.id)}
              data-testid={`button-filter-${btn.id}`}
            >
              {btn.label}
              <Badge variant="secondary" className="ms-2">
                {btn.count}
              </Badge>
            </Button>
          ))}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        )}

        {isError && (
          <Card>
            <CardContent className="p-6 text-sm text-destructive">
              {t("suggestions.loadFailed")}
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <Card>
            <CardContent
              className="p-8 text-center text-sm text-muted-foreground"
              data-testid="text-suggestions-empty"
            >
              {t("suggestions.empty")}
            </CardContent>
          </Card>
        )}

        <div className="space-y-3" data-testid="list-suggestions">
          {filtered.map((s) => {
            const Icon = severityIcon(s.severity);
            const ruleLabel = t(`suggestions.rules.${s.rule}`, { defaultValue: s.rule });
            return (
              <Card
                key={s.key}
                className={`border ${severityClasses(s.severity)}`}
                data-testid={`card-suggestion-${s.key}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <Icon
                        className={`h-5 w-5 ${
                          s.severity === "critical"
                            ? "text-destructive"
                            : s.severity === "warning"
                              ? "text-amber-600"
                              : "text-blue-600"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={severityBadgeClasses(s.severity)}>
                          {t(
                            `suggestions.severity${s.severity.charAt(0).toUpperCase() + s.severity.slice(1)}`,
                          )}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {ruleLabel}
                        </Badge>
                      </div>
                      <h3
                        className="text-sm font-semibold text-foreground mt-2"
                        data-testid={`text-suggestion-title-${s.key}`}
                      >
                        {s.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">{s.rationale}</p>
                      {s.affectedLabels && s.affectedLabels.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <span className="font-medium">{t("suggestions.affected")}:</span>{" "}
                          {s.affectedLabels.slice(0, 5).join(", ")}
                          {s.affectedLabels.length > 5 && ` (+${s.affectedLabels.length - 5})`}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {s.link && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => setLocation(s.link)}
                          data-testid={`button-take-action-${s.key}`}
                        >
                          {t("suggestions.takeAction")}
                          <ChevronRight className="h-3.5 w-3.5 ms-1 rtl:rotate-180" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={dismissMutation.isPending}
                        onClick={() =>
                          dismissMutation.mutate({ orgId: selectedOrgId, key: s.key })
                        }
                        data-testid={`button-dismiss-${s.key}`}
                      >
                        {t("suggestions.dismiss")}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {data && data.dismissed.length > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-foreground">
                {t("suggestions.dismissed")}
                <Badge variant="secondary" className="ms-2">
                  {data.dismissed.length}
                </Badge>
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDismissed((v) => !v)}
                data-testid="button-toggle-dismissed"
              >
                {showDismissed
                  ? t("suggestions.hideDismissed")
                  : t("suggestions.showDismissed")}
              </Button>
            </div>

            {showDismissed && (
              <div className="space-y-3 mt-4 opacity-75" data-testid="list-dismissed">
                {data.dismissed.map((s) => {
                  const Icon = severityIcon(s.severity);
                  const ruleLabel = t(`suggestions.rules.${s.rule}`, { defaultValue: s.rule });
                  return (
                    <Card
                      key={s.key}
                      className="border border-dashed"
                      data-testid={`card-dismissed-${s.key}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-muted-foreground">
                                {t(
                                  `suggestions.severity${s.severity.charAt(0).toUpperCase() + s.severity.slice(1)}`,
                                )}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {ruleLabel}
                              </Badge>
                            </div>
                            <h3
                              className="text-sm font-semibold text-foreground mt-2"
                              data-testid={`text-dismissed-title-${s.key}`}
                            >
                              {s.title}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">{s.rationale}</p>
                          </div>
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={restoreMutation.isPending}
                              onClick={() =>
                                restoreMutation.mutate({ orgId: selectedOrgId, key: s.key })
                              }
                              data-testid={`button-restore-${s.key}`}
                            >
                              <RotateCcw className="h-3.5 w-3.5 me-1" />
                              {t("suggestions.restore")}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {data && data.dismissedCount > 0 && (
          <p
            className="text-xs text-muted-foreground text-center"
            data-testid="text-dismissed-hint"
          >
            {t("suggestions.dismissedHint")}
          </p>
        )}
      </div>
    </div>
  );
}
