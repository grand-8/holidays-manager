import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "@/lib/constants";

/**
 * Glissement du cookie de session (spec section 2 : durée de vie renouvelée à
 * chaque visite). En Next 16 cette convention s'appelle `proxy` (ex-middleware).
 * Le proxy ne fait que repousser l'expiration du cookie ; il ne valide PAS la
 * session (pas d'accès base sur l'edge). La validation et le glissement en base
 * restent côté serveur dans getSessionUser().
 */
export function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    });
  }
  return res;
}

export const config = {
  // Toutes les routes sauf les assets statiques Next et les fichiers avec extension.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
