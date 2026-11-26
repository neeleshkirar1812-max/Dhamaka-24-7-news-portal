import fs from "node:fs";
import path from "node:path";

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
const dbUrl = process.env.DATABASE_URL ?? "";
const targetProvider =
  dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://")
    ? "postgresql"
    : "sqlite";

const current = fs.readFileSync(schemaPath, "utf8");
const updated = current.replace(
  /provider\s*=\s*"(?:sqlite|postgresql)"/,
  `provider = "${targetProvider}"`
);

if (current !== updated) {
  fs.writeFileSync(schemaPath, updated, "utf8");
  console.log(`Updated prisma/schema.prisma provider to "${targetProvider}".`);
} else {
  console.log(`prisma/schema.prisma already configured for "${targetProvider}".`);
}
