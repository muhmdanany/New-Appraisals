import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListWhatsNewEntries,
  useMarkWhatsNewSeen,
  getListWhatsNewEntriesQueryKey,
  getGetWhatsNewUnreadCountQueryKey,
  type WhatsNewEntry,
} from "@workspace/api-client-react";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/markdown";

function categoryClass(category: string): string {
  switch (category) {
    case "new":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "improvement":
      return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300";
    case "fix":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    case "security":
      return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatDate(date: string, lang: string): string {
  try {
    return new Date(date + "T00:00:00").toLocaleDateString(lang === "ar" ? "ar" : undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return date;
  }
}

export default function WhatsNewPage() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const lang = i18n.language === "ar" ? "ar" : "en";

  const { data: entries, isLoading } = useListWhatsNewEntries(
    { lang },
    { query: { queryKey: getListWhatsNewEntriesQueryKey({ lang }) } },
  );

  const markSeen = useMarkWhatsNewSeen({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWhatsNewUnreadCountQueryKey() });
      },
    },
  });

  // Mark all entries as seen on first visit. Fire-and-forget; the badge
  // clears as soon as the unread count refetches.
  useEffect(() => {
    markSeen.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items: WhatsNewEntry[] = useMemo(() => entries ?? [], [entries]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-whats-new-title">
              {t("whatsNew.title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("whatsNew.subtitle")}</p>
          </div>
        </div>

        {isLoading && (
          <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
            {t("common.loading")}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
            {t("whatsNew.empty")}
          </div>
        )}

        <ol className="space-y-6">
          {items.map((entry) => (
            <li
              key={entry.slug}
              className="rounded-lg border border-border bg-card p-5 shadow-sm"
              data-testid={`whats-new-entry-${entry.slug}`}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className={`${categoryClass(entry.category)} border-transparent`}>
                  {t(`whatsNew.category.${entry.category}`, { defaultValue: entry.category })}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatDate(entry.date, lang)}</span>
              </div>
              {entry.image && (
                <img
                  src={entry.image}
                  alt={entry.title}
                  className="mb-4 w-full rounded-md border border-border"
                />
              )}
              <Markdown source={entry.body} />
              {entry.tryLink && (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => entry.tryLink && setLocation(entry.tryLink)}
                    data-testid={`button-try-${entry.slug}`}
                  >
                    {t("whatsNew.tryIt")}
                    <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
