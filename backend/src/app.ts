import express from "express";
import cookieParser from "cookie-parser";
import emailRoutes from "./modules/emails/emails.routes";
import { serverAdapter } from "./queue/bullBoard";
import { slackRouter } from "./modules/slack/slack.routes";
import searchRoutes from "./modules/search/search.routes";
import authRoutes from "./modules/auth/auth.routes";
import senderRoutes from "./modules/senders/senders.routes";
import { errorHandler } from "./middleware/errorHandler";

export const app = express();

app.use(express.json({ limit: "15mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
    })
})

app.use("/api/auth", authRoutes);
app.use("/api/emails", emailRoutes);
app.use("/api/senders", senderRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/slack", slackRouter);
app.use("/admin/queues", serverAdapter.getRouter());

app.use("/api", (_req, res) => {
    res.status(404).json({ message: "Not found" });
});

app.use(errorHandler);
