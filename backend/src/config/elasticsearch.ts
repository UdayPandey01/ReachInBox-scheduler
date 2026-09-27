import { Client } from "@elastic/elasticsearch";
import { env } from "./env";

export const elasticsearch = new Client({
  node: env.ELASTICSEARCH_URL,
});

export const EMAIL_INDEX = "emails";

export async function createEmailIndex() {
  const exists = await elasticsearch.indices.exists({
    index: EMAIL_INDEX,
  });

  if (exists) {
    return false;
  }

  await elasticsearch.indices.create({
    index: EMAIL_INDEX,
    mappings: {
      properties: {
        emailId: { type: "keyword" },
        userId: { type: "keyword" },
        campaignId: { type: "keyword" },
        senderId: { type: "keyword" },
        recipient: { type: "text", fields: { keyword: { type: "keyword" } } },
        subject: { type: "text" },
        body: { type: "text" },
        status: { type: "keyword" },
        scheduledAt: { type: "date" },
        sentAt: { type: "date" },
        createdAt: { type: "date" },
      },
    },
  });

  console.log(`Elasticsearch index "${EMAIL_INDEX}" created.`);

  return true;
}
