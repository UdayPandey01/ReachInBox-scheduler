import { WebClient } from "@slack/web-api";
import { env } from "../../config/env";

export class SlackService {
  getAuthorizationUrl(state: string) {
    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      scope: "chat:write",
      redirect_uri: env.SLACK_REDIRECT_URI,
      state,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string) {
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: env.SLACK_CLIENT_ID,
        client_secret: env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: env.SLACK_REDIRECT_URI,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error ?? "Slack OAuth failed");
    }

    return data;
  }

  async sendMessage(accessToken: string, channelId: string, text: string) {
    const client = new WebClient(accessToken);

    const response = await client.chat.postMessage({
      channel: channelId,
      text,
    });

    if (!response.ok) {
      throw new Error(response.error ?? "Failed to send Slack message");
    }

    return response;
  }

  async sendRateLimitNotification(
    accessToken: string,
    channelId: string,
    data: {
      campaignId: string;
      hourlyLimit: number;
      sentThisHour: number;
      retryAt: Date;
    },
  ) {
    const text = [
      "Email rate limit reached",
      "",
      `Campaign: ${data.campaignId}`,
      `Hourly limit: ${data.hourlyLimit}`,
      `Emails sent this hour: ${data.sentThisHour}`,
      `Next attempt: ${data.retryAt.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      })}`,
    ].join("\n");

    return this.sendMessage(accessToken, channelId, text);
  }
}

export const slackService = new SlackService();
