import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Bell, CheckCheck, Settings as SettingsIcon } from "lucide-react";
import {
  useListNotifications,
  useGetNotificationUnreadCount,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  getListNotificationsQueryKey,
  getGetNotificationUnreadCountQueryKey,
} from "@workspace/api-client-react";
import type { Notification } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useOrg } from "@/lib/org-context";

interface Props {
  collapsed?: boolean;
  tooltipSide?: "left" | "right" | "top" | "bottom";
}

function localizedFromPayload(
  payload: Notification["payload"] | undefined,
  key: "titles" | "bodies",
  lang: string,
): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const bag = (payload as Record<string, unknown>)[key];
  if (!bag || typeof bag !== "object") return undefined;
  const map = bag as Record<string, unknown>;
  const pick = (k: string) => (typeof map[k] === "string" ? (map[k] as string) : undefined);
  return pick(lang) || pick(lang.split("-")[0]) || pick("en") || pick("ar");
}

function relativeTime(t: ReturnType<typeof useTranslation>["t"], iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return t("notifications.justNow");
  const minutes = Math.floor(diffSec / 60);
  if (minutes < 60) return t("notifications.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("notifications.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("notifications.daysAgo", { count: days });
}

export default function NotificationsBell({ collapsed, tooltipSide = "bottom" }: Props) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || "en";
  const { selectedOrgId } = useOrg();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const orgId = selectedOrgId ?? 0;

  const countQuery = useGetNotificationUnreadCount(orgId, {
    query: {
      queryKey: getGetNotificationUnreadCountQueryKey(orgId),
      enabled: !!selectedOrgId,
      // SSE delivers new notifications instantly; this is just a safety net
      // for when the stream is temporarily disconnected.
      refetchInterval: 5 * 60_000,
      refetchOnWindowFocus: true,
    },
  });

  const listQuery = useListNotifications(
    orgId,
    { limit: 20 },
    {
      query: {
        queryKey: getListNotificationsQueryKey(orgId, { limit: 20 }),
        enabled: !!selectedOrgId && open,
        refetchInterval: false,
      },
    },
  );

  const invalidate = () => {
    if (!selectedOrgId) return;
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey(orgId, { limit: 20 }) });
    queryClient.invalidateQueries({ queryKey: getGetNotificationUnreadCountQueryKey(orgId) });
  };

  // Open a Server-Sent Events stream so new notifications appear within ~1s
  // without waiting for the polling interval. The browser auto-reconnects on
  // network blips; we recreate the connection if the org changes.
  useEffect(() => {
    if (!selectedOrgId) return;
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const url = `${base}/api/organizations/${orgId}/notifications/stream`;
    const es = new EventSource(url, { withCredentials: true });
    const onPing = () => {
      queryClient.invalidateQueries({
        queryKey: getGetNotificationUnreadCountQueryKey(orgId),
      });
      queryClient.invalidateQueries({
        queryKey: getListNotificationsQueryKey(orgId, { limit: 20 }),
      });
    };
    es.addEventListener("notification", onPing);
    return () => {
      es.removeEventListener("notification", onPing);
      es.close();
    };
  }, [selectedOrgId, orgId, queryClient]);

  const markOne = useMarkNotificationRead({ mutation: { onSuccess: invalidate } });
  const markAll = useMarkAllNotificationsRead({ mutation: { onSuccess: invalidate } });

  const unreadCount = countQuery.data?.unreadCount ?? 0;
  const items: Notification[] = listQuery.data?.notifications ?? [];

  const handleClick = (n: Notification) => {
    if (!n.readAt) {
      markOne.mutate({ orgId, id: n.id });
    }
    setOpen(false);
    if (n.link) {
      setLocation(n.link);
    }
  };

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
      data-testid="button-notifications-bell"
      aria-label={t("notifications.open")}
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span
          className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-[18px] text-center"
          data-testid="badge-notifications-unread"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide}>{t("notifications.title")}</TooltipContent>
        </Tooltip>
      ) : (
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      )}
      <PopoverContent
        align="end"
        className="w-[360px] p-0"
        sideOffset={8}
        data-testid="popover-notifications"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{t("notifications.title")}</span>
            {unreadCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {t("notifications.unreadBadge", { count: unreadCount })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={unreadCount === 0 || markAll.isPending}
              onClick={() => markAll.mutate({ orgId })}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-3.5 w-3.5 me-1" />
              {t("notifications.markAllRead")}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setOpen(false);
                    setLocation("/settings?tab=notifications");
                  }}
                  data-testid="button-notification-settings"
                  aria-label={t("notifications.settings")}
                >
                  <SettingsIcon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("notifications.settings")}</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <ScrollArea className="max-h-[420px]">
          {listQuery.isLoading ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              {t("common.loading")}
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              {t("notifications.empty")}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const localizedTitle =
                  localizedFromPayload(n.payload, "titles", currentLang) ?? n.title;
                const localizedBody =
                  localizedFromPayload(n.payload, "bodies", currentLang) ?? n.body;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(n)}
                      className={`w-full text-start px-4 py-3 hover:bg-accent transition-colors ${
                        n.readAt ? "opacity-70" : "bg-accent/30"
                      }`}
                      data-testid={`notification-item-${n.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs font-medium text-primary">
                          {t(`notifications.types.${n.type}`, n.type)}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex-shrink-0">
                          {relativeTime(t, n.createdAt as unknown as string)}
                        </div>
                      </div>
                      <div className="text-sm font-medium text-foreground mt-0.5">
                        {localizedTitle}
                      </div>
                      {localizedBody && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {localizedBody}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
