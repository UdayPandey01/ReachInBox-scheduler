import { Router } from "express";
import { slackController } from "./slack.controller";
import { requireAuth } from "../../middleware/requireAuth";

const router = Router();

router.use(requireAuth);

router.get("/oauth", slackController.startOAuth);
router.get("/oauth/callback", slackController.oauthCallback);
router.get("/status", slackController.getStatus);
router.put("/channel", slackController.setChannel);
router.post("/disconnect", slackController.disconnect);

export { router as slackRouter };
