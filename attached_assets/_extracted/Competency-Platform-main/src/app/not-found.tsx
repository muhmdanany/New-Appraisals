import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <h1 className="text-5xl font-extrabold text-primary">404</h1>
      <p className="text-muted-foreground">الصفحة التي تبحث عنها غير موجودة.</p>
      <Button asChild>
        <Link href="/">العودة إلى الرئيسية</Link>
      </Button>
    </div>
  );
}
