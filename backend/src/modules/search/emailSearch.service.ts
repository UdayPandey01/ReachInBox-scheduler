import { elasticsearch, EMAIL_INDEX } from "../../config/elasticsearch";
import { emailsRepository } from "../emails/emails.repository";

type EmailDocument = {
  id: string;
  userId: string;
  campaignId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date;
  sentAt: Date | null;
  createdAt: Date;
};

type SearchSource = {
  emailId: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
};

export class EmailSearchService {
  async indexEmails(emails: EmailDocument[]) {
    if (emails.length === 0) {
      return;
    }

    const operations = emails.flatMap((email) => [
      { index: { _index: EMAIL_INDEX, _id: email.id } },
      {
        emailId: email.id,
        userId: email.userId,
        campaignId: email.campaignId,
        senderId: email.senderId,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt,
        sentAt: email.sentAt,
        createdAt: email.createdAt,
      },
    ]);

    const response = await elasticsearch.bulk({ operations, refresh: true });

    if (response.errors) {
      throw new Error("Some emails could not be indexed in Elasticsearch");
    }
  }

  async reindexAllEmails() {
    const emails = await emailsRepository.findAllEmailsForSearchIndex();

    for (let start = 0; start < emails.length; start += 1000) {
      await this.indexEmails(emails.slice(start, start + 1000));
    }

    console.log(`Indexed ${emails.length} emails from PostgreSQL into Elasticsearch.`);
  }

  async updateEmail(email: {
    id: string;
    status: string;
    scheduledAt?: Date;
    sentAt?: Date | null;
  }) {
    try {
      await elasticsearch.update({
        index: EMAIL_INDEX,
        id: email.id,
        doc: {
          status: email.status,
          scheduledAt: email.scheduledAt,
          sentAt: email.sentAt,
        },
        refresh: true,
      });
    } catch (error) {
      console.error(`Failed to update email ${email.id} in Elasticsearch:`, error);
    }
  }

  async searchEmails(
    userId: string,
    query: string,
    statuses: string[],
    page: number,
    limit: number,
  ) {
    const filter: object[] = [{ term: { userId } }];

    if (statuses.length > 0) {
      filter.push({ terms: { status: statuses } });
    }

    const must = query
      ? [
          {
            multi_match: {
              query,
              type: "bool_prefix" as const,
              fields: ["recipient", "subject", "body"],
            },
          },
        ]
      : [];

    const response = await elasticsearch.search<SearchSource>({
      index: EMAIL_INDEX,
      from: (page - 1) * limit,
      size: limit,
      query: { bool: { filter, must } },
      sort: query ? ["_score"] : [{ scheduledAt: "desc" }],
    });

    const total =
      typeof response.hits.total === "number"
        ? response.hits.total
        : (response.hits.total?.value ?? 0);

    return {
      items: response.hits.hits.flatMap((hit) =>
        hit._source
          ? [
              {
                id: hit._source.emailId,
                recipient: hit._source.recipient,
                subject: hit._source.subject,
                bodyPreview: hit._source.body.slice(0, 200),
                status: hit._source.status,
                scheduledAt: hit._source.scheduledAt,
                sentAt: hit._source.sentAt,
              },
            ]
          : [],
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const emailSearchService = new EmailSearchService();
