import postgres from "postgres";
import {drizzle} from "drizzle-orm/postgres-js";
import { env } from "./env";

const client = postgres(env.DATABASE_URL, {
    idle_timeout: 20,
    connect_timeout: 10,
});

export const db = drizzle(client);
