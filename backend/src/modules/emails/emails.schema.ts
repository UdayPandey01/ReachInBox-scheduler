import {z} from "zod";

export const MAX_ATTACHMENTS = 10;
export const MAX_ATTACHMENTS_BYTES = 10 * 1024 * 1024;

const attachmentSchema = z.object({
    filename: z.string().trim().min(1).max(255),
    contentType: z.string().trim().min(1).max(255).default("application/octet-stream"),
    contentBase64: z.base64(),
});

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
    attachments: z
        .array(attachmentSchema)
        .max(MAX_ATTACHMENTS)
        .default([])
        .transform((attachments) =>
            attachments.map((attachment) => {
                const content = Buffer.from(attachment.contentBase64, "base64");

                return {
                    filename: attachment.filename,
                    contentType: attachment.contentType,
                    size: content.length,
                    content,
                };
            }),
        )
        .refine(
            (attachments) =>
                attachments.reduce((total, attachment) => total + attachment.size, 0) <= MAX_ATTACHMENTS_BYTES,
            { message: "Attachments must be 10 MB or less in total" },
        ),
});

export type ScheduleEmailInput = z.infer<typeof scheduledEmailSchema>;

export const listEmailsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["scheduled", "processing", "sent", "failed"]).optional(),
});
