# Sécurité — mesures en place et limites

## En place (code écrit)

- Prix et totaux recalculés côté serveur depuis la base (`src/lib/pricing.ts`) ; le cookie de panier ne contient que id + quantité.
- Webhook Stripe : corps brut + vérification de signature ; idempotence par id d'événement (clé primaire) **et** par `stripeSessionId` unique ; événement libéré en cas d'échec pour permettre le rejeu.
- Contrôle de cohérence : montant Stripe ≠ total serveur → commande `NEEDS_REVIEW`, exclue des ventes.
- Clés Stripe live refusées sauf `ALLOW_LIVE_PAYMENTS=true`. Aucun numéro de carte n'est stocké.
- Admin : mots de passe scrypt, sessions aléatoires (hash SHA-256 en base, cookie httpOnly/SameSite=Strict/Secure en prod), expiration inactivité 2 h / 8 h, verrouillage 15 min après 5 échecs, TOTP (RFC 6238) avec anti-rejeu, message d'erreur générique, contrôle d'accès dans chaque page et chaque action serveur, rôles à moindres privilèges, consultation des données personnelles journalisée.
- En-têtes de sécurité de base, `no-store` sur `/admin`.

## Limites connues — à traiter avant la production

- **Rien de ceci n'a été exécuté** dans un navigateur ni contre une vraie base : voir README (« État de vérification »).
- Pas de limitation de débit par IP (seul le verrouillage par compte existe).
- Le secret TOTP est stocké en clair en base : à chiffrer (clé applicative en variable d'environnement). Pas de codes de secours.
- Pas de protection CSRF supplémentaire au-delà de celle intégrée aux Server Actions de Next.js et de `SameSite`.
- Pas de CSP ; pas de sauvegarde ni de politique de rétention RGPD.
- Pas d'envoi d'e-mails ; la remise de confirmation à l'acheteur n'est pas implémentée.
- Remboursements : enregistrés lorsque Stripe les notifie (`charge.refunded`) ; aucun remboursement n'est déclenché depuis l'admin.
- Audit de dépendances (`npm audit`) non effectué.
