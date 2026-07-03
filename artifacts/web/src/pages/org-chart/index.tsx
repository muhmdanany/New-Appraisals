import { useState, useRef, useCallback } from "react";
import { useReportOrgTree } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronLeft, User, Users, Upload, Download, Loader2 } from "lucide-react";
import { parseSpreadsheet, pick, mapRole, downloadOrgTemplate } from "@/lib/xlsx";

const apiFetch = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const uid = localStorage.getItem("selectedUserId");
  const h: Record<string, string> = { "Content-Type": "application/json", ...init?.headers as Record<string, string> };
  if (uid) h["X-User-Id"] = uid;
  const res = await fetch(url, { ...init, headers: h });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

type OrgNode = {
  id: string;
  name: string;
  managerId?: string | null;
  jobName?: string | null;
  department?: string | null;
};

type TreeNode = OrgNode & { children: TreeNode[] };

function buildTree(nodes: OrgNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const n of nodes) {
    map.set(n.id, { ...n, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const n of map.values()) {
    if (n.managerId && map.has(n.managerId)) {
      map.get(n.managerId)!.children.push(n);
    } else {
      roots.push(n);
    }
  }
  return roots;
}

function TreeNodeCard({ node, level = 0 }: { node: TreeNode; level?: number }) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div className={level > 0 ? "mr-6 border-r-2 border-border pr-4" : ""}>
      <div
        className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer hover:bg-secondary/50 ${
          level === 0 ? "bg-primary/5 border border-primary/20" : ""
        }`}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
          )
        ) : (
          <span className="w-4" />
        )}

        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          hasChildren ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}>
          {hasChildren ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{node.name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {[node.jobName, node.department].filter(Boolean).join(" — ") || "—"}
          </div>
        </div>

        {hasChildren && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {node.children.length}
          </span>
        )}
      </div>

      {expanded && hasChildren && (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <TreeNodeCard key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ========== Import Dialog ==========

function ImportOrgDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }, []);

  const doImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const raw = await parseSpreadsheet(file);
      const rows = raw
        .map((r) => ({
          employeeNumber: pick(r, "الرقم الوظيفي", "employeeNumber", "رقم الموظف"),
          name: pick(r, "الاسم", "name", "اسم الموظف"),
          email: pick(r, "البريد الإلكتروني", "email", "البريد"),
          role: mapRole(pick(r, "الدور", "role", "الصلاحية")),
          managerNumber: pick(r, "رقم المدير", "managerNumber", "المدير"),
        }))
        .filter((r) => r.employeeNumber && r.name);

      if (rows.length === 0) {
        toast({ title: "لا توجد بيانات صالحة", description: "تأكد من تعبئة الأعمدة المطلوبة.", variant: "destructive" });
        setImporting(false);
        return;
      }

      const res = await apiFetch<{ imported: number; usersCreated: number }>(
        "/api/admin/import-with-roles",
        { method: "POST", body: JSON.stringify({ rows }) },
      );
      toast({ title: "تم الاستيراد بنجاح", description: `${res.imported} موظف، ${res.usersCreated} حساب مستخدم` });
      qc.invalidateQueries({ queryKey: ["/api/reports/org-tree"] });
      setFile(null);
      onClose();
    } catch (e: any) {
      toast({ title: "خطأ في الاستيراد", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setFile(null); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>استيراد الهيكل التنظيمي</DialogTitle>
          <p className="text-sm text-muted-foreground">حمّل القالب أولاً، عبّئه ببيانات الإدارات، ثم اختر الملف من جهازك لبدء الاستيراد.</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Step 1 */}
          <div className="rounded-lg border p-4 space-y-2">
            <h3 className="font-bold text-sm">1) تحميل القالب</h3>
            <p className="text-xs text-muted-foreground">استخدم هذا القالب كنقطة بداية، ثم أدخل بيانات الإدارات في الصفوف التالية.</p>
            <Button variant="outline" size="sm" onClick={downloadOrgTemplate} className="gap-2">
              <Download className="w-4 h-4" />
              تحميل القالب
            </Button>
          </div>

          {/* Step 2 */}
          <div className="rounded-lg border p-4 space-y-2">
            <h3 className="font-bold text-sm">2) اختيار الملف</h3>
            <p className="text-xs text-muted-foreground">اختر ملف الإكسل الذي قمت بتعبئته ثم ابدأ الاستيراد.</p>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-2">
              <Upload className="w-4 h-4" />
              {file ? file.name : "اختر ملف"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              className="hidden"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { onClose(); setFile(null); }}>إلغاء</Button>
          <Button onClick={doImport} disabled={!file || importing} className="gap-2">
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            ابدأ الاستيراد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ========== Main Page ==========

export default function OrgChart() {
  const { t } = useTranslation();
  const { data: tree, isLoading } = useReportOrgTree();
  const [importOpen, setImportOpen] = useState(false);

  const roots = tree ? buildTree(tree as OrgNode[]) : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button onClick={() => setImportOpen(true)} className="gap-2">
          <Upload className="w-4 h-4" />
          استيراد الهيكل
        </Button>
        <h1 className="text-3xl font-bold text-foreground">{t("orgChart.title")}</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t("orgChart.treeTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : roots.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {t("orgChart.noEmployees")}
            </div>
          ) : (
            <div className="space-y-2">
              {roots.map((node) => (
                <TreeNodeCard key={node.id} node={node} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ImportOrgDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
