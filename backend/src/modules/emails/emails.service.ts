import type { ScheduleEmailInput } from "./emails.schema";
import { emailsRepository } from "./emails.repository";
import { emailQueue, sendEmailJobOptions } from "../../queue/emailQueue";
import { emailSearchService } from "../search/emailSearch.service";
import { sendersRepository } from "../senders/senders.repository";
import { HttpError } from "../../middleware/errorHandler";

export class EmailsService {
  async scheduleEmail(input: ScheduleEmailInput, userId: string) {
    const sender = await sendersRepository.findUserSender(userId, input.senderId);

    if (!sender) {
      throw new HttpError(404, "Sender not found");
    }

    const result = await emailsRepository.createScheduledEmail(input, userId);

    await emailQueue.addBulk(
      result.emails.map((email) => ({
        name: "send-email",
        data: { emailId: email.id },
        opts: {
          ...sendEmailJobOptions,
          jobId: `email-${email.id}`,
          delay: Math.max(0, email.scheduledAt.getTime() - Date.now()),
        },
      })),
    );

    try {
      await emailSearchService.indexEmails(
        result.emails.map((email) => ({ ...email, userId })),
      );
    } catch (error) {
      console.error("Failed to index scheduled emails in Elasticsearch:", error);
    }

    return {
      campaignId: result.campaign.id,
      totalEmails: result.emails.length,
      emails: result.emails.map((email) => ({
        id: email.id,
        recipient: email.recipient,
        status: email.status,
        scheduledAt: email.scheduledAt,
        bullJobId: email.bullJobId,
      })),
    };
  }
}

export const emailsService = new EmailsService();
