import type { Request, Response } from "express";
import { z } from "zod";
import type { EmailStatus } from "../../db/schema";
import { HttpError } from "../../middleware/errorHandler";
import { listEmailsQuerySchema, scheduledEmailSchema } from "./emails.schema";
import { emailsService } from "./emails.service";
import { emailsRepository } from "./emails.repository";

const INLINE_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

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

export async function downloadAttachment(req: Request, res: Response) {
  const emailId = z.uuid().parse(req.params.id);
  const attachmentId = z.uuid().parse(req.params.attachmentId);

  const email = await emailsRepository.findUserEmail(req.userId, emailId);

  if (!email) {
    throw new HttpError(404, "Email not found");
  }

  const attachment = await emailsRepository.findAttachment(email.campaignId, attachmentId);

  if (!attachment) {
    throw new HttpError(404, "Attachment not found");
  }

  const showInline = INLINE_CONTENT_TYPES.has(attachment.contentType);

  res.setHeader("Content-Type", showInline ? attachment.contentType : "application/octet-stream");
  res.setHeader("Content-Length", attachment.size);
  res.setHeader(
    "Content-Disposition",
    `${showInline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.send(attachment.content);
}
