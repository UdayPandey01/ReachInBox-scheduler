import {app} from "./app";
import { env } from "./config/env";
import "./workers/email.worker";
import { recoverScheduledEmails } from "./queue/recovery";
import { createEmailIndex } from "./config/elasticsearch";
import { emailSearchService } from "./modules/search/emailSearch.service";

async function startServer() {
    await recoverScheduledEmails();

    const indexCreated = await createEmailIndex();

    if (indexCreated) {
        await emailSearchService.reindexAllEmails();
    }

    app.listen(env.PORT, () => {
        console.log(`Server is running on port ${env.PORT}`);
    });
}

startServer().catch((err) => {
    console.error("Error starting server:", err);
    process.exit(1);
});
