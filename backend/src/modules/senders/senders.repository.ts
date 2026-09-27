import { and, asc, eq } from "drizzle-orm";
import { db } from "../../config/db";
import { senders } from "../../db/schema";

const etherealSmtp = {
  smtpHost: "smtp.ethereal.email",
  smtpPort: 587,
  smtpUsername: "ethereal",
  smtpPassword: "ethereal",
};

export class SendersRepository {
  async findActiveSenders(userId: string) {
    return db
      .select({
        id: senders.id,
        email: senders.email,
        displayName: senders.displayName,
      })
      .from(senders)
      .where(and(eq(senders.userId, userId), eq(senders.isActive, true)))
      .orderBy(asc(senders.createdAt));
  }

  async findUserSender(userId: string, senderId: string) {
    const [sender] = await db
      .select()
      .from(senders)
      .where(
        and(
          eq(senders.id, senderId),
          eq(senders.userId, userId),
          eq(senders.isActive, true),
        ),
      )
      .limit(1);

    return sender;
  }

  async createSender(userId: string, email: string, displayName: string) {
    const [sender] = await db
      .insert(senders)
      .values({ userId, email, displayName, ...etherealSmtp })
      .returning({
        id: senders.id,
        email: senders.email,
        displayName: senders.displayName,
      });

    return sender;
  }

  async ensureDefaultSender(userId: string, email: string, displayName: string) {
    const existing = await this.findActiveSenders(userId);

    if (existing.length === 0) {
      await this.createSender(userId, email, displayName);
    }
  }
}

export const sendersRepository = new SendersRepository();
