import { Award, UserRound } from "lucide-react";
import { useIdentity, ROLE_LABELS } from "@/lib/identity";

export default function SelectUser() {
  const { users, isLoading, select } = useIdentity();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary flex items-center justify-center gap-2">
            <Award className="w-9 h-9" />
            منصة الكفاءات
          </h1>
          <p className="text-muted-foreground mt-2">اختر اسمك للمتابعة</p>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground">جاري التحميل...</p>
        ) : users.length === 0 ? (
          <p className="text-center text-muted-foreground">لا يوجد مستخدمون متاحون.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => select(u.id)}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-right transition-colors hover:bg-secondary hover:border-primary"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserRound className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">{u.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {ROLE_LABELS[u.role] ?? u.role}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
