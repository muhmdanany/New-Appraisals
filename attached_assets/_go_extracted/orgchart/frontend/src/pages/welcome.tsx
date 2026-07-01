import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Building,
  Plus,
  Mail,
  Copy,
  Check,
  LogOut,
  Search,
  ArrowLeft,
  Users,
  Send,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface DiscoverableOrg {
  id: number;
  name: string;
  description: string | null;
  industry: string | null;
  logoUrl: string | null;
  memberCount: number;
  isMember: boolean;
  hasPendingRequest: boolean;
}

interface MyJoinRequest {
  id: number;
  organizationId: number;
  organizationName: string;
  message: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  createdAt: string;
}

type Mode = "options" | "find";

export default function Welcome() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [supportEmail, setSupportEmail] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<Mode>("options");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [orgs, setOrgs] = useState<DiscoverableOrg[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [myRequests, setMyRequests] = useState<MyJoinRequest[]>([]);
  const [requestTarget, setRequestTarget] = useState<DiscoverableOrg | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/auth/providers`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.supportEmail) setSupportEmail(data.supportEmail);
      })
      .catch(() => {});
  }, []);

  const fetchMyRequests = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/join-requests/me`, {
        credentials: "include",
      });
      if (res.ok) setMyRequests(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchMyRequests();
  }, [fetchMyRequests]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const fetchOrgs = useCallback(async () => {
    setOrgsLoading(true);
    try {
      const url = new URL(
        `${API_BASE}/organizations-discoverable`,
        window.location.origin,
      );
      if (debouncedSearch) url.searchParams.set("q", debouncedSearch);
      const res = await fetch(url.pathname + url.search, {
        credentials: "include",
      });
      if (res.ok) setOrgs(await res.json());
    } catch {}
    setOrgsLoading(false);
  }, [debouncedSearch]);

  useEffect(() => {
    if (mode === "find") fetchOrgs();
  }, [mode, fetchOrgs]);

  const pendingRequests = useMemo(
    () => myRequests.filter((r) => r.status === "pending"),
    [myRequests],
  );

  const handleCopy = async () => {
    if (!supportEmail) return;
    try {
      await navigator.clipboard.writeText(supportEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const openRequestDialog = (org: DiscoverableOrg) => {
    setRequestTarget(org);
    setMessage("");
  };

  const submitRequest = async () => {
    if (!requestTarget) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/join-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          organizationId: requestTarget.id,
          message: message.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: t("welcome.findOrg.requestFailed"),
          description: err.message,
          variant: "destructive",
        });
        setSending(false);
        return;
      }
      toast({ title: t("welcome.findOrg.requestSuccess") });
      setRequestTarget(null);
      setMessage("");
      await Promise.all([fetchOrgs(), fetchMyRequests()]);
    } catch {
      toast({
        title: t("welcome.findOrg.requestFailed"),
        variant: "destructive",
      });
    }
    setSending(false);
  };

  const cancelRequest = async (req: MyJoinRequest) => {
    try {
      const res = await fetch(`${API_BASE}/join-requests/me/${req.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: t("welcome.findOrg.cancelled") });
        await Promise.all([fetchOrgs(), fetchMyRequests()]);
      }
    } catch {}
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h1
            className="text-3xl font-bold"
            data-testid="text-welcome-title"
          >
            {t("welcome.title", { name: user?.name || "" })}
          </h1>
          <p
            className="text-muted-foreground"
            data-testid="text-welcome-subtitle"
          >
            {t("welcome.subtitle")}
          </p>
          {user?.email && (
            <p
              className="text-sm text-muted-foreground"
              data-testid="text-welcome-email"
            >
              {user.email}
            </p>
          )}
        </div>

        {mode === "options" ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="hover-elevate" data-testid="card-create-org">
                <CardHeader>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle>{t("welcome.createOrgTitle")}</CardTitle>
                  <CardDescription>
                    {t("welcome.createOrgDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    onClick={() => setLocation("/create-org")}
                    data-testid="button-welcome-create-org"
                  >
                    {t("welcome.createOrgButton")}
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover-elevate" data-testid="card-find-org">
                <CardHeader>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Search className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle>{t("welcome.findOrgTitle")}</CardTitle>
                  <CardDescription>
                    {t("welcome.findOrgDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={() => setMode("find")}
                    data-testid="button-welcome-find-org"
                  >
                    {t("welcome.findOrgButton")}
                  </Button>
                </CardContent>
              </Card>

              <Card data-testid="card-wait-invite">
                <CardHeader>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle>{t("welcome.waitInviteTitle")}</CardTitle>
                  <CardDescription>
                    {t("welcome.waitInviteDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {supportEmail ? (
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                      <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <a
                        href={`mailto:${supportEmail}`}
                        className="text-sm font-medium truncate flex-1 hover:underline"
                        data-testid="link-support-email"
                      >
                        {supportEmail}
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={handleCopy}
                        data-testid="button-copy-support-email"
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <p
                      className="text-sm text-muted-foreground"
                      data-testid="text-no-support-email"
                    >
                      {t("welcome.noSupportEmail")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {pendingRequests.length > 0 && (
              <Card data-testid="card-my-pending-requests">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    {t("welcome.findOrg.myRequestsTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pendingRequests.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                      data-testid={`row-my-request-${r.id}`}
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {r.organizationName}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {t("welcome.findOrg.status.pending")}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelRequest(r)}
                        data-testid={`button-cancel-my-request-${r.id}`}
                      >
                        <X className="h-3.5 w-3.5 me-1" />
                        {t("welcome.findOrg.cancelRequest")}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card data-testid="card-find-org-search">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>{t("welcome.findOrg.title")}</CardTitle>
                  <CardDescription>
                    {t("welcome.findOrg.subtitle")}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode("options")}
                  data-testid="button-back-to-options"
                >
                  <ArrowLeft className="h-4 w-4 me-1" />
                  {t("welcome.findOrg.back")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("welcome.findOrg.searchPlaceholder")}
                  className="ps-9"
                  data-testid="input-org-search"
                />
              </div>

              {orgsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : orgs.length === 0 ? (
                <p
                  className="text-sm text-muted-foreground py-6 text-center"
                  data-testid="text-no-orgs"
                >
                  {t("welcome.findOrg.empty")}
                </p>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                  {orgs.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-3"
                      data-testid={`row-discoverable-org-${o.id}`}
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        <Building className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate">
                            {o.name}
                          </p>
                          {o.industry && (
                            <Badge variant="outline" className="text-xs">
                              {o.industry}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Users className="h-3 w-3" />
                          {t("welcome.findOrg.memberCount", {
                            count: o.memberCount,
                          })}
                        </p>
                        {o.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {o.description}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {o.isMember ? (
                          <Badge variant="secondary">
                            {t("welcome.findOrg.alreadyMember")}
                          </Badge>
                        ) : o.hasPendingRequest ? (
                          <Badge variant="outline">
                            {t("welcome.findOrg.requestPending")}
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => openRequestDialog(o)}
                            data-testid={`button-request-join-${o.id}`}
                          >
                            <Send className="h-3.5 w-3.5 me-1" />
                            {t("welcome.findOrg.requestJoin")}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout()}
            data-testid="button-welcome-signout"
          >
            <LogOut className="h-4 w-4 me-2" />
            {t("welcome.signOut")}
          </Button>
        </div>
      </div>

      <Dialog
        open={!!requestTarget}
        onOpenChange={(open) => {
          if (!open) setRequestTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {requestTarget
                ? t("welcome.findOrg.requestDialogTitle", {
                    name: requestTarget.name,
                  })
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium">
                {t("welcome.findOrg.messageLabel")}
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("welcome.findOrg.messagePlaceholder")}
                rows={4}
                data-testid="input-request-message"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setRequestTarget(null)}
                disabled={sending}
              >
                {t("welcome.findOrg.cancel")}
              </Button>
              <Button
                onClick={submitRequest}
                disabled={sending}
                data-testid="button-submit-request"
              >
                <Send className="h-4 w-4 me-2" />
                {sending
                  ? t("welcome.findOrg.sending")
                  : t("welcome.findOrg.sendRequest")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
