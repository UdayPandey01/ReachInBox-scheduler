import crypto from "crypto";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../config/db";
import { campaignAttachments, campaigns, emailEvents, emails, senders } from "../../db/schema";
import type { ScheduleEmailInput } from "./emails.schema";
import type { EmailEventType, EmailStatus } from "../../db/schema";

export class EmailsRepository {
    async createScheduledEmail(input: ScheduleEmailInput, userId: string) {
        return db.transaction(async (tx) => {
        const [campaign] = await tx
            .insert(campaigns)
            .values({
            userId: userId,
            senderId: input.senderId,
            subject: input.subject,
            body: input.body,
            startTime: input.scheduledAt,
            delayMs: input.delayMs,
            hourlyLimit: input.hourlyLimit,
            status: "scheduled",
            totalEmails: input.recipients.length,
            scheduledEmails: input.recipients.length,
            })
            .returning();

        const emailValues = input.recipients.map((recipient, index) => {
            const id = crypto.randomUUID();

            return {
            id,
            bullJobId: `email-${id}`,
            campaignId: campaign.id,
            senderId: input.senderId,
            recipient: recipient,
            subject: input.subject,
            body: input.body,
            scheduledAt: new Date(
            input.scheduledAt.getTime() + index * input.delayMs,
            ),

            status: "scheduled" as const,
            };
        });

        const emailsInserted = await tx
            .insert(emails)
            .values(emailValues)
            .returning();

        if (input.attachments.length > 0) {
            await tx.insert(campaignAttachments).values(
                input.attachments.map((attachment) => ({
                ...attachment,
                campaignId: campaign.id,
                })),
            );
        }

        await tx.insert(emailEvents).values(
            emailsInserted.map((email) => ({
            emailId: email.id,
            eventType: "scheduled" as const,
            message: "Email scheduled",
            })),
        );

        return {
            campaign,
            emails: emailsInserted,
        };
        });
    }

    async updateBullJobId(emailId: string, bullJobId: string) {
        const [email] = await db
        .update(emails)
        .set({
            bullJobId: bullJobId,
            updatedAt: new Date(),
        })
        .where(eq(emails.id, emailId))
        .returning();

        return email;
    }

    async findEmailById(emailId: string) {
        const [email] = await db
        .select()
        .from(emails)
        .where(eq(emails.id, emailId));

        return email;
    }

    async markEmailProcessing(emailId: string) {
        const [email] = await db
        .update(emails)
        .set({
            status: "processing",
            updatedAt: new Date(),
        })
        .where(eq(emails.id, emailId))
        .returning();

        return email;
    }

    async markEmailSent(emailId: string, messageId: string) {
        const [email] = await db
        .update(emails)
        .set({
            status: "sent",
            sentAt: new Date(),
            messageId: messageId,
            updatedAt: new Date(),
        })
        .where(eq(emails.id, emailId))
        .returning();

        return email;
    }

    async findSenderById(senderId: string) {
        const [sender] = await db
        .select()
        .from(senders)
        .where(eq(senders.id, senderId))
        .limit(1);

        return sender;
    }

    async createEmailEvent(
        emailId: string,
        eventType: EmailEventType,
        message?: string,
        metadata?: Record<string, unknown>,
    ) {
        const [event] = await db
        .insert(emailEvents)
        .values({
            emailId,
            eventType,
            message,
            metadata,
        })
        .returning();

        return event;
    }

    async markEmailFailed(emailId: string, errorMessage: string) {
        const [email] = await db
        .update(emails)
        .set({
            status: "failed",
            error: errorMessage,
            updatedAt: new Date(),
        })
        .where(eq(emails.id, emailId))
        .returning();

        return email;
    }

    async updateEmailAttempts(emailId: string, attempts: number) {
        const [email] = await db
        .update(emails)
        .set({
            attempts,
            updatedAt: new Date(),
        })
        .where(eq(emails.id, emailId))
        .returning();

        return email;
    }

