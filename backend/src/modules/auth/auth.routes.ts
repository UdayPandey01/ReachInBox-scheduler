import crypto from "crypto";
import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { OAuth2Client } from "google-auth-library";
import { db } from "../../config/db";
import { env, isProduction } from "../../config/env";
import { users } from "../../db/schema";
import {
  clearSessionCookie,
  requireAuth,
  setSessionCookie,
} from "../../middleware/requireAuth";
import { sendersRepository } from "../senders/senders.repository";

const GOOGLE_STATE_COOKIE = "google_oauth_state";

const googleClient = new OAuth2Client({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: env.GOOGLE_REDIRECT_URI,
});

const router = Router();

function redirectToLoginWithError(res: Response, error: string) {
  res.redirect(`${env.FRONTEND_URL}/?error=${encodeURIComponent(error)}`);
}

router.get("/google", (_req, res) => {
  const state = crypto.randomBytes(32).toString("hex");

  res.cookie(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 10 * 60 * 1000,
    path: "/api/auth",
  });

  const authorizationUrl = googleClient.generateAuthUrl({
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account",
  });

  res.redirect(authorizationUrl);
});

router.get("/google/callback", async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  const expectedState = req.cookies?.[GOOGLE_STATE_COOKIE];

  res.clearCookie(GOOGLE_STATE_COOKIE, { path: "/api/auth" });

  if (error) {
    return redirectToLoginWithError(res, "Google sign-in was cancelled");
  }

  if (
    typeof state !== "string" ||
    typeof expectedState !== "string" ||
    state.length !== expectedState.length ||
    !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expectedState))
  ) {
    return redirectToLoginWithError(res, "Sign-in session expired, please try again");
  }

  if (typeof code !== "string") {
    return redirectToLoginWithError(res, "Missing Google authorization code");
  }

  try {
    const { tokens } = await googleClient.getToken(code);

    if (!tokens.id_token) {
      return redirectToLoginWithError(res, "Google did not return an identity token");
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const profile = ticket.getPayload();

    if (!profile?.sub || !profile.email || !profile.email_verified) {
      return redirectToLoginWithError(res, "Your Google email is not verified");
    }

    const email = profile.email.toLowerCase();
    const name = profile.name ?? email;

    const [user] = await db
      .insert(users)
      .values({
        googleId: profile.sub,
        name,
        email,
        avatarUrl: profile.picture ?? null,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          googleId: profile.sub,
          name,
          avatarUrl: profile.picture ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    await sendersRepository.ensureDefaultSender(user.id, user.email, user.name);

    setSessionCookie(res, user.id);

    res.redirect(env.FRONTEND_URL);
  } catch (err) {
    console.error("Google sign-in failed:", err);
    redirectToLoginWithError(res, "Google sign-in failed, please try again");
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, req.userId))
    .limit(1);

  if (!user) {
    clearSessionCookie(res);
    return res.status(401).json({ message: "Not authenticated" });
  }

  res.json({ user });
});

router.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

export default router;
