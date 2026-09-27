import { db } from "../../config/db";
import { slackConnections } from "../../db/schema";
import { and, eq } from "drizzle-orm";

export class SlackRepository {
  async upsertConnection(input: {
    userId: string;
    teamId: string;
    teamName?: string;
    accessToken: string;
  }) {
    const existing = await db
      .select()
      .from(slackConnections)
      .where(
        and(
          eq(slackConnections.userId, input.userId),
          eq(slackConnections.teamId, input.teamId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(slackConnections)
        .set({
          teamName: input.teamName,
          accessToken: input.accessToken,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(slackConnections.id, existing[0].id))
        .returning();

      return updated;
    }

    const [created] = await db
      .insert(slackConnections)
      .values({
        userId: input.userId,
        teamId: input.teamId,
        teamName: input.teamName,
        accessToken: input.accessToken,
        isActive: true,
      })
      .returning();

    return created;
  }

  async findActiveConnection(userId: string) {
    const [connection] = await db
      .select()
      .from(slackConnections)
      .where(
        and(
          eq(slackConnections.userId, userId),
          eq(slackConnections.isActive, true),
        ),
      )
      .limit(1);

    return connection;
  }

  async updateChannel(
    connectionId: string,
    channelId: string,
    channelName: string,
  ) {
    const [updated] = await db
      .update(slackConnections)
      .set({
        channelId,
        channelName,
        updatedAt: new Date(),
      })
      .where(eq(slackConnections.id, connectionId))
      .returning();

    return updated;
  }

  async disconnect(userId: string) {
    const [updated] = await db
      .update(slackConnections)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(slackConnections.userId, userId),
          eq(slackConnections.isActive, true),
        ),
      )
      .returning();

    return updated;
  }

  async getStatus(userId: string) {
    const [connection] = await db
      .select({
        id: slackConnections.id,
        teamId: slackConnections.teamId,
        teamName: slackConnections.teamName,
        channelId: slackConnections.channelId,
        channelName: slackConnections.channelName,
        isActive: slackConnections.isActive,
        createdAt: slackConnections.createdAt,
        updatedAt: slackConnections.updatedAt,
      })
      .from(slackConnections)
      .where(
        and(
          eq(slackConnections.userId, userId),
          eq(slackConnections.isActive, true),
        ),
      )
      .limit(1);

    return connection ?? null;
  }
}

export const slackRepository = new SlackRepository();
