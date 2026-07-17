import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
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
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Familles</h1>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin">← Administration</Link>
        </Button>
      </div>
      <UsersManager users={users} currentUserId={admin.id} />
    </main>
  );
}
