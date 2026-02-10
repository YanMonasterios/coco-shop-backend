import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("⏳ Intentando conectar...");

  const hashed = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { email: "admin@cocos.com" },
    update: {},
    create: {
      email: "admin@cocos.com",
      name: "Administrador Principal",
      password: hashed,
      role: "ADMIN",
    },
  });

  console.log("✅ ¡ÉXITO! Usuario admin creado.");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