    async findCampaignById(campaignId: string) {
        const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, campaignId))
        .limit(1);

        return campaign;
    }

    async markEmailRescheduled(emailId: string, retryAt: Date) {
        const [email] = await db
            .update(emails)
            .set({
            scheduledAt: retryAt,
            rescheduleCount: sql`${emails.rescheduleCount} + 1`,
            lastRescheduledAt: new Date(),
            updatedAt: new Date(),
            })
            .where(eq(emails.id, emailId))
            .returning();

        return email;
    }

    async incrementCampaignSent(campaignId: string) {
        const [campaign] = await db
            .update(campaigns)
            .set({
            sentEmails: sql`${campaigns.sentEmails} + 1`,
            updatedAt: new Date(),
            })
            .where(eq(campaigns.id, campaignId))
            .returning();

        return campaign;
    }

    async incrementCampaignFailed(campaignId: string) {
        const [campaign] = await db
            .update(campaigns)
            .set({
            failedEmails: sql`${campaigns.failedEmails} + 1`,
            updatedAt: new Date(),
            })
            .where(eq(campaigns.id, campaignId))
            .returning();

        return campaign;
    }

    async markCampaignRunning(campaignId: string) {
        const [campaign] = await db
            .update(campaigns)
            .set({
            status: "running",
            updatedAt: new Date(),
            })
            .where(eq(campaigns.id, campaignId))
            .returning();

        return campaign;
    }

    async completeCampaignIfFinished(campaignId: string) {
        const [campaign] = await db
            .select()
            .from(campaigns)
            .where(eq(campaigns.id, campaignId))
            .limit(1);

        if (!campaign) {
            return null;
        }

        const finishedEmails = campaign.sentEmails + campaign.failedEmails;

        if (finishedEmails >= campaign.totalEmails && campaign.status !== "completed"){
            const [completedCampaign] = await db
            .update(campaigns)
            .set({
                status: "completed",
                updatedAt: new Date(),
            })
            .where(eq(campaigns.id, campaignId))
            .returning();

            return completedCampaign;
        }

        return campaign;
    }

    async findEmailsToRecover() {
        return db
            .select()
            .from(emails)
            .where(inArray(emails.status, ["scheduled", "processing"]));
    }

    async listUserEmails(
        userId: string,
        statuses: EmailStatus[],
        page: number,
        limit: number,
    ) {
        const where = and(
            eq(campaigns.userId, userId),
            inArray(emails.status, statuses),
        );

        const isSentList = statuses.includes("sent");

        const [items, [{ total }]] = await Promise.all([
            db
            .select({
            id: emails.id,
            recipient: emails.recipient,
            subject: emails.subject,
            bodyPreview: sql<string>`left(${emails.body}, 200)`,
            status: emails.status,
            scheduledAt: emails.scheduledAt,
            sentAt: emails.sentAt,
            error: emails.error,
            })
            .from(emails)
            .innerJoin(campaigns, eq(emails.campaignId, campaigns.id))
            .where(where)
            .orderBy(
            isSentList
                ? desc(sql`coalesce(${emails.sentAt}, ${emails.updatedAt})`)
                : asc(emails.scheduledAt),
            )
            .limit(limit)
            .offset((page - 1) * limit),
            db
            .select({ total: count() })
            .from(emails)
            .innerJoin(campaigns, eq(emails.campaignId, campaigns.id))
            .where(where),
        ]);

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findUserEmail(userId: string, emailId: string) {
        const [email] = await db
            .select({
            id: emails.id,
            recipient: emails.recipient,
            subject: emails.subject,
            body: emails.body,
            status: emails.status,
            scheduledAt: emails.scheduledAt,
            sentAt: emails.sentAt,
            error: emails.error,
            campaignId: emails.campaignId,
            senderName: senders.displayName,
            senderEmail: senders.email,
            })
            .from(emails)
            .innerJoin(campaigns, eq(emails.campaignId, campaigns.id))
            .innerJoin(senders, eq(emails.senderId, senders.id))
            .where(and(eq(emails.id, emailId), eq(campaigns.userId, userId)))
            .limit(1);

        if (!email) {
            return undefined;
        }

        const [sentEvent] = await db
            .select({ metadata: emailEvents.metadata })
            .from(emailEvents)
            .where(and(eq(emailEvents.emailId, emailId), eq(emailEvents.eventType, "sent")))
            .limit(1);

        const metadata = sentEvent?.metadata as { previewUrl?: string } | null | undefined;

        const attachments = await db
            .select({
            id: campaignAttachments.id,
            filename: campaignAttachments.filename,
            contentType: campaignAttachments.contentType,
            size: campaignAttachments.size,
            })
            .from(campaignAttachments)
            .where(eq(campaignAttachments.campaignId, email.campaignId))
            .orderBy(asc(campaignAttachments.createdAt));

        return { ...email, previewUrl: metadata?.previewUrl ?? null, attachments };
    }

    async findCampaignAttachments(campaignId: string) {
        return db
            .select({
            filename: campaignAttachments.filename,
            contentType: campaignAttachments.contentType,
            content: campaignAttachments.content,
            })
            .from(campaignAttachments)
            .where(eq(campaignAttachments.campaignId, campaignId))
            .orderBy(asc(campaignAttachments.createdAt));
    }

    async findAttachment(campaignId: string, attachmentId: string) {
        const [attachment] = await db
            .select()
            .from(campaignAttachments)
            .where(
            and(
                eq(campaignAttachments.id, attachmentId),
                eq(campaignAttachments.campaignId, campaignId),
            ),
            )
            .limit(1);

        return attachment;
    }

    async findAllEmailsForSearchIndex() {
        return db
            .select({
            id: emails.id,
            userId: campaigns.userId,
            campaignId: emails.campaignId,
            senderId: emails.senderId,
            recipient: emails.recipient,
            subject: emails.subject,
            body: emails.body,
            status: emails.status,
            scheduledAt: emails.scheduledAt,
            sentAt: emails.sentAt,
            createdAt: emails.createdAt,
            })
            .from(emails)
            .innerJoin(campaigns, eq(emails.campaignId, campaigns.id));
    }
}

export const emailsRepository = new EmailsRepository();
