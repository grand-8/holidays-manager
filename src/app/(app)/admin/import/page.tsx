import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current-user";
import { getHistoryGrid } from "@/lib/history/service";
import { Button } from "@/components/ui/button";
import { ImportGrid } from "./import-grid";

export default async function ImportPage() {
  const admin = await requireAdmin();
  const grid = await getHistoryGrid(admin.propertyId);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Historique — saisie</h1>
        <Button asChild variant="ghost" size="sm">
          <Link href="/historique">← Historique</Link>
        </Button>
      </div>
      <ImportGrid grid={grid} />
    </main>
  );
}
