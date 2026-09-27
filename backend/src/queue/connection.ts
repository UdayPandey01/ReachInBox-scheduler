import IORedis from "ioredis";
import { env } from "../config/env";

export const queueConnection = new IORedis(env.REDIS_URL,{
    maxRetriesPerRequest: null,
});