# Intégration BigBuy — état de validation

**Date de vérification : 2026-11-16.**

## Sources consultées

- Guide API BigBuy (EN) : https://www.bigbuy.eu/public/doc/Guia_API_BigBuy_EN.pdf (lu).
- Référence des endpoints annoncée par ce guide : https://api.bigbuy.eu/rest/doc (**non consultée** : à lire avant activation).
- Page https://www.bigbuy.eu/fr/api_bigbuy.html : non accessible depuis l'environnement de développement.
- **Conditions commerciales actuelles de BigBuy (tarifs, frais, délais, politique de retour, conditions dropshipping) : NON consultées.**

## Confirmé par le guide

| Sujet | Contenu documenté |
|---|---|
| Base URL | `https://api.bigbuy.eu` |
| Authentification | En-tête `Authorization: Bearer <clé>` ; clé « fournie sur demande via le formulaire de contact » |
| Catégories | `GET /rest/catalog/taxonomies.json` (`firstLevel`) |
| Produits | `GET /rest/catalog/products.json?parentTaxonomy=ID` |
| Textes produits | `GET /rest/catalog/productsinformation.json?isoCode=..&parentTaxonomy=..` |
| Images | `GET /rest/catalog/productsimages.{format}?parentTaxonomy=..` |
| Stock | `GET /rest/catalog/productsstockbyhandlingdays.json?parentTaxonomy=..` |
| Prix | Pas d'endpoint dédié ; champs `wholesalePrice`, `retailPrice`, `inShopsPrice`, `priceLargeQuantities` dans les réponses produits |
| Commande | `POST /rest/order/check/multishipping.{format}` (vérification), `POST /rest/order/create/multishipping.{format}` (création) |
| Expédition | `POST /rest/shipping/orders.{format}`, `GET /rest/shipping/carriers.{format}` |
| Fréquences recommandées | Catalogue : 1×/jour ou toutes les 8 h ; stock des variations : toutes les 10–15 min |

## Non documenté (donc non supposé)

URL de sandbox/test, suivi de commande, limites de débit, schéma exact des réponses, unité des prix (HT/TTC), conditions de dropshipping.

## État dans le code

- Client isolé : `src/lib/bigbuy/client.ts`. **Désactivé par défaut** (`BIGBUY_ENABLED=false`, pas de clé).
- Il n'utilise que des endpoints de **lecture** listés ci-dessus.
- **Création de commande fournisseur : volontairement non implémentée.** Elle exigera : clé API, schéma validé via `/rest/doc`, appel `order/check` préalable, confirmation explicite d'un admin.
- **Import/synchronisation non livrés** : le mappage des champs de réponse n'a pas été vérifié. L'écran admin les déclare indisponibles tant que `BIGBUY_FIELD_MAPPING_VERIFIED` n'est pas à `true`. Tout produit importé devra être créé en `DRAFT`.
- Mode développement : `npm run db:seed` crée des produits **fictifs** `[DÉMO]` en brouillon (`isDemo = true`), exclus du sitemap et séparés des KPI réels.

## À faire avant activation

1. Demander la clé API à BigBuy ; la stocker uniquement dans les variables d'environnement.
2. Lire `/rest/doc`, vérifier les champs et l'unité des prix, écrire le mappage + tests.
3. Lire les conditions commerciales et les reporter dans les pages Livraison/Retours.
