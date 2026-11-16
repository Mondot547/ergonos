// Crée un compte OWNER. Identifiants lus dans l'environnement, jamais en argument ni dans un log :
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:create
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password.ts";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) {
  console.error("ADMIN_EMAIL et ADMIN_PASSWORD (12 caractères min.) sont requis dans l'environnement.");
  process.exit(1);
}

const prisma = new PrismaClient();
const passwordHash = await hashPassword(password);
await prisma.user.upsert({
  where: { email },
  update: { passwordHash, failedLogins: 0, lockedUntil: null },
  create: { email, passwordHash, role: "OWNER" },
});
console.log(`Compte OWNER prêt : ${email}. Activez ensuite la double authentification depuis /admin/securite.`);
await prisma.$disconnect();
