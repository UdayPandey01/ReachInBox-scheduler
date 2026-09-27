import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/requireAuth";
import { sendersRepository } from "./senders.repository";

const createSenderSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  displayName: z.string().trim().min(1).max(255),
});

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const senders = await sendersRepository.findActiveSenders(req.userId);

  res.json({ senders });
});

router.post("/", async (req, res) => {
  const input = createSenderSchema.parse(req.body);

  const sender = await sendersRepository.createSender(
    req.userId,
    input.email,
    input.displayName,
  );

  res.status(201).json({ sender });
});

export default router;
