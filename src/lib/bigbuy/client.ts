// Intégration BigBuy — ISOLÉE et DÉSACTIVÉE PAR DÉFAUT.
//
// Source : « Guide API BigBuy (EN) », https://www.bigbuy.eu/public/doc/Guia_API_BigBuy_EN.pdf
// consulté le 2026-11-16. Référence des endpoints annoncée par le guide : https://api.bigbuy.eu/rest/doc
// (non consultée : à lire avant d'activer).
//
// Ce que le guide documente (et que ce client utilise) :
//   base URL https://api.bigbuy.eu ; en-tête Authorization: Bearer <clé> ;
//   GET /rest/catalog/taxonomies.json ; GET /rest/catalog/products.json?parentTaxonomy=ID ;
//   GET /rest/catalog/productsinformation.json?isoCode=..&parentTaxonomy=.. ;
//   GET /rest/catalog/productsstockbyhandlingdays.json?parentTaxonomy=.. ;
//   GET /rest/shipping/carriers.{format}.
//
// Ce que le guide NE documente PAS (donc non implémenté) : URL de sandbox, suivi de commande,
// limites de débit. La création de commande (POST /rest/order/create/multishipping.{format})
// est volontairement NON implémentée : aucune commande fournisseur sans confirmation admin explicite
// et validation du schéma réel.

export interface BigBuyConfig {
  enabled: boolean;
  apiKey: string | undefined;
  baseUrl: string;
  /** Doit être mis à true seulement après vérification des noms de champs contre /rest/doc. */
  fieldMappingVerified: boolean;
}

export function bigBuyConfigFromEnv(env: Record<string, string | undefined>): BigBuyConfig {
  return {
    enabled: env.BIGBUY_ENABLED === "true",
    apiKey: env.BIGBUY_API_KEY || undefined,
    baseUrl: env.BIGBUY_BASE_URL || "https://api.bigbuy.eu",
    fieldMappingVerified: env.BIGBUY_FIELD_MAPPING_VERIFIED === "true",
  };
}

export type BigBuyStatus =
  | { state: "disabled"; reason: string }
  | { state: "ready" };

export function bigBuyStatus(cfg: BigBuyConfig): BigBuyStatus {
  if (!cfg.enabled) return { state: "disabled", reason: "BIGBUY_ENABLED n'est pas à « true » (désactivé par défaut)." };
  if (!cfg.apiKey) return { state: "disabled", reason: "BIGBUY_API_KEY absent (clé fournie par BigBuy sur demande)." };
  return { state: "ready" };
}

export class BigBuyError extends Error {
  httpStatus?: number;
  constructor(message: string, httpStatus?: number) {
    super(message);
    this.httpStatus = httpStatus;
  }
}

export class BigBuyClient {
  private cfg: BigBuyConfig;
  private fetchImpl: typeof fetch;
  constructor(cfg: BigBuyConfig, fetchImpl: typeof fetch = fetch) {
    this.cfg = cfg;
    this.fetchImpl = fetchImpl;
    const s = bigBuyStatus(cfg);
    if (s.state !== "ready") throw new BigBuyError(`Intégration BigBuy inactive : ${s.reason}`);
  }

  private async get<T>(path: string, query: Record<string, string> = {}): Promise<T> {
    const url = new URL(path, this.cfg.baseUrl);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const res = await this.fetchImpl(url, {
      headers: { Authorization: `Bearer ${this.cfg.apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new BigBuyError(`BigBuy ${path} → HTTP ${res.status}`, res.status);
    return (await res.json()) as T;
  }

  taxonomies(firstLevelOnly = true) {
    return this.get<unknown[]>("/rest/catalog/taxonomies.json", firstLevelOnly ? { firstLevel: "true" } : {});
  }
  products(parentTaxonomy: string) {
    return this.get<unknown[]>("/rest/catalog/products.json", { parentTaxonomy });
  }
  productsInformation(isoCode: string, parentTaxonomy: string) {
    return this.get<unknown[]>("/rest/catalog/productsinformation.json", { isoCode, parentTaxonomy });
  }
  stockByHandlingDays(parentTaxonomy: string) {
    return this.get<unknown[]>("/rest/catalog/productsstockbyhandlingdays.json", { parentTaxonomy });
  }
  carriers() {
    return this.get<unknown>("/rest/shipping/carriers.json");
  }
}
