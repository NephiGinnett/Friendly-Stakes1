import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

function hashPin(pin: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(pin, salt, 10000, 64, "sha512")
    .toString("hex");
  return { hash, salt };
}

async function main() {
  const adminPin = hashPin("0000");
  await prisma.user.upsert({
    where: { username: "nephi" },
    update: {},
    create: {
      username: "nephi",
      pinHash: adminPin.hash,
      pinSalt: adminPin.salt,
      points: 1000,
      isAdmin: true,
    },
  });

  console.log("Seed complete! Admin user created:");
  console.log("  Username: nephi");
  console.log("  PIN: 0000");
  console.log("  (Change your PIN after first login!)");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
