import type { NextConfig } from "next";

/**
 * En-têtes de sécurité HTTP (audit sécurité, domaine F / OWASP A05).
 * CSP volontairement pragmatique (pas de nonce par requête) : les scripts
 * injectés par Next.js lui-même (hydratation, détection du thème) sont
 * inline, donc `script-src` autorise 'unsafe-inline'. Le vrai gain de cette
 * liste vient des autres en-têtes (anti-clickjacking, anti-sniffing, HSTS,
 * referrer). Un CSP strict par nonce est un chantier séparé, plus invasif
 * (nécessiterait de faire passer un nonce par requête via `proxy.ts`).
 */
const isDev = process.env.NODE_ENV !== "production";

// `unsafe-eval` UNIQUEMENT en dev : React s'en sert pour ses outils de debug
// en développement ; il ne l'utilise JAMAIS en production. La prod reste stricte.
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
