import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

function hashPin(pin: string, salt?: string): { hash: string; salt: string } {
  const useSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(pin, useSalt, 10000, 64, "sha512").toString("hex");
  return { hash, salt: useSalt };
}

function defaultPassword(pin: string): string {
  return (pin + pin).slice(0, 8).padEnd(8, pin);
}

async function main() {
  const adminPin = hashPin("0000");
  const adminPw = defaultPassword("0000");
  const { hash: adminPwHash, salt: adminPwSalt } = hashPin(adminPw);
  await prisma.user.upsert({
    where: { username: "nephi" },
    update: { isAdmin: true },
    create: {
      username: "nephi",
      pinHash: adminPin.hash,
      pinSalt: adminPin.salt,
      pinPlain: "0000",
      password: adminPw,
      passwordHash: adminPwHash,
      passwordSalt: adminPwSalt,
      points: 1000,
      isAdmin: true,
    },
  });

  // Backfill passwords for any existing users who don't have one yet
  const usersWithoutPassword = await prisma.user.findMany({
    where: { password: "" },
    select: { id: true, pinPlain: true },
  });
  for (const u of usersWithoutPassword) {
    const pw = defaultPassword(u.pinPlain);
    const { hash, salt } = hashPin(pw);
    await prisma.user.update({
      where: { id: u.id },
      data: { password: pw, passwordHash: hash, passwordSalt: salt },
    });
  }
  if (usersWithoutPassword.length > 0) {
    console.log(`Backfilled passwords for ${usersWithoutPassword.length} users.`);
  }

  console.log("Seed complete! Admin user: nephi | PIN: 0000 | Password: 00000000");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
