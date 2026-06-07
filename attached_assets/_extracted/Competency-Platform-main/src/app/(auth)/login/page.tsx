import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[hsl(219_62%_15%)] to-[hsl(212_67%_24%)] p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
