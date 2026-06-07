import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, UserPlus, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "wouter";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface OrgUser {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  roles: { id: number; name: string }[];
}

interface UsersTabProps {
  orgId: number;
}

export function UsersTab({ orgId }: UsersTabProps) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    setIsLoading(true);
    fetch(`${API_BASE}/organizations/${orgId}/users`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setUsers(Array.isArray(data) ? data : []);
      })
      .catch(() => setUsers([]))
      .finally(() => setIsLoading(false));
  }, [orgId]);

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const canEdit = hasPermission("users", "edit");

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
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
            placeholder={t("settings.searchUsers") || "Search users..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canEdit && (
          <Link href="/settings?tab=users">
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
              <UserPlus className="h-4 w-4" />
              {t("settings.addUser")}
            </Button>
          </Link>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-16 text-center">
          <div>
            <p className="text-sm text-muted-foreground">
              {search ? t("common.noResults") : t("settings.noUsers")}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("settings.name")}</TableHead>
                <TableHead>{t("settings.email")}</TableHead>
                <TableHead>{t("settings.roles")}</TableHead>
                <TableHead>{t("settings.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => {
                const initials = user.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
                return (
                  <TableRow key={user.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-blue-100 text-blue-700 font-medium">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length > 0 ? (
                          user.roles.map((r) => (
                            <Badge key={r.id} variant="secondary" className="text-xs">
                              {r.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.isActive ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-sm">{t("settings.active")}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <XCircle className="h-4 w-4" />
                          <span className="text-sm">{t("settings.inactive")}</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="p-3 border-t border-border text-xs text-muted-foreground">
        {users.length} {t("settings.users")?.toLowerCase() || "users"}
      </div>
    </div>
  );
}
