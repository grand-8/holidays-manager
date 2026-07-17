import { requireAdmin } from "@/lib/auth/current-user";
import { getHistoryGrid } from "@/lib/history/service";
import { AdminTabs } from "@/components/admin-tabs";
import { ImportGrid } from "./import-grid";

export default async function ImportPage() {
  const admin = await requireAdmin();
  const grid = await getHistoryGrid(admin.propertyId);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-xl font-semibold">Administration</h1>
      <AdminTabs />
      <p className="text-muted-foreground mb-4 text-sm">
        Saisir ou corriger l&apos;historique des années passées (années × familles).
        Toute modification est journalisée.
      </p>
      <ImportGrid grid={grid} />
    </main>
  );
}
