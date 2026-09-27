import { emailQueue, sendEmailJobOptions } from "./emailQueue";
import {emailsRepository} from "../modules/emails/emails.repository";

export async function recoverScheduledEmails() {
    const emailsToRecover = await emailsRepository.findEmailsToRecover();

    let recoveredCount = 0;

    for(const email of emailsToRecover) {
        const jobId = `email-${email.id}`;
        const existingJob = await emailQueue.getJob(jobId);

        if(existingJob) {
            continue;
        }

        const delay = Math.max(0, email.scheduledAt.getTime() - Date.now());

        await emailQueue.add("send-email", {
            emailId: email.id,
        }, {
            ...sendEmailJobOptions,
            jobId,
            delay,
        })

        if(!email.bullJobId) {
            await emailsRepository.updateBullJobId(email.id, jobId);
        }

        recoveredCount++;
    }

    console.log(`Recovery: ${emailsToRecover.length} pending emails, ${recoveredCount} missing jobs recreated.`);
}
