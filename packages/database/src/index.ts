import dotenv from "dotenv";
import path from "node:path";
import { createRequire } from "node:module";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
export { Prisma } from "../generated/index.js";

dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
}

const require = createRequire(import.meta.url);
const prismaModule = require("../generated/index.js");
const PrismaClient = prismaModule.PrismaClient || prismaModule.default?.PrismaClient;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool as any);
export const prisma = new PrismaClient({ adapter });
export { PrismaClient };
export * from "../generated/index.js";
