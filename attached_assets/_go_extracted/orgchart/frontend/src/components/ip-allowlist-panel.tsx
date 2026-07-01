import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Globe, Trash2, Plus } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface IpAllowlistEntry {
  id: number;
  cidr: string;
  description?: string | null;
  createdAt: string;
}

export function IpAllowlistPanel() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { activeOrgId, hasPermission } = useAuth();
  const [entries, setEntries] = useState<IpAllowlistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cidr, setCidr] = useState("");
  const [description, setDescription] = useState("");
  const [adding, setAdding] = useState(false);

  const canEdit = hasPermission("organizations", "edit");

  const reload = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${API_BASE}/organizations/${activeOrgId}/ip-allowlist`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("load_failed");
      const data: { entries: IpAllowlistEntry[] } = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      setError(t("ipAllowlist.loadError"));
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, t]);

  useEffect(() => {
    if (canEdit && activeOrgId) {
      reload();
    }
  }, [canEdit, activeOrgId, reload]);

  if (!activeOrgId || !canEdit) return null;

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!cidr.trim()) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch(
        `${API_BASE}/organizations/${activeOrgId}/ip-allowlist`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ cidr: cidr.trim(), description: description.trim() }),
        },
      );
      if (!res.ok) {
        const data: { message?: string } = await res.json().catch(() => ({}));
        setError(data.message || t("ipAllowlist.invalidCidr"));
        return;
      }
      setCidr("");
      setDescription("");
      toast({ title: t("ipAllowlist.addedToast") });
      await reload();
    } finally {
      setAdding(false);
    }
  }

  async function removeEntry(id: number) {
    if (!window.confirm(t("ipAllowlist.removeConfirm"))) return;
    const res = await fetch(
      `${API_BASE}/organizations/${activeOrgId}/ip-allowlist/${id}`,
      { method: "DELETE", credentials: "include" },
    );
    if (res.ok) {
      toast({ title: t("ipAllowlist.removedToast") });
      await reload();
    } else {
      setError(t("ipAllowlist.removeError"));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Globe className="h-4 w-4" />
          {t("ipAllowlist.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("ipAllowlist.description")}</p>
        <p className="text-xs text-muted-foreground">{t("ipAllowlist.helpText")}</p>

        {error && (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-3 py-2 rounded text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <form onSubmit={addEntry} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <div>
            <Label htmlFor="ip-cidr">{t("ipAllowlist.cidrLabel")}</Label>
            <Input
              id="ip-cidr"
              value={cidr}
              onChange={(e) => setCidr(e.target.value)}
              placeholder={t("ipAllowlist.cidrPlaceholder")}
              data-testid="input-ip-cidr"
            />
          </div>
          <div>
            <Label htmlFor="ip-desc">{t("ipAllowlist.descriptionLabel")}</Label>
            <Input
              id="ip-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("ipAllowlist.descriptionPlaceholder")}
              data-testid="input-ip-description"
            />
          </div>
          <Button
            type="submit"
            disabled={adding || !cidr.trim()}
            data-testid="button-add-ip"
          >
            <Plus className="h-4 w-4 me-1.5" />
            {t("ipAllowlist.addButton")}
          </Button>
        </form>

        {loading && <Skeleton className="h-16 w-full" />}

        {!loading && entries.length === 0 && (
          <p className="text-sm text-muted-foreground" data-testid="text-ip-empty">
            {t("ipAllowlist.empty")}
          </p>
        )}

        {!loading && entries.length > 0 && (
          <ul className="divide-y divide-border rounded border border-border">
            {entries.map((e) => (
              <li
                key={e.id}
                className="px-3 py-2.5 flex items-center justify-between gap-3"
                data-testid={`ip-row-${e.id}`}
              >
                <div className="min-w-0 flex-1">
                  <code className="text-sm font-mono">{e.cidr}</code>
                  {e.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {e.description}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => removeEntry(e.id)}
                  data-testid={`button-remove-ip-${e.id}`}
                  aria-label={t("ipAllowlist.removeButton")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
