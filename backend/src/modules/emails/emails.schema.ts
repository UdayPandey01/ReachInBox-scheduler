import {z} from "zod";

export const scheduledEmailSchema = z.object({
    recipients: z
        .array(z.string().trim().toLowerCase().pipe(z.email()))
        .min(1)
        .max(5000)
        .transform((recipients) => [...new Set(recipients)]),
    subject: z.string().trim().min(1).max(998),
    body: z.string().min(1),
    scheduledAt: z.coerce.date(),
    senderId: z.uuid(),
    delayMs: z.number().int().min(0).max(24 * 60 * 60 * 1000).default(0),
    hourlyLimit: z.number().int().min(1).max(10000).default(100),
});

export type ScheduleEmailInput = z.infer<typeof scheduledEmailSchema>;

export const listEmailsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["scheduled", "processing", "sent", "failed"]).optional(),
});
