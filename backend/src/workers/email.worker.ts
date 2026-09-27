import { Worker, DelayedError } from "bullmq";
import { queueConnection } from "../queue/connection";
import { emailsRepository } from "../modules/emails/emails.repository";
import {getEtherealTransporter} from "../smtp/ethereal";
import nodemailer from "nodemailer";
import {checkAndConsumeRateLimit} from "../queue/rateLimiter";
import { env } from "../config/env";
import { slackRepository } from "../modules/slack/slack.repository";
import { slackService } from "../modules/slack/slack.service";
import { emailSearchService } from "../modules/search/emailSearch.service";

async function notifySlackAboutRateLimit(
    userId: string,
    data: { campaignId: string; hourlyLimit: number; sentThisHour: number; retryAt: Date },
) {
    try {
        const slackConnection = await slackRepository.findActiveConnection(userId);

        if (!slackConnection?.channelId) {
            return;
        }

        await slackService.sendRateLimitNotification(
            slackConnection.accessToken,
            slackConnection.channelId,
            data,
        );
    } catch (error) {
        console.error("Failed to send Slack rate-limit notification:", error);
    }
}

const worker = new Worker(
  "email-queue",
  async (job) => {
    const email = await emailsRepository.findEmailById(job.data.emailId);

    if(!email){
        throw new Error(`Email ${job.data.emailId} not found`);
    }

    if (email.status === "sent") {
        return;
    }

    const campaign = await emailsRepository.findCampaignById(email.campaignId);

    if(!campaign){
        throw new Error(`Campaign ${email.campaignId} not found`);
    }

    if (campaign.status === "scheduled") {
        await emailsRepository.markCampaignRunning(
            campaign.id,
        );
    }

    const rateLimit = await checkAndConsumeRateLimit(campaign.id, campaign.hourlyLimit);

    if (!rateLimit.allowed && rateLimit.retryAt) {
        const retryAt = rateLimit.retryAt;

        await emailsRepository.createEmailEvent(
            email.id,
            "rescheduled",
            "Email rescheduled because hourly rate limit was reached",
            {
                retryAt: retryAt.toISOString(),
                hourlyLimit: campaign.hourlyLimit,
            }
        )

        await notifySlackAboutRateLimit(campaign.userId, {
            campaignId: campaign.id,
            hourlyLimit: campaign.hourlyLimit,
            sentThisHour: rateLimit.count,
            retryAt,
        });

        await emailsRepository.markEmailRescheduled(email.id, retryAt);

        await emailSearchService.updateEmail({
            id: email.id,
            status: email.status,
            scheduledAt: retryAt,
        });

        await job.moveToDelayed(retryAt.getTime(), job.token);

        throw new DelayedError();
    }

    const currentAttempts = email.attempts + 1;

    await emailsRepository.updateEmailAttempts(email.id, currentAttempts);

    await emailsRepository.markEmailProcessing(email.id);

    await emailsRepository.createEmailEvent(
        email.id,
        "processing",
        `Email processing started - attempt ${currentAttempts}`,
    );

    const sender = await emailsRepository.findSenderById(
        email.senderId,
    );

    if (!sender) {
        throw new Error(
            `Sender ${email.senderId} not found`,
        );
    }

    try{
    const transporter = await getEtherealTransporter();

    const info = await transporter.sendMail({
        from: `"${sender.displayName}" <${sender.email}>`,
        to: email.recipient,
        subject: email.subject,
        text: email.body,
    })

    const previewUrl = nodemailer.getTestMessageUrl(info) || null;

    const sentEmail = await emailsRepository.markEmailSent(
        email.id,
        info.messageId,
    );

    await emailSearchService.updateEmail({
        id: sentEmail.id,
        status: sentEmail.status,
        sentAt: sentEmail.sentAt,
    });

    await emailsRepository.incrementCampaignSent(
        email.campaignId,
    );

    await emailsRepository.completeCampaignIfFinished(
        email.campaignId,
    );

    await emailsRepository.createEmailEvent(
        email.id,
        "sent",
        "Email sent successfully",
        {
            messageId: info.messageId,
            previewUrl,
        },
    )

    console.log(`Email ${email.id} sent to ${email.recipient}. Preview: ${previewUrl}`);
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : String(error);

        const maxAttempts = job.opts.attempts ?? 1;
        const currentAttempt = job.attemptsMade + 1;
        const isFinalAttempt = currentAttempt >= maxAttempts;

        await emailsRepository.createEmailEvent(
            email.id,
            "failed",
            `Email sending failed on attempt ${currentAttempt}`,
            {
            error: errorMessage,
            attempt: currentAttempt,
            },
        );

        if (isFinalAttempt) {
            await emailsRepository.markEmailFailed(
            email.id,
            errorMessage,
            );

            await emailSearchService.updateEmail({
                id: email.id,
                status: "failed",
            });

            await emailsRepository.incrementCampaignFailed(
                email.campaignId,
            );

            await emailsRepository.completeCampaignIfFinished(
                email.campaignId,
            );
        }

        throw error;
    }
  },
  {
    connection: queueConnection,
    concurrency: env.WORKER_CONCURRENCY,
  },
);

worker.on("failed", (job, error) => {
  if (error instanceof DelayedError) {
    return;
  }

  console.error(`Job ${job?.id} failed:`, error.message);
});

worker.on("error", (error) => {
  console.error("Worker error:", error);
});
