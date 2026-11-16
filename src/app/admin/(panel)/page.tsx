import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { computeKpis, previousRange, type Kpis, type Metric, type OrderForKpi, type OrderStatus } from "@/lib/kpi";
import { formatEur } from "@/lib/money";

export const metadata = { title: "Tableau de bord" };
type SP = Promise<{ from?: string; to?: string; compare?: string; jeu?: string; refus?: string }>;

const KIND_LABEL = { real: "Valeur réelle", estimated: "Estimation", missing: "Donnée manquante" } as const;

function parseDay(s: string | undefined, fallback: Date): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return fallback;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function MetricCard({ title, m, money = true }: { title: string; m: Metric; money?: boolean }) {
  return (
    <div className="card kpi">
      <div className="muted">{title}</div>
      <div className="v">{m.value === null ? "—" : money ? formatEur(m.value) : m.value}</div>
      <div className="tag">{KIND_LABEL[m.kind]}{m.coverage < 1 && m.kind !== "missing" ? ` · disponible pour ${Math.round(m.coverage * 100)} % des commandes` : ""}</div>
      {m.note && <div className="tag">{m.note}</div>}
    </div>
  );
}

function Block({ title, k }: { title: string; k: Kpis }) {
  return (
    <section aria-label={title}>
      <h2>{title}</h2>
      <div className="kpis">
        <div className="card kpi"><div className="muted">Commandes</div><div className="v">{k.orders}</div><div className="tag">Annulées : {k.cancelledOrders}</div></div>
        <div className="card kpi"><div className="muted">Articles vendus</div><div className="v">{k.itemsSold}</div></div>
        <MetricCard title="Chiffre d'affaires brut encaissé" m={k.grossRevenue} />
        <MetricCard title="Remboursements" m={k.refunds} />
        <MetricCard title="Frais de paiement" m={k.paymentFees} />
        <MetricCard title="Coûts d'achat fournisseur" m={k.supplierCosts} />
        <MetricCard title="Marge estimée" m={k.estimatedMargin} />
      </div>
    </section>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  await requireUser("dashboard:view");
  const sp = await searchParams;
  const dataset = sp.jeu === "demo" ? "demo" : "real";
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const from = parseDay(sp.from, new Date(today.getTime() - 29 * 86400_000));
  const to = new Date(parseDay(sp.to, today).getTime() + 86400_000); // borne haute exclusive
  const range = { from, to };
  const prev = previousRange(range);

  const rows = await prisma.order.findMany({
    where: { createdAt: { gte: sp.compare === "1" ? prev.from : from, lt: to } },
    include: { items: true },
  });
  const orders: OrderForKpi[] = rows.map((o) => ({
    createdAt: o.createdAt,
    status: o.status as OrderStatus,
    grossCents: o.grossCents,
    refundedCents: o.refundedCents,
    feeCents: o.feeCents,
    supplierCostCents: o.items.length > 0 && o.items.every((i) => i.supplierCostCentsSnapshot !== null)
      ? o.items.reduce((s, i) => s + (i.supplierCostCentsSnapshot ?? 0) * i.quantity, 0)
      : null,
    itemsCount: o.items.reduce((s, i) => s + i.quantity, 0),
    shipCountry: o.shipCountry,
    isDemo: o.isDemo,
  }));

  const current = computeKpis(orders, range, dataset);
  const previous = sp.compare === "1" ? computeKpis(orders, prev, dataset) : null;
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <>
      <h1>Tableau de bord</h1>
      {sp.refus && <p className="notice" role="alert">Accès refusé à cette section.</p>}
      {dataset === "demo" && <p className="notice">Affichage des données de DÉMONSTRATION uniquement. Elles ne sont jamais mélangées aux données réelles.</p>}
      <form className="filters" method="get">
        <div><label htmlFor="from">Du</label><input id="from" type="date" name="from" defaultValue={iso(from)} /></div>
        <div><label htmlFor="to">Au (inclus)</label><input id="to" type="date" name="to" defaultValue={iso(new Date(to.getTime() - 86400_000))} /></div>
        <div><label htmlFor="jeu">Jeu de données</label><select id="jeu" name="jeu" defaultValue={dataset}><option value="real">Réel</option><option value="demo">Démonstration</option></select></div>
        <div><label htmlFor="compare"><input id="compare" type="checkbox" name="compare" value="1" defaultChecked={sp.compare === "1"} /> Comparer à la période précédente</label></div>
        <div style={{ alignSelf: "end" }}><button className="btn" type="submit">Appliquer</button></div>
      </form>
      <p className="muted">Le chiffre d'affaires brut n'est pas un bénéfice. Une valeur « manquante » n'est jamais remplacée par zéro.</p>
      <Block title="Période sélectionnée" k={current} />
      {previous && <Block title="Période précédente (même durée)" k={previous} />}
      <section>
        <h2>Livraisons par pays</h2>
        <p className="muted">Pays de l'adresse de livraison saisie à la commande ; ce n'est pas la localisation physique de l'acheteur.</p>
        {current.byCountry.length === 0 ? <p>Aucune commande sur la période.</p> : (
          <table>
            <thead><tr><th>Pays de livraison</th><th>Commandes</th><th>CA brut encaissé</th></tr></thead>
            <tbody>{current.byCountry.map((c) => <tr key={c.country}><td>{c.country}</td><td>{c.orders}</td><td>{formatEur(c.grossCents)}</td></tr>)}</tbody>
          </table>
        )}
      </section>
      <section>
        <h2>Source marketing</h2>
        <p className="muted">Non disponible : aucun suivi ni consentement n'est configuré (aucun outil d'audience installé).</p>
      </section>
    </>
  );
}
