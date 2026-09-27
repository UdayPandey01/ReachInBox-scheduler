import type { Request, Response } from "express";
import { z } from "zod";
import type { EmailStatus } from "../../db/schema";
import { HttpError } from "../../middleware/errorHandler";
import { listEmailsQuerySchema, scheduledEmailSchema } from "./emails.schema";
import { emailsService } from "./emails.service";
import { emailsRepository } from "./emails.repository";

export async function scheduleEmail(req: Request, res: Response) {
  const input = scheduledEmailSchema.parse(req.body);

  const result = await emailsService.scheduleEmail(input, req.userId);

  res.status(201).json(result);
}

async function listEmails(req: Request, res: Response, tabStatuses: EmailStatus[]) {
  const query = listEmailsQuerySchema.parse(req.query);

  const statuses =
    query.status && tabStatuses.includes(query.status) ? [query.status] : tabStatuses;

  const result = await emailsRepository.listUserEmails(
    req.userId,
    statuses,
    query.page,
    query.limit,
  );

  res.json(result);
}

export function listScheduledEmails(req: Request, res: Response) {
  return listEmails(req, res, ["scheduled", "processing"]);
}

export function listSentEmails(req: Request, res: Response) {
  return listEmails(req, res, ["sent", "failed"]);
}

export async function getEmail(req: Request, res: Response) {
  const emailId = z.uuid().parse(req.params.id);

  const email = await emailsRepository.findUserEmail(req.userId, emailId);

  if (!email) {
    throw new HttpError(404, "Email not found");
  }

  res.json({ email });
}
