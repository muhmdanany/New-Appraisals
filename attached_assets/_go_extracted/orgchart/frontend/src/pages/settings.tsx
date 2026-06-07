import { useEffect, useMemo, useState, useCallback } from "react";
import { useOrg } from "@/lib/org-context";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "react-i18next";
import {
  useGetOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
  useUploadOrganizationLogo,
  useDeleteOrganizationLogo,
  useListEmailDomains,
  useCreateEmailDomain,
  useDeleteEmailDomain,
  useBackfillEmailDomain,
  useVerifyEmailDomain,
  useRevokeEmailDomainVerification,
  getGetOrganizationQueryKey,
  getListOrganizationsQueryKey,
  getListEmailDomainsQueryKey,
  useListApiTokens,
  useCreateApiToken,
  useRevokeApiToken,
  getListApiTokensQueryKey,
  useListWebhookEndpoints,
  useCreateWebhookEndpoint,
  useUpdateWebhookEndpoint,
  useDeleteWebhookEndpoint,
  useTestWebhookEndpoint,
  useListWebhookDeliveries,
  getListWebhookEndpointsQueryKey,
  getListWebhookDeliveriesQueryKey,
  useListShareLinks,
  useCreateShareLink,
  useUpdateShareLink,
  useRevokeShareLink,
  getListShareLinksQueryKey,
  useListChartEmbedTokens,
  useCreateChartEmbedToken,
  useRevokeChartEmbedToken,
  getListChartEmbedTokensQueryKey,
  useListCharts,
  useListInvitations,
  useCreateInvitation,
  useCancelInvitation,
  useResendInvitation,
  getListInvitationsQueryKey,
  useListDeletedEmployees,
  useRestoreEmployee,
  useDeleteEmployeePermanently,
  getListDeletedEmployeesQueryKey,
  useListNotificationPreferences,
  useUpdateNotificationPreferences,
  getListNotificationPreferencesQueryKey,
  useListOrgIntegrations,
  useCreateOrgIntegration,
  useUpdateOrgIntegration,
  useDeleteOrgIntegration,
  useTestOrgIntegration,
  usePreviewOrgIntegration,
  getListOrgIntegrationsQueryKey,
  useGetSlackOauthStatus,
  useListSlackOauthChannels,
  getGetSlackOauthStatusQueryKey,
  getListSlackOauthChannelsQueryKey,
  useListSlackChannelMappings,
  useCreateSlackChannelMapping,
  useDeleteSlackChannelMapping,
  useSyncSlackChannelMappingNow,
  getListSlackChannelMappingsQueryKey,
  useListDepartments,
  useGetGoogleImportStatus,
  getGetGoogleImportStatusQueryKey,
  useListTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  getListTagsQueryKey,
  getListEmployeesQueryKey,
} from "@workspace/api-client-react";
import type { ApiToken, Invitation, DeletedEmployee, NotificationPreference, ShareLink, OrgIntegration, SlackChannel, WebhookEndpoint, WebhookDelivery, WebhookEventType, ChartEmbedToken } from "@workspace/api-client-react";
import { Switch } from "@/components/ui/switch";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { resolvePhotoUrl } from "@/lib/photo-url";
import SSOTab from "@/components/settings/sso-tab";
import { HrisImportWizard } from "@/components/hris-import-wizard";
import { OnboardingTemplatesTab } from "@/components/settings/onboarding-templates-tab";
import { OffboardingTemplatesTab } from "@/components/settings/offboarding-templates-tab";
import {
  Building,
  Save,
  Trash2,
  Upload,
  Image as ImageIcon,
  Users,
  Shield,
  Plus,
  Edit2,
  Eye,
  PenLine,
  FilePlus,
  Ban,
  AtSign,
  Mail,
  Send,
  X,
  Copy,
  Key,
  UserPlus,
  Zap,
  MessageSquare,
  Check,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Undo2,
  Bell,
  ClipboardList,
  LogOut,
  Share2,
  Lock,
  ExternalLink,
  Download,
  Database,
  Cloud,
  Webhook,
  ScrollText,
  Trash,
  Pencil,
  Code,
  Tag as TagIconLucide,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface AppUser {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  roles: { id: number; name: string }[];
}

interface Permission {
  id: number;
  resource: string;
  action: string;
}

interface AppRole {
  id: number;
  name: string;
  description: string | null;
  organizationId: number;
  isSystemRole: boolean;
  permissions: Permission[];
}

type SettingsTab = "organization" | "users" | "invitations" | "joinRequests" | "roles" | "apiTokens" | "webhooks" | "recycleBin" | "notifications" | "shareLinks" | "embeds" | "integrations" | "sso" | "passwordPolicy" | "onboarding" | "offboarding" | "tags";

interface JoinRequest {
  id: number;
  organizationId: number;
  userId: number;
  userName: string;
  userEmail: string;
  message: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export default function Settings() {
  const { selectedOrgId, setSelectedOrgId } = useOrg();
  const { user: authUser, hasPermission } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "notifications" || tab === "users" || tab === "invitations" || tab === "joinRequests" || tab === "roles" || tab === "apiTokens" || tab === "webhooks" || tab === "organization" || tab === "recycleBin" || tab === "shareLinks" || tab === "embeds" || tab === "integrations" || tab === "sso" || tab === "passwordPolicy" || tab === "onboarding" || tab === "tags") {
        return tab;
      }
    }
    return "organization";
  });

  // The global Cmd+K palette can request a specific settings tab from any
  // page. When this page is already mounted, wouter's setLocation only
  // updates the URL — so we also listen for the palette event to switch the
  // active tab in-place.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ tab: string }>).detail;
      const tab = detail?.tab;
      if (
        tab === "notifications" || tab === "users" || tab === "invitations" ||
        tab === "joinRequests" || tab === "roles" || tab === "apiTokens" ||
        tab === "webhooks" ||
        tab === "organization" || tab === "recycleBin" ||
        tab === "shareLinks" || tab === "embeds" || tab === "integrations" || tab === "sso" ||
        tab === "passwordPolicy" || tab === "onboarding" || tab === "tags"
      ) {
        setActiveTab(tab);
      }
    };
    window.addEventListener("orgchart:palette:set-settings-tab", handler);
    return () => window.removeEventListener("orgchart:palette:set-settings-tab", handler);
  }, []);

  const { data: org, isLoading } = useGetOrganization(
    selectedOrgId!,
    { query: { enabled: !!selectedOrgId, queryKey: getGetOrganizationQueryKey(selectedOrgId!) } }
  );

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [auditRetentionDays, setAuditRetentionDays] = useState<number>(365);
  const [archiveAuditBeforeDelete, setArchiveAuditBeforeDelete] = useState<boolean>(false);
  const [require2faAdmins, setRequire2faAdmins] = useState<boolean>(false);
  const [require2faAllUsers, setRequire2faAllUsers] = useState<boolean>(false);
  const [suggestionMaxDirectReports, setSuggestionMaxDirectReports] = useState<number>(12);
  const [suggestionOpenPositionDays, setSuggestionOpenPositionDays] = useState<number>(60);
  const [showBirthdayYear, setShowBirthdayYear] = useState<boolean>(false);
  const [suggestionThresholdError, setSuggestionThresholdError] = useState<string | null>(null);
  const [retentionError, setRetentionError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  useEffect(() => {
    if (org) {
      setName(org.name);
      setSlug(org.slug || "");
      setDescription(org.description || "");
      setIndustry(org.industry || "");
      setAuditRetentionDays(org.auditRetentionDays ?? 365);
      setArchiveAuditBeforeDelete(org.archiveAuditBeforeDelete ?? false);
      setRequire2faAdmins(org.require2faAdmins ?? false);
      setRequire2faAllUsers(org.require2faAllUsers ?? false);
      setSuggestionMaxDirectReports(org.suggestionMaxDirectReports ?? 12);
      setSuggestionOpenPositionDays(org.suggestionOpenPositionDays ?? 60);
      setShowBirthdayYear(org.showBirthdayYear ?? false);
    }
  }, [org]);

  const updateMutation = useUpdateOrganization({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOrganizationQueryKey(selectedOrgId!) });
        queryClient.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
        toast({ title: t("settings.orgUpdated"), description: t("settings.settingsSaved") });
      },
    },
  });

  const uploadLogoMutation = useUploadOrganizationLogo({
    mutation: {
      onSuccess: () => {
        setLogoError(null);
        queryClient.invalidateQueries({ queryKey: getGetOrganizationQueryKey(selectedOrgId!) });
        queryClient.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
        toast({ title: t("settings.orgUpdated") });
      },
      onError: () => setLogoError(t("settings.logoUploadFailed")),
    },
  });

  const removeLogoMutation = useDeleteOrganizationLogo({
    mutation: {
      onSuccess: () => {
        setLogoError(null);
        queryClient.invalidateQueries({ queryKey: getGetOrganizationQueryKey(selectedOrgId!) });
        queryClient.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
      },
      onError: () => setLogoError(t("settings.logoUploadFailed")),
    },
  });

  const handleLogoFileSelected = (file: File | null) => {
    if (!file || !selectedOrgId) return;
    if (file.size > 2 * 1024 * 1024) {
      setLogoError(t("settings.logoTooLarge"));
      return;
    }
    if (!["image/png", "image/jpeg", "image/jpg", "image/svg+xml"].includes(file.type)) {
      setLogoError(t("settings.logoTypeUnsupported"));
      return;
    }
    setLogoError(null);
    uploadLogoMutation.mutate({ orgId: selectedOrgId, data: { file } });
  };

  const deleteMutation = useDeleteOrganization({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
        setSelectedOrgId(null);
        setLocation("/");
      },
    },
  });

  const handleSave = () => {
    if (!selectedOrgId) return;
    if (auditRetentionDays < 30 || !Number.isFinite(auditRetentionDays)) {
      setRetentionError(t("settings.auditRetentionMin"));
      return;
    }
    setRetentionError(null);
    if (
      !Number.isFinite(suggestionMaxDirectReports) || suggestionMaxDirectReports < 1 ||
      !Number.isFinite(suggestionOpenPositionDays) || suggestionOpenPositionDays < 1
    ) {
      setSuggestionThresholdError(t("settings.suggestionThresholdMin"));
      return;
    }
    setSuggestionThresholdError(null);
    const trimmedSlug = slug.trim().toLowerCase();
    if (trimmedSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedSlug)) {
      setSlugError(t("settings.orgSlugInvalid"));
      return;
    }
    if (trimmedSlug.length > 64) {
      setSlugError(t("settings.orgSlugInvalid"));
      return;
    }
    setSlugError(null);
    const data: Record<string, unknown> = {
      name,
      description: description || null,
      industry: industry || null,
      auditRetentionDays,
      archiveAuditBeforeDelete,
      require2faAdmins,
      require2faAllUsers,
      suggestionMaxDirectReports,
      suggestionOpenPositionDays,
      showBirthdayYear,
    };
    if (trimmedSlug && trimmedSlug !== (org?.slug || "")) {
      data.slug = trimmedSlug;
    }
    updateMutation.mutate({
      id: selectedOrgId,
      data: data as Parameters<typeof updateMutation.mutate>[0]["data"],
    });
  };

  if (!selectedOrgId) {
    return <div className="p-8 text-muted-foreground">{t("common.selectOrg")}</div>;
  }

  const canEditOrg = hasPermission("organizations", "edit");
  const canDeleteOrg = hasPermission("organizations", "delete");
  const canViewUsers = hasPermission("users", "view");
  const canViewRoles = hasPermission("roles", "view");
  const canManageRecycleBin = hasPermission("employees", "delete");

  const tabs = [
    { id: "organization" as const, label: t("settings.tabOrganization"), icon: Building, visible: true },
    { id: "users" as const, label: t("settings.tabUsers"), icon: Users, visible: canViewUsers },
    { id: "invitations" as const, label: t("settings.tabInvitations"), icon: Mail, visible: canViewUsers },
    { id: "joinRequests" as const, label: t("settings.tabJoinRequests"), icon: UserPlus, visible: canViewUsers },
    { id: "roles" as const, label: t("settings.tabRoles"), icon: Shield, visible: canViewRoles },
    { id: "apiTokens" as const, label: t("settings.tabApiTokens"), icon: Key, visible: canEditOrg },
    { id: "webhooks" as const, label: t("settings.tabWebhooks"), icon: Webhook, visible: canEditOrg },
    { id: "tags" as const, label: t("settings.tabTags"), icon: TagIconLucide, visible: canEditOrg },
    { id: "recycleBin" as const, label: t("settings.tabRecycleBin"), icon: Trash2, visible: canManageRecycleBin },
    { id: "notifications" as const, label: t("notifications.settings"), icon: Bell, visible: true },
    { id: "onboarding" as const, label: t("onboarding.tabLabel"), icon: ClipboardList, visible: canEditOrg },
    { id: "offboarding" as const, label: t("offboarding.tabLabel"), icon: LogOut, visible: canEditOrg },
    { id: "shareLinks" as const, label: t("settings.tabShareLinks"), icon: Share2, visible: canEditOrg },
    { id: "embeds" as const, label: t("settings.tabEmbeds"), icon: Code, visible: canEditOrg },
    { id: "integrations" as const, label: t("settings.tabIntegrations"), icon: Zap, visible: canEditOrg },
    { id: "sso" as const, label: t("settings.tabSso"), icon: Lock, visible: canEditOrg },
    { id: "passwordPolicy" as const, label: t("settings.tabPasswordPolicy"), icon: Lock, visible: canEditOrg },
  ].filter(t => t.visible);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">{t("settings.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("settings.subtitle")}</p>
        </div>

        <div className="flex gap-1 border-b border-border overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 scrollbar-thin">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "organization" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  {t("settings.orgDetails")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label>{t("settings.orgName")}</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-org-name" />
                    </div>
                    <div>
                      <Label htmlFor="input-org-slug">{t("settings.orgSlug")}</Label>
                      <Input
                        id="input-org-slug"
                        value={slug}
                        onChange={(e) => { setSlug(e.target.value); setSlugError(null); }}
                        placeholder="acme"
                        disabled={!canEditOrg}
                        data-testid="input-org-slug"
                      />
                      <p className="text-xs text-muted-foreground mt-1">{t("settings.orgSlugHelp")}</p>
                      {slugError && <p className="text-xs text-destructive mt-1">{slugError}</p>}
                    </div>
                    <div>
                      <Label>{t("settings.industry")}</Label>
                      <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder={t("settings.industryPlaceholder")} data-testid="input-org-industry" />
                    </div>
                    <div>
                      <Label>{t("settings.description")}</Label>
                      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("settings.descriptionPlaceholder")} rows={4} data-testid="input-org-description" />
                    </div>
                    <div>
                      <Label htmlFor="audit-retention-days">{t("settings.auditRetentionLabel")}</Label>
                      <Input
                        id="audit-retention-days"
                        type="number"
                        min={30}
                        value={auditRetentionDays}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setAuditRetentionDays(Number.isNaN(v) ? 0 : v);
                          setRetentionError(null);
                        }}
                        disabled={!canEditOrg}
                        data-testid="input-audit-retention-days"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("settings.auditRetentionHelp")}
                      </p>
                      {retentionError && (
                        <p className="text-xs text-destructive mt-1" data-testid="text-audit-retention-error">
                          {retentionError}
                        </p>
                      )}
                    </div>
                    <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
                      <div className="space-y-0.5">
                        <Label htmlFor="archive-audit-before-delete">
                          {t("settings.archiveAuditLabel")}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {t("settings.archiveAuditHelp")}
                        </p>
                      </div>
                      <Switch
                        id="archive-audit-before-delete"
                        checked={archiveAuditBeforeDelete}
                        onCheckedChange={setArchiveAuditBeforeDelete}
                        disabled={!canEditOrg}
                        data-testid="switch-archive-audit-before-delete"
                      />
                    </div>
                    <div className="flex items-start justify-between gap-4 rounded border border-border p-3">
                      <div className="flex-1">
                        <Label htmlFor="switch-require-2fa-admins" className="font-medium">
                          {t("settings.require2faAdminsLabel")}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("settings.require2faAdminsHelp")}
                        </p>
                      </div>
                      <Switch
                        id="switch-require-2fa-admins"
                        checked={require2faAdmins}
                        onCheckedChange={setRequire2faAdmins}
                        disabled={!canEditOrg}
                        data-testid="switch-require-2fa-admins"
                      />
                    </div>
                    <div className="flex items-start justify-between gap-4 rounded border border-border p-3">
                      <div className="flex-1">
                        <Label htmlFor="switch-require-2fa-all" className="font-medium">
                          {t("settings.require2faAllUsersLabel")}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("settings.require2faAllUsersHelp")}
                        </p>
                      </div>
                      <Switch
                        id="switch-require-2fa-all"
                        checked={require2faAllUsers}
                        onCheckedChange={setRequire2faAllUsers}
                        disabled={!canEditOrg}
                        data-testid="switch-require-2fa-all"
                      />
                    </div>
                    <div>
                      <Label htmlFor="suggestion-max-direct-reports">
                        {t("settings.suggestionMaxDirectReportsLabel")}
                      </Label>
                      <Input
                        id="suggestion-max-direct-reports"
                        type="number"
                        min={1}
                        max={100}
                        value={suggestionMaxDirectReports}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setSuggestionMaxDirectReports(Number.isNaN(v) ? 0 : v);
                          setSuggestionThresholdError(null);
                        }}
                        disabled={!canEditOrg}
                        data-testid="input-suggestion-max-direct-reports"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("settings.suggestionMaxDirectReportsHelp")}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="suggestion-open-position-days">
                        {t("settings.suggestionOpenPositionDaysLabel")}
                      </Label>
                      <Input
                        id="suggestion-open-position-days"
                        type="number"
                        min={1}
                        max={365}
                        value={suggestionOpenPositionDays}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setSuggestionOpenPositionDays(Number.isNaN(v) ? 0 : v);
                          setSuggestionThresholdError(null);
                        }}
                        disabled={!canEditOrg}
                        data-testid="input-suggestion-open-position-days"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("settings.suggestionOpenPositionDaysHelp")}
                      </p>
                      {suggestionThresholdError && (
                        <p className="text-xs text-destructive mt-1" data-testid="text-suggestion-threshold-error">
                          {suggestionThresholdError}
                        </p>
                      )}
                    </div>
                    <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
                      <div className="space-y-1">
                        <Label htmlFor="switch-show-birthday-year" className="cursor-pointer">
                          {t("settings.showBirthdayYearLabel")}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {t("settings.showBirthdayYearHelp")}
                        </p>
                      </div>
                      <Switch
                        id="switch-show-birthday-year"
                        checked={showBirthdayYear}
                        onCheckedChange={setShowBirthdayYear}
                        disabled={!canEditOrg}
                        data-testid="switch-show-birthday-year"
                      />
                    </div>
                    <div>
                      <Label>{t("settings.logo")}</Label>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="h-16 w-16 rounded border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                          {org?.logoUrl ? (
                            <img
                              src={resolvePhotoUrl(org.logoUrl)}
                              alt={org.name}
                              className="h-full w-full object-contain"
                              data-testid="img-org-logo"
                            />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!canEditOrg || uploadLogoMutation.isPending || removeLogoMutation.isPending}
                              onClick={() => document.getElementById("input-org-logo-file")?.click()}
                              data-testid="button-upload-logo"
                            >
                              {uploadLogoMutation.isPending ? (
                                <>{t("settings.logoUploading")}</>
                              ) : (
                                <><Upload className="h-3.5 w-3.5 me-1" />{org?.logoUrl ? t("settings.changeLogo") : t("settings.uploadLogo")}</>
                              )}
                            </Button>
                            {org?.logoUrl && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={!canEditOrg || uploadLogoMutation.isPending || removeLogoMutation.isPending}
                                onClick={() => removeLogoMutation.mutate({ orgId: selectedOrgId! })}
                                data-testid="button-remove-logo"
                              >
                                <Trash2 className="h-3.5 w-3.5 me-1" />{t("settings.removeLogo")}
                              </Button>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{t("settings.logoHint")}</p>
                          {logoError && (
                            <p className="text-xs text-destructive" data-testid="text-logo-error">{logoError}</p>
                          )}
                        </div>
                        <input
                          id="input-org-logo-file"
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml"
                          className="hidden"
                          data-testid="input-org-logo-file"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            handleLogoFileSelected(f);
                            e.target.value = "";
                          }}
                        />
                      </div>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={handleSave} disabled={updateMutation.isPending || !name || !canEditOrg} data-testid="button-save-settings">
                          <Save className="h-4 w-4 me-2" />
                          {updateMutation.isPending ? t("settings.saving") : t("settings.saveChanges")}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("tooltips.saveSettings")}</TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </CardContent>
            </Card>
            {canEditOrg && <EmailDomainsCard orgId={selectedOrgId} />}
            {canEditOrg && <DataExportCard orgId={selectedOrgId} />}
            {canDeleteOrg && <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-destructive">{t("settings.dangerZone")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("settings.dangerDesc")}
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="destructive" data-testid="button-delete-org">
                          <Trash2 className="h-4 w-4 me-2" />
                          {t("settings.deleteOrg")}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("tooltips.deleteOrg")}</TooltipContent>
                    </Tooltip>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("settings.deleteConfirmTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("settings.deleteConfirmDesc", { name: org?.name })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate({ id: selectedOrgId })}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {t("common.delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>}
          </div>
        )}

        {activeTab === "users" && <UsersTab orgId={selectedOrgId} />}
        {activeTab === "invitations" && <InvitationsTab orgId={selectedOrgId} />}
        {activeTab === "joinRequests" && <JoinRequestsTab orgId={selectedOrgId} />}
        {activeTab === "roles" && <RolesTab orgId={selectedOrgId} />}
        {activeTab === "apiTokens" && <ApiTokensTab orgId={selectedOrgId} />}
        {activeTab === "webhooks" && <WebhooksTab orgId={selectedOrgId} />}
        {activeTab === "tags" && <TagsTab orgId={selectedOrgId} />}
        {activeTab === "recycleBin" && <RecycleBinTab orgId={selectedOrgId} />}
        {activeTab === "notifications" && <NotificationPreferencesTab orgId={selectedOrgId} />}
        {activeTab === "shareLinks" && <ShareLinksTab orgId={selectedOrgId} />}
        {activeTab === "embeds" && <EmbedsTab orgId={selectedOrgId} />}
        {activeTab === "integrations" && <IntegrationsTab orgId={selectedOrgId} />}
        {activeTab === "sso" && <SSOTab orgId={selectedOrgId} />}
        {activeTab === "passwordPolicy" && <PasswordPolicyTab orgId={selectedOrgId} />}
        {activeTab === "onboarding" && <OnboardingTemplatesTab orgId={selectedOrgId} />}
        {activeTab === "offboarding" && <OffboardingTemplatesTab orgId={selectedOrgId} />}
      </div>
    </div>
  );
}

