import {app} from "./app";
import { env } from "./config/env";
import { redis } from "./config/redis";
import {db} from "./config/db";
import "./workers/email.worker";
import { recoverScheduledEmails } from "./queue/recovery";

async function startServer() {
    const result = await db.execute(`SELECT NOW()`);
    console.log("PostgreSQL:", result);

    await redis.set("test", "Hello, Redis!");

    const value = await redis.get("test");
    console.log("Redis test value:", value);

    await recoverScheduledEmails();

    app.listen(env.PORT, () => {
        console.log(`Server is running on port ${env.PORT}`);
    });
}

startServer().catch((err) => {
    console.error("Error starting server:", err);
});


