import { Request, Response } from "express";
import { z } from "zod";
import { emailSearchService } from "./emailSearch.service";

const searchQuerySchema = z.object({
  q: z.string().trim().max(200).default(""),
  status: z.string().default(""),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function searchEmails(req: Request, res: Response) {
  const query = searchQuerySchema.parse(req.query);

  const statuses = query.status.split(",").filter(Boolean);

  const result = await emailSearchService.searchEmails(
    req.userId,
    query.q,
    statuses,
    query.page,
    query.limit,
  );

  res.json({ query: query.q, ...result });
}
