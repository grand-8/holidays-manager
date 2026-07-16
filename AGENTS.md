<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Projet — Application vacances familiales

Planification partagée des semaines de vacances entre familles d'un bien commun.
La spécification fonctionnelle et technique complète fait foi : voir
`specification-app-vacances-familiales.md` à la racine. **Toujours s'y référer**
avant d'implémenter une règle métier (scores, algorithme, mode de secours, etc.).

## Stack
- Next.js 16 (App Router) + TypeScript + React 19
- Tailwind CSS v4 + shadcn/ui (base radix)
- Prisma 6 + PostgreSQL (Neon)
- Resend (emails OTP + notifications)
- Auth OTP maison (pas de fournisseur externe), session par cookie sécurisé
- Déploiement : Vercel
- **Langue : français uniquement.** Mobile-first.

## Conventions
- Secrets uniquement via variables d'environnement, validées dans `src/lib/env.ts`.
  Jamais de secret committé. Template : `.env.example`.
- Constantes de score centralisées dans `src/lib/constants.ts` — ne jamais dupliquer
  les valeurs 100/70/40/30 ailleurs (spec section 12).
- Client Prisma : importer depuis `src/lib/prisma.ts` (singleton).
- Contrôle d'accès **toujours côté serveur** (spec section 2) : l'UI n'est jamais
  une barrière de sécurité.
- Aucun lien d'email ne déclenche d'action directement : il ouvre une page, l'action
  se fait par un POST authentifié après clic explicite (spec section 9).

## Commandes
- `npm run dev` — serveur de dev
- `npm run db:migrate` — créer/appliquer une migration (dev)
- `npm run db:deploy` — appliquer les migrations (prod)
- `npm run db:seed` — initialiser bien + familles (lit `prisma/families.json`)
- `npm run db:studio` — explorer la base
- `npm run lint` / `npx tsc --noEmit` — qualité

## Modèle de données
Défini dans `prisma/schema.prisma` d'après la section 7 de la spec. Toutes les
entités sont rattachées à un `Property` (multi-bien anticipé). `AuditLog` est
strictement insert-only.
