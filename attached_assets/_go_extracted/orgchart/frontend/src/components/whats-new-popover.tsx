import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetWhatsNewUnreadCount,
  useMarkWhatsNewSeen,
  getGetWhatsNewUnreadCountQueryKey,
} from "@workspace/api-client-react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const STORAGE_KEY = "orgchart-whats-new-popover-shown";

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Once-per-day popover that nudges the user to visit the What's New page when
 * there are unread entries. The popover is suppressed entirely on the
 * /whats-new route so it does not appear right after the user navigates to it.
 */
export default function WhatsNewPopover() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);

  const { data } = useGetWhatsNewUnreadCount({
    query: {
      queryKey: getGetWhatsNewUnreadCountQueryKey(),
      enabled: isAuthenticated && location !== "/whats-new",
      refetchOnWindowFocus: false,
    },
  });

  const markSeen = useMarkWhatsNewSeen({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWhatsNewUnreadCountQueryKey() });
      },
    },
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    if (location === "/whats-new") return;
    if (!data || data.count <= 0) return;
    const last = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (last === todayStamp()) return;
    setOpen(true);
    localStorage.setItem(STORAGE_KEY, todayStamp());
  }, [data, isAuthenticated, location]);

  if (!open) return null;

  const dismiss = () => {
    setOpen(false);
    markSeen.mutate();
  };

  const goToPage = () => {
    setOpen(false);
    setLocation("/whats-new");
  };

  const count = data?.count ?? 0;

  return (
    <div
      className="fixed bottom-4 end-4 z-50 w-80 rounded-lg border border-border bg-card p-4 shadow-lg animate-in slide-in-from-bottom-4"
      role="dialog"
      aria-labelledby="whats-new-popover-title"
      data-testid="whats-new-popover"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 id="whats-new-popover-title" className="text-sm font-semibold text-foreground">
              {t("whatsNew.popoverTitle")}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mt-1 -me-1 text-muted-foreground"
              onClick={dismiss}
              aria-label={t("common.close")}
              data-testid="button-whats-new-popover-dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("whatsNew.popoverBody", { count })}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" onClick={goToPage} data-testid="button-whats-new-popover-open">
              {t("whatsNew.popoverCta")}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              {t("whatsNew.popoverDismiss")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
