import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Jobs from "@/pages/jobs/index";
import Competencies from "@/pages/competencies/index";
import Grades from "@/pages/grades/index";
import Employees from "@/pages/employees/index";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { useIdentity, ROLE_LABELS } from "@/lib/identity";
import { parseSpreadsheet, pick, mapRole, downloadImportTemplate } from "@/lib/xlsx";
import {
  Upload, Download, Users, Settings, FileSpreadsheet,
  Plus, Pencil, Trash2, CheckCircle, XCircle, Shield, Lock, Bell,
  ChevronDown, ChevronUp, ChevronLeft, Search, Copy, SlidersHorizontal,
  LayoutDashboard, Briefcase, Award, GraduationCap, Map, Target,
  ClipboardCheck, FileBarChart, PieChart, Network, Mail, Loader2, Eye, EyeOff, Info, ExternalLink, FileText,
} from "lucide-react";

// --- API helpers ---

function getHeaders(): HeadersInit {
  const uid = localStorage.getItem("selectedUserId");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (uid) h["X-User-Id"] = uid;
  return h;
}

async function apiFetch<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, headers: { ...getHeaders(), ...opts?.headers } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `HTTP ${res.status}`);
  }
  return res.json();
}

// Types
type User = {
  id: string; email: string; name: string; role: string;
  isActive: boolean; employeeId: string | null;
  createdAt: string; updatedAt: string;
};

type Employee = {
  id: string; name: string; employeeNumber: string;
  jobName?: string; departmentName?: string; gradeName?: string;
};

type EvalSettings = {
  defaultKpiWeight: number; defaultCompetencyWeight: number;
  ratingScale: number; ratingLabels: string[];
  evaluationPeriods: string[];
  requireApproval: boolean; requireAcknowledgment: boolean; allowObjection: boolean;
};

type ImportRow = {
  employeeNumber: string; name: string; email: string;
  role: string; managerNumber: string;
};

// ============== Section definitions for dashboard cards ==============

type SectionCard = {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
};

type Section = {
  title: string;
  cards: SectionCard[];
};

function getSections(t: (key: string) => string): Section[] {
  return [
    {
      title: t("admin.sections.accessControl"),
      cards: [
        { id: "users", icon: Users, title: t("admin.cards.users"), description: t("admin.cards.usersDesc") },
        { id: "permissions", icon: Shield, title: t("admin.cards.permissions"), description: t("admin.cards.permissionsDesc") },
      ],
    },
    {
      title: t("admin.sections.dataManagement"),
      cards: [
        { id: "jobs", icon: Briefcase, title: t("admin.cards.jobs"), description: t("admin.cards.jobsDesc") },
        { id: "competencies", icon: Award, title: t("admin.cards.competencies"), description: t("admin.cards.competenciesDesc") },
        { id: "grades", icon: GraduationCap, title: t("admin.cards.grades"), description: t("admin.cards.gradesDesc") },
        { id: "employees", icon: Users, title: t("admin.cards.employees"), description: t("admin.cards.employeesDesc") },
      ],
    },
    {
      title: t("admin.sections.systemSettings"),
      cards: [
        { id: "settings", icon: Settings, title: t("admin.cards.settings"), description: t("admin.cards.settingsDesc") },
        { id: "notifications", icon: Bell, title: "الإشعارات", description: "إعدادات البريد والواتساب وسجل الإشعارات" },
        { id: "templates", icon: FileText, title: "نماذج التقييم", description: "إدارة نماذج وأسئلة التقييم" },
      ],
    },
  ];
}

function getViewTitles(t: (key: string) => string): Record<string, string> {
  return {
    users: t("admin.views.users"),
    permissions: t("admin.views.permissions"),
    import: t("admin.views.import"),
    settings: t("admin.views.settings"),
    jobs: t("admin.views.jobs"),
    competencies: t("admin.views.competencies"),
    grades: t("admin.views.grades"),
    employees: t("admin.views.employees"),
    notifications: "الإشعارات",
    templates: "نماذج التقييم",
  };
}

// ============== MAIN COMPONENT ==============

