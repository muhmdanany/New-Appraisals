import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useListEmployees, getListEmployeesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, UserPlus, Mail, Phone, Building2 } from "lucide-react";
import { Link } from "wouter";

interface PeopleTabProps {
  orgId: number;
}

export function PeopleTab({ orgId }: PeopleTabProps) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState("");

  const { data: employees, isLoading } = useListEmployees(orgId, {}, {
    query: {
      enabled: !!orgId,
      queryKey: getListEmployeesQueryKey(orgId),
    },
  });

  const filtered = useMemo(() => {
    if (!employees) return [];
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter(
      (e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.title?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q)
    );
  }, [employees, search]);

  const canEdit = hasPermission("employees", "edit");

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="ps-9"
            placeholder={t("employees.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canEdit && (
          <Link href={`/employees`}>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
              <UserPlus className="h-4 w-4" />
              {t("employees.addEmployee")}
            </Button>
          </Link>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-16 text-center">
          <div>
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {search ? t("employees.noResults") : t("employees.noEmployees")}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employees.name")}</TableHead>
                <TableHead>{t("employees.title")}</TableHead>
                <TableHead>{t("employees.email")}</TableHead>
                <TableHead>{t("employees.department")}</TableHead>
                <TableHead>{t("employees.employeeId")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((emp) => {
                const initials = `${emp.firstName?.[0] ?? ""}${emp.lastName?.[0] ?? ""}`.toUpperCase();
                return (
                  <TableRow key={emp.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-purple-100 text-purple-700 font-medium">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-foreground">
                          {emp.firstName} {emp.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{emp.title || "—"}</TableCell>
                    <TableCell>
                      {emp.email ? (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="text-sm">{emp.email}</span>
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {emp.departmentId ? (
                        <Badge variant="secondary" className="gap-1">
                          <Building2 className="h-3 w-3" />
                          Dept #{emp.departmentId}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {emp.employeeId || `#${emp.id}`}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="p-3 border-t border-border text-xs text-muted-foreground">
        {t("orgSpace.totalEmployees", { count: employees?.length ?? 0 })}
      </div>
    </div>
  );
}
