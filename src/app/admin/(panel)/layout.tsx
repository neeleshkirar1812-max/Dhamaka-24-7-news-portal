import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session?.user?.email) {
    redirect("/admin/login");
  }

  return <AdminShell adminEmail={session.user.email}>{children}</AdminShell>;
}
