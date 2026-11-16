-- Sécurité Supabase : les tables du schéma public sont exposées par l'API de données.
-- On active la RLS sans aucune politique : les rôles anon/authenticated n'ont aucun accès.
-- L'application se connecte via Prisma avec le rôle propriétaire (qui contourne la RLS).
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CheckoutSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierSync" ENABLE ROW LEVEL SECURITY;
