import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useIdentity, ROLE_LABELS } from "@/lib/identity";
import { parseSpreadsheet, pick, mapRole, downloadImportTemplate } from "@/lib/xlsx";
import {
  Upload, Download, Users, Settings, FileSpreadsheet,
  Plus, Pencil, Trash2, CheckCircle, XCircle, AlertCircle, Shield,
} from "lucide-react";

// --- API helpers (admin endpoints not in generated client) ---

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
  requireApproval: boolean; requireAcknowledgment: boolean;
};

type ImportRow = {
  employeeNumber: string; name: string; email: string;
  role: string; managerNumber: string;
};

// ============== MAIN COMPONENT ==============

export default function AdminPage() {
  const { user } = useIdentity();

  if (!user || !["ADMIN", "HR_MANAGER"].includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">غير مصرح</h2>
            <p className="text-muted-foreground">هذه الصفحة متاحة فقط لمديري النظام ومديري الموارد البشرية.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">لوحة الإدارة</h1>
        <p className="text-muted-foreground mt-1">إدارة الموظفين والصلاحيات وإعدادات التقييم</p>
      </div>

      <Tabs defaultValue="import" dir="rtl">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="import" className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            رفع البيانات
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            إدارة المستخدمين
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            إعدادات التقييم
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import"><ImportTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============== IMPORT TAB ==============

function ImportTab() {
  const { toast } = useToast();
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
        toast({ title: "لا توجد بيانات صالحة", description: "تأكد من وجود أعمدة الرقم الوظيفي والاسم", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "خطأ في قراءة الملف", description: e.message, variant: "destructive" });
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
      toast({ title: "تم الرفع بنجاح", description: `${res.imported} موظف، ${res.usersCreated} حساب مستخدم` });
    } catch (e: any) {
      toast({ title: "خطأ في الرفع", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            رفع ملف Excel
          </CardTitle>
          <CardDescription>
            ارفع ملف Excel أو CSV يحتوي على بيانات الموظفين مع تحديد أدوارهم
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drag & Drop Zone */}
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
            <p className="font-medium">اسحب الملف هنا أو اضغط لاختيار</p>
            <p className="text-sm text-muted-foreground mt-1">يدعم: .xlsx, .xls, .csv</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={onFileChange}
            />
          </div>

          {/* Required Columns Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              الأعمدة المطلوبة
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <Badge variant="outline">الرقم الوظيفي *</Badge>
              <Badge variant="outline">الاسم *</Badge>
              <Badge variant="outline">البريد الإلكتروني</Badge>
              <Badge variant="outline">الدور</Badge>
              <Badge variant="outline">رقم المدير</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              الأدوار المتاحة: موظف، مدير مباشر، مدير أعلى، مدير نظام، مدير موارد بشرية
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadImportTemplate}>
              <Download className="w-4 h-4 ml-2" />
              تنزيل نموذج Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Table */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>معاينة البيانات — {rows.length} صف</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>الرقم الوظيفي</TableHead>
                    <TableHead>الاسم</TableHead>
                    <TableHead>البريد</TableHead>
                    <TableHead>الدور</TableHead>
                    <TableHead>رقم المدير</TableHead>
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
                          {ROLE_LABELS[row.role] ?? row.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{row.managerNumber || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                {rows.length} صف جاهز للرفع
              </p>
              <Button onClick={doImport} disabled={importing}>
                {importing ? "جاري الرفع..." : "رفع وحفظ"}
                <Upload className="w-4 h-4 mr-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold">تم الرفع بنجاح</p>
                <p className="text-sm text-muted-foreground">
                  تم استيراد {result.imported} موظف وإنشاء {result.usersCreated} حساب مستخدم
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
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

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: () => apiFetch("/api/employees"),
  });

  const saveMut = useMutation({
    mutationFn: async (payload: { id?: string; name: string; email: string; role: string; isActive: boolean; employeeId: string | null }) => {
      if (payload.id) {
        return apiFetch(`/api/users/${payload.id}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      return apiFetch("/api/users", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setEditUser(null);
      setNewOpen(false);
      toast({ title: "تم الحفظ" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deactivateMut = useMutation({
    mutationFn: async (id: string) => apiFetch(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({ title: "تم تعطيل المستخدم" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 mt-4">
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
                  <TableHead>الموظف المرتبط</TableHead>
                  <TableHead className="w-24">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const emp = employees.find((e) => e.id === u.employeeId);
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
                      <TableCell className="text-sm">
                        {emp ? `${emp.name} (${emp.employeeNumber})` : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEditUser(u)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {u.isActive && (
                            <Button variant="ghost" size="icon" onClick={() => deactivateMut.mutate(u.id)}>
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

      {/* Edit/Create Dialog */}
      <UserDialog
        open={!!editUser || newOpen}
        user={editUser}
        employees={employees}
        onClose={() => { setEditUser(null); setNewOpen(false); }}
        onSave={(data) => saveMut.mutate(data)}
        saving={saveMut.isPending}
      />
    </div>
  );
}

function UserDialog({
  open, user, employees, onClose, onSave, saving,
}: {
  open: boolean;
  user: User | null;
  employees: Employee[];
  onClose: () => void;
  onSave: (data: any) => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [isActive, setIsActive] = useState(true);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  // Sync state when dialog opens
  const prevOpen = useRef(false);
  if (open && !prevOpen.current) {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setIsActive(user.isActive);
      setEmployeeId(user.employeeId);
    } else {
      setName(""); setEmail(""); setRole("EMPLOYEE"); setIsActive(true); setEmployeeId(null);
    }
  }
  prevOpen.current = open;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? "تعديل المستخدم" : "إضافة مستخدم جديد"}</DialogTitle>
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
          <div>
            <Label>الموظف المرتبط</Label>
            <Select value={employeeId ?? "__none__"} onValueChange={(v) => setEmployeeId(v === "__none__" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="اختر موظف (اختياري)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— بدون ربط —</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name} ({e.employeeNumber})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>الحالة</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{isActive ? "نشط" : "معطل"}</span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button
            onClick={() => onSave({ id: user?.id, name, email, role, isActive, employeeId })}
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

  // Initialize form from fetched settings
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
      <div className="space-y-4 mt-4">
        {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  const updateField = <K extends keyof EvalSettings>(key: K, val: EvalSettings[K]) =>
    setForm((f) => f ? { ...f, [key]: val } : f);

  return (
    <div className="space-y-6 mt-4">
      {/* Weights */}
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

      {/* Rating Scale & Labels */}
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
                // Adjust labels array length
                const labels = [...form.ratingLabels];
                while (labels.length < n) labels.push("");
                updateField("ratingLabels", labels.slice(0, n));
              }}
            >
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 درجات</SelectItem>
                <SelectItem value="4">4 درجات</SelectItem>
                <SelectItem value="5">5 درجات</SelectItem>
                <SelectItem value="10">10 درجات</SelectItem>
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

      {/* Workflow */}
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
        </CardContent>
      </Card>

      {/* Evaluation Periods */}
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

      {/* Save Button */}
      <div className="flex justify-end">
        <Button size="lg" onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}>
          {saveMut.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </Button>
      </div>
    </div>
  );
}
