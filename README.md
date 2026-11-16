# Ergonos — dropshipping, accessoires de bureau à domicile (France, EUR)

Next.js (App Router) + TypeScript, PostgreSQL + Prisma, Stripe Checkout (mode test), admin sécurisé.

## État de vérification (à lire en premier)

| Élément | État |
|---|---|
| Logique métier pure (prix, KPI, mot de passe, TOTP, permissions, sessions, webhooks idempotents, client BigBuy simulé) | **24 tests passent** (`npm test`) ; modules sans dépendance Node typés avec `tsc` sans erreur |
| Installation des dépendances, `prisma generate/migrate`, `next build`, typage de l'application | **Non exécutés** : le réseau de l'environnement de build bloquait npm, et ni PostgreSQL ni Docker n'étaient disponibles |
| Versions de `package.json` (Next 16, React 19, Prisma 6, Stripe 19) | **Non vérifiées** contre le registre : lancer `npm install` puis `npm outdated` et ajuster |
| Paiement Stripe de bout en bout, webhooks réels | **Non testés** |
| BigBuy | **Désactivé** ; doc partiellement vérifiée (voir `docs/BIGBUY.md`) |
| Textes légaux | Provisoires, **à faire vérifier** |

Le code de l'application (`src/app`, adaptateurs Prisma/Stripe) n'a donc jamais été compilé : attendez-vous à quelques corrections de types au premier `npm run typecheck`.

## Démarrage

```bash
cp .env.example .env            # renseigner DATABASE_URL, clés Stripe de TEST
npm install
npx prisma migrate dev --name init
npm run db:seed                 # optionnel : produits [DÉMO] en brouillon
ADMIN_EMAIL=vous@exemple.fr ADMIN_PASSWORD='…12 car. min…' npm run admin:create
npm run dev
```

Webhook en local : `stripe listen --forward-to localhost:3000/api/stripe/webhook`, puis copier le secret `whsec_…` dans `STRIPE_WEBHOOK_SECRET`.
Connexion : `/admin/login`, puis activer la double authentification dans `/admin/securite`.

## Base de données Supabase (test)

Projet Supabase `ergonos` (région eu-west-3). Les migrations `0001_init` et `0002_enable_rls` ont **déjà été appliquées** via l'outil Supabase.
Avant le premier `prisma migrate deploy` contre cette base, les déclarer comme appliquées pour éviter de les rejouer :

```bash
npx prisma migrate resolve --applied 0001_init
npx prisma migrate resolve --applied 0002_enable_rls
```

Utiliser l'URL du *pooler* Supabase pour `DATABASE_URL` (secrets d'hébergeur et GitHub uniquement). La RLS est activée sans politique : l'API publique Supabase n'a accès à rien, seul Prisma (rôle propriétaire) lit et écrit.

## Structure

- `src/lib/` : logique testable (`pricing`, `kpi`, `auth/*`, `stripe/webhook-handler`, `bigbuy/client`).
- `src/app/` : boutique, panier, checkout (`actions/shop.ts`), `api/stripe/webhook`, `admin/`.
- `prisma/` : schéma, seed de démonstration, création d'admin.
- `docs/` : `BIGBUY.md`, `SECURITY.md`.

## Principes

- Montants en centimes entiers ; prix toujours relus en base.
- Les KPI séparent valeurs réelles / estimées / manquantes ; données de démo jamais mélangées ; marge calculée seulement si frais et coûts sont complets ; le CA brut n'est jamais présenté comme un bénéfice.
- Produits importés ou créés : brouillon jusqu'à publication par un admin.
- Frais de livraison (`SHIPPING_FLAT_CENTS`), délais, TVA, conditions de vente : **à définir par l'exploitant**, aucune valeur inventée.

## Non implémenté

Import/synchronisation BigBuy, commande fournisseur, e-mails transactionnels, remboursement depuis l'admin, gestion des utilisateurs admin (hors `admin:create`), analytics/consentement, déploiement.
