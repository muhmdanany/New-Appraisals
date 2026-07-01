import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, Copy, Download, AlertCircle, Trash2 } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface SSOConfig {
  organizationId: number;
  enabled: boolean;
  entityId: string;
  ssoUrl: string;
  x509Cert: string;
  jitEnabled: boolean;
  defaultRoleId: number | null;
  requireSso: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SSOResponse {
  config: SSOConfig | null;
  spEntityId: string;
  spAcsUrl: string;
  metadataUrl: string;
  loginUrl: string;
}

interface RoleSummary {
  id: number;
  name: string;
}

export default function SSOTab({ orgId }: { orgId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ spEntityId: string; spAcsUrl: string; metadataUrl: string; loginUrl: string } | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [entityId, setEntityId] = useState("");
  const [ssoUrl, setSsoUrl] = useState("");
  const [x509Cert, setX509Cert] = useState("");
  const [jitEnabled, setJitEnabled] = useState(false);
  const [defaultRoleId, setDefaultRoleId] = useState<number | null>(null);
  const [requireSso, setRequireSso] = useState(false);
  const [metadataXml, setMetadataXml] = useState("");

  const [roles, setRoles] = useState<RoleSummary[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [cfgR, rolesR] = await Promise.all([
        fetch(`${API_BASE}/organizations/${orgId}/sso`, { credentials: "include" }),
        fetch(`${API_BASE}/organizations/${orgId}/roles`, { credentials: "include" }),
      ]);
      if (cfgR.ok) {
        const data: SSOResponse = await cfgR.json();
        setInfo({ spEntityId: data.spEntityId, spAcsUrl: data.spAcsUrl, metadataUrl: data.metadataUrl, loginUrl: data.loginUrl });
        if (data.config) {
          setEnabled(data.config.enabled);
          setEntityId(data.config.entityId);
          setSsoUrl(data.config.ssoUrl);
          setX509Cert(data.config.x509Cert);
          setJitEnabled(data.config.jitEnabled);
          setDefaultRoleId(data.config.defaultRoleId);
          setRequireSso(data.config.requireSso);
        }
      }
      if (rolesR.ok) {
        const rs = await rolesR.json();
        setRoles(Array.isArray(rs) ? rs.map((r: any) => ({ id: r.id, name: r.name })) : []);
      }
    } catch {
      setError(t("settings.sso.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const copy = async (val: string, label: string) => {
    try {
      await navigator.clipboard.writeText(val);
      toast({ title: t("settings.sso.copied", { label }) });
    } catch {
      /* noop */
    }
  };

  const handleParseMetadata = async () => {
    if (!metadataXml.trim()) return;
    setError(null);
    const r = await fetch(`${API_BASE}/organizations/${orgId}/sso/parse-metadata`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadataXml }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(data.message || t("settings.sso.metadataParseFailed"));
      return;
    }
    setEntityId(data.entityId || "");
    setSsoUrl(data.ssoUrl || "");
    setX509Cert(data.x509Cert || "");
    setMetadataXml("");
    toast({ title: t("settings.sso.metadataParsed") });
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/organizations/${orgId}/sso`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          entityId,
          ssoUrl,
          x509Cert,
          jitEnabled,
          defaultRoleId,
          requireSso,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.message || t("settings.sso.saveFailed"));
        return;
      }
      setInfo({ spEntityId: data.spEntityId, spAcsUrl: data.spAcsUrl, metadataUrl: data.metadataUrl, loginUrl: data.loginUrl });
      toast({ title: t("settings.sso.saved") });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t("settings.sso.confirmDelete"))) return;
    const r = await fetch(`${API_BASE}/organizations/${orgId}/sso`, {
      method: "DELETE",
      credentials: "include",
    });
    if (r.ok) {
      setEnabled(false);
      setEntityId("");
      setSsoUrl("");
      setX509Cert("");
      setJitEnabled(false);
      setDefaultRoleId(null);
      setRequireSso(false);
      toast({ title: t("settings.sso.deleted") });
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">{t("common.loading") ?? "Loading..."}</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            {t("settings.sso.spInfoTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("settings.sso.spInfoSubtitle")}</p>
          {info && (
            <>
              <div>
                <Label>{t("settings.sso.spEntityId")}</Label>
                <div className="flex gap-2">
                  <Input readOnly value={info.spEntityId} data-testid="input-sso-sp-entity-id" />
                  <Button type="button" variant="outline" size="icon" onClick={() => copy(info.spEntityId, t("settings.sso.spEntityId"))}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>{t("settings.sso.acsUrl")}</Label>
                <div className="flex gap-2">
                  <Input readOnly value={info.spAcsUrl} data-testid="input-sso-acs-url" />
                  <Button type="button" variant="outline" size="icon" onClick={() => copy(info.spAcsUrl, t("settings.sso.acsUrl"))}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={info.metadataUrl} target="_blank" rel="noreferrer" data-testid="link-sso-metadata">
                    <Download className="h-4 w-4 me-2" />
                    {t("settings.sso.downloadMetadata")}
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={info.loginUrl} target="_blank" rel="noreferrer" data-testid="link-sso-test">
                    {t("settings.sso.testLogin")}
                  </a>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">{t("settings.sso.idpTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 text-destructive bg-destructive/10 px-3 py-2 rounded text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <Label>{t("settings.sso.metadataXmlLabel")}</Label>
            <Textarea
              rows={4}
              value={metadataXml}
              onChange={(e) => setMetadataXml(e.target.value)}
              placeholder={t("settings.sso.metadataXmlPlaceholder")}
              data-testid="textarea-sso-metadata-xml"
            />
            <div className="mt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleParseMetadata} disabled={!metadataXml.trim()}>
                {t("settings.sso.parseMetadata")}
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            <div>
              <Label htmlFor="sso-entity-id">{t("settings.sso.idpEntityId")}</Label>
              <Input
                id="sso-entity-id"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="https://idp.example.com/saml"
                data-testid="input-sso-idp-entity-id"
              />
            </div>
            <div>
              <Label htmlFor="sso-url">{t("settings.sso.idpSsoUrl")}</Label>
              <Input
                id="sso-url"
                value={ssoUrl}
                onChange={(e) => setSsoUrl(e.target.value)}
                placeholder="https://idp.example.com/sso"
                data-testid="input-sso-idp-url"
              />
            </div>
            <div>
              <Label htmlFor="sso-cert">{t("settings.sso.idpCert")}</Label>
              <Textarea
                id="sso-cert"
                rows={6}
                value={x509Cert}
                onChange={(e) => setX509Cert(e.target.value)}
                placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
                data-testid="textarea-sso-cert"
              />
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="sso-enabled" className="font-medium">{t("settings.sso.enabledLabel")}</Label>
                <p className="text-xs text-muted-foreground">{t("settings.sso.enabledHelp")}</p>
              </div>
              <Switch id="sso-enabled" checked={enabled} onCheckedChange={setEnabled} data-testid="switch-sso-enabled" />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="sso-jit" className="font-medium">{t("settings.sso.jitLabel")}</Label>
                <p className="text-xs text-muted-foreground">{t("settings.sso.jitHelp")}</p>
              </div>
              <Switch id="sso-jit" checked={jitEnabled} onCheckedChange={setJitEnabled} data-testid="switch-sso-jit" />
            </div>
            <div>
              <Label>{t("settings.sso.defaultRoleLabel")}</Label>
              <Select
                value={defaultRoleId ? String(defaultRoleId) : "none"}
                onValueChange={(v) => setDefaultRoleId(v === "none" ? null : Number(v))}
              >
                <SelectTrigger data-testid="select-sso-default-role">
                  <SelectValue placeholder={t("settings.sso.defaultRolePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("settings.sso.defaultRoleNone")}</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">{t("settings.sso.defaultRoleHelp")}</p>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="sso-require" className="font-medium">{t("settings.sso.requireLabel")}</Label>
                <p className="text-xs text-muted-foreground">{t("settings.sso.requireHelp")}</p>
              </div>
              <Switch id="sso-require" checked={requireSso} onCheckedChange={setRequireSso} data-testid="switch-sso-require" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} data-testid="button-sso-save">
              {saving ? t("common.saving") ?? "Saving..." : t("settings.sso.save")}
            </Button>
            <Button type="button" variant="outline" onClick={handleDelete} data-testid="button-sso-delete">
              <Trash2 className="h-4 w-4 me-2" />
              {t("settings.sso.delete")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
