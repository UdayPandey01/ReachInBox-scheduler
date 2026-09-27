import {z} from "zod";

export const scheduledEmailSchema = z.object({
    recipients: z.array(z.string().email()).min(1),
    subject: z.string().min(1).max(998),
    body: z.string().min(1),
    scheduledAt: z.coerce.date(),
    senderId: z.string().uuid(),
    delayMs: z.number().int().min(0).default(0),
    hourlyLimit: z.number().int().min(1).default(100),
});

export type ScheduleEmailInput = z.infer<typeof scheduledEmailSchema>;