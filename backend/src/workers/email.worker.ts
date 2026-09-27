import { Worker, DelayedError } from "bullmq";
import { queueConnection } from "../queue/connection";
import { emailsRepository } from "../modules/emails/emails.repository";
import {getEtherealTransporter} from "../smtp/ethereal";
import nodemailer from "nodemailer";
import {checkAndConsumeRateLimit} from "../queue/rateLimiter";
import { env } from "../config/env";

const worker = new Worker(
  "email-queue",
  async (job) => {
    console.log("Processing job:", job.id);
    console.log("Job data:", job.data);

    const email = await emailsRepository.findEmailById(job.data.emailId);

    if(!email){
        throw new Error(`Email ${job.data.emailId} not found`);
    }

    if (email.status === "sent") {
        console.log("Email already sent. Skipping.");
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

    if (!rateLimit.allowed) {
        console.log(`Rate limit reached for campaign ${campaign.id}.`);
        console.log(`Rescheduling job ${job.id} for ${rateLimit.retryAt?.toISOString()}`);

        await emailsRepository.createEmailEvent(
            email.id,
            "rescheduled",
            "Email rescheduled because hourly rate limit was reached",
            {
                retryAt: rateLimit.retryAt?.toISOString(),
                hourlyLimit: campaign.hourlyLimit,
            }
        )

        if (rateLimit.retryAt) {
            await emailsRepository.markEmailRescheduled(
                email.id,
            );

            await job.moveToDelayed(
                rateLimit.retryAt.getTime(),
                job.token,
            );

            throw new DelayedError();
        }

    }


    console.log("Email fetched from database:");
    console.log({
        id: email.id,
        recipient: email.recipient,
        subject: email.subject,
        status: email.status,
    });

    const currentAttempts = email.attempts + 1;

    await emailsRepository.updateEmailAttempts(email.id, currentAttempts);

    const processingEmail = await emailsRepository.markEmailProcessing(email.id);

    await emailsRepository.createEmailEvent(
        email.id,
        "processing",
        `Email processing started - attempt ${currentAttempts}`,
    );

    console.log("Email marked as processing:", {
        id: processingEmail.id,
        status: processingEmail.status,
        attempts: processingEmail.attempts,
    });

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

    const sentEmail = await emailsRepository.markEmailSent(
        email.id,
        info.messageId,
    );

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
        },
    )

    console.log("Email sent:", {
        messageId: info.messageId,
        recipient: sentEmail.recipient,
    });

    console.log("Preview URL:",nodemailer.getTestMessageUrl(info),);
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

            await emailsRepository.incrementCampaignFailed(
                email.campaignId,
            );

            await emailsRepository.completeCampaignIfFinished(
                email.campaignId,
            );

            console.error(
            `Email permanently failed after ${currentAttempt} attempts:`,
            errorMessage,
            );
        } else {
            console.error(
            `Email attempt ${currentAttempt} failed. BullMQ will retry:`,
            errorMessage,
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

worker.on("ready", () => {
  console.log("BullMQ worker is ready");
});

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error);
});

worker.on("error", (error) => {
  console.error("Worker error:", error);
});

console.log("Email worker started");