import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Mail } from "lucide-react";
import {
  useGetPublicInvitation,
  useAcceptInvitation,
  getGetPublicInvitationQueryKey,
} from "@workspace/api-client-react";

export default function AcceptInvite() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading: authLoading, refreshUser } = useAuth();
  const [token, setToken] = useState<string>("");
  const [tokenChecked, setTokenChecked] = useState(false);
  const [acceptError, setAcceptError] = useState<string>("");
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tk = params.get("token") || "";
    setToken(tk);
    setTokenChecked(true);
  }, []);

  const {
    data: inv,
    isLoading: invLoading,
    error: invError,
  } = useGetPublicInvitation(token, {
    query: {
      enabled: tokenChecked && !!token,
      queryKey: getGetPublicInvitationQueryKey(token),
    },
  });

  const isFetching = !tokenChecked || (!!token && invLoading);
  const loadError = !token && tokenChecked
    ? ""
    : invError
      ? (invError as Error).message || "Invitation not found"
      : "";

  const acceptMutation = useAcceptInvitation({
    mutation: {
      onSuccess: async () => {
        await refreshUser();
        setAccepted(true);
      },
      onError: (e) => {
        setAcceptError((e as Error).message || t("acceptInvite.acceptFailed"));
      },
    },
  });

  const handleAccept = () => {
    setAcceptError("");
    acceptMutation.mutate({ token });
  };
  const isAccepting = acceptMutation.isPending;

  const goHome = () => {
    window.location.href = import.meta.env.BASE_URL || "/";
  };

  const goSignIn = () => {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    window.location.href = `${base}/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <Card className="w-full max-w-md shadow-lg" data-testid="card-accept-invite">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <Mail className="h-7 w-7 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{t("acceptInvite.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isFetching || authLoading ? (
            <p className="text-center text-muted-foreground">{t("common.loading")}</p>
          ) : loadError ? (
            <div className="flex items-start gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{loadError}</span>
            </div>
          ) : inv ? (
            <>
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">{t("acceptInvite.invitedTo")}</p>
                <p className="text-lg font-semibold" data-testid="text-invite-org">{inv.organizationName}</p>
                <p className="text-sm">
                  {t("acceptInvite.asRole", { role: inv.roleName })}
                </p>
                <p className="text-xs text-muted-foreground pt-1">
                  {t("acceptInvite.invitedEmail", { email: inv.email })}
                </p>
              </div>

              {inv.status !== "pending" && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-center" data-testid="text-invite-status">
                  {t(`acceptInvite.status.${inv.status}`)}
                </div>
              )}

              {accepted ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg text-sm" data-testid="text-invite-accepted">
                    <CheckCircle2 className="h-4 w-4" />
                    {t("acceptInvite.acceptedMsg", { org: inv.organizationName })}
                  </div>
                  <Button className="w-full" onClick={goHome} data-testid="button-go-home">{t("acceptInvite.goToOrg")}</Button>
                </div>
              ) : inv.status !== "pending" ? null : !isAuthenticated ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground text-center">
                    {t("acceptInvite.signInPrompt")}
                  </p>
                  <Button className="w-full" onClick={goSignIn} data-testid="button-sign-in-to-accept">
                    {t("acceptInvite.signInToAccept")}
                  </Button>
                </div>
              ) : user && user.email.toLowerCase() !== inv.email.toLowerCase() ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-destructive bg-destructive/10 px-3 py-2 rounded-lg text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{t("acceptInvite.wrongAccount", { invited: inv.email, current: user.email })}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {acceptError && (
                    <div className="flex items-start gap-2 text-destructive bg-destructive/10 px-3 py-2 rounded-lg text-sm">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{acceptError}</span>
                    </div>
                  )}
                  <Button
                    className="w-full"
                    onClick={handleAccept}
                    disabled={isAccepting}
                    data-testid="button-accept-invite"
                  >
                    {isAccepting ? t("common.loading") : t("acceptInvite.acceptButton")}
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
