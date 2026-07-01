import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building, LogIn, AlertCircle, ShieldCheck, Lock } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

function isSafeNext(n: string | null | undefined): n is string {
  if (!n) return false;
  if (!n.startsWith("/")) return false;
  if (n.startsWith("//") || n.startsWith("/\\")) return false;
  if (n.length > 2048) return false;
  return true;
}

function getNextParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  const n = params.get("next");
  return isSafeNext(n) ? n : null;
}

type SsoDiscovery = {
  ssoEnabled: boolean;
  requireSso?: boolean;
  orgId?: number;
};

function emailDomain(value: string): string | null {
  const at = value.lastIndexOf("@");
  if (at < 0 || at === value.length - 1) return null;
  const domain = value.slice(at + 1).trim().toLowerCase();
  if (!domain || !domain.includes(".")) return null;
  return domain;
}

export default function Login() {
  const { login, verify2FA } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [microsoftEnabled, setMicrosoftEnabled] = useState(false);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoOrgIdInput, setSsoOrgIdInput] = useState("");
  const [showSsoForm, setShowSsoForm] = useState(false);
  const [ssoDiscovery, setSsoDiscovery] = useState<SsoDiscovery | null>(null);
  const [discoveredDomain, setDiscoveredDomain] = useState<string | null>(null);
  const discoverAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errParam = params.get("error");
    if (errParam) {
      setError(errParam);
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
    fetch(`${API_BASE}/auth/providers`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setMicrosoftEnabled(!!data.microsoft);
      })
      .catch(() => {});
  }, []);

  // Debounced SSO discovery as the user types their email.
  useEffect(() => {
    const domain = emailDomain(email);
    if (!domain) {
      if (discoverAbortRef.current) {
        discoverAbortRef.current.abort();
        discoverAbortRef.current = null;
      }
      if (ssoDiscovery || discoveredDomain) {
        setSsoDiscovery(null);
        setDiscoveredDomain(null);
      }
      return;
    }
    if (discoveredDomain === domain) return;
    const handle = window.setTimeout(() => {
      if (discoverAbortRef.current) discoverAbortRef.current.abort();
      const ctrl = new AbortController();
      discoverAbortRef.current = ctrl;
      fetch(
        `${API_BASE}/sso/discover?email=${encodeURIComponent(email.trim())}`,
        { credentials: "include", signal: ctrl.signal },
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((data: SsoDiscovery | null) => {
          if (ctrl.signal.aborted) return;
          setDiscoveredDomain(domain);
          if (data && data.ssoEnabled && data.orgId) {
            setSsoDiscovery(data);
          } else {
            setSsoDiscovery(null);
          }
        })
        .catch(() => {});
    }, 350);
    return () => window.clearTimeout(handle);
  }, [email, discoveredDomain, ssoDiscovery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const result = await login(email, password);
    if (result.requires2FA) {
      setTwoFactorRequired(true);
      setTwoFactorCode("");
    } else if (!result.success) {
      setError(result.error || t("login.loginFailed"));
      setIsLoading(false);
      return;
    }
    const next = getNextParam();
    if (next) {
      window.location.href = next;
      return;
    }
    setIsLoading(false);
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    const result = await verify2FA(twoFactorCode.trim());
    if (!result.success) {
      setError(result.error || t("login.twoFactor.invalidCode"));
    }
    setIsLoading(false);
  };

  const handleCancel2FA = () => {
    setTwoFactorRequired(false);
    setTwoFactorCode("");
    setPassword("");
    setError("");
  };

  const startSsoForOrg = (orgId: number) => {
    const next = getNextParam();
    const target = next
      ? `${API_BASE}/sso/login/${orgId}?next=${encodeURIComponent(next)}`
      : `${API_BASE}/sso/login/${orgId}`;
    window.location.href = target;
  };

  const handleDiscoveredSso = () => {
    if (!ssoDiscovery?.orgId) return;
    setError("");
    setSsoLoading(true);
    startSsoForOrg(ssoDiscovery.orgId);
  };

  const handleSsoLogin = async () => {
    setError("");
    setSsoLoading(true);
    try {
      const next = getNextParam();
      const trimmed = ssoOrgIdInput.trim();
      // If user entered a numeric org id directly, jump straight to SSO init.
      if (/^\d+$/.test(trimmed)) {
        const target = next
          ? `${API_BASE}/sso/login/${trimmed}?next=${encodeURIComponent(next)}`
          : `${API_BASE}/sso/login/${trimmed}`;
        window.location.href = target;
        return;
      }
      // Otherwise treat the input as an email and use the discover endpoint.
      const lookup = trimmed || email.trim();
      if (!lookup) {
        setError(t("login.sso.enterEmail"));
        setSsoLoading(false);
        return;
      }
      const r = await fetch(`${API_BASE}/sso/discover?email=${encodeURIComponent(lookup)}`, {
        credentials: "include",
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ssoEnabled || !data.orgId) {
        setError(t("login.sso.notConfigured"));
        setSsoLoading(false);
        return;
      }
      const target = next
        ? `${API_BASE}/sso/login/${data.orgId}?next=${encodeURIComponent(next)}`
        : `${API_BASE}/sso/login/${data.orgId}`;
      window.location.href = target;
    } catch {
      setError(t("login.sso.failed"));
      setSsoLoading(false);
    }
  };

  const handleMicrosoftLogin = () => {
    const next = getNextParam();
    const target = next
      ? `${API_BASE}/auth/microsoft/login?next=${encodeURIComponent(next)}`
      : `${API_BASE}/auth/microsoft/login`;
    window.location.href = target;
  };

  const ssoDetected = !!(ssoDiscovery && ssoDiscovery.ssoEnabled && ssoDiscovery.orgId);
  const ssoRequired = ssoDetected && !!ssoDiscovery!.requireSso;
  const hidePasswordField = ssoRequired;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center relative">
            <div className="h-14 w-14 rounded-xl bg-slate-800/10 dark:bg-slate-200/10 flex items-center justify-center">
              <Building className="h-7 w-7 text-slate-800 dark:text-slate-200" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">{t("login.title")}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {twoFactorRequired ? t("login.twoFactor.subtitle") : t("login.subtitle")}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {twoFactorRequired ? (
            <form onSubmit={handleVerify2FA} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              <div className="flex flex-col items-center gap-2 py-2">
                <ShieldCheck className="h-8 w-8 text-slate-800 dark:text-slate-200" />
                <p className="text-sm text-muted-foreground text-center">
                  {t("login.twoFactor.prompt")}
                </p>
              </div>
              <div>
                <Label htmlFor="twoFactorCode">{t("login.twoFactor.codeLabel")}</Label>
                <Input
                  id="twoFactorCode"
                  type="text"
                  inputMode="text"
                  autoComplete="one-time-code"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder={t("login.twoFactor.codePlaceholder")}
                  required
                  autoFocus
                  data-testid="input-2fa-code"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  {t("login.twoFactor.helper")}
                </p>
              </div>
              <Button
                type="submit"
                className="w-full bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-200 dark:hover:bg-slate-100 dark:text-slate-900"
                disabled={isLoading || !twoFactorCode.trim()}
                data-testid="button-verify-2fa"
              >
                <ShieldCheck className="h-4 w-4 me-2" />
                {isLoading ? t("login.twoFactor.verifying") : t("login.twoFactor.verify")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleCancel2FA}
                data-testid="button-cancel-2fa"
              >
                {t("login.twoFactor.cancel")}
              </Button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <div>
              <Label htmlFor="email">{t("login.emailLabel")}</Label>
              <Input
                id="email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("login.emailPlaceholder")}
                required
                autoFocus
                data-testid="input-login-email"
              />
            </div>
            {ssoDetected && (
              <div
                className="rounded-lg border border-slate-400/40 bg-slate-500/5 px-4 py-3 space-y-2"
                data-testid="sso-detected-banner"
              >
                <div className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-slate-700 dark:text-slate-300 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 text-start">
                    <p className="text-sm font-medium text-foreground">
                      {ssoRequired
                        ? t("login.sso.requiredTitle")
                        : t("login.sso.detectedTitle")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ssoRequired
                        ? t("login.sso.requiredDescription")
                        : t("login.sso.detectedDescription")}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleDiscoveredSso}
                  disabled={ssoLoading}
                  data-testid="button-sso-continue-detected"
                >
                  <Lock className="h-4 w-4 me-2" />
                  {ssoLoading
                    ? t("login.sso.redirecting")
                    : t("login.sso.continueWithSso")}
                </Button>
              </div>
            )}
            {!hidePasswordField && (
              <div>
                <Label htmlFor="password">{t("login.passwordLabel")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("login.passwordPlaceholder")}
                  required
                  data-testid="input-login-password"
                />
              </div>
            )}
            {!hidePasswordField && (
              <Button
                type="submit"
                className="w-full bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-200 dark:hover:bg-slate-100 dark:text-slate-900"
                disabled={isLoading}
                data-testid="button-login"
              >
                <LogIn className="h-4 w-4 me-2" />
                {isLoading ? t("login.signingIn") : t("login.signIn")}
              </Button>
            )}
          </form>
          )}
          {!twoFactorRequired && !ssoDetected && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    {t("login.or")}
                  </span>
                </div>
              </div>
              {showSsoForm ? (
                <div className="space-y-2">
                  <Label htmlFor="sso-org">{t("login.sso.orgLabel")}</Label>
                  <Input
                    id="sso-org"
                    type="text"
                    value={ssoOrgIdInput}
                    onChange={(e) => setSsoOrgIdInput(e.target.value)}
                    placeholder={t("login.sso.orgPlaceholder")}
                    data-testid="input-sso-org"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={handleSsoLogin}
                      disabled={ssoLoading}
                      data-testid="button-sso-continue"
                    >
                      <Lock className="h-4 w-4 me-2" />
                      {ssoLoading ? t("login.sso.redirecting") : t("login.sso.continue")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => { setShowSsoForm(false); setSsoOrgIdInput(""); setError(""); }}
                    >
                      {t("login.sso.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowSsoForm(true)}
                  data-testid="button-login-sso"
                >
                  <Lock className="h-4 w-4 me-2" />
                  {t("login.sso.signInWithSso")}
                </Button>
              )}
            </>
          )}
          {!twoFactorRequired && !ssoDetected && microsoftEnabled && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    {t("login.or")}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleMicrosoftLogin}
                data-testid="button-login-microsoft"
              >
                <svg className="h-4 w-4 me-2" viewBox="0 0 23 23" aria-hidden="true">
                  <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                  <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
                  <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
                  <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
                </svg>
                {t("login.continueWithMicrosoft")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
