import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    NODE_ENV: z.string().default("development"),
    PORT: z.coerce.number().default(4000),
    FRONTEND_URL: z.url().default("http://localhost:5173"),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    ELASTICSEARCH_URL: z.url().default("http://localhost:9200"),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).default(1),

    SLACK_CLIENT_ID: z.string().min(1),
    SLACK_CLIENT_SECRET: z.string().min(1),
    SLACK_REDIRECT_URI: z.url(),

    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GOOGLE_REDIRECT_URI: z.url(),

    JWT_SECRET: z.string().min(32),
})

export const env = envSchema.parse(process.env);

export const isProduction = env.NODE_ENV === "production";
