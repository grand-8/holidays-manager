import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { getFamilyStats } from "@/lib/stats/history";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function HistoriquePage() {
  const user = await requireUser();
  const stats = await getFamilyStats(user.propertyId);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Historique</h1>
        {user.isAdmin && (
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/import">Saisir / corriger</Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sur les 5 dernières années</CardTitle>
          <CardDescription>
            Nombre de fois avec 2 semaines, dernière occurrence, et satisfaction
            moyenne. Visible par toutes les familles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left">
                  <th className="py-2 pr-2 font-medium">Famille</th>
                  <th className="py-2 px-2 text-center font-medium">
                    2 semaines
                  </th>
                  <th className="py-2 px-2 text-center font-medium">Dernière</th>
                  <th className="py-2 pl-2 text-center font-medium">
                    Satisfaction
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.userId} className="border-b last:border-0">
                    <td className="py-2 pr-2">
                      {s.nomAffiche}
                      {!s.actif && (
                        <span className="text-muted-foreground"> (inactif)</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {s.timesWith2Weeks}×
                    </td>
                    <td className="py-2 px-2 text-center">
                      {s.lastYearWith2Weeks ?? "—"}
                    </td>
                    <td className="py-2 pl-2 text-center">
                      {s.avgSatisfaction === null
                        ? "—"
                        : `${Math.round(s.avgSatisfaction)} %`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            « — » : aucune donnée. Les années importées ne comptent pas dans la
            satisfaction moyenne.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
