import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  varchar,
  pgEnum,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "running",
  "completed",
  "canceled",
  "failed",
]);

export const emailStatusEnum = pgEnum("email_status", [
  "scheduled",
  "processing",
  "sent",
  "failed",
  "canceled",
]);

export const emailEventTypeEnum = pgEnum("email_event_type", [
  "scheduled",
  "processing",
  "sent",
  "failed",
  "rescheduled",
  "canceled",
]);

export type EmailStatus = (typeof emailStatusEnum.enumValues)[number];

export type EmailEventType =
  (typeof emailEventTypeEnum.enumValues)[number];

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    googleId: varchar("google_id", { length: 255 }),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    googleIdUnique: uniqueIndex("users_google_id_unique").on(table.googleId),
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
  }),
);

export const senders = pgTable(
  "senders",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    email: varchar("email", { length: 320 }).notNull(),

    displayName: varchar("display_name", { length: 255 }).notNull(),

    smtpHost: varchar("smtp_host", { length: 255 }).notNull(),

    smtpPort: integer("smtp_port").notNull(),

    smtpUsername: varchar("smtp_username", { length: 320 }).notNull(),

    smtpPassword: text("smtp_password").notNull(),

    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userEmailIndex: index("senders_user_email_idx").on(
      table.userId,
      table.email,
    ),

    activeIndex: index("senders_active_idx").on(table.isActive),
  }),
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    senderId: uuid("sender_id")
      .notNull()
      .references(() => senders.id, {
        onDelete: "restrict",
      }),

    subject: varchar("subject", {
      length: 998,
    }).notNull(),

    body: text("body").notNull(),

    startTime: timestamp("start_time", {
      withTimezone: true,
    }).notNull(),

    delayMs: integer("delay_ms").notNull(),

    hourlyLimit: integer("hourly_limit").notNull(),

    status: campaignStatusEnum("status")
      .default("draft")
      .notNull(),

    totalEmails: integer("total_emails")
      .default(0)
      .notNull(),

    scheduledEmails: integer("scheduled_emails")
      .default(0)
      .notNull(),

    sentEmails: integer("sent_emails")
      .default(0)
      .notNull(),

    failedEmails: integer("failed_emails")
      .default(0)
      .notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userStatusIndex: index("campaigns_user_status_idx").on(
      table.userId,
      table.status,
    ),

    startTimeIndex: index("campaigns_start_time_idx").on(
      table.startTime,
    ),
  }),
);

export const emails = pgTable(
  "emails",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, {
        onDelete: "cascade",
      }),

    senderId: uuid("sender_id")
      .notNull()
      .references(() => senders.id, {
        onDelete: "restrict",
      }),

    recipient: varchar("recipient", {
      length: 320,
    }).notNull(),

    subject: varchar("subject", {
      length: 998,
    }).notNull(),

    body: text("body").notNull(),

    scheduledAt: timestamp("scheduled_at", {
      withTimezone: true,
    }).notNull(),

    sentAt: timestamp("sent_at", {
      withTimezone: true,
    }),

    status: emailStatusEnum("status")
      .default("scheduled")
      .notNull(),

    bullJobId: varchar("bull_job_id", {
      length: 255,
    }),

    messageId: varchar("message_id", {
      length: 500,
    }),

    attempts: integer("attempts")
      .default(0)
      .notNull(),

    maxAttempts: integer("max_attempts")
      .default(3)
      .notNull(),

    error: text("error"),

    rescheduleCount: integer("reschedule_count")
      .default(0)
      .notNull(),

    lastRescheduledAt: timestamp("last_rescheduled_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    bullJobUnique: uniqueIndex("emails_bull_job_id_unique").on(
      table.bullJobId,
    ),

    campaignStatusIndex: index(
      "emails_campaign_status_idx",
    ).on(
      table.campaignId,
      table.status,
    ),

    senderScheduledIndex: index(
      "emails_sender_scheduled_idx",
    ).on(
      table.senderId,
      table.scheduledAt,
    ),

    statusScheduledIndex: index(
      "emails_status_scheduled_idx",
    ).on(
      table.status,
      table.scheduledAt,
    ),

    recipientIndex: index(
      "emails_recipient_idx",
    ).on(
      table.recipient,
    ),

    sentAtIndex: index(
      "emails_sent_at_idx",
    ).on(
      table.sentAt,
    ),
  }),
);

export const emailEvents = pgTable(
  "email_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    emailId: uuid("email_id")
      .notNull()
      .references(() => emails.id, {
        onDelete: "cascade",
      }),

    eventType: emailEventTypeEnum("event_type")
      .notNull(),

    message: text("message"),

    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    emailCreatedIndex: index(
      "email_events_email_created_idx",
    ).on(
      table.emailId,
      table.createdAt,
    ),

    eventTypeIndex: index(
      "email_events_type_idx",
    ).on(
      table.eventType,
    ),
  }),
);

export const slackConnections = pgTable(
  "slack_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    teamId: varchar("team_id", {
      length: 255,
    }).notNull(),

    teamName: varchar("team_name", {
      length: 255,
    }),

    channelId: varchar("channel_id", {
      length: 255,
    }),

    channelName: varchar("channel_name", {
      length: 255,
    }),

    accessToken: text("access_token").notNull(),

    isActive: boolean("is_active")
      .default(true)
      .notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userTeamUnique: uniqueIndex(
      "slack_user_team_unique",
    ).on(
      table.userId,
      table.teamId,
    ),

    userActiveIndex: index(
      "slack_user_active_idx",
    ).on(
      table.userId,
      table.isActive,
    ),
  }),
);