export default function AdminPage() {
  const { user } = useIdentity();
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState<string | null>(null);
  const [empTab, setEmpTab] = useState<"list" | "import" | "office365">("list");

  const sections = getSections(t);
  const viewTitles = getViewTitles(t);

  if (!user || !["ADMIN", "HR_MANAGER"].includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t("admin.unauthorized")}</h2>
            <p className="text-muted-foreground">{t("admin.unauthorizedDesc")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Page header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold">{t("admin.title")}</h1>
        <p className="text-muted-foreground mt-2">{t("admin.subtitle")}</p>
      </div>

      {/* Sections */}
      {sections.map((section) => (
        <div key={section.title} className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {section.cards.map((card) => (
              <button
                key={card.id}
                onClick={() => setActiveView(card.id)}
                className="group text-right w-full"
              >
                <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-primary/30 cursor-pointer">
                  <CardContent className="py-4 px-4 flex flex-col items-center text-center gap-1.5">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                      <card.icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-sm text-foreground">{card.title}</h3>
                    <p className="text-xs text-muted-foreground leading-snug">{card.description}</p>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Popup Dialogs */}
      <Dialog open={!!activeView} onOpenChange={(o) => !o && setActiveView(null)}>
        <DialogContent className="max-w-4xl max-h-[75vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-right text-xl">
              {activeView ? viewTitles[activeView] ?? "" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 overflow-y-auto overflow-x-hidden flex-1 min-h-0 pl-4">
            {activeView === "users" && <UsersTab />}
            {activeView === "permissions" && <PermissionsTab />}

            {activeView === "settings" && <SettingsTab />}
            {activeView === "notifications" && <NotificationsTab />}
            {activeView === "templates" && <TemplatesTab />}
            {activeView === "jobs" && <Jobs />}
            {activeView === "competencies" && <Competencies />}
            {activeView === "grades" && <Grades />}
            {activeView === "employees" && (
              <div className="space-y-4">
                <div className="flex gap-2 border-b pb-2">
                  <Button
                    variant={empTab === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setEmpTab("list")}
                  >
                    <Users className="w-4 h-4 ml-1" />
                    {t("admin.empTabs.list")}
                  </Button>
                  <Button
                    variant={empTab === "import" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setEmpTab("import")}
                  >
                    <Upload className="w-4 h-4 ml-1" />
                    {t("admin.empTabs.import")}
                  </Button>
                  <Button
                    variant={empTab === "office365" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setEmpTab("office365")}
                  >
                    <Mail className="w-4 h-4 ml-1" />
                    {t("admin.empTabs.office365")}
                  </Button>
                </div>
                {empTab === "list" && <Employees />}
                {empTab === "import" && <ImportTab />}
                {empTab === "office365" && <Office365Tab />}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============== IMPORT TAB ==============

function ImportTab() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; usersCreated: number } | null>(null);

  const handleFile = useCallback(async (file: File) => {
    try {
      const raw = await parseSpreadsheet(file);
      const parsed: ImportRow[] = raw.map((r) => ({
        employeeNumber: pick(r, "الرقم الوظيفي", "employeeNumber", "رقم الموظف", "الرقم"),
        name: pick(r, "الاسم", "name", "اسم الموظف"),
        email: pick(r, "البريد الإلكتروني", "email", "البريد", "الإيميل"),
        role: mapRole(pick(r, "الدور", "role", "الصلاحية", "النوع")),
        managerNumber: pick(r, "رقم المدير", "managerNumber", "المدير"),
      }));
      const valid = parsed.filter((r) => r.employeeNumber && r.name);
      setRows(valid);
      setResult(null);
      if (valid.length === 0) {
        toast({ title: t("admin.importTab.noValidData"), description: t("admin.importTab.ensureColumns"), variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: t("admin.importTab.fileError"), description: e.message, variant: "destructive" });
    }
  }, [toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const doImport = async () => {
    setImporting(true);
    try {
      const res = await apiFetch<{ imported: number; usersCreated: number }>(
        "/api/admin/import-with-roles",
        { method: "POST", body: JSON.stringify({ rows }) }
      );
      setResult(res);
      toast({ title: t("admin.importTab.uploadSuccess"), description: `${res.imported} ${t("admin.importTab.employeeAnd")} ${res.usersCreated} ${t("admin.importTab.userAccount")}` });
    } catch (e: any) {
      toast({ title: t("admin.importTab.uploadError"), description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            {t("admin.importTab.uploadTitle")}
          </CardTitle>
          <CardDescription>
            {t("admin.importTab.uploadDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">{t("admin.importTab.dropHint")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("admin.importTab.supportedFormats")}</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={onFileChange}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadImportTemplate}>
              <Download className="w-4 h-4 ml-2" />
              {t("admin.importTab.downloadTemplate")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.importTab.preview")} {rows.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>{t("admin.importTab.empNum")}</TableHead>
                    <TableHead>{t("admin.importTab.name")}</TableHead>
                    <TableHead>{t("admin.importTab.email")}</TableHead>
                    <TableHead>{t("admin.importTab.role")}</TableHead>
                    <TableHead>{t("admin.importTab.managerNum")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-mono">{row.employeeNumber}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-sm">{row.email || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={row.role === "ADMIN" ? "destructive" : row.role.includes("MANAGER") ? "default" : "secondary"}>
                          {t(`roles.${row.role}`) !== `roles.${row.role}` ? t(`roles.${row.role}`) : row.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{row.managerNumber || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">{rows.length} {t("admin.importTab.readyRows")}</p>
              <Button onClick={doImport} disabled={importing}>
                {importing ? t("admin.importTab.uploading") : t("admin.importTab.uploadSave")}
                <Upload className="w-4 h-4 mr-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold">{t("admin.importTab.uploadSuccess")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("admin.importTab.imported")} {result.imported} {t("admin.importTab.employeeAnd")} {result.usersCreated} {t("admin.importTab.userAccount")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============== OFFICE 365 TAB ==============

type O365User = {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
  jobTitle: string;
  department: string;
};

function Office365Tab() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [users, setUsers] = useState<O365User[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [configLoaded, setConfigLoaded] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [configCollapsed, setConfigCollapsed] = useState(true);

  // Load saved config on mount.
  const { data: configData, isLoading } = useQuery({
    queryKey: ["office365-config"],
    queryFn: async () => {
      const res = await fetch("/api/admin/office365/config", { headers: getHeaders() });
      if (!res.ok) return {};
      return res.json();
    },
  });

  useEffect(() => {
    if (configData) {
      if (configData.tenantId) setTenantId(configData.tenantId);
      if (configData.clientId) setClientId(configData.clientId);
      if (configData.clientSecret) setClientSecret(configData.clientSecret);
      setConfigLoaded(!!configData.tenantId);
    }
  }, [configData]);

  const handleSave = async () => {
    if (!tenantId || !clientId || !clientSecret) {
      toast({ title: t("admin.office365.allRequired"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/office365/config", {
        method: "PUT",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, clientId, clientSecret }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: t("admin.office365.settingsSaved") });
      setConfigLoaded(true);
      qc.invalidateQueries({ queryKey: ["office365-config"] });
    } catch (e: any) {
      toast({ title: t("admin.office365.settingsFailed"), description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleFetchUsers = async () => {
    setFetching(true);
    setUsers([]);
    setSelectedIds(new Set());
    try {
      const res = await fetch("/api/admin/office365/fetch-users", {
        method: "POST",
        headers: getHeaders(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || t("admin.office365.fetchFailed"));
      }
      const data = await res.json();
      setUsers(data.users || []);
      toast({ title: `${t("admin.office365.fetched")} ${data.count} ${t("admin.office365.usersFrom365")}` });
    } catch (e: any) {
      toast({ title: t("admin.office365.fetchFailed"), description: e.message, variant: "destructive" });
    } finally {
      setFetching(false);
    }
  };

  const handleImportUser = async (user: O365User) => {
    const email = user.mail || user.userPrincipalName;
    if (!email || !user.displayName) {
      toast({ title: t("admin.office365.incompleteData"), variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/admin/import-with-roles", {
        method: "POST",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: [{
            employeeNumber: user.id.slice(0, 8).toUpperCase(),
            name: user.displayName,
            email,
            role: "EMPLOYEE",
            managerNumber: "",
          }],
        }),
      });
      if (!res.ok) throw new Error(t("admin.office365.importFailed"));
      toast({ title: `${t("admin.office365.importSuccess")} ${user.displayName} ${t("admin.office365.importSuccessSuffix")}` });
      qc.invalidateQueries({ queryKey: ["/api/employees"] });
    } catch {
      toast({ title: t("admin.office365.importUserFailed"), variant: "destructive" });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map(u => u.id)));
    }
  };

  const handleImportSelected = async () => {
    const selected = users.filter(u => selectedIds.has(u.id) && (u.mail || u.userPrincipalName) && u.displayName);
    if (selected.length === 0) {
      toast({ title: t("admin.office365.selectFirst"), variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/admin/import-with-roles", {
        method: "POST",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: selected.map(u => ({
            employeeNumber: u.id.slice(0, 8).toUpperCase(),
            name: u.displayName,
            email: u.mail || u.userPrincipalName,
            role: "EMPLOYEE",
            managerNumber: "",
          })),
        }),
      });
      if (!res.ok) throw new Error(t("admin.office365.importFailed"));
      const data = await res.json();
      toast({ title: `${t("admin.office365.importSuccess")} ${data.imported} ${t("admin.office365.employeeSuccess")}` });
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["/api/employees"] });
    } catch {
      toast({ title: t("admin.office365.importFailed"), variant: "destructive" });
    }
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Config Section */}
      <Card>
        <CardHeader className="cursor-pointer select-none" onClick={() => setConfigCollapsed(!configCollapsed)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("admin.office365.settingsTitle")}</CardTitle>
            {configCollapsed ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronUp className="w-5 h-5 text-muted-foreground" />}
          </div>
          <CardDescription>{t("admin.office365.settingsDesc")}</CardDescription>
        </CardHeader>
        {!configCollapsed && <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("admin.office365.tenantId")}</Label>
            <Input
              dir="ltr"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("admin.office365.clientId")}</Label>
            <Input
              dir="ltr"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("admin.office365.clientSecret")}</Label>
            <div className="relative">
              <Input
                dir="ltr"
                type={showSecret ? "text" : "password"}
                placeholder="~xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="pl-8"
              />
              <button
                type="button"
                className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <CheckCircle className="w-4 h-4 ml-1" />}
            {t("admin.office365.saveSettings")}
          </Button>
        </CardContent>}
      </Card>

      {/* Fetch Users Section */}
      {configLoaded && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("admin.office365.fetchUsers")}</CardTitle>
            <CardDescription>{t("admin.office365.fetchDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleFetchUsers} disabled={fetching} variant="outline" className="w-full">
              {fetching ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Download className="w-4 h-4 ml-1" />}
              جلب المستخدمين من Office 365
            </Button>

            {users.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{users.length} مستخدم</Badge>
                  <Button size="sm" onClick={handleImportSelected} disabled={selectedIds.size === 0}>
                    <Plus className="w-4 h-4 ml-1" />
                    استيراد المحدد ({selectedIds.size})
                  </Button>
                </div>
                <div className="max-h-[400px] overflow-x-auto overflow-y-auto border rounded-md">
                  <Table className="w-full min-w-[700px]">
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-10 whitespace-nowrap">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-primary"
                            checked={selectedIds.size === users.length && users.length > 0}
                            onChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead className="whitespace-nowrap">الاسم</TableHead>
                        <TableHead className="whitespace-nowrap">البريد</TableHead>
                        <TableHead className="whitespace-nowrap">المسمى الوظيفي</TableHead>
                        <TableHead className="whitespace-nowrap">القسم</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow
                          key={u.id}
                          className={selectedIds.has(u.id) ? "bg-primary/5" : ""}
                          onClick={() => toggleSelect(u.id)}
                          style={{ cursor: "pointer" }}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-primary"
                              checked={selectedIds.has(u.id)}
                              onChange={() => toggleSelect(u.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{u.displayName}</TableCell>
                          <TableCell dir="ltr" className="text-sm">{u.mail || u.userPrincipalName}</TableCell>
                          <TableCell className="text-sm">{u.jobTitle || "—"}</TableCell>
                          <TableCell className="text-sm">{u.department || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Setup Guide */}
      <div className="border rounded-lg overflow-hidden">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-right"
        >
          <div className="flex items-center gap-2">
            {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">كيفية إعداد تطبيق Azure AD للربط مع Office 365</span>
            <Info className="w-4 h-4 text-primary" />
          </div>
        </button>
        {showGuide && (
          <div className="p-4 space-y-5 text-sm leading-relaxed border-t">
            {/* Step 1 */}
            <div className="space-y-2">
              <h4 className="font-bold text-primary flex items-center gap-2 justify-end">
                إنشاء تطبيق في Azure AD
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</span>
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground pr-4" dir="rtl">
                <li>
                  ادخل على{" "}
                  <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">
                    Azure Portal - App registrations
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>اضغط <strong>New registration</strong></li>
                <li>أدخل اسم التطبيق (مثلاً: <code className="bg-muted px-1 rounded text-xs">Competency-Platform</code>)</li>
                <li>اختر <strong>Accounts in this organizational directory only</strong></li>
                <li>اضغط <strong>Register</strong></li>
              </ol>
            </div>

            {/* Step 2 */}
            <div className="space-y-2">
              <h4 className="font-bold text-primary flex items-center gap-2 justify-end">
                نسخ بيانات التطبيق
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">2</span>
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground pr-4" dir="rtl">
                <li>من صفحة <strong>Overview</strong> للتطبيق، انسخ <strong>Application (client) ID</strong> وضعه في حقل <code className="bg-muted px-1 rounded text-xs">Client ID</code></li>
                <li>انسخ <strong>Directory (tenant) ID</strong> وضعه في حقل <code className="bg-muted px-1 rounded text-xs">Tenant ID</code></li>
                <li>اذهب إلى <strong>Certificates &amp; secrets</strong> &gt; <strong>New client secret</strong></li>
                <li>أدخل وصفاً واختر مدة الصلاحية، ثم اضغط <strong>Add</strong></li>
                <li>انسخ قيمة <strong>Value</strong> (السر) فوراً وضعها في حقل <code className="bg-muted px-1 rounded text-xs">Client Secret</code></li>
              </ol>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-2 text-amber-800 dark:text-amber-200 text-xs" dir="rtl">
                <strong>تنبيه:</strong> قيمة السر تظهر مرة واحدة فقط. احفظها فوراً قبل مغادرة الصفحة.
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-2">
              <h4 className="font-bold text-primary flex items-center gap-2 justify-end">
                منح صلاحيات API
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">3</span>
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground pr-4" dir="rtl">
                <li>من قائمة التطبيق، اذهب إلى <strong>API permissions</strong></li>
                <li>اضغط <strong>Add a permission</strong> &gt; <strong>Microsoft Graph</strong></li>
                <li>اختر <strong>Application permissions</strong> (وليس Delegated)</li>
                <li>ابحث عن <code className="bg-muted px-1 rounded text-xs">User.Read.All</code> وحدّدها</li>
                <li>اضغط <strong>Add permissions</strong></li>
                <li>اضغط على زر <strong>Grant admin consent for [اسم المؤسسة]</strong></li>
                <li>تأكد أن حالة الصلاحية أصبحت <span className="text-green-600 dark:text-green-400 font-medium">Granted</span></li>
              </ol>
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-2 text-blue-800 dark:text-blue-200 text-xs" dir="rtl">
                <strong>ملاحظة:</strong> بدون الضغط على <strong>Grant admin consent</strong> ستظهر رسالة خطأ "Insufficient privileges" عند محاولة جلب المستخدمين.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============== USERS TAB ==============

function UsersTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editUser, setEditUser] = useState<User | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["admin", "users"],
    queryFn: () => apiFetch("/api/admin/users"),
  });

  const saveMut = useMutation({
    mutationFn: async (payload: { id?: string; name: string; email: string; role: string; isActive: boolean }) => {
      const { id, ...body } = payload;
      if (id) {
        return apiFetch(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(body) });
      }
      return apiFetch("/api/users", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setEditUser(null);
      setNewOpen(false);
      toast({ title: "تم الحفظ" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiFetch(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({ title: "تم حذف المستخدم" });
    },
    onError: (e: any) => {
      let msg = e.message;
      try { const parsed = JSON.parse(msg); msg = parsed.detail || parsed.title || msg; } catch {}
      toast({ title: "خطأ", description: msg, variant: "destructive" });
    },
  });
  const [toDeleteUserId, setToDeleteUserId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">المستخدمون ({users.length})</h3>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="w-4 h-4 ml-2" />
          إضافة مستخدم
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>البريد</TableHead>
                  <TableHead>الدور</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="w-24">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-sm">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === "ADMIN" ? "destructive" : u.role.includes("MANAGER") ? "default" : "secondary"}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.isActive ? (
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            <CheckCircle className="w-3 h-3 ml-1" /> نشط
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-600 border-red-300">
                            <XCircle className="w-3 h-3 ml-1" /> معطل
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEditUser(u)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {u.role !== "ADMIN" && (
                            <Button variant="ghost" size="icon" onClick={() => setToDeleteUserId(u.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <UserDialog
        open={!!editUser || newOpen}
        user={editUser}
        onClose={() => { setEditUser(null); setNewOpen(false); }}
        onSave={(data) => saveMut.mutate(data)}
        saving={saveMut.isPending}
      />

      <AlertDialog open={!!toDeleteUserId} onOpenChange={(o) => !o && setToDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (toDeleteUserId) deleteMut.mutate(toDeleteUserId); setToDeleteUserId(null); }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserDialog({
  open, user, onClose, onSave, saving,
}: {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onSave: (data: any) => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [isActive, setIsActive] = useState(true);

  const prevOpen = useRef(false);
  if (open && !prevOpen.current) {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setIsActive(user.isActive);
    } else {
      setName(""); setEmail(""); setRole("EMPLOYEE"); setIsActive(true);
    }
  }
  prevOpen.current = open;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">{user ? "تعديل المستخدم" : "إضافة مستخدم جديد"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>الاسم</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المستخدم" />
          </div>
          <div>
            <Label>البريد الإلكتروني</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
          </div>
          <div>
            <Label>الدور</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">مدير النظام</SelectItem>
                <SelectItem value="HR_MANAGER">مدير الموارد البشرية</SelectItem>
                <SelectItem value="FIRST_LEVEL_MANAGER">مدير مباشر</SelectItem>
                <SelectItem value="SECOND_LEVEL_MANAGER">مدير أعلى</SelectItem>
                <SelectItem value="EMPLOYEE">موظف</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>الحالة</Label>
            <div className="flex items-center gap-3">
              <Switch checked={isActive} onCheckedChange={setIsActive} disabled={role === "ADMIN"} />
              <span className="text-sm text-muted-foreground">{isActive ? "نشط" : "معطل"}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button
            onClick={() => onSave({ id: user?.id, name, email, role, isActive })}
            disabled={saving || !name || !email}
          >
            {saving ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== SETTINGS TAB ==============

function SettingsTab() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<EvalSettings>({
    queryKey: ["admin", "eval-settings"],
    queryFn: () => apiFetch("/api/settings/evaluation"),
  });

  const [form, setForm] = useState<EvalSettings | null>(null);
  const [newPeriod, setNewPeriod] = useState("");

  const prevSettings = useRef<EvalSettings | null>(null);
  if (settings && settings !== prevSettings.current) {
    prevSettings.current = settings;
    if (!form) setForm({ ...settings });
  }

  const saveMut = useMutation({
    mutationFn: (s: EvalSettings) =>
      apiFetch("/api/settings/evaluation", { method: "PUT", body: JSON.stringify(s) }),
    onSuccess: () => toast({ title: "تم حفظ الإعدادات" }),
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  if (isLoading || !form) {
    return (
      <div className="space-y-4">
        {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  const updateField = <K extends keyof EvalSettings>(key: K, val: EvalSettings[K]) =>
    setForm((f) => f ? { ...f, [key]: val } : f);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>الأوزان الافتراضية</CardTitle>
          <CardDescription>تحديد الأوزان الافتراضية عند إنشاء تقييم جديد</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>مؤشرات الأداء (KPIs)</Label>
              <span className="text-sm font-mono font-semibold">{form.defaultKpiWeight}%</span>
            </div>
            <Slider
              value={[form.defaultKpiWeight]}
              min={0} max={100} step={5}
              onValueChange={([v]) => {
                updateField("defaultKpiWeight", v);
                updateField("defaultCompetencyWeight", 100 - v);
              }}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>الجدارات</Label>
              <span className="text-sm font-mono font-semibold">{form.defaultCompetencyWeight}%</span>
            </div>
            <Slider
              value={[form.defaultCompetencyWeight]}
              min={0} max={100} step={5}
              onValueChange={([v]) => {
                updateField("defaultCompetencyWeight", v);
                updateField("defaultKpiWeight", 100 - v);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>مقياس التقييم</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>عدد الدرجات</Label>
            <Select
              value={String(form.ratingScale)}
              onValueChange={(v) => {
                const n = Number(v);
                updateField("ratingScale", n);
                const labels = [...form.ratingLabels];
                while (labels.length < n) labels.push("");
                updateField("ratingLabels", labels.slice(0, n));
              }}
            >
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "درجة" : "درجات"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">تسميات الدرجات</Label>
            <div className="space-y-2">
              {form.ratingLabels.map((label, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Badge variant="outline" className="w-8 justify-center">{i + 1}</Badge>
                  <Input
                    value={label}
                    onChange={(e) => {
                      const labels = [...form.ratingLabels];
                      labels[i] = e.target.value;
                      updateField("ratingLabels", labels);
                    }}
                    placeholder={`تسمية الدرجة ${i + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>سير العمل</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>يتطلب اعتماد المدير الأعلى</Label>
            <Switch checked={form.requireApproval} onCheckedChange={(v) => updateField("requireApproval", v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label>يتطلب إقرار الموظف</Label>
            <Switch checked={form.requireAcknowledgment} onCheckedChange={(v) => updateField("requireAcknowledgment", v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label>السماح بالاعتراض</Label>
            <Switch checked={form.allowObjection} onCheckedChange={(v) => updateField("allowObjection", v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الفترات المتاحة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {form.evaluationPeriods.map((p, i) => (
              <Badge key={i} variant="secondary" className="text-sm py-1 px-3 gap-1">
                {p}
                <button
                  className="mr-1 hover:text-destructive"
                  onClick={() => updateField("evaluationPeriods", form.evaluationPeriods.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="أضف فترة جديدة"
              value={newPeriod}
              onChange={(e) => setNewPeriod(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newPeriod.trim()) {
                  updateField("evaluationPeriods", [...form.evaluationPeriods, newPeriod.trim()]);
                  setNewPeriod("");
                }
              }}
            />
            <Button
              variant="outline"
              onClick={() => {
                if (newPeriod.trim()) {
                  updateField("evaluationPeriods", [...form.evaluationPeriods, newPeriod.trim()]);
                  setNewPeriod("");
                }
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}>
          {saveMut.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </Button>
      </div>
    </div>
  );
}

// ============== FIELD SETTINGS TAB ==============

interface FieldOption {
  value: string;
  label: string;
  active: boolean;
}

interface FieldOptionsData {
  competencyTypes: FieldOption[];
  competencyLevels: FieldOption[];
}

function FieldSettingsTab() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"types" | "levels">("types");
  const [data, setData] = useState<FieldOptionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editItem, setEditItem] = useState<{ list: "types" | "levels"; index: number } | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addLabel, setAddLabel] = useState("");
  const [toDelete, setToDelete] = useState<{ list: "types" | "levels"; index: number; label: string } | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/settings/field-options", { credentials: "include" });
      const json = await res.json();
      setData(json);
    } catch {
      toast({ title: "خطأ في تحميل إعدادات الحقول", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const saveData = async (newData: FieldOptionsData) => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/field-options", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newData),
      });
      if (!res.ok) throw new Error();
      setData(newData);
      toast({ title: "تم الحفظ بنجاح" });
    } catch {
      toast({ title: "خطأ في الحفظ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getList = (tab: "types" | "levels") =>
    tab === "types" ? (data?.competencyTypes ?? []) : (data?.competencyLevels ?? []);

  const updateList = (tab: "types" | "levels", newList: FieldOption[]) => {
    if (!data) return;
    const newData = tab === "types"
      ? { ...data, competencyTypes: newList }
      : { ...data, competencyLevels: newList };
    saveData(newData);
  };

  const handleToggle = (tab: "types" | "levels", idx: number) => {
    const list = [...getList(tab)];
    list[idx] = { ...list[idx], active: !list[idx].active };
    updateList(tab, list);
  };

  const handleDelete = (tab: "types" | "levels", idx: number) => {
    const list = [...getList(tab)];
    list.splice(idx, 1);
    updateList(tab, list);
    setToDelete(null);
  };

  const handleEditSave = () => {
    if (!editItem || !editLabel.trim()) return;
    const list = [...getList(editItem.list)];
    list[editItem.index] = { ...list[editItem.index], label: editLabel.trim() };
    updateList(editItem.list, list);
    setEditItem(null);
  };

  const handleAdd = () => {
    if (!addLabel.trim()) return;
    const list = [...getList(activeTab)];
    const value = addLabel.trim().toUpperCase().replace(/\s+/g, "_");
    list.push({ value, label: addLabel.trim(), active: true });
    updateList(activeTab, list);
    setAddOpen(false);
    setAddLabel("");
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const currentList = getList(activeTab);

  const TABS = [
    { id: "types" as const, label: "نوع الجدارة", icon: "📋" },
    { id: "levels" as const, label: "مستوى الجدارة", icon: "📊" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <SlidersHorizontal className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-lg font-bold text-primary">إعدادات الحقول والقوائم</h2>
          <p className="text-sm text-muted-foreground">أضف وعدّل خيارات القوائم المنسدلة التي تظهر في نماذج الجدارات.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Add button */}
      <div className="flex justify-start">
        <Button onClick={() => { setAddOpen(true); setAddLabel(""); }} className="gap-2">
          <Plus className="w-4 h-4" />
          إضافة خيار
        </Button>
      </div>

      {/* Options list */}
      <div className="space-y-2">
        {currentList.length === 0 && (
          <div className="text-center text-muted-foreground py-8">لا توجد خيارات بعد</div>
        )}
        {currentList.map((item, idx) => (
          <div
            key={item.value}
            className={`flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors ${
              !item.active ? "bg-muted/50 opacity-60" : "bg-card"
            }`}
          >
            <div className="flex items-center gap-4 flex-1 justify-end">
              <span className="text-sm text-muted-foreground w-6 text-center">{idx + 1}</span>
              <div className="flex-1 text-right">
                <div className="font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.value}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                item.active
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}>
                {item.active ? "مفعّل" : "معطّل"}
              </span>

              <Switch
                checked={item.active}
                onCheckedChange={() => handleToggle(activeTab, idx)}
                disabled={saving}
              />

              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => { setEditItem({ list: activeTab, index: idx }); setEditLabel(item.label); }}
              >
                <Pencil className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                onClick={() => setToDelete({ list: activeTab, index: idx, label: item.label })}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تعديل الخيار</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium mb-1 text-right">الاسم</label>
              <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="text-right" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>إلغاء</Button>
            <Button onClick={handleEditSave} disabled={!editLabel.trim() || saving}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>إضافة خيار جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium mb-1 text-right">الاسم</label>
              <Input value={addLabel} onChange={(e) => setAddLabel(e.target.value)} className="text-right" placeholder="أدخل اسم الخيار" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button onClick={handleAdd} disabled={!addLabel.trim() || saving}>إضافة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alert */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الخيار</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف «{toDelete?.label}»؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && handleDelete(toDelete.list, toDelete.index)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============== PERMISSIONS TAB ==============

const ALL_ROLES = ["ADMIN", "HR_MANAGER", "FIRST_LEVEL_MANAGER", "SECOND_LEVEL_MANAGER", "EMPLOYEE"] as const;

const RESOURCES: { key: string; label: string; icon: React.ElementType }[] = [
  { key: "dashboard", label: "لوحة القيادة", icon: LayoutDashboard },
  { key: "jobs", label: "الوظائف", icon: Briefcase },
  { key: "competencies", label: "الجدارات", icon: Award },
  { key: "grades", label: "الدرجات الوظيفية", icon: GraduationCap },
  { key: "career-paths", label: "المسارات المهنية", icon: Map },
  { key: "employees", label: "الموظفين", icon: Users },
  { key: "kpis", label: "مؤشرات الأداء", icon: Target },
  { key: "evaluations", label: "التقييمات", icon: ClipboardCheck },
  { key: "reports", label: "التقارير", icon: FileBarChart },
  { key: "bell-curve", label: "التوزيع الطبيعي", icon: PieChart },
  { key: "org-chart", label: "الهيكل التنظيمي", icon: Network },
  { key: "admin", label: "لوحة الإدارة", icon: Settings },
];

const ACTIONS: { key: string; label: string; desc: string }[] = [
  { key: "view", label: "عرض", desc: "View resource data" },
  { key: "create", label: "إنشاء", desc: "Create new records" },
  { key: "edit", label: "تعديل", desc: "Edit existing records" },
  { key: "delete", label: "حذف", desc: "Delete records permanently" },
];

type PermMatrix = Record<string, Record<string, string[]>>;

function PermissionsTab() {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string>("ADMIN");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [permView, setPermView] = useState<"matrix" | "roles">("matrix");

  const { data: matrix, isLoading } = useQuery<PermMatrix>({
    queryKey: ["admin", "permissions"],
    queryFn: () => apiFetch("/api/settings/permissions"),
  });

  const [draft, setDraft] = useState<PermMatrix | null>(null);
  const prevMatrixRef = useRef<string>("");

  const matrixStr = matrix ? JSON.stringify(matrix) : "";
  if (matrixStr && matrixStr !== prevMatrixRef.current) {
    prevMatrixRef.current = matrixStr;
    setDraft(structuredClone(matrix!));
  }

  const qc = useQueryClient();

  const saveMut = useMutation({
    mutationFn: (m: PermMatrix) =>
      apiFetch("/api/settings/permissions", { method: "PUT", body: JSON.stringify(m) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "permissions"] });
      qc.invalidateQueries({ queryKey: ["permissions"] });
    },
    onError: (e: any) => toast({ title: "خطأ في حفظ الصلاحيات", description: e.message, variant: "destructive" }),
  });

  // Auto-save helper
  const autoSave = (next: PermMatrix) => {
    setDraft(next);
    saveMut.mutate(next);
  };

  if (isLoading || !draft) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  const rolePerms = draft[selectedRole] ?? {};

  const hasAction = (resource: string, action: string) => {
    const acts = rolePerms[resource];
    return acts ? acts.includes(action) : false;
  };

  const toggleAction = (resource: string, action: string) => {
    if (!draft) return;
    const next = structuredClone(draft);
    if (!next[selectedRole]) next[selectedRole] = {};
    const rp = next[selectedRole];
    if (!rp[resource]) rp[resource] = [];
    const idx = rp[resource].indexOf(action);
    if (idx >= 0) {
      rp[resource].splice(idx, 1);
    } else {
      rp[resource].push(action);
    }
    autoSave(next);
  };

  const toggleAllResource = (resource: string) => {
    if (!draft) return;
    const activeCount = ACTIONS.filter((a) => hasAction(resource, a.key)).length;
    const allChecked = activeCount === ACTIONS.length;
    const next = structuredClone(draft);
    if (!next[selectedRole]) next[selectedRole] = {};
    next[selectedRole][resource] = allChecked ? [] : ACTIONS.map((a) => a.key);
    autoSave(next);
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => setExpandedSections(new Set(RESOURCES.map((r) => r.key)));
  const collapseAll = () => setExpandedSections(new Set());

  const resetToDefault = () => {
    if (matrix) {
      setDraft(structuredClone(matrix));
      toast({ title: "تم الإرجاع للافتراضي" });
    }
  };

  // Total counts
  const totalActions = RESOURCES.length * ACTIONS.length;
  const activeActions = RESOURCES.reduce(
    (sum, res) => sum + ACTIONS.filter((a) => hasAction(res.key, a.key)).length,
    0
  );
  const pct = totalActions > 0 ? Math.round((activeActions / totalActions) * 100) : 0;

  // Filter resources by search
  const filteredResources = RESOURCES.filter((r) =>
    !searchQuery || r.label.includes(searchQuery)
  );

  return (
    <div className="space-y-5">
      {/* Top tabs */}
      <div className="flex gap-2 justify-start">
        <Button
          variant={permView === "matrix" ? "default" : "outline"}
          size="sm"
          onClick={() => setPermView("matrix")}
          className="rounded-full gap-2"
        >
          <Shield className="w-4 h-4" />
          مصفوفة الصلاحيات
        </Button>
        <Button
          variant={permView === "roles" ? "default" : "outline"}
          size="sm"
          onClick={() => setPermView("roles")}
          className="rounded-full gap-2"
        >
          <Users className="w-4 h-4" />
          إدارة الأدوار
        </Button>
      </div>

      {permView === "roles" ? (
        <RolesView />
      ) : (
      <div className="flex gap-5">
      {/* Role sidebar — right side (RTL) */}
      <div className="flex flex-col gap-1.5 w-36 shrink-0">
        {ALL_ROLES.map((role) => (
          <button
            key={role}
            onClick={() => setSelectedRole(role)}
            className={`text-sm py-2 px-3 rounded-lg border text-center transition-colors ${
              selectedRole === role
                ? "bg-primary text-primary-foreground border-primary font-semibold"
                : "bg-card text-foreground border-border hover:bg-accent"
            }`}
          >
            {ROLE_LABELS[role] ?? role}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Shield className="w-4 h-4 text-primary" />
        <span>
          مصفوفة الصلاحيات — <strong className="text-foreground">{ROLE_LABELS[selectedRole]}</strong>
        </span>
        <span className="mr-auto">{activeActions} من إجمالي {totalActions} صلاحية مفعلة ({pct}%)</span>
      </div>

      {/* Search + expand/collapse */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ابحث في الصلاحيات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={collapseAll}>طي الكل</Button>
        <Button variant="outline" size="sm" onClick={expandAll}>فرد الكل</Button>
      </div>

      {/* Accordion sections */}
      <div className="space-y-2">
        {filteredResources.map((res) => {
          const isOpen = expandedSections.has(res.key);
          const activeCount = ACTIONS.filter((a) => hasAction(res.key, a.key)).length;
          const ResIcon = res.icon;

          return (
            <div key={res.key} className="border rounded-lg overflow-hidden bg-card">
              {/* Section header */}
              <button
                onClick={() => toggleSection(res.key)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
              >
                <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                  activeCount === ACTIONS.length ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  <ResIcon className="w-4 h-4" />
                </div>
                <span className="font-semibold text-sm">{res.label}</span>
                <span className="text-sm text-muted-foreground font-mono">
                  {activeCount}/{ACTIONS.length}
                </span>
                <span className="mr-auto" />
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </button>

              {/* Section body */}
              {isOpen && (
                <div className="border-t px-4 py-3 space-y-3">
                  {/* Enable all */}
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => toggleAllResource(res.key)}
                    >
                      {activeCount === ACTIONS.length ? "تعطيل الكل" : "تفعيل الكل"}
                    </Button>
                  </div>

                  {/* Individual permissions */}
                  {ACTIONS.map((act) => (
                    <div
                      key={act.key}
                      className="flex items-center gap-3 py-1"
                    >
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                      <span className="text-sm font-medium">{act.label}</span>
                      <span className="text-sm text-muted-foreground">— {act.desc}</span>
                      <span className="mr-auto" />
                      <Switch
                        checked={hasAction(res.key, act.key)}
                        onCheckedChange={() => toggleAction(res.key, act.key)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      </div>
      </div>
      )}
    </div>
  );
}

// ============== ROLES VIEW ==============

function RolesView() {
  const { toast } = useToast();
  const [editRole, setEditRole] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const handleCopy = (role: string) => {
    const label = ROLE_LABELS[role] ?? role;
    toast({ title: "تم النسخ", description: `تم نسخ الدور: ${label} (${role})` });
    navigator.clipboard.writeText(role);
  };

  const handleDelete = () => {
    if (!roleToDelete) return;
    const label = ROLE_LABELS[roleToDelete] ?? roleToDelete;
    toast({ title: `تم حذف الدور: ${label}` });
    setRoleToDelete(null);
    setDeleteConfirmText("");
  };

  const deleteLabel = ROLE_LABELS[roleToDelete ?? ""] ?? roleToDelete ?? "";
  const canConfirmDelete = deleteConfirmText === deleteLabel;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        الأدوار المتاحة في النظام وعدد المستخدمين لكل دور.
      </p>
      <div className="space-y-2">
        {ALL_ROLES.map((role) => (
          <div key={role} className="flex items-center gap-3 border rounded-lg px-4 py-3 bg-card group">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{ROLE_LABELS[role] ?? role}</div>
              <div className="text-xs text-muted-foreground">{role}</div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-8 w-8" title="تعديل"
                onClick={() => { setEditRole(role); setEditLabel(ROLE_LABELS[role] ?? role); }}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="نسخ"
                onClick={() => handleCopy(role)}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
              {role !== "ADMIN" && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="حذف"
                  onClick={() => { setRoleToDelete(role); setDeleteConfirmText(""); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editRole} onOpenChange={(o) => !o && setEditRole(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-right">تعديل الدور</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>معرّف الدور</Label>
              <Input value={editRole ?? ""} disabled className="font-mono text-sm" />
            </div>
            <div>
              <Label>اسم العرض</Label>
              <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRole(null)}>إلغاء</Button>
            <Button onClick={() => { setEditRole(null); toast({ title: "تم الحفظ" }); }}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!roleToDelete} onOpenChange={(o) => { if (!o) { setRoleToDelete(null); setDeleteConfirmText(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الدور</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span>هل أنت متأكد من حذف دور <strong>«{deleteLabel}»</strong>؟ لا يمكن التراجع عن هذا الإجراء.</span>
              <span className="block text-sm">اكتب <strong className="text-destructive">«{deleteLabel}»</strong> للتأكيد:</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={deleteLabel}
            className="text-center"
          />
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canConfirmDelete}
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============== NOTIFICATIONS TAB ==============

type NotifConfig = {
  emailEnabled: boolean;
  emailProvider: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
  smtpTLS: boolean;
  whatsappEnabled: boolean;
  twilioSid: string;
  twilioToken: string;
  twilioFrom: string;
  autoNewEval: boolean;
  autoApproved: boolean;
  autoReminder: boolean;
  reminderDays: number;
  baseUrl: string;
};

type NotifLog = {
  id: string;
  recipientId: string;
  recipient: string;
  channel: string;
  type: string;
  subject: string;
  status: string;
  errorMessage?: string;
  evalId?: string;
  createdAt: string;
};

const defaultNotifConfig: NotifConfig = {
  emailEnabled: false, emailProvider: "smtp",
  smtpHost: "", smtpPort: 587, smtpUser: "", smtpPassword: "", smtpFrom: "", smtpTLS: true,
  whatsappEnabled: false, twilioSid: "", twilioToken: "", twilioFrom: "",
  autoNewEval: true, autoApproved: true, autoReminder: false, reminderDays: 3,
  baseUrl: "",
};

const NOTIF_TYPE_LABELS: Record<string, string> = {
  NEW_EVALUATION: "تقييم جديد",
  DEADLINE_REMINDER: "تذكير بالموعد",
  APPROVED: "اعتماد التقييم",
  RESULT_SUMMARY: "ملخص النتيجة",
};
const CHANNEL_LABELS: Record<string, string> = { EMAIL: "بريد إلكتروني", WHATSAPP: "واتساب" };
const STATUS_LABELS: Record<string, string> = { PENDING: "قيد الإرسال", SENT: "تم الإرسال", FAILED: "فشل" };

function NotificationsTab() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"email" | "whatsapp" | "auto" | "logs">("email");
  const [cfg, setCfg] = useState<NotifConfig>(defaultNotifConfig);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [logs, setLogs] = useState<NotifLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);

  useQuery({
    queryKey: ["notification-config"],
    queryFn: async () => {
      const res = await fetch("/api/admin/notification/config", { headers: getHeaders() });
      if (!res.ok) return defaultNotifConfig;
      const data = await res.json();
      setCfg({ ...defaultNotifConfig, ...data });
      return data;
    },
  });

  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/notification/config", {
        method: "PUT",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error();
      toast({ title: "تم حفظ إعدادات الإشعارات" });
    } catch {
      toast({ title: "فشل حفظ الإعدادات", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async (channel: string) => {
    if (!testTo) { toast({ title: "أدخل عنوان المستلم", variant: "destructive" }); return; }
    setTesting(true);
    try {
      const res = await fetch("/api/admin/notification/test", {
        method: "POST",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ channel, to: testTo }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "فشل");
      }
      toast({ title: "تم إرسال الإشعار التجريبي بنجاح" });
    } catch (e: any) {
      toast({ title: e.message || "فشل الإرسال", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch("/api/notifications/logs?limit=50", { headers: getHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLogs(data.logs || []);
      setLogsTotal(data.total || 0);
    } catch {
      toast({ title: "فشل تحميل السجل", variant: "destructive" });
    } finally {
      setLogsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (tab === "logs") loadLogs();
  }, [tab, loadLogs]);

  const tabBtns = [
    { id: "email" as const, label: "البريد الإلكتروني", icon: Mail },
    { id: "whatsapp" as const, label: "الواتساب", icon: ExternalLink },
    { id: "auto" as const, label: "الإشعارات التلقائية", icon: Bell },
    { id: "logs" as const, label: "السجل", icon: FileBarChart },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-2 flex-wrap">
        {tabBtns.map((t) => (
          <Button key={t.id} variant={tab === t.id ? "default" : "ghost"} size="sm" onClick={() => setTab(t.id)}>
            <t.icon className="w-4 h-4 ml-1" />
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "email" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>تفعيل البريد الإلكتروني</Label>
            <Switch checked={cfg.emailEnabled} onCheckedChange={(v) => setCfg({ ...cfg, emailEnabled: v })} />
          </div>
          {cfg.emailEnabled && (
            <>
              <div className="space-y-2">
                <Label>المزود</Label>
                <Select value={cfg.emailProvider} onValueChange={(v) => setCfg({ ...cfg, emailProvider: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smtp">SMTP</SelectItem>
                    <SelectItem value="graph">Microsoft Graph (Office 365)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {cfg.emailProvider === "smtp" && (
                <div className="space-y-3 border rounded-lg p-4">
                  <h4 className="font-medium text-sm">إعدادات SMTP</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Host</Label>
                      <Input dir="ltr" value={cfg.smtpHost} onChange={(e) => setCfg({ ...cfg, smtpHost: e.target.value })} placeholder="smtp.example.com" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Port</Label>
                      <Input dir="ltr" type="number" value={cfg.smtpPort} onChange={(e) => setCfg({ ...cfg, smtpPort: parseInt(e.target.value) || 587 })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">اسم المستخدم</Label>
                      <Input dir="ltr" value={cfg.smtpUser} onChange={(e) => setCfg({ ...cfg, smtpUser: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">كلمة المرور</Label>
                      <Input dir="ltr" type="password" value={cfg.smtpPassword} onChange={(e) => setCfg({ ...cfg, smtpPassword: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">البريد المرسل (From)</Label>
                    <Input dir="ltr" value={cfg.smtpFrom} onChange={(e) => setCfg({ ...cfg, smtpFrom: e.target.value })} placeholder="noreply@example.com" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={cfg.smtpTLS} onCheckedChange={(v) => setCfg({ ...cfg, smtpTLS: v })} />
                    <Label className="text-xs">استخدام TLS</Label>
                  </div>
                </div>
              )}
              {cfg.emailProvider === "graph" && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    <Info className="w-4 h-4 inline ml-1" />
                    سيتم استخدام إعدادات Office 365 المحفوظة. تأكد من إضافة صلاحية <strong>Mail.Send</strong> في تطبيق Azure AD.
                  </p>
                </div>
              )}
              <div className="flex gap-2 items-end border-t pt-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">بريد تجريبي</Label>
                  <Input dir="ltr" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="test@example.com" />
                </div>
                <Button size="sm" variant="outline" onClick={() => sendTest("EMAIL")} disabled={testing}>
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : "إرسال تجريبي"}
                </Button>
              </div>
            </>
          )}
          <Button onClick={saveConfig} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <CheckCircle className="w-4 h-4 ml-1" />}
            حفظ الإعدادات
          </Button>
        </div>
      )}

      {tab === "whatsapp" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>تفعيل الواتساب</Label>
            <Switch checked={cfg.whatsappEnabled} onCheckedChange={(v) => setCfg({ ...cfg, whatsappEnabled: v })} />
          </div>
          {cfg.whatsappEnabled && (
            <>
              <div className="space-y-3 border rounded-lg p-4">
                <h4 className="font-medium text-sm">إعدادات Twilio WhatsApp</h4>
                <div className="space-y-1">
                  <Label className="text-xs">Account SID</Label>
                  <Input dir="ltr" value={cfg.twilioSid} onChange={(e) => setCfg({ ...cfg, twilioSid: e.target.value })} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Auth Token</Label>
                  <Input dir="ltr" type="password" value={cfg.twilioToken} onChange={(e) => setCfg({ ...cfg, twilioToken: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">رقم الإرسال (From)</Label>
                  <Input dir="ltr" value={cfg.twilioFrom} onChange={(e) => setCfg({ ...cfg, twilioFrom: e.target.value })} placeholder="whatsapp:+14155238886" />
                </div>
              </div>
              <div className="flex gap-2 items-end border-t pt-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">رقم تجريبي</Label>
                  <Input dir="ltr" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="+966500000000" />
                </div>
                <Button size="sm" variant="outline" onClick={() => sendTest("WHATSAPP")} disabled={testing}>
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : "إرسال تجريبي"}
                </Button>
              </div>
            </>
          )}
          <Button onClick={saveConfig} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <CheckCircle className="w-4 h-4 ml-1" />}
            حفظ الإعدادات
          </Button>
        </div>
      )}

      {tab === "auto" && (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">رابط المنصة (Base URL)</Label>
            <Input dir="ltr" value={cfg.baseUrl} onChange={(e) => setCfg({ ...cfg, baseUrl: e.target.value })} placeholder="https://your-domain.com" />
          </div>
          <div className="space-y-3 border rounded-lg p-4">
            <h4 className="font-medium text-sm">الإشعارات التلقائية</h4>
            <div className="flex items-center justify-between">
              <Label className="text-sm">إشعار عند إنشاء تقييم جديد</Label>
              <Switch checked={cfg.autoNewEval} onCheckedChange={(v) => setCfg({ ...cfg, autoNewEval: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">إشعار عند اعتماد التقييم</Label>
              <Switch checked={cfg.autoApproved} onCheckedChange={(v) => setCfg({ ...cfg, autoApproved: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">تذكير قبل انتهاء فترة التقييم</Label>
              <Switch checked={cfg.autoReminder} onCheckedChange={(v) => setCfg({ ...cfg, autoReminder: v })} />
            </div>
            {cfg.autoReminder && (
              <div className="flex items-center gap-3 pr-6">
                <Label className="text-xs whitespace-nowrap">قبل بـ (أيام)</Label>
                <Input type="number" className="w-20" value={cfg.reminderDays} onChange={(e) => setCfg({ ...cfg, reminderDays: parseInt(e.target.value) || 3 })} />
              </div>
            )}
          </div>
          <Button onClick={saveConfig} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <CheckCircle className="w-4 h-4 ml-1" />}
            حفظ الإعدادات
          </Button>
        </div>
      )}

      {tab === "logs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="secondary">{logsTotal} إشعار</Badge>
            <Button size="sm" variant="outline" onClick={loadLogs} disabled={logsLoading}>
              {logsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 ml-1" />}
              تحديث
            </Button>
          </div>
          <div className="max-h-[400px] overflow-auto border rounded-md">
            <Table className="min-w-[600px]">
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="whitespace-nowrap">التاريخ</TableHead>
                  <TableHead className="whitespace-nowrap">المستلم</TableHead>
                  <TableHead className="whitespace-nowrap">القناة</TableHead>
                  <TableHead className="whitespace-nowrap">النوع</TableHead>
                  <TableHead className="whitespace-nowrap">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد إشعارات بعد</TableCell></TableRow>
                )}
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(log.createdAt).toLocaleString("ar-SA")}</TableCell>
                    <TableCell className="text-sm" dir="ltr">{log.recipient}</TableCell>
                    <TableCell><Badge variant="outline">{CHANNEL_LABELS[log.channel] || log.channel}</Badge></TableCell>
                    <TableCell className="text-sm">{NOTIF_TYPE_LABELS[log.type] || log.type}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === "SENT" ? "default" : log.status === "FAILED" ? "destructive" : "secondary"}>
                        {STATUS_LABELS[log.status] || log.status}
                      </Badge>
                      {log.errorMessage && <p className="text-xs text-destructive mt-1">{log.errorMessage}</p>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== TEMPLATES TAB ==============

type EvalTemplateItem = { label: string; helpText?: string | null; sortOrder: number };
type EvalTemplateGroup = { id?: string; name: string; weight: number; sortOrder: number; items: EvalTemplateItem[] };
type EvalTemplate = { id: string; name: string; description: string; isDefault: boolean; evalType: string; groups: EvalTemplateGroup[]; createdAt: string };
type TemplateSummary = { id: string; name: string; description: string; isDefault: boolean; evalType: string; groupCount: number; itemCount: number; createdAt: string };

function TemplatesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [editing, setEditing] = useState<EvalTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: templates = [], isLoading } = useQuery<TemplateSummary[]>({
    queryKey: ["admin-templates"],
    queryFn: () => apiFetch<TemplateSummary[]>("/api/admin/templates"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-templates"] }); toast({ title: "تم الحذف" }); },
  });

  const dupMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/templates/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-templates"] }); toast({ title: "تم النسخ" }); },
  });

  const loadTemplate = async (id: string) => {
    const t = await apiFetch<EvalTemplate>(`/api/admin/templates/${id}`);
    setEditing(t);
  };

  if (creating || editing) {
    return (
      <TemplateEditor
        initial={editing}
        onSaved={() => { setEditing(null); setCreating(false); qc.invalidateQueries({ queryKey: ["admin-templates"] }); }}
        onCancel={() => { setEditing(null); setCreating(false); }}
      />
    );
  }

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{templates.length} نموذج</p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4 ml-1" />
          إنشاء نموذج جديد
        </Button>
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>لا توجد نماذج بعد</p>
          <p className="text-xs mt-1">أنشئ نموذج تقييم لتحديد الأسئلة والمجموعات</p>
        </div>
      )}

      <div className="space-y-2">
        {templates.map((tpl) => (
          <Card key={tpl.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm">{tpl.name}</h4>
                  {tpl.isDefault && <Badge variant="secondary" className="text-xs">افتراضي</Badge>}
                  <Badge variant="outline" className="text-xs">{tpl.evalType === "MANAGER" ? t("evaluations.evalTypeManager") : t("evaluations.evalTypeEmployee")}</Badge>
                </div>
                {tpl.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{tpl.description}</p>}
                <p className="text-xs text-muted-foreground mt-1">{tpl.groupCount} مجموعة · {tpl.itemCount} سؤال</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => loadTemplate(tpl.id)} title="تعديل">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => dupMut.mutate(tpl.id)} title="نسخ">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMut.mutate(tpl.id)} title="حذف">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============== TEMPLATE EDITOR ==============

function TemplateEditor({ initial, onSaved, onCancel }: { initial: EvalTemplate | null; onSaved: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [evalType, setEvalType] = useState<string>(initial?.evalType ?? "EMPLOYEE");
  const [groups, setGroups] = useState<EvalTemplateGroup[]>(
    initial?.groups?.length ? initial.groups : [{ name: "", weight: 0, sortOrder: 0, items: [{ label: "", sortOrder: 0 }] }],
  );
  const [saving, setSaving] = useState(false);

  const updateGroup = (idx: number, patch: Partial<EvalTemplateGroup>) => {
    setGroups((gs) => gs.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  };

  const addGroup = () => {
    setGroups((gs) => [...gs, { name: "", weight: 0, sortOrder: gs.length, items: [{ label: "", sortOrder: 0 }] }]);
  };

  const removeGroup = (idx: number) => {
    setGroups((gs) => gs.filter((_, i) => i !== idx));
  };

  const moveGroup = (idx: number, dir: -1 | 1) => {
    setGroups((gs) => {
      const arr = [...gs];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr.map((g, i) => ({ ...g, sortOrder: i }));
    });
  };

  const updateItem = (gIdx: number, iIdx: number, patch: Partial<EvalTemplateItem>) => {
    setGroups((gs) =>
      gs.map((g, gi) =>
        gi === gIdx ? { ...g, items: g.items.map((it, ii) => (ii === iIdx ? { ...it, ...patch } : it)) } : g,
      ),
    );
  };

  const addItem = (gIdx: number) => {
    setGroups((gs) =>
      gs.map((g, gi) =>
        gi === gIdx ? { ...g, items: [...g.items, { label: "", sortOrder: g.items.length }] } : g,
      ),
    );
  };

  const removeItem = (gIdx: number, iIdx: number) => {
    setGroups((gs) =>
      gs.map((g, gi) =>
        gi === gIdx ? { ...g, items: g.items.filter((_, ii) => ii !== iIdx) } : g,
      ),
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "يرجى إدخال اسم النموذج", variant: "destructive" });
      return;
    }
    const emptyGroup = groups.find((g) => !g.name.trim());
    if (emptyGroup) {
      toast({ title: "يرجى تسمية جميع المجموعات", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        isDefault,
        evalType,
        groups: groups.map((g, gi) => ({
          name: g.name.trim(),
          weight: g.weight,
          sortOrder: gi,
          items: g.items.filter((it) => it.label.trim()).map((it, ii) => ({
            label: it.label.trim(),
            helpText: it.helpText || null,
            sortOrder: ii,
          })),
        })),
      };

      if (initial?.id) {
        await apiFetch(`/api/admin/templates/${initial.id}`, { method: "PUT", body: JSON.stringify(payload) });
        toast({ title: "تم تحديث النموذج" });
      } else {
        await apiFetch("/api/admin/templates", { method: "POST", body: JSON.stringify(payload) });
        toast({ title: "تم إنشاء النموذج" });
      }
      onSaved();
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ChevronLeft className="w-4 h-4 ml-1" />
          رجوع
        </Button>
        <h3 className="text-lg font-semibold">{initial ? "تعديل النموذج" : "نموذج جديد"}</h3>
      </div>

      {/* Basic info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1 block">اسم النموذج *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: نموذج الموظفين العاديين" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">الوصف</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف اختياري" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={isDefault} onCheckedChange={setIsDefault} id="tpl-default" />
        <Label htmlFor="tpl-default" className="text-sm">نموذج افتراضي</Label>
      </div>

      {/* Evaluation type */}
      <div>
        <Label className="text-xs mb-1.5 block">{t("evaluations.selectEvalType")}</Label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setEvalType("EMPLOYEE")}
            className={`flex-1 rounded-lg border-2 p-2.5 text-sm font-medium transition-colors ${
              evalType === "EMPLOYEE" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
            }`}
          >
            {t("evaluations.evalTypeEmployee")}
          </button>
          <button
            type="button"
            onClick={() => setEvalType("MANAGER")}
            className={`flex-1 rounded-lg border-2 p-2.5 text-sm font-medium transition-colors ${
              evalType === "MANAGER" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
            }`}
          >
            {t("evaluations.evalTypeManager")}
          </button>
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm">المجموعات</h4>
          <Button variant="outline" size="sm" onClick={addGroup}>
            <Plus className="w-3.5 h-3.5 ml-1" />
            إضافة مجموعة
          </Button>
        </div>

        {groups.map((group, gIdx) => (
          <Card key={gIdx} className="border">
            <CardContent className="py-3 px-4 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  className="flex-1 font-semibold text-sm"
                  value={group.name}
                  onChange={(e) => updateGroup(gIdx, { name: e.target.value })}
                  placeholder="اسم المجموعة (مثال: جدارات سلوكية)"
                />
                <div className="flex gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveGroup(gIdx, -1)} disabled={gIdx === 0}>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveGroup(gIdx, 1)} disabled={gIdx === groups.length - 1}>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeGroup(gIdx)} disabled={groups.length <= 1}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-1.5 mr-4">
                {group.items.map((item, iIdx) => (
                  <div key={iIdx} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5 shrink-0">{iIdx + 1}.</span>
                    <Input
                      className="flex-1 text-sm h-8"
                      value={item.label}
                      onChange={(e) => updateItem(gIdx, iIdx, { label: e.target.value })}
                      placeholder="نص السؤال / المعيار"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive shrink-0"
                      onClick={() => removeItem(gIdx, iIdx)}
                      disabled={group.items.length <= 1}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => addItem(gIdx)}>
                  <Plus className="w-3 h-3 ml-1" />
                  إضافة سؤال
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Save */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>إلغاء</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
          حفظ
        </Button>
      </div>
    </div>
  );
}
