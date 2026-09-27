import type { ScheduleEmailInput } from "./emails.schema";
import { emailsRepository } from "./emails.repository";
import { emailQueue } from "../../queue/emailQueue";

export class EmailsService {
  async scheduleEmail(
    input: ScheduleEmailInput,
    userId: string,
  ) {
    const result =
      await emailsRepository.createScheduledEmail(
        input,
        userId,
      );

    for (const email of result.emails) {
      const delay = Math.max(
        0,
        email.scheduledAt.getTime() - Date.now(),
      );

      const jobId = `email-${email.id}`;

      await emailQueue.add(
        "send-email",
        {
          emailId: email.id,
        },
        {
          jobId,
          delay,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        },
      );

      await emailsRepository.updateBullJobId(
        email.id,
        jobId,
      );
    }

    return result;
  }
}

export const emailsService = new EmailsService();