import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runReminders } from "@/lib/reminders/service";

/**
 * Route de relances automatiques J-7/J-3 (spec section 6, items 3 & 6),
 * déclenchée quotidiennement par Vercel Cron (voir vercel.json).
 *
 * Vercel ajoute automatiquement l'en-tête « Authorization: Bearer <CRON_SECRET> »
 * aux appels Cron quand la variable CRON_SECRET est définie. On refuse tout
 * appel dont le secret ne correspond pas. Sans CRON_SECRET configuré, la route
 * est désactivée (503) plutôt qu'ouverte au public.
 */

// Ne jamais mettre en cache : effet de bord (envoi d'emails) à chaque appel.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { error: "Relances désactivées : CRON_SECRET non configuré." },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const summary = await runReminders();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[cron/reminders] Échec:", error);
    return NextResponse.json(
      { ok: false, error: "Échec des relances." },
      { status: 500 },
    );
  }
}
