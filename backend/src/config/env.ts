import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).default(1),
})

export const env = envSchema.parse(process.env);