CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'scheduled', 'running', 'completed', 'canceled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."email_event_type" AS ENUM('scheduled', 'processing', 'sent', 'failed', 'rescheduled', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('scheduled', 'processing', 'sent', 'failed', 'canceled');--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"subject" varchar(998) NOT NULL,
	"body" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"delay_ms" integer NOT NULL,
	"hourly_limit" integer NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"total_emails" integer DEFAULT 0 NOT NULL,
	"scheduled_emails" integer DEFAULT 0 NOT NULL,
	"sent_emails" integer DEFAULT 0 NOT NULL,
	"failed_emails" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_id" uuid NOT NULL,
	"event_type" "email_event_type" NOT NULL,
	"message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"recipient" varchar(320) NOT NULL,
	"subject" varchar(998) NOT NULL,
	"body" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"status" "email_status" DEFAULT 'scheduled' NOT NULL,
	"bull_job_id" varchar(255),
	"message_id" varchar(500),
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"error" text,
	"reschedule_count" integer DEFAULT 0 NOT NULL,
	"last_rescheduled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "senders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"smtp_host" varchar(255) NOT NULL,
	"smtp_port" integer NOT NULL,
	"smtp_username" varchar(320) NOT NULL,
	"smtp_password" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slack_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"team_name" varchar(255),
	"channel_id" varchar(255),
	"channel_name" varchar(255),
	"access_token" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_id" varchar(255),
	"name" varchar(255) NOT NULL,
	"email" varchar(320) NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_sender_id_senders_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."senders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_sender_id_senders_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."senders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "senders" ADD CONSTRAINT "senders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_connections" ADD CONSTRAINT "slack_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_user_status_idx" ON "campaigns" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "campaigns_start_time_idx" ON "campaigns" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "email_events_email_created_idx" ON "email_events" USING btree ("email_id","created_at");--> statement-breakpoint
CREATE INDEX "email_events_type_idx" ON "email_events" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "emails_bull_job_id_unique" ON "emails" USING btree ("bull_job_id");--> statement-breakpoint
CREATE INDEX "emails_campaign_status_idx" ON "emails" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "emails_sender_scheduled_idx" ON "emails" USING btree ("sender_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "emails_status_scheduled_idx" ON "emails" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "emails_recipient_idx" ON "emails" USING btree ("recipient");--> statement-breakpoint
CREATE INDEX "emails_sent_at_idx" ON "emails" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "senders_user_email_idx" ON "senders" USING btree ("user_id","email");--> statement-breakpoint
CREATE INDEX "senders_active_idx" ON "senders" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "slack_user_team_unique" ON "slack_connections" USING btree ("user_id","team_id");--> statement-breakpoint
CREATE INDEX "slack_user_active_idx" ON "slack_connections" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "users_google_id_unique" ON "users" USING btree ("google_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");