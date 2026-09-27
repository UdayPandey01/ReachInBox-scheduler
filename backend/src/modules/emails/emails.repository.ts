import { db } from "../../config/db";
import { campaigns, emailEvents, emails, senders } from "../../db/schema";
import type { ScheduleEmailInput } from "./emails.schema";
import { eq, sql } from "drizzle-orm";
import type { EmailEventType } from "../../db/schema";

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

        const emailValues = input.recipients.map((recipient, index) => ({
            campaignId: campaign.id,
            senderId: input.senderId,
            recipient: recipient,
            subject: input.subject,
            body: input.body,
            scheduledAt: new Date(
            input.scheduledAt.getTime() + index * input.delayMs,
            ),

            status: "scheduled" as const,
        }));

        const emailsInserted = await tx
            .insert(emails)
            .values(emailValues)
            .returning();

        for (const email of emailsInserted) {
            await tx.insert(emailEvents).values({
            emailId: email.id,
            eventType: "scheduled",
            message: "Email scheduled",
            });
        }

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

    async markEmailRescheduled(emailId: string) {
        const [email] = await db
            .update(emails)
            .set({
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

    async markCampaignCompleted(campaignId: string) {
        const [campaign] = await db
            .update(campaigns)
            .set({
            status: "completed",
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

    async findScheduledEmails() {
        return db
            .select()
            .from(emails)
            .where(eq(emails.status, "scheduled"));
    }
}

export const emailsRepository = new EmailsRepository();