function RecycleBinTab({ orgId }: { orgId: number }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useListDeletedEmployees(orgId, {
    query: { queryKey: getListDeletedEmployeesQueryKey(orgId) },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListDeletedEmployeesQueryKey(orgId) });

  const restoreMutation = useRestoreEmployee({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: t("settings.recycleBin.restoreSuccess") });
      },
      onError: () => {
        toast({ title: t("settings.recycleBin.restoreError"), variant: "destructive" });
      },
    },
  });

  const deleteMutation = useDeleteEmployeePermanently({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: t("settings.recycleBin.deleteSuccess") });
      },
      onError: () => {
        toast({ title: t("settings.recycleBin.deleteError"), variant: "destructive" });
      },
    },
  });

  const items: DeletedEmployee[] = data ?? [];
  const dateFmt = new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Trash2 className="h-4 w-4" />
          {t("settings.recycleBin.title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">{t("settings.recycleBin.subtitle")}</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">{t("settings.recycleBin.loadError")}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-recycle-bin-empty">
            {t("settings.recycleBin.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-border" data-testid="list-recycle-bin">
            {items.map((emp) => {
              const name = `${emp.firstName} ${emp.lastName}`.trim();
              const days = emp.daysUntilPurge;
              const daysLabel =
                days === 0
                  ? t("settings.recycleBin.expiringSoon")
                  : days === 1
                    ? t("settings.recycleBin.daysLeftOne", { count: 1 })
                    : t("settings.recycleBin.daysLeft", { count: days });
              return (
                <li
                  key={emp.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 py-3"
                  data-testid={`row-recycle-bin-${emp.id}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {emp.avatarUrl ? (
                      <img src={emp.avatarUrl} alt={name} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {(emp.firstName[0] || "") + (emp.lastName[0] || "")}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-medium truncate">{name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {emp.title} · {emp.email}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {t("settings.recycleBin.deletedAt")}: {dateFmt.format(new Date(emp.deletedAt))} ·{" "}
                        {t("settings.recycleBin.deletedBy")}:{" "}
                        {emp.deletedByName || t("settings.recycleBin.deletedByUnknown")}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:items-end gap-2">
                    <Badge variant={days <= 3 ? "destructive" : "secondary"}>{daysLabel}</Badge>
                    <div className="flex gap-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" data-testid={`button-restore-${emp.id}`}>
                            <Undo2 className="h-4 w-4 me-1" />
                            {t("settings.recycleBin.restore")}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("settings.recycleBin.restoreTitle")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("settings.recycleBin.restoreDesc")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                restoreMutation.mutate({ orgId, id: emp.id })
                              }
                            >
                              {t("settings.recycleBin.restore")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive" data-testid={`button-delete-permanent-${emp.id}`}>
                            <Trash2 className="h-4 w-4 me-1" />
                            {t("settings.recycleBin.deletePermanent")}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("settings.recycleBin.deletePermanentTitle")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("settings.recycleBin.deletePermanentDesc", { name })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                deleteMutation.mutate({ orgId, id: emp.id })
                              }
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t("common.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function EmailDomainsCard({ orgId }: { orgId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [domain, setDomain] = useState("");

  const { data: domains, isLoading } = useListEmailDomains(orgId, {
    query: { queryKey: getListEmailDomainsQueryKey(orgId) },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListEmailDomainsQueryKey(orgId) });

  const createMutation = useCreateEmailDomain({
    mutation: {
      onSuccess: () => {
        setDomain("");
        invalidate();
        toast({ title: t("settings.emailDomainAdded") });
      },
      onError: (err: unknown) => {
        const message =
          (err as { message?: string })?.message || t("settings.emailDomainAddFailed");
        toast({ title: t("settings.error"), description: message, variant: "destructive" });
      },
    },
  });

  const deleteMutation = useDeleteEmailDomain({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: t("settings.emailDomainRemoved") });
      },
    },
  });

  const backfillMutation = useBackfillEmailDomain({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: t("settings.emailDomainBackfilled"),
          description: t("settings.emailDomainBackfilledDesc", { count: data.joined }),
        });
      },
      onError: (err: unknown) => {
        const message =
          (err as { message?: string })?.message || t("settings.emailDomainBackfillFailed");
        toast({ title: t("settings.error"), description: message, variant: "destructive" });
      },
    },
  });

  const verifyMutation = useVerifyEmailDomain({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: t("settings.emailDomainVerifySuccess") });
      },
      onError: (err: unknown) => {
        const message =
          (err as { message?: string })?.message || t("settings.emailDomainVerifyFailed");
        toast({
          title: t("settings.emailDomainVerifyFailed"),
          description: message,
          variant: "destructive",
        });
      },
    },
  });

  const revokeMutation = useRevokeEmailDomainVerification({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: t("settings.emailDomainRevoked") });
      },
    },
  });

  const handleAdd = () => {
    const trimmed = domain.trim().replace(/^@/, "").toLowerCase();
    if (!trimmed) return;
    createMutation.mutate({ orgId, data: { domain: trimmed } });
  };

  const copyToken = (token: string) => {
    void navigator.clipboard.writeText(`orgchart-verify=${token}`);
    toast({ title: t("settings.emailDomainTokenCopied") });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AtSign className="h-4 w-4" />
          {t("settings.emailDomainsTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.emailDomainsDesc")}
        </p>
        <div className="flex gap-2 mb-4">
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder={t("settings.emailDomainPlaceholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            data-testid="input-email-domain"
          />
          <Button
            onClick={handleAdd}
            disabled={createMutation.isPending || !domain.trim()}
            data-testid="button-add-email-domain"
          >
            <Plus className="h-4 w-4 me-2" />
            {t("settings.addDomain")}
          </Button>
        </div>
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : !domains || domains.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("settings.noEmailDomains")}</p>
        ) : (
          <div className="space-y-2">
            {domains.map((d) => {
              const verified = !!d.verifiedAt;
              const txtValue = `orgchart-verify=${d.verificationToken}`;
              return (
                <div
                  key={d.id}
                  className="rounded-md border border-border px-3 py-2 space-y-2"
                  data-testid={`row-email-domain-${d.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono">{d.domain}</span>
                      {verified ? (
                        <Badge
                          variant="secondary"
                          className="text-xs gap-1"
                          data-testid={`badge-domain-verified-${d.id}`}
                        >
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          {t("settings.emailDomainVerified")}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs gap-1"
                          data-testid={`badge-domain-pending-${d.id}`}
                        >
                          <AlertCircle className="h-3 w-3 text-amber-600" />
                          {t("settings.emailDomainPending")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {verified ? (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8"
                                onClick={() => backfillMutation.mutate({ orgId, id: d.id })}
                                disabled={
                                  backfillMutation.isPending &&
                                  backfillMutation.variables?.id === d.id
                                }
                                data-testid={`button-backfill-email-domain-${d.id}`}
                              >
                                <UserPlus className="h-4 w-4 me-1" />
                                {t("settings.backfillDomain")}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("settings.backfillDomainTooltip")}</TooltipContent>
                          </Tooltip>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => revokeMutation.mutate({ orgId, id: d.id })}
                            disabled={revokeMutation.isPending}
                            data-testid={`button-revoke-email-domain-${d.id}`}
                          >
                            <RefreshCw className="h-3.5 w-3.5 me-1.5" />
                            {t("settings.emailDomainRevoke")}
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => verifyMutation.mutate({ orgId, id: d.id })}
                          disabled={verifyMutation.isPending}
                          data-testid={`button-verify-email-domain-${d.id}`}
                        >
                          {t("settings.emailDomainVerify")}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteMutation.mutate({ orgId, id: d.id })}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-remove-email-domain-${d.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {!verified && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-xs text-muted-foreground">
                        {t("settings.emailDomainTxtInstructions")}
                      </p>
                      <div className="flex items-center gap-2">
                        <code
                          className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono break-all"
                          data-testid={`text-domain-txt-${d.id}`}
                        >
                          {txtValue}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 flex-shrink-0"
                          onClick={() => copyToken(d.verificationToken)}
                          data-testid={`button-copy-domain-token-${d.id}`}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface OrgExportRow {
  id: number;
  status: "pending" | "running" | "done" | "failed" | "expired";
  fileSize: number;
  rowCounts: Record<string, number>;
  error?: string | null;
  expiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
  downloadUrl?: string | null;
  requestedByName?: string | null;
}

function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function DataExportCard({ orgId }: { orgId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [exports, setExports] = useState<OrgExportRow[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/organizations/${orgId}/exports`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const d = (await res.json()) as { exports: OrgExportRow[] };
      setExports(d.exports ?? []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const hasInflight = exports.some((e) => e.status === "pending" || e.status === "running");

  useEffect(() => {
    if (!hasInflight) return;
    const handle = window.setInterval(load, 5000);
    return () => window.clearInterval(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInflight, orgId]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const res = await fetch(`${API_BASE}/organizations/${orgId}/exports`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      toast({ title: t("settings.exportDataQueued") });
      await load();
    } catch (e) {
      toast({
        title: t("settings.error"),
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDownload = async (row: OrgExportRow) => {
    if (!row.downloadUrl) return;
    try {
      const res = await fetch(row.downloadUrl, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orgchart-export-${row.id}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({
        title: t("settings.error"),
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };

  const statusBadge = (s: OrgExportRow["status"]) => {
    if (s === "done") return <Badge variant="default">{t("settings.exportStatusDone")}</Badge>;
    if (s === "running")
      return <Badge variant="secondary">{t("settings.exportStatusInProgress")}</Badge>;
    if (s === "pending")
      return <Badge variant="secondary">{t("settings.exportStatusPending")}</Badge>;
    if (s === "failed")
      return <Badge variant="destructive">{t("settings.exportStatusFailed")}</Badge>;
    return <Badge variant="outline">{t("settings.exportStatusExpired")}</Badge>;
  };

  return (
    <Card data-testid="card-data-export">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Database className="h-4 w-4" />
          {t("settings.exportDataTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{t("settings.exportDataDesc")}</p>
        <Button
          onClick={handleCreate}
          disabled={isCreating || hasInflight}
          data-testid="button-export-data"
        >
          <Download className="h-4 w-4 me-2" />
          {hasInflight ? t("settings.exportDataInProgress") : t("settings.exportDataButton")}
        </Button>

        {!isLoading && exports.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-semibold mb-2">{t("settings.exportHistoryTitle")}</h4>
            <ul className="space-y-2" data-testid="list-data-exports">
              {exports.map((row) => {
                const total = Object.values(row.rowCounts || {}).reduce(
                  (acc, n) => acc + (n || 0),
                  0,
                );
                return (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded border bg-muted/30 px-3 py-2 text-sm"
                    data-testid={`row-data-export-${row.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {statusBadge(row.status)}
                        <span className="text-muted-foreground">
                          {new Date(row.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {row.status === "done" && (
                          <>
                            {formatBytes(row.fileSize)} ·{" "}
                            {t("settings.exportRowCount", { count: total })}
                            {row.expiresAt && (
                              <>
                                {" · "}
                                {t("settings.exportExpires", {
                                  date: new Date(row.expiresAt).toLocaleDateString(),
                                })}
                              </>
                            )}
                          </>
                        )}
                        {row.status === "failed" && row.error && (
                          <span className="text-destructive">{row.error}</span>
                        )}
                      </div>
                    </div>
                    {row.status === "done" && row.downloadUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(row)}
                        data-testid={`button-download-export-${row.id}`}
                      >
                        <Download className="h-4 w-4 me-2" />
                        {t("common.download")}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UsersTab({ orgId }: { orgId: number }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user: authUser, hasPermission } = useAuth();
  const canCreateUser = hasPermission("users", "create");
  const canEditUser = hasPermission("users", "edit");
  const canDeleteUser = hasPermission("users", "delete");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRoleId, setFormRoleId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch(`${API_BASE}/organizations/${orgId}/users`, { credentials: "include" }),
        fetch(`${API_BASE}/organizations/${orgId}/roles`, { credentials: "include" }),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (rolesRes.ok) setRoles(await rolesRes.json());
    } catch (err) {
      console.error("Failed to fetch users/roles:", err);
    }
    setIsLoading(false);
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRoleId("");
    setIsDialogOpen(true);
  };

  const openEdit = (u: AppUser) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPassword("");
    setFormRoleId(u.roles.length > 0 ? String(u.roles[0].id) : "");
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      if (editingUser) {
        const body: Record<string, unknown> = { name: formName, email: formEmail };
        if (formPassword) body.password = formPassword;
        if (formRoleId) body.roleId = parseInt(formRoleId, 10);
        else body.roleId = null;

        const res = await fetch(`${API_BASE}/organizations/${orgId}/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          toast({ title: t("settings.error"), description: err.message, variant: "destructive" });
          setIsSaving(false);
          return;
        }
        toast({ title: t("settings.userUpdated") });
      } else {
        const res = await fetch(`${API_BASE}/organizations/${orgId}/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: formName,
            email: formEmail,
            password: formPassword,
            roleId: formRoleId ? parseInt(formRoleId, 10) : undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast({ title: t("settings.error"), description: err.message, variant: "destructive" });
          setIsSaving(false);
          return;
        }
        toast({ title: t("settings.userCreated") });
      }
      setIsDialogOpen(false);
      fetchData();
    } catch {
      toast({ title: t("settings.error"), description: t("settings.failedSaveUser"), variant: "destructive" });
    }
    setIsSaving(false);
  };

  const toggleActive = async (u: AppUser) => {
    await fetch(`${API_BASE}/organizations/${orgId}/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    fetchData();
    toast({ title: u.isActive ? t("settings.userDeactivated") : t("settings.userActivated") });
  };

  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    await fetch(`${API_BASE}/organizations/${orgId}/users/${userToDelete.id}`, { method: "DELETE", credentials: "include" });
    setUserToDelete(null);
    fetchData();
    toast({ title: t("settings.userDeleted") });
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("settings.userManagement")}</h2>
          <p className="text-sm text-muted-foreground">{t("settings.usersInOrg", { count: users.length })}</p>
        </div>
        {canCreateUser && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={openAdd} data-testid="button-add-user">
                <Plus className="h-4 w-4 me-2" />
                {t("settings.addUser")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("tooltips.addUser")}</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="space-y-3">
        {users.map((u) => (
          <Card key={u.id}>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
                {u.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate">{u.name}</p>
                  {!u.isActive && <Badge variant="secondary" className="text-xs">{t("common.inactive")}</Badge>}
                  {u.id === authUser?.id && <Badge variant="outline" className="text-xs">{t("common.you")}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {u.roles.map((r) => (
                  <Badge key={r.id} variant="secondary">{r.name}</Badge>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {canEditUser && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("tooltips.editUser")}</TooltipContent>
                  </Tooltip>
                )}
                {u.id !== authUser?.id && (
                  <>
                    {canEditUser && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(u)}>
                            {u.isActive ? <Ban className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{u.isActive ? t("tooltips.deactivateUser") : t("tooltips.activateUser")}</TooltipContent>
                      </Tooltip>
                    )}
                    {canDeleteUser && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setUserToDelete(u)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("tooltips.deleteUser")}</TooltipContent>
                      </Tooltip>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? t("settings.editUser") : t("settings.addNewUser")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>{t("common.name")}</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder={t("settings.fullName")} />
            </div>
            <div>
              <Label>{t("common.email")}</Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder={t("settings.emailPlaceholder")} />
            </div>
            <div>
              <Label>{editingUser ? t("settings.newPasswordHint") : t("common.password")}</Label>
              <Input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder={editingUser ? t("settings.leaveBlank") : t("settings.passwordPlaceholder")} />
            </div>
            <div>
              <Label>{t("settings.role")}</Label>
              <Select value={formRoleId || "none"} onValueChange={(v) => setFormRoleId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("settings.selectRole")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("settings.noRole")}</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleSubmit} disabled={isSaving || !formName || !formEmail || (!editingUser && !formPassword)}>
                {isSaving ? t("common.saving") : editingUser ? t("settings.saveChanges") : t("settings.createUser")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => { if (!open) setUserToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDialog.areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmDialog.deleteUserDesc", { name: userToDelete?.name || "" })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirmDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("confirmDialog.confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const RESOURCE_KEYS = ["employees", "departments", "organizations", "users", "roles"] as const;
const ACTIONS = ["view", "create", "edit", "delete"] as const;
const ACTION_ICONS: Record<string, typeof Eye> = { view: Eye, create: FilePlus, edit: PenLine, delete: Trash2 };

function RolesTab({ orgId }: { orgId: number }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { refreshUser, hasPermission } = useAuth();
  const canCreateRole = hasPermission("roles", "create");
  const canEditRole = hasPermission("roles", "edit");
  const canDeleteRole = hasPermission("roles", "delete");
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [editingRole, setEditingRole] = useState<AppRole | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        fetch(`${API_BASE}/organizations/${orgId}/roles`, { credentials: "include" }),
        fetch(`${API_BASE}/organizations/${orgId}/permissions`, { credentials: "include" }),
      ]);
      if (rolesRes.ok) {
        const r = await rolesRes.json();
        setRoles(r);
        if (!selectedRole && r.length > 0) setSelectedRole(r[0]);
        if (selectedRole) {
          const updated = r.find((role: AppRole) => role.id === selectedRole.id);
          if (updated) setSelectedRole(updated);
        }
      }
      if (permsRes.ok) setAllPermissions(await permsRes.json());
    } catch (err) {
      console.error("Failed to fetch roles/permissions:", err);
    }
    setIsLoading(false);
  }, [orgId, selectedRole]);

  useEffect(() => { fetchData(); }, [orgId]);

  const openCreateRole = () => {
    setEditingRole(null);
    setRoleName("");
    setRoleDesc("");
    setSelectedPerms(new Set());
    setIsDialogOpen(true);
  };

  const openEditRole = (role: AppRole) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDesc(role.description || "");
    setSelectedPerms(new Set(role.permissions.map(p => p.id)));
    setIsDialogOpen(true);
  };

  const handleSaveRole = async () => {
    setIsSaving(true);
    try {
      if (editingRole) {
        const res = await fetch(`${API_BASE}/organizations/${orgId}/roles/${editingRole.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: roleName, description: roleDesc || null, permissionIds: Array.from(selectedPerms) }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast({ title: t("settings.error"), description: err.message, variant: "destructive" });
        } else {
          toast({ title: t("settings.roleUpdated") });
          refreshUser();
        }
      } else {
        const res = await fetch(`${API_BASE}/organizations/${orgId}/roles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: roleName, description: roleDesc || null, permissionIds: Array.from(selectedPerms) }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast({ title: t("settings.error"), description: err.message, variant: "destructive" });
        } else {
          toast({ title: t("settings.roleCreated") });
        }
      }
      setIsDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error("Failed to save role:", err);
    }
    setIsSaving(false);
  };

  const [roleToDelete, setRoleToDelete] = useState<AppRole | null>(null);

  const confirmDeleteRole = async () => {
    if (!roleToDelete) return;
    const res = await fetch(`${API_BASE}/organizations/${orgId}/roles/${roleToDelete.id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: t("settings.error"), description: err.message, variant: "destructive" });
      setRoleToDelete(null);
      return;
    }
    toast({ title: t("settings.roleDeleted") });
    if (selectedRole?.id === roleToDelete.id) setSelectedRole(null);
    setRoleToDelete(null);
    fetchData();
  };

  const togglePermission = async (role: AppRole, permId: number) => {
    const currentIds = new Set(role.permissions.map(p => p.id));
    if (currentIds.has(permId)) {
      currentIds.delete(permId);
    } else {
      currentIds.add(permId);
    }

    await fetch(`${API_BASE}/organizations/${orgId}/roles/${role.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ permissionIds: Array.from(currentIds) }),
    });
    fetchData();
    refreshUser();
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div>;
  }

  const getPermId = (resource: string, action: string) => {
    return allPermissions.find(p => p.resource === resource && p.action === action)?.id;
  };

  const actionTranslations: Record<string, string> = {
    view: t("settings.view"),
    create: t("settings.create"),
    edit: t("settings.edit"),
    delete: t("common.delete"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("settings.rolesAndPerms")}</h2>
          <p className="text-sm text-muted-foreground">{t("settings.configureAccess")}</p>
        </div>
        {canCreateRole && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={openCreateRole} data-testid="button-add-role">
                <Plus className="h-4 w-4 me-2" />
                {t("settings.createRole")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("tooltips.createRole")}</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex gap-4">
        <div className="w-56 space-y-2">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role)}
              className={`w-full text-start px-3 py-2.5 rounded-lg text-sm transition-colors ${
                selectedRole?.id === role.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <div className="font-medium flex items-center justify-between">
                {role.name}
                {role.isSystemRole && <Badge variant="outline" className={`text-[10px] ms-1 ${selectedRole?.id === role.id ? "border-primary-foreground/30 text-primary-foreground" : ""}`}>{t("common.system")}</Badge>}
              </div>
              <div className={`text-xs mt-0.5 ${selectedRole?.id === role.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {role.permissions.length} {t("settings.permissions")}
              </div>
            </button>
          ))}
        </div>

        {selectedRole && (
          <Card className="flex-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{selectedRole.name}</CardTitle>
                  {selectedRole.description && (
                    <p className="text-sm text-muted-foreground mt-1">{selectedRole.description}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  {canEditRole && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => openEditRole(selectedRole)}>
                          <Edit2 className="h-4 w-4 me-1" />
                          {t("common.edit")}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("tooltips.editRole")}</TooltipContent>
                    </Tooltip>
                  )}
                  {canDeleteRole && !selectedRole.isSystemRole && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRoleToDelete(selectedRole)}>
                          <Trash2 className="h-4 w-4 me-1" />
                          {t("common.delete")}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("tooltips.deleteRole")}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-start px-4 py-2.5 font-medium text-muted-foreground">{t("settings.resource")}</th>
                      {ACTIONS.map((action) => {
                        const Icon = ACTION_ICONS[action];
                        return (
                          <th key={action} className="text-center px-3 py-2.5 font-medium text-muted-foreground">
                            <div className="flex items-center justify-center gap-1">
                              <Icon className="h-3.5 w-3.5" />
                              <span className="capitalize">{actionTranslations[action]}</span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {RESOURCE_KEYS.map((resource) => (
                      <tr key={resource} className="border-t">
                        <td className="px-4 py-2.5 font-medium">{t(`settings.resources.${resource}`)}</td>
                        {ACTIONS.map((action) => {
                          const permId = getPermId(resource, action);
                          const hasPerm = selectedRole.permissions.some(p => p.resource === resource && p.action === action);
                          return (
                            <td key={action} className="text-center px-3 py-2.5">
                              <Checkbox
                                checked={hasPerm}
                                disabled={!canEditRole}
                                onCheckedChange={() => permId && togglePermission(selectedRole, permId)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRole ? t("settings.editRole") : t("settings.createNewRole")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>{t("settings.roleName")}</Label>
              <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder={t("settings.roleNamePlaceholder")} />
            </div>
            <div>
              <Label>{t("common.description")}</Label>
              <Input value={roleDesc} onChange={(e) => setRoleDesc(e.target.value)} placeholder={t("settings.roleDesc")} />
            </div>
            <div>
              <Label className="mb-2 block">{t("settings.permissionsLabel")}</Label>
              <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 sticky top-0">
                      <th className="text-start px-3 py-2 font-medium text-muted-foreground">{t("settings.resource")}</th>
                      {ACTIONS.map(a => (
                        <th key={a} className="text-center px-2 py-2 font-medium text-muted-foreground capitalize text-xs">{actionTranslations[a]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {RESOURCE_KEYS.map(r => (
                      <tr key={r} className="border-t">
                        <td className="px-3 py-2 font-medium text-sm">{t(`settings.resources.${r}`)}</td>
                        {ACTIONS.map(a => {
                          const perm = allPermissions.find(p => p.resource === r && p.action === a);
                          return (
                            <td key={a} className="text-center px-2 py-2">
                              <Checkbox
                                checked={perm ? selectedPerms.has(perm.id) : false}
                                onCheckedChange={() => {
                                  if (!perm) return;
                                  const next = new Set(selectedPerms);
                                  if (next.has(perm.id)) next.delete(perm.id);
                                  else next.add(perm.id);
                                  setSelectedPerms(next);
                                }}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleSaveRole} disabled={isSaving || !roleName}>
                {isSaving ? t("common.saving") : editingRole ? t("settings.saveChanges") : t("settings.createRole")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!roleToDelete} onOpenChange={(open) => { if (!open) setRoleToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDialog.areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmDialog.deleteRoleDesc", { name: roleToDelete?.name || "" })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirmDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRole}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("confirmDialog.confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InvitationsTab({ orgId }: { orgId: number }) {
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = hasPermission("users", "create");
  const canEdit = hasPermission("users", "edit");
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formRoleId, setFormRoleId] = useState("");
  const [lastInviteUrl, setLastInviteUrl] = useState<string>("");
  const [invToCancel, setInvToCancel] = useState<Invitation | null>(null);

  const { data: invitations = [], isLoading: invLoading } = useListInvitations(orgId, {
    query: { queryKey: getListInvitationsQueryKey(orgId) },
  });
  const isLoading = invLoading || rolesLoading;

  const invalidateInvitations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListInvitationsQueryKey(orgId) });
  }, [queryClient, orgId]);

  const fetchRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const rolesRes = await fetch(`${API_BASE}/organizations/${orgId}/roles`, { credentials: "include" });
      if (rolesRes.ok) setRoles(await rolesRes.json());
    } catch (err) {
      console.error("Failed to fetch roles:", err);
    }
    setRolesLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const createMutation = useCreateInvitation({
    mutation: {
      onSuccess: (data) => {
        setLastInviteUrl(data.acceptUrl || "");
        toast({
          title: t("settings.invitations.created"),
          description: data.emailSent
            ? t("settings.invitations.emailSent", { email: formEmail })
            : t("settings.invitations.emailNotConfigured"),
        });
        invalidateInvitations();
      },
      onError: (err) => {
        toast({
          title: t("settings.error"),
          description: (err as Error)?.message || t("settings.invitations.failedCreate"),
          variant: "destructive",
        });
      },
    },
  });

  const resendMutation = useResendInvitation({
    mutation: {
      onError: (err) => {
        toast({
          title: t("settings.error"),
          description: (err as Error)?.message || t("settings.invitations.failedResend"),
          variant: "destructive",
        });
      },
    },
  });

  const cancelMutation = useCancelInvitation({
    mutation: {
      onSuccess: () => {
        invalidateInvitations();
        toast({ title: t("settings.invitations.cancelled") });
      },
    },
  });

  const openInvite = () => {
    setFormEmail("");
    setFormRoleId("");
    setLastInviteUrl("");
    setIsDialogOpen(true);
  };

  const isSaving = createMutation.isPending;

  const handleSubmit = () => {
    createMutation.mutate({
      orgId,
      data: { email: formEmail, roleId: parseInt(formRoleId, 10) },
    });
  };

  const handleResend = (inv: Invitation) => {
    resendMutation.mutate(
      { orgId, id: inv.id },
      {
        onSuccess: (data) => {
          toast({
            title: t("settings.invitations.resent"),
            description: data.emailSent
              ? t("settings.invitations.emailSent", { email: inv.email })
              : t("settings.invitations.emailNotConfigured"),
          });
          invalidateInvitations();
        },
      },
    );
  };

  const confirmCancel = () => {
    if (!invToCancel) return;
    const id = invToCancel.id;
    setInvToCancel(null);
    cancelMutation.mutate({ orgId, id });
  };

  const copyInviteUrl = (url: string) => {
    void navigator.clipboard.writeText(url);
    toast({ title: t("settings.invitations.linkCopied") });
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>;
  }

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString(i18n.language === "ar" ? "ar" : undefined, {
        year: "numeric", month: "short", day: "numeric",
      });
    } catch {
      return s;
    }
  };

  const statusBadge = (status: Invitation["status"]) => {
    const variant: "default" | "secondary" | "destructive" | "outline" =
      status === "pending" ? "default"
      : status === "accepted" ? "secondary"
      : "outline";
    return (
      <Badge variant={variant} className="text-xs" data-testid={`badge-invite-status-${status}`}>
        {t(`settings.invitations.status.${status}`)}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("settings.invitations.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("settings.invitations.subtitle")}</p>
        </div>
        {canCreate && (
          <Button onClick={openInvite} data-testid="button-invite-member">
            <Plus className="h-4 w-4 me-2" />
            {t("settings.invitations.inviteMember")}
          </Button>
        )}
      </div>

      {invitations.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("settings.invitations.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invitations.map((inv) => (
            <Card key={inv.id} data-testid={`row-invitation-${inv.id}`}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">{inv.email}</p>
                    {statusBadge(inv.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.invitations.metaLine", {
                      role: inv.roleName,
                      by: inv.invitedByName || t("common.system"),
                      date: formatDate(inv.createdAt),
                    })}
                  </p>
                  {inv.status === "pending" && (
                    <p className="text-xs text-muted-foreground">
                      {t("settings.invitations.expiresOn", { date: formatDate(inv.expiresAt) })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {inv.status === "pending" && canEdit && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleResend(inv)} data-testid={`button-resend-${inv.id}`}>
                            <Send className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("settings.invitations.resend")}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setInvToCancel(inv)} data-testid={`button-cancel-${inv.id}`}>
                            <X className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("settings.invitations.cancel")}</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.invitations.inviteMember")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>{t("common.email")}</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder={t("settings.emailPlaceholder")}
                data-testid="input-invite-email"
              />
            </div>
            <div>
              <Label>{t("settings.role")}</Label>
              <Select value={formRoleId} onValueChange={setFormRoleId}>
                <SelectTrigger data-testid="select-invite-role">
                  <SelectValue placeholder={t("settings.selectRole")} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {lastInviteUrl && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t("settings.invitations.shareLink")}</Label>
                <div className="flex items-center gap-2">
                  <Input value={lastInviteUrl} readOnly className="text-xs" data-testid="input-invite-url" />
                  <Button variant="outline" size="icon" onClick={() => copyInviteUrl(lastInviteUrl)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t("common.cancel")}</Button>
              <Button
                onClick={handleSubmit}
                disabled={isSaving || !formEmail || !formRoleId}
                data-testid="button-send-invite"
              >
                {isSaving ? t("common.saving") : t("settings.invitations.sendInvite")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!invToCancel} onOpenChange={(open) => { if (!open) setInvToCancel(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDialog.areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.invitations.cancelConfirm", { email: invToCancel?.email || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirmDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("confirmDialog.confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function JoinRequestsTab({ orgId }: { orgId: number }) {
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const canApprove = hasPermission("users", "create");
  const canReject = hasPermission("users", "edit");
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [approveTarget, setApproveTarget] = useState<JoinRequest | null>(null);
  const [approveRoleId, setApproveRoleId] = useState<string>("");
  const [rejectTarget, setRejectTarget] = useState<JoinRequest | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reqRes, rolesRes] = await Promise.all([
        fetch(`${API_BASE}/organizations/${orgId}/join-requests`, { credentials: "include" }),
        fetch(`${API_BASE}/organizations/${orgId}/roles`, { credentials: "include" }),
      ]);
      if (reqRes.ok) setRequests(await reqRes.json());
      if (rolesRes.ok) setRoles(await rolesRes.json());
    } catch (err) {
      console.error("Failed to fetch join requests:", err);
    }
    setIsLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openApprove = (req: JoinRequest) => {
    const viewer = roles.find((r) => r.name.toLowerCase() === "viewer");
    setApproveRoleId(viewer ? String(viewer.id) : roles[0] ? String(roles[0].id) : "");
    setApproveTarget(req);
  };

  const submitApprove = async () => {
    if (!approveTarget) return;
    setBusyId(approveTarget.id);
    try {
      const res = await fetch(
        `${API_BASE}/organizations/${orgId}/join-requests/${approveTarget.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(approveRoleId ? { roleId: parseInt(approveRoleId, 10) } : {}),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: t("settings.joinRequests.failed"), description: err.message, variant: "destructive" });
      } else {
        toast({ title: t("settings.joinRequests.approved") });
        await fetchData();
      }
    } catch {
      toast({ title: t("settings.joinRequests.failed"), variant: "destructive" });
    }
    setApproveTarget(null);
    setBusyId(null);
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    try {
      const res = await fetch(
        `${API_BASE}/organizations/${orgId}/join-requests/${rejectTarget.id}/reject`,
        { method: "POST", credentials: "include" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: t("settings.joinRequests.failed"), description: err.message, variant: "destructive" });
      } else {
        toast({ title: t("settings.joinRequests.rejected") });
        await fetchData();
      }
    } catch {
      toast({ title: t("settings.joinRequests.failed"), variant: "destructive" });
    }
    setRejectTarget(null);
    setBusyId(null);
  };

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString(i18n.language === "ar" ? "ar" : undefined, {
        year: "numeric", month: "short", day: "numeric",
      });
    } catch {
      return s;
    }
  };

  const statusBadge = (status: JoinRequest["status"]) => {
    const variant: "default" | "secondary" | "destructive" | "outline" =
      status === "pending" ? "default"
      : status === "approved" ? "secondary"
      : status === "rejected" ? "destructive"
      : "outline";
    return (
      <Badge variant={variant} className="text-xs" data-testid={`badge-jr-status-${status}`}>
        {t(`settings.joinRequests.status.${status}`)}
      </Badge>
    );
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>;
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("settings.joinRequests.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("settings.joinRequests.subtitle")}</p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="default" data-testid="badge-jr-pending-count">
            {t("settings.joinRequests.pendingBadge", { count: pendingCount })}
          </Badge>
        )}
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground" data-testid="text-jr-empty">
            {t("settings.joinRequests.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <Card key={req.id} data-testid={`row-join-request-${req.id}`}>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">{req.userName}</p>
                      {statusBadge(req.status)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{req.userEmail}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("settings.joinRequests.requestedOn", { date: formatDate(req.createdAt) })}
                    </p>
                    {req.reviewedByName && req.reviewedAt && (
                      <p className="text-xs text-muted-foreground">
                        {t("settings.joinRequests.reviewedBy", {
                          name: req.reviewedByName,
                          date: formatDate(req.reviewedAt),
                        })}
                      </p>
                    )}
                  </div>
                  {req.status === "pending" && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {canApprove && (
                        <Button
                          size="sm"
                          onClick={() => openApprove(req)}
                          disabled={busyId === req.id}
                          data-testid={`button-approve-jr-${req.id}`}
                        >
                          <Check className="h-3.5 w-3.5 me-1" />
                          {t("settings.joinRequests.approve")}
                        </Button>
                      )}
                      {canReject && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRejectTarget(req)}
                          disabled={busyId === req.id}
                          data-testid={`button-reject-jr-${req.id}`}
                        >
                          <X className="h-3.5 w-3.5 me-1" />
                          {t("settings.joinRequests.reject")}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {req.message && (
                  <div className="rounded-md bg-muted/40 px-3 py-2 ms-14">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("settings.joinRequests.messageFrom")}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{req.message}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!approveTarget} onOpenChange={(open) => { if (!open) setApproveTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {approveTarget ? t("settings.joinRequests.approveTitle", { name: approveTarget.userName }) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">{t("settings.joinRequests.approveDesc")}</p>
            <div>
              <Label>{t("settings.joinRequests.assignRole")}</Label>
              <Select value={approveRoleId} onValueChange={setApproveRoleId}>
                <SelectTrigger data-testid="select-jr-role">
                  <SelectValue placeholder={t("settings.selectRole")} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setApproveTarget(null)}>{t("common.cancel")}</Button>
              <Button onClick={submitApprove} disabled={!approveRoleId} data-testid="button-confirm-approve-jr">
                <Check className="h-4 w-4 me-2" />
                {t("settings.joinRequests.approve")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) setRejectTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDialog.areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription>
              {rejectTarget ? t("settings.joinRequests.rejectConfirm", { name: rejectTarget.userName }) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirmDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={submitReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-reject-jr"
            >
              {t("settings.joinRequests.reject")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ApiTokensTab({ orgId }: { orgId: number }) {
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formExpires, setFormExpires] = useState("");
  const [createdSecret, setCreatedSecret] = useState<string>("");
  const [tokenToRevoke, setTokenToRevoke] = useState<ApiToken | null>(null);

  const { data: tokens = [], isLoading } = useListApiTokens(orgId);
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListApiTokensQueryKey(orgId) });

  const createMutation = useCreateApiToken({
    mutation: {
      onSuccess: (data) => {
        setCreatedSecret(data.secret);
        toast({ title: t("settings.apiTokens.created") });
        invalidate();
      },
      onError: (err) => {
        toast({
          title: t("settings.error"),
          description: (err as Error)?.message || t("settings.apiTokens.failedCreate"),
          variant: "destructive",
        });
      },
    },
  });

  const revokeMutation = useRevokeApiToken({
    mutation: {
      onSuccess: () => {
        toast({ title: t("settings.apiTokens.revoked") });
        invalidate();
      },
    },
  });

  const openCreate = () => {
    setFormName("");
    setFormExpires("");
    setCreatedSecret("");
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    createMutation.mutate({
      orgId,
      data: {
        name: formName.trim(),
        expiresAt: formExpires ? formExpires : null,
      },
    });
  };

  const confirmRevoke = () => {
    if (!tokenToRevoke) return;
    revokeMutation.mutate({ orgId, id: tokenToRevoke.id });
    setTokenToRevoke(null);
  };

  const isSaving = createMutation.isPending;

  const copySecret = (s: string) => {
    void navigator.clipboard.writeText(s);
    toast({ title: t("settings.apiTokens.copied") });
  };

  const formatDate = (s: string | null) => {
    if (!s) return "";
    try {
      return new Date(s).toLocaleDateString(i18n.language === "ar" ? "ar" : undefined, {
        year: "numeric", month: "short", day: "numeric",
      });
    } catch {
      return s;
    }
  };

  const statusBadge = (status: ApiToken["status"]) => {
    const variant: "default" | "secondary" | "outline" =
      status === "active" ? "default" : status === "revoked" ? "outline" : "secondary";
    return (
      <Badge variant={variant} className="text-xs" data-testid={`badge-token-status-${status}`}>
        {t(`settings.apiTokens.status.${status}`)}
      </Badge>
    );
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>;
  }

  const exampleCurl = `curl -H "Authorization: Bearer YOUR_TOKEN" \\\n  ${window.location.origin}${import.meta.env.BASE_URL.replace( /\/$/, "")}/api/organizations/${orgId}/employees`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("settings.apiTokens.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("settings.apiTokens.subtitle")}</p>
        </div>
        <Button onClick={openCreate} data-testid="button-new-token">
          <Plus className="h-4 w-4 me-2" />
          {t("settings.apiTokens.newToken")}
        </Button>
      </div>

      {tokens.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("settings.apiTokens.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tokens.map((tk) => (
            <Card key={tk.id} data-testid={`row-token-${tk.id}`}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Key className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">{tk.name}</p>
                    <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">…{tk.lastFour}</code>
                    {statusBadge(tk.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.apiTokens.createdBy", { name: tk.userName || t("common.system"), date: formatDate(tk.createdAt) })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tk.lastUsedAt
                      ? `${t("settings.apiTokens.lastUsed")}: ${formatDate(tk.lastUsedAt)}${tk.lastUsedIp ? ` · ${tk.lastUsedIp}` : ""}`
                      : t("settings.apiTokens.neverUsed")}
                    {tk.expiresAt ? ` · ${t("settings.apiTokens.expires", { date: formatDate(tk.expiresAt) })}` : ""}
                  </p>
                </div>
                {tk.status === "active" && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setTokenToRevoke(tk)}
                        data-testid={`button-revoke-${tk.id}`}
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("settings.apiTokens.revoke")}</TooltipContent>
                  </Tooltip>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{t("settings.apiTokens.docsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">{t("settings.apiTokens.docsBody")}</p>
          <pre className="text-xs bg-muted rounded p-3 overflow-x-auto whitespace-pre" data-testid="text-curl-example">{exampleCurl}</pre>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setCreatedSecret(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.apiTokens.createTitle")}</DialogTitle>
          </DialogHeader>
          {!createdSecret ? (
            <div className="space-y-4 mt-2">
              <div>
                <Label>{t("settings.apiTokens.tokenName")}</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t("settings.apiTokens.tokenNamePlaceholder")}
                  data-testid="input-token-name"
                />
              </div>
              <div>
                <Label>{t("settings.apiTokens.expiresAt")}</Label>
                <Input
                  type="date"
                  value={formExpires}
                  onChange={(e) => setFormExpires(e.target.value)}
                  data-testid="input-token-expires"
                />
                {!formExpires && (
                  <p className="text-xs text-muted-foreground mt-1">{t("settings.apiTokens.noExpiry")}</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t("common.cancel")}</Button>
                <Button
                  onClick={handleCreate}
                  disabled={isSaving || !formName.trim()}
                  data-testid="button-create-token"
                >
                  {isSaving ? t("common.saving") : t("settings.apiTokens.create")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                {t("settings.apiTokens.revealOnce")}
              </p>
              <div className="flex items-center gap-2">
                <Input value={createdSecret} readOnly className="font-mono text-xs" data-testid="input-token-secret" />
                <Button variant="outline" size="icon" onClick={() => copySecret(createdSecret)} data-testid="button-copy-token">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={() => setIsDialogOpen(false)} data-testid="button-token-done">
                  {t("settings.apiTokens.done")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!tokenToRevoke} onOpenChange={(open) => { if (!open) setTokenToRevoke(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDialog.areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.apiTokens.revokeConfirm", { name: tokenToRevoke?.name || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirmDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("settings.apiTokens.revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
  "employee.created",
  "employee.updated",
  "employee.deleted",
  "position.opened",
  "position.filled",
  "snapshot.created",
];

function WebhooksTab({ orgId }: { orgId: number }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: endpoints = [], isLoading } = useListWebhookEndpoints(orgId);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WebhookEndpoint | null>(null);
  const [formUrl, setFormUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formEvents, setFormEvents] = useState<WebhookEventType[]>([]);
  const [createdSecret, setCreatedSecret] = useState<string>("");
  const [endpointToDelete, setEndpointToDelete] = useState<WebhookEndpoint | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<WebhookEndpoint | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListWebhookEndpointsQueryKey(orgId) });

  const createMutation = useCreateWebhookEndpoint({
    mutation: {
      onSuccess: (data) => {
        setCreatedSecret(data.secret);
        invalidate();
        toast({ title: t("settings.webhooks.created") });
      },
      onError: (err) => {
        toast({
          title: t("settings.error"),
          description: (err as Error)?.message || t("settings.webhooks.failedCreate"),
          variant: "destructive",
        });
      },
    },
  });

  const updateMutation = useUpdateWebhookEndpoint({
    mutation: {
      onSuccess: () => {
        invalidate();
        setIsDialogOpen(false);
        toast({ title: t("settings.webhooks.updated") });
      },
      onError: (err) => {
        toast({
          title: t("settings.error"),
          description: (err as Error)?.message || t("settings.webhooks.failedUpdate"),
          variant: "destructive",
        });
      },
    },
  });

  const deleteMutation = useDeleteWebhookEndpoint({
    mutation: {
      onSuccess: () => {
        invalidate();
        setEndpointToDelete(null);
        toast({ title: t("settings.webhooks.deleted") });
      },
    },
  });

  const testMutation = useTestWebhookEndpoint({
    mutation: {
      onSuccess: (delivery) => {
        invalidate();
        if (deliveriesFor) {
          queryClient.invalidateQueries({
            queryKey: getListWebhookDeliveriesQueryKey(orgId, deliveriesFor.id),
          });
        }
        if (delivery.status === "success") {
          toast({
            title: t("settings.webhooks.testOk"),
            description: t("settings.webhooks.testOkDesc", {
              code: delivery.lastStatusCode ?? "—",
              ms: delivery.latencyMs ?? 0,
            }),
          });
        } else {
          toast({
            title: t("settings.webhooks.testFailed"),
            description: delivery.lastError || `HTTP ${delivery.lastStatusCode ?? "?"}`,
            variant: "destructive",
          });
        }
      },
      onError: (err) => {
        toast({
          title: t("settings.webhooks.testFailed"),
          description: (err as Error)?.message || "",
          variant: "destructive",
        });
      },
      onSettled: () => setTestingId(null),
    },
  });

  const toggleMutation = useUpdateWebhookEndpoint({
    mutation: {
      onSuccess: () => invalidate(),
    },
  });

  const openCreate = () => {
    setEditing(null);
    setFormUrl("");
    setFormDescription("");
    setFormEvents([WEBHOOK_EVENT_TYPES[0]]);
    setCreatedSecret("");
    setIsDialogOpen(true);
  };
  const openEdit = (ep: WebhookEndpoint) => {
    setEditing(ep);
    setFormUrl(ep.url);
    setFormDescription(ep.description ?? "");
    setFormEvents(ep.eventTypes);
    setCreatedSecret("");
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    const url = formUrl.trim();
    const description = formDescription.trim() || null;
    if (editing) {
      updateMutation.mutate({
        orgId,
        id: editing.id,
        data: { url, description, eventTypes: formEvents },
      });
    } else {
      createMutation.mutate({
        orgId,
        data: { url, description, eventTypes: formEvents, enabled: true },
      });
    }
  };

  const toggleEvent = (e: WebhookEventType) => {
    setFormEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  };

  const handleTest = (ep: WebhookEndpoint) => {
    setTestingId(ep.id);
    testMutation.mutate({ orgId, id: ep.id });
  };

  const handleToggle = (ep: WebhookEndpoint, enabled: boolean) => {
    toggleMutation.mutate({ orgId, id: ep.id, data: { enabled } });
  };

  const copySecret = (s: string) => {
    void navigator.clipboard.writeText(s);
    toast({ title: t("settings.webhooks.secretCopied") });
  };

  const formatDate = (s: string | null | undefined) => {
    if (!s) return "—";
    try {
      return new Date(s).toLocaleString(i18n.language === "ar" ? "ar" : undefined, {
        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return s;
    }
  };

  const isFormValid = formUrl.trim().startsWith("https://") && formEvents.length > 0;

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("settings.webhooks.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("settings.webhooks.subtitle")}</p>
        </div>
        <Button onClick={openCreate} data-testid="button-new-webhook">
          <Plus className="h-4 w-4 me-2" />
          {t("settings.webhooks.newEndpoint")}
        </Button>
      </div>

      {endpoints.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("settings.webhooks.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {endpoints.map((ep) => (
            <Card key={ep.id} data-testid={`row-webhook-${ep.id}`}>
              <CardContent className="flex items-start gap-4 py-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Webhook className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-sm font-mono break-all">{ep.url}</code>
                    {!ep.enabled && (
                      <Badge variant="outline" className="text-xs">{t("common.inactive")}</Badge>
                    )}
                    {ep.consecutiveFailures > 0 && ep.enabled && (
                      <Badge variant="destructive" className="text-xs">
                        {t("settings.webhooks.failureBadge", { count: ep.consecutiveFailures })}
                      </Badge>
                    )}
                  </div>
                  {ep.description && (
                    <p className="text-xs text-muted-foreground">{ep.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {ep.eventTypes.map((e) => (
                      <Badge key={e} variant="secondary" className="text-xs font-mono">{e}</Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.webhooks.secretSuffix")}: <code>…{ep.secretLastFour}</code>
                    {ep.lastDeliveryAt
                      ? ` · ${t("settings.webhooks.lastDelivery")}: ${formatDate(ep.lastDeliveryAt)} (${ep.lastDeliveryStatus ?? "—"})`
                      : ` · ${t("settings.webhooks.neverDelivered")}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={ep.enabled}
                    onCheckedChange={(v) => handleToggle(ep, v)}
                    data-testid={`switch-webhook-${ep.id}`}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => handleTest(ep)}
                        disabled={testingId === ep.id}
                        data-testid={`button-test-webhook-${ep.id}`}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("settings.webhooks.sendTest")}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => setDeliveriesFor(ep)}
                        data-testid={`button-deliveries-${ep.id}`}>
                        <ScrollText className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("settings.webhooks.viewDeliveries")}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => openEdit(ep)} data-testid={`button-edit-webhook-${ep.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("common.edit")}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                        onClick={() => setEndpointToDelete(ep)}
                        data-testid={`button-delete-webhook-${ep.id}`}>
                        <Trash className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("common.delete")}</TooltipContent>
                  </Tooltip>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{t("settings.webhooks.docsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>{t("settings.webhooks.docsBody")}</p>
          <pre className="bg-muted rounded p-3 overflow-x-auto whitespace-pre">{`X-OrgChart-Signature: sha256=<hex(hmac_sha256(secret, raw_body))>
X-OrgChart-Event: employee.created
X-OrgChart-Event-Id: evt_...
X-OrgChart-Delivery-Timestamp: <unix-seconds>`}</pre>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setCreatedSecret(""); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("settings.webhooks.editTitle") : t("settings.webhooks.createTitle")}
            </DialogTitle>
          </DialogHeader>
          {!createdSecret ? (
            <div className="space-y-4 mt-2">
              <div>
                <Label>{t("settings.webhooks.url")}</Label>
                <Input
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://example.com/webhooks/orgchart"
                  data-testid="input-webhook-url"
                />
                <p className="text-xs text-muted-foreground mt-1">{t("settings.webhooks.urlHelp")}</p>
              </div>
              <div>
                <Label>{t("settings.webhooks.descriptionLabel")}</Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={t("settings.webhooks.descriptionPlaceholder")}
                  data-testid="input-webhook-description"
                />
              </div>
              <div>
                <Label>{t("settings.webhooks.eventsLabel")}</Label>
                <div className="space-y-2 mt-2">
                  {WEBHOOK_EVENT_TYPES.map((e) => (
                    <label key={e} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={formEvents.includes(e)}
                        onCheckedChange={() => toggleEvent(e)}
                        data-testid={`checkbox-event-${e}`}
                      />
                      <code className="font-mono text-xs">{e}</code>
                      <span className="text-xs text-muted-foreground">
                        {t(`settings.webhooks.events.${e}`)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t("common.cancel")}</Button>
                <Button
                  onClick={handleSave}
                  disabled={!isFormValid || createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-webhook"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? t("common.saving")
                    : editing ? t("common.save") : t("settings.webhooks.create")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                {t("settings.webhooks.secretRevealOnce")}
              </p>
              <div className="flex items-center gap-2">
                <Input value={createdSecret} readOnly className="font-mono text-xs" data-testid="input-webhook-secret" />
                <Button variant="outline" size="icon" onClick={() => copySecret(createdSecret)} data-testid="button-copy-webhook-secret">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("settings.webhooks.secretUseHelp")}</p>
              <div className="flex justify-end pt-2">
                <Button onClick={() => setIsDialogOpen(false)} data-testid="button-webhook-done">
                  {t("common.done")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!endpointToDelete} onOpenChange={(open) => { if (!open) setEndpointToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDialog.areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.webhooks.deleteConfirm", { url: endpointToDelete?.url || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirmDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => endpointToDelete && deleteMutation.mutate({ orgId, id: endpointToDelete.id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!deliveriesFor} onOpenChange={(open) => { if (!open) setDeliveriesFor(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t("settings.webhooks.deliveriesTitle")}
            </DialogTitle>
            {deliveriesFor && (
              <p className="text-xs text-muted-foreground font-mono break-all">{deliveriesFor.url}</p>
            )}
          </DialogHeader>
          {deliveriesFor && (
            <DeliveriesList orgId={orgId} endpointId={deliveriesFor.id} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeliveriesList({ orgId, endpointId }: { orgId: number; endpointId: number }) {
  const { t, i18n } = useTranslation();
  const { data: deliveries = [], isLoading } = useListWebhookDeliveries(orgId, endpointId);
  const fmt = (s: string | null | undefined) => {
    if (!s) return "—";
    try {
      return new Date(s).toLocaleString(i18n.language === "ar" ? "ar" : undefined);
    } catch {
      return s;
    }
  };
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (deliveries.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{t("settings.webhooks.deliveriesEmpty")}</p>;
  }
  return (
    <div className="space-y-2 mt-2">
      {(deliveries as WebhookDelivery[]).map((d) => (
        <Card key={d.id} data-testid={`row-delivery-${d.id}`}>
          <CardContent className="py-3 space-y-1">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <Badge variant={d.status === "success" ? "default" : "destructive"}>
                {d.status}
              </Badge>
              {d.isTest && <Badge variant="outline">test</Badge>}
              <code className="font-mono">{d.eventType}</code>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{t("settings.webhooks.attempts", { count: d.attempts })}</span>
              {d.lastStatusCode !== null && d.lastStatusCode !== undefined && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-mono">HTTP {d.lastStatusCode}</span>
                </>
              )}
              {d.latencyMs !== null && d.latencyMs !== undefined && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-mono">{d.latencyMs}ms</span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{fmt(d.createdAt)} · <code>{d.eventId}</code></p>
            {d.lastError && (
              <p className="text-xs text-destructive font-mono break-all">{d.lastError}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const NOTIFICATION_TYPES = [
  "employee_created",
  "employee_updated",
  "employee_moved",
  "employee_deleted",
  "manager_changed",
  "report_added",
  "report_removed",
  "department_changed",
  "whats_new",
] as const;

function NotificationPreferencesTab({ orgId }: { orgId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useListNotificationPreferences(orgId);
  const updateMutation = useUpdateNotificationPreferences({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotificationPreferencesQueryKey(orgId) });
        toast({ title: t("notifications.prefs.saved") });
      },
      onError: () => {
        toast({ title: t("notifications.prefs.saveFailed"), variant: "destructive" });
      },
    },
  });

  const initialPrefs = useMemo(() => {
    const map = new Map<string, NotificationPreference>();
    (data?.preferences ?? []).forEach((p) => map.set(p.type, p));
    return NOTIFICATION_TYPES.map((type) => ({
      type,
      inApp: map.get(type)?.inApp ?? true,
      email: map.get(type)?.email ?? false,
    }));
  }, [data]);

  const [prefs, setPrefs] = useState<NotificationPreference[]>(initialPrefs);

  useEffect(() => {
    setPrefs(initialPrefs);
  }, [initialPrefs]);

  const togglePref = (type: string, key: "inApp" | "email", value: boolean) => {
    setPrefs((prev) =>
      prev.map((p) => (p.type === type ? { ...p, [key]: value } : p)),
    );
  };

  const handleSave = () => {
    updateMutation.mutate({ orgId, data: { preferences: prefs } });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {t("notifications.prefs.title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t("notifications.prefs.subtitle")}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr,auto,auto] gap-4 px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border">
                <div>{t("notifications.prefs.type")}</div>
                <div className="text-center w-20">{t("notifications.prefs.inApp")}</div>
                <div className="text-center w-20">{t("notifications.prefs.email")}</div>
              </div>
              {prefs.map((p) => (
                <div
                  key={p.type}
                  className="grid grid-cols-[1fr,auto,auto] gap-4 px-2 py-3 items-center border-b border-border last:border-0"
                  data-testid={`row-pref-${p.type}`}
                >
                  <div className="text-sm">
                    {t(`notifications.types.${p.type}`, p.type)}
                  </div>
                  <div className="w-20 flex justify-center">
                    <Switch
                      checked={p.inApp}
                      onCheckedChange={(v) => togglePref(p.type, "inApp", v)}
                      data-testid={`switch-inapp-${p.type}`}
                    />
                  </div>
                  <div className="w-20 flex justify-center">
                    <Switch
                      checked={p.email}
                      onCheckedChange={(v) => togglePref(p.type, "email", v)}
                      data-testid={`switch-email-${p.type}`}
                    />
                  </div>
                </div>
              ))}
              <div className="pt-4 flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  data-testid="button-save-notification-prefs"
                >
                  <Save className="h-4 w-4 me-2" />
                  {updateMutation.isPending
                    ? t("notifications.prefs.saving")
                    : t("notifications.prefs.save")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ShareLinksTab({ orgId }: { orgId: number }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data: links, isLoading } = useListShareLinks(orgId);
  const createMutation = useCreateShareLink({
    mutation: {
      onSuccess: (link) => {
        const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
        setCreatedUrl(`${window.location.origin}${base}/share/${link.token}`);
        setShowCreate(false);
        setForm({ password: "", expiresAt: "", maxViews: "" });
        queryClient.invalidateQueries({ queryKey: getListShareLinksQueryKey(orgId) });
      },
      onError: (err: Error) => setError(err.message || "Failed to create"),
    },
  });
  const updateMutation = useUpdateShareLink({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListShareLinksQueryKey(orgId) });
        setEditing(null);
        setEditError("");
      },
      onError: (err: Error) => setEditError(err.message || "Failed to update"),
    },
  });
  const revokeMutation = useRevokeShareLink({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListShareLinksQueryKey(orgId) });
        setLinkToRevoke(null);
      },
    },
  });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ password: "", expiresAt: "", maxViews: "" });
  const [error, setError] = useState("");
  const [createdUrl, setCreatedUrl] = useState("");
  const [linkToRevoke, setLinkToRevoke] = useState<ShareLink | null>(null);
  const [editing, setEditing] = useState<ShareLink | null>(null);
  const [editForm, setEditForm] = useState<{
    password: string;
    clearPassword: boolean;
    expiresAt: string;
    clearExpires: boolean;
    maxViews: string;
    clearMaxViews: boolean;
  }>({ password: "", clearPassword: false, expiresAt: "", clearExpires: false, maxViews: "", clearMaxViews: false });
  const [editError, setEditError] = useState("");

  const openEdit = (link: ShareLink) => {
    setEditing(link);
    setEditError("");
    setEditForm({
      password: "",
      clearPassword: false,
      expiresAt: link.expiresAt ? link.expiresAt.slice(0, 10) : "",
      clearExpires: false,
      maxViews: link.maxViews != null ? String(link.maxViews) : "",
      clearMaxViews: false,
    });
  };

  const submitEdit = () => {
    if (!editing) return;
    const data: Record<string, unknown> = {};
    if (editForm.clearPassword) data.password = null;
    else if (editForm.password) data.password = editForm.password;
    if (editForm.clearExpires) data.expiresAt = null;
    else if (editForm.expiresAt) data.expiresAt = editForm.expiresAt;
    if (editForm.clearMaxViews) data.maxViews = null;
    else if (editForm.maxViews) {
      const n = parseInt(editForm.maxViews, 10);
      if (!Number.isFinite(n) || n < 1) {
        setEditError(t("settings.shareLinks.maxViewsInvalid"));
        return;
      }
      data.maxViews = n;
    }
    if (Object.keys(data).length === 0) {
      setEditError(t("settings.shareLinks.noChanges"));
      return;
    }
    updateMutation.mutate({ orgId, id: editing.id, data: data as Parameters<typeof updateMutation.mutate>[0]["data"] });
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return null;
    try {
      return new Date(d).toLocaleString(i18n.language === "ar" ? "ar" : undefined);
    } catch {
      return d;
    }
  };

  const buildUrl = (token: string) => {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    return `${window.location.origin}${base}/share/${token}`;
  };

  return (
    <Card data-testid="card-share-links">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              {t("settings.shareLinks.title")}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t("settings.shareLinks.description")}
            </p>
          </div>
          <Button onClick={() => { setShowCreate(true); setError(""); setForm({ password: "", expiresAt: "", maxViews: "" }); }} data-testid="button-create-share-link">
            <Plus className="h-4 w-4 me-1" />
            {t("settings.shareLinks.create")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : !links || links.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-no-share-links">
            {t("settings.shareLinks.empty")}
          </p>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between gap-3 border rounded-md p-3"
                data-testid={`row-share-link-${link.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs font-mono truncate">{buildUrl(link.token)}</code>
                    <Badge
                      variant={
                        link.status === "active"
                          ? "default"
                          : link.status === "expired"
                          ? "secondary"
                          : "destructive"
                      }
                      data-testid={`badge-share-status-${link.id}`}
                    >
                      {t(`settings.shareLinks.status.${link.status}`)}
                    </Badge>
                    {link.hasPassword && (
                      <Badge variant="outline" className="gap-1">
                        <Lock className="h-3 w-3" />
                        {t("settings.shareLinks.passwordProtected")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("settings.shareLinks.createdBy", { name: link.createdByName || "—" })}
                    {" · "}
                    {formatDate(link.createdAt)}
                    {link.expiresAt && (
                      <>
                        {" · "}
                        {t("settings.shareLinks.expires", { date: formatDate(link.expiresAt) })}
                      </>
                    )}
                  </p>
                  <p
                    className="text-xs text-muted-foreground mt-1"
                    data-testid={`text-share-analytics-${link.id}`}
                  >
                    <span data-testid={`text-share-views-${link.id}`}>
                      {t("settings.shareLinks.views", { count: link.viewCount ?? 0 })}
                    </span>
                    {link.maxViews != null && (
                      <>
                        {" · "}
                        <span data-testid={`text-share-remaining-${link.id}`}>
                          {t("settings.shareLinks.remaining", {
                            count: link.remainingViews ?? 0,
                            max: link.maxViews,
                          })}
                        </span>
                      </>
                    )}
                    {" · "}
                    <span data-testid={`text-share-last-accessed-${link.id}`}>
                      {link.lastAccessedAt
                        ? t("settings.shareLinks.lastAccessed", { date: formatDate(link.lastAccessedAt) })
                        : t("settings.shareLinks.neverAccessed")}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void navigator.clipboard.writeText(buildUrl(link.token))}
                    data-testid={`button-copy-share-${link.id}`}
                    title={t("settings.shareLinks.copy")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(buildUrl(link.token), "_blank")}
                    data-testid={`button-open-share-${link.id}`}
                    title={t("settings.shareLinks.open")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  {link.status !== "revoked" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(link)}
                      data-testid={`button-edit-share-${link.id}`}
                      title={t("settings.shareLinks.edit")}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {link.status !== "revoked" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setLinkToRevoke(link)}
                      data-testid={`button-revoke-share-${link.id}`}
                      title={t("settings.shareLinks.revoke")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-create-share-link">
          <DialogHeader>
            <DialogTitle>{t("settings.shareLinks.createTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="settings-share-expires">{t("settings.shareLinks.expiresAt")}</Label>
              <Input
                id="settings-share-expires"
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                data-testid="input-settings-share-expires"
              />
            </div>
            <div>
              <Label htmlFor="settings-share-password">{t("settings.shareLinks.password")}</Label>
              <Input
                id="settings-share-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={t("settings.shareLinks.passwordPlaceholder")}
                data-testid="input-settings-share-password"
              />
            </div>
            <div>
              <Label htmlFor="settings-share-maxviews">{t("settings.shareLinks.maxViews")}</Label>
              <Input
                id="settings-share-maxviews"
                type="number"
                min={1}
                value={form.maxViews}
                onChange={(e) => setForm((f) => ({ ...f, maxViews: e.target.value }))}
                placeholder={t("settings.shareLinks.maxViewsPlaceholder")}
                data-testid="input-settings-share-maxviews"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("settings.shareLinks.maxViewsHint")}
              </p>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => {
                  let maxViewsVal: number | null = null;
                  if (form.maxViews) {
                    const n = parseInt(form.maxViews, 10);
                    if (!Number.isFinite(n) || n < 1) {
                      setError(t("settings.shareLinks.maxViewsInvalid"));
                      return;
                    }
                    maxViewsVal = n;
                  }
                  createMutation.mutate({
                    orgId,
                    data: {
                      password: form.password ? form.password : null,
                      expiresAt: form.expiresAt ? form.expiresAt : null,
                      maxViews: maxViewsVal,
                    },
                  });
                }}
                disabled={createMutation.isPending}
                data-testid="button-confirm-create-share"
              >
                {createMutation.isPending ? t("common.saving") : t("settings.shareLinks.create")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!createdUrl} onOpenChange={(o) => { if (!o) setCreatedUrl(""); }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-share-link-created">
          <DialogHeader>
            <DialogTitle>{t("settings.shareLinks.createdTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("settings.shareLinks.createdHint")}</p>
            <div className="flex items-center gap-2">
              <Input value={createdUrl} readOnly className="font-mono text-xs" data-testid="input-created-share-url" />
              <Button variant="outline" size="icon" onClick={() => void navigator.clipboard.writeText(createdUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setCreatedUrl("")}>{t("common.done")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setEditError(""); } }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-edit-share-link">
          <DialogHeader>
            <DialogTitle>{t("settings.shareLinks.editTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-share-expires">{t("settings.shareLinks.expiresAt")}</Label>
              <Input
                id="edit-share-expires"
                type="date"
                value={editForm.expiresAt}
                disabled={editForm.clearExpires}
                onChange={(e) => setEditForm((f) => ({ ...f, expiresAt: e.target.value }))}
                data-testid="input-edit-share-expires"
              />
              {editing?.expiresAt && (
                <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={editForm.clearExpires}
                    onChange={(e) => setEditForm((f) => ({ ...f, clearExpires: e.target.checked }))}
                    data-testid="checkbox-clear-expires"
                  />
                  {t("settings.shareLinks.clearExpiry")}
                </label>
              )}
            </div>
            <div>
              <Label htmlFor="edit-share-password">{t("settings.shareLinks.password")}</Label>
              <Input
                id="edit-share-password"
                type="password"
                value={editForm.password}
                disabled={editForm.clearPassword}
                placeholder={
                  editing?.hasPassword
                    ? t("settings.shareLinks.passwordKeepHint")
                    : t("settings.shareLinks.passwordPlaceholder")
                }
                onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                data-testid="input-edit-share-password"
              />
              {editing?.hasPassword && (
                <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={editForm.clearPassword}
                    onChange={(e) => setEditForm((f) => ({ ...f, clearPassword: e.target.checked }))}
                    data-testid="checkbox-clear-password"
                  />
                  {t("settings.shareLinks.clearPassword")}
                </label>
              )}
            </div>
            <div>
              <Label htmlFor="edit-share-maxviews">{t("settings.shareLinks.maxViews")}</Label>
              <Input
                id="edit-share-maxviews"
                type="number"
                min={1}
                value={editForm.maxViews}
                disabled={editForm.clearMaxViews}
                onChange={(e) => setEditForm((f) => ({ ...f, maxViews: e.target.value }))}
                placeholder={t("settings.shareLinks.maxViewsPlaceholder")}
                data-testid="input-edit-share-maxviews"
              />
              {editing && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("settings.shareLinks.currentViews", { count: editing.viewCount })}
                </p>
              )}
              {editing?.maxViews != null && (
                <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={editForm.clearMaxViews}
                    onChange={(e) => setEditForm((f) => ({ ...f, clearMaxViews: e.target.checked }))}
                    data-testid="checkbox-clear-maxviews"
                  />
                  {t("settings.shareLinks.clearMaxViews")}
                </label>
              )}
            </div>
            {editError && (
              <p className="text-xs text-destructive" data-testid="text-edit-share-error">
                {editError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setEditing(null); setEditError(""); }}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={submitEdit}
                disabled={updateMutation.isPending}
                data-testid="button-confirm-edit-share"
              >
                {updateMutation.isPending ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!linkToRevoke} onOpenChange={(o) => { if (!o) setLinkToRevoke(null); }}>
        <AlertDialogContent data-testid="dialog-revoke-share">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.shareLinks.revokeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("settings.shareLinks.revokeDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => linkToRevoke && revokeMutation.mutate({ orgId, id: linkToRevoke.id })}
              disabled={revokeMutation.isPending}
              data-testid="button-confirm-revoke-share"
            >
              {t("settings.shareLinks.revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function GoogleWorkspacePanel({ orgId }: { orgId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

  const statusQuery = useGetGoogleImportStatus(orgId, {
    query: { queryKey: getGetGoogleImportStatusQueryKey(orgId), staleTime: 30_000 },
  });
  const connected = !!statusQuery.data?.connected;

  const connect = async () => {
    const res = await fetch(`${apiBase}/auth/google/connect-workspace`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      toast({ title: t("googleImport.connectError"), variant: "destructive" });
      return;
    }
    const data = await res.json();
    if (data.authorizeUrl) window.location.href = data.authorizeUrl;
  };

  const disconnect = async () => {
    const res = await fetch(`${apiBase}/auth/google/disconnect-workspace`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      toast({ title: t("settings.error"), variant: "destructive" });
      return;
    }
    toast({ title: t("googleImport.disconnected") });
    qc.invalidateQueries({ queryKey: getGetGoogleImportStatusQueryKey(orgId) });
  };

  return (
    <Card data-testid="card-google-workspace">
      <CardContent className="py-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">{t("googleImport.title")}</p>
              <p className="text-xs text-muted-foreground">
                {connected ? t("googleImport.connected") : t("googleImport.connectIntro")}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
                data-testid="button-google-disconnect"
              >
                {t("googleImport.disconnect")}
              </Button>
            ) : (
              <Button size="sm" onClick={connect} data-testid="button-google-connect-settings">
                <Cloud className="h-4 w-4 me-2" />
                {t("googleImport.connectButton")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SlackChannelSyncPanel({
  orgId,
  slackConnected,
}: {
  orgId: number;
  slackConnected: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [draftChannelId, setDraftChannelId] = useState("");
  const [draftDeptId, setDraftDeptId] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const mappingsQuery = useListSlackChannelMappings(orgId, {
    query: {
      queryKey: getListSlackChannelMappingsQueryKey(orgId),
      staleTime: 30_000,
    },
  });
  const channelsQuery = useListSlackOauthChannels(orgId, {
    query: {
      queryKey: getListSlackOauthChannelsQueryKey(orgId),
      enabled: slackConnected,
      staleTime: 60_000,
    },
  });
  const departmentsQuery = useListDepartments(orgId);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListSlackChannelMappingsQueryKey(orgId) });

  const createMutation = useCreateSlackChannelMapping({
    mutation: {
      onSuccess: () => {
        toast({ title: t("settings.integrations.slackSync.created") });
        setAdding(false);
        setDraftChannelId("");
        setDraftDeptId("");
        invalidate();
      },
      onError: (err) => {
        toast({
          title: t("settings.error"),
          description: (err as Error)?.message || "",
          variant: "destructive",
        });
      },
    },
  });
  const deleteMutation = useDeleteSlackChannelMapping({
    mutation: {
      onSuccess: () => {
        toast({ title: t("settings.integrations.slackSync.removed") });
        invalidate();
      },
    },
  });
  const syncMutation = useSyncSlackChannelMappingNow({
    mutation: {
      onSuccess: () => {
        toast({ title: t("settings.integrations.slackSync.synced") });
        invalidate();
      },
      onError: (err) => {
        toast({
          title: t("settings.integrations.slackSync.syncFailed"),
          description: (err as Error)?.message || "",
          variant: "destructive",
        });
        invalidate();
      },
      onSettled: () => setBusyId(null),
    },
  });

  const mappings = mappingsQuery.data ?? [];
  const channels: SlackChannel[] = channelsQuery.data ?? [];
  const departments = departmentsQuery.data ?? [];

  const mappedChannelIds = new Set(mappings.map((m) => m.slackChannelId));
  const mappedDeptIds = new Set(mappings.map((m) => m.departmentId));
  const availableChannels = channels.filter(
    (c) => !c.isArchived && !mappedChannelIds.has(c.id),
  );
  const availableDepartments = departments.filter((d) => !mappedDeptIds.has(d.id));

  const formatDate = (s: string | null | undefined) => {
    if (!s) return "—";
    try {
      return new Date(s).toLocaleString(i18n.language === "ar" ? "ar" : undefined);
    } catch {
      return s;
    }
  };

  const conflictLabel = (kind: string) => {
    switch (kind) {
      case "missing_employee":
        return t("settings.integrations.slackSync.conflictKindMissingEmployee");
      case "wrong_department":
        return t("settings.integrations.slackSync.conflictKindWrongDepartment");
      case "no_match":
        return t("settings.integrations.slackSync.conflictKindNoMatch");
      case "ambiguous_match":
        return t("settings.integrations.slackSync.conflictKindAmbiguousMatch");
      case "missing_from_channel":
        return t("settings.integrations.slackSync.conflictKindMissingFromChannel");
      default:
        return kind;
    }
  };

  return (
    <Card data-testid="card-slack-channel-sync">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">
              {t("settings.integrations.slackSync.title")}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              {t("settings.integrations.slackSync.subtitle")}
            </p>
          </div>
          {slackConnected && availableChannels.length > 0 && availableDepartments.length > 0 && (
            <Button
              size="sm"
              onClick={() => setAdding((v) => !v)}
              data-testid="button-add-slack-mapping"
            >
              {t("settings.integrations.slackSync.addMapping")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!slackConnected && (
          <p className="text-sm text-muted-foreground">
            {t("settings.integrations.slackSync.connectFirst")}
          </p>
        )}

        {slackConnected && adding && (
          <div className="border rounded-md p-3 space-y-3 bg-muted/30">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">
                  {t("settings.integrations.slackSync.slackChannel")}
                </Label>
                <Select value={draftChannelId} onValueChange={setDraftChannelId}>
                  <SelectTrigger data-testid="select-slack-mapping-channel">
                    <SelectValue
                      placeholder={t("settings.integrations.slackSync.pickChannel")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableChannels.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        #{c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">
                  {t("settings.integrations.slackSync.department")}
                </Label>
                <Select value={draftDeptId} onValueChange={setDraftDeptId}>
                  <SelectTrigger data-testid="select-slack-mapping-dept">
                    <SelectValue
                      placeholder={t("settings.integrations.slackSync.pickDepartment")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDepartments.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAdding(false);
                  setDraftChannelId("");
                  setDraftDeptId("");
                }}
              >
                {t("settings.integrations.slackSync.cancel")}
              </Button>
              <Button
                size="sm"
                disabled={!draftChannelId || !draftDeptId || createMutation.isPending}
                onClick={() => {
                  const channel = channels.find((c) => c.id === draftChannelId);
                  createMutation.mutate({
                    orgId,
                    data: {
                      slackChannelId: draftChannelId,
                      slackChannelName: channel?.name ?? "",
                      departmentId: Number(draftDeptId),
                    },
                  });
                }}
                data-testid="button-save-slack-mapping"
              >
                {t("settings.integrations.slackSync.save")}
              </Button>
            </div>
          </div>
        )}

        {slackConnected && mappings.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">
            {t("settings.integrations.slackSync.empty")}
          </p>
        )}

        {mappings.length > 0 && (
          <div className="space-y-2">
            {mappings.map((m) => {
              const isBusy = busyId === m.id && syncMutation.isPending;
              const statusLabel =
                m.lastSyncStatus === "success"
                  ? t("settings.integrations.slackSync.statusSuccess")
                  : m.lastSyncStatus === "failure"
                    ? t("settings.integrations.slackSync.statusFailure")
                    : t("settings.integrations.slackSync.statusNever");
              return (
                <div
                  key={m.id}
                  className="border rounded-md p-3"
                  data-testid={`row-slack-mapping-${m.id}`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="text-sm">
                      <div className="font-medium">
                        #{m.slackChannelName || m.slackChannelId}
                        <span className="text-muted-foreground"> ↔ </span>
                        {m.departmentName || `#${m.departmentId}`}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                        <span>
                          {t("settings.integrations.slackSync.status")}: {statusLabel}
                        </span>
                        <span>
                          {t("settings.integrations.slackSync.lastSync")}:{" "}
                          {formatDate(m.lastSyncAt)}
                        </span>
                        <span>
                          {t("settings.integrations.slackSync.matched", {
                            count: m.lastMatchCount,
                          })}
                        </span>
                        <span>
                          {t("settings.integrations.slackSync.conflicts", {
                            count: m.lastConflicts.length,
                          })}
                        </span>
                      </div>
                      {m.lastSyncStatus === "failure" && m.lastSyncMessage && (
                        <p className="text-xs text-destructive mt-1">{m.lastSyncMessage}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => {
                          setBusyId(m.id);
                          syncMutation.mutate({ orgId, id: m.id });
                        }}
                        data-testid={`button-slack-mapping-sync-${m.id}`}
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 me-1.5 ${isBusy ? "animate-spin" : ""}`}
                        />
                        {isBusy
                          ? t("settings.integrations.slackSync.syncing")
                          : t("settings.integrations.slackSync.syncNow")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(t("settings.integrations.slackSync.removeConfirm"))) {
                            deleteMutation.mutate({ orgId, id: m.id });
                          }
                        }}
                        data-testid={`button-slack-mapping-delete-${m.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {m.lastConflicts.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer">
                        {t("settings.integrations.slackSync.conflictHeader")} (
                        {m.lastConflicts.length})
                      </summary>
                      <ul className="text-xs mt-2 space-y-1">
                        {m.lastConflicts.slice(0, 50).map((c, i) => (
                          <li key={i} className="flex flex-wrap gap-2">
                            <span className="font-medium">{conflictLabel(c.kind)}:</span>
                            <span>
                              {c.slackName || c.employeeName || c.slackEmail || c.slackUserId}
                              {c.slackEmail ? ` (${c.slackEmail})` : ""}
                              {c.currentDepartment ? ` — ${c.currentDepartment}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmbedsTab({ orgId }: { orgId: number }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: tokens, isLoading } = useListChartEmbedTokens(orgId);
  const { data: charts } = useListCharts(orgId);
  const createMutation = useCreateChartEmbedToken({
    mutation: {
      onSuccess: (tok) => {
        queryClient.invalidateQueries({ queryKey: getListChartEmbedTokensQueryKey(orgId) });
        setShowCreate(false);
        setForm({ chartId: "", label: "", expiresAt: "", maxImpressions: "" });
        setNewTokenSnippet(buildSnippet(tok.token));
      },
      onError: (err: Error) => setError(err.message || t("settings.embeds.createError")),
    },
  });
  const revokeMutation = useRevokeChartEmbedToken({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListChartEmbedTokensQueryKey(orgId) });
        setTokenToRevoke(null);
        toast({ title: t("settings.embeds.revoked") });
      },
    },
  });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ chartId: "", label: "", expiresAt: "", maxImpressions: "" });
  const [error, setError] = useState("");
  const [newTokenSnippet, setNewTokenSnippet] = useState("");
  const [tokenToRevoke, setTokenToRevoke] = useState<ChartEmbedToken | null>(null);

  const formatDate = (d: string | null | undefined) => {
    if (!d) return null;
    try {
      return new Date(d).toLocaleString(i18n.language === "ar" ? "ar" : undefined);
    } catch {
      return d;
    }
  };

  const buildEmbedUrl = (token: string) => {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    return `${window.location.origin}${base}/embed/${token}`;
  };

  const buildSnippet = (token: string) =>
    `<iframe src="${buildEmbedUrl(token)}" width="100%" height="600" frameborder="0" loading="lazy" title="Org chart"></iframe>`;

  return (
    <Card data-testid="card-embeds">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              {t("settings.embeds.title")}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t("settings.embeds.description")}
            </p>
          </div>
          <Button
            onClick={() => {
              setShowCreate(true);
              setError("");
              setForm({ chartId: "", label: "", expiresAt: "", maxImpressions: "" });
            }}
            data-testid="button-create-embed"
          >
            <Plus className="h-4 w-4 me-1" />
            {t("settings.embeds.create")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : !tokens || tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-no-embeds">
            {t("settings.embeds.empty")}
          </p>
        ) : (
          <div className="space-y-2">
            {tokens.map((tok) => (
              <div
                key={tok.id}
                className="flex items-start justify-between gap-3 border rounded-md p-3"
                data-testid={`row-embed-${tok.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">
                      {tok.label || tok.chartName || t("settings.embeds.allEmployees")}
                    </span>
                    <Badge
                      variant={
                        tok.status === "active"
                          ? "default"
                          : tok.status === "expired" || tok.status === "exhausted"
                          ? "secondary"
                          : "destructive"
                      }
                      data-testid={`badge-embed-status-${tok.id}`}
                    >
                      {t(`settings.embeds.status.${tok.status}`)}
                    </Badge>
                    <Badge variant="outline">{t("settings.embeds.readOnly")}</Badge>
                  </div>
                  <code className="block text-xs font-mono text-muted-foreground truncate mt-1">
                    {buildEmbedUrl(tok.token)}
                  </code>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("settings.embeds.createdBy", { name: tok.createdByName || "—" })}
                    {" · "}
                    {formatDate(tok.createdAt)}
                    {tok.expiresAt && (
                      <>
                        {" · "}
                        {t("settings.embeds.expires", { date: formatDate(tok.expiresAt) })}
                      </>
                    )}
                  </p>
                  <p
                    className="text-xs text-muted-foreground mt-1"
                    data-testid={`text-embed-impressions-${tok.id}`}
                  >
                    {tok.maxImpressions != null
                      ? t("settings.embeds.impressionsOf", {
                          count: tok.impressionCount,
                          max: tok.maxImpressions,
                        })
                      : t("settings.embeds.impressions", { count: tok.impressionCount })}
                    {tok.lastAccessedAt && (
                      <>
                        {" · "}
                        {t("settings.embeds.lastAccessed", { date: formatDate(tok.lastAccessedAt) })}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      void navigator.clipboard.writeText(buildSnippet(tok.token));
                      toast({ title: t("settings.embeds.snippetCopied") });
                    }}
                    data-testid={`button-copy-embed-${tok.id}`}
                    title={t("settings.embeds.copySnippet")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {tok.status === "active" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setTokenToRevoke(tok)}
                      data-testid={`button-revoke-embed-${tok.id}`}
                      title={t("settings.embeds.revoke")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-create-embed">
          <DialogHeader>
            <DialogTitle>{t("settings.embeds.createTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="embed-label">{t("settings.embeds.label")}</Label>
              <Input
                id="embed-label"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder={t("settings.embeds.labelPlaceholder")}
                data-testid="input-embed-label"
              />
            </div>
            <div>
              <Label htmlFor="embed-chart">{t("settings.embeds.scope")}</Label>
              <Select
                value={form.chartId || "_all"}
                onValueChange={(v) => setForm((f) => ({ ...f, chartId: v === "_all" ? "" : v }))}
              >
                <SelectTrigger id="embed-chart" data-testid="select-embed-chart">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("settings.embeds.allEmployees")}</SelectItem>
                  {(charts || []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="embed-expires">{t("settings.embeds.expiresAt")}</Label>
              <Input
                id="embed-expires"
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                data-testid="input-embed-expires"
              />
            </div>
            <div>
              <Label htmlFor="embed-max">{t("settings.embeds.maxImpressions")}</Label>
              <Input
                id="embed-max"
                type="number"
                min={1}
                value={form.maxImpressions}
                onChange={(e) => setForm((f) => ({ ...f, maxImpressions: e.target.value }))}
                placeholder={t("settings.embeds.maxImpressionsPlaceholder")}
                data-testid="input-embed-max"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => {
                  setError("");
                  createMutation.mutate({
                    orgId,
                    data: {
                      chartId: form.chartId ? Number(form.chartId) : null,
                      label: form.label || null,
                      expiresAt: form.expiresAt || null,
                      maxImpressions: form.maxImpressions ? Number(form.maxImpressions) : null,
                    },
                  });
                }}
                disabled={createMutation.isPending}
                data-testid="button-confirm-create-embed"
              >
                {t("settings.embeds.create")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!newTokenSnippet} onOpenChange={(o) => !o && setNewTokenSnippet("")}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-embed-snippet">
          <DialogHeader>
            <DialogTitle>{t("settings.embeds.snippetTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("settings.embeds.snippetHint")}</p>
            <Textarea
              readOnly
              value={newTokenSnippet}
              className="font-mono text-xs"
              rows={4}
              data-testid="textarea-embed-snippet"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(newTokenSnippet);
                  toast({ title: t("settings.embeds.snippetCopied") });
                }}
                data-testid="button-copy-new-snippet"
              >
                <Copy className="h-4 w-4 me-1" />
                {t("settings.embeds.copySnippet")}
              </Button>
              <Button onClick={() => setNewTokenSnippet("")}>{t("common.done")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!tokenToRevoke}
        onOpenChange={(o) => !o && setTokenToRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.embeds.revokeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.embeds.revokeDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (tokenToRevoke) {
                  revokeMutation.mutate({ orgId, id: tokenToRevoke.id });
                }
              }}
              data-testid="button-confirm-revoke-embed"
            >
              {t("settings.embeds.revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function IntegrationsTab({ orgId }: { orgId: number }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addType, setAddType] = useState<"slack-oauth" | "slack" | "teams" | null>(null);
  const [hrisOpen, setHrisOpen] = useState(false);

  const { data: integrations = [], isLoading } = useListOrgIntegrations(orgId);
  const { data: slackStatus } = useGetSlackOauthStatus(orgId, {
    query: {
      queryKey: getGetSlackOauthStatusQueryKey(orgId),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListOrgIntegrationsQueryKey(orgId) });

  const formatDate = (s: string | null) => {
    if (!s) return "";
    try {
      return new Date(s).toLocaleString(i18n.language === "ar" ? "ar" : undefined);
    } catch {
      return s;
    }
  };

  const createMutation = useCreateOrgIntegration({
    mutation: {
      onSuccess: () => {
        toast({ title: t("settings.integrations.created") });
        setAddType(null);
        invalidate();
      },
      onError: (err) => {
        toast({
          title: t("settings.error"),
          description: (err as Error)?.message || "",
          variant: "destructive",
        });
      },
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("settings.integrations.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("settings.integrations.subtitle")}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button
            onClick={() => setAddType("slack-oauth")}
            data-testid="button-signin-slack"
          >
            <MessageSquare className="h-4 w-4 me-2" />
            {t("settings.integrations.signInWithSlack")}
          </Button>
          <Button
            variant="outline"
            onClick={() => setAddType("slack")}
            data-testid="button-add-slack"
          >
            {t("settings.integrations.connectSlackWebhook")}
          </Button>
          <Button
            variant="outline"
            onClick={() => setAddType("teams")}
            data-testid="button-add-teams"
          >
            <MessageSquare className="h-4 w-4 me-2" />
            {t("settings.integrations.addTeams")}
          </Button>
          <Button
            variant="outline"
            onClick={() => setHrisOpen(true)}
            data-testid="button-open-hris"
          >
            <Database className="h-4 w-4 me-2" />
            {t("hrisImport.button")}
          </Button>
        </div>
      </div>

      <GoogleWorkspacePanel orgId={orgId} />

      <SlackChannelSyncPanel orgId={orgId} slackConnected={!!slackStatus?.connected} />

      {integrations.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("settings.integrations.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {integrations.map((it) => (
            <IntegrationRow
              key={it.id}
              orgId={orgId}
              integration={it}
              formatDate={formatDate}
              onChanged={invalidate}
            />
          ))}
        </div>
      )}

      <Dialog open={!!addType} onOpenChange={(open) => !open && setAddType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {addType === "slack-oauth"
                ? t("settings.integrations.signInWithSlack")
                : addType === "slack"
                  ? t("settings.integrations.connectSlackWebhook")
                  : t("settings.integrations.addTeams")}
            </DialogTitle>
          </DialogHeader>
          {addType === "slack-oauth" && (
            <SlackOauthForm
              orgId={orgId}
              status={slackStatus}
              isSaving={createMutation.isPending}
              onCancel={() => setAddType(null)}
              onSubmit={(payload) =>
                createMutation.mutate({ orgId, data: { type: "slack", ...payload } })
              }
            />
          )}
          {(addType === "slack" || addType === "teams") && (
            <IntegrationForm
              orgId={orgId}
              type={addType}
              onSubmit={(payload) =>
                createMutation.mutate({ orgId, data: { type: addType, ...payload } })
              }
              isSaving={createMutation.isPending}
              onCancel={() => setAddType(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <HrisImportWizard orgId={orgId} open={hrisOpen} onOpenChange={setHrisOpen} />
    </div>
  );
}

const ALL_EVENT_TYPES = [
  "employee_joined",
  "employee_left",
  "manager_changed",
  "department_restructured",
] as const;

const ALL_DETAIL_FIELDS = ["title", "department", "location", "startDate", "actor"] as const;
type DetailField = (typeof ALL_DETAIL_FIELDS)[number];

function IntegrationForm({
  orgId,
  type,
  initialWebhookUrl,
  initialChannel,
  initialEventTypes,
  initialEnabled,
  initialTemplate,
  initialCustomTemplate,
  initialIntro,
  initialFields,
  onSubmit,
  onCancel,
  isSaving,
  showEnabledToggle,
}: {
  orgId: number;
  type: "slack" | "teams";
  initialWebhookUrl?: string;
  initialChannel?: string;
  initialEventTypes?: string[];
  initialEnabled?: boolean;
  initialTemplate?: string;
  initialCustomTemplate?: string;
  initialIntro?: string;
  initialFields?: string[];
  onSubmit: (payload: {
    config: {
      webhookUrl?: string;
      channelName?: string;
      template?: string;
      customTemplate?: string;
      intro?: string;
      fields?: string[];
    };
    eventTypes: string[];
    enabled: boolean;
  }) => void;
  onCancel: () => void;
  isSaving: boolean;
  showEnabledToggle?: boolean;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl ?? "");
  const [channel, setChannel] = useState(initialChannel ?? "");
  const [enabled, setEnabled] = useState(initialEnabled ?? true);
  const [events, setEvents] = useState<string[]>(
    initialEventTypes ?? ["employee_joined", "employee_left", "manager_changed"],
  );
  const [template, setTemplate] = useState<string>(initialTemplate ?? "detailed");
  const [customTemplate, setCustomTemplate] = useState<string>(initialCustomTemplate ?? "");
  const [intro, setIntro] = useState<string>(initialIntro ?? "");
  const [fields, setFields] = useState<string[]>(
    initialFields ?? ["title", "department"],
  );
  const [previewData, setPreviewData] = useState<{
    headline: string;
    body: string;
    fields: { label: string; value: string }[];
  } | null>(null);

  const toggleEvent = (e: string) => {
    setEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  };
  const toggleField = (f: DetailField) => {
    setFields((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };

  const buildConfig = () => {
    const trimmedUrl = webhookUrl.trim();
    const cfg: {
      webhookUrl?: string;
      channelName?: string;
      template?: string;
      customTemplate?: string;
      intro?: string;
      fields?: string[];
    } = {
      ...(trimmedUrl ? { webhookUrl: trimmedUrl } : {}),
      ...(channel.trim() ? { channelName: channel.trim() } : {}),
      template,
    };
    if (template === "custom") cfg.customTemplate = customTemplate;
    if (intro.trim()) cfg.intro = intro;
    if (template === "detailed") cfg.fields = fields;
    return cfg;
  };

  const previewMutation = usePreviewOrgIntegration({
    mutation: {
      onSuccess: (data) => {
        setPreviewData({
          headline: data.headline,
          body: data.body,
          fields: data.fields,
        });
      },
      onError: (err) => {
        toast({
          title: t("settings.integrations.previewError"),
          description: (err as Error)?.message || "",
          variant: "destructive",
        });
      },
    },
  });

  const runPreview = () => {
    const cfg = buildConfig();
    // The preview endpoint does not need webhookUrl.
    delete cfg.webhookUrl;
    previewMutation.mutate({
      orgId,
      data: { type, config: cfg },
    });
  };

  const isEdit = !!showEnabledToggle;
  const submit = () => {
    onSubmit({
      config: buildConfig(),
      eventTypes: events,
      enabled,
    });
  };
  const canSave =
    (isEdit || webhookUrl.trim().length > 0) &&
    events.length > 0 &&
    (template !== "custom" || customTemplate.trim().length > 0);

  const hint =
    type === "slack"
      ? t("settings.integrations.slackOauthHint")
      : t("settings.integrations.teamsOauthHint");

  const placeholder =
    type === "slack"
      ? t("settings.integrations.webhookUrlPlaceholderSlack")
      : t("settings.integrations.webhookUrlPlaceholderTeams");

  return (
    <div className="space-y-4 mt-2">
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div>
        <Label>{t("settings.integrations.webhookUrl")}</Label>
        <Input
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder={isEdit ? t("settings.integrations.webhookUrlEditPlaceholder") : placeholder}
          data-testid={`input-webhook-${type}`}
        />
        {isEdit && (
          <p className="text-xs text-muted-foreground mt-1">
            {t("settings.integrations.webhookUrlEditHint")}
          </p>
        )}
      </div>
      <div>
        <Label>{t("settings.integrations.channelName")}</Label>
        <Input
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          placeholder={t("settings.integrations.channelPlaceholder")}
          data-testid={`input-channel-${type}`}
        />
      </div>
      <div>
        <Label className="mb-2 block">{t("settings.integrations.events")}</Label>
        <div className="space-y-2">
          {ALL_EVENT_TYPES.map((e) => (
            <label key={e} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={events.includes(e)}
                onCheckedChange={() => toggleEvent(e)}
                data-testid={`checkbox-event-${e}`}
              />
              <span>
                {t(
                  `settings.integrations.event${e
                    .split("_")
                    .map((p) => p[0].toUpperCase() + p.slice(1))
                    .join("")}`,
                )}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-2 block">{t("settings.integrations.messageFormat")}</Label>
        <Select value={template} onValueChange={(v) => setTemplate(v)}>
          <SelectTrigger data-testid={`select-template-${type}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="compact">{t("settings.integrations.templateCompact")}</SelectItem>
            <SelectItem value="detailed">{t("settings.integrations.templateDetailed")}</SelectItem>
            <SelectItem value="custom">{t("settings.integrations.templateCustom")}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          {template === "compact"
            ? t("settings.integrations.templateCompactHint")
            : template === "custom"
              ? t("settings.integrations.templateCustomHint")
              : t("settings.integrations.templateDetailedHint")}
        </p>
      </div>

      {template !== "custom" && (
        <div>
          <Label>{t("settings.integrations.intro")}</Label>
          <Input
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder={t("settings.integrations.introPlaceholder")}
            data-testid={`input-intro-${type}`}
          />
        </div>
      )}

      {template === "detailed" && (
        <div>
          <Label className="mb-2 block">{t("settings.integrations.includeFields")}</Label>
          <div className="grid grid-cols-2 gap-2">
            {ALL_DETAIL_FIELDS.map((f) => (
              <label key={f} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={fields.includes(f)}
                  onCheckedChange={() => toggleField(f)}
                  data-testid={`checkbox-field-${f}`}
                />
                <span>
                  {t(
                    `settings.integrations.field${f[0].toUpperCase() + f.slice(1)}`,
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {template === "custom" && (
        <div>
          <Label>{t("settings.integrations.customTemplate")}</Label>
          <Textarea
            value={customTemplate}
            onChange={(e) => setCustomTemplate(e.target.value)}
            placeholder={t("settings.integrations.customTemplatePlaceholder")}
            rows={5}
            data-testid={`textarea-custom-template-${type}`}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {t("settings.integrations.placeholdersHint")}
          </p>
        </div>
      )}

      <div className="border rounded-md p-3 bg-muted/30 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">{t("settings.integrations.previewMessage")}</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={runPreview}
            disabled={previewMutation.isPending || (template === "custom" && !customTemplate.trim())}
            data-testid={`button-preview-${type}`}
          >
            {previewMutation.isPending
              ? t("settings.integrations.previewLoading")
              : t("settings.integrations.preview")}
          </Button>
        </div>
        {previewData && (
          <div className="rounded-md border bg-background p-3 space-y-1" data-testid={`preview-output-${type}`}>
            <p className="text-sm font-semibold">{previewData.headline}</p>
            {previewData.body && (
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {previewData.body}
              </p>
            )}
            {previewData.fields.length > 0 && (
              <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                {previewData.fields.map((f) => (
                  <li key={f.label}>
                    <span className="font-medium">{f.label}:</span> {f.value}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {showEnabledToggle && (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={enabled}
            onCheckedChange={(c) => setEnabled(!!c)}
            data-testid="checkbox-integration-enabled"
          />
          <span>{t("settings.integrations.enabled")}</span>
        </label>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button
          onClick={submit}
          disabled={isSaving || !canSave}
          data-testid={`button-save-integration-${type}`}
        >
          {isSaving ? t("common.saving") : t("settings.integrations.saveChanges")}
        </Button>
      </div>
    </div>
  );
}

function SlackOauthForm({
  orgId,
  status,
  initialChannelId,
  initialEventTypes,
  initialEnabled,
  showEnabledToggle,
  onSubmit,
  onCancel,
  isSaving,
}: {
  orgId: number;
  status?: { connected: boolean; teamId?: string; teamName?: string; error?: string };
  initialChannelId?: string;
  initialEventTypes?: string[];
  initialEnabled?: boolean;
  showEnabledToggle?: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (payload: {
    config: {
      mode: "oauth";
      channelId: string;
      channelName?: string;
      teamId?: string;
      teamName?: string;
    };
    eventTypes: string[];
    enabled: boolean;
  }) => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!showEnabledToggle;
  const { data: liveStatus } = useGetSlackOauthStatus(orgId, {
    query: {
      queryKey: getGetSlackOauthStatusQueryKey(orgId),
      enabled: isEdit,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  });
  const effectiveStatus = status ?? liveStatus;
  const connected = !!effectiveStatus?.connected;

  const channelsQuery = useListSlackOauthChannels(orgId, {
    query: {
      queryKey: getListSlackOauthChannelsQueryKey(orgId),
      enabled: connected,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  });

  const [channelId, setChannelId] = useState(initialChannelId ?? "");
  const [enabled, setEnabled] = useState(initialEnabled ?? true);
  const [events, setEvents] = useState<string[]>(
    initialEventTypes ?? ["employee_joined", "employee_left", "manager_changed"],
  );

  const toggleEvent = (e: string) => {
    setEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  };

  if (!connected) {
    return (
      <div className="space-y-3 mt-2">
        <p className="text-sm">{t("settings.integrations.slackNotConnected")}</p>
        <p className="text-xs text-muted-foreground">
          {t("settings.integrations.slackNotConnectedHint")}
        </p>
        {effectiveStatus?.error && (
          <p className="text-xs text-destructive">{effectiveStatus.error}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  const channels: SlackChannel[] = channelsQuery.data ?? [];
  const selected = channels.find((c) => c.id === channelId);

  const submit = () => {
    if (!selected) return;
    onSubmit({
      config: {
        mode: "oauth",
        channelId: selected.id,
        channelName: selected.name,
        teamId: effectiveStatus?.teamId,
        teamName: effectiveStatus?.teamName,
      },
      eventTypes: events,
      enabled,
    });
  };

  const canSave = !!selected && events.length > 0;

  return (
    <div className="space-y-4 mt-2">
      <p className="text-xs text-muted-foreground">
        {t("settings.integrations.signedInAs", {
          workspace: effectiveStatus?.teamName || "Slack",
        })}
      </p>
      <div>
        <Label>{t("settings.integrations.channel")}</Label>
        <Select value={channelId} onValueChange={setChannelId}>
          <SelectTrigger data-testid="select-slack-channel">
            <SelectValue
              placeholder={
                channelsQuery.isLoading
                  ? t("settings.integrations.loadingChannels")
                  : t("settings.integrations.pickChannel")
              }
            />
          </SelectTrigger>
          <SelectContent>
            {channels.map((ch) => (
              <SelectItem key={ch.id} value={ch.id} data-testid={`option-channel-${ch.id}`}>
                {ch.isPrivate ? "🔒 " : "# "}
                {ch.name}
                {!ch.isMember && (
                  <span className="text-xs text-muted-foreground ms-2">
                    {t("settings.integrations.notMemberHint")}
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {channelsQuery.isError && (
          <p className="text-xs text-destructive mt-1">
            {(channelsQuery.error as Error)?.message ||
              t("settings.integrations.channelsLoadFailed")}
          </p>
        )}
        {selected && !selected.isMember && (
          <p className="text-xs text-muted-foreground mt-1">
            {t("settings.integrations.inviteAppHint", { channel: selected.name })}
          </p>
        )}
      </div>
      <div>
        <Label className="mb-2 block">{t("settings.integrations.events")}</Label>
        <div className="space-y-2">
          {ALL_EVENT_TYPES.map((e) => (
            <label key={e} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={events.includes(e)}
                onCheckedChange={() => toggleEvent(e)}
                data-testid={`checkbox-event-${e}`}
              />
              <span>
                {t(
                  `settings.integrations.event${e
                    .split("_")
                    .map((p) => p[0].toUpperCase() + p.slice(1))
                    .join("")}`,
                )}
              </span>
            </label>
          ))}
        </div>
      </div>
      {showEnabledToggle && (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={enabled}
            onCheckedChange={(c) => setEnabled(!!c)}
            data-testid="checkbox-integration-enabled"
          />
          <span>{t("settings.integrations.enabled")}</span>
        </label>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button
          onClick={submit}
          disabled={isSaving || !canSave}
          data-testid="button-save-integration-slack-oauth"
        >
          {isSaving ? t("common.saving") : t("settings.integrations.saveChanges")}
        </Button>
      </div>
    </div>
  );
}

function IntegrationRow({
  orgId,
  integration,
  formatDate,
  onChanged,
}: {
  orgId: number;
  integration: OrgIntegration;
  formatDate: (s: string | null) => string;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateMutation = useUpdateOrgIntegration({
    mutation: {
      onSuccess: () => {
        toast({ title: t("settings.integrations.saved") });
        setIsEditOpen(false);
        onChanged();
      },
      onError: (err) => {
        toast({
          title: t("settings.error"),
          description: (err as Error)?.message || "",
          variant: "destructive",
        });
      },
    },
  });

  const deleteMutation = useDeleteOrgIntegration({
    mutation: {
      onSuccess: () => {
        toast({ title: t("settings.integrations.removed") });
        setConfirmDelete(false);
        onChanged();
      },
    },
  });

  const testMutation = useTestOrgIntegration({
    mutation: {
      onSuccess: (data) => {
        if (data.ok) {
          toast({ title: t("settings.integrations.testSucceeded") });
        } else {
          toast({
            title: t("settings.integrations.testFailed"),
            description: data.error || "",
            variant: "destructive",
          });
        }
        onChanged();
      },
      onError: (err) => {
        toast({
          title: t("settings.integrations.testFailed"),
          description: (err as Error)?.message || "",
          variant: "destructive",
        });
        onChanged();
      },
    },
  });

  const cfg = integration.config as Record<string, unknown>;
  const isOauth = cfg.mode === "oauth";
  const masked = typeof cfg.webhookUrlMasked === "string" ? (cfg.webhookUrlMasked as string) : "";
  const channel = typeof cfg.channelName === "string" ? (cfg.channelName as string) : "";
  const teamName = typeof cfg.teamName === "string" ? (cfg.teamName as string) : "";

  return (
    <Card data-testid={`row-integration-${integration.id}`}>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold">
                {integration.type === "slack"
                  ? t("settings.integrations.slack")
                  : t("settings.integrations.teams")}
              </p>
              <Badge
                variant={integration.enabled ? "default" : "outline"}
                className="text-xs"
                data-testid={`badge-integration-${integration.enabled ? "on" : "off"}`}
              >
                {integration.enabled
                  ? t("settings.integrations.enabled")
                  : t("settings.integrations.disabled")}
              </Badge>
              {isOauth && (
                <Badge variant="secondary" className="text-xs">
                  {t("settings.integrations.oauthBadge")}
                </Badge>
              )}
              {channel && (
                <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {channel.startsWith("#") ? channel : `#${channel}`}
                </code>
              )}
            </div>
            {isOauth ? (
              <p className="text-xs text-muted-foreground mt-1">
                {t("settings.integrations.connectedVia", {
                  workspace: teamName || t("settings.integrations.slack"),
                })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                {t("settings.integrations.currentWebhook")}:{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">{masked || "—"}</code>
              </p>
            )}
            {integration.lastError && (
              <p className="text-xs text-destructive mt-1">
                {t("settings.integrations.lastError")}: {integration.lastError}
                {integration.lastErrorAt
                  ? ` (${t("settings.integrations.lastErrorAt", { date: formatDate(integration.lastErrorAt) })})`
                  : ""}
              </p>
            )}
            <div className="mt-1 flex flex-wrap gap-1">
              {integration.eventTypes.map((e) => (
                <Badge key={e} variant="secondary" className="text-xs font-normal">
                  {t(
                    `settings.integrations.event${e
                      .split("_")
                      .map((p) => p[0].toUpperCase() + p.slice(1))
                      .join("")}`,
                  )}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => testMutation.mutate({ orgId, id: integration.id, data: {} })}
              disabled={testMutation.isPending}
              data-testid={`button-test-${integration.id}`}
            >
              <Send className="h-3 w-3 me-1" />
              {t("settings.integrations.sendTest")}
            </Button>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditOpen(true)}
                data-testid={`button-edit-integration-${integration.id}`}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => setConfirmDelete(true)}
                data-testid={`button-delete-integration-${integration.id}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {integration.type === "slack"
                ? t("settings.integrations.slack")
                : t("settings.integrations.teams")}
            </DialogTitle>
          </DialogHeader>
          {isOauth ? (
            <SlackOauthForm
              orgId={orgId}
              initialChannelId={typeof cfg.channelId === "string" ? cfg.channelId : ""}
              initialEventTypes={integration.eventTypes}
              initialEnabled={integration.enabled}
              showEnabledToggle
              isSaving={updateMutation.isPending}
              onCancel={() => setIsEditOpen(false)}
              onSubmit={(payload) =>
                updateMutation.mutate({ orgId, id: integration.id, data: payload })
              }
            />
          ) : (
            <IntegrationForm
              orgId={orgId}
              type={integration.type as "slack" | "teams"}
              initialChannel={channel}
              initialEventTypes={integration.eventTypes}
              initialEnabled={integration.enabled}
              initialTemplate={
                typeof (integration.config as Record<string, unknown>).template === "string"
                  ? ((integration.config as Record<string, unknown>).template as string)
                  : "detailed"
              }
              initialCustomTemplate={
                typeof (integration.config as Record<string, unknown>).customTemplate === "string"
                  ? ((integration.config as Record<string, unknown>).customTemplate as string)
                  : ""
              }
              initialIntro={
                typeof (integration.config as Record<string, unknown>).intro === "string"
                  ? ((integration.config as Record<string, unknown>).intro as string)
                  : ""
              }
              initialFields={
                Array.isArray((integration.config as Record<string, unknown>).fields)
                  ? ((integration.config as Record<string, unknown>).fields as string[])
                  : undefined
              }
              showEnabledToggle
              onSubmit={(payload) =>
                updateMutation.mutate({ orgId, id: integration.id, data: payload })
              }
              onCancel={() => setIsEditOpen(false)}
              isSaving={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDialog.areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.integrations.removeConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirmDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate({ orgId, id: integration.id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("settings.integrations.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function TagsTab({ orgId }: { orgId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("organizations", "edit");

  const { data: tags, isLoading } = useListTags(orgId, {
    query: { enabled: !!orgId, queryKey: getListTagsQueryKey(orgId) },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListTagsQueryKey(orgId) });

  const createMutation = useCreateTag({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: t("settings.tagsManager.created") });
        setNewName("");
        setNewColor(DEFAULT_TAG_COLORS[0]);
        setNewDescription("");
      },
      onError: (err: unknown) => {
        toast({
          title: t("settings.tagsManager.createFailed"),
          description: (err as Error)?.message,
          variant: "destructive",
        });
      },
    },
  });
  const updateMutation = useUpdateTag({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: t("settings.tagsManager.updated") });
        setEditingId(null);
      },
      onError: (err: unknown) => {
        toast({
          title: t("settings.tagsManager.updateFailed"),
          description: (err as Error)?.message,
          variant: "destructive",
        });
      },
    },
  });
  const deleteMutation = useDeleteTag({
    mutation: {
      onSuccess: () => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey(orgId) });
        toast({ title: t("settings.tagsManager.deleted") });
      },
      onError: (err: unknown) => {
        toast({
          title: t("settings.tagsManager.deleteFailed"),
          description: (err as Error)?.message,
          variant: "destructive",
        });
      },
    },
  });

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(DEFAULT_TAG_COLORS[0]);
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const startEdit = (tag: { id: number; name: string; color: string; description: string }) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
    setEditDescription(tag.description);
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createMutation.mutate({
      orgId,
      data: { name, color: newColor, description: newDescription.trim() },
    });
  };

  const handleSaveEdit = (id: number) => {
    updateMutation.mutate({
      orgId,
      tagId: id,
      data: { name: editName.trim(), color: editColor, description: editDescription.trim() },
    });
  };

  return (
    <div className="space-y-6" data-testid="tags-tab">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <TagIconLucide className="h-5 w-5" />
          {t("settings.tagsManager.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t("settings.tagsManager.subtitle")}</p>
      </div>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("settings.tagsManager.createTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <Label>{t("settings.tagsManager.name")}</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t("settings.tagsManager.namePlaceholder")}
                  data-testid="tag-new-name"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>{t("settings.tagsManager.description")}</Label>
                <Input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder={t("settings.tagsManager.descriptionPlaceholder")}
                  data-testid="tag-new-description"
                />
              </div>
            </div>
            <div>
              <Label>{t("settings.tagsManager.color")}</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {DEFAULT_TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className={`w-7 h-7 rounded-md border-2 transition-transform ${newColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                    data-testid={`tag-new-color-${c}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending || !newName.trim()}
                data-testid="tag-new-create"
              >
                <Plus className="h-4 w-4 me-1" />
                {t("settings.tagsManager.create")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.tagsManager.libraryTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24" />
          ) : !tags || tags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("settings.tagsManager.empty")}
            </p>
          ) : (
            <div className="space-y-2">
              {tags.map((tag: { id: number; name: string; color: string; description: string; usageCount: number }) => {
                const isEditing = editingId === tag.id;
                if (isEditing) {
                  return (
                    <div key={tag.id} className="border rounded-md p-3 space-y-2" data-testid={`tag-row-${tag.id}`}>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          data-testid={`tag-edit-name-${tag.id}`}
                        />
                        <Input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="sm:col-span-2"
                          data-testid={`tag-edit-description-${tag.id}`}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {DEFAULT_TAG_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditColor(c)}
                            className={`w-6 h-6 rounded-md border-2 ${editColor === c ? "border-foreground" : "border-transparent"}`}
                            style={{ backgroundColor: c }}
                            aria-label={c}
                          />
                        ))}
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                          {t("settings.tagsManager.cancel")}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(tag.id)}
                          disabled={updateMutation.isPending || !editName.trim()}
                          data-testid={`tag-edit-save-${tag.id}`}
                        >
                          {t("settings.tagsManager.save")}
                        </Button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between border rounded-md px-3 py-2"
                    data-testid={`tag-row-${tag.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge
                        variant="secondary"
                        className="h-6 px-2 gap-1"
                        style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                      >
                        {tag.name}
                      </Badge>
                      {tag.description && (
                        <span className="text-xs text-muted-foreground truncate">{tag.description}</span>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {t("settings.tagsManager.usageCount", { count: tag.usageCount })}
                      </span>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(tag)}
                          data-testid={`tag-edit-${tag.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`tag-delete-${tag.id}`}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("settings.tagsManager.deleteTitle")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("settings.tagsManager.deleteDesc", { name: tag.name, count: tag.usageCount })}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("settings.tagsManager.cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate({ orgId, tagId: tag.id })}
                              >
                                {t("settings.tagsManager.delete")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const DEFAULT_TAG_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];

function PasswordPolicyTab({ orgId }: { orgId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: org, isLoading } = useGetOrganization(orgId, {
    query: { enabled: !!orgId, queryKey: getGetOrganizationQueryKey(orgId) },
  });

  const [minLength, setMinLength] = useState<number>(8);
  const [requireUpper, setRequireUpper] = useState(false);
  const [requireLower, setRequireLower] = useState(false);
  const [requireDigit, setRequireDigit] = useState(false);
  const [requireSymbol, setRequireSymbol] = useState(false);
  const [maxAgeDays, setMaxAgeDays] = useState<number>(0);
  const [preventReuseLast, setPreventReuseLast] = useState<number>(0);

  useEffect(() => {
    const p = org?.passwordPolicy;
    if (p) {
      setMinLength(p.minLength ?? 8);
      setRequireUpper(!!p.requireUpper);
      setRequireLower(!!p.requireLower);
      setRequireDigit(!!p.requireDigit);
      setRequireSymbol(!!p.requireSymbol);
      setMaxAgeDays(p.maxAgeDays ?? 0);
      setPreventReuseLast(p.preventReuseLast ?? 0);
    }
  }, [org]);

  const saveMutation = useUpdateOrganization({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOrganizationQueryKey(orgId) });
        toast({ title: t("passwordPolicy.savedTitle"), description: t("passwordPolicy.savedDesc") });
      },
      onError: () => {
        toast({ title: t("passwordPolicy.saveFailed"), variant: "destructive" });
      },
    },
  });

  const handleSave = () => {
    const clamp = (v: number, lo: number, hi: number) =>
      Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
    saveMutation.mutate({
      id: orgId,
      data: {
        passwordPolicy: {
          minLength: clamp(minLength, 8, 64),
          requireUpper,
          requireLower,
          requireDigit,
          requireSymbol,
          maxAgeDays: clamp(maxAgeDays, 0, 3650),
          preventReuseLast: clamp(preventReuseLast, 0, 10),
        },
      },
    });
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {t("passwordPolicy.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("passwordPolicy.subtitle")}</p>

          <div>
            <Label htmlFor="pp-minLength">{t("passwordPolicy.minLength")}</Label>
            <Input
              id="pp-minLength"
              type="number"
              min={8}
              max={64}
              value={minLength}
              onChange={(e) => setMinLength(parseInt(e.target.value || "8", 10))}
              data-testid="input-pp-min-length"
            />
            <p className="text-xs text-muted-foreground mt-1">{t("passwordPolicy.minLengthHint")}</p>
          </div>

          <div className="space-y-2">
            <Label>{t("passwordPolicy.complexity")}</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={requireUpper}
                  onCheckedChange={(v) => setRequireUpper(!!v)}
                  data-testid="checkbox-pp-upper"
                />
                {t("passwordPolicy.requireUpper")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={requireLower}
                  onCheckedChange={(v) => setRequireLower(!!v)}
                  data-testid="checkbox-pp-lower"
                />
                {t("passwordPolicy.requireLower")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={requireDigit}
                  onCheckedChange={(v) => setRequireDigit(!!v)}
                  data-testid="checkbox-pp-digit"
                />
                {t("passwordPolicy.requireDigit")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={requireSymbol}
                  onCheckedChange={(v) => setRequireSymbol(!!v)}
                  data-testid="checkbox-pp-symbol"
                />
                {t("passwordPolicy.requireSymbol")}
              </label>
            </div>
          </div>

          <div>
            <Label htmlFor="pp-maxAge">{t("passwordPolicy.maxAgeDays")}</Label>
            <Input
              id="pp-maxAge"
              type="number"
              min={0}
              max={3650}
              value={maxAgeDays}
              onChange={(e) => setMaxAgeDays(parseInt(e.target.value || "0", 10))}
              data-testid="input-pp-max-age"
            />
            <p className="text-xs text-muted-foreground mt-1">{t("passwordPolicy.maxAgeHint")}</p>
          </div>

          <div>
            <Label htmlFor="pp-reuse">{t("passwordPolicy.preventReuseLast")}</Label>
            <Input
              id="pp-reuse"
              type="number"
              min={0}
              max={10}
              value={preventReuseLast}
              onChange={(e) => setPreventReuseLast(parseInt(e.target.value || "0", 10))}
              data-testid="input-pp-reuse"
            />
            <p className="text-xs text-muted-foreground mt-1">{t("passwordPolicy.preventReuseHint")}</p>
          </div>

          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="button-save-password-policy"
            >
              <Save className="h-4 w-4 me-2" />
              {saveMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
