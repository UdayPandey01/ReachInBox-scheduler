import express from "express";
import emailRoutes from "./modules/emails/emails.routes";
import { serverAdapter } from "./queue/bullBoard";

export const app = express();

app.use(express.json());

app.get("/health", async(req, res) => {
    res.json({
        status: "ok",
    })
})

app.use("/api/emails", emailRoutes);

app.use("/admin/queues", serverAdapter.getRouter());