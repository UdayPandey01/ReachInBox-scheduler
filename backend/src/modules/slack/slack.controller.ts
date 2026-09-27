import { Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";

import { env, isProduction } from "../../config/env";
import { HttpError } from "../../middleware/errorHandler";
import { slackService } from "./slack.service";
import { slackRepository } from "./slack.repository";

const SLACK_STATE_COOKIE = "slack_oauth_state";

const channelSchema = z.object({
  channel: z.string().trim().min(1).max(100),
});

function redirectToDashboard(res: Response, slackResult: string) {
  res.redirect(`${env.FRONTEND_URL}/?slack=${slackResult}`);
}

export class SlackController {
  startOAuth = (_req: Request, res: Response) => {
    const state = crypto.randomBytes(32).toString("hex");

    res.cookie(SLACK_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 10 * 60 * 1000,
      path: "/api/slack",
    });

    res.redirect(slackService.getAuthorizationUrl(state));
  };

  oauthCallback = async (req: Request, res: Response) => {
    const { code, state, error } = req.query;
    const expectedState = req.cookies?.[SLACK_STATE_COOKIE];

    res.clearCookie(SLACK_STATE_COOKIE, { path: "/api/slack" });

    if (error) {
      return redirectToDashboard(res, "cancelled");
    }

    if (typeof state !== "string" || !expectedState || state !== expectedState) {
      return redirectToDashboard(res, "invalid_state");
    }

    if (typeof code !== "string") {
      return redirectToDashboard(res, "error");
    }

    try {
      const result = await slackService.exchangeCode(code);

      if (!result.access_token || !result.team?.id) {
        return redirectToDashboard(res, "error");
      }

      await slackRepository.upsertConnection({
        userId: req.userId,
        teamId: result.team.id,
        teamName: result.team.name,
        accessToken: result.access_token,
      });

      redirectToDashboard(res, "connected");
    } catch (err) {
      console.error("Slack OAuth error:", err);
      redirectToDashboard(res, "error");
    }
  };

  getStatus = async (req: Request, res: Response) => {
    const connection = await slackRepository.getStatus(req.userId);

    res.json({
      connected: Boolean(connection),
      connection,
    });
  };

  setChannel = async (req: Request, res: Response) => {
    const input = channelSchema.parse(req.body);
    const connection = await slackRepository.findActiveConnection(req.userId);

    if (!connection) {
      throw new HttpError(404, "Slack is not connected");
    }

    const channelName = input.channel.replace(/^#/, "");

    try {
      const response = await slackService.sendMessage(
        connection.accessToken,
        /^[CG][A-Z0-9]+$/.test(channelName) ? channelName : `#${channelName}`,
        "ReachInbox will post rate-limit alerts in this channel.",
      );

      await slackRepository.updateChannel(
        connection.id,
        response.channel ?? channelName,
        channelName,
      );
    } catch (err) {
      const slackError = err instanceof Error ? err.message : "";

      if (slackError.includes("not_in_channel")) {
        throw new HttpError(400, `Invite the ReachInbox app to #${channelName} in Slack first`);
      }

      if (slackError.includes("channel_not_found")) {
        throw new HttpError(400, `Channel #${channelName} was not found`);
      }

      throw err;
    }

    res.json({ connection: await slackRepository.getStatus(req.userId) });
  };

  disconnect = async (req: Request, res: Response) => {
    const connection = await slackRepository.disconnect(req.userId);

    if (!connection) {
      throw new HttpError(404, "No active Slack connection found");
    }

    res.status(204).end();
  };
}

export const slackController = new SlackController();
