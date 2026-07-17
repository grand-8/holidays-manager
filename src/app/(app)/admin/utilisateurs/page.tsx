import { requireAdmin } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { AdminTabs } from "@/components/admin-tabs";
import { UsersManager } from "./users-manager";

export default async function UsersPage() {
  const admin = await requireAdmin();
  const users = await prisma.user.findMany({
    where: { propertyId: admin.propertyId },
    orderBy: [{ actif: "desc" }, { nomAffiche: "asc" }],
    select: {
      id: true,
      email: true,
      nomAffiche: true,
      isAdmin: true,
      actif: true,
    },
  });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-xl font-semibold">Administration</h1>
      <AdminTabs />
      <UsersManager users={users} currentUserId={admin.id} />
    </main>
  );
}
