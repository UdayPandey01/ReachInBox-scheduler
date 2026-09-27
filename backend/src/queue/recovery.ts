import { emailQueue } from "./emailQueue";
import {emailsRepository} from "../modules/emails/emails.repository";

export async function recoverScheduledEmails() {
    const scheduledEmails = await emailsRepository.findScheduledEmails();

    console.log(`Found ${scheduledEmails.length} scheduled emails to recover.`);

    for(const email of scheduledEmails) {
        const jobId = email.bullJobId || `email-${email.id}`;
        const existingJob = await emailQueue.getJob(jobId);

        if(existingJob) {
            console.log(`Job for scheduled email ${email.id} already exists with jobId ${jobId}. Skipping recovery.`);
            continue;
        }

        const delay = Math.max(0, email.scheduledAt.getTime() - Date.now());
        await emailQueue.add("send-email", {
            emailId: email.id,
        }, {
            jobId,
            delay,
            attempts: 3,
            backoff: {
                type: "exponential",
                delay: 5000,
            },
        })

        if(!email.bullJobId) {
            await emailsRepository.updateBullJobId(email.id, jobId);

            console.log(`Recovered scheduled email ${email.id} with jobId ${jobId} and delay ${delay}ms.`);
        }
    }
}