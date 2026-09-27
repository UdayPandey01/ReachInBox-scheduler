CREATE TABLE "campaign_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"content_type" varchar(255) NOT NULL,
	"size" integer NOT NULL,
	"content" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_attachments" ADD CONSTRAINT "campaign_attachments_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_attachments_campaign_idx" ON "campaign_attachments" USING btree ("campaign_id");