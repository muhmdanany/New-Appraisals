import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PasswordPolicyChecklist, type PasswordPolicy } from "@/components/password-policy-checklist";
import { IpAllowlistPanel } from "@/components/ip-allowlist-panel";
import {
  ShieldCheck,
  ShieldOff,
  Copy,
  AlertCircle,
  CheckCircle2,
  Activity,
  Monitor,
  XCircle,
  LogOut,
  KeyRound,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface StatusResponse {
  enabled: boolean;
  enabledAt?: string;
}

interface EnableResponse {
  secret: string;
  otpauthUrl: string;
  backupCodes: string[];
}

interface SignInEvent {
  id: number;
  eventAt: string;
  ip: string | null;
  userAgent: string | null;
  success: boolean;
  twoFactorUsed: boolean;
  failureReason?: string | null;
  isCurrent: boolean;
  active: boolean;
  lastSeenAt?: string | null;
}

interface ActiveSession {
  id: number;
  createdAt: string;
  lastSeenAt?: string | null;
  ip: string | null;
  userAgent: string | null;
  isCurrent: boolean;
}

interface SessionsResponse {
  events: SignInEvent[];
  sessions: ActiveSession[];
}

function formatRelative(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}

function summarizeUserAgent(ua: string | null | undefined, fallback: string): string {
  if (!ua) return fallback;
  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "Safari";
  let os = "";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";
  return os ? `${browser} on ${os}` : browser;
}

function qrUrl(otpauth: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauth)}`;
}

export default function Security() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Enable flow
  const [enableData, setEnableData] = useState<EnableResponse | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [enableLoading, setEnableLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [enableError, setEnableError] = useState("");

  // Disable flow
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState("");

  // Sessions / activity
  const [sessionsData, setSessionsData] = useState<SessionsResponse | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokeLoading, setRevokeLoading] = useState(false);

  // Change password flow
  const [cpCurrent, setCpCurrent] = useState("");
  const [cpNew, setCpNew] = useState("");
  const [cpConfirm, setCpConfirm] = useState("");
  const [cpError, setCpError] = useState("");
  const [cpLoading, setCpLoading] = useState(false);
  const [policy, setPolicy] = useState<PasswordPolicy | null>(null);

  // Regenerate backup codes flow
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenPassword, setRegenPassword] = useState("");
  const [regenCode, setRegenCode] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState("");
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);

  const refreshSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/sessions`, { credentials: "include" });
      if (res.ok) setSessionsData(await res.json());
    } finally {
      setSessionsLoading(false);
    }
  };

  const failureLabel = (reason: string | null | undefined): string => {
    switch (reason) {
      case "invalid_password":
        return t("security.failureInvalidPassword");
      case "invalid_2fa":
        return t("security.failureInvalidTwoFactor");
      case "account_inactive":
        return t("security.failureAccountInactive");
      default:
        return t("security.failed");
    }
  };

  const revokeOthers = async () => {
    const others = (sessionsData?.sessions ?? []).filter((s) => !s.isCurrent);
    if (others.length === 0) {
      toast({ title: t("security.revokeOthersNone") });
      return;
    }
    if (!window.confirm(t("security.revokeOthersConfirm"))) return;
    setRevokeLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/sessions/revoke-others`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: t("security.revokeOthersToast") });
        void refreshSessions();
      }
    } finally {
      setRevokeLoading(false);
    }
  };

  const refresh = async () => {
    setStatusLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/2fa/status`, { credentials: "include" });
      if (res.ok) setStatus(await res.json());
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    void refreshSessions();
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/effective-password-policy`, {
          credentials: "include",
        });
        if (res.ok) setPolicy(await res.json());
      } catch {
        // Non-blocking: checklist simply won't render.
      }
    })();
  }, []);

  const startEnable = async () => {
    setEnableError("");
    setEnableLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/2fa/enable`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setEnableError(data.message || t("security.enableFailed"));
        return;
      }
      setEnableData(data);
      setConfirmCode("");
    } finally {
      setEnableLoading(false);
    }
  };

  const cancelEnable = () => {
    setEnableData(null);
    setConfirmCode("");
    setEnableError("");
  };

  const submitConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnableError("");
    setConfirmLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/2fa/confirm`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: confirmCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEnableError(data.message || t("security.confirmFailed"));
        return;
      }
      toast({ title: t("security.enabledToast") });
      setEnableData(null);
      setConfirmCode("");
      void refresh();
      void refreshUser();
    } finally {
      setConfirmLoading(false);
    }
  };

  const submitDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisableError("");
    setDisableLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/2fa/disable`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: disablePassword,
          code: disableCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDisableError(data.message || t("security.disableFailed"));
        return;
      }
      toast({ title: t("security.disabledToast") });
      setDisableOpen(false);
      setDisablePassword("");
      setDisableCode("");
      void refresh();
    } finally {
      setDisableLoading(false);
    }
  };

  const submitChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpError("");
    if (cpNew !== cpConfirm) {
      setCpError(t("changePassword.mismatch"));
      return;
    }
    setCpLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: cpCurrent, newPassword: cpNew }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCpError(data.message || t("changePassword.failed"));
        return;
      }
      setCpCurrent("");
      setCpNew("");
      setCpConfirm("");
      toast({ title: t("changePassword.successToast") });
      void refreshUser();
    } finally {
      setCpLoading(false);
    }
  };

  const submitRegenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegenError("");
    setRegenLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/2fa/regenerate-backup-codes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: regenPassword,
          code: regenCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegenError(data.message || t("security.regenerateFailed"));
        return;
      }
      setNewBackupCodes(data.backupCodes);
      setRegenOpen(false);
      setRegenPassword("");
      setRegenCode("");
      toast({ title: t("security.regeneratedToast") });
    } finally {
      setRegenLoading(false);
    }
  };

  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    toast({ title: label });
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            {t("security.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("security.subtitle")}</p>
        </div>

        {user?.mustEnable2FA && (
          <div
            className="flex items-start gap-2 border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 px-4 py-3 rounded"
            data-testid="banner-must-enable-2fa"
          >
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="text-sm">{t("security.mustEnableBanner")}</div>
          </div>
        )}

        {user?.mustChangePassword && (
          <div
            className="flex items-start gap-2 border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 px-4 py-3 rounded"
            data-testid="banner-must-change-password"
          >
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="text-sm">{t("changePassword.mustChangeBanner")}</div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              {t("changePassword.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitChangePassword} className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("changePassword.subtitle")}</p>
              {cpError && (
                <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-3 py-2 rounded text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {cpError}
                </div>
              )}
              <div>
                <Label htmlFor="cp-current">{t("changePassword.currentLabel")}</Label>
                <Input
                  id="cp-current"
                  type="password"
                  value={cpCurrent}
                  onChange={(e) => setCpCurrent(e.target.value)}
                  required
                  autoComplete="current-password"
                  data-testid="input-current-password"
                />
              </div>
              <div>
                <Label htmlFor="cp-new">{t("changePassword.newLabel")}</Label>
                <PasswordPolicyChecklist
                  policy={policy}
                  password={cpNew}
                  className="mt-2 mb-2"
                />
                <Input
                  id="cp-new"
                  type="password"
                  value={cpNew}
                  onChange={(e) => setCpNew(e.target.value)}
                  required
                  autoComplete="new-password"
                  data-testid="input-new-password"
                />
              </div>
              <div>
                <Label htmlFor="cp-confirm">{t("changePassword.confirmLabel")}</Label>
                <Input
                  id="cp-confirm"
                  type="password"
                  value={cpConfirm}
                  onChange={(e) => setCpConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  data-testid="input-confirm-password"
                />
              </div>
              <Button
                type="submit"
                disabled={cpLoading || !cpCurrent || !cpNew || !cpConfirm}
                data-testid="button-submit-change-password"
              >
                <KeyRound className="h-4 w-4 me-2" />
                {cpLoading ? t("common.saving") : t("changePassword.submit")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                {t("security.twoFactorTitle")}
              </span>
              {!statusLoading && status && (
                status.enabled ? (
                  <Badge variant="secondary" className="gap-1" data-testid="badge-2fa-enabled">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    {t("security.enabled")}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1" data-testid="badge-2fa-disabled">
                    {t("security.disabled")}
                  </Badge>
                )
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("security.twoFactorDesc")}</p>

            {statusLoading && <Skeleton className="h-10 w-full" />}

            {!statusLoading && status?.enabled && !enableData && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRegenOpen(true);
                    setRegenError("");
                  }}
                  data-testid="button-regenerate-backup-codes"
                >
                  <ShieldCheck className="h-4 w-4 me-2" />
                  {t("security.regenerateBackupCodesButton")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDisableOpen(true);
                    setDisableError("");
                  }}
                  data-testid="button-disable-2fa"
                >
                  <ShieldOff className="h-4 w-4 me-2" />
                  {t("security.disableButton")}
                </Button>
              </div>
            )}

            {!statusLoading && !status?.enabled && !enableData && (
              <div>
                {enableError && (
                  <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-3 py-2 rounded text-sm mb-3">
                    <AlertCircle className="h-4 w-4" />
                    {enableError}
                  </div>
                )}
                <Button
                  onClick={startEnable}
                  disabled={enableLoading}
                  data-testid="button-enable-2fa"
                >
                  <ShieldCheck className="h-4 w-4 me-2" />
                  {enableLoading ? t("common.loading") : t("security.enableButton")}
                </Button>
              </div>
            )}

            {enableData && (
              <form onSubmit={submitConfirm} className="space-y-4 pt-2 border-t border-border">
                <div>
                  <h3 className="font-semibold text-sm mb-2">{t("security.scanQrTitle")}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{t("security.scanQrDesc")}</p>
                  <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                    <img
                      src={qrUrl(enableData.otpauthUrl)}
                      alt="2FA QR code"
                      className="border border-border rounded bg-white p-2"
                      width={200}
                      height={200}
                      data-testid="img-2fa-qr"
                    />
                    <div className="flex-1 w-full">
                      <Label className="text-xs">{t("security.secretLabel")}</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code
                          className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono break-all"
                          data-testid="text-2fa-secret"
                        >
                          {enableData.secret}
                        </code>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => copy(enableData.secret, t("security.secretCopied"))}
                          data-testid="button-copy-secret"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-sm mb-2">{t("security.backupCodesTitle")}</h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    {t("security.backupCodesDesc")}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                    {enableData.backupCodes.map((c) => (
                      <code
                        key={c}
                        className="text-xs bg-muted px-2 py-1.5 rounded font-mono text-center"
                        data-testid={`text-backup-code-${c}`}
                      >
                        {c}
                      </code>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copy(enableData.backupCodes.join("\n"), t("security.backupCodesCopied"))}
                    data-testid="button-copy-backup-codes"
                  >
                    <Copy className="h-3.5 w-3.5 me-1.5" />
                    {t("security.copyAll")}
                  </Button>
                </div>

                <div className="border-t border-border pt-4">
                  {enableError && (
                    <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-3 py-2 rounded text-sm mb-3">
                      <AlertCircle className="h-4 w-4" />
                      {enableError}
                    </div>
                  )}
                  <Label htmlFor="confirm-code">{t("security.confirmCodeLabel")}</Label>
                  <Input
                    id="confirm-code"
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value)}
                    placeholder="123456"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    required
                    data-testid="input-confirm-2fa-code"
                  />
                  <div className="flex gap-2 mt-3">
                    <Button
                      type="submit"
                      disabled={confirmLoading || !confirmCode.trim()}
                      data-testid="button-confirm-2fa"
                    >
                      <ShieldCheck className="h-4 w-4 me-2" />
                      {confirmLoading ? t("common.saving") : t("security.confirmButton")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={cancelEnable}
                      data-testid="button-cancel-enable-2fa"
                    >
                      {t("common.cancel")}
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <IpAllowlistPanel />

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                {t("security.sessionsTitle")}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={revokeOthers}
                disabled={revokeLoading || sessionsLoading}
                data-testid="button-revoke-other-sessions"
              >
                <LogOut className="h-3.5 w-3.5 me-1.5" />
                {t("security.revokeOthers")}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("security.sessionsDesc")}</p>
            {sessionsLoading && <Skeleton className="h-16 w-full" />}
            {!sessionsLoading && (sessionsData?.sessions ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground" data-testid="text-no-sessions">
                {t("security.sessionsEmpty")}
              </p>
            )}
            {!sessionsLoading && (sessionsData?.sessions ?? []).length > 0 && (
              <ul className="divide-y divide-border rounded border border-border">
                {(sessionsData?.sessions ?? []).map((s) => (
                  <li
                    key={s.id}
                    className="px-3 py-2.5 flex items-center justify-between gap-3"
                    data-testid={`session-row-${s.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Monitor className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">
                          {summarizeUserAgent(s.userAgent, t("security.unknownDevice"))}
                        </span>
                        {s.isCurrent && (
                          <Badge variant="secondary" className="text-xs" data-testid={`badge-current-session-${s.id}`}>
                            {t("security.currentSession")}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {s.ip || t("security.unknownIp")} ·{" "}
                        {t("security.signedInAt", { when: formatRelative(s.createdAt) })}
                        {s.lastSeenAt && (
                          <> · {t("security.lastActive", { when: formatRelative(s.lastSeenAt) })}</>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {t("security.activityTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("security.activityDesc")}</p>
            {sessionsLoading && <Skeleton className="h-24 w-full" />}
            {!sessionsLoading && (sessionsData?.events ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground" data-testid="text-no-activity">
                {t("security.activityEmpty")}
              </p>
            )}
            {!sessionsLoading && (sessionsData?.events ?? []).length > 0 && (
              <ul className="divide-y divide-border rounded border border-border">
                {(sessionsData?.events ?? []).map((e) => (
                  <li
                    key={e.id}
                    className="px-3 py-2.5 flex items-start justify-between gap-3"
                    data-testid={`activity-row-${e.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        {e.success ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        )}
                        <span className="font-medium truncate">
                          {summarizeUserAgent(e.userAgent, t("security.unknownDevice"))}
                        </span>
                        {e.twoFactorUsed && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            {t("security.twoFactorUsed")}
                          </Badge>
                        )}
                        {e.isCurrent && (
                          <Badge variant="secondary" className="text-xs">
                            {t("security.currentSession")}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {e.ip || t("security.unknownIp")} · {formatRelative(e.eventAt)}
                        {!e.success && <> · {failureLabel(e.failureReason)}</>}
                      </div>
                    </div>
                    <Badge
                      variant={e.success ? "secondary" : "destructive"}
                      className="text-xs shrink-0"
                    >
                      {e.success ? t("security.success") : t("security.failed")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("security.disableDialogTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitDisable} className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("security.disableDialogDesc")}</p>
            {disableError && (
              <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-3 py-2 rounded text-sm">
                <AlertCircle className="h-4 w-4" />
                {disableError}
              </div>
            )}
            <div>
              <Label htmlFor="disable-password">{t("common.password")}</Label>
              <Input
                id="disable-password"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                required
                autoComplete="current-password"
                data-testid="input-disable-password"
              />
            </div>
            <div>
              <Label htmlFor="disable-code">{t("security.confirmCodeLabel")}</Label>
              <Input
                id="disable-code"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                placeholder="123456"
                autoComplete="one-time-code"
                inputMode="text"
                required
                data-testid="input-disable-code"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                {t("login.twoFactor.helper")}
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDisableOpen(false)}
                data-testid="button-cancel-disable-2fa"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={disableLoading || !disablePassword || !disableCode.trim()}
                data-testid="button-confirm-disable-2fa"
              >
                <ShieldOff className="h-4 w-4 me-2" />
                {disableLoading ? t("common.saving") : t("security.disableButton")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("security.regenerateDialogTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitRegenerate} className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("security.regenerateDialogDesc")}</p>
            {regenError && (
              <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-3 py-2 rounded text-sm">
                <AlertCircle className="h-4 w-4" />
                {regenError}
              </div>
            )}
            <div>
              <Label htmlFor="regen-password">{t("common.password")}</Label>
              <Input
                id="regen-password"
                type="password"
                value={regenPassword}
                onChange={(e) => setRegenPassword(e.target.value)}
                required
                autoComplete="current-password"
                data-testid="input-regen-password"
              />
            </div>
            <div>
              <Label htmlFor="regen-code">{t("security.confirmCodeLabel")}</Label>
              <Input
                id="regen-code"
                value={regenCode}
                onChange={(e) => setRegenCode(e.target.value)}
                placeholder="123456"
                autoComplete="one-time-code"
                inputMode="text"
                required
                data-testid="input-regen-code"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                {t("login.twoFactor.helper")}
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRegenOpen(false)}
                data-testid="button-cancel-regenerate"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={regenLoading || !regenPassword || !regenCode.trim()}
                data-testid="button-confirm-regenerate"
              >
                <ShieldCheck className="h-4 w-4 me-2" />
                {regenLoading ? t("common.saving") : t("security.regenerateConfirmButton")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!newBackupCodes} onOpenChange={(open) => { if (!open) setNewBackupCodes(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("security.newBackupCodesTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("security.newBackupCodesDesc")}</p>
            {newBackupCodes && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {newBackupCodes.map((c) => (
                    <code
                      key={c}
                      className="text-xs bg-muted px-2 py-1.5 rounded font-mono text-center"
                      data-testid={`text-new-backup-code-${c}`}
                    >
                      {c}
                    </code>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copy(newBackupCodes.join("\n"), t("security.backupCodesCopied"))}
                  data-testid="button-copy-new-backup-codes"
                >
                  <Copy className="h-3.5 w-3.5 me-1.5" />
                  {t("security.copyAll")}
                </Button>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setNewBackupCodes(null)}
              data-testid="button-done-new-backup-codes"
            >
              {t("security.doneButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
