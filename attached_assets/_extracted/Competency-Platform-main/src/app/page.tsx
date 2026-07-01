import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { defaultPathForRole, type Role } from "@/lib/rbac";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect(defaultPathForRole(session.user.role as Role));
}